import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import { Providers } from './providers'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { PageTransition } from './components/PageTransition'
import './globals.css'
import { SITE_URL } from '@/lib/constants'

// フォントはすべてリポジトリに同梱して読み込む。
// Google Fonts からビルド時に取得すると、CI で取得に失敗してビルドが落ちることがあったため
// （"next/font/google queries have exactly one entry"）

// 見出し: ESPN風コンデンスド書体（可変フォント、latin, 400〜700）
const oswald = localFont({
  src: './fonts/oswald-latin.woff2',
  weight: '400 700',
  variable: '--font-oswald',
  display: 'swap',
})

// 本文: エディトリアルな可読性重視（可変フォント、latin, 300〜700）
const sourceSans = localFont({
  src: './fonts/source-sans-3-latin.woff2',
  weight: '300 700',
  variable: '--font-source-sans',
  display: 'swap',
})

// 日本語は globals.css の 'Noto Sans JP'（インストール済みなら使う）→ OS 標準の sans-serif で表示する。
// 以前は next/font/google で Noto Sans JP を読み込んでいたが、next/font は別名で登録するため
// CSS の 'Noto Sans JP' 指定とは一致せず、実際には使われていなかった

export const metadata: Metadata = {
  title: {
    template: '%s | NBA COURT VISION',
    default: 'NBA COURT VISION — NBAアナリティクス',
  },
  description: 'NBAの高度なアナリティクス、選手分析、戦術解説',
  openGraph: {
    siteName: 'NBA COURT VISION',
    title: 'NBA COURT VISION — NBAアナリティクス',
    description: 'NBAの高度なアナリティクス、選手分析、戦術解説',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NBA COURT VISION — NBAアナリティクス',
    description: 'NBAの高度なアナリティクス、選手分析、戦術解説',
  },
  // RSS リーダーやブラウザがフィードを見つけられるようにする
  alternates: {
    types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
  },
  verification: {
    google: '41G1SRV6dpQhDMJROIpMiBCojflXM9voDPxaB75Qock',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${oswald.variable} ${sourceSans.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-bg text-text-primary font-body antialiased">
        <Providers>
          <Header />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </Providers>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
