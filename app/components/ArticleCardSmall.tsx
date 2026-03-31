import Link from 'next/link'
import Image from 'next/image'
import { type Post, getCategoryGradient, getCategoryLabel, formatDate, getPostDate } from '@/lib/posts'

type Props = { post: Post }

export function ArticleCardSmall({ post }: Props) {
  return (
    <article className="border-b border-border last:border-b-0">
      <Link href={`/articles/${post.slug}`} className="group flex gap-3 py-3 items-start">
        {/* 正方形サムネイル */}
        <div
          className="shrink-0 overflow-hidden rounded-[2px] relative"
          style={{ width: '76px', height: '76px' }}
        >
          {post.thumbnail_url ? (
            <Image
              src={post.thumbnail_url}
              alt={post.title}
              fill
              className="object-cover"
              sizes="100px"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: getCategoryGradient(post.category) }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* テキスト */}
        <div className="flex flex-col min-w-0 py-0.5 gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-accent font-heading">
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
