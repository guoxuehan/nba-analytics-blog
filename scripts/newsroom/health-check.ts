/**
 * 🩺 健康診断: 編集部の流れが止まっていないかを毎日確かめる
 *
 * 各ワークフローは個別には成功していても、流れ全体として記事が出なくなることがある
 * （編集長が毎日1本も採用しない、校閲デスクの認証切れで全記事が「人間の確認待ち」になる、
 *   PRがマージされずに溜まる、など）。
 * 最後の公開から STALE_DAYS 日以上たっていたら失敗として終了し、GitHub から通知が届くようにする。
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { appendSummary, ghJson } from './_lib'

const STALE_DAYS = Math.max(1, parseInt(process.env.STALE_DAYS ?? '2', 10))

type OpenPr = { number: number; title: string; createdAt: string; url: string }

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase の環境変数が設定されていません')
  const supabase = createClient(url, key)

  // 公開時刻は数時間ずつ先にずらして登録されるため、すでに公開時刻を過ぎた記事だけを見る
  const { data, error } = await supabase
    .from('articles')
    .select('title, published_at')
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`記事の取得に失敗: ${error.message}`)

  const last = data?.[0]
  const days = last?.published_at
    ? (Date.now() - new Date(last.published_at).getTime()) / 86_400_000
    : Infinity

  // 止まっている場所の手がかりとして、確認待ちのPRを一覧にする
  let openPrs: OpenPr[] = []
  try {
    openPrs = ghJson<OpenPr[]>(['pr', 'list', '--state', 'open', '--json', 'number,title,createdAt,url', '--limit', '20'])
  } catch {
    // PRの一覧が取れなくても診断自体は続ける
  }

  const lastLine = last
    ? `最後の公開: ${last.published_at}（${days.toFixed(1)}日前）「${last.title}」`
    : '公開済みの記事がありません'
  const prLines = openPrs.map((p) => `- #${p.number} ${p.title}（${p.createdAt.slice(0, 10)}作成）${p.url}`)

  console.log(lastLine)
  if (prLines.length) console.log(`オープン中のPR: ${prLines.length}件\n${prLines.join('\n')}`)

  // 取材の取得元: 試合データを実際に返せているのは ESPN だけなので、ESPN が落ちたら失敗にする。
  // ほかの取得元（NBA.com・balldontlie）の失敗は警告にとどめる（試合のない日の0件は失敗ではない）
  const latest = path.join(process.cwd(), 'data', 'nba-latest.json')
  const fetchErrors: string[] = fs.existsSync(latest)
    ? ((JSON.parse(fs.readFileSync(latest, 'utf-8')) as { fetchErrors?: string[] }).fetchErrors ?? [])
    : []
  const espnDown = fetchErrors.some((e) => e.startsWith('site.api.espn.com'))
  for (const e of fetchErrors) console.log(`::warning::取材の取得元が失敗: ${e}`)

  const stale = days >= STALE_DAYS
  appendSummary(
    [
      `### 🩺 健康診断: ${stale ? `❌ ${STALE_DAYS}日以上公開が止まっています` : espnDown ? '❌ 取材の取得元（ESPN）が落ちています' : '✅ 正常'}`,
      `- ${lastLine}`,
      fetchErrors.length ? `- 取材の取得元の失敗: ${fetchErrors.join(' / ')}` : '- 取材の取得元: すべて応答あり',
      prLines.length ? `- オープン中のPR（確認待ちの可能性）:\n${prLines.join('\n')}` : '- オープン中のPRはありません',
    ].join('\n'),
  )

  if (espnDown) {
    throw new Error(
      '取材の取得元 ESPN が応答しません。NBA.com（GitHub Actions からは 403）と balldontlie（APIキー）も使えない場合、' +
        '記者は試合データなしで企画を出します。BALLDONTLIE_API_KEY の更新を検討してください。',
    )
  }
  if (stale) {
    throw new Error(
      `${STALE_DAYS}日以上、記事が公開されていません。` +
        '企画の不採用が続いていないか、校閲デスクの認証（CLAUDE_CODE_OAUTH_TOKEN）が切れていないか、' +
        '確認待ちのPRが溜まっていないかを確認してください。',
    )
  }
}

main().catch((err) => {
  console.error('❌ 健康診断:', err instanceof Error ? err.message : err)
  process.exit(1)
})
