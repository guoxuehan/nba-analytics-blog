'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { type Post, getCategoryGradient, getCategoryAccent, getCategoryLabel, formatDate, getPostDate } from '@/lib/posts'

type Props = { post: Post }

export function HeroArticle({ post }: Props) {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parallaxRef.current
    if (!el) return
    const handleScroll = () => {
      el.style.translate = `0 ${window.scrollY * 0.08}px`
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const accent = getCategoryAccent(post.category)

  return (
    <section aria-label="注目記事">
      <Link
        href={`/articles/${post.slug}`}
        className="group relative block overflow-hidden"
        style={{ height: 'clamp(420px, 56vh, 600px)' }}
      >
        {/* カテゴリグラデーション背景（パララックス） */}
        <div
          className="absolute"
          style={{ inset: '-8%', willChange: 'translate' }}
          ref={parallaxRef}
          aria-hidden="true"
        >
          <div
            className="w-full h-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
            style={{ background: getCategoryGradient(post.category) }}
          />
        </div>

        {/* ノイズテクスチャ的なオーバーレイ（深みを出す） */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.05) 100%)',
          }}
          aria-hidden="true"
        />

        {/* アクセントライン（左下） */}
        <div
          className="absolute left-0 bottom-0"
          style={{ width: '4px', height: '100%', background: accent, opacity: 0.7 }}
          aria-hidden="true"
        />

        {/* コンテンツ */}
        <div className="container-content absolute bottom-0 left-0 right-0 pb-10 pt-16">
          {/* カテゴリバッジ */}
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 mb-4"
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
          <h1
            className="font-heading font-bold text-white leading-[1.05] uppercase max-w-4xl"
            style={{
              fontSize: 'clamp(30px, 4.5vw, 54px)',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
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
            dateTime={getPostDate(post)}
            className="mt-5 block text-white/50 text-[11px] uppercase tracking-[0.1em] font-body"
          >
            {formatDate(getPostDate(post))}
          </time>
        </div>
      </Link>
    </section>
  )
}
