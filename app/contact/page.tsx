import type { Metadata } from 'next'
import { ContactForm } from './_components/ContactForm'

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: 'NBA COURT VISIONへのお問い合わせはこちらから。',
}

export default function ContactPage() {
  return (
    <div className="container-content py-12">
      <div style={{ maxWidth: '640px' }}>
        <div className="flex items-center gap-3 pb-3 border-b border-border mb-4">
          <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
          <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
            お問い合わせ
          </h1>
        </div>
        <p className="text-text-secondary font-body mb-8" style={{ fontSize: '14px', lineHeight: 1.7 }}>
          ご質問・ご意見・取材のご依頼など、お気軽にお問い合わせください。<br />
          内容を確認のうえ、折り返しご連絡いたします。
        </p>

        <ContactForm />
      </div>
    </div>
  )
}
