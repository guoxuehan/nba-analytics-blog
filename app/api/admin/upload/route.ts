import * as fs from 'fs'
import * as path from 'path'
import { verifyAdminRequest } from '@/lib/admin-auth'
import { optimizeImage } from '@/lib/image-optimizer'

// 保存先: public/images/thumbnails/
// 配信URL: /images/thumbnails/{filename}（Vercel CDN経由）
// 注意: Vercel本番環境ではファイルシステムに書き込めないため、
//       このエンドポイントはローカル開発環境専用です。
//       本番への反映はgit commit + pushが必要です。
const THUMBNAILS_DIR = path.join(process.cwd(), 'public', 'images', 'thumbnails')

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

  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const filePath = path.join(THUMBNAILS_DIR, baseName)

  const raw = await file.arrayBuffer()
  const optimized = await optimizeImage(raw)

  try {
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
    }
    fs.writeFileSync(filePath, optimized)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json(
      { error: `ファイル保存に失敗しました: ${msg}（Vercel本番では使用不可）` },
      { status: 500 },
    )
  }

  return Response.json({ url: `/images/thumbnails/${baseName}` })
}
