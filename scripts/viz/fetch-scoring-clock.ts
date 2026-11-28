/**
 * 🕐 時計図のデータ: 今季のレギュラーシーズン全試合の全得点を、入った時刻（試合経過）ごとに数える
 *
 * - 出典: ESPN の試合経過データ（play-by-play）。cdn.nba.com は GitHub Actions から 403 になるため使わない
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
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
}

export type ScoringClock = {
  season: string
  through: string // 最後に数えた試合の日付（YYYY-MM-DD, 米国の試合日）
  binSeconds: number
  games: string[] // 数えた試合の ESPN event id
  points: { pt3: number[]; pt2: number[]; ft: number[] } // 各区間の得点合計
  otExcluded: number // 除いた延長戦の得点
}

type Scoreboard = {
  events?: {
    id: string
    date: string
    season: { year: number; type: number } // type 2 = レギュラーシーズン
    status: { type: { completed: boolean } }
  }[]
}

type Play = {
  period: { number: number }
  clock: { displayValue: string } // "11:42" や "45.3"
  scoringPlay?: boolean
  scoreValue?: number
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

function emptyClock(season: string): ScoringClock {
  const zeros = () => Array<number>(BINS).fill(0)
  return { season, through: '', binSeconds: BIN_SEC, games: [], points: { pt3: zeros(), pt2: zeros(), ft: zeros() }, otExcluded: 0 }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

/** NBA のシーズン表記（2026-27 シーズンは ESPN の year=2027） */
const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`

async function main() {
  // 10月1日（今季の開幕前）から昨日までの日付ごとに、終了済みのレギュラーシーズン試合を集める
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

  let data = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf-8')) as ScoringClock) : emptyClock(season)
  if (data.season !== season || data.binSeconds !== BIN_SEC) data = emptyClock(season)
  const done = new Set(data.games)
  const todo = finished.filter((g) => !done.has(g.id))
  console.log(`🕐 ${season}: 終了済み ${finished.length}試合 / 未集計 ${todo.length}試合`)

  let failed = 0
  for (const g of todo) {
    try {
      const summary = await getJson<{ plays?: Play[] }>(`${ESPN}/summary?event=${g.id}`)
      const plays = summary.plays ?? []
      if (plays.length === 0) throw new Error('試合経過データがありません')
      for (const p of plays) {
        const pts = p.scoringPlay ? p.scoreValue ?? 0 : 0
        if (pts <= 0) continue
        if (p.period.number > 4) {
          data.otExcluded += pts
          continue
        }
        const left = clockSeconds(p.clock.displayValue)
        if (left === null) continue
        const elapsed = (p.period.number - 1) * 720 + (720 - left)
        const bin = Math.min(BINS - 1, Math.max(0, Math.floor(elapsed / BIN_SEC)))
        const kind = pts === 3 ? 'pt3' : pts === 1 ? 'ft' : 'pt2'
        data.points[kind][bin] += pts
      }
      data.games.push(g.id)
      if (g.date > data.through) data.through = g.date
    } catch (err) {
      failed++
      console.warn(`  ⚠️  ${g.id}: ${err instanceof Error ? err.message : err}`)
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
