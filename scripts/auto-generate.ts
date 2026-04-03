/**
 * 記事自動生成スクリプト
 * - data/nba-latest.json を読み込み
 * - 3テーマを自動選定（試合レビュー・日本人注目・ニッチデータ）
 * - Claude APIで記事を生成
 * - articles-draft/ に保存
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { NBALatestData, NBAStandingTeam, GameLeader, PlayerGameStat, GameSummary } from './fetch-nba-data'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')
const MODEL = 'claude-sonnet-4-20250514'
const ARTICLE_COUNT = 3

type ArticleTheme = {
  id: string
  title: string
  prompt: string
  hasRealData?: boolean
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

// ─── 実データ使用指示（ゲームデータあり記事のみ付与）─────────────────
const REAL_DATA_INSTRUCTION = `
【データ利用規則・厳守】
以下のデータは本日取得した最新の実測値です。
このデータのみを使用し、推定値・予測値は絶対に使わないこと。
データに含まれない選手のシーズン平均・過去スタッツ等は記載しないこと。
数字は提供されたものをそのまま使用し、切り捨て・四捨五入・補正をしないこと。
`.trim()

// ─── 日本人読者注目チーム・選手 ──────────────────────────────────────

const JAPAN_INTEREST_TEAMS: { abbr: string; priority: number; ja: string }[] = [
  { abbr: 'LAL', priority: 3, ja: 'ロサンゼルス・レイカーズ' },
  { abbr: 'GSW', priority: 3, ja: 'ゴールデンステート・ウォリアーズ' },
  { abbr: 'SAS', priority: 3, ja: 'サンアントニオ・スパーズ' },
  { abbr: 'BOS', priority: 2, ja: 'ボストン・セルティックス' },
  { abbr: 'OKC', priority: 2, ja: 'オクラホマシティ・サンダー' },
  { abbr: 'DET', priority: 2, ja: 'デトロイト・ピストンズ' },
]

const JAPAN_INTEREST_PLAYERS: { en: string; ja: string }[] = [
  { en: 'LeBron',              ja: 'レブロン・ジェームズ' },
  { en: 'Curry',               ja: 'ステフィン・カリー' },
  { en: 'Wembanyama',          ja: 'ビクター・ウェンバンヤマ' },
  { en: 'Doncic',              ja: 'ルカ・ドンチッチ' },
  { en: 'Hachimura',           ja: '八村塁' },
  { en: 'Gilgeous-Alexander',  ja: 'シェイ・ギルジャス＝アレクサンダー' },
]

// ─── 直近記事（重複チェック用）────────────────────────────────────────

type RecentArticle = {
  slug: string
  title: string
  tags: string[]
  published_at: string | null
}

async function fetchRecentArticles(): Promise<RecentArticle[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('articles')
      .select('slug, title, tags, published_at')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
    return (data as RecentArticle[]) ?? []
  } catch {
    return []
  }
}

function wasRecentlyCovered(
  keywords: string[],
  recentArticles: RecentArticle[],
  withinDays: number,
): boolean {
  const cutoffMs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return recentArticles.some((article) => {
    const pubMs = article.published_at ? new Date(article.published_at).getTime() : 0
    if (pubMs < cutoffMs) return false
    const text = `${article.title} ${article.tags.join(' ')}`
    return keywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))
  })
}

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
      const label = l.stat === 'pts' ? '得点' : l.stat === 'reb' ? 'リバウンド' : 'アシスト'
      return `${l.playerName}（${label}${l.value}）`
    })
    return `${teamName}: ${parts.join('、')}`
  }

  const parts = [
    formatSide(leaders.home, homeTeam),
    formatSide(leaders.away, awayTeam),
  ].filter(Boolean)
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

// ─── テーマ1: 昨夜のゲームレビュー ──────────────────────────────────

function buildGameReviewTheme(games: GameSummary[], date: string): ArticleTheme | null {
  if (games.length === 0) return null

  // 優先b: 接戦（5点差以内）
  const closeGames = games.filter((g) => g.scoreDiff <= 5).sort((a, b) => a.scoreDiff - b.scoreDiff)
  if (closeGames.length > 0) {
    const g = closeGames[0]
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    return {
      id: 'game-review',
      title: `${g.winner}が${g.homeScore}-${g.awayScore}接戦制す`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合で、${g.winner}が${loser}を${g.homeScore}-${g.awayScore}（${g.scoreDiff}点差）の接戦で下しました。` +
        leadersText +
        `\n接戦を勝ち切った要因、クラッチタイムの戦術、勝負を決めたプレーを分析してください。` +
        `逆転があった場合は流れが変わったポイントを重点的に論じてください。`,
    }
  }

  // 優先c: 最高個人スタッツ（30点以上）
  let topPtsGame: GameSummary | null = null
  let topPts = 0
  let topPlayerName = ''
  for (const g of games) {
    const allLeaders = [...(g.leaders?.home ?? []), ...(g.leaders?.away ?? [])]
    for (const l of allLeaders) {
      if (l.stat === 'pts' && l.value > topPts) {
        topPts = l.value
        topPtsGame = g
        topPlayerName = l.playerName
      }
    }
  }
  if (topPtsGame && topPts >= 30) {
    const g = topPtsGame
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    return {
      id: 'game-review',
      title: `${topPlayerName}の${topPts}得点が光る${g.winner}勝利`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合で、${g.winner}が${loser}を${g.homeScore}-${g.awayScore}で下しました。` +
        leadersText +
        `\n${topPlayerName}の${topPts}得点を中心に、勝利の要因をスタッツと戦術の両面から分析してください。`,
    }
  }

  // 優先d: 最大得点差（フォールバック）
  const bigWin = games.reduce((prev, cur) => (cur.scoreDiff > prev.scoreDiff ? cur : prev))
  const loser = bigWin.homeTeam === bigWin.winner ? bigWin.awayTeam : bigWin.homeTeam
  const leadersText = formatLeaders(bigWin.leaders, bigWin.homeTeam, bigWin.awayTeam)
  return {
    id: 'game-review',
    title:
      bigWin.scoreDiff >= 15
        ? `${bigWin.winner}が${loser}を${bigWin.scoreDiff}点差で圧倒`
        : `${bigWin.winner}が${loser}に勝利`,
    hasRealData: true,
    prompt:
      `${date}のNBA試合で、${bigWin.winner}が${loser}を${bigWin.homeScore}-${bigWin.awayScore}（${bigWin.scoreDiff}点差）で下しました。` +
      leadersText +
      `\n${bigWin.scoreDiff >= 15 ? 'この大差勝利の要因を戦術・スタッツ・チーム状況から分析してください。' : '試合の流れ、両チームの戦術、勝敗を分けたポイントを論じてください。'}`,
  }
}

// ─── テーマ2: 日本人読者注目チーム・選手 ────────────────────────────

function buildJapanInterestTheme(
  data: NBALatestData,
  standings: StandingsData | null,
  recentArticles: RecentArticle[],
  date: string,
): ArticleTheme | null {
  const { games } = data

  type Candidate = {
    game: GameSummary
    team: string
    teamAbbr: string
    priority: number
    playerFocus?: string
  }
  const candidates: Candidate[] = []

  for (const game of games) {
    for (const side of ['home', 'away'] as const) {
      const abbr = side === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr
      const teamName = side === 'home' ? game.homeTeam : game.awayTeam
      const teamDef = JAPAN_INTEREST_TEAMS.find((t) => t.abbr === abbr)

      if (teamDef) {
        if (wasRecentlyCovered([teamDef.ja, abbr, teamName], recentArticles, 3)) continue
        let priority = teamDef.priority
        let playerFocus: string | undefined

        // 注目選手がリーダーにいればボーナス
        const leaders = game.leaders?.[side] ?? []
        for (const player of JAPAN_INTEREST_PLAYERS) {
          if (leaders.some((l) => l.playerName.includes(player.en))) {
            priority += 2
            playerFocus = player.ja
            break
          }
        }
        candidates.push({ game, team: teamName, teamAbbr: abbr, priority, playerFocus })
      }
    }

    // 注目チームがいなくても注目選手がいたらチェック
    if (!candidates.some((c) => c.game.id === game.id)) {
      for (const side of ['home', 'away'] as const) {
        const leaders = game.leaders?.[side] ?? []
        for (const player of JAPAN_INTEREST_PLAYERS) {
          const found = leaders.find((l) => l.playerName.includes(player.en))
          if (!found) continue
          if (wasRecentlyCovered([player.ja, player.en], recentArticles, 3)) continue
          const team = side === 'home' ? game.homeTeam : game.awayTeam
          const teamAbbr = side === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr
          candidates.push({ game, team, teamAbbr, priority: 2, playerFocus: player.ja })
          break
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority)
    const best = candidates[0]
    const loser = best.game.homeTeam === best.game.winner ? best.game.awayTeam : best.game.homeTeam
    const leadersText = formatLeaders(best.game.leaders, best.game.homeTeam, best.game.awayTeam)

    if (best.playerFocus) {
      return {
        id: `japan-interest-${best.teamAbbr.toLowerCase()}`,
        title: `${best.playerFocus}と${best.team}の試合分析`,
        hasRealData: true,
        prompt:
          `${date}のNBA試合で、${best.game.winner}が${loser}を${best.game.homeScore}-${best.game.awayScore}で下しました。` +
          leadersText +
          `\n${best.playerFocus}のパフォーマンスと${best.team}の現状を分析してください。` +
          `日本のNBAファンが最も注目するチーム・選手として、チームの戦術・今後の展望を論じてください。`,
      }
    }
    return {
      id: `japan-interest-${best.teamAbbr.toLowerCase()}`,
      title: `${best.team} ${best.game.homeScore}-${best.game.awayScore} 試合分析`,
      hasRealData: true,
      prompt:
        `${date}のNBA試合で、${best.game.winner}が${loser}を${best.game.homeScore}-${best.game.awayScore}で下しました。` +
        leadersText +
        `\n${best.team}の最新動向、キープレーヤーのパフォーマンス、チームの現状と課題を分析してください。` +
        `日本のNBAファンが注目するチームとして、プレーオフ争いの観点から今後の展望も論じてください。`,
    }
  }

  // 昨夜の試合に注目チームがない → 順位表から最新動向
  if (standings) {
    const sortedTeams = [...JAPAN_INTEREST_TEAMS].sort((a, b) => b.priority - a.priority)
    for (const teamDef of sortedTeams) {
      if (wasRecentlyCovered([teamDef.ja, teamDef.abbr], recentArticles, 3)) continue
      const allTeams = [...standings.east, ...standings.west]
      const standTeam = allTeams.find((t) => t.teamId === teamDef.abbr)
      if (!standTeam) continue
      const conf = standTeam.conference === 'East' ? '東' : '西'
      return {
        id: `japan-interest-${teamDef.abbr.toLowerCase()}`,
        title: `${teamDef.ja}最新動向と${conf}地区${standTeam.rank}位の実力`,
        prompt:
          `${date}時点、${standTeam.teamCity} ${standTeam.teamName}は${standTeam.wins}勝${standTeam.losses}敗（勝率${(standTeam.winPct * 100).toFixed(1)}%）で${conf}地区${standTeam.rank}位です。` +
          `\nこのチームの最新動向、キープレーヤーのパフォーマンス、今後の展望を分析してください。` +
          `日本のNBAファンが最も注目するチームとして、プレーオフ争いの観点からも論じてください。`,
      }
    }
  }

  return null
}

// ─── テーマ3: ニッチな話題 ───────────────────────────────────────────

function buildNicheTheme(
  data: NBALatestData,
  standings: StandingsData | null,
  date: string,
): ArticleTheme {
  const gamesSummary =
    data.games.length > 0
      ? data.games
          .map((g) => {
            const pts = [...(g.leaders?.home ?? []), ...(g.leaders?.away ?? [])]
              .filter((l) => l.stat === 'pts')
              .map((l) => `${l.playerName} ${l.value}pts`)
              .join(', ')
            return `${g.homeTeam} ${g.homeScore} vs ${g.awayTeam} ${g.awayScore}${pts ? ` (${pts})` : ''}`
          })
          .join('\n')
      : 'データなし'

  const standingsSummary = standings
    ? [
        `東1位: ${standings.east[0]?.teamCity} ${standings.east[0]?.teamName} (${standings.east[0]?.wins}W-${standings.east[0]?.losses}L)`,
        `西1位: ${standings.west[0]?.teamCity} ${standings.west[0]?.teamName} (${standings.west[0]?.wins}W-${standings.west[0]?.losses}L)`,
        `東最下位圏: ${standings.east.slice(-5).map((t) => `${t.teamCity} ${t.teamName} (${t.wins}W-${t.losses}L)`).join(', ')}`,
        `西最下位圏: ${standings.west.slice(-5).map((t) => `${t.teamCity} ${t.teamName} (${t.wins}W-${t.losses}L)`).join(', ')}`,
      ].join('\n')
    : 'データなし'

  return {
    id: 'niche-data',
    title: `${date} NBAの知られざるデータと記録`,
    hasRealData: data.games.length > 0 || standings !== null,
    prompt:
      `以下は${date}時点のNBAデータです。\n\n` +
      `【昨夜の試合結果】\n${gamesSummary}\n\n` +
      `【順位表（抜粋）】\n${standingsSummary}\n\n` +
      `このデータを使って、NBAファンが「知らなかった」と驚くようなニッチな切り口で記事を書いてください。\n` +
      `一般的なニュースサイトが書かないテーマを必ず選んでください。\n` +
      `推奨される切り口（どれか1つを深掘り）：\n` +
      `・珍しいスタッツ記録（「○○が△△以来XX年ぶりの記録達成」など）\n` +
      `・下位チームの隠れた好選手（「最下位チームのXXが実は効率リーグ上位」など）\n` +
      `・意外なデータの比較（「○○のブロック数がチーム全体より多い」など）\n` +
      `・歴史的な文脈との接続（「今季の3P成功率はNBA史上最高ペース」など）\n` +
      `・戦術のトレンド変化（「ゾーンディフェンスの使用率が前年比+30%」など）\n` +
      `提供データから客観的事実をベースに独自の分析視点を加えてください。`,
  }
}

// ─── 順位表フォールバックテーマ ──────────────────────────────────────

function standingsThemes(standings: StandingsData, date: string): ArticleTheme[] {
  const themes: ArticleTheme[] = []
  const { east, west } = standings

  const eastFirst = east[0]
  if (eastFirst) {
    themes.push({
      id: 'east-leader',
      title: `${eastFirst.teamCity} ${eastFirst.teamName}東地区首位の強さを解剖`,
      prompt:
        `${date}時点、${eastFirst.teamCity} ${eastFirst.teamName}が東地区首位（${eastFirst.wins}勝${eastFirst.losses}敗・勝率${(eastFirst.winPct * 100).toFixed(1)}%）。` +
        `この成績を支える戦術・ロスター構成・強みと弱点を徹底分析してください。`,
    })
  }

  const westFirst = west[0]
  if (westFirst) {
    themes.push({
      id: 'west-leader',
      title: `${westFirst.teamCity} ${westFirst.teamName}西地区首位の実力を分析`,
      prompt:
        `${date}時点、${westFirst.teamCity} ${westFirst.teamName}が西地区首位（${westFirst.wins}勝${westFirst.losses}敗・勝率${(westFirst.winPct * 100).toFixed(1)}%）。` +
        `チームの特徴、スター選手のパフォーマンス、優勝候補としての評価を論じてください。`,
    })
  }

  const eastBubble = east.slice(6, 10)
  if (eastBubble.length >= 2) {
    const names = eastBubble.map((t) => `${t.teamCity} ${t.teamName}`).join('・')
    themes.push({
      id: 'east-bubble',
      title: `東地区プレーイン争いの現状と行方`,
      prompt:
        `${date}時点の東地区プレーイントーナメント争い。` +
        `現在7〜10位を争う${names}の強み・弱み・残り試合の有利不利を比較し、プレーオフ進出予測を論じてください。`,
    })
  }

  return themes.slice(0, ARTICLE_COUNT)
}

// ─── テーマ選定（3本） ────────────────────────────────────────────────

async function selectThemes(
  data: NBALatestData,
  standings: StandingsData | null,
  _playerStats: PlayerGameStat[],
  recentArticles: RecentArticle[],
): Promise<ArticleTheme[]> {
  const themes: ArticleTheme[] = []
  const { date, games } = data

  // テーマ1: 昨夜のゲームレビュー
  const gameTheme = buildGameReviewTheme(games, date)
  if (gameTheme) themes.push(gameTheme)

  // テーマ2: 日本人読者注目チーム・選手
  const japanTheme = buildJapanInterestTheme(data, standings, recentArticles, date)
  if (japanTheme) themes.push(japanTheme)

  // テーマ3: ニッチな話題
  themes.push(buildNicheTheme(data, standings, date))

  // フォールバック: standings テーマで補完
  if (themes.length < ARTICLE_COUNT && standings) {
    console.log('  ℹ️  テーマ不足 → standings.json からテーマを補完します')
    const fills = standingsThemes(standings, date)
    for (const t of fills) {
      if (themes.length >= ARTICLE_COUNT) break
      if (!themes.some((e) => e.id === t.id)) themes.push(t)
    }
  }

  // 汎用フォールバック
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
    if (themes.length >= ARTICLE_COUNT) break
    themes.push(fb)
  }

  return themes.slice(0, ARTICLE_COUNT)
}

// ─── 記事生成 ────────────────────────────────────────────────────────

async function generateArticle(
  client: Anthropic,
  theme: ArticleTheme,
  index: number,
  total: number,
): Promise<string | null> {
  console.log(`\n[${index + 1}/${total}] ${theme.title}`)
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

    const slugMatch = content.match(/^slug:\s*([a-z0-9][a-z0-9-]*)/m)
    if (!slugMatch) {
      console.warn('  ⚠️  slugが見つかりません。スキップします。')
      return null
    }

    const slug = slugMatch[1].trim()
    let filepath = path.join(DRAFT_DIR, `${slug}.md`)
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
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')

  const client = new Anthropic({ apiKey })

  // nba-latest.json 読み込み
  const dataPath = path.join(DATA_DIR, 'nba-latest.json')
  let nbaData: NBALatestData

  if (fs.existsSync(dataPath)) {
    nbaData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as NBALatestData
    console.log(`\nデータ読み込み: ${nbaData.date}（${nbaData.gamesCount}試合 / ソース: ${nbaData.dataSource}）`)
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

  if (!fs.existsSync(DRAFT_DIR)) fs.mkdirSync(DRAFT_DIR, { recursive: true })

  // standings.json 読み込み
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

  // 直近記事取得（重複チェック用）
  process.stdout.write('直近記事チェック中（Supabase）...')
  const recentArticles = await fetchRecentArticles()
  console.log(` ${recentArticles.length}件`)

  // テーマ選定
  const themes = await selectThemes(nbaData, standings, playerStats, recentArticles)
  console.log(`\nテーマ選定: ${themes.length}本`)
  themes.forEach((t, i) => console.log(`  [${i + 1}] ${t.title}${t.hasRealData ? ' 📊' : ''}`))

  // 記事生成（順次実行・レート制限対策）
  let succeeded = 0
  for (let i = 0; i < themes.length; i++) {
    const result = await generateArticle(client, themes[i], i, themes.length)
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
