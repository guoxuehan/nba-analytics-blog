'use client'

import { amazonEnabled, shopLinks } from '@/lib/affiliates'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/** 記事内の「関連商品を探す」枠。クリックは GA4 に affiliate_click として送る（週次レポートで集計） */
export function ShopBox({ keyword }: { keyword: string }) {
  const links = shopLinks(keyword)
  if (links.length === 0) return null

  return (
    <aside
      className="not-prose my-8 border border-border px-5 py-4 bg-bg-secondary"
      style={{ borderRadius: '4px' }}
      aria-label="関連商品"
    >
      <p className="font-body text-text-secondary" style={{ fontSize: '11px' }}>
        PR・関連商品を探す
      </p>
      <p className="font-body font-bold text-text-primary mt-1" style={{ fontSize: '15px' }}>
        「{keyword}」
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {links.map((link) => (
          <a
            key={link.store}
            href={link.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={() =>
              window.gtag?.('event', 'affiliate_click', { store: link.store, keyword, page_path: location.pathname })
            }
            className="inline-block px-4 py-2 font-body font-bold hover:opacity-90 transition-opacity"
            // 記事本文のリンク用スタイル（青・下線）に上書きされないよう、色と下線はインラインで指定する
            style={{
              fontSize: '13px',
              borderRadius: '2px',
              color: '#fff',
              textDecoration: 'none',
              background: link.store === 'rakuten' ? '#bf0000' : '#232f3e',
            }}
          >
            {link.label} ›
          </a>
        ))}
      </div>
      {amazonEnabled() && (
        <p className="font-body text-text-secondary mt-3" style={{ fontSize: '11px' }}>
          Amazonのアソシエイトとして、当サイトは適格販売により収入を得ています。
        </p>
      )}
    </aside>
  )
}
