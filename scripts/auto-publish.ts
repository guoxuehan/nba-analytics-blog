/**
 * 記事自動公開スクリプト
 * - articles-draft/ の .md ファイルを一括処理
 * - 品質チェック: 70点以上 → Supabase公開 / 70点未満 → needs-review/ に移動
 * - X投稿文を articles-draft/x-posts/ に保存
 * - 公開時刻を PUBLISH_INTERVAL_HOURS 時間ずつずらして一括 INSERT
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { parseDraft } from './_parse-draft'
import { resolveThumbnail } from './_thumbnail'
import type { DraftMeta } from './_parse-draft'
import type { ThumbnailResult } from './_thumbnail'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')
const NEEDS_REVIEW_DIR = path.join(DRAFT_DIR, 'needs-review')
const XPOSTS_DIR = path.join(DRAFT_DIR, 'x-posts')

const VALID_CATEGORIES = ['player_analysis', 'team_analysis', 'tactics', 'data']

// quality-check.ts と同じ禁止ワード
const BANNED_WORDS = [
  'と言っても過言ではない',
  '言うまでもなく',
  '非常に',
  'まさに',
  '改めて',
  'ご存知',
  'いわば',
]

// ─── 品質スコア計算（quality-check.ts と同じロジック）────────────────
function computeScore(filepath: string): number {
  const content = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(content)
  if (!parsed) return 0

  const { meta, body } = parsed
  let score = 0

  // 1. 文字数（15点/10点/5点）
  const charCount = body.length
  score +=
    charCount >= 2000 && charCount <= 3000 ? 15 :
    (charCount >= 1800 && charCount < 2000) || (charCount > 3000 && charCount <= 3500) ? 10 :
    (charCount >= 1500 && charCount < 1800) || (charCount > 3500 && charCount <= 4000) ?  5 : 0

  // 2. タイトル文字数（10点/5点）
  const titleLen = meta.title.length
  score +=
    titleLen >= 30 && titleLen <= 40 ? 10 :
    titleLen >= 25 && titleLen <= 45 ?  5 : 0

  // 3. h2の数（3〜6個で10点）
  const h2s = body.match(/^## .+$/gm) ?? []
  if (h2s.length >= 3 && h2s.length <= 6) score += 10

  // 4. 禁止ワード（基礎15点から1個あたり-3点）
  let bannedCount = 0
  for (const word of BANNED_WORDS) {
    bannedCount += body.split(word).length - 1
  }
  score += Math.max(0, 15 - bannedCount * 3)

  // 5. slug形式（5点）
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)) score += 5

  // 6. excerpt文字数（10点/5点）
  const excerptLen = meta.excerpt.length
  score +=
    excerptLen >= 100 && excerptLen <= 150 ? 10 :
    (excerptLen >= 80 && excerptLen < 100) || (excerptLen > 150 && excerptLen <= 180) ? 5 : 0

  // 7. タグ数（5〜7個で5点）
  if (meta.tags.length >= 5 && meta.tags.length <= 7) score += 5

  // 8. 一文の長さ（50文字超20%未満で5点）
  const sentences = body
    .replace(/^#+.+$/gm, '')
    .split(/[。！？]/)
    .map((s) => s.replace(/[\s\n]/g, ''))
    .filter((s) => s.length > 0)
  const longRatio =
    sentences.length > 0
      ? sentences.filter((s) => s.length > 50).length / sentences.length
      : 0
  if (longRatio < 0.2) score += 5

  // 9. リード文（10点）
  const firstParagraph =
    body.split('\n').find((l) => l.trim().length > 0 && !l.startsWith('#')) ?? ''
  if (!/を分析する|を検証する/.test(firstParagraph)) score += 10

  // 10. 数字入りh2ボーナス（+3点/個、最大15点）
  score += Math.min(h2s.filter((h) => /[0-9０-９]/.test(h)).length * 3, 15)

  return score
}

// ─── X投稿文の抽出 ──────────────────────────────────────────────────
function extractXPost(content: string): string | null {
  const match = content.match(/---XPOST---\r?\n([\s\S]*?)\r?\n---XPOST---/)
  return match ? match[1].trim() : null
}

// ─── JST 時刻文字列（HH:MM）──────────────────────────────────────────
function toJSTTime(date: Date): string {
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ─── 公開スケジュールのログ表示 ──────────────────────────────────────
function logSchedule(index: number, publishedAt: Date, intervalHours: number): void {
  const delayHours = index * intervalHours
  if (delayHours === 0) {
    console.log(`   📅 記事${index + 1}: 即時公開`)
  } else {
    console.log(
      `   📅 記事${index + 1}: ${delayHours}時間後に公開（${toJSTTime(publishedAt)} JST）`,
    )
  }
}

// ─── 公開キューのアイテム型 ──────────────────────────────────────────
type PublishItem = {
  meta: DraftMeta
  body: string
  thumbnail: ThumbnailResult
  filename: string
}

// ─── Main ────────────────────────────────────────────────────────────
export async function run(): Promise<{ published: number; needsReview: number; skipped: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が設定されていません')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const intervalHours = Math.max(
    1,
    parseInt(process.env.PUBLISH_INTERVAL_HOURS ?? '3', 10),
  )

  if (!fs.existsSync(DRAFT_DIR)) {
    console.log('articles-draft/ が存在しません')
    return { published: 0, needsReview: 0, skipped: 0 }
  }

  fs.mkdirSync(NEEDS_REVIEW_DIR, { recursive: true })
  fs.mkdirSync(XPOSTS_DIR, { recursive: true })

  // トップレベルの .md ファイルのみ対象
  const files = fs
    .readdirSync(DRAFT_DIR)
    .filter((f) => f.endsWith('.md') && fs.statSync(path.join(DRAFT_DIR, f)).isFile())

  if (files.length === 0) {
    console.log('処理対象の記事がありません')
    return { published: 0, needsReview: 0, skipped: 0 }
  }

  console.log(`\n処理対象: ${files.length}件`)
  console.log(`公開間隔: ${intervalHours}時間（PUBLISH_INTERVAL_HOURS）`)
  console.log('─'.repeat(60))

  let needsReview = 0
  let skipped = 0
  const publishQueue: PublishItem[] = []

  // ─── フェーズ1: スクリーニング ───────────────────────────────────
  console.log('\n【フェーズ1】品質チェック・スクリーニング')

  for (const file of files) {
    const filepath = path.join(DRAFT_DIR, file)
    const content = fs.readFileSync(filepath, 'utf-8')
    const parsed = parseDraft(content)

    console.log(`\n📄 ${file}`)

    if (!parsed) {
      console.log('   ⚠️  パース失敗 → スキップ')
      skipped++
      continue
    }

    const { meta, body } = parsed

    // 基本バリデーション
    if (!meta.title || !meta.slug || !meta.category || !body) {
      console.log('   ⚠️  必須フィールド不足 → スキップ')
      skipped++
      continue
    }

    if (!VALID_CATEGORIES.includes(meta.category)) {
      console.log(`   ⚠️  無効なカテゴリ「${meta.category}」 → スキップ`)
      skipped++
      continue
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)) {
      console.log(`   ⚠️  slug形式エラー「${meta.slug}」 → スキップ`)
      skipped++
      continue
    }

    // 品質チェック
    const score = computeScore(filepath)
    const grade =
      score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D'
    console.log(`   スコア: ${score}点（${grade}）`)

    // X投稿文を保存
    const xpost = extractXPost(content)
    if (xpost) {
      const xpostPath = path.join(XPOSTS_DIR, `${meta.slug}-xpost.txt`)
      fs.writeFileSync(xpostPath, xpost, 'utf-8')
      console.log(`   X投稿文: x-posts/${meta.slug}-xpost.txt`)
    }

    // 70点未満 → needs-review/
    if (score < 70) {
      const destPath = path.join(NEEDS_REVIEW_DIR, file)
      fs.renameSync(filepath, destPath)
      console.log(`   → needs-review/ に移動（${score}点）`)
      needsReview++
      continue
    }

    // slug重複チェック
    const { data: existing } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', meta.slug)
      .maybeSingle()

    if (existing) {
      console.log(`   ⚠️  slug「${meta.slug}」は既に公開済み → スキップ`)
      skipped++
      continue
    }

    console.log('   ✅ 公開キューに追加')
    publishQueue.push({ meta, body, thumbnail: { url: null, source: 'none', label: '' }, filename: file })
  }

  if (publishQueue.length === 0) {
    console.log('\n公開対象の記事がありません')
    return { published: 0, needsReview, skipped }
  }

  // ─── フェーズ2: サムネイル解決 ──────────────────────────────────
  console.log(`\n【フェーズ2】サムネイル取得（${publishQueue.length}件）`)

  for (const item of publishQueue) {
    process.stdout.write(`   ${item.meta.slug} ... `)
    item.thumbnail = await resolveThumbnail(item.meta, item.meta.slug, supabase)
    console.log(item.thumbnail.label)
  }

  // ─── フェーズ3: 公開時刻を割り当てて一括 INSERT ──────────────────
  console.log(`\n【フェーズ3】公開スケジュール設定・一括 INSERT`)

  const baseTime = new Date()
  const rows = publishQueue.map((item, index) => {
    const publishedAt = new Date(baseTime.getTime() + index * intervalHours * 60 * 60 * 1000)
    logSchedule(index, publishedAt, intervalHours)

    const now = new Date().toISOString()
    return {
      title: item.meta.title,
      slug: item.meta.slug,
      category: item.meta.category,
      tags: item.meta.tags,
      excerpt: item.meta.excerpt || null,
      content: item.body,
      thumbnail_url: item.thumbnail.url ?? null,
      published: true,
      published_at: publishedAt.toISOString(),
      created_at: now,
      updated_at: now,
    }
  })

  const { error } = await supabase.from('articles').insert(rows)

  if (error) {
    console.error(`\n❌ 一括 INSERT 失敗: ${error.message}`)
    if (error.message.includes('row-level security')) {
      console.error('   → Supabase の articles テーブル INSERT ポリシーを確認してください')
    }
    return { published: 0, needsReview, skipped: skipped + publishQueue.length }
  }

  console.log(`\n✅ ${rows.length}件を一括 INSERT 完了`)

  return { published: rows.length, needsReview, skipped }
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMain) {
  run()
    .then(({ published, needsReview, skipped }) => {
      console.log('\n' + '━'.repeat(60))
      console.log('  自動公開 完了')
      console.log('━'.repeat(60))
      console.log(
        `  公開: ${published}本 / レビュー待ち: ${needsReview}本 / スキップ: ${skipped}本`,
      )
      console.log('')
    })
    .catch((err) => {
      console.error('❌', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
