// 記事を1時間ごとに作り直す
export const revalidate = 3600
// 一覧にない選手のURLは404にする
export const dynamicParams = false

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArticleGrid } from '@/app/components/ArticleGrid'
import { SITE_URL } from '@/lib/constants'
import { PLAYERS, getPlayer, getPlayerPage } from '@/lib/players'

export function generateStaticParams() {
  return PLAYERS.map((player) => ({ slug: player.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const player = getPlayer(slug)
  if (!player) return { title: '選手が見つかりません' }
  const description = `${player.ja}（${player.en}）に関する分析記事の一覧。NBA COURT VISIONがデータで読み解きます。`
  return {
    title: `${player.ja}の分析記事`,
    description,
    alternates: {
      canonical: `${SITE_URL}/players/${player.slug}`,
      // alternates はレイアウトの値を丸ごと上書きするため、RSS もここで指定し直す
      types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
    },
    openGraph: { title: `${player.ja}の分析記事`, description, url: `${SITE_URL}/players/${player.slug}` },
  }
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const player = getPlayer(slug)
  if (!player) notFound()

  const { posts, teams } = await getPlayerPage(player)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.en,
    alternateName: player.ja,
    jobTitle: 'Basketball player',
    url: `${SITE_URL}/players/${player.slug}`,
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
          <Link href="/players" className="text-text-secondary hover:text-text-primary font-body" style={{ fontSize: '12px' }}>
            ← 選手一覧
          </Link>
          <h1
            className="font-heading font-bold text-text-primary mt-3"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.01em', lineHeight: 1.15 }}
          >
            {player.ja}
          </h1>
          <p className="text-text-secondary font-body mt-1" style={{ fontSize: '14px' }}>
            {player.en} ／ 記事 {posts.length}本
          </p>

          {teams.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 font-body" style={{ fontSize: '12px' }}>
              <span className="text-text-secondary">記事によく出てくるチーム:</span>
              {teams.map((team) => (
                <Link
                  key={team.slug}
                  href={`/teams/${team.slug}`}
                  className="px-2 py-1 border border-border text-text-primary hover:border-accent hover:text-accent transition-colors"
                  style={{ borderRadius: '2px' }}
                >
                  {team.ja}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {posts.length > 0 ? (
        <ArticleGrid posts={posts} title={`${player.short ?? player.ja}の記事`} />
      ) : (
        <div className="container-content py-16">
          <p className="text-text-secondary text-sm text-center">{player.ja}の記事はまだありません。</p>
        </div>
      )}
    </>
  )
}
