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
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import type { NBALatestData, NBAStandingTeam, GameLeader, PlayerGameStat } from './fetch-nba-data'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')
const MODEL = 'claude-sonnet-4-20250514'

type ArticleTheme = {
  id: string
  title: string
  prompt: string
  hasRealData?: boolean  // true の場合「推定値不使用」指示を付与
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

【必須制約・厳守】
- 記事本文（BODY）は必ず2,000文字以上で書くこと。2,000文字未満は失格。
- excerptは必ず100文字以上150文字以内で書くこと。100文字未満は失格。
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

// ─── 実データ使用指示（ゲームデータあり記事のみ付与）───────────────────
const REAL_DATA_INSTRUCTION = `
【データ利用規則・厳守】
以下のデータは本日取得した最新の実測値です。
このデータのみを使用し、推定値・予測値は絶対に使わないこと。
データに含まれない選手のシーズン平均・過去スタッツ等は記載しないこと。
数字は提供されたものをそのまま使用し、切り捨て・四捨五入・補正をしないこと。
`.trim()

// ─── 選手スタッツのフォーマット ──────────────────────────────────────

function formatLeaders(
  leaders: { home: GameLeader[]; away: GameLeader[] } | undefined,
  homeTeam: string,
  awayTeam: string,
): string {
  if (!leaders) return ''

  function formatSide(side: GameLeader[], teamName: string): string {
    if (side.length === 0) return ''
    const parts = side.map((l) => {
      const statLabel = l.stat === 'pts' ? '得点' : l.stat === 'reb' ? 'リバウンド' : 'アシスト'
      return `${l.playerName}（${statLabel}${l.value}）`
    })
    return `${teamName}: ${parts.join('、')}`
  }

  const homePart = formatSide(leaders.home, homeTeam)
  const awayPart = formatSide(leaders.away, awayTeam)
  const parts = [homePart, awayPart].filter(Boolean)
  return parts.length > 0 ? `\n主要選手スタッツ: ${parts.join(' / ')}` : ''
}

// ─── standings.json の読み込み ────────────────────────────────────────
type StandingsData = {
  season: string
  east: NBAStandingTeam[]
  west: NBAStandingTeam[]
}

function loadStandings(): StandingsData | null {
  const p = path.join(DATA_DIR, 'standings.json')
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as StandingsData
  } catch {
    return null
  }
}

// ─── 順位表ベースのテーマ生成 ────────────────────────────────────────
function standingsThemes(standings: StandingsData, date: string): ArticleTheme[] {
  const themes: ArticleTheme[] = []
  const { east, west } = standings

  // 1位チームの分析
  const eastFirst = east[0]
  if (eastFirst) {
    themes.push({
      id: 'east-leader',
      title: `${eastFirst.teamCity} ${eastFirst.teamName}東地区首位の強さを解剖`,
      prompt:
        `${date}時点、${eastFirst.teamCity} ${eastFirst.teamName}が東地区首位に立っています（${eastFirst.wins}勝${eastFirst.losses}敗・勝率${(eastFirst.winPct * 100).toFixed(1)}%）。` +
        `この成績を支える戦術・ロスター構成・強みと弱点を徹底分析してください。`,
    })
  }

  const westFirst = west[0]
  if (westFirst) {
    themes.push({
      id: 'west-leader',
      title: `${westFirst.teamCity} ${westFirst.teamName}西地区首位の実力を分析`,
      prompt:
        `${date}時点、${westFirst.teamCity} ${westFirst.teamName}が西地区首位に立っています（${westFirst.wins}勝${westFirst.losses}敗・勝率${(westFirst.winPct * 100).toFixed(1)}%）。` +
        `チームの特徴、スター選手のパフォーマンス、優勝候補としての評価を論じてください。`,
    })
  }

  // プレーイン争い（7〜10位）
  const eastBubble = east.slice(6, 10)
  if (eastBubble.length >= 2) {
    const names = eastBubble.map((t) => `${t.teamCity} ${t.teamName}`).join('・')
    themes.push({
      id: 'east-bubble',
      title: `東地区プレーイン争いの現状と行方`,
      prompt:
        `${date}時点の東地区プレーイントーナメント争いを分析してください。` +
        `現在7〜10位を争う${names}のそれぞれの強み・弱み・残り試合の有利不利を比較し、` +
        `プレーオフに進める2チームを予測してください。`,
    })
  }

  const westBubble = west.slice(6, 10)
  if (westBubble.length >= 2) {
    const names = westBubble.map((t) => `${t.teamCity} ${t.teamName}`).join('・')
    themes.push({
      id: 'west-bubble',
      title: `西地区プレーイン争いの現状と行方`,
      prompt:
        `${date}時点の西地区プレーイントーナメント争いを分析してください。` +
        `現在7〜10位を争う${names}の比較分析と、プレーオフ進出予測を論じてください。`,
    })
  }

  return themes.slice(0, 4)
}

// ─── テーマ選定ロジック ──────────────────────────────────────────────
function selectThemes(
  data: NBALatestData,
  standings: StandingsData | null,
  _playerStats: PlayerGameStat[],
): ArticleTheme[] {
  const themes: ArticleTheme[] = []
  const { date, games, topScorers } = data

  // ── ゲームデータがある場合 ───────────────────────────────────────

  // a. 最大得点差の試合 → 「粉砕」系
  if (games.length > 0) {
    const bigWin = games.reduce((prev, cur) => (cur.scoreDiff > prev.scoreDiff ? cur : prev))
    const loser = bigWin.homeTeam === bigWin.winner ? bigWin.awayTeam : bigWin.homeTeam
    const leadersText = formatLeaders(bigWin.leaders, bigWin.homeTeam, bigWin.awayTeam)

    if (bigWin.scoreDiff >= 15) {
      themes.push({
        id: 'blowout',
        title: `${bigWin.winner}が${loser}を粉砕`,
        hasRealData: true,
        prompt:
          `${date}のNBA試合で、${bigWin.winner}が${loser}を` +
          `${bigWin.homeScore}-${bigWin.awayScore}（${bigWin.scoreDiff}点差）で粉砕しました。` +
          leadersText +
          `\nこの大差勝利の要因を戦術・スタッツ・チーム状況から分析してください。`,
      })
    } else {
      themes.push({
        id: 'blowout',
        title: `${bigWin.winner}の勝利分析`,
        hasRealData: true,
        prompt:
          `${date}のNBA試合で、${bigWin.winner}が${loser}に` +
          `${bigWin.homeScore}-${bigWin.awayScore}で勝利しました。` +
          leadersText +
          `\n勝利の要因と今後の展望を分析してください。`,
      })
    }
  }

  // b. 最高個人得点 → 選手分析
  if (topScorers.length > 0) {
    const mvp = topScorers[0]
    // 同試合の全リーダーを取得
    const mvpGame = games.find((g) => g.id === mvp.gameId)
    const leadersText = mvpGame
      ? formatLeaders(mvpGame.leaders, mvpGame.homeTeam, mvpGame.awayTeam)
      : ''
    themes.push({
      id: 'top-scorer',
      title: `${mvp.playerName}の${mvp.pts}得点分析`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合で、${mvp.team}の${mvp.playerName}が` +
        `${mvp.pts}得点${mvp.reb > 0 ? `・${mvp.reb}リバウンド` : ''}${mvp.ast > 0 ? `・${mvp.ast}アシスト` : ''}を記録しました。` +
        leadersText +
        `\nこのパフォーマンスをスタッツ・プレースタイル・チームへの貢献度・今シーズンの文脈を含めて徹底分析してください。`,
    })
  }

  // c. 接戦（5点差以内）→ 「逆転勝利」系
  const closeGames = games.filter((g) => g.scoreDiff <= 5)
  if (closeGames.length > 0) {
    const closest = closeGames.reduce((prev, cur) => (cur.scoreDiff < prev.scoreDiff ? cur : prev))
    const loser = closest.homeTeam === closest.winner ? closest.awayTeam : closest.homeTeam
    const leadersText = formatLeaders(closest.leaders, closest.homeTeam, closest.awayTeam)
    themes.push({
      id: 'close-game',
      title: `${closest.winner}が${closest.homeScore}-${closest.awayScore}接戦制す`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合で、${closest.winner}が${loser}を` +
        `${closest.homeScore}-${closest.awayScore}の接戦で下しました。` +
        leadersText +
        `\n接戦を勝ち切った要因、クラッチタイムの戦術、勝負を決めた局面を分析してください。`,
    })
  } else if (games.length > 1) {
    const g = games[1]
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    themes.push({
      id: 'close-game',
      title: `${g.winner}対${loser} 試合分析`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合、${g.winner}対${loser}（${g.homeScore}-${g.awayScore}）を分析してください。` +
        leadersText +
        `\n試合の流れ、両チームの戦術、勝敗を分けたポイントを論じてください。`,
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

  // ── ゲームデータなし → standings フォールバック ──────────────────
  if (themes.length < 4 && standings) {
    console.log('  ℹ️  試合データなし → standings.json からテーマを補完します')
    const standingsFills = standingsThemes(standings, date)
    for (const t of standingsFills) {
      if (themes.length >= 4) break
      if (!themes.some((existing) => existing.id === t.id)) {
        themes.push(t)
      }
    }
  }

  // ── 汎用フォールバック（standings もない場合）───────────────────
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

    const dataInstruction = theme.hasRealData
      ? `\n\n${REAL_DATA_INSTRUCTION}\n\n---\n\n`
      : '\n\n---\n\n'

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${ARTICLE_RULES}${dataInstruction}${theme.prompt}`,
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
export async function run() {
  console.log('━'.repeat(50))
  console.log('  記事自動生成')
  console.log('━'.repeat(50))

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません')
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
      dataSource: 'none',
    }
  }

  if (!fs.existsSync(DRAFT_DIR)) {
    fs.mkdirSync(DRAFT_DIR, { recursive: true })
  }

  // standings 読み込み（フォールバック用）
  const standings = loadStandings()
  if (standings) {
    console.log(`順位表読み込み: ${standings.season}（東${standings.east.length}・西${standings.west.length}チーム）`)
  }

  // player-stats.json 読み込み
  const playerStatsPath = path.join(DATA_DIR, 'player-stats.json')
  let playerStats: PlayerGameStat[] = []
  if (fs.existsSync(playerStatsPath)) {
    try {
      playerStats = JSON.parse(fs.readFileSync(playerStatsPath, 'utf-8')) as PlayerGameStat[]
      console.log(`選手スタッツ読み込み: ${playerStats.length}試合分`)
    } catch {
      console.warn('⚠️  player-stats.json の読み込み失敗')
    }
  }

  // テーマ選定
  const themes = selectThemes(nbaData, standings, playerStats)
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

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMain) {
  run().catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
