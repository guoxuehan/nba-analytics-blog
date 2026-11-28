'use client'

import { useState } from 'react'

/**
 * ⏱ 試合はいつ決まるか: 1点＝1試合。勝ったチームが「その後一度もリードを譲らなかった」時刻に点を積む
 * 横軸は試合の48分（1分ごと）＋延長。第4Q残り5分以降と延長に決まった試合を強調する
 */
export type DecidedAtData = {
  season: string
  through: string
  games: string[]
  decided: { id: string; t: number; ot: boolean; margin: number }[]
}

/** 強調する境目: 第4Q残り5分（試合開始から43分） */
export const LATE_FROM = 43 * 60

export function lateShare(data: DecidedAtData): { late: number; total: number; pct: number } {
  const total = data.decided.length
  const late = data.decided.filter((g) => g.ot || g.t >= LATE_FROM).length
  return { late, total, pct: total ? Math.round((late / total) * 100) : 0 }
}

const W = 640
const COLS = 49 // 48分 + 延長
const LEFT = 8
const COL_W = (W - LEFT * 2) / (COLS + 0.6) // 延長の前に少し間をあける
const PLOT_H = 260
const TOP = 34
const BOTTOM = 40

const colX = (c: number) => LEFT + (c + (c === 48 ? 0.6 : 0)) * COL_W + COL_W / 2

/** 列 c の時刻表示 */
function colLabel(c: number): string {
  if (c === 48) return '延長'
  const q = Math.floor(c / 12) + 1
  const from = 12 - (c % 12)
  return `第${q}Q 残り${from}:00〜${from - 1}:00`
}

export function DecidedAt({ data, title, subtitle }: { data: DecidedAtData; title: string; subtitle: string }) {
  const [hover, setHover] = useState<number | null>(null)

  const cols: number[] = Array(COLS).fill(0)
  for (const g of data.decided) cols[g.ot ? 48 : Math.min(47, Math.floor(g.t / 60))]++
  const max = Math.max(...cols, 1)
  const step = Math.min(COL_W * 0.9, PLOT_H / max) // 点の縦の間隔
  const r = Math.max(1.6, Math.min(step, COL_W) * 0.42)
  const base = TOP + PLOT_H
  const { late, total, pct } = lateShare(data)
  const isLate = (c: number) => c >= 43
  const height = base + BOTTOM

  // 強調部分の上の注記位置
  const lateTop = base - Math.max(...cols.slice(43)) * step - 10

  return (
    <figure className="viz viz-decided" aria-label={`${title}。${subtitle}`}>
      <figcaption className="viz-head" style={{ textAlign: 'center' }}>
        <span className="viz-title">{title}</span>
        <span className="viz-subtitle">{subtitle}</span>
      </figcaption>
      <ul className="viz-legend" style={{ justifyContent: 'center' }} aria-hidden="true">
        <li>
          <span className="viz-key viz-key-dot" style={{ background: 'var(--viz-2)' }} />
          第4Q残り5分以降・延長に決着
        </li>
        <li>
          <span className="viz-key viz-key-dot" style={{ background: 'var(--viz-1-muted)' }} />
          それより前に決着
        </li>
      </ul>
      <div className="viz-plot" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-hidden="true">
          {/* クォーターの区切り */}
          {[12, 24, 36].map((m) => {
            const x = Math.round((LEFT + m * COL_W) * 100) / 100
            return <line key={m} x1={x} x2={x} y1={TOP - 4} y2={base} className="viz-grid" />
          })}
          <line x1={LEFT} x2={W - LEFT} y1={base} y2={base} className="viz-axis" />
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
            <text key={q} x={LEFT + (i * 12 + 6) * COL_W} y={base + 20} className="viz-tick" textAnchor="middle">
              {q}
            </text>
          ))}
          <text x={colX(48)} y={base + 20} className="viz-tick" textAnchor="middle">
            延長
          </text>
          {/* 1点＝1試合 */}
          {cols.map((n, c) => (
            <g key={c} opacity={hover === null || hover === c ? 1 : 0.45}>
              {Array.from({ length: n }, (_, k) => (
                <circle
                  key={k}
                  cx={Math.round(colX(c) * 100) / 100}
                  cy={Math.round((base - step * (k + 0.5)) * 100) / 100}
                  r={Math.round(r * 100) / 100}
                  fill={isLate(c) ? 'var(--viz-2)' : 'var(--viz-1-muted)'}
                />
              ))}
              {/* 当たり判定は列全体 */}
              <rect
                x={colX(c) - COL_W / 2}
                y={TOP}
                width={COL_W}
                height={PLOT_H}
                fill="transparent"
                onPointerEnter={() => setHover(c)}
                onPointerDown={() => setHover(c)}
              />
            </g>
          ))}
          {/* 強調部分の注記 */}
          <text x={colX(45.5)} y={Math.max(14, lateTop)} className="viz-value viz-strong" textAnchor="middle">
            {late}試合（{pct}%）
          </text>
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: Math.max(0, Math.min(colX(hover) / W, 0.7)) * 100 + '%', top: 0 }}>
            <div className="viz-tip-title">{colLabel(hover)}</div>
            <div className="viz-tip-row">
              <span className="viz-tip-name">ここで決着</span>
              <span className="viz-tip-value">{cols[hover]}試合</span>
            </div>
          </div>
        )}
      </div>
      <p className="viz-source">
        {data.season} レギュラーシーズン {data.through} まで・{total.toLocaleString('ja-JP')}試合・決着＝勝ったチームがその後一度もリードを譲らなかった時刻・出典: ESPN（試合経過データ）
      </p>
    </figure>
  )
}
