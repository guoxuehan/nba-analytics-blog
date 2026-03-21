import type { Metadata } from 'next'
import { Oswald, Source_Sans_3, Noto_Sans_JP } from 'next/font/google'
import { Providers } from './providers'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { PageTransition } from './components/PageTransition'
import './globals.css'

// 見出し: ESPN風コンデンスド書体
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

// 本文: エディトリアルな可読性重視
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
})

// 日本語フォールバック
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | NBA COURT VISION',
    default: 'NBA COURT VISION — NBAアナリティクス',
  },
  description: 'NBAの高度なアナリティクス、選手分析、戦術解説',
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
      className={`${oswald.variable} ${sourceSans.variable} ${notoSansJP.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-bg text-text-primary font-body antialiased">
        <Providers>
          <Header />
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
