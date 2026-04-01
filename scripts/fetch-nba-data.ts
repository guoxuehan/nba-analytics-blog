/**
 * NBA最新データ取得スクリプト
 * - balldontlie API v2 から昨夜の試合結果・スタッツを取得
 *   APIキー（BALLDONTLIE_API_KEY）がない場合はスキップ
 * - data/nba-latest.json に保存
 * - NBA Stats API からスタンディングを取得して data/standings.json に保存
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const BALLDONTLIE_BASE = 'https://api.balldontlie.io/v1'

// --- Types ---
type BDLTeam = {
  id: number
  abbreviation: string
  city: string
  full_name: string
  name: string
  conference: string
}

type BDLGame = {
  id: number
  date: string
  home_team_score: number
  visitor_team_score: number
  status: string
  period: number
  home_team: BDLTeam
  visitor_team: BDLTeam
}

type BDLPlayer = {
  id: number
  first_name: string
  last_name: string
  position: string
  team_id: number
}

type BDLStat = {
  id: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  min: string
  player: BDLPlayer
  team: BDLTeam
  game: {
    id: number
    date: string
    home_team_score: number
    visitor_team_score: number
    home_team: BDLTeam
    visitor_team: BDLTeam
  }
}

export type GameSummary = {
  id: number
  homeTeam: string
  homeTeamAbbr: string
  homeScore: number
  awayTeam: string
  awayTeamAbbr: string
  awayScore: number
  scoreDiff: number
  winner: string
  status: string
}

export type TopScorer = {
  playerName: string
  team: string
  teamAbbr: string
  pts: number
  reb: number
  ast: number
  gameId: number
}

export type NBALatestData = {
  date: string
  fetchedAt: string
  gamesCount: number
  games: GameSummary[]
  topScorers: TopScorer[]
}

export type NBAStandingTeam = {
  teamId: string
  teamCity: string
  teamName: string
  conference: string
  wins: number
  losses: number
  winPct: number
  gamesBehind: string
  rank: number
}

// --- Helpers ---
function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = month >= 10 ? year : year - 1
  return `${startYear}-${String(startYear + 1).slice(2)}`
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.warn(`  ⚠️  HTTP ${res.status}: ${url}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`  ⚠️  fetch失敗: ${url} - ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// --- balldontlie API ---
// キーがない場合は空オブジェクトを返す（undefined を fetch に渡さないようにする）
function getBdlHeaders(): Record<string, string> {
  const key = process.env.BALLDONTLIE_API_KEY
  return key ? { Authorization: key } : {}
}

async function fetchGames(date: string): Promise<BDLGame[]> {
  const headers = getBdlHeaders()
  const url = `${BALLDONTLIE_BASE}/games?dates[]=${date}&per_page=100`
  const data = await fetchJson<{ data: BDLGame[] }>(url, headers)
  return data?.data ?? []
}

async function fetchStats(date: string): Promise<BDLStat[]> {
  const headers = getBdlHeaders()
  console.log(`  [debug] stats Authorization: ${headers.Authorization ? '設定あり' : '未設定'}`)
  const url = `${BALLDONTLIE_BASE}/stats?dates[]=${date}&per_page=100`
  const data = await fetchJson<{ data: BDLStat[] }>(url, headers)
  return data?.data ?? []
}

// --- NBA Stats API（スタンディング）---
async function fetchStandings(): Promise<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] } | null> {
  const season = getCurrentSeason()
  const url =
    `https://stats.nba.com/stats/leaguestandingsv3` +
    `?LeagueID=00&Season=${season}&SeasonType=Regular+Season`

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://stats.nba.com/',
    Origin: 'https://stats.nba.com',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
  }

  const data = await fetchJson<{
    resultSets: Array<{ name: string; headers: string[]; rowSet: unknown[][] }>
  }>(url, headers)

  if (!data) return null

  try {
    const resultSet = data.resultSets.find((rs) => rs.name === 'Standings')
    if (!resultSet) return null

    const h = resultSet.headers
    const idx = (name: string) => h.indexOf(name)

    const teams: NBAStandingTeam[] = resultSet.rowSet.map((row) => ({
      teamId: String(row[idx('TeamID')]),
      teamCity: String(row[idx('TeamCity')]),
      teamName: String(row[idx('TeamName')]),
      conference: String(row[idx('Conference')]),
      wins: Number(row[idx('WINS')]),
      losses: Number(row[idx('LOSSES')]),
      winPct: Number(row[idx('WinPCT')]),
      gamesBehind: String(row[idx('ConferenceGamesBack')]),
      rank: Number(row[idx('PlayoffRank')]),
    }))

    return {
      east: teams.filter((t) => t.conference === 'East').sort((a, b) => a.rank - b.rank),
      west: teams.filter((t) => t.conference === 'West').sort((a, b) => a.rank - b.rank),
    }
  } catch (err) {
    console.warn(`  ⚠️  順位表パース失敗: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// --- Main ---
export async function run() {
  console.log('━'.repeat(50))
  console.log('  NBA データ取得')
  console.log('━'.repeat(50))

  ensureDataDir()
  const date = getYesterdayDate()
  console.log(`\n対象日付: ${date}`)

  // ── balldontlie API（APIキーがある場合のみ）──────────
  const hasBdlKey = !!process.env.BALLDONTLIE_API_KEY
  let gameSummaries: GameSummary[] = []
  let topScorers: TopScorer[] = []

  if (!hasBdlKey) {
    console.log('⚠️  BALLDONTLIE_API_KEY が未設定 → 試合データ取得をスキップ')
  } else {
    // ── 試合データ取得 ─────────────────────────
    process.stdout.write('試合データを取得中...')
    const games = await fetchGames(date)
    console.log(` ${games.length}試合`)

    const finalGames = games.filter(
      (g) => g.status === 'Final' || /final/i.test(g.status),
    )

    gameSummaries = finalGames.map((g) => ({
      id: g.id,
      homeTeam: g.home_team.full_name,
      homeTeamAbbr: g.home_team.abbreviation,
      homeScore: g.home_team_score,
      awayTeam: g.visitor_team.full_name,
      awayTeamAbbr: g.visitor_team.abbreviation,
      awayScore: g.visitor_team_score,
      scoreDiff: Math.abs(g.home_team_score - g.visitor_team_score),
      winner:
        g.home_team_score > g.visitor_team_score
          ? g.home_team.full_name
          : g.visitor_team.full_name,
      status: g.status,
    }))

    // ── スタッツ取得 ───────────────────────────
    process.stdout.write('選手スタッツを取得中...')
    const stats = await fetchStats(date)
    console.log(` ${stats.length}件`)

    topScorers = stats
      .filter((s) => (s.pts ?? 0) > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 5)
      .map((s) => ({
        playerName: `${s.player.first_name} ${s.player.last_name}`,
        team: s.team.full_name,
        teamAbbr: s.team.abbreviation,
        pts: s.pts,
        reb: s.reb,
        ast: s.ast,
        gameId: s.game.id,
      }))
  }

  // ── nba-latest.json 保存 ─────────────────
  const nbaData: NBALatestData = {
    date,
    fetchedAt: new Date().toISOString(),
    gamesCount: gameSummaries.length,
    games: gameSummaries,
    topScorers,
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'nba-latest.json'),
    JSON.stringify(nbaData, null, 2),
    'utf-8',
  )
  console.log(`\n✅ data/nba-latest.json を保存（${gameSummaries.length}試合 / 得点上位${topScorers.length}人）`)

  // ── 順位表取得 ───────────────────────────
  process.stdout.write('\n順位表を取得中...')
  const standings = await fetchStandings()

  if (standings) {
    const standingsData = {
      fetchedAt: new Date().toISOString(),
      season: getCurrentSeason(),
      east: standings.east,
      west: standings.west,
    }
    fs.writeFileSync(
      path.join(DATA_DIR, 'standings.json'),
      JSON.stringify(standingsData, null, 2),
      'utf-8',
    )
    console.log(
      ` ✅ data/standings.json を保存` +
        `（東: ${standings.east.length}チーム / 西: ${standings.west.length}チーム）`,
    )
  } else {
    console.log(' ⚠️  取得失敗（スキップ）')
  }

  console.log('\n完了\n')
}

// 直接実行された場合のみ main として動作
const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMain) {
  run().catch((err) => {
    console.error('エラー:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
