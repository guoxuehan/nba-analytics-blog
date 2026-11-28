/**
 * 🕐 時計図のデータ: 今季のレギュラーシーズン全試合の全得点を、入った時刻（試合経過）ごとに数える
 *
 * - 出典: cdn.nba.com の試合経過データ（play-by-play）
 * - 15秒刻み（48分 = 192 区間）で、3P・2P・フリースローの得点を合計する
 * - 延長戦は除く（4クォーター48分の時計に載らないため）
 * - 前回の結果に、まだ数えていない試合だけを足す（毎日の実行で増分更新）
 *
 * 使い方: npx tsx scripts/viz/fetch-scoring-clock.ts
 * 出力:   data/viz/scoring-clock.json
 */
import * as fs from 'fs'
import * as path from 'path'

const OUT = path.join(process.cwd(), 'data', 'viz', 'scoring-clock.json')
const BIN_SEC = 15
const BINS = (48 * 60) / BIN_SEC
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.nba.com/',
}

export type ScoringClock = {
  season: string
  through: string // 最後に数えた試合の日付（YYYY-MM-DD, 米国東部）
  binSeconds: number
  games: string[] // 数えた試合の gameId
  points: { pt3: number[]; pt2: number[]; ft: number[] } // 各区間の得点合計
  otExcluded: number // 除いた延長戦の得点
}

type Schedule = {
  leagueSchedule: {
    seasonYear: string
    gameDates: { gameDate: string; games: { gameId: string; gameStatus: number; gameDateEst?: string }[] }[]
  }
}

type Action = {
  period: number
  clock: string // "PT11M42.00S"
  actionType: string
  scoreHome: string
  scoreAway: string
}

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return (await res.json()) as T
    if (attempt >= 3 || res.status === 404) throw new Error(`${res.status} ${url}`)
    await new Promise((r) => setTimeout(r, 1000 * attempt))
  }
}

/** "PT11M42.00S" → 残り秒数 */
function clockSeconds(clock: string): number | null {
  const m = clock.match(/PT(\d+)M([\d.]+)S/)
  return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : null
}

function emptyClock(season: string): ScoringClock {
  const zeros = () => Array<number>(BINS).fill(0)
  return { season, through: '', binSeconds: BIN_SEC, games: [], points: { pt3: zeros(), pt2: zeros(), ft: zeros() }, otExcluded: 0 }
}

async function main() {
  const schedule = await getJson<Schedule>('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json')
  const season = schedule.leagueSchedule.seasonYear
  const finished = schedule.leagueSchedule.gameDates
    .flatMap((d) => d.games.map((g) => ({ ...g, date: d.gameDate })))
    .filter((g) => g.gameId.startsWith('002') && g.gameStatus === 3) // レギュラーシーズンの終了済み試合

  let data = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf-8')) as ScoringClock) : emptyClock(season)
  if (data.season !== season || data.binSeconds !== BIN_SEC) data = emptyClock(season)
  const done = new Set(data.games)
  const todo = finished.filter((g) => !done.has(g.gameId))
  console.log(`🕐 ${season}: 終了済み ${finished.length}試合 / 未集計 ${todo.length}試合`)

  let failed = 0
  for (const g of todo) {
    try {
      const pbp = await getJson<{ game: { actions: Action[] } }>(
        `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${g.gameId}.json`,
      )
      let prev = 0
      for (const a of pbp.game.actions) {
        const total = (parseInt(a.scoreHome, 10) || 0) + (parseInt(a.scoreAway, 10) || 0)
        const delta = total - prev
        if (delta <= 0) continue
        prev = total
        if (a.period > 4) {
          data.otExcluded += delta
          continue
        }
        const left = clockSeconds(a.clock)
        if (left === null) continue
        const elapsed = (a.period - 1) * 720 + (720 - left)
        const bin = Math.min(BINS - 1, Math.max(0, Math.floor(elapsed / BIN_SEC)))
        const kind = a.actionType === '3pt' ? 'pt3' : a.actionType === 'freethrow' ? 'ft' : 'pt2'
        data.points[kind][bin] += delta
      }
      data.games.push(g.gameId)
      if (g.date) {
        const d = new Date(g.date).toISOString().slice(0, 10)
        if (d > data.through) data.through = d
      }
    } catch (err) {
      failed++
      console.warn(`  ⚠️  ${g.gameId}: ${err instanceof Error ? err.message : err}`)
    }
    await new Promise((r) => setTimeout(r, 150))
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(data) + '\n', 'utf-8')
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  console.log(
    `  集計済み ${data.games.length}試合（〜${data.through}）: 3P ${sum(data.points.pt3)} / 2P ${sum(data.points.pt2)} / FT ${sum(data.points.ft)} / 延長除外 ${data.otExcluded}`,
  )
  if (todo.length > 0 && failed / todo.length > 0.2) {
    throw new Error(`${failed}/${todo.length} 試合の取得に失敗しました`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
