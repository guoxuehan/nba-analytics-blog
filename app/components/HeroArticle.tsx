'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { type Post, getCategoryGradient, getCategoryLabel, formatDate } from '@/lib/posts'

type Props = { post: Post }

export function HeroArticle({ post }: Props) {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parallaxRef.current
    if (!el) return
    const handleScroll = () => {
      // CSS `translate` プロパティは transform と競合しない
      el.style.translate = `0 ${window.scrollY * 0.10}px`
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section aria-label="注目記事">
      <Link
        href={`/articles/${post.slug}`}
        className="group relative block overflow-hidden"
        style={{ height: 'clamp(480px, 62vh, 660px)' }}
      >
        {/* 背景（パララックス用：少し広めに取る） */}
        <div
          className="absolute"
          style={{ inset: '-12%', willChange: 'translate' }}
          ref={parallaxRef}
          aria-hidden="true"
        >
          {post.thumbnail_url ? (
            <div className="relative w-full h-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]">
              <Image
                src={post.thumbnail_url}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
            </div>
          ) : (
            <div
              className="w-full h-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
              style={{ background: getCategoryGradient(post.category) }}
            />
          )}
        </div>

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
            {getCategoryLabel(post.category)}
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
