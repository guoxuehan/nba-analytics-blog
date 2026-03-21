import Link from 'next/link'
import { type Post, getCategoryGradient, getCategoryLabel, formatDate } from '@/lib/posts'

// ─── サイドバーの記事アイテム ─────────────────────────────────

function SidebarPostItem({ post }: { post: Post }) {
  const bgStyle = post.thumbnail_url
    ? { backgroundImage: `url(${post.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: getCategoryGradient(post.category) }

  return (
    <Link
      href={`/articles/${post.slug}`}
      className="group flex gap-3 py-3 items-start border-b border-border last:border-b-0"
    >
      <div
        className="shrink-0 rounded-[2px] overflow-hidden"
        style={{ width: '64px', height: '64px', ...bgStyle }}
      />
      <div className="flex flex-col min-w-0 gap-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em] text-accent font-heading"
        >
          {getCategoryLabel(post.category)}
        </span>
        <h3
          className="font-heading font-bold text-text-primary leading-[1.25] line-clamp-2 group-hover:text-accent transition-colors duration-150"
          style={{ fontSize: '13px', letterSpacing: '-0.01em' }}
        >
          {post.title}
        </h3>
        <time className="text-[11px] text-text-secondary font-body">
          {formatDate(post.published_at)}
        </time>
      </div>
    </Link>
  )
}

// ─── セクションヘッダー ───────────────────────────────────────

function SidebarSectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
      <div
        className="shrink-0"
        style={{ width: '3px', height: '16px', background: 'var(--accent)', borderRadius: '1px' }}
        aria-hidden="true"
      />
      <h2
        className="font-heading font-bold text-text-primary uppercase"
        style={{ fontSize: '11px', letterSpacing: '0.1em' }}
      >
        {title}
      </h2>
    </div>
  )
}

// ─── メインサイドバー ─────────────────────────────────────────

type Props = {
  relatedPosts: Post[]
  recentPosts: Post[]
}

export function ArticleSidebar({ relatedPosts, recentPosts }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {/* 関連記事 */}
      {relatedPosts.length > 0 && (
        <section>
          <SidebarSectionHeader title="関連記事" />
          <div>
            {relatedPosts.map((post) => (
              <SidebarPostItem key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* 最新記事 */}
      {recentPosts.length > 0 && (
        <section>
          <SidebarSectionHeader title="最新記事" />
          <div>
            {recentPosts.map((post) => (
              <SidebarPostItem key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
