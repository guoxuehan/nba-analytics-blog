import Link from 'next/link'
import Image from 'next/image'
import { type Post, getCategoryAccent, getCategoryLabel, formatDate, getPostDate } from '@/lib/posts'

type Props = { post: Post }

export function ArticleCardSmall({ post }: Props) {
  const accent = getCategoryAccent(post.category)

  return (
    <article className="border-b border-border last:border-b-0">
      <Link href={`/articles/${post.slug}`} className="group flex gap-3 py-3 items-start">
        {/* thumbnail_url が設定されている記事のみ画像を表示、なければカラードット */}
        {post.thumbnail_url ? (
          <div
            className="shrink-0 overflow-hidden rounded-[2px] relative"
            style={{ width: '72px', height: '72px' }}
          >
            <Image
              src={post.thumbnail_url}
              alt={post.title}
              fill
              className="object-cover"
              sizes="100px"
            />
          </div>
        ) : (
          <div
            className="shrink-0 rounded-[2px]"
            style={{ width: '3px', height: '72px', background: accent, opacity: 0.8 }}
            aria-hidden="true"
          />
        )}

        {/* テキスト */}
        <div className="flex flex-col min-w-0 py-0.5 gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em] font-heading"
            style={{ color: accent }}
          >
            {getCategoryLabel(post.category)}
          </span>

          <h3
            className="font-heading font-bold text-text-primary leading-[1.25] line-clamp-2 group-hover:text-accent transition-colors duration-200"
            style={{ fontSize: '14px', letterSpacing: '-0.01em' }}
          >
            {post.title}
          </h3>

          <time
            dateTime={getPostDate(post)}
            className="text-[11px] text-text-secondary mt-auto font-body"
          >
            {formatDate(getPostDate(post))}
          </time>
        </div>
      </Link>
    </article>
  )
}
