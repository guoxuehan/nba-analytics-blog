'use client'

import { useEffect, useRef, useState } from 'react'
import { ChartSpec, formatValue, niceTicks } from '@/lib/chart'

// ─── 寸法 ───────────────────────────────────────────────────────────
const FONT = 13 // 軸・ラベルの文字サイズ（px）
const BAR = 14 // 棒の太さ（24px 以下）
const ROW = 30 // 横棒1本ぶんの行の高さ（項目名の行は別）
const LINE_H = 260 // 折れ線のプロット高さ
const SERIES = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)']

/** 文字幅の見積もり（全角 ≒ 1em、半角 ≒ 0.58em） */
function textWidth(s: string, size = FONT): number {
  let w = 0
  for (const ch of s) w += /[\u0000-ÿ]/.test(ch) ? size * 0.58 : size
  return w
}

function truncate(s: string, maxWidth: number): string {
  if (textWidth(s) <= maxWidth) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…') > maxWidth) break
    out += ch
  }
  return out + '…'
}

/** 角を丸めた横棒（基線側は四角、先端だけ 4px の丸み） */
function barPath(x0: number, y: number, len: number, h: number): string {
  const r = Math.min(4, len / 2, h / 2)
  const x1 = x0 + len
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`
}

type Tip = { left: number; top: number; title: string; rows: { color: string; name: string; value: string }[] }

export function ArticleChart({ spec }: { spec: ChartSpec }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [tip, setTip] = useState<Tip | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const label = `${spec.title}（${spec.type === 'line' ? '折れ線グラフ' : '棒グラフ'}）。出典: ${spec.source}`

  return (
    <figure className="viz" aria-label={label}>
      <figcaption className="viz-head">
        <span className="viz-title">{spec.title}</span>
        {(spec.subtitle || spec.unit) && (
          <span className="viz-subtitle">
            {spec.subtitle}
            {spec.subtitle && spec.unit && '　'}
            {spec.unit && `単位: ${spec.unit}`}
          </span>
        )}
      </figcaption>
      {spec.series.length > 1 && (
        <ul className="viz-legend" aria-hidden="true">
          {spec.series.map((s, i) => (
            <li key={s.name}>
              <span className="viz-key" style={{ background: SERIES[i] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={wrapRef} className="viz-plot" onPointerLeave={() => { setTip(null); setHover(null) }}>
        {spec.type === 'bar' ? (
          <BarChart spec={spec} width={width} hover={hover} setHover={setHover} setTip={setTip} />
        ) : (
          <LineChart spec={spec} width={width} hover={hover} setHover={setHover} setTip={setTip} />
        )}
        {tip && (
          <div className="viz-tip" style={{ left: tip.left, top: tip.top }} role="presentation">
            <div className="viz-tip-title">{tip.title}</div>
            {tip.rows.map((r) => (
              <div key={r.name} className="viz-tip-row">
                <span className="viz-key" style={{ background: r.color }} />
                {spec.series.length > 1 && <span className="viz-tip-name">{r.name}</span>}
                <span className="viz-tip-value">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="viz-source">出典: {spec.source}</p>
      <details className="viz-table">
        <summary>データを表で見る</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{spec.type === 'line' ? '' : '項目'}</th>
              {spec.series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {spec.x.map((x, i) => (
              <tr key={x}>
                <th scope="row">{x}</th>
                {spec.series.map((s) => <td key={s.name}>{formatValue(s.values[i], spec.unit)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

type PlotProps = {
  spec: ChartSpec
  width: number
  hover: number | null
  setHover: (i: number | null) => void
  setTip: (t: Tip | null) => void
}

// ─── 横棒グラフ（項目の比較）────────────────────────────────────────
function BarChart({ spec, width, hover, setHover, setTip }: PlotProps) {
  const values = spec.series[0].values
  const valueLabels = values.map((v) => formatValue(v, spec.unit))
  const naturalLabelW = Math.max(...spec.x.map((x) => textWidth(x))) + 8
  // 項目名は棒の上の行に置く（項目名の長さに左右されず、棒の長さを横幅いっぱいに使える）
  const stacked = true
  void naturalLabelW
  const labelW = stacked ? 0 : naturalLabelW
  const valueW = Math.max(...valueLabels.map((v) => textWidth(v))) + 8
  const plotX = labelW
  const plotW = Math.max(40, width - labelW - valueW)
  const max = Math.max(...values) || 1
  const rowH = stacked ? FONT + 8 + BAR + 16 : ROW // 項目名 → すき間 → 棒 → 次の行までの余白
  const height = spec.x.length * rowH
  const anyHighlight = spec.highlight !== undefined

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {!stacked && <line x1={plotX} x2={plotX} y1={0} y2={height} className="viz-axis" />}
      {spec.x.map((x, i) => {
        const y = stacked ? i * rowH + FONT + 8 : i * rowH + (ROW - BAR) / 2
        const len = Math.max(1, (values[i] / max) * plotW)
        const strong = !anyHighlight || spec.highlight === x
        const show = () => {
          setHover(i)
          setTip({ left: Math.max(0, Math.min(plotX + len + 8, width - 160)), top: y + BAR + 8, title: x, rows: [{ color: 'var(--viz-1)', name: spec.series[0].name, value: valueLabels[i] }] })
        }
        return (
          <g key={x}>
            {stacked ? (
              <text x={0} y={i * rowH + FONT} className={strong ? 'viz-label viz-strong' : 'viz-label'}>
                {truncate(x, width)}
              </text>
            ) : (
              <text x={labelW - 8} y={y + BAR / 2} className={strong ? 'viz-label viz-strong' : 'viz-label'} textAnchor="end" dominantBaseline="central">
                {x}
              </text>
            )}
            <path
              d={barPath(plotX, y, len, BAR)}
              fill={strong ? 'var(--viz-1)' : 'var(--viz-1-muted)'}
              opacity={hover === null || hover === i ? 1 : 0.6}
            />
            <text x={plotX + len + 6} y={y + BAR / 2} className={strong ? 'viz-value viz-strong' : 'viz-value'} dominantBaseline="central">
              {valueLabels[i]}
            </text>
            {/* 当たり判定は行全体（棒より大きく） */}
            <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" onPointerEnter={show} onPointerDown={show} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── 折れ線グラフ（推移）────────────────────────────────────────────
function LineChart({ spec, width, hover, setHover, setTip }: PlotProps) {
  const all = spec.series.flatMap((s) => s.values)
  let lo = Math.min(...all)
  const hi = Math.max(...all)
  if (lo >= 0 && lo < hi * 0.35) lo = 0 // 0 に近ければ 0 起点にする
  const ticks = niceTicks(lo, hi)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const tickLabels = ticks.map((t) => formatValue(t))

  const top = 12
  const bottom = 28
  const left = Math.max(...tickLabels.map((t) => textWidth(t))) + 10
  const endLabels = spec.series.map((s) => formatValue(s.values[s.values.length - 1], spec.unit))
  const right = Math.min(110, Math.max(...endLabels.map((l) => textWidth(l))) + 14)
  const plotW = Math.max(60, width - left - right)
  const n = spec.x.length
  const xAt = (i: number) => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yAt = (v: number) => top + (1 - (v - yMin) / (yMax - yMin || 1)) * LINE_H
  const height = top + LINE_H + bottom

  // 横軸ラベルは重ならない間隔で間引く（最初と最後は必ず出す）
  const xLabelW = Math.max(...spec.x.map((x) => textWidth(x))) + 12
  const every = Math.max(1, Math.ceil((xLabelW * n) / plotW))
  const showX = (i: number) => i === 0 || i === n - 1 || (i % every === 0 && n - 1 - i >= every)

  // 終点ラベルが重なるときは縦にずらさず、凡例とツールチップに任せる
  const endYs = spec.series.map((s) => yAt(s.values[n - 1]))
  const endCollide = endYs.some((y, i) => endYs.some((y2, j) => i !== j && Math.abs(y - y2) < FONT + 2))

  const pick = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - left) / plotW) * (n - 1))))
    setHover(i)
    const tipLeft = xAt(i) + 12 > width - 150 ? xAt(i) - 152 : xAt(i) + 12
    setTip({
      left: tipLeft,
      top: top,
      title: spec.x[i],
      rows: spec.series.map((s, k) => ({ color: SERIES[k], name: s.name, value: formatValue(s.values[i], spec.unit) })),
    })
  }

  const hi_i = spec.highlight !== undefined ? spec.x.indexOf(spec.highlight) : -1

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {ticks.map((t, k) => (
        <g key={t}>
          <line x1={left} x2={left + plotW} y1={yAt(t)} y2={yAt(t)} className={k === 0 ? 'viz-axis' : 'viz-grid'} />
          <text x={left - 8} y={yAt(t)} className="viz-tick" textAnchor="end" dominantBaseline="central">{tickLabels[k]}</text>
        </g>
      ))}
      {spec.x.map((x, i) =>
        showX(i) ? (
          <text key={x} x={xAt(i)} y={top + LINE_H + 18} className="viz-tick" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {x}
          </text>
        ) : null,
      )}
      {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={top} y2={top + LINE_H} className="viz-crosshair" />}
      {spec.series.map((s, k) => (
        <g key={s.name}>
          <polyline
            points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
            fill="none"
            stroke={SERIES[k]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={xAt(n - 1)} cy={yAt(s.values[n - 1])} r={4} fill={SERIES[k]} className="viz-dot" />
          {!endCollide && (
            <text x={xAt(n - 1) + 8} y={yAt(s.values[n - 1])} className="viz-value viz-strong" dominantBaseline="central">
              {endLabels[k]}
            </text>
          )}
          {hi_i >= 0 && hi_i !== n - 1 && (
            <circle cx={xAt(hi_i)} cy={yAt(s.values[hi_i])} r={4} fill={SERIES[k]} className="viz-dot" />
          )}
          {hover !== null && <circle cx={xAt(hover)} cy={yAt(s.values[hover])} r={5} fill={SERIES[k]} className="viz-dot" />}
        </g>
      ))}
      {hi_i >= 0 && hi_i !== n - 1 && spec.series.length === 1 && (
        <text x={xAt(hi_i)} y={yAt(spec.series[0].values[hi_i]) - 12} className="viz-value viz-strong" textAnchor="middle">
          {formatValue(spec.series[0].values[hi_i], spec.unit)}
        </text>
      )}
      {/* 当たり判定はプロット全体 */}
      <rect
        x={left}
        y={top}
        width={plotW}
        height={LINE_H}
        fill="transparent"
        onPointerMove={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
      />
    </svg>
  )
}
