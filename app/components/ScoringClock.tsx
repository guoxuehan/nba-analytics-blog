'use client'

import { useState } from 'react'

/**
 * 🕐 時計図: 試合の48分を時計の1周に見立て、15秒ごとに入った得点を外向きの棒で積む
 * 棒の内側から 2P・3P・フリースローの順に積む。0時の位置が試合開始、時計回りに Q1→Q4
 */
export type ScoringClockData = {
  season: string
  through: string
  binSeconds: number
  games: string[]
  points: { pt3: number[]; pt2: number[]; ft: number[] }
  otExcluded: number
}

const KINDS = [
  { key: 'pt2', name: '2P', color: 'var(--viz-1-muted)' },
  { key: 'pt3', name: '3P', color: 'var(--viz-2)' },
  { key: 'ft', name: 'フリースロー', color: 'var(--viz-3)' },
] as const

const SIZE = 640
const C = SIZE / 2
const R0 = 150 // 文字盤の半径
const R_MAX = 145 // 棒の最大長

const round = (v: number) => Math.round(v * 100) / 100

function polar(r: number, angle: number): [number, number] {
  // angle: 0 = 12時、時計回り（ラジアン）。サーバーとブラウザで三角関数の末尾の桁が違うので丸める
  return [round(C + r * Math.sin(angle)), round(C - r * Math.cos(angle))]
}

/** 扇形の棒（r1〜r2、角度 a1〜a2） */
function wedge(r1: number, r2: number, a1: number, a2: number): string {
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r2, a1)
  const [x3, y3] = polar(r2, a2)
  const [x4, y4] = polar(r1, a2)
  return `M${x1},${y1}L${x2},${y2}A${round(r2)},${round(r2)} 0 0 1 ${x3},${y3}L${x4},${y4}A${round(r1)},${round(r1)} 0 0 0 ${x1},${y1}Z`
}

/** 区間 i の時刻表示（「第4Q 残り0:15〜0:00」） */
function binLabel(i: number, binSeconds: number): string {
  const start = i * binSeconds
  const q = Math.floor(start / 720) + 1
  const leftFrom = 720 - (start % 720)
  const leftTo = leftFrom - binSeconds
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  return `第${q}Q 残り${fmt(leftFrom)}〜${fmt(Math.max(0, leftTo))}`
}

export function ScoringClock({ data, title, subtitle }: { data: ScoringClockData; title: string; subtitle: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const bins = data.points.pt2.length
  const totals = data.points.pt2.map((_, i) => data.points.pt2[i] + data.points.pt3[i] + data.points.ft[i])
  const max = Math.max(...totals) || 1
  const step = (2 * Math.PI) / bins
  const gap = step * 0.18 // 隣の棒とのすき間
  const peak = totals.indexOf(max)
  // 中央の数字: 第1〜第3Qの最後の15秒は、通常時（各Q 残り11:00〜3:00）より何%多いか
  const perQ = bins / 4
  const normal = [0, 1, 2, 3].flatMap((q) => totals.slice(q * perQ + 4, q * perQ + perQ - 12))
  const normalAvg = normal.reduce((a, b) => a + b, 0) / (normal.length || 1)
  const buzzerAvg = [0, 1, 2].reduce((a, q) => a + totals[q * perQ + perQ - 1], 0) / 3
  const buzzerPct = Math.round((buzzerAvg / normalAvg - 1) * 100)
  const games = data.games.length
  const perGame = (v: number) => (v / games).toFixed(2)

  return (
    <figure className="viz viz-clock" aria-label={`${title}。${subtitle}`}>
      <figcaption className="viz-head" style={{ textAlign: 'center' }}>
        <span className="viz-title">{title}</span>
        <span className="viz-subtitle">{subtitle}</span>
      </figcaption>
      <ul className="viz-legend" style={{ justifyContent: 'center' }} aria-hidden="true">
        {KINDS.map((k) => (
          <li key={k.key}>
            <span className="viz-key" style={{ background: k.color }} />
            {k.name}
          </li>
        ))}
      </ul>
      <div className="viz-plot" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-hidden="true">
          {/* 文字盤 */}
          <circle cx={C} cy={C} r={R0 - 6} className="viz-clock-face" />
          {Array.from({ length: 48 }, (_, m) => {
            const a = (m / 48) * 2 * Math.PI
            const major = m % 12 === 0
            const [x1, y1] = polar(R0 - 6, a)
            const [x2, y2] = polar(R0 - (major ? 30 : 14), a)
            return <line key={m} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'viz-clock-major' : 'viz-clock-minor'} />
          })}
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
            const [x, y] = polar(R0 * 0.8, ((i + 0.5) / 4) * 2 * Math.PI)
            return (
              <text key={q} x={x} y={y} className="viz-clock-q" textAnchor="middle" dominantBaseline="central">
                {q}
              </text>
            )
          })}
          {/* 中央の主役の数字（ホバー中はツールチップに譲る） */}
          {hover === null && (
            <g>
              <text x={C} y={C - 30} className="viz-clock-hero" textAnchor="middle" dominantBaseline="central">
                {buzzerPct >= 0 ? '+' : ''}
                {buzzerPct}%
              </text>
              {/* 文字盤の内側に収まるよう2行に分ける（スマホでは文字を大きくするため） */}
              <text x={C} y={C + 36} className="viz-clock-hero-label" textAnchor="middle">
                <tspan x={C}>ブザー前15秒の得点</tspan>
                <tspan x={C} dy="1.35em">
                  （通常時比）
                </tspan>
              </text>
            </g>
          )}
          {/* 得点の棒（内側から 2P → 3P → FT） */}
          {totals.map((_, i) => {
            const a1 = i * step + gap / 2
            const a2 = (i + 1) * step - gap / 2
            let r = R0
            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.45} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                {KINDS.map((k) => {
                  const len = (data.points[k.key][i] / max) * R_MAX
                  const d = len > 0.2 ? wedge(r, r + len, a1, a2) : null
                  r += len
                  return d ? <path key={k.key} d={d} fill={k.color} /> : null
                })}
                {/* 当たり判定は棒より大きく（文字盤の外から最大長まで） */}
                <path d={wedge(R0, R0 + R_MAX + 8, i * step, (i + 1) * step)} fill="transparent" />
              </g>
            )
          })}
          {/* いちばん高い棒に注記 */}
          {(() => {
            const a = (peak + 0.5) * step
            const [x0, y0] = polar(R0 + (totals[peak] / max) * R_MAX + 4, a)
            const [x, y] = polar(R0 + R_MAX + 22, a)
            const right = Math.sin(a) >= 0
            return (
              <g>
                <line x1={x0} y1={y0} x2={x} y2={y} className="viz-annot-line" />
                <text x={right ? x + 4 : x - 4} y={y} className="viz-value viz-strong" textAnchor={right ? 'start' : 'end'} dominantBaseline="central">
                  {binLabel(peak, data.binSeconds)}
                </text>
              </g>
            )
          })()}
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="viz-tip-title">{binLabel(hover, data.binSeconds)}</div>
            {KINDS.map((k) => (
              <div key={k.key} className="viz-tip-row">
                <span className="viz-key" style={{ background: k.color }} />
                <span className="viz-tip-name">{k.name}</span>
                <span className="viz-tip-value">{data.points[k.key][hover].toLocaleString('ja-JP')}点</span>
              </div>
            ))}
            <div className="viz-tip-row">
              <span className="viz-tip-name">1試合あたり</span>
              <span className="viz-tip-value">{perGame(totals[hover])}点</span>
            </div>
          </div>
        )}
      </div>
      <p className="viz-source">
        {data.season} レギュラーシーズン {data.through} まで・{games.toLocaleString('ja-JP')}試合・15秒ごと・延長戦は除外・出典: ESPN（試合経過データ）
      </p>
    </figure>
  )
}
