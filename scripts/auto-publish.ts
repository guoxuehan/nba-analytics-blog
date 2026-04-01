/**
 * 記事自動公開スクリプト
 * - articles-draft/ の .md ファイルを一括処理
 * - 品質チェック: 80点以上 → Supabase公開 / 80点未満 → needs-review/ に移動
 * - X投稿文を articles-draft/x-posts/ に保存
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { parseDraft } from './_parse-draft'
import { resolveThumbnail } from './_thumbnail'

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

  // 1. 文字数
  const charCount = body.length
  if (charCount >= 2000 && charCount <= 3000) score += 10
  else if ((charCount >= 1500 && charCount < 2000) || (charCount > 3000 && charCount <= 3500))
    score += 5

  // 2. タイトル文字数
  const titleLen = meta.title.length
  if (titleLen >= 30 && titleLen <= 40) score += 10
  else if ((titleLen >= 20 && titleLen < 30) || (titleLen > 40 && titleLen <= 50)) score += 5

  // 3. h2の数（3〜6個）
  const h2s = body.match(/^## .+$/gm) ?? []
  if (h2s.length >= 3 && h2s.length <= 6) score += 10

  // 4. 禁止ワード（-5点/個）
  for (const word of BANNED_WORDS) {
    score -= (body.split(word).length - 1) * 5
  }

  // 5. slug形式
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)) score += 10

  // 6. excerpt文字数（100〜150文字）
  const excerptLen = meta.excerpt.length
  if (excerptLen >= 100 && excerptLen <= 150) score += 10
  else if ((excerptLen >= 80 && excerptLen < 100) || (excerptLen > 150 && excerptLen <= 180))
    score += 5

  // 7. タグ数（5〜7個）
  if (meta.tags.length >= 5 && meta.tags.length <= 7) score += 10

  // 8. 一文の長さ（50文字超が20%以上で-10点）
  const sentences = body
    .replace(/^#+.+$/gm, '')
    .split(/[。！？]/)
    .map((s) => s.replace(/[\s\n]/g, ''))
    .filter((s) => s.length > 0)
  const longRatio =
    sentences.length > 0
      ? sentences.filter((s) => s.length > 50).length / sentences.length
      : 0
  if (longRatio >= 0.2) score -= 10

  // 9. リード文チェック
  const firstParagraph =
    body.split('\n').find((l) => l.trim().length > 0 && !l.startsWith('#')) ?? ''
  if (/を分析する|を検証する/.test(firstParagraph)) score -= 10

  // 10. 数字入りh2ボーナス（+5点/個）
  score += h2s.filter((h) => /[0-9０-９]/.test(h)).length * 5

  return score
}

// ─── X投稿文の抽出 ──────────────────────────────────────────────────
function extractXPost(content: string): string | null {
  const match = content.match(/---XPOST---\r?\n([\s\S]*?)\r?\n---XPOST---/)
  return match ? match[1].trim() : null
}

// ─── Main ────────────────────────────────────────────────────────────
export async function run(): Promise<{ published: number; needsReview: number; skipped: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が設定されていません')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  if (!fs.existsSync(DRAFT_DIR)) {
    console.log('articles-draft/ が存在しません')
    return { published: 0, needsReview: 0, skipped: 0 }
  }

  fs.mkdirSync(NEEDS_REVIEW_DIR, { recursive: true })
  fs.mkdirSync(XPOSTS_DIR, { recursive: true })

  // トップレベルの .md ファイルのみ対象
  const files = fs
    .readdirSync(DRAFT_DIR)
    .filter(
      (f) =>
        f.endsWith('.md') && fs.statSync(path.join(DRAFT_DIR, f)).isFile(),
    )

  if (files.length === 0) {
    console.log('処理対象の記事がありません')
    return { published: 0, needsReview: 0, skipped: 0 }
  }

  console.log(`\n処理対象: ${files.length}件`)
  console.log('─'.repeat(60))

  let published = 0
  let needsReview = 0
  let skipped = 0

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
    const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : 'C'
    console.log(`   スコア: ${score}点（${grade}）`)

    // X投稿文を保存
    const xpost = extractXPost(content)
    if (xpost) {
      const xpostPath = path.join(XPOSTS_DIR, `${meta.slug}-xpost.txt`)
      fs.writeFileSync(xpostPath, xpost, 'utf-8')
      console.log(`   X投稿文: x-posts/${meta.slug}-xpost.txt`)
    }

    // 80点未満 → needs-review/
    if (score < 80) {
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

    // サムネイル解決
    process.stdout.write('   サムネイル取得中...')
    const thumbnail = await resolveThumbnail(meta, meta.slug, supabase)
    console.log(` ${thumbnail.label}`)

    // Supabase INSERT
    const now = new Date().toISOString()
    const { error } = await supabase.from('articles').insert({
      title: meta.title,
      slug: meta.slug,
      category: meta.category,
      tags: meta.tags,
      excerpt: meta.excerpt || null,
      content: body,
      thumbnail_url: thumbnail.url ?? null,
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
    })

    if (error) {
      console.error(`   ❌ 公開失敗: ${error.message}`)
      if (error.message.includes('row-level security')) {
        console.error('   → Supabase の articles テーブル INSERT ポリシーを確認してください')
      }
      skipped++
      continue
    }

    console.log(`   ✅ 公開完了: https://sports-academia.com/articles/${meta.slug}`)
    published++
  }

  return { published, needsReview, skipped }
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
