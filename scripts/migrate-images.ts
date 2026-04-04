/**
 * サムネイル移行スクリプト
 * Supabase Storage → public/images/thumbnails/
 *
 * 実行コマンド: npm run migrate:images
 *
 * 処理内容:
 * 1. Supabase Storage の post-images バケットから全画像をダウンロード
 * 2. public/images/thumbnails/ に保存
 * 3. articles テーブルの thumbnail_url を相対パスに更新
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const THUMBNAILS_DIR = path.resolve(process.cwd(), 'public/images/thumbnails')
const BUCKET = 'post-images'

// ─── 型 ──────────────────────────────────────────────────────────────

type Article = {
  id: string
  slug: string
  thumbnail_url: string | null
}

type StorageObject = {
  name: string
}

// ─── ユーティリティ ───────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
  }
}

function slugFromStorageKey(key: string): string {
  const basename = path.basename(key, path.extname(key))
  // articles/wembanyama-mvp-2026-thumbnail → wembanyama-mvp-2026
  return basename.replace(/-thumbnail$/, '')
}

function newFilename(slug: string): string {
  return `${slug}.jpg`
}

function newRelativePath(slug: string): string {
  return `/images/thumbnails/${newFilename(slug)}`
}

// ─── Supabase Storage から全ファイルリストを取得 ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listAllObjects(supabase: any): Promise<StorageObject[]> {
  const allObjects: StorageObject[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list('articles', {
      limit,
      offset,
    })
    if (error) throw new Error(`Storage list 失敗: ${error.message}`)
    if (!data || data.length === 0) break
    allObjects.push(...data)
    if (data.length < limit) break
    offset += limit
  }

  // ルート直下も確認
  const { data: rootData } = await supabase.storage.from(BUCKET).list('', { limit: 100 })
  if (rootData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = rootData.filter((o: any) => !o.name.endsWith('/') && o.name.includes('.'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allObjects.push(...files.map((o: any) => ({ name: o.name })))
  }

  return allObjects
}

// ─── 1ファイルをダウンロードして保存 ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function downloadAndSave(supabase: any, storageKey: string, outPath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(storageKey)
    if (error || !data) return false

    const buffer = Buffer.from(await data.arrayBuffer())
    fs.writeFileSync(outPath, buffer)
    return true
  } catch {
    return false
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL が設定されていません')
    process.exit(1)
  }

  const key = serviceRoleKey ?? anonKey
  if (!key) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_ANON_KEY が必要です')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, key)
  ensureDir()

  console.log('━'.repeat(60))
  console.log('  サムネイル移行: Supabase Storage → public/images/thumbnails/')
  console.log('━'.repeat(60))

  // ── Step1: articlesテーブルからthumbnail_urlを持つ記事を取得 ────────

  console.log('\n【Step1】記事テーブルから画像URLを取得中...')
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, slug, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .ilike('thumbnail_url', '%supabase%')

  if (articlesError) {
    console.error(`❌ 記事取得失敗: ${articlesError.message}`)
    process.exit(1)
  }

  const targets = (articles as Article[]).filter((a) => a.thumbnail_url)
  console.log(`  対象記事: ${targets.length}件`)

  if (targets.length === 0) {
    console.log('\n移行対象の記事がありません（すでに移行済みか、サムネイルなし）')
    return
  }

  // ── Step2: Storage から画像をダウンロード ──────────────────────────

  console.log('\n【Step2】画像をダウンロード・保存中...')

  let downloaded = 0
  let skipped = 0
  const urlMap = new Map<string, string>() // old URL → new relative path

  for (const article of targets) {
    const oldUrl = article.thumbnail_url!
    const slug = article.slug
    const outFilename = newFilename(slug)
    const outPath = path.join(THUMBNAILS_DIR, outFilename)
    const newPath = newRelativePath(slug)

    process.stdout.write(`  ${slug} ... `)

    // すでに移行済みならスキップ
    if (fs.existsSync(outPath)) {
      console.log('スキップ（既存）')
      urlMap.set(oldUrl, newPath)
      skipped++
      continue
    }

    // Supabase StorageのURLからstorageキーを抽出
    // 例: https://xxx.supabase.co/storage/v1/object/public/post-images/articles/slug-thumbnail.jpg
    const match = oldUrl.match(/\/storage\/v1\/object\/public\/post-images\/(.+)$/)
    if (!match) {
      console.log('⚠️  URLパターン不一致 → スキップ')
      skipped++
      continue
    }

    const storageKey = decodeURIComponent(match[1])
    const ok = await downloadAndSave(supabase, storageKey, outPath)

    if (ok) {
      console.log(`✅ → ${outFilename}`)
      urlMap.set(oldUrl, newPath)
      downloaded++
    } else {
      console.log('❌ ダウンロード失敗')
      skipped++
    }
  }

  console.log(`\n  ダウンロード: ${downloaded}件 / スキップ: ${skipped}件`)

  // ── Step3: articlesテーブルのthumbnail_urlを更新 ──────────────────

  console.log('\n【Step3】DBのthumbnail_urlを更新中...')

  let updated = 0
  let failed = 0

  for (const article of targets) {
    const oldUrl = article.thumbnail_url!
    const newPath = urlMap.get(oldUrl)
    if (!newPath) continue

    const { error } = await supabase
      .from('articles')
      .update({ thumbnail_url: newPath, updated_at: new Date().toISOString() })
      .eq('id', article.id)

    if (error) {
      console.log(`  ❌ ${article.slug}: ${error.message}`)
      failed++
    } else {
      console.log(`  ✅ ${article.slug}: ${oldUrl.slice(0, 40)}... → ${newPath}`)
      updated++
    }
  }

  // ── 完了サマリー ──────────────────────────────────────────────────

  console.log('\n' + '━'.repeat(60))
  console.log('  移行完了')
  console.log('━'.repeat(60))
  console.log(`  ダウンロード: ${downloaded}件`)
  console.log(`  DB更新成功 : ${updated}件`)
  console.log(`  失敗/スキップ: ${failed + skipped}件`)
  console.log('')
  console.log('次のステップ:')
  console.log('  git add public/images/thumbnails/')
  console.log('  git commit -m "Migrate: thumbnails from Supabase Storage to public/"')
  console.log('  git push')
  console.log('')
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
