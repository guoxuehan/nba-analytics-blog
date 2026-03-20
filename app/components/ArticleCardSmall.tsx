import Link from 'next/link'
import { type Post, getCategoryGradient, formatDate } from '@/lib/posts'

type Props = { post: Post }

export function ArticleCardSmall({ post }: Props) {
  const bgStyle = post.thumbnail_url
    ? { backgroundImage: `url(${post.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: getCategoryGradient(post.category) }

  return (
    <article className="border-b border-border last:border-b-0">
      <Link href={`/articles/${post.slug}`} className="group flex gap-3 py-3 items-start">
        {/* 正方形サムネイル */}
        <div
          className="shrink-0 overflow-hidden rounded-[2px]"
          style={{ width: '76px', height: '76px' }}
        >
          <div className="w-full h-full" style={bgStyle} />
        </div>

        {/* テキスト */}
        <div className="flex flex-col min-w-0 py-0.5 gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em] text-accent font-heading"
          >
            {post.category}
          </span>

          <h3
            className="font-heading font-bold text-text-primary leading-[1.25] line-clamp-2 group-hover:text-accent transition-colors duration-150"
            style={{ fontSize: '14px', letterSpacing: '-0.01em' }}
          >
            {post.title}
          </h3>

          <time
            dateTime={post.published_at}
            className="text-[11px] text-text-secondary mt-auto font-body"
          >
            {formatDate(post.published_at)}
          </time>
        </div>
      </Link>
    </article>
  )
}
