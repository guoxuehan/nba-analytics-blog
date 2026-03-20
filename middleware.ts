import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Web Crypto API（Edge Runtime 対応）でセッショントークンを計算
async function computeToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + 'cv-admin-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()

  const isLoginPage = pathname === '/admin/login'
  const session = request.cookies.get('admin_session')?.value
  const adminPassword = process.env.ADMIN_PASSWORD

  // ADMIN_PASSWORD 未設定時はログインページのみ許可
  if (!adminPassword) {
    if (isLoginPage) return NextResponse.next()
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const expectedToken = await computeToken(adminPassword)
  const isAuthenticated = session === expectedToken

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/admin/articles', request.url))
  }
  if (!isLoginPage && !isAuthenticated) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
