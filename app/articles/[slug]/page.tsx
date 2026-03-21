export const revalidate = 60

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  getPostBySlug,
  getRelatedPosts,
  getRecentPosts,
  getPublishedPosts,
  calculateReadingTime,
  getCategoryGradient,
  getCategoryLabel,
  formatDate,
} from '@/lib/posts'
import { ArticleContent } from '@/app/components/ArticleContent'
import { ArticleSidebar } from '@/app/components/ArticleSidebar'
import { ArticleCardLarge } from '@/app/components/ArticleCardLarge'
import { ShareButtons } from '@/app/components/ShareButtons'
import { CommentSection, type Comment } from '@/app/components/CommentSection'
import { getSupabase } from '@/lib/supabase'

// ─── 静的パス生成 ─────────────────────────────────────────────

export async function generateStaticParams() {
  const posts = await getPublishedPosts(100)
  return posts.map((p) => ({ slug: p.slug }))
}

// ─── 動的メタデータ（SEO・OGP） ───────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) return { title: '記事が見つかりません' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://courtvision.jp'

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      publishedTime: post.published_at,
      url: `${siteUrl}/articles/${post.slug}`,
      siteName: 'NBA COURT VISION',
      ...(post.thumbnail_url ? { images: [{ url: post.thumbnail_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt ?? undefined,
    },
  }
}

// ─── ページコンポーネント ─────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const [relatedPosts, recentPosts, commentsResult] = await Promise.all([
    getRelatedPosts(post.category, post.slug, 4),
    getRecentPosts(post.slug, 5),
    getSupabase()
      .from('comments')
      .select('id, author_name, content, created_at')
      .eq('article_id', post.id)
      .order('created_at', { ascending: false }),
  ])

  const initialComments: Comment[] = (commentsResult.data ?? []) as Comment[]

  const readingTime = calculateReadingTime(post.content)
  const relatedForBottom = relatedPosts.slice(0, 3)
  const relatedForSidebar = relatedPosts.slice(0, 3)

  // JSON-LD 構造化データ
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://courtvision.jp'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? '',
    datePublished: post.published_at,
    dateModified: post.published_at,
    url: `${siteUrl}/articles/${post.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'NBA COURT VISION',
      url: siteUrl,
    },
    author: {
      '@type': 'Organization',
      name: 'NBA COURT VISION',
    },
    ...(post.thumbnail_url
      ? { image: { '@type': 'ImageObject', url: post.thumbnail_url } }
      : {}),
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        {/* ── 記事ヘッダー ──────────────────────────────────────── */}
        <header className="border-b border-border">
          <div className="container-content py-8 md:py-10">
            <div style={{ maxWidth: '760px' }}>
              {/* カテゴリバッジ */}
              <Link
                href={`/category/${post.category}`}
                className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-[3px] mb-4 hover:opacity-80 transition-opacity"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '2px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {getCategoryLabel(post.category)}
              </Link>

              {/* タイトル */}
              <h1
                className="font-heading font-bold text-text-primary uppercase"
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 40px)',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.1',
                }}
              >
                {post.title}
              </h1>


              {/* メタ情報（日付・読了時間） */}
              <div className="flex items-center gap-4 mt-5">
                <time
                  dateTime={post.published_at}
                  className="text-text-secondary font-body"
                  style={{ fontSize: '13px' }}
                >
                  {formatDate(post.published_at)}
                </time>
                <span className="text-border" aria-hidden="true">|</span>
                <span
                  className="text-text-secondary font-body"
                  style={{ fontSize: '13px' }}
                >
                  {readingTime} min read
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── ヒーロー画像（任意） ──────────────────────────────── */}
        <div className="container-content pt-6 pb-0">
          <div
            className="w-full rounded-[4px] overflow-hidden relative"
            style={{ height: 'clamp(200px, 40vw, 480px)' }}
          >
            {post.thumbnail_url ? (
              <Image
                src={post.thumbnail_url}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: getCategoryGradient(post.category) }}
                role="img"
                aria-label={post.title}
              />
            )}
          </div>
        </div>

        {/* ── 本文レイアウト ────────────────────────────────────── */}
        <div className="container-content py-8">
          <div className="flex gap-12 items-start">

            {/* メインコンテンツ */}
            <main className="min-w-0 flex-1" style={{ maxWidth: '720px' }}>

              {/* Markdownレンダリング */}
              <ArticleContent content={post.content} />

              {/* ── タグ ────────────────────────────────────────── */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tag/${encodeURIComponent(tag)}`}
                      className="px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-text-secondary border border-border hover:border-accent hover:text-accent transition-colors duration-150 font-heading"
                      style={{ borderRadius: '2px' }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* ── SNSシェア ──────────────────────────────────── */}
              <div className="mt-6 pt-5 border-t border-border">
                <ShareButtons title={post.title} />
              </div>

              {/* ── 関連記事（モバイル・タブレット用：lg未満で表示） */}
              {relatedForBottom.length > 0 && (
                <section className="mt-10 pt-6 border-t border-border lg:hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      style={{ width: '3px', height: '16px', background: 'var(--accent)', borderRadius: '1px' }}
                      aria-hidden="true"
                    />
                    <h2 className="font-heading font-bold text-text-primary uppercase"
                      style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                      関連記事
                    </h2>
                  </div>
                  <ArticleSidebar relatedPosts={relatedForSidebar} recentPosts={recentPosts.slice(0, 3)} />
                </section>
              )}
            </main>

            {/* ── サイドバー（デスクトップのみ lg+） ────────────── */}
            <aside
              className="hidden lg:block shrink-0 sticky"
              style={{ width: '280px', top: '88px', alignSelf: 'flex-start' }}
            >
              <ArticleSidebar relatedPosts={relatedForSidebar} recentPosts={recentPosts} />
            </aside>
          </div>
        </div>

        {/* ── コメントセクション ────────────────────────────────── */}
        <div className="container-content">
          <div style={{ maxWidth: '720px' }}>
            <CommentSection articleId={post.id} initialComments={initialComments} />
          </div>
        </div>

        {/* ── 記事下部：関連記事カード（デスクトップ） ─────────── */}
        {relatedForBottom.length > 0 && (
          <section className="border-t border-border">
            <div className="container-content py-10">
              <div className="flex items-center gap-3 mb-6">
                <div
                  style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }}
                  aria-hidden="true"
                />
                <h2
                  className="font-heading font-bold text-text-primary uppercase"
                  style={{ fontSize: '13px', letterSpacing: '0.1em' }}
                >
                  関連記事
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedForBottom.map((p) => (
                  <ArticleCardLarge key={p.id} post={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </>
  )
}
