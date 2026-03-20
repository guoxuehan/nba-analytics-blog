import Link from 'next/link'
import { type Post, getCategoryGradient, formatDate } from '@/lib/posts'

type Props = { post: Post }

export function HeroArticle({ post }: Props) {
  const bgStyle = post.thumbnail_url
    ? { backgroundImage: `url(${post.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: getCategoryGradient(post.category) }

  return (
    <section aria-label="注目記事">
      <Link
        href={`/articles/${post.slug}`}
        className="group relative block overflow-hidden"
        style={{ height: 'clamp(480px, 62vh, 660px)' }}
      >
        {/* 背景（ホバーで scale 1.02） */}
        <div
          className="absolute inset-0 transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
          style={bgStyle}
          aria-hidden="true"
        />

        {/* 暗いグラデーションオーバーレイ */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.1) 100%)',
          }}
          aria-hidden="true"
        />

        {/* コンテンツ */}
        <div className="container-content absolute bottom-0 left-0 right-0 pb-10 pt-16">
          {/* カテゴリバッジ */}
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 mb-4"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: '2px',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {post.category}
          </span>

          {/* タイトル */}
          <h1
            className="font-heading font-bold text-white leading-[1.05] uppercase max-w-4xl"
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              letterSpacing: '-0.02em',
            }}
          >
            {post.title}
          </h1>

          {/* 抜粋 */}
          {post.excerpt && (
            <p className="mt-4 text-white/75 text-[15px] leading-relaxed max-w-2xl line-clamp-2">
              {post.excerpt}
            </p>
          )}

          {/* 日付 */}
          <time
            dateTime={post.published_at}
            className="mt-5 block text-white/50 text-[11px] uppercase tracking-[0.1em] font-body"
          >
            {formatDate(post.published_at)}
          </time>
        </div>
      </Link>
    </section>
  )
}
