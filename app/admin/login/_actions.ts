'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { computeSessionToken } from '@/lib/admin-auth'

type LoginState = { error?: string } | null

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const submitted = formData.get('password') as string
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return { error: 'サーバー設定エラー：ADMIN_PASSWORD が未設定です' }
  }
  if (submitted !== adminPassword) {
    return { error: 'パスワードが違います' }
  }

  const token = await computeSessionToken(adminPassword)
  const cookieStore = await cookies()
  cookieStore.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7日間
    path: '/',
  })

  redirect('/admin/articles')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  redirect('/admin/login')
}
