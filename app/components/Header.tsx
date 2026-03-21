'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

const NAV_ITEMS = [
  { label: '最新記事', href: '/' },
  { label: '選手分析', href: '/category/player_analysis' },
  { label: 'チーム分析', href: '/category/team_analysis' },
  { label: '戦術', href: '/category/tactics' },
  { label: 'データ', href: '/category/data' },
]

// ─── アイコン（インライン SVG） ─────────────────────────────

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ─── ハンバーガー → × アニメーション ─────────────────────────

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="flex flex-col items-center justify-center w-5 h-4 relative">
      <span
        className="absolute block w-5 h-[2px] bg-current transition-all duration-250 ease-in-out"
        style={{
          transform: open ? 'rotate(45deg) translateY(0)' : 'translateY(-5px)',
        }}
      />
      <span
        className="absolute block w-5 h-[2px] bg-current transition-all duration-250 ease-in-out"
        style={{
          opacity: open ? 0 : 1,
          transform: open ? 'scaleX(0)' : 'scaleX(1)',
        }}
      />
      <span
        className="absolute block w-5 h-[2px] bg-current transition-all duration-250 ease-in-out"
        style={{
          transform: open ? 'rotate(-45deg) translateY(0)' : 'translateY(5px)',
        }}
      />
    </span>
  )
}

// ─── ナビゲーションアイテム（ホバー下線アニメーション） ──────

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group relative py-1 text-[13px] font-bold uppercase tracking-wider text-text-primary hover:text-accent transition-colors duration-150"
    >
      {label}
      <span
        className="absolute bottom-0 left-0 w-full h-[2px] bg-accent transition-transform duration-200 ease-out origin-left scale-x-0 group-hover:scale-x-100"
      />
    </Link>
  )
}

// ─── テーマトグル ─────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <span className="w-8 h-8 block" />
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-150 cursor-pointer"
      aria-label={resolvedTheme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
    >
      {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// ─── メインヘッダー ───────────────────────────────────────────

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // メニュー開時はスクロールをロック
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <header
      className="sticky top-0 z-50 bg-bg border-b border-border transition-shadow duration-200"
      style={{ boxShadow: scrolled ? '0 1px 0 0 var(--border), 0 4px 12px 0 rgba(0,0,0,0.06)' : 'none' }}
    >
      {/* アクセントバー（上部3px） */}
      <div className="h-[3px] bg-accent w-full" />

      {/* ヘッダー本体 */}
      <div
        className="container-content flex items-center justify-between transition-[padding] duration-200 ease-out"
        style={{ paddingBlock: scrolled ? '10px' : '16px' }}
      >
        {/* ロゴ */}
        <Link
          href="/"
          className="font-heading text-xl font-bold uppercase text-text-primary hover:text-accent transition-colors duration-150 shrink-0"
          style={{ letterSpacing: '0.1em' }}
        >
          NBA COURT VISION
        </Link>

        {/* デスクトップナビゲーション */}
        <nav className="hidden md:flex items-center gap-7" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* アクション群 */}
        <div className="flex items-center gap-1">
          <ThemeToggle />

          {/* ハンバーガーボタン（モバイルのみ） */}
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center text-text-primary cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* モバイルメニュー（スライドダウン） */}
      <div
        className="md:hidden overflow-hidden bg-bg border-b border-border transition-all duration-300 ease-in-out"
        style={{
          maxHeight: menuOpen ? '320px' : '0px',
          opacity: menuOpen ? 1 : 0,
        }}
        aria-hidden={!menuOpen}
      >
        <nav className="container-content py-2 flex flex-col" aria-label="モバイルナビゲーション">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 border-b border-border last:border-b-0 text-[13px] font-bold uppercase tracking-wider text-text-primary hover:text-accent transition-colors duration-150"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
