'use client'

import { useActionState } from 'react'
import { loginAction } from './_actions'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f0f0',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #ddd',
        borderTop: '3px solid #D32F2F',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '360px',
      }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '1.5rem', color: '#111' }}>
          NBA COURT VISION ADMIN
        </h1>

        <form action={action}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            パスワード
          </label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '2px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {state?.error && (
            <p style={{ color: '#D32F2F', fontSize: '13px', marginTop: '8px' }}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '9px',
              background: isPending ? '#999' : '#D32F2F',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '2px',
              cursor: isPending ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {isPending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
