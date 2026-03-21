import { type Post } from '@/lib/posts'
import { ArticleCardLarge } from './ArticleCardLarge'
import { ArticleCardSmall } from './ArticleCardSmall'
import { ScrollFadeIn } from './ScrollFadeIn'

type Props = {
  posts: Post[]
  title?: string
}

export function ArticleGrid({ posts, title = 'LATEST' }: Props) {
  if (posts.length === 0) return null

  const largePosts = posts.slice(0, 2)
  const smallPosts = posts.slice(2)

  return (
    <section className="container-content section-gap">
      {/* セクションヘッダー（ESPN風：赤い縦線 + ラベル） */}
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-border">
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

      {/* Row 1: 大きいカード 2枚（2カラム） */}
      {largePosts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {largePosts.map((post, i) => (
            <ScrollFadeIn key={post.id} delay={i * 80}>
              <ArticleCardLarge post={post} />
            </ScrollFadeIn>
          ))}
        </div>
      )}

      {/* Row 2+: 小さいカード（4カラムグリッド → モバイルは2カラム） */}
      {smallPosts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {/* 左2カラム：縦積みカード（ボーダー区切り） */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 border-t border-border">
            {smallPosts.slice(0, 4).map((post, i) => (
              <ScrollFadeIn key={post.id} delay={i * 60} className="px-0 sm:px-3 first:sm:pl-0 sm:border-r sm:last:border-r-0 border-border">
                <ArticleCardSmall post={post} />
              </ScrollFadeIn>
            ))}
          </div>

          {/* 右2カラム：縦積みカード */}
          {smallPosts.slice(4).length > 0 && (
            <div className="lg:col-span-2 lg:border-l border-border lg:pl-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 border-t border-border mt-4 lg:mt-0 pt-4 lg:pt-0">
              {smallPosts.slice(4).map((post, i) => (
                <ScrollFadeIn key={post.id} delay={i * 60} className="px-0 sm:px-3 first:sm:pl-0 sm:border-r sm:last:border-r-0 border-border">
                  <ArticleCardSmall post={post} />
                </ScrollFadeIn>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
