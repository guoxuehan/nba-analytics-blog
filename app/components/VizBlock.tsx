'use client'

import decidedAt from '@/data/viz/decided-at.json'
import scoringClock from '@/data/viz/scoring-clock.json'
import { DecidedAt, DecidedAtData, lateShare } from './DecidedAt'
import { ScoringClock, ScoringClockData } from './ScoringClock'

/** :::viz 名前 の1行を、対応する作品型の図にする。知らない名前は何も表示しない */
export function VizBlock({ name }: { name: string }) {
  if (name === 'scoring-clock') {
    return (
      <ScoringClock
        data={scoringClock as ScoringClockData}
        title="ブザー前の15秒に、点が集まる"
        subtitle="今季の全得点を、入った時刻（15秒ごと）に積み上げた。時計の1周＝試合の48分"
      />
    )
  }
  if (name === 'decided-at') {
    const data = decidedAt as DecidedAtData
    if (data.decided.length === 0) return null // 集計前は出さない
    return (
      <DecidedAt
        data={data}
        title={`${lateShare(data).pct}%の試合は、第4Q残り5分を過ぎてから決まった`}
        subtitle="1点＝1試合。勝ったチームが、その後一度もリードを譲らなかった時刻に置いた"
      />
    )
  }
  return null
}
