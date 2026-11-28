/**
 * 🕐 作品型の図のデータ: 今季のレギュラーシーズン全試合の試合経過（play-by-play）から集計する
 *
 * - 出典: ESPN の試合経過データ。cdn.nba.com は GitHub Actions から 403 になるため使わない
 * - 1試合の試合経過を1回だけ読み、図ごとの集計（下の DATASETS）に渡す
 * - 図ごとに「数えた試合」を持ち、まだ数えていない試合だけを足す（毎日の実行で増分更新）
 *
 * 出力:
 *   data/viz/scoring-clock.json  時計図: 全得点を、入った時刻（15秒ごと）で数える（延長戦は除く）
 *   data/viz/decided-at.json     試合はいつ決まるか: 勝ったチームが最後にリードを奪った時刻（試合ごと）
 *
 * 使い方: npx tsx scripts/viz/fetch-play-by-play.ts
 */
import * as fs from 'fs'
import * as path from 'path'

const VIZ_DIR = path.join(process.cwd(), 'data', 'viz')
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
}

// ─── ESPN ──────────────────────────────────────────────────────────────
type Scoreboard = {
  events?: {
    id: string
    season: { year: number; type: number } // type 2 = レギュラーシーズン
    status: { type: { completed: boolean } }
  }[]
}

export type Play = {
  period: { number: number }
  clock: { displayValue: string } // "11:42" や "45.3"
  scoringPlay?: boolean
  scoreValue?: number
  homeScore?: number
  awayScore?: number
}

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return (await res.json()) as T
    if (attempt >= 3 || res.status === 404) throw new Error(`${res.status} ${url}`)
    await new Promise((r) => setTimeout(r, 1000 * attempt))
  }
}

/** "11:42" / "45.3" → 残り秒数 */
function clockSeconds(display: string): number | null {
  const m = display.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  return m ? (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2]) : null
}

/** 試合開始からの経過秒数（延長は1回5分） */
export function elapsedSeconds(p: Play): number | null {
  const left = clockSeconds(p.clock.displayValue)
  if (left === null) return null
  const n = p.period.number
  return n <= 4 ? (n - 1) * 720 + (720 - left) : 2880 + (n - 5) * 300 + (300 - left)
}

// ─── 図ごとの集計 ──────────────────────────────────────────────────────
type Base = { season: string; through: string; games: string[] }

/** 時計図 */
export type ScoringClock = Base & {
  binSeconds: number
  points: { pt3: number[]; pt2: number[]; ft: number[] } // 各区間の得点合計
  otExcluded: number // 除いた延長戦の得点
}

/** 試合はいつ決まるか */
export type DecidedAt = Base & {
  // t: 勝者が最後にリードを奪った時刻（試合開始からの秒数、延長を含む）。margin: 最終点差
  decided: { id: string; t: number; ot: boolean; margin: number }[]
}

type Dataset<T extends Base> = {
  file: string
  empty: (season: string) => T
  add: (data: T, gameId: string, plays: Play[]) => void
  summary: (data: T) => string
}

const BIN_SEC = 15
const BINS = (48 * 60) / BIN_SEC

const scoringClock: Dataset<ScoringClock> = {
  file: 'scoring-clock.json',
  empty: (season) => {
    const zeros = () => Array<number>(BINS).fill(0)
    return { season, through: '', binSeconds: BIN_SEC, games: [], points: { pt3: zeros(), pt2: zeros(), ft: zeros() }, otExcluded: 0 }
  },
  add: (data, _id, plays) => {
    for (const p of plays) {
      const pts = p.scoringPlay ? p.scoreValue ?? 0 : 0
      if (pts <= 0) continue
      if (p.period.number > 4) {
        data.otExcluded += pts
        continue
      }
      const t = elapsedSeconds(p)
      if (t === null) continue
      const bin = Math.min(BINS - 1, Math.max(0, Math.floor(t / BIN_SEC)))
      const kind = pts === 3 ? 'pt3' : pts === 1 ? 'ft' : 'pt2'
      data.points[kind][bin] += pts
    }
  },
  summary: (d) => {
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
    return `3P ${sum(d.points.pt3)} / 2P ${sum(d.points.pt2)} / FT ${sum(d.points.ft)} / 延長除外 ${d.otExcluded}`
  },
}

const decidedAt: Dataset<DecidedAt> = {
  file: 'decided-at.json',
  empty: (season) => ({ season, through: '', games: [], decided: [] }),
  add: (data, id, plays) => {
    const scored = plays.filter((p) => typeof p.homeScore === 'number' && typeof p.awayScore === 'number')
    const last = scored[scored.length - 1]
    if (!last || last.homeScore === last.awayScore) throw new Error('最終スコアが読めません')
    const sign = last.homeScore! > last.awayScore! ? 1 : -1
    // 勝者がリードしていない（同点・負け越し）状態が最後に終わった瞬間 = 決着の時刻
    let since: number | null = null
    for (const p of scored) {
      const lead = (p.homeScore! - p.awayScore!) * sign
      if (lead <= 0) since = null
      else if (since === null) since = elapsedSeconds(p)
    }
    if (since === null) throw new Error('決着の時刻が読めません')
    data.decided.push({ id, t: Math.round(since), ot: last.period.number > 4, margin: Math.abs(last.homeScore! - last.awayScore!) })
  },
  summary: (d) => {
    const late = d.decided.filter((g) => g.ot || g.t >= 2580).length
    return `第4Q残り5分以降（延長を含む）に決着: ${late}/${d.decided.length}試合`
  },
}

// 図ごとに型は違うが、ここでは共通部分（Base）だけを扱う
const DATASETS = [scoringClock, decidedAt] as unknown as Dataset<Base>[]

// ─── main ──────────────────────────────────────────────────────────────
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
/** NBA のシーズン表記（2026-27 シーズンは ESPN の year=2027） */
const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`

async function main() {
  // 10月1日（今季の開幕前）から今日までの日付ごとに、終了済みのレギュラーシーズン試合を集める
  const now = new Date()
  const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const finished: { id: string; date: string; season: number }[] = []
  for (let d = new Date(Date.UTC(startYear, 9, 1)); d < now; d.setUTCDate(d.getUTCDate() + 1)) {
    const sb = await getJson<Scoreboard>(`${ESPN}/scoreboard?dates=${ymd(d)}`)
    for (const e of sb.events ?? []) {
      if (e.season.type === 2 && e.status.type.completed) finished.push({ id: e.id, date: d.toISOString().slice(0, 10), season: e.season.year })
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  if (finished.length === 0) throw new Error('終了済みの試合が見つかりません')
  const season = seasonLabel(Math.max(...finished.map((g) => g.season)))

  const state = DATASETS.map((ds) => {
    const file = path.join(VIZ_DIR, ds.file)
    let data = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as Base) : ds.empty(season)
    if (data.season !== season) data = ds.empty(season)
    return { ds, file, data, done: new Set(data.games) }
  })
  const todo = finished.filter((g) => state.some((s) => !s.done.has(g.id)))
  console.log(`🕐 ${season}: 終了済み ${finished.length}試合 / 未集計 ${todo.length}試合`)

  let failed = 0
  for (const g of todo) {
    try {
      const summary = await getJson<{ plays?: Play[] }>(`${ESPN}/summary?event=${g.id}`)
      const plays = summary.plays ?? []
      if (plays.length === 0) throw new Error('試合経過データがありません')
      for (const s of state) {
        if (s.done.has(g.id)) continue
        try {
          s.ds.add(s.data, g.id, plays)
          s.data.games.push(g.id)
          s.done.add(g.id)
          if (g.date > s.data.through) s.data.through = g.date
        } catch (err) {
          console.warn(`  ⚠️  ${g.id}（${s.ds.file}）: ${err instanceof Error ? err.message : err}`)
        }
      }
    } catch (err) {
      failed++
      console.warn(`  ⚠️  ${g.id}: ${err instanceof Error ? err.message : err}`)
    }
    await new Promise((r) => setTimeout(r, 150))
  }

  fs.mkdirSync(VIZ_DIR, { recursive: true })
  for (const s of state) {
    fs.writeFileSync(s.file, JSON.stringify(s.data) + '\n', 'utf-8')
    console.log(`  ${s.ds.file}: ${s.data.games.length}試合（〜${s.data.through}） ${s.ds.summary(s.data)}`)
  }
  if (todo.length > 0 && failed / todo.length > 0.2) {
    throw new Error(`${failed}/${todo.length} 試合の取得に失敗しました`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
