'use client'

import { useSyncExternalStore } from 'react'

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  )
}

function HatenaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M5.333 0A5.333 5.333 0 000 5.333v21.334A5.333 5.333 0 005.333 32h21.334A5.333 5.333 0 0032 26.667V5.333A5.333 5.333 0 0026.667 0H5.333zm12.584 6.974c1.68 0 3.04 1.36 3.04 3.04s-1.36 3.04-3.04 3.04a3.04 3.04 0 110-6.08zm-7.584.693h4.667v17.333H10.333V7.667zm7.624 5.11c2.307 0 4.176 1.077 4.176 3.89 0 2.126-1.213 3.344-2.867 3.755l3.2 4.578h-3.911l-2.8-4.178h-.711v4.178h-3.244v-12.01c.978-.19 2.756-.213 4.157-.213z" />
    </svg>
  )
}

type Props = {
  title: string
}

function getUrl() { return window.location.href }
function subscribe() { return () => {} }

export function ShareButtons({ title }: Props) {
  const url = useSyncExternalStore(subscribe, getUrl, () => '')

  if (!url) return null

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const xUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
  const hatenaUrl = `https://b.hatena.ne.jp/add?mode=confirm&url=${encodedUrl}&title=${encodedTitle}`

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-secondary font-heading mr-1"
      >
        Share
      </span>

      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Xでシェア"
        className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-white bg-[#000000] hover:bg-[#1a1a1a] transition-colors duration-150 rounded-[2px]"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
      >
        <XIcon />
        POST
      </a>

      <a
        href={hatenaUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="はてなブックマークに追加"
        className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-white bg-[#00A4DE] hover:bg-[#0090c8] transition-colors duration-150 rounded-[2px]"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
      >
        <HatenaIcon />
        BOOKMARK
      </a>
    </div>
  )
}
