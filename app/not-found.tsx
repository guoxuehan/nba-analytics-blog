import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container-content section-gap flex flex-col items-center justify-center text-center min-h-[60vh]">
      <p
        className="font-heading font-bold text-accent uppercase"
        style={{ fontSize: '11px', letterSpacing: '0.15em' }}
      >
        404
      </p>
      <h1
        className="font-heading font-bold text-text-primary uppercase mt-3"
        style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-0.02em', lineHeight: '1.1' }}
      >
        ページが見つかりません
      </h1>
      <p className="text-text-secondary font-body mt-4" style={{ fontSize: '15px' }}>
        お探しのページは削除されたか、URLが変更された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 font-heading font-bold text-[12px] uppercase tracking-[0.08em] text-white bg-accent hover:opacity-90 transition-opacity"
        style={{ borderRadius: '2px' }}
      >
        ← トップへ戻る
      </Link>
    </main>
  )
}
