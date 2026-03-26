import Link from 'next/link'
import Image from 'next/image'
import { type Post, getCategoryGradient, getCategoryLabel, formatDate, getPostDate } from '@/lib/posts'

type Props = { post: Post }

export function ArticleCardLarge({ post }: Props) {
  return (
    <article>
      <Link href={`/articles/${post.slug}`} className="group block card overflow-hidden">
        {/* サムネイル（16:9） */}
        <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          {post.thumbnail_url ? (
            <Image
              src={post.thumbnail_url}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-[500ms] ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div
              className="absolute inset-0 transition-transform duration-[500ms] ease-out group-hover:scale-[1.03]"
              style={{ background: getCategoryGradient(post.category) }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* テキストエリア */}
        <div className="p-4 md:p-5">
          {/* カテゴリバッジ */}
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-[2px] mb-3"
            style={{
              background: 'var(--badge-bg)',
              color: 'var(--badge-text)',
              borderRadius: '2px',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {getCategoryLabel(post.category)}
          </span>

          {/* タイトル */}
          <h2
            className="font-heading font-bold text-text-primary uppercase leading-[1.2] group-hover:text-accent transition-colors duration-200"
            style={{ fontSize: 'clamp(17px, 1.4vw, 20px)', letterSpacing: '-0.02em' }}
          >
            {post.title}
          </h2>

          {/* 抜粋 */}
          {post.excerpt && (
            <p className="mt-2 text-text-secondary text-[13px] leading-[1.55] line-clamp-2 font-body">
              {post.excerpt}
            </p>
          )}

          {/* 日付 */}
          <time
            dateTime={getPostDate(post)}
            className="mt-3 block text-text-secondary text-[11px] uppercase tracking-wider font-body"
          >
            {formatDate(getPostDate(post))}
          </time>
        </div>
      </Link>
    </article>
  )
}
