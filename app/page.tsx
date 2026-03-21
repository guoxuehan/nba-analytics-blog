export const revalidate = 60

import { Suspense } from 'react'
import { getPublishedPosts } from '@/lib/posts'
import { HeroArticle } from '@/app/components/HeroArticle'
import { ArticleGrid } from '@/app/components/ArticleGrid'
import { CategorySection } from '@/app/components/CategorySection'

// ─── スケルトン（Suspense フォールバック） ────────────────────

function HeroSkeleton() {
  return (
    <div
      className="w-full bg-bg-secondary animate-pulse"
      style={{ height: 'clamp(480px, 62vh, 660px)' }}
    />
  )
}

function GridSkeleton() {
  return (
    <div className="container-content section-gap">
      <div className="h-6 w-24 bg-bg-secondary rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="bg-bg-secondary animate-pulse" style={{ paddingBottom: '56.25%' }} />
            <div className="p-5 space-y-3">
              <div className="h-3 w-16 bg-bg-secondary rounded animate-pulse" />
              <div className="h-5 bg-bg-secondary rounded animate-pulse" />
              <div className="h-4 bg-bg-secondary rounded animate-pulse w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── データフェッチ＋レンダリング（Server Component） ─────────

async function HomeContent() {
  const posts = await getPublishedPosts(20)

  const hero = posts[0]
  const gridPosts = posts.slice(1, 9)

  const playerPosts  = posts.filter((p) => p.category === 'player_analysis')
  const tacticsPosts = posts.filter((p) => p.category === 'tactics')
  const dataPosts    = posts.filter((p) => p.category === 'data')

  return (
    <>
      {hero && <HeroArticle post={hero} />}

      <ArticleGrid posts={gridPosts} title="LATEST ARTICLES" />

      <CategorySection
        title="選手分析"
        href="/category/player_analysis"
        posts={playerPosts.slice(0, 4)}
        layout="grid"
      />

      <CategorySection
        title="戦術"
        href="/category/tactics"
        posts={tacticsPosts.slice(0, 4)}
        layout="scroll"
      />

      <CategorySection
        title="データ"
        href="/category/data"
        posts={dataPosts.slice(0, 4)}
        layout="scroll"
      />
    </>
  )
}

// ─── ページエントリ ──────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* タグラインバー — Suspense外で確実にヘッダー直下に表示 */}
      <div
        className="w-full border-b border-border"
        style={{ background: 'var(--bg-secondary)', padding: '12px 0' }}
      >
        <p
          className="text-center font-body text-text-secondary"
          style={{ fontSize: '15px', letterSpacing: '0.05em' }}
        >
          戦略コンサル × PhDデータサイエンティストが、NBAをデータから解剖する。
        </p>
      </div>

      <Suspense fallback={<HeroSkeleton />}>
        <Suspense fallback={<GridSkeleton />}>
          <HomeContent />
        </Suspense>
      </Suspense>
    </>
  )
}
