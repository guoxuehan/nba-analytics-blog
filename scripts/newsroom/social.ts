/**
 * 📣 マーケ担当（投稿係）: 配信Issue（マーケ:配信待ち）の投稿文を、記事の公開時刻を過ぎたら X に投稿する
 *
 * - 投稿するのは配信Issueの「最初の投稿文」。別のパターンを使いたいときは、Issue本文で順番を入れ替えるか書き換える
 * - 1日（日本時間）の投稿数は X_DAILY_POST_LIMIT 本まで（URL付きの投稿は X API で1件 約$0.20 かかるため）
 * - 投稿したら URL をコメントし、ラベルを「マーケ:配信済」にしてクローズする
 * - 失敗した配信Issueは「要確認」にして、毎時の再試行を止める（「マーケ:配信待ち」を付け直すと再挑戦する）
 * - X API のキーが未設定なら何もしない。DRY_RUN=1 なら投稿せずに表示だけする
 *
 * 認証: OAuth 1.0a ユーザーコンテキスト（アプリ所有者のアカウントで投稿する）
 */
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { LABELS, appendSummary, commentIssue, ensureLabels, gh, ghJson, todayJST } from './_lib'

const DRY_RUN = process.env.DRY_RUN === '1'
const DAILY_LIMIT = Math.max(0, parseInt(process.env.X_DAILY_POST_LIMIT ?? '1', 10))
const ENDPOINT = 'https://api.x.com/2/tweets'

type PromoIssue = { number: number; title: string; body: string }

// ─── 投稿文の長さ（X の重み付き文字数。全角は2、URL は一律23）─────────────
const MAX_WEIGHT = 280
function isNarrow(cp: number): boolean {
  return (
    (cp >= 0x0000 && cp <= 0x10ff) ||
    (cp >= 0x2000 && cp <= 0x200d) ||
    (cp >= 0x2010 && cp <= 0x201f) ||
    (cp >= 0x2032 && cp <= 0x2037)
  )
}
export function weightedLength(text: string): number {
  const urls = text.match(/https?:\/\/\S+/g) ?? []
  const rest = urls.reduce((t, u) => t.replace(u, ''), text)
  let weight = urls.length * 23
  for (const ch of rest) weight += isNarrow(ch.codePointAt(0)!) ? 1 : 2
  return weight
}

// ─── OAuth 1.0a 署名 ─────────────────────────────────────────────────
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

function oauthHeader(method: string, url: string, keys: Record<'apiKey' | 'apiSecret' | 'token' | 'tokenSecret', string>): string {
  const params: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.token,
    oauth_version: '1.0',
  }
  // JSON ボディは署名対象に含めない（署名するのはクエリとフォーム形式のボディだけ）
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&')
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  const signingKey = `${enc(keys.apiSecret)}&${enc(keys.tokenSecret)}`
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64')
  return (
    'OAuth ' +
    Object.keys(params)
      .sort()
      .map((k) => `${enc(k)}="${enc(params[k])}"`)
      .join(', ')
  )
}

async function postToX(text: string, keys: Parameters<typeof oauthHeader>[2]): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', ENDPOINT, keys), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string }
  if (res.status !== 201 || !json.data?.id) {
    throw new Error(`X API ${res.status}: ${json.detail ?? json.title ?? JSON.stringify(json).slice(0, 300)}`)
  }
  return json.data.id
}

// ─── 配信Issue の読み取り ─────────────────────────────────────────────
function parsePromo(body: string): { slug: string; text: string } | null {
  const slug = body.match(/\/articles\/([a-z0-9-]+)/)?.[1]
  const text = body.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1]?.trim()
  return slug && text ? { slug, text } : null
}

/** 今日（日本時間）すでに投稿した本数 */
function postedToday(): number {
  const today = todayJST()
  const closed = ghJson<{ closedAt: string | null }[]>([
    'issue', 'list', '--state', 'closed', '--label', LABELS.posted, '--json', 'closedAt', '--limit', '50',
  ])
  return closed.filter((i) => i.closedAt && new Date(new Date(i.closedAt).getTime() + 9 * 3600 * 1000).toISOString().startsWith(today)).length
}

async function main() {
  const keys = {
    apiKey: process.env.X_API_KEY ?? '',
    apiSecret: process.env.X_API_SECRET ?? '',
    token: process.env.X_ACCESS_TOKEN ?? '',
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET ?? '',
  }
  if (!DRY_RUN && Object.values(keys).some((v) => !v)) {
    console.log('📣 X API のキーが未設定のため、自動投稿はスキップします')
    return
  }
  if (!DRY_RUN) ensureLabels()

  const remaining = DAILY_LIMIT - postedToday()
  if (remaining <= 0) {
    console.log(`📣 本日の投稿上限（${DAILY_LIMIT}本）に達しています`)
    return
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const promos = ghJson<PromoIssue[]>([
    'issue', 'list', '--state', 'open', '--label', LABELS.promo, '--json', 'number,title,body', '--limit', '30',
  ])

  // 公開時刻を過ぎたものを、公開が古い順に
  const ready: { issue: PromoIssue; text: string; publishedAt: string }[] = []
  for (const issue of promos) {
    const promo = parsePromo(issue.body)
    if (!promo) {
      console.warn(`⚠️  #${issue.number}: 投稿文または記事URLが見つかりません`)
      continue
    }
    const { data } = await supabase
      .from('articles')
      .select('published_at, published')
      .eq('slug', promo.slug)
      .maybeSingle()
    if (!data?.published || !data.published_at || new Date(data.published_at) > new Date()) continue
    ready.push({ issue, text: promo.text, publishedAt: data.published_at })
  }
  ready.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))

  const summary: string[] = ['### 📣 X 自動投稿']
  for (const { issue, text } of ready.slice(0, remaining)) {
    const weight = weightedLength(text)
    if (weight > MAX_WEIGHT) {
      const msg = `投稿文が長すぎます（${weight}/${MAX_WEIGHT}）。短くしてから \`${LABELS.promo}\` を付け直してください。`
      console.warn(`⚠️  #${issue.number}: ${msg}`)
      if (!DRY_RUN) {
        commentIssue(issue.number, `📣 **自動投稿できませんでした**\n\n${msg}`)
        gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.needsHuman])
      }
      continue
    }

    if (DRY_RUN) {
      console.log(`\n[DRY RUN] #${issue.number}（${weight}/${MAX_WEIGHT}）\n${text}`)
      summary.push(`- [DRY RUN] #${issue.number} ${issue.title}`)
      continue
    }

    try {
      const id = await postToX(text, keys)
      const url = `https://x.com/i/web/status/${id}`
      commentIssue(issue.number, `📣 **Xに投稿しました** → ${url}`)
      gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.posted])
      gh(['issue', 'close', String(issue.number), '--reason', 'completed'])
      console.log(`📣 #${issue.number} → ${url}`)
      summary.push(`- #${issue.number} ${issue.title} → ${url}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ #${issue.number}: ${msg}`)
      commentIssue(issue.number, `📣 **自動投稿に失敗しました**\n\n\`\`\`\n${msg}\n\`\`\`\n\n直したら \`${LABELS.promo}\` を付け直すと再挑戦します。`)
      gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.promo, '--add-label', LABELS.needsHuman])
      summary.push(`- ❌ #${issue.number} ${msg}`)
      process.exitCode = 1 // 失敗を通知で気づけるようにする
    }
  }
  if (summary.length === 1) summary.push(`- 投稿対象なし（公開済みの配信待ち ${ready.length}件 / 本日の残り枠 ${remaining}本）`)
  appendSummary(summary.join('\n'))
}

main().catch((err) => {
  console.error('❌ X 自動投稿:', err instanceof Error ? err.message : err)
  process.exit(1)
})
