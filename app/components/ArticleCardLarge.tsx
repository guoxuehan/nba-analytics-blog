import Link from 'next/link'
import Image from 'next/image'
import { type Post, getCategoryAccent, getCategoryLabel, formatDate, getPostDate } from '@/lib/posts'

type Props = { post: Post }

export function ArticleCardLarge({ post }: Props) {
  const accent = getCategoryAccent(post.category)

  return (
    <article>
      <Link
        href={`/articles/${post.slug}`}
        className="group block card overflow-hidden h-full"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        {/* thumbnail_url が設定されている記事のみ画像を表示 */}
        {post.thumbnail_url && (
          <div className="relative overflow-hidden" style={{ paddingBottom: '56.25%' }}>
            <Image
              src={post.thumbnail_url}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-[500ms] ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}

        {/* テキストエリア */}
        <div className="p-4 md:p-5 flex flex-col gap-2">
          {/* カテゴリバッジ */}
          <span
            className="inline-block self-start text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-[3px]"
            style={{
              background: accent,
              color: '#fff',
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
            <p className="text-text-secondary text-[13px] leading-[1.6] line-clamp-3 font-body">
              {post.excerpt}
            </p>
          )}

          {/* 日付 */}
          <time
            dateTime={getPostDate(post)}
            className="mt-auto pt-1 block text-text-secondary text-[11px] uppercase tracking-wider font-body"
          >
            {formatDate(getPostDate(post))}
          </time>
        </div>
      </Link>
    </article>
  )
}
