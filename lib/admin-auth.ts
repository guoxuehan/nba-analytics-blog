import { cookies } from 'next/headers'

// ─── セッショントークン計算（Web Crypto / Node crypto 両対応） ─

export async function computeSessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + 'cv-admin-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Server Action / Route Handler 用の認証チェック ──────────

/** Server Action 内で呼ぶ。失敗時は例外を投げる */
export async function requireAdminAuth(): Promise<void> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const password = process.env.ADMIN_PASSWORD

  if (!password) throw new Error('ADMIN_PASSWORD not configured')

  const expected = await computeSessionToken(password)
  if (session !== expected) throw new Error('Unauthorized')
}

/** API Route 内で呼ぶ（Request オブジェクトから Cookie を読む） */
export async function verifyAdminRequest(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const sessionMatch = cookieHeader.match(/admin_session=([^;]+)/)
  const session = sessionMatch ? decodeURIComponent(sessionMatch[1]) : undefined

  const password = process.env.ADMIN_PASSWORD
  if (!password || !session) return false

  const expected = await computeSessionToken(password)
  return session === expected
}
