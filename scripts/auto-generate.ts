/**
 * 記事自動生成スクリプト
 * - data/nba-latest.json を読み込み
 * - 3テーマを自動選定（ドラマ型・論争型・ローテーション型）
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
const LOW_WIN_PCT_THRESHOLD = 0.300

type ArticleTheme = {
  id: string
  title: string
  prompt: string
  hasRealData?: boolean
}

// ─── プロンプトルール ─────────────────────────────────────────────────
const ARTICLE_RULES = `
あなたはESPNやThe Ringerのベテランコラムニストだ。
試合結果を要約するレポーターではない。

記事は以下のルールで書け：
1. リード文で読者の感情を動かせ。驚き、怒り、笑い、疑問のいずれか
2. データは「主張を支える証拠」として使え。データの羅列ではない
3. 必ず1つの「問い」を立てろ。答えのない問いでもいい
4. 選手やコーチの発言を1つ以上引用しろ（データから推測するな、取得したデータに含まれる場合のみ）
5. 読者が誰かに話したくなる「1つの事実」を入れろ
6. 最後に読者に問いかけて終われ

やってはいけないこと：
- 試合結果の時系列での説明
- 「第1Qは○○、第2Qは△△」のようなクォーター別の記述
- スタッツの一覧表示
- 「素晴らしい活躍を見せた」のような空虚な褒め言葉
- 結論で記事全体を要約すること

─────────────────────────────────────────────────────────

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

記事構成（見出し名は自由に付けること。「セクション1」のような仮名は禁止）：
1. リード文（3〜4文）──感情を動かす入り方
2. h2：このゲーム・テーマの本質的な「問い」
3. h2：主張を裏付けるデータと文脈
4. h2：逆説・反論・別の見方
5. h2：筆者の視点（コラムニストとして断言する1〜2段落）
6. h2：読者への問いかけで締める

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
    // 14日間に拡張（チーム7日・テーマ5日・タンキング月2回チェック用）
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
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

// ─── 重複チェックヘルパー ─────────────────────────────────────────────

/** title+tags にキーワードが含まれる記事が直近N日以内にあるか */
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

/** title にチーム名が含まれる記事が直近N日以内にあるか */
function wasTeamInTitle(
  teamName: string,
  recentArticles: RecentArticle[],
  withinDays: number,
): boolean {
  const cutoffMs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return recentArticles.some((article) => {
    const pubMs = article.published_at ? new Date(article.published_at).getTime() : 0
    return pubMs >= cutoffMs && article.title.toLowerCase().includes(teamName.toLowerCase())
  })
}

/** slug にパターンが含まれる記事が直近N日以内にあるか */
function wasSlugPatternCovered(
  patterns: string[],
  recentArticles: RecentArticle[],
  withinDays: number,
): boolean {
  const cutoffMs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return recentArticles.some((article) => {
    const pubMs = article.published_at ? new Date(article.published_at).getTime() : 0
    return (
      pubMs >= cutoffMs &&
      patterns.some((p) => article.slug.toLowerCase().includes(p.toLowerCase()))
    )
  })
}

/** title+tags+slug にキーワードが含まれる記事数を数える */
function countKeywordArticles(
  keywords: string[],
  recentArticles: RecentArticle[],
  withinDays: number,
): number {
  const cutoffMs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return recentArticles.filter((article) => {
    const pubMs = article.published_at ? new Date(article.published_at).getTime() : 0
    if (pubMs < cutoffMs) return false
    const text = `${article.title} ${article.tags.join(' ')} ${article.slug}`.toLowerCase()
    return keywords.some((kw) => text.includes(kw.toLowerCase()))
  }).length
}

/** 勝率が threshold 以下のチーム名一覧を返す */
function getLowWinPctTeamNames(
  standings: StandingsData | null,
  threshold: number,
): string[] {
  if (!standings) return []
  return [...standings.east, ...standings.west]
    .filter((t) => t.winPct <= threshold)
    .map((t) => `${t.teamCity} ${t.teamName}`)
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

// ─── テーマ1: ドラマ型（昨夜の試合から「物語」を探す）────────────────

function buildDramaTheme(
  games: GameSummary[],
  date: string,
  recentArticles: RecentArticle[],
): ArticleTheme | null {
  if (games.length === 0) return null

  // チームタイトル重複チェック
  function isTeamBlocked(homeTeam: string, awayTeam: string): boolean {
    if (wasTeamInTitle(homeTeam, recentArticles, 7)) {
      console.log(`  除外候補（ドラマ）: ${homeTeam} → 直近7日以内にタイトルに同チーム記事あり`)
      return true
    }
    if (wasTeamInTitle(awayTeam, recentArticles, 7)) {
      console.log(`  除外候補（ドラマ）: ${awayTeam} → 直近7日以内にタイトルに同チーム記事あり`)
      return true
    }
    return false
  }

  // 全試合の最高得点を収集
  type ScoringHero = { player: string; pts: number; game: GameSummary }
  const heroes: ScoringHero[] = []
  for (const g of games) {
    for (const side of ['home', 'away'] as const) {
      const leaders = g.leaders?.[side] ?? []
      const ptsLeader = leaders.find((l) => l.stat === 'pts')
      if (ptsLeader) heroes.push({ player: ptsLeader.playerName, pts: ptsLeader.value, game: g })
    }
  }
  heroes.sort((a, b) => b.pts - a.pts)

  // 優先a: 個人のマイルストーン候補（38点以上 = キャリアハイ水準）
  for (const milestoneHero of heroes.filter((h) => h.pts >= 38)) {
    const g = milestoneHero.game
    if (isTeamBlocked(g.homeTeam, g.awayTeam)) continue
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    return {
      id: 'drama',
      title: `${milestoneHero.player} ${milestoneHero.pts}点の夜`,
      hasRealData: true,
      prompt:
        `${date}のNBA、${g.winner} vs ${loser}（${g.homeScore}-${g.awayScore}）。` +
        `${milestoneHero.player}が${milestoneHero.pts}得点を記録しました。` +
        leadersText +
        `\n\nこの数字の「意味」を書け。` +
        `単なるキャリアハイの報告ではなく、この選手がこの夜にたどり着くまでの文脈、` +
        `この得点がNBAの歴史の中でどこに位置づけられるのか、` +
        `そしてこれが「始まり」なのか「頂点」なのかを論じてください。`,
    }
  }

  // 優先b: 大逆転の可能性（アウェイチームが10点差以上で勝利）
  const bigAwayWins = games
    .filter((g) => g.winner === g.awayTeam && g.scoreDiff >= 10)
    .sort((a, b) => b.scoreDiff - a.scoreDiff)
  for (const bigAwayWin of bigAwayWins) {
    if (isTeamBlocked(bigAwayWin.homeTeam, bigAwayWin.awayTeam)) continue
    const leadersText = formatLeaders(bigAwayWin.leaders, bigAwayWin.homeTeam, bigAwayWin.awayTeam)
    return {
      id: 'drama',
      title: `${bigAwayWin.winner}がアウェイで${bigAwayWin.scoreDiff}点差の勝利`,
      hasRealData: true,
      prompt:
        `${date}のNBA、アウェイの${bigAwayWin.winner}がホームの${bigAwayWin.homeTeam}を` +
        `${bigAwayWin.awayScore}-${bigAwayWin.homeScore}（${bigAwayWin.scoreDiff}点差）で下しました。` +
        leadersText +
        `\n\nこの試合の「ドラマ」を書け。` +
        `ホームアドバンテージが機能しなかった理由、アウェイチームが何を持っていたのか、` +
        `この勝利が両チームにとってシーズンの文脈でどんな意味を持つのかを論じてください。`,
    }
  }

  // 優先c: 異常スタッツ（35点以上）
  for (const topHero of heroes.filter((h) => h.pts >= 35)) {
    const g = topHero.game
    if (isTeamBlocked(g.homeTeam, g.awayTeam)) continue
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    return {
      id: 'drama',
      title: `${topHero.player}の${topHero.pts}点`,
      hasRealData: true,
      prompt:
        `${date}のNBA、${g.winner} vs ${loser}（${g.homeScore}-${g.awayScore}）。` +
        `${topHero.player}が${topHero.pts}得点を記録しました。` +
        leadersText +
        `\n\nこの夜の「異常さ」を書け。` +
        `この数字が何を意味し、このパフォーマンスがどれほど稀なものかを、` +
        `読者が思わず誰かに話したくなるような1つの切り口で論じてください。`,
    }
  }

  // 優先d: 接戦のドラマ（重複チェック付き）
  const closeGames = games.filter((g) => g.scoreDiff <= 5).sort((a, b) => a.scoreDiff - b.scoreDiff)
  for (const g of closeGames) {
    if (isTeamBlocked(g.homeTeam, g.awayTeam)) continue
    const loser = g.homeTeam === g.winner ? g.awayTeam : g.homeTeam
    const leadersText = formatLeaders(g.leaders, g.homeTeam, g.awayTeam)
    return {
      id: 'drama',
      title: `${g.winner}が${g.homeScore}-${g.awayScore}の死闘を制す`,
      hasRealData: true,
      prompt:
        `${date}のNBA、${g.winner}が${loser}を${g.homeScore}-${g.awayScore}（${g.scoreDiff}点差）で下しました。` +
        leadersText +
        `\n\nこの試合の「緊張の中身」を書け。` +
        `点差ではなく、勝者と敗者を分けた1つの決断・1つのプレー・1人の判断を特定し、` +
        `それがなぜ起きたのかを論じてください。`,
    }
  }

  // フォールバック: 重複チェックを無視して最も印象的な試合（候補が尽きた場合）
  const bigWin = games.reduce((prev, cur) => (cur.scoreDiff > prev.scoreDiff ? cur : prev))
  const loser = bigWin.homeTeam === bigWin.winner ? bigWin.awayTeam : bigWin.homeTeam
  const leadersText = formatLeaders(bigWin.leaders, bigWin.homeTeam, bigWin.awayTeam)
  console.log(`  ⚠️  ドラマテーマ: 全候補が重複チェックに引っかかりフォールバックを使用`)
  return {
    id: 'drama',
    title: `${bigWin.winner}が${loser}を圧倒した夜`,
    hasRealData: true,
    prompt:
      `${date}のNBA、${bigWin.winner}が${loser}を${bigWin.homeScore}-${bigWin.awayScore}（${bigWin.scoreDiff}点差）で下しました。` +
      leadersText +
      `\n\nこの勝利の「本質」を書け。` +
      `スコアの背後に何があったのか、この試合が両チームのシーズンにどんな意味を持つのかを、` +
      `コラムニストの視点から論じてください。`,
  }
}

// ─── テーマ2: 論争型（日本人注目チーム・選手への「問い」）────────────

function buildDebateTheme(
  data: NBALatestData,
  standings: StandingsData | null,
  recentArticles: RecentArticle[],
  date: string,
): ArticleTheme | null {
  const { games } = data

  type Candidate = {
    game: GameSummary | null
    team: string
    teamAbbr: string
    priority: number
    playerFocus?: string
    debateAngle: string
  }
  const candidates: Candidate[] = []

  for (const game of games) {
    for (const side of ['home', 'away'] as const) {
      const abbr = side === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr
      const teamName = side === 'home' ? game.homeTeam : game.awayTeam
      const teamDef = JAPAN_INTEREST_TEAMS.find((t) => t.abbr === abbr)

      if (teamDef) {
        // チーム名がタイトルに含まれる記事を7日間除外
        if (wasTeamInTitle(teamDef.ja, recentArticles, 7)) {
          console.log(`  除外（論争・チーム）: ${teamDef.ja} → 直近7日以内にタイトルに同チーム記事あり`)
          continue
        }
        if (wasTeamInTitle(teamName, recentArticles, 7)) {
          console.log(`  除外（論争・チーム）: ${teamName} → 直近7日以内にタイトルに同チーム記事あり`)
          continue
        }

        let priority = teamDef.priority
        let playerFocus: string | undefined

        const leaders = game.leaders?.[side] ?? []
        for (const player of JAPAN_INTEREST_PLAYERS) {
          if (leaders.some((l) => l.playerName.includes(player.en))) {
            priority += 2
            playerFocus = player.ja
            break
          }
        }

        // 論争の切り口を自動生成
        const won = game.winner === teamName
        const debateAngle = playerFocus
          ? `${playerFocus}は今季MVP候補に入るべきか？昨夜の${game.homeScore}-${game.awayScore}というスコアを起点に論じてください。`
          : won
          ? `${teamName}は本当に優勝候補か？昨夜の勝利で強さを見せたが、プレーオフで崩れる可能性を含めて論じてください。`
          : `${teamName}はこのまま沈むのか？昨夜の${game.homeScore}-${game.awayScore}の敗北が示すチームの本質的な問題を論じてください。`

        candidates.push({ game, team: teamName, teamAbbr: abbr, priority, playerFocus, debateAngle })
      }
    }

    // 注目チームがなくても注目選手がいれば拾う
    if (!candidates.some((c) => c.game?.id === game.id)) {
      for (const side of ['home', 'away'] as const) {
        const leaders = game.leaders?.[side] ?? []
        for (const player of JAPAN_INTEREST_PLAYERS) {
          const found = leaders.find((l) => l.playerName.includes(player.en))
          if (!found) continue
          if (wasRecentlyCovered([player.ja, player.en], recentArticles, 7)) {
            console.log(`  除外（論争・選手）: ${player.ja} → 直近7日以内に同選手記事あり`)
            continue
          }
          const team = side === 'home' ? game.homeTeam : game.awayTeam
          const teamAbbr = side === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr
          candidates.push({
            game,
            team,
            teamAbbr,
            priority: 2,
            playerFocus: player.ja,
            debateAngle: `${player.ja}は今何者か？昨夜の${game.homeScore}-${game.awayScore}を踏まえ、この選手の現在地と可能性を論争的な視点で論じてください。`,
          })
          break
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority)
    const best = candidates[0]
    const loser = best.game
      ? (best.game.homeTeam === best.game.winner ? best.game.awayTeam : best.game.homeTeam)
      : ''
    const leadersText = best.game
      ? formatLeaders(best.game.leaders, best.game.homeTeam, best.game.awayTeam)
      : ''

    const matchContext = best.game
      ? `${date}のNBA、${best.game.winner}が${loser}を${best.game.homeScore}-${best.game.awayScore}で下しました。${leadersText}\n\n`
      : `${date}時点のNBAシーズン。\n\n`

    return {
      id: `debate-${best.teamAbbr.toLowerCase()}`,
      title: best.playerFocus
        ? `${best.playerFocus}論争──今、問われていること`
        : `${best.team}への問い──このチームは本物か`,
      hasRealData: !!best.game,
      prompt:
        matchContext +
        `${best.debateAngle}\n\n` +
        `記事は「議論」として書け。一方的な賞賛でも批判でもない。` +
        `賛成派と反対派の両方の論拠を示し、最後にコラムニストとして自分の立場を明確にしてください。` +
        `日本のNBAファンが「わかる、この問いは重要だ」と感じる切り口で。`,
    }
  }

  // 昨夜の試合に注目チームがない → 順位表から論争ネタを生成
  if (standings) {
    const sortedTeams = [...JAPAN_INTEREST_TEAMS].sort((a, b) => b.priority - a.priority)
    for (const teamDef of sortedTeams) {
      if (wasTeamInTitle(teamDef.ja, recentArticles, 7)) {
        console.log(`  除外（論争・順位表）: ${teamDef.ja} → 直近7日以内にタイトルに同チーム記事あり`)
        continue
      }
      const allTeams = [...standings.east, ...standings.west]
      const standTeam = allTeams.find((t) => t.teamId === teamDef.abbr)
      if (!standTeam) continue
      const conf = standTeam.conference === 'East' ? '東' : '西'
      const winPctStr = (standTeam.winPct * 100).toFixed(1)
      return {
        id: `debate-${teamDef.abbr.toLowerCase()}`,
        title: `${teamDef.ja}は優勝できるか──勝率${winPctStr}%が語ること`,
        prompt:
          `${date}時点、${standTeam.teamCity} ${standTeam.teamName}は${standTeam.wins}勝${standTeam.losses}敗（勝率${winPctStr}%）で${conf}地区${standTeam.rank}位です。\n\n` +
          `「このチームは本当に優勝候補か」という問いに答えてください。\n` +
          `楽観論と悲観論の両方を展開し、最後にコラムニストとして断言してください。` +
          `日本のNBAファンが最も注目するチームとして、ロスター構成・戦術・メンタリティの3軸で論じてください。`,
      }
    }
  }

  return null
}

// ─── テーマ3: ローテーション型（曜日別テーマ）──────────────────────────

type RotationEntry = {
  dow: number
  label: string
  type: string
  keywords: string[]       // 重複チェック用キーワード（title+tags）
  slugPatterns: string[]   // スラッグパターン重複チェック
  dedupDays: number
  build: (data: NBALatestData, standings: StandingsData | null, date: string) => ArticleTheme
}

const ROTATION_SCHEDULE: RotationEntry[] = [
  {
    dow: 0, // 日曜
    label: '日曜：週間ベスト',
    type: 'weekly-best',
    keywords: ['週間ベスト', '週間MVP', 'ベストプレー', 'weekly best'],
    slugPatterns: ['weekly-best', 'week-in-review'],
    dedupDays: 7,
    build: (data, _standings, date) => {
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
      return {
        id: 'weekly-best',
        title: `今週のNBAベストパフォーマンス──誰が最も輝いたか`,
        hasRealData: data.games.length > 0,
        prompt:
          `${date}週のNBA。直近の試合結果：\n${gamesSummary}\n\n` +
          `今週最も印象に残ったパフォーマンスTOP3を選べ。` +
          `選出理由を「数字の大きさ」ではなく「文脈と意味」で説明せよ。` +
          `この週のMVP候補は誰か、コラムニストとして断言し、その根拠を述べよ。` +
          `読者が「そうか、あの試合はそういう意味があったのか」と気づく視点で書け。`,
      }
    },
  },
  {
    dow: 1, // 月曜
    label: '月曜：戦術分析',
    type: 'tactics',
    keywords: ['戦術', 'tactics', 'ディフェンス戦略', 'オフェンス戦略', 'プレーセット'],
    slugPatterns: ['tactics', 'defense-scheme', 'offensive-system'],
    dedupDays: 5,
    build: (data, _standings, date) => {
      const gamesSummary =
        data.games.length > 0
          ? data.games.map((g) => `${g.homeTeam} ${g.homeScore} vs ${g.awayTeam} ${g.awayScore}`).join(', ')
          : 'データなし'
      return {
        id: 'tactics',
        title: `NBAの戦術進化──直近の試合が示す新潮流`,
        hasRealData: data.games.length > 0,
        prompt:
          `${date}のNBA試合: ${gamesSummary}\n\n` +
          `直近の試合データから、最も興味深い戦術的パターンを1つ特定し詳しく分析せよ。` +
          `特定のプレーセット、ディフェンスシステム、またはマッチアップ戦略に焦点を当てよ。` +
          `「なぜこの戦術が機能したのか／しなかったのか」を、` +
          `コーチングの決断・選手の適性・相手チームの対応という3つの軸で論じろ。` +
          `結論として「NBAの戦術がどこへ向かっているか」を断言せよ。`,
      }
    },
  },
  {
    dow: 2, // 火曜
    label: '火曜：歴代比較',
    type: 'legend-compare',
    keywords: ['歴代', 'レジェンド', '比較', 'legend', 'greatest'],
    slugPatterns: ['vs-legend', 'greatest', 'all-time', 'comparison'],
    dedupDays: 5,
    build: (_data, _standings, date) => ({
      id: 'legend-compare',
      title: `現役スターとレジェンドの比較──時代を超えた問い`,
      hasRealData: false,
      prompt:
        `${date}のNBAシーズンを踏まえ、現役スターとNBAレジェンドを1対1で比較せよ。` +
        `単なるスタッツ比較ではなく、プレーの質・時代背景・チームへの影響・` +
        `勝利へのコントリビューションを含めた本質的な議論を展開せよ。` +
        `比較するペアは日本のNBAファンが最も関心を持つ組み合わせを選べ（例：レブロン vs マジック、カリー vs レジー・ミラー等）。` +
        `最終的に「現役選手はレジェンドを超えたのか」という問いに答えよ。`,
    }),
  },
  {
    dow: 3, // 水曜
    label: '水曜：制度・ルール',
    type: 'rules',
    keywords: ['CBA', '65試合', 'ルール問題', '制度', '契約問題', 'ドラフト制度'],
    slugPatterns: ['cba', 'rule-change', 'draft-system', 'max-contract', '65-game'],
    dedupDays: 5,
    build: (data, standings, date) => {
      const standingsSummary = standings
        ? `東1位: ${standings.east[0]?.teamCity} ${standings.east[0]?.teamName} (${standings.east[0]?.wins}W-${standings.east[0]?.losses}L), ` +
          `西1位: ${standings.west[0]?.teamCity} ${standings.west[0]?.teamName} (${standings.west[0]?.wins}W-${standings.west[0]?.losses}L)`
        : 'データなし'
      return {
        id: 'nba-rules',
        title: `NBAの制度的矛盾──誰も語らない本質的な問題`,
        hasRealData: standings !== null,
        prompt:
          `${date}時点のNBA。順位: ${standingsSummary}\n\n` +
          `NBAの制度・ルール・CBAに関する問題を1つ選び、その矛盾や弊害を批評的に論じよ。\n\n` +
          `【選択可能なトピック】\n` +
          `・65試合出場ルールの矛盾──プレイタイム制限は誰を守り、誰を傷つけるか\n` +
          `・NBAドラフト制度の公平性──同じ負け方でも評価が変わる理由\n` +
          `・最大契約の弊害──スーパースターに払いすぎるとチームはどうなるか\n` +
          `・ロードマネジメント問題──「休養」はファンへの裏切りか、選手保護か\n` +
          `・NBAの審判制度──判定基準の一貫性欠如は構造的問題か\n` +
          `・トレードデッドライン制度の限界──なぜ大型トレードは成立しにくくなったか\n\n` +
          `※ タンキング戦略を主題にしないこと。\n\n` +
          `選んだトピックを現在のシーズン状況と接続させ、` +
          `「制度を変えるべきか、変えるならどう変えるか」をコラムニストとして断言せよ。`,
      }
    },
  },
  {
    dow: 4, // 木曜
    label: '木曜：若手・ルーキー',
    type: 'rookie',
    keywords: ['ルーキー', '若手', 'ドラフト候補', '新人', '次世代'],
    slugPatterns: ['rookie', 'young-star', 'next-gen', 'draft-prospect'],
    dedupDays: 5,
    build: (data, _standings, date) => {
      const gamesSummary =
        data.games.length > 0
          ? data.games.map((g) => `${g.homeTeam} vs ${g.awayTeam}`).join(', ')
          : ''
      return {
        id: 'young-star',
        title: `NBAの次世代──今シーズン最も成長した若手は誰か`,
        hasRealData: data.games.length > 0,
        prompt:
          `${date}のNBAシーズン${gamesSummary ? `（直近試合: ${gamesSummary}）` : ''}。\n\n` +
          `今シーズン最も成長した若手選手（25歳以下）を1人特定し、その成長の本質を論じよ。` +
          `数字の伸びではなく、プレースタイルの変化・精神的成熟・チームへの影響を描写せよ。` +
          `「この選手はNBAのどんな問題を解決できるか」という視点で、` +
          `その選手の将来像をコラムニストとして描け。` +
          `日本のNBAファンが「この選手を追いかけたい」と思わせる切り口で書け。`,
      }
    },
  },
  {
    dow: 5, // 金曜
    label: '金曜：予想・シミュレーション',
    type: 'prediction',
    keywords: ['プレーオフ予想', 'トレード予想', 'シミュレーション', '優勝予想'],
    slugPatterns: ['playoff-prediction', 'trade-speculation', 'championship-odds'],
    dedupDays: 5,
    build: (_data, standings, date) => {
      const standingsSummary = standings
        ? [
            `東: ${standings.east.slice(0, 4).map((t) => `${t.teamCity} ${t.teamName} (${t.wins}W)`).join(', ')}`,
            `西: ${standings.west.slice(0, 4).map((t) => `${t.teamCity} ${t.teamName} (${t.wins}W)`).join(', ')}`,
          ].join('\n')
        : 'データなし'
      return {
        id: 'playoff-prediction',
        title: `プレーオフを制するのは誰か──3チームに絞る予想`,
        hasRealData: standings !== null,
        prompt:
          `${date}時点のNBAプレーオフ展望。\n現在の順位（抜粋）:\n${standingsSummary}\n\n` +
          `チャンピオンシップコンテンダーを3チームに絞り、それぞれの「勝つシナリオ」と` +
          `「崩れるシナリオ」を具体的に論じよ。` +
          `プレーオフの洗礼・負傷リスク・マッチアップの相性・ホームコートアドバンテージを考慮せよ。` +
          `最後に1チームに絞り「このチームが優勝する」と断言し、その根拠を述べよ。` +
          `読者が「この予想は面白い、外れたとしても論拠がある」と感じる記事にせよ。`,
      }
    },
  },
  {
    dow: 6, // 土曜
    label: '土曜：カルチャー',
    type: 'culture',
    keywords: ['SNS', 'ファン文化', 'NBAビジネス', 'メンタルヘルス', 'スーパーチーム'],
    slugPatterns: ['culture', 'social-media', 'nba-business', 'mental-health', 'superteam'],
    dedupDays: 5,
    build: (_data, _standings, date) => ({
      id: 'culture',
      title: `NBAを「競技」から「文化」へ──現代バスケットボールの本質`,
      hasRealData: false,
      prompt:
        `${date}のNBAシーズンを踏まえ、以下のテーマから1つ選び、` +
        `NBAが単なるスポーツを超えた文化現象であることを論じよ。\n\n` +
        `【選択可能なトピック】\n` +
        `・NBAとメンタルヘルス──休養を選んだ選手への批判は正当か\n` +
        `・スーパーチーム時代の終焉──なぜ1強支配は続かなくなったのか\n` +
        `・NBAとSNS──選手の「ブランド化」はゲームをどう変えたか\n` +
        `・NBAのグローバル化──なぜ世界中の選手がNBAを目指すのか\n` +
        `・ファン文化の変容──SNS時代のNBAファンは選手に何を求めるのか\n` +
        `・NBAのビジネスモデル──30チームのフランチャイズ価値が上がり続ける理由\n\n` +
        `一般的なニュースサイトには書けない、構造的・批評的な視点で。` +
        `最後に「NBAは10年後どうなっているか」という問いを読者に投げかけて締めよ。`,
    }),
  },
]

function buildRotationTheme(
  data: NBALatestData,
  standings: StandingsData | null,
  recentArticles: RecentArticle[],
  date: string,
): { theme: ArticleTheme; logs: string[] } {
  const logs: string[] = []
  const dayOfWeek = new Date().getDay() // 0=Sun...6=Sat

  // タンキング月2回制限チェック
  const tankingKeywords = ['タンキング', 'tank', 'tanking']
  const tankCount30 = countKeywordArticles(tankingKeywords, recentArticles, 30)
  if (tankCount30 >= 2) {
    logs.push(`⚠️  タンキング記事を制限中（直近30日: ${tankCount30}件 / 月2件まで）`)
  }

  // 低勝率チーム週1回制限チェック
  const lowWinPctTeams = getLowWinPctTeamNames(standings, LOW_WIN_PCT_THRESHOLD)
  const lowTeamCount7 = lowWinPctTeams.length > 0
    ? countKeywordArticles(lowWinPctTeams, recentArticles, 7)
    : 0
  if (lowTeamCount7 >= 1) {
    logs.push(`⚠️  下位チーム（勝率${(LOW_WIN_PCT_THRESHOLD * 100).toFixed(0)}%以下）記事を制限中（直近7日: ${lowTeamCount7}件）`)
  }

  // 本日の曜日から順にローテーションを試みる
  const order = Array.from({ length: 7 }, (_, i) => (dayOfWeek + i) % 7)

  for (const dow of order) {
    const entry = ROTATION_SCHEDULE.find((e) => e.dow === dow)
    if (!entry) continue

    // テーマキーワードの重複チェック（N日以内）
    if (wasRecentlyCovered(entry.keywords, recentArticles, entry.dedupDays)) {
      logs.push(`除外（${entry.label}）: 直近${entry.dedupDays}日以内に同テーマキーワード記事あり`)
      continue
    }

    // スラッグパターンの重複チェック（7日以内）
    if (wasSlugPatternCovered(entry.slugPatterns, recentArticles, 7)) {
      logs.push(`除外（${entry.label}）: 直近7日以内に同スラッグパターン記事あり`)
      continue
    }

    logs.push(`選択: ${entry.label}（${date}）`)
    return { theme: entry.build(data, standings, date), logs }
  }

  // 全曜日が重複 → 本日の曜日を強制使用
  const fallbackEntry = ROTATION_SCHEDULE.find((e) => e.dow === dayOfWeek)!
  logs.push(`⚠️  全ローテーションテーマが重複 → ${fallbackEntry.label}を強制選択`)
  return { theme: fallbackEntry.build(data, standings, date), logs }
}

// ─── 順位表フォールバックテーマ ──────────────────────────────────────

function standingsThemes(standings: StandingsData, date: string): ArticleTheme[] {
  const themes: ArticleTheme[] = []
  const { east, west } = standings

  const eastFirst = east[0]
  if (eastFirst) {
    themes.push({
      id: 'east-leader',
      title: `${eastFirst.teamCity} ${eastFirst.teamName}が東地区首位でいられる理由`,
      prompt:
        `${date}時点、${eastFirst.teamCity} ${eastFirst.teamName}が東地区首位（${eastFirst.wins}勝${eastFirst.losses}敗・勝率${(eastFirst.winPct * 100).toFixed(1)}%）に立っています。\n\n` +
        `「このチームはなぜ勝てるのか」という問いに、批評的な視点で答えてください。` +
        `強さの本質と、それが崩れるシナリオを両方示してください。`,
    })
  }

  const westFirst = west[0]
  if (westFirst) {
    themes.push({
      id: 'west-leader',
      title: `${westFirst.teamCity} ${westFirst.teamName}西地区首位の死角`,
      prompt:
        `${date}時点、${westFirst.teamCity} ${westFirst.teamName}が西地区首位（${westFirst.wins}勝${westFirst.losses}敗・勝率${(westFirst.winPct * 100).toFixed(1)}%）に立っています。\n\n` +
        `「このチームは優勝できるか」という問いに、楽観論と悲観論の両方を展開してください。` +
        `コラムニストとして最後に断言すること。`,
    })
  }

  const eastBubble = east.slice(6, 10)
  if (eastBubble.length >= 2) {
    const names = eastBubble.map((t) => `${t.teamCity} ${t.teamName}`).join('・')
    themes.push({
      id: 'east-bubble',
      title: `プレーイン4チームの生存戦略──誰が笑い、誰が泣くのか`,
      prompt:
        `${date}時点、東地区のプレーイン争いは${names}の間で激化しています。\n\n` +
        `この4チームの「それぞれの物語」を書いてください。` +
        `単なる順位比較ではなく、各チームが抱えるドラマと、最後に生き残るチームを予測してください。`,
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

  // タンキング・低勝率チームの事前サマリーログ
  const tankCount = countKeywordArticles(['タンキング', 'tank', 'tanking'], recentArticles, 30)
  const lowTeams = getLowWinPctTeamNames(standings, LOW_WIN_PCT_THRESHOLD)
  const lowTeamCount = lowTeams.length > 0
    ? countKeywordArticles(lowTeams, recentArticles, 7)
    : 0
  if (tankCount > 0) {
    console.log(`  📊 タンキング記事: 直近30日 ${tankCount}件（上限: 月2件）`)
  }
  if (lowTeamCount > 0) {
    console.log(`  📊 下位チーム記事: 直近7日 ${lowTeamCount}件（上限: 週1件）`)
  }

  // テーマ1: ドラマ型
  console.log('\n[テーマ1: ドラマ型 選定中]')
  const dramaTheme = buildDramaTheme(games, date, recentArticles)
  if (dramaTheme) {
    themes.push(dramaTheme)
    console.log(`  選択: 🎭 ${dramaTheme.title}`)
  }

  // テーマ2: 論争型
  console.log('\n[テーマ2: 論争型 選定中]')
  const debateTheme = buildDebateTheme(data, standings, recentArticles, date)
  if (debateTheme) {
    themes.push(debateTheme)
    console.log(`  選択: 💬 ${debateTheme.title}`)
  }

  // テーマ3: ローテーション型（曜日別）
  console.log('\n[テーマ3: ローテーション型 選定中]')
  const { theme: rotationTheme, logs: rotationLogs } = buildRotationTheme(
    data,
    standings,
    recentArticles,
    date,
  )
  rotationLogs.forEach((log) => console.log(`  ${log}`))
  themes.push(rotationTheme)
  console.log(`  選択: 🏛️ ${rotationTheme.title}`)

  // フォールバック: standings テーマで補完
  if (themes.length < ARTICLE_COUNT && standings) {
    console.log('\n  ℹ️  テーマ不足 → standings.json からテーマを補完します')
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
      title: '2025-26 MVP候補5人に問う──あなたは誰を選ぶか',
      prompt:
        '2025-26シーズンのNBA MVPレース上位候補を挙げ、それぞれの「MVP論拠」と「反論」を示してください。' +
        '最後に1人に絞り、その理由をコラムニストとして断言すること。',
    },
    {
      id: 'three-point-revolution',
      title: '3ポイント革命は終わるのか──シュート距離の果て',
      prompt:
        'NBAの3ポイント革命が始まってから10年以上が経った。' +
        'この戦術はどこまで進化し、どこに限界があるのかを、歴史的文脈とデータで論じてください。' +
        '「やりすぎ」のラインはどこか、コラムニストとして答えを出すこと。',
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

  // 直近記事取得（重複チェック用、14日間）
  process.stdout.write('直近記事チェック中（Supabase, 14日間）...')
  const recentArticles = await fetchRecentArticles()
  console.log(` ${recentArticles.length}件`)

  // テーマ選定
  const themes = await selectThemes(nbaData, standings, playerStats, recentArticles)
  console.log(`\nテーマ選定: ${themes.length}本`)
  themes.forEach((t, i) => {
    const typeLabel = i === 0 ? '🎭 ドラマ' : i === 1 ? '💬 論争' : '🏛️ ローテーション'
    console.log(`  [${i + 1}] ${typeLabel}: ${t.title}${t.hasRealData ? ' 📊' : ''}`)
  })

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
