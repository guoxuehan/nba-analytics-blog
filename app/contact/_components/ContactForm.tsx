'use client'

import { useState, useTransition } from 'react'

const inputClass = [
  'w-full bg-bg-secondary border border-border text-text-primary font-body',
  'focus:outline-none focus:border-accent transition-colors duration-150',
].join(' ')
const inputStyle = { padding: '10px 12px', fontSize: '15px', borderRadius: '2px' }

const labelClass = 'block font-heading font-bold text-text-secondary uppercase mb-1'
const labelStyle = { fontSize: '11px', letterSpacing: '0.08em' }

export function ContactForm() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError]     = useState('')
  const [sent, setSent]       = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '送信に失敗しました'); return }
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div
        className="border border-border bg-bg-secondary"
        style={{ padding: '2rem', borderRadius: '2px', textAlign: 'center' }}
      >
        <p className="font-heading font-bold text-text-primary" style={{ fontSize: '16px', marginBottom: '0.5rem' }}>
          送信完了しました
        </p>
        <p className="text-text-secondary font-body" style={{ fontSize: '14px' }}>
          お問い合わせありがとうございます。内容を確認のうえ、ご返信いたします。
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="cf-name">お名前 *</label>
        <input
          id="cf-name" type="text" required maxLength={100}
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="山田 太郎"
          className={inputClass} style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="cf-email">メールアドレス *</label>
        <input
          id="cf-email" type="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          className={inputClass} style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="cf-subject">件名 *</label>
        <input
          id="cf-subject" type="text" required maxLength={200}
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="お問い合わせの件名"
          className={inputClass} style={inputStyle}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="cf-message">本文 *</label>
        <textarea
          id="cf-message" required maxLength={5000} rows={6}
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="お問い合わせ内容をご記入ください"
          className={`${inputClass} resize-y`}
          style={{ ...inputStyle, minHeight: '140px' }}
        />
      </div>

      {error && (
        <p className="font-body text-[13px]" style={{ color: 'var(--accent)' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start font-heading font-bold uppercase transition-opacity duration-150"
        style={{
          background: 'var(--accent)', color: '#fff',
          padding: '10px 24px', fontSize: '12px', letterSpacing: '0.08em',
          borderRadius: '2px', border: 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? '送信中...' : '送信する'}
      </button>
    </form>
  )
}
