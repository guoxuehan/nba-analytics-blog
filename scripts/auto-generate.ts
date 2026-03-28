/**
 * 記事自動生成スクリプト
 * - data/nba-latest.json を読み込み
 * - 4テーマを自動選定
 * - Claude APIで記事を生成
 * - articles-draft/ に保存
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import type { NBALatestData } from './fetch-nba-data'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')
const MODEL = 'claude-sonnet-4-20250514'

type ArticleTheme = {
  id: string
  title: string
  prompt: string
}

// ─── プロンプトルール ─────────────────────────────────────────────────
const ARTICLE_RULES = `
あなたはNBA分析メディア「NBA COURT VISION」のAI編集アシスタントです。
戦略コンサルタント兼PhDデータサイエンティストの視点で記事を作成してください。

出力フォーマット（必ずこの順番・形式で出力すること）：
---METADATA---
title: （30〜40文字、キーワードを前半に）
slug: （英語、ハイフン区切り、キーワード含む）
category: （player_analysis / team_analysis / tactics / data）
tags: （カンマ区切り、5〜7個）
excerpt: （100〜150文字の抜粋）
---METADATA---
---BODY---
（Markdown形式の記事本文、2,000〜3,000文字）
---BODY---
---XPOST---
（X投稿文3パターン）
---XPOST---

禁止ワード・表現（絶対に使うな）：
「〜と言っても過言ではない」「注目に値する」「特筆すべき」
「見逃せない」「〜を物語っている」「〜を如実に示している」
「しかしながら」「とはいえ」「いずれにせよ」「総じて」
「まさに」「実に」「非常に」「極めて」
「深掘りしていこう」「見ていこう」「確認していこう」
「それでは」「さて」で段落を始める
「興味深いことに」「注目すべきは」
「驚異的」「圧倒的」「歴史的」は記事全体で各1回まで
「〜の観点から」「多角的に」「包括的に」「示唆している」
「浮き彫りになった」「このように」で段落を始める

構文ルール：
- 同じ構文を3回以上繰り返さない
- メタ的な文章構成の説明をしない
- 「まず」「次に」「そして」「最後に」の4連続禁止

文体：
- 一文は35文字を基本、最長50文字
- 体言止めを多用
- 数字で始まる文を意図的に作れ
- 「だ」「だった」で終われ
- 問いかけは短く鋭く
- リード文は事実・数字・場面からいきなり入れ
- 見出しは数字・固有名詞・動詞を含む具体的なものに
- まとめは要約するな、新しい視点を1つ残せ

記事構成：
1. リード文（3〜4文）
2. h2：データ分析セクション1
3. h2：データ分析セクション2
4. h2：考察・深掘り
5. h2：筆者の視点（戦略コンサル×データサイエンティストとして1〜2段落）
6. h2：まとめ

タグのルール：
- 選手名はカタカナ「名・姓」（例：バム・アデバヨ）
- チーム名は日本語通称（例：マイアミ・ヒート）
- 5〜7個

X投稿文：
- パターン1【データ訴求型】、パターン2【議論喚起型】、パターン3【ストーリー型】
- 各280文字以内、#NBA + 関連タグ2〜3個、URLは [URL]
`.trim()

// ─── テーマ選定ロジック ──────────────────────────────────────────────
function selectThemes(data: NBALatestData): ArticleTheme[] {
  const themes: ArticleTheme[] = []
  const { date, games, topScorers } = data

  // a. 最大得点差の試合 → 「粉砕」系
  if (games.length > 0) {
    const bigWin = games.reduce((prev, cur) => (cur.scoreDiff > prev.scoreDiff ? cur : prev))
    const loser = bigWin.homeTeam === bigWin.winner ? bigWin.awayTeam : bigWin.homeTeam

    if (bigWin.scoreDiff >= 15) {
      themes.push({
        id: 'blowout',
        title: `${bigWin.winner}が${loser}を粉砕`,
        prompt:
          `${date}のNBA試合で、${bigWin.winner}が${loser}を` +
          `${bigWin.homeScore}-${bigWin.awayScore}（${bigWin.scoreDiff}点差）で粉砕しました。` +
          `この大差勝利の要因を戦術・スタッツ・チーム状況から分析してください。`,
      })
    } else {
      themes.push({
        id: 'blowout',
        title: `${bigWin.winner}の勝利分析`,
        prompt:
          `${date}のNBA試合で、${bigWin.winner}が${loser}に` +
          `${bigWin.homeScore}-${bigWin.awayScore}で勝利しました。` +
          `勝利の要因と今後の展望を分析してください。`,
      })
    }
  }

  // b. 最高個人得点 → 選手分析
  if (topScorers.length > 0) {
    const mvp = topScorers[0]
    themes.push({
      id: 'top-scorer',
      title: `${mvp.playerName}の${mvp.pts}得点分析`,
      prompt:
        `${date}のNBA試合で、${mvp.team}の${mvp.playerName}が` +
        `${mvp.pts}得点・${mvp.reb}リバウンド・${mvp.ast}アシストを記録しました。` +
        `このパフォーマンスをスタッツ・プレースタイル・チームへの貢献度・今シーズンの文脈を含めて徹底分析してください。`,
    })
  }

  // c. 接戦（5点差以内）→ 「逆転勝利」系
  const closeGames = games.filter((g) => g.scoreDiff <= 5)
  if (closeGames.length > 0) {
    const closest = closeGames.reduce((prev, cur) => (cur.scoreDiff < prev.scoreDiff ? cur : prev))
    const loser = closest.homeTeam === closest.winner ? closest.awayTeam : closest.homeTeam
    themes.push({
      id: 'close-game',
      title: `${closest.winner}が${closest.homeScore}-${closest.awayScore}接戦制す`,
      prompt:
        `${date}のNBA試合で、${closest.winner}が${loser}を` +
        `${closest.homeScore}-${closest.awayScore}の接戦で下しました。` +
        `接戦を勝ち切った要因、クラッチタイムの戦術、勝負を決めた局面を分析してください。`,
    })
  } else if (games.length > 1) {
    const g = games[1]
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    themes.push({
      id: 'close-game',
      title: `${g.winner}対${loser} 試合分析`,
      prompt:
        `${date}のNBA試合、${g.winner}対${loser}（${g.homeScore}-${g.awayScore}）を分析してください。` +
        `試合の流れ、両チームの戦術、勝敗を分けたポイントを論じてください。`,
    })
  }

  // d. プレーオフレース → 順位表変動記事
  themes.push({
    id: 'playoff-race',
    title: `2025-26プレーオフレース最新動向`,
    prompt:
      `2025-26 NBAシーズンの現在のプレーオフレース状況を分析してください。` +
      `東西カンファレンスの順位争い、プレーイントーナメント争い、` +
      `優勝候補の現状と課題を${date}時点の情報をもとに論じてください。`,
  })

  // フォールバック（4テーマ未満の場合）
  const fallbacks: ArticleTheme[] = [
    {
      id: 'mvp-race',
      title: '2025-26 MVPレース中間考察',
      prompt:
        '2025-26シーズンのNBA MVPレース候補選手をスタッツ・チーム成績・インパクトで比較分析してください。',
    },
    {
      id: 'analytics',
      title: 'アドバンスドスタッツで読む2025-26シーズン',
      prompt:
        '2025-26 NBAシーズンをPER・BPM・VORP・WSなどのアドバンスドスタッツで分析し、今シーズンのトレンドを解説してください。',
    },
  ]

  for (const fb of fallbacks) {
    if (themes.length >= 4) break
    themes.push(fb)
  }

  return themes.slice(0, 4)
}

// ─── 記事生成 ────────────────────────────────────────────────────────
async function generateArticle(
  client: Anthropic,
  theme: ArticleTheme,
  index: number,
): Promise<string | null> {
  console.log(`\n[${index + 1}/4] ${theme.title}`)
  process.stdout.write('  生成中')

  try {
    let content = ''

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${ARTICLE_RULES}\n\n---\n\n${theme.prompt}`,
        },
      ],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        content += chunk.delta.text
        process.stdout.write('.')
      }
    }
    console.log(' 完了')

    // slug抽出
    const slugMatch = content.match(/^slug:\s*([a-z0-9][a-z0-9-]*)/m)
    if (!slugMatch) {
      console.warn('  ⚠️  slugが見つかりません。スキップします。')
      return null
    }

    const slug = slugMatch[1].trim()
    let filepath = path.join(DRAFT_DIR, `${slug}.md`)

    // 重複回避
    if (fs.existsSync(filepath)) {
      filepath = path.join(DRAFT_DIR, `${slug}-${Date.now()}.md`)
    }

    fs.writeFileSync(filepath, content, 'utf-8')
    console.log(`  ✅ 保存: articles-draft/${path.basename(filepath)}`)
    return filepath
  } catch (err) {
    console.error(`  ❌ 生成失敗: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('━'.repeat(50))
  console.log('  記事自動生成')
  console.log('━'.repeat(50))

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY が設定されていません')
    process.exit(1)
  }

  const client = new Anthropic({ apiKey })

  // データ読み込み
  const dataPath = path.join(DATA_DIR, 'nba-latest.json')
  let nbaData: NBALatestData

  if (fs.existsSync(dataPath)) {
    nbaData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as NBALatestData
    console.log(`\nデータ読み込み: ${nbaData.date}（${nbaData.gamesCount}試合）`)
  } else {
    console.warn('\n⚠️  data/nba-latest.json が見つかりません。フォールバックテーマを使用します。')
    nbaData = {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      fetchedAt: new Date().toISOString(),
      gamesCount: 0,
      games: [],
      topScorers: [],
    }
  }

  if (!fs.existsSync(DRAFT_DIR)) {
    fs.mkdirSync(DRAFT_DIR, { recursive: true })
  }

  // テーマ選定
  const themes = selectThemes(nbaData)
  console.log(`\nテーマ選定: ${themes.length}件`)
  themes.forEach((t, i) => console.log(`  [${i + 1}] ${t.title}`))

  // 記事生成（順次実行・レート制限対策）
  let succeeded = 0
  for (let i = 0; i < themes.length; i++) {
    const result = await generateArticle(client, themes[i], i)
    if (result) succeeded++
    if (i < themes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log('\n' + '━'.repeat(50))
  console.log(`  生成完了: ${succeeded}/${themes.length} 本`)
  console.log('━'.repeat(50) + '\n')
}

main().catch((err) => {
  console.error('エラー:', err instanceof Error ? err.message : err)
  process.exit(1)
})
