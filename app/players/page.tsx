// 記事数を1時間ごとに作り直す
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { PLAYERS, getPlayerArticleCounts } from '@/lib/players'

export const metadata: Metadata = {
  title: 'NBA注目選手の分析記事',
  description: '八村塁、ルカ・ドンチッチ、ウェンバンヤマなど、NBA注目選手ごとの分析記事の一覧です。',
}

export default async function PlayersPage() {
  const counts = await getPlayerArticleCounts()
  // 記事の多い順。同数なら一覧の並び（日本人選手 → 現役 → レジェンド）のまま
  const players = [...PLAYERS].sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))

  return (
    <div className="container-content py-12">
      <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
        <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
        <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
          選手
        </h1>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((player) => {
          const count = counts.get(player.slug) ?? 0
          return (
            <li key={player.slug}>
              <Link
                href={`/players/${player.slug}`}
                className="group flex items-center justify-between gap-3 border border-border px-4 py-3 hover:border-accent transition-colors duration-150"
                style={{ borderRadius: '4px' }}
              >
                <span className="min-w-0">
                  <span className="block font-body font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                    {player.ja}
                  </span>
                  <span className="block text-text-secondary font-body truncate" style={{ fontSize: '12px' }}>
                    {player.en}
                  </span>
                </span>
                <span className="shrink-0 text-text-secondary font-body tabular-nums" style={{ fontSize: '12px' }}>
                  {count}本 <span aria-hidden="true">›</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
