import { NextRequest, NextResponse } from 'next/server'

async function computeSessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + 'cv-admin-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /admin/login はチェック不要
  if (pathname === '/admin/login') return NextResponse.next()

  const session = request.cookies.get('admin_session')?.value
  const password = process.env.ADMIN_PASSWORD

  if (!password || !session) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const expected = await computeSessionToken(password)
  if (session !== expected) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
