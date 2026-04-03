/**
 * NBA最新データ取得スクリプト
 *
 * データソース優先順位（試合結果・選手スタッツ）:
 *   1. ESPN公開API（認証不要、主要選手スタッツ付き）
 *   2. NBA.com CDN（フォールバック、スコアのみ）
 *   3. balldontlie API（APIキーが必要、最終フォールバック）
 *
 * データソース優先順位（順位表）:
 *   1. ESPN公開API
 *   2. NBA Stats API（フォールバック）
 *
 * 出力ファイル:
 *   data/nba-latest.json   試合結果・主要選手スタッツ
 *   data/standings.json    東西順位表
 *   data/player-stats.json 各試合の主要選手スタッツ詳細（新規）
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const ESPN_STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'
const BALLDONTLIE_BASE = 'https://api.balldontlie.io/v1'

// ─── 公開型定義 ────────────────────────────────────────────────────────

export type GameLeader = {
  playerName: string
  stat: 'pts' | 'reb' | 'ast'
  value: number
}

export type GameSummary = {
  id: string
  homeTeam: string
  homeTeamAbbr: string
  homeScore: number
  awayTeam: string
  awayTeamAbbr: string
  awayScore: number
  scoreDiff: number
  winner: string
  status: string
  leaders?: {
    home: GameLeader[]
    away: GameLeader[]
  }
}

export type TopScorer = {
  playerName: string
  team: string
  teamAbbr: string
  pts: number
  reb: number
  ast: number
  gameId: string
}

export type NBALatestData = {
  date: string
  fetchedAt: string
  gamesCount: number
  games: GameSummary[]
  topScorers: TopScorer[]
  dataSource: string
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

export type PlayerGameStat = {
  gameId: string
  homeTeam: string
  awayTeam: string
  date: string
  leaders: Array<{ team: string; playerName: string; stat: string; value: number }>
}

// ─── ESPN内部型 ────────────────────────────────────────────────────────

type ESPNLeaderEntry = {
  athlete: { displayName: string }
  value: number
}

type ESPNLeaderCategory = {
  name: string
  leaders: ESPNLeaderEntry[]
}

type ESPNCompetitor = {
  homeAway: 'home' | 'away'
  team: { displayName: string; abbreviation: string }
  score: string
  leaders?: ESPNLeaderCategory[]
}

type ESPNCompetition = {
  status: { type: { completed: boolean; description: string } }
  competitors: ESPNCompetitor[]
}

type ESPNEvent = {
  id: string
  competitions: ESPNCompetition[]
}

type ESPNScoreboard = {
  events?: ESPNEvent[]
}

type ESPNStatEntry = {
  name: string
  value: number
  displayValue: string
}

type ESPNTeamEntry = {
  team: {
    location: string
    name: string
    abbreviation: string
  }
  stats: ESPNStatEntry[]
}

type ESPNConference = {
  name: string
  standings: {
    entries: ESPNTeamEntry[]
  }
}

type ESPNStandingsData = {
  children?: ESPNConference[]
}

// ─── NBA.com CDN内部型 ─────────────────────────────────────────────────

type NBAComTeam = {
  teamCity: string
  teamName: string
  teamTricode: string
  score: number
}

type NBAComGame = {
  gameId: string
  homeTeam: NBAComTeam
  awayTeam: NBAComTeam
  gameStatus: number
  gameStatusText: string
}

type NBAComScoreboard = {
  scoreboard: { games: NBAComGame[] }
}

// ─── balldontlie内部型 ─────────────────────────────────────────────────

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
  home_team: BDLTeam
  visitor_team: BDLTeam
}

type BDLPlayer = {
  id: number
  first_name: string
  last_name: string
}

type BDLStat = {
  id: number
  pts: number
  reb: number
  ast: number
  player: BDLPlayer
  team: BDLTeam
  game: { id: number }
}

// ─── 共通ユーティリティ ────────────────────────────────────────────────

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

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T | null> {
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

// ─── ESPN APIパース ────────────────────────────────────────────────────

const ESPN_STAT_MAP: Record<string, 'pts' | 'reb' | 'ast'> = {
  pointsPerGame: 'pts',
  points: 'pts',
  reboundsPerGame: 'reb',
  rebounds: 'reb',
  assistsPerGame: 'ast',
  assists: 'ast',
}

function parseESPNLeaders(categories: ESPNLeaderCategory[] | undefined): GameLeader[] {
  if (!categories) return []
  const result: GameLeader[] = []
  for (const cat of categories) {
    const stat = ESPN_STAT_MAP[cat.name]
    if (!stat) continue
    const top = cat.leaders[0]
    if (!top?.athlete?.displayName) continue
    result.push({ playerName: top.athlete.displayName, stat, value: top.value })
  }
  return result
}

// ─── ESPN 試合データ取得 ────────────────────────────────────────────────

async function fetchESPNGames(date: string): Promise<GameSummary[]> {
  const espnDate = date.replace(/-/g, '')
  const url = `${ESPN_BASE}/scoreboard?dates=${espnDate}`
  const data = await fetchJson<ESPNScoreboard>(url)
  if (!data?.events?.length) return []

  const results: GameSummary[] = []
  for (const event of data.events) {
    const comp = event.competitions[0]
    if (!comp?.status.type.completed) continue

    const home = comp.competitors.find((c) => c.homeAway === 'home')
    const away = comp.competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) continue

    const homeScore = parseInt(home.score, 10) || 0
    const awayScore = parseInt(away.score, 10) || 0
    const homeWins = homeScore > awayScore

    results.push({
      id: event.id,
      homeTeam: home.team.displayName,
      homeTeamAbbr: home.team.abbreviation,
      homeScore,
      awayTeam: away.team.displayName,
      awayTeamAbbr: away.team.abbreviation,
      awayScore,
      scoreDiff: Math.abs(homeScore - awayScore),
      winner: homeWins ? home.team.displayName : away.team.displayName,
      status: comp.status.type.description,
      leaders: {
        home: parseESPNLeaders(home.leaders),
        away: parseESPNLeaders(away.leaders),
      },
    })
  }
  return results
}

// ─── ESPN 順位表取得 ────────────────────────────────────────────────────

async function fetchESPNStandings(): Promise<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] } | null> {
  const data = await fetchJson<ESPNStandingsData>(ESPN_STANDINGS_URL)
  if (!data?.children?.length) return null

  function parseConference(
    conf: ESPNConference,
    label: 'East' | 'West',
  ): NBAStandingTeam[] {
    return conf.standings.entries
      .map((entry, idx) => {
        const getStat = (name: string): number =>
          entry.stats.find((s) => s.name === name)?.value ?? 0
        const getStatStr = (name: string): string =>
          entry.stats.find((s) => s.name === name)?.displayValue ?? '-'
        return {
          teamId: entry.team.abbreviation,
          teamCity: entry.team.location,
          teamName: entry.team.name,
          conference: label,
          wins: getStat('wins'),
          losses: getStat('losses'),
          winPct: getStat('winPercent'),
          gamesBehind: getStatStr('gamesBehind'),
          rank: getStat('playoffSeed') || idx + 1,
        }
      })
      .sort((a, b) => a.rank - b.rank)
  }

  const east = data.children.find((c) => c.name.toLowerCase().includes('eastern'))
  const west = data.children.find((c) => c.name.toLowerCase().includes('western'))
  if (!east || !west) return null

  return {
    east: parseConference(east, 'East'),
    west: parseConference(west, 'West'),
  }
}

// ─── NBA.com CDN 試合データ取得（フォールバック1）──────────────────────

async function fetchNBAComGames(): Promise<GameSummary[]> {
  const url =
    'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
  const data = await fetchJson<NBAComScoreboard>(url, {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    Referer: 'https://www.nba.com/',
  })
  if (!data?.scoreboard?.games?.length) return []

  return data.scoreboard.games
    .filter((g) => g.gameStatus === 3)
    .map((g) => {
      const homeScore = g.homeTeam.score
      const awayScore = g.awayTeam.score
      const homeWins = homeScore > awayScore
      return {
        id: g.gameId,
        homeTeam: `${g.homeTeam.teamCity} ${g.homeTeam.teamName}`,
        homeTeamAbbr: g.homeTeam.teamTricode,
        homeScore,
        awayTeam: `${g.awayTeam.teamCity} ${g.awayTeam.teamName}`,
        awayTeamAbbr: g.awayTeam.teamTricode,
        awayScore,
        scoreDiff: Math.abs(homeScore - awayScore),
        winner: homeWins
          ? `${g.homeTeam.teamCity} ${g.homeTeam.teamName}`
          : `${g.awayTeam.teamCity} ${g.awayTeam.teamName}`,
        status: g.gameStatusText,
      }
    })
}

// ─── balldontlie 試合データ取得（フォールバック2）─────────────────────

function getBdlHeaders(): Record<string, string> {
  const key = process.env.BALLDONTLIE_API_KEY
  return key ? { Authorization: key } : {}
}

async function fetchBDLGames(date: string): Promise<GameSummary[]> {
  const headers = getBdlHeaders()
  const url = `${BALLDONTLIE_BASE}/games?dates[]=${date}&per_page=100`
  const data = await fetchJson<{ data: BDLGame[] }>(url, headers)
  if (!data?.data?.length) return []

  return data.data
    .filter((g) => g.status === 'Final' || /final/i.test(g.status))
    .map((g) => {
      const homeScore = g.home_team_score
      const awayScore = g.visitor_team_score
      const homeWins = homeScore > awayScore
      return {
        id: String(g.id),
        homeTeam: g.home_team.full_name,
        homeTeamAbbr: g.home_team.abbreviation,
        homeScore,
        awayTeam: g.visitor_team.full_name,
        awayTeamAbbr: g.visitor_team.abbreviation,
        awayScore,
        scoreDiff: Math.abs(homeScore - awayScore),
        winner: homeWins ? g.home_team.full_name : g.visitor_team.full_name,
        status: g.status,
      }
    })
}

async function fetchBDLTopScorers(date: string): Promise<TopScorer[]> {
  const headers = getBdlHeaders()
  console.log(`  [debug] stats Authorization: ${headers.Authorization ? '設定あり' : '未設定'}`)
  const url = `${BALLDONTLIE_BASE}/stats?dates[]=${date}&per_page=100`
  const data = await fetchJson<{ data: BDLStat[] }>(url, headers)
  if (!data?.data?.length) return []

  return data.data
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
      gameId: String(s.game.id),
    }))
}

// ─── NBA Stats API 順位表（フォールバック）─────────────────────────────

async function fetchNBAStatsStandings(): Promise<{ east: NBAStandingTeam[]; west: NBAStandingTeam[] } | null> {
  const season = getCurrentSeason()
  const url =
    `https://stats.nba.com/stats/leaguestandingsv3` +
    `?LeagueID=00&Season=${season}&SeasonType=Regular+Season`

  const data = await fetchJson<{
    resultSets: Array<{ name: string; headers: string[]; rowSet: unknown[][] }>
  }>(url, {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://stats.nba.com/',
    Origin: 'https://stats.nba.com',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
  })

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
    console.warn(`  ⚠️  NBA Stats API パース失敗: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

// ─── TopScorer導出（ESPNのleadersから） ────────────────────────────────

function extractTopScorers(games: GameSummary[]): TopScorer[] {
  const scorers: TopScorer[] = []

  for (const g of games) {
    if (!g.leaders) continue

    for (const [side, leaders] of [
      ['home', g.leaders.home] as const,
      ['away', g.leaders.away] as const,
    ]) {
      const team = side === 'home' ? g.homeTeam : g.awayTeam
      const teamAbbr = side === 'home' ? g.homeTeamAbbr : g.awayTeamAbbr
      const ptsLeader = leaders.find((l) => l.stat === 'pts')
      if (!ptsLeader) continue

      const rebLeader = leaders.find((l) => l.stat === 'reb')
      const astLeader = leaders.find((l) => l.stat === 'ast')

      scorers.push({
        playerName: ptsLeader.playerName,
        team,
        teamAbbr,
        pts: ptsLeader.value,
        reb:
          rebLeader?.playerName === ptsLeader.playerName ? rebLeader.value : 0,
        ast:
          astLeader?.playerName === ptsLeader.playerName ? astLeader.value : 0,
        gameId: g.id,
      })
    }
  }

  return scorers.sort((a, b) => b.pts - a.pts).slice(0, 5)
}

// ─── player-stats.json 構築 ────────────────────────────────────────────

function buildPlayerStats(games: GameSummary[], date: string): PlayerGameStat[] {
  return games
    .filter((g) => g.leaders)
    .map((g) => ({
      gameId: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      date,
      leaders: [
        ...(g.leaders?.home ?? []).map((l) => ({
          team: g.homeTeam,
          playerName: l.playerName,
          stat: l.stat,
          value: l.value,
        })),
        ...(g.leaders?.away ?? []).map((l) => ({
          team: g.awayTeam,
          playerName: l.playerName,
          stat: l.stat,
          value: l.value,
        })),
      ],
    }))
}

// ─── Main ─────────────────────────────────────────────────────────────

export async function run() {
  console.log('━'.repeat(50))
  console.log('  NBA データ取得')
  console.log('━'.repeat(50))

  ensureDataDir()
  const date = getYesterdayDate()
  console.log(`\n対象日付: ${date}`)

  // ── 試合データ取得（優先順位: ESPN → NBA.com → balldontlie）──────

  let games: GameSummary[] = []
  let topScorers: TopScorer[] = []
  let dataSource = 'none'

  // 1. ESPN
  process.stdout.write('\n試合データを取得中（ESPN）...')
  games = await fetchESPNGames(date)
  if (games.length > 0) {
    console.log(` ${games.length}試合`)
    dataSource = 'espn'
    topScorers = extractTopScorers(games)
  } else {
    console.log(' 0件')

    // 2. NBA.com CDN フォールバック
    process.stdout.write('試合データを取得中（NBA.com）...')
    games = await fetchNBAComGames()
    if (games.length > 0) {
      console.log(` ${games.length}試合`)
      dataSource = 'nba.com'
      // NBA.com はスコアのみ。TopScorerはBDLで補完を試みる
    } else {
      console.log(' 0件')

      // 3. balldontlie フォールバック
      const hasBdlKey = !!process.env.BALLDONTLIE_API_KEY
      if (!hasBdlKey) {
        console.log('⚠️  BALLDONTLIE_API_KEY 未設定 → 試合データなし')
      } else {
        process.stdout.write('試合データを取得中（balldontlie）...')
        games = await fetchBDLGames(date)
        if (games.length > 0) {
          console.log(` ${games.length}試合`)
          dataSource = 'balldontlie'
        } else {
          console.log(' 0件')
        }
      }
    }
  }

  // TopScorer: ESPN以外のソースで取得できていない場合、BDLで補完
  if (topScorers.length === 0 && !!process.env.BALLDONTLIE_API_KEY) {
    process.stdout.write('選手スタッツを取得中（balldontlie）...')
    topScorers = await fetchBDLTopScorers(date)
    console.log(` ${topScorers.length}人`)
  }

  // ── player-stats.json 保存 ─────────────────────────────────────────

  const playerStats = buildPlayerStats(games, date)
  if (playerStats.length > 0) {
    fs.writeFileSync(
      path.join(DATA_DIR, 'player-stats.json'),
      JSON.stringify(playerStats, null, 2),
      'utf-8',
    )
    console.log(
      `✅ data/player-stats.json を保存（${playerStats.length}試合 / 主要選手スタッツ）`,
    )
  }

  // ── nba-latest.json 保存 ──────────────────────────────────────────

  const nbaData: NBALatestData = {
    date,
    fetchedAt: new Date().toISOString(),
    gamesCount: games.length,
    games,
    topScorers,
    dataSource,
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'nba-latest.json'),
    JSON.stringify(nbaData, null, 2),
    'utf-8',
  )
  console.log(
    `✅ data/nba-latest.json を保存（${games.length}試合 / 得点上位${topScorers.length}人 / ソース: ${dataSource}）`,
  )

  // ── 順位表取得（優先順位: ESPN → NBA Stats API）─────────────────

  process.stdout.write('\n順位表を取得中（ESPN）...')
  let standings = await fetchESPNStandings()

  if (standings) {
    console.log('✅')
  } else {
    console.log(' 失敗')
    process.stdout.write('順位表を取得中（NBA Stats API）...')
    standings = await fetchNBAStatsStandings()
    if (standings) {
      console.log('✅')
    } else {
      console.log(' 失敗（スキップ）')
    }
  }

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
      `✅ data/standings.json を保存（東: ${standings.east.length}チーム / 西: ${standings.west.length}チーム）`,
    )
  }

  console.log('\n完了\n')
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMain) {
  run().catch((err) => {
    console.error('エラー:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
