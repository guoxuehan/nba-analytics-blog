import Link from 'next/link'

const NAV_ITEMS = [
  { label: '最新記事', href: '/' },
  { label: '選手分析', href: '/category/player_analysis' },
  { label: 'チーム分析', href: '/category/team_analysis' },
  { label: '戦術', href: '/category/tactics' },
  { label: 'データ', href: '/category/data' },
]

const SOCIAL_LINKS = [
  {
    label: 'X (Twitter)',
    href: 'https://twitter.com',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-bg-secondary border-t border-border mt-auto">
      <div className="container-content py-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">

          {/* ブランド */}
          <div className="shrink-0">
            <p
              className="font-heading font-bold text-lg uppercase text-text-primary"
              style={{ letterSpacing: '0.1em' }}
            >
              NBA COURT VISION
            </p>
            <p className="text-text-secondary text-sm mt-1">
              NBAアナリティクス
            </p>
          </div>

          {/* カテゴリリンク */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="フッターナビゲーション">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] text-text-secondary hover:text-text-primary transition-colors duration-150 uppercase tracking-wider font-body"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* SNSリンク */}
          <div className="flex items-center gap-3 shrink-0">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-150"
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>

        {/* コピーライト */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-[12px] text-text-secondary">
            © {year} Court Vision. All rights reserved.
          </p>
          <p className="text-[12px] text-text-secondary">
            NBA統計データに基づく独立メディア
          </p>
        </div>
      </div>
    </footer>
  )
}
