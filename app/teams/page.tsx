// 順位表を1時間ごとに作り直す
export const revalidate = 3600

import type { Metadata } from 'next'
import Link from 'next/link'
import { TEAMS, getStandings, type Conference, type Standing } from '@/lib/teams'

export const metadata: Metadata = {
  title: 'NBA全30チーム 順位と記事',
  description: 'NBA全30チームの最新順位と、チームごとの分析記事の一覧です。',
}

const CONFERENCES: { key: Conference; label: string }[] = [
  { key: 'East', label: 'イースタン・カンファレンス' },
  { key: 'West', label: 'ウエスタン・カンファレンス' },
]

function ConferenceTable({ conference, label, standings }: { conference: Conference; label: string; standings: Standing[] }) {
  const rows = standings.filter((s) => s.conference === conference)
  // 順位表が取れなかったときは、チームを地区順に並べる
  const teams = rows.length > 0
    ? rows.map((s) => ({ team: TEAMS.find((t) => t.slug === s.teamSlug)!, standing: s }))
    : TEAMS.filter((t) => t.conference === conference).map((team) => ({ team, standing: undefined }))

  return (
    <section className="mb-10">
      <h2 className="font-heading font-bold text-text-primary mb-3" style={{ fontSize: '15px', letterSpacing: '0.05em' }}>
        {label}
      </h2>
      <table className="w-full text-sm font-body">
        <thead>
          <tr className="text-text-secondary border-b border-border text-left" style={{ fontSize: '12px' }}>
            <th className="py-2 pr-2 w-10">{rows.length > 0 ? '順位' : ''}</th>
            <th className="py-2 pr-2">チーム</th>
            {rows.length > 0 && (
              <>
                <th className="py-2 pr-2 text-right">勝</th>
                <th className="py-2 pr-2 text-right">敗</th>
                <th className="py-2 pr-2 text-right">勝率</th>
                <th className="py-2 text-right">差</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {teams.map(({ team, standing }) => (
            <tr key={team.slug} className="border-b border-border hover:bg-bg-secondary transition-colors">
              <td className="py-2 pr-2 text-text-secondary">{standing?.seed ?? ''}</td>
              <td className="py-2 pr-2">
                {/* リンクだと分かるよう、下線と矢印を付ける */}
                <Link
                  href={`/teams/${team.slug}`}
                  className="font-bold text-text-primary underline decoration-border underline-offset-4 hover:text-accent hover:decoration-accent transition-colors"
                >
                  {team.ja}
                  <span className="ml-1 text-text-secondary" aria-hidden="true">›</span>
                </Link>
              </td>
              {standing && (
                <>
                  <td className="py-2 pr-2 text-right tabular-nums">{standing.wins}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{standing.losses}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{standing.winPct.toFixed(3).replace(/^0/, '')}</td>
                  <td className="py-2 text-right tabular-nums text-text-secondary">{standing.gamesBehind}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default async function TeamsPage() {
  const standings = await getStandings()

  return (
    <div className="container-content py-12">
      <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
        <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
        <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
          チーム
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12">
        {CONFERENCES.map((c) => (
          <ConferenceTable key={c.key} conference={c.key} label={c.label} standings={standings} />
        ))}
      </div>

      <p className="text-text-secondary font-body" style={{ fontSize: '12px' }}>
        {standings.length > 0
          ? '順位はESPNの公開データをもとに1時間ごとに更新しています。'
          : '順位表を取得できなかったため、チームを地区順に表示しています。'}
      </p>
    </div>
  )
}
