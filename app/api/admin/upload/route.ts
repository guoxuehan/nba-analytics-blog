import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { optimizeImage } from '@/lib/image-optimizer'

// 管理画面からのアップロードはSupabase Storageに保存
// （Vercel本番ではファイルシステムに書き込めないため）
// 自動パイプライン（GitHub Actions）はpublic/images/thumbnails/に保存
const BUCKET = 'post-images'

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request)
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || !file.type.startsWith('image/')) {
    return Response.json({ error: '画像ファイルが必要です' }, { status: 400 })
  }

  const fileName = `thumbnails/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

  const raw = await file.arrayBuffer()
  const optimized = await optimizeImage(raw)
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, optimized, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(fileName)

  return Response.json({ url: publicUrl })
}
