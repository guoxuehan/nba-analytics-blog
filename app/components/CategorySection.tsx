import Link from 'next/link'
import { type Post } from '@/lib/posts'
import { ArticleCardLarge } from './ArticleCardLarge'
import { ArticleCardSmall } from './ArticleCardSmall'

type Props = {
  title: string
  href: string
  posts: Post[]
  layout?: 'grid' | 'scroll'
}

export function CategorySection({ title, href, posts, layout = 'grid' }: Props) {
  if (posts.length === 0) return null

  const featured = posts[0]
  const rest = posts.slice(1)

  return (
    <section className="container-content py-10 border-t border-border">
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0"
            style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }}
            aria-hidden="true"
          />
          <h2
            className="font-heading font-bold text-text-primary uppercase"
            style={{ fontSize: '13px', letterSpacing: '0.1em' }}
          >
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors duration-150 font-heading"
        >
          すべて見る →
        </Link>
      </div>

      {layout === 'scroll' ? (
        /* 横スクロールレイアウト */
        <div
          className="flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {posts.map((post) => (
            <div key={post.id} className="shrink-0 w-[260px]">
              <ArticleCardLarge post={post} />
            </div>
          ))}
        </div>
      ) : (
        /* グリッドレイアウト：フィーチャー1枚 + 小カード */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* フィーチャー記事（左 2/3） */}
          <div className="md:col-span-2">
            <ArticleCardLarge post={featured} />
          </div>

          {/* サイドの小カード（右 1/3） */}
          {rest.length > 0 && (
            <div className="flex flex-col divide-y divide-border">
              {rest.slice(0, 3).map((post) => (
                <ArticleCardSmall key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
