import { getSupabase } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// ─── IP別レート制限（メモリ内、1分間に1投稿まで） ────────────
// NOTE: 現状はインメモリ実装のため、サーバー再起動や
//       Vercel のサーバーレス複数インスタンス環境では制限が無効化される。
// TODO: 将来的には Supabase テーブル（rate_limits）や Upstash Redis を使用して
//       永続的なレート制限を実装する。

const rateLimitMap = new Map<string, number>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip)
  const now = Date.now()
  if (last && now - last < 60_000) return true
  rateLimitMap.set(ip, now)
  return false
}

// ─── GET: 記事のコメント一覧 ──────────────────────────────────

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId')
  if (!articleId) {
    return Response.json({ error: 'articleId が必要です' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('comments')
    .select('id, author_name, content, created_at')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ comments: data ?? [] })
}

// ─── POST: コメント投稿 ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return Response.json(
      { error: '投稿が連続しています。1分後にお試しください。' },
      { status: 429 },
    )
  }

  let body: { articleId?: string; authorName?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const { articleId, authorName, content } = body

  if (!articleId || typeof articleId !== 'string') {
    return Response.json({ error: 'articleId が必要です' }, { status: 400 })
  }
  if (!authorName || typeof authorName !== 'string' || authorName.trim().length === 0) {
    return Response.json({ error: '名前を入力してください' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return Response.json({ error: 'コメントを入力してください' }, { status: 400 })
  }
  if (authorName.trim().length > 100) {
    return Response.json({ error: '名前は100文字以内で入力してください' }, { status: 400 })
  }
  if (content.trim().length > 2000) {
    return Response.json({ error: 'コメントは2000文字以内で入力してください' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('comments')
    .insert({
      article_id: articleId,
      author_name: authorName.trim(),
      content: content.trim(),
    })
    .select('id, author_name, content, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ comment: data }, { status: 201 })
}
