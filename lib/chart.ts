/**
 * 記事内グラフ（```chart ブロック）の仕様・検証
 *
 * 本文に次の形式で書くと、記事ページでグラフとして描画される:
 *
 * ```chart
 * {
 *   "type": "line",                       // "line"（推移）| "bar"（比較・横棒）
 *   "title": "リーグ平均の3P試投数（1試合あたり）",
 *   "subtitle": "1点＝1シーズン、10年ごと",  // 任意。図の読み方を1行で
 *   "unit": "本",                          // 任意。値の単位
 *   "x": ["1980", "1990", "2000"],         // 横軸（line）または項目名（bar）
 *   "series": [{ "name": "3P試投数", "values": [2.8, 6.6, 13.7] }],
 *   "highlight": "2000",                   // 任意。強調する x の値
 *   "source": "Basketball-Reference"       // 必須。数字の出典
 * }
 * ```
 *
 * 形式が崩れたブロックは描画しない（読者に JSON を見せない）。
 */

export type ChartSpec = {
  type: 'line' | 'bar'
  title: string
  subtitle?: string
  unit?: string
  x: string[]
  series: { name: string; values: number[] }[]
  highlight?: string
  source: string
}

export const CHART_BLOCK = /^```chart[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm

export const CHART_LIMITS = {
  line: { minX: 2, maxX: 40, maxSeries: 3 },
  bar: { minX: 2, maxX: 15, maxSeries: 1 },
} as const

/** JSON を検証して ChartSpec にする。問題があれば理由を返す */
export function parseChart(json: string): { spec: ChartSpec } | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { error: 'JSON として読めません' }
  }
  if (!raw || typeof raw !== 'object') return { error: 'オブジェクトではありません' }
  const r = raw as Record<string, unknown>

  if (r.type !== 'line' && r.type !== 'bar') return { error: 'type は "line" か "bar"' }
  const limits = CHART_LIMITS[r.type]
  if (typeof r.title !== 'string' || !r.title.trim()) return { error: 'title がありません' }
  if (typeof r.source !== 'string' || !r.source.trim()) return { error: 'source（出典）がありません' }
  if (r.unit !== undefined && typeof r.unit !== 'string') return { error: 'unit は文字列' }
  if (r.subtitle !== undefined && typeof r.subtitle !== 'string') return { error: 'subtitle は文字列' }
  if (!Array.isArray(r.x) || r.x.length < limits.minX || r.x.length > limits.maxX) {
    return { error: `x は ${limits.minX}〜${limits.maxX} 個` }
  }
  const x = r.x.map((v) => String(v))
  if (!Array.isArray(r.series) || r.series.length < 1 || r.series.length > limits.maxSeries) {
    return { error: `series は 1〜${limits.maxSeries} 本` }
  }
  const series: ChartSpec['series'] = []
  for (const s of r.series as unknown[]) {
    const so = s as Record<string, unknown> | null
    if (!so || typeof so.name !== 'string' || !Array.isArray(so.values)) return { error: 'series の形式が不正' }
    if (so.values.length !== x.length) return { error: `「${so.name}」の値の数が x と一致しません` }
    if (!so.values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { error: `「${so.name}」に数値でない値があります` }
    }
    series.push({ name: so.name, values: so.values as number[] })
  }
  if (r.type === 'bar' && series[0].values.some((v) => v < 0)) return { error: 'bar は 0 以上の値のみ' }
  const highlight = r.highlight === undefined ? undefined : String(r.highlight)
  if (highlight !== undefined && !x.includes(highlight)) return { error: 'highlight が x にありません' }

  return {
    spec: {
      type: r.type,
      title: r.title.trim(),
      subtitle: typeof r.subtitle === 'string' && r.subtitle.trim() ? r.subtitle.trim() : undefined,
      unit: typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim() : undefined,
      x,
      series,
      highlight,
      source: r.source.trim(),
    },
  }
}

/** 本文から chart ブロックを除いたテキスト（文字数・読了時間の計算用） */
export function stripCharts(body: string): string {
  return body.replace(CHART_BLOCK, '')
}

/** 形式の崩れた chart ブロックを本文から取り除く。取り除いた理由を返す */
export function removeInvalidCharts(body: string): { body: string; removed: string[] } {
  const removed: string[] = []
  const cleaned = body.replace(CHART_BLOCK, (block, json: string) => {
    const result = parseChart(json)
    if ('error' in result) {
      removed.push(result.error)
      return ''
    }
    return block
  })
  return { body: cleaned.replace(/\n{3,}/g, '\n\n'), removed }
}

/** 数値の表示（日本語の桁区切り、小数は最大2桁） */
export function formatValue(v: number, unit?: string): string {
  const s = v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return unit ? `${s}${unit}` : s
}

/** 軸の目盛り（1・2・5 × 10^n 刻み）。最大 maxTicks 本程度 */
export function niceTicks(min: number, max: number, maxTicks = 5): number[] {
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }
  const rawStep = (max - min) / maxTicks
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let k = 0; start + k * step <= end + step / 2; k++) ticks.push(parseFloat((start + k * step).toPrecision(12)))
  return ticks
}
