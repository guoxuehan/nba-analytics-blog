// 記事と順位を1時間ごとに作り直す
export const revalidate = 3600
// 30チーム以外のURLは404にする
export const dynamicParams = false

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleGrid } from '@/app/components/ArticleGrid'
import { SITE_URL } from '@/lib/constants'
import { TEAMS, getStandings, getTeam, getTeamPosts } from '@/lib/teams'

export function generateStaticParams() {
  return TEAMS.map((team) => ({ slug: team.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const team = getTeam(slug)
  if (!team) return { title: 'チームが見つかりません' }
  const description = `${team.ja}（${team.en}）の最新順位と分析記事の一覧。NBA COURT VISIONがデータで読み解きます。`
  return {
    title: `${team.ja}の順位・分析記事`,
    description,
    alternates: {
      canonical: `${SITE_URL}/teams/${team.slug}`,
      // alternates はレイアウトの値を丸ごと上書きするため、RSS もここで指定し直す
      types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
    },
    openGraph: { title: `${team.ja}の順位・分析記事`, description, url: `${SITE_URL}/teams/${team.slug}` },
  }
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = getTeam(slug)
  if (!team) notFound()

  const [standings, posts] = await Promise.all([getStandings(), getTeamPosts(team, 20)])
  const standing = standings.find((s) => s.teamSlug === team.slug)
  const confLabel = team.conference === 'East' ? 'イースタン' : 'ウエスタン'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.en,
    alternateName: team.ja,
    sport: 'Basketball',
    memberOf: { '@type': 'SportsOrganization', name: 'NBA' },
    url: `${SITE_URL}/teams/${team.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        // `<` をエスケープして、スクリプト注入を防ぐ（Next.js の JSON-LD ガイドに従う）
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="border-b border-border">
        <div className="container-content py-8 md:py-10">
          <Link href="/teams" className="text-text-secondary hover:text-text-primary font-body" style={{ fontSize: '12px' }}>
            ← 全30チーム
          </Link>
          <h1
            className="font-heading font-bold text-text-primary mt-3"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.01em', lineHeight: 1.15 }}
          >
            {team.ja}
          </h1>
          <p className="text-text-secondary font-body mt-1" style={{ fontSize: '14px' }}>
            {team.en} ／ {confLabel}・カンファレンス {team.division}地区
          </p>

          {standing && (
            <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-5 font-body">
              {[
                { label: `${confLabel}順位`, value: `${standing.seed}位` },
                { label: '成績', value: `${standing.wins}勝${standing.losses}敗` },
                { label: '勝率', value: standing.winPct.toFixed(3).replace(/^0/, '') },
                { label: '首位とのゲーム差', value: standing.gamesBehind },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-text-secondary" style={{ fontSize: '11px' }}>{item.label}</dt>
                  <dd className="text-text-primary font-bold tabular-nums" style={{ fontSize: '20px' }}>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      {posts.length > 0 ? (
        <ArticleGrid posts={posts} title={`${team.short}の記事`} />
      ) : (
        <div className="container-content py-16">
          <p className="text-text-secondary text-sm text-center">{team.ja}の記事はまだありません。</p>
        </div>
      )}
    </>
  )
}
