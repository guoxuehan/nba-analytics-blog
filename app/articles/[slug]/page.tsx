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
  getCategoryAccent,
  getCategoryLabel,
  formatDate,
  getPostDate,
} from '@/lib/posts'
import { ArticleContent } from '@/app/components/ArticleContent'
import { ArticleSidebar } from '@/app/components/ArticleSidebar'
import { ArticleCardLarge } from '@/app/components/ArticleCardLarge'
import { ShareButtons } from '@/app/components/ShareButtons'
import { SITE_URL } from '@/lib/constants'
import { CommentSection, type Comment } from '@/app/components/CommentSection'
import { getSupabase } from '@/lib/supabase'
import { findTeamByTag } from '@/lib/teams'
import { findPlayerByTag } from '@/lib/players'
import { hasShop } from '@/lib/affiliates'

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

  const siteUrl = SITE_URL

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: {
      canonical: `${siteUrl}/articles/${post.slug}`,
      // alternates はレイアウトの値を丸ごと上書きするため、RSS もここで指定し直す
      types: { 'application/rss+xml': `${siteUrl}/feed.xml` },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      publishedTime: getPostDate(post),
      url: `${siteUrl}/articles/${post.slug}`,
      siteName: 'NBA COURT VISION',
      images: [
        {
          url: `${siteUrl}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
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

  // JSON-LD 構造化データ（ニュース記事として検索エンジンに伝える）
  const siteUrl = SITE_URL
  const articleUrl = `${siteUrl}/articles/${post.slug}`
  const publishedAt = getPostDate(post)
  // 公開予約より前に作った行は updated_at が公開日時より古いので、新しいほうを更新日時にする
  const modifiedAt =
    post.updated_at && new Date(post.updated_at) > new Date(publishedAt) ? post.updated_at : publishedAt
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt ?? '',
    datePublished: publishedAt,
    dateModified: modifiedAt,
    url: articleUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    inLanguage: 'ja',
    articleSection: getCategoryLabel(post.category),
    keywords: post.tags.join(', '),
    isAccessibleForFree: true,
    publisher: {
      '@type': 'Organization',
      name: 'NBA COURT VISION',
      url: siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteUrl}/icon.svg` },
    },
    author: {
      '@type': 'Organization',
      name: 'NBA COURT VISION 編集部',
      url: `${siteUrl}/about`,
    },
    image: {
      '@type': 'ImageObject',
      url: `${siteUrl}/api/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
    },
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // `<` をエスケープして、記事データ経由のスクリプト注入を防ぐ（Next.js の JSON-LD ガイドに従う）
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <article>
        {/* ── 記事ヘッダー ──────────────────────────────────────── */}
        <header
          className="border-b border-border"
          style={{ borderLeft: `4px solid ${getCategoryAccent(post.category)}` }}
        >
          <div className="container-content py-8 md:py-12">
            <div style={{ maxWidth: '760px' }}>
              {/* カテゴリバッジ */}
              <Link
                href={`/category/${post.category}`}
                className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-[3px] mb-4 hover:opacity-80 transition-opacity"
                style={{
                  background: getCategoryAccent(post.category),
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
                  fontSize: 'clamp(30px, 4vw, 46px)',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.08',
                }}
              >
                {post.title}
              </h1>

              {/* 抜粋 */}
              {post.excerpt && (
                <p
                  className="mt-4 text-text-secondary font-body leading-relaxed"
                  style={{ fontSize: '16px', maxWidth: '640px' }}
                >
                  {post.excerpt}
                </p>
              )}

              {/* メタ情報（日付・読了時間） */}
              <div className="flex items-center gap-4 mt-5">
                <time
                  dateTime={getPostDate(post)}
                  className="text-text-secondary font-body"
                  style={{ fontSize: '13px' }}
                >
                  {formatDate(getPostDate(post))}
                </time>
                <span className="text-border" aria-hidden="true">|</span>
                <span
                  className="text-text-secondary font-body"
                  style={{ fontSize: '13px' }}
                >
                  {readingTime} min read
                </span>
              </div>

              {/* アフィリエイトリンクを含む記事は、その旨を冒頭に表示する（ステルスマーケティング規制への対応） */}
              {hasShop(post.content) && (
                <p className="mt-4 text-text-secondary font-body" style={{ fontSize: '12px' }}>
                  <span
                    className="inline-block mr-2 px-1.5 py-[1px] border border-border font-bold"
                    style={{ borderRadius: '2px', fontSize: '11px' }}
                  >
                    PR
                  </span>
                  この記事にはプロモーション（アフィリエイトリンク）が含まれます。
                </p>
              )}
            </div>
          </div>
        </header>

        {/* thumbnail_url が設定されている記事のみヒーロー画像を表示 */}
        {post.thumbnail_url && (
          <div className="container-content pt-6 pb-0">
            <div
              className="w-full rounded-[4px] overflow-hidden relative"
              style={{ height: 'clamp(200px, 40vw, 480px)' }}
            >
              <Image
                src={post.thumbnail_url}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>
          </div>
        )}

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
                      // チーム名・選手名のタグは、記事がまとまったチーム・選手ページへ
                      href={(() => {
                        const team = findTeamByTag(tag)
                        if (team) return `/teams/${team.slug}`
                        const player = findPlayerByTag(tag)
                        return player ? `/players/${player.slug}` : `/tag/${encodeURIComponent(tag)}`
                      })()}
                      className="px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-text-secondary border border-border hover:border-accent hover:text-accent transition-colors duration-150 font-heading"
                      style={{ borderRadius: '2px' }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* ── 制作体制の表示 ───────────────────────────────── */}
              <p
                className="mt-6 text-text-secondary font-body leading-relaxed"
                style={{ fontSize: '12px' }}
              >
                この記事は、AIを活用したNBA COURT VISION編集部が作成し、数字を取材データと照合する校閲を経て公開しています。
                制作の流れは<Link href="/about" className="underline hover:text-text-primary">編集部について</Link>、
                方針は<Link href="/editorial-policy" className="underline hover:text-text-primary">編集方針</Link>をご覧ください。
                誤りにお気づきの際は<Link href="/contact" className="underline hover:text-text-primary">お問い合わせ</Link>からお知らせください。
              </p>

              {/* ── SNSシェア ──────────────────────────────────── */}
              <div className="mt-6 pt-5 border-t border-border">
                <ShareButtons title={post.title} />
              </div>

              {/* ── 関連記事（モバイル・タブレット用：lg未満で表示） */}
              {relatedForBottom.length > 0 && (
                <section className="mt-10 pt-6 border-t border-border lg:hidden">
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
