'use client'

import scoringClock from '@/data/viz/scoring-clock.json'
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
  return null
}
