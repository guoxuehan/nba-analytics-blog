export const revalidate = 60

import type { Metadata } from 'next'
import { getPostsByTag } from '@/lib/posts'
import { ArticleGrid } from '@/app/components/ArticleGrid'

// ─── メタデータ ───────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>
}): Promise<Metadata> {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  return {
    title: `#${decoded}`,
    description: `「${decoded}」タグの記事一覧`,
  }
}

// ─── ページ ───────────────────────────────────────────────────

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const posts = await getPostsByTag(decoded)

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
              className="font-heading font-bold text-text-primary"
              style={{ fontSize: '13px', letterSpacing: '0.1em' }}
            >
              #{decoded}
            </h1>
          </div>
          <p className="text-text-secondary text-sm py-16 text-center">記事がありません</p>
        </div>
      ) : (
        <ArticleGrid posts={posts} title={`#${decoded}`} />
      )}
    </div>
  )
}
