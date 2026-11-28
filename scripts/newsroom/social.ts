/**
 * 📣 マーケ担当（投稿係）: 配信Issue（マーケ:配信待ち）の投稿文を、記事の公開時刻を過ぎたら SNS に投稿する
 *
 * 投稿先（認証情報が設定されているものだけ使う）
 *   - Bluesky: BLUESKY_HANDLE + BLUESKY_APP_PASSWORD（無料）
 *   - X:       X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET（URL付き投稿は1件 約$0.20）
 *
 * - 投稿するのは配信Issueの「最初の投稿文」。別のパターンを使いたいときは、Issue本文で順番を入れ替えるか書き換える
 * - 1日（日本時間）に投稿する記事数は SOCIAL_DAILY_POST_LIMIT 本まで（X を使うときは費用に注意）
 * - 投稿したら URL をコメントし、ラベルを「マーケ:配信済」にしてクローズする
 * - 失敗した配信Issueは「要確認」にして、毎時の再試行を止める（「マーケ:配信待ち」を付け直すと再挑戦する）
 * - DRY_RUN=1 なら投稿せずに表示だけする
 */
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { LABELS, appendSummary, commentIssue, ensureLabels, gh, ghJson, todayJST } from './_lib'

const DRY_RUN = process.env.DRY_RUN === '1'

type PromoIssue = { number: number; title: string; body: string }
type Article = { title: string; excerpt: string | null; url: string }
type Channel = {
  name: string
  /** 投稿前の長さチェック。問題があれば理由を返す */
  check: (text: string) => string | null
  post: (text: string, article: Article) => Promise<string>
}

// ═══ Bluesky ═══════════════════════════════════════════════════════════
const BSKY_SERVICE = 'https://bsky.social/xrpc'
const BSKY_MAX_GRAPHEMES = 300
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })
const graphemes = (s: string) => [...segmenter.segment(s)].length

/** リンクとハッシュタグを、Bluesky のリッチテキスト（UTF-8 のバイト位置）にする */
function bskyFacets(text: string) {
  const facets: object[] = []
  const byteIndex = (charIndex: number) => Buffer.byteLength(text.slice(0, charIndex), 'utf8')
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    facets.push({
      index: { byteStart: byteIndex(m.index!), byteEnd: byteIndex(m.index! + m[0].length) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    })
  }
  for (const m of text.matchAll(/(^|\s)#([^\s#]+)/g)) {
    const start = m.index! + m[1].length
    facets.push({
      index: { byteStart: byteIndex(start), byteEnd: byteIndex(start + 1 + m[2].length) },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2] }],
    })
  }
  return facets
}

async function bskyCall<T>(method: string, body: object, token?: string): Promise<T> {
  const res = await fetch(`${BSKY_SERVICE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string }
  if (!res.ok) throw new Error(`Bluesky ${method} ${res.status}: ${json.message ?? json.error ?? ''}`)
  return json
}

function blueskyChannel(handle: string, appPassword: string): Channel {
  let session: { accessJwt: string; did: string; handle: string } | null = null
  return {
    name: 'Bluesky',
    check: (text) => {
      const n = graphemes(text)
      return n > BSKY_MAX_GRAPHEMES ? `Bluesky の上限を超えています（${n}/${BSKY_MAX_GRAPHEMES}文字）` : null
    },
    post: async (text, article) => {
      session ??= await bskyCall<{ accessJwt: string; did: string; handle: string }>(
        'com.atproto.server.createSession',
        { identifier: handle, password: appPassword },
      )
      const { did, accessJwt, handle: actor } = session
      const { uri } = await bskyCall<{ uri: string }>(
        'com.atproto.repo.createRecord',
        {
          repo: did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            facets: bskyFacets(text),
            langs: ['ja'],
            createdAt: new Date().toISOString(),
            // 記事のリンクカード
            embed: {
              $type: 'app.bsky.embed.external',
              external: { uri: article.url, title: article.title, description: article.excerpt ?? '' },
            },
          },
        },
        accessJwt,
      )
      const rkey = uri.split('/').pop()
      return `https://bsky.app/profile/${actor}/post/${rkey}`
    },
  }
}

// ═══ X ═════════════════════════════════════════════════════════════════
const X_ENDPOINT = 'https://api.x.com/2/tweets'
const X_MAX_WEIGHT = 280

/** X の重み付き文字数（全角は2、URL は一律23） */
function xWeightedLength(text: string): number {
  const urls = text.match(/https?:\/\/\S+/g) ?? []
  const rest = urls.reduce((t, u) => t.replace(u, ''), text)
  let weight = urls.length * 23
  for (const ch of rest) {
    const cp = ch.codePointAt(0)!
    const narrow =
      cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037)
    weight += narrow ? 1 : 2
  }
  return weight
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

type XKeys = Record<'apiKey' | 'apiSecret' | 'token' | 'tokenSecret', string>

/** OAuth 1.0a（ユーザーコンテキスト）の Authorization ヘッダー。JSON ボディは署名対象に含めない */
function oauthHeader(method: string, url: string, keys: XKeys): string {
  const params: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.token,
    oauth_version: '1.0',
  }
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&')
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  params.oauth_signature = crypto
    .createHmac('sha1', `${enc(keys.apiSecret)}&${enc(keys.tokenSecret)}`)
    .update(base)
    .digest('base64')
  return 'OAuth ' + Object.keys(params).sort().map((k) => `${enc(k)}="${enc(params[k])}"`).join(', ')
}

function xChannel(keys: XKeys): Channel {
  return {
    name: 'X',
    check: (text) => {
      const w = xWeightedLength(text)
      return w > X_MAX_WEIGHT ? `X の上限を超えています（${w}/${X_MAX_WEIGHT}）` : null
    },
    post: async (text) => {
      const res = await fetch(X_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: oauthHeader('POST', X_ENDPOINT, keys), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string }
      if (res.status !== 201 || !json.data?.id) {
        throw new Error(`X API ${res.status}: ${json.detail ?? json.title ?? JSON.stringify(json).slice(0, 300)}`)
      }
      return `https://x.com/i/web/status/${json.data.id}`
    },
  }
}

// ═══ 配信 ══════════════════════════════════════════════════════════════
function parsePromo(body: string): { slug: string; text: string } | null {
  const slug = body.match(/\/articles\/([a-z0-9-]+)/)?.[1]
  const text = body.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1]?.trim()
  return slug && text ? { slug, text } : null
}

/** 今日（日本時間）すでに配信した記事の本数 */
function postedToday(): number {
  const today = todayJST()
  const closed = ghJson<{ closedAt: string | null }[]>([
    'issue', 'list', '--state', 'closed', '--label', LABELS.posted, '--json', 'closedAt', '--limit', '50',
  ])
  return closed.filter(
    (i) => i.closedAt && new Date(new Date(i.closedAt).getTime() + 9 * 3600 * 1000).toISOString().startsWith(today),
  ).length
}

function enabledChannels(): Channel[] {
  const channels: Channel[] = []
  const { BLUESKY_HANDLE, BLUESKY_APP_PASSWORD } = process.env
  if (BLUESKY_HANDLE && BLUESKY_APP_PASSWORD) channels.push(blueskyChannel(BLUESKY_HANDLE, BLUESKY_APP_PASSWORD))
  const xKeys = {
    apiKey: process.env.X_API_KEY ?? '',
    apiSecret: process.env.X_API_SECRET ?? '',
    token: process.env.X_ACCESS_TOKEN ?? '',
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET ?? '',
  }
  if (Object.values(xKeys).every(Boolean)) channels.push(xChannel(xKeys))
  return channels
}

async function main() {
  const channels = enabledChannels()
  if (channels.length === 0 && !DRY_RUN) {
    console.log('📣 SNS の認証情報が未設定のため、自動投稿はスキップします')
    return
  }
  // X は費用がかかるので、X を使うときの既定は1日1本。Bluesky だけなら毎日の記事数（3本）まで
  const usesX = channels.some((c) => c.name === 'X')
  const dailyLimit = Math.max(0, parseInt(process.env.SOCIAL_DAILY_POST_LIMIT || (usesX ? '1' : '3'), 10))
  if (!DRY_RUN) ensureLabels()

  const remaining = dailyLimit - postedToday()
  if (remaining <= 0) {
    console.log(`📣 本日の投稿上限（${dailyLimit}本）に達しています`)
    return
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const promos = ghJson<PromoIssue[]>([
    'issue', 'list', '--state', 'open', '--label', LABELS.promo, '--json', 'number,title,body', '--limit', '30',
  ])

  // 公開時刻を過ぎたものを、公開が古い順に
  const ready: { issue: PromoIssue; text: string; article: Article; publishedAt: string }[] = []
  for (const issue of promos) {
    const promo = parsePromo(issue.body)
    if (!promo) {
      console.warn(`⚠️  #${issue.number}: 投稿文または記事URLが見つかりません`)
      continue
    }
    const { data } = await supabase
      .from('articles')
      .select('title, excerpt, published_at, published')
      .eq('slug', promo.slug)
      .maybeSingle()
    if (!data?.published || !data.published_at || new Date(data.published_at) > new Date()) continue
    const url = promo.text.match(/https?:\/\/\S+/)?.[0] ?? ''
    ready.push({ issue, text: promo.text, article: { title: data.title, excerpt: data.excerpt, url }, publishedAt: data.published_at })
  }
  ready.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))

  /**
   * 記事URLに流入元タグ（UTM）を付ける。GA4 で SNS ごとの流入を「直接」と分けて数えるため。
   * 記事はURLのパスで分かるので utm_campaign は付けない（Bluesky の300文字制限に収めるため短くする）
   */
  const withUtm = (url: string, channel: string): string => {
    if (!url) return url
    const u = new URL(url)
    u.searchParams.set('utm_source', channel.toLowerCase())
    u.searchParams.set('utm_medium', 'social')
    return u.toString()
  }
  const tagged = (text: string, article: Article, channel: string) => {
    const url = withUtm(article.url, channel)
    return { text: article.url ? text.split(article.url).join(url) : text, article: { ...article, url } }
  }

  const summary: string[] = [`### 📣 SNS 自動投稿（${channels.map((c) => c.name).join('・') || '投稿先なし'}）`]
  for (const { issue, text, article } of ready.slice(0, remaining)) {
    const problems = channels.map((c) => c.check(tagged(text, article, c.name).text)).filter(Boolean) as string[]
    if (problems.length > 0) {
      const msg = `${problems.join(' / ')}。短くしてから \`${LABELS.promo}\` を付け直してください。`
      console.warn(`⚠️  #${issue.number}: ${msg}`)
      if (!DRY_RUN) {
        commentIssue(issue.number, `📣 **自動投稿できませんでした**\n\n${msg}`)
        gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.needsHuman])
      }
      continue
    }

    if (DRY_RUN) {
      console.log(`\n[DRY RUN] #${issue.number}（${graphemes(text)}文字 / X換算 ${xWeightedLength(text)}）\n${text}`)
      summary.push(`- [DRY RUN] #${issue.number} ${issue.title}`)
      continue
    }

    const results: string[] = []
    const errors: string[] = []
    for (const channel of channels) {
      try {
        const t = tagged(text, article, channel.name)
        results.push(`${channel.name}: ${await channel.post(t.text, t.article)}`)
      } catch (err) {
        errors.push(`${channel.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (errors.length === 0) {
      commentIssue(issue.number, `📣 **投稿しました**\n\n${results.map((r) => `- ${r}`).join('\n')}`)
      gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.posted])
      gh(['issue', 'close', String(issue.number), '--reason', 'completed'])
      summary.push(`- #${issue.number} ${issue.title}\n${results.map((r) => `  - ${r}`).join('\n')}`)
    } else {
      // 一部だけ成功した場合も、二重投稿を避けるため再試行はしない
      commentIssue(
        issue.number,
        [
          '📣 **自動投稿に失敗しました**',
          ...(results.length ? ['', '成功:', ...results.map((r) => `- ${r}`)] : []),
          '',
          '失敗:',
          '```',
          ...errors,
          '```',
          '',
          `直したら \`${LABELS.promo}\` を付け直すと再挑戦します（成功済みの投稿先にも再投稿されるので、その場合は手動で投稿してください）。`,
        ].join('\n'),
      )
      gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.needsHuman])
      summary.push(`- ❌ #${issue.number} ${errors.join(' / ')}`)
      process.exitCode = 1 // 失敗を通知で気づけるようにする
    }
    errors.forEach((e) => console.error(`❌ #${issue.number} ${e}`))
    results.forEach((r) => console.log(`📣 #${issue.number} ${r}`))
  }
  if (summary.length === 1) summary.push(`- 投稿対象なし（公開済みの配信待ち ${ready.length}件 / 本日の残り枠 ${remaining}本）`)
  appendSummary(summary.join('\n'))
}

main().catch((err) => {
  console.error('❌ SNS 自動投稿:', err instanceof Error ? err.message : err)
  process.exit(1)
})
