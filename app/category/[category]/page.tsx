export const revalidate = 60

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPostsByCategory } from '@/lib/posts'
import { ArticleGrid } from '@/app/components/ArticleGrid'

// ─── カテゴリ定義 ─────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  player_analysis: { label: '選手分析',   description: 'NBAプレイヤーのデータ分析・パフォーマンス解説' },
  team_analysis:   { label: 'チーム分析', description: 'NBAチームの戦力・システム分析' },
  tactics:         { label: '戦術',       description: 'NBAの戦術・プレーセット解説' },
  data:            { label: 'データ',     description: 'NBAアドバンスドスタッツ・指標解説' },
}

// ─── メタデータ ───────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const meta = CATEGORY_META[category]
  if (!meta) return {}
  return {
    title: meta.label,
    description: meta.description,
  }
}

// ─── ページ ───────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const meta = CATEGORY_META[category]
  if (!meta) notFound()

  const posts = await getPostsByCategory(category)

  return (
    <div className="section-gap">
      {posts.length === 0 ? (
        <div className="container-content">
          <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
            <div
              className="shrink-0"
              style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }}
              aria-hidden="true"
            />
            <h1
              className="font-heading font-bold text-text-primary uppercase"
              style={{ fontSize: '13px', letterSpacing: '0.1em' }}
            >
              {meta.label}
            </h1>
          </div>
          <p className="text-text-secondary text-sm py-16 text-center">記事がありません</p>
        </div>
      ) : (
        <ArticleGrid posts={posts} title={meta.label} />
      )}
    </div>
  )
}
