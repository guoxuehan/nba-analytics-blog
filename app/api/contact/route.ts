import { getSupabase } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; subject?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const { name, email, subject, message } = body

  if (!name?.trim()) return Response.json({ error: '名前を入力してください' }, { status: 400 })
  if (!email?.trim()) return Response.json({ error: 'メールアドレスを入力してください' }, { status: 400 })
  if (!subject?.trim()) return Response.json({ error: '件名を入力してください' }, { status: 400 })
  if (!message?.trim()) return Response.json({ error: '本文を入力してください' }, { status: 400 })

  const { error } = await getSupabase().from('contacts').insert({
    name: name.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true }, { status: 201 })
}
