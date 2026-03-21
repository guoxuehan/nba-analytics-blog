import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/admin-auth'

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

  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `thumbnails/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = await file.arrayBuffer()
  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, new Uint8Array(buffer), {
      contentType: file.type,
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
