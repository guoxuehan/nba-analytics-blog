/**
 * 記事投稿スクリプト
 * 使用方法: npm run article:publish [ファイルパス]
 */
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { parseDraft } from './_parse-draft'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')
const SITE_URL = 'https://sports-academia.com'
const VALID_CATEGORIES = ['player_analysis', 'team_analysis', 'tactics', 'data']

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function selectFile(): Promise<string> {
  if (!fs.existsSync(DRAFT_DIR)) {
    console.error('articles-draft/ ディレクトリが存在しません')
    process.exit(1)
  }
  const files = fs.readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    console.error('articles-draft/ に .md ファイルがありません')
    process.exit(1)
  }
  if (files.length === 1) {
    console.log(`📄 ファイル: articles-draft/${files[0]}`)
    return path.join(DRAFT_DIR, files[0])
  }

  console.log('\n📋 投稿するファイルを選択してください:')
  files.forEach((f, i) => console.log(`  [${i + 1}] ${f}`))
  const input = await ask('\n番号を入力: ')
  const idx = parseInt(input, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= files.length) {
    console.error('無効な番号です')
    process.exit(1)
  }
  return path.join(DRAFT_DIR, files[idx])
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('❌ Supabase環境変数が設定されていません')
    console.error('   .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  // ── ファイルの特定 ───────────────────────────────────────────
  let filepath: string
  const arg = process.argv[2]
  if (arg) {
    filepath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg)
    if (!fs.existsSync(filepath)) {
      console.error(`ファイルが見つかりません: ${arg}`)
      process.exit(1)
    }
  } else {
    filepath = await selectFile()
  }

  // ── パース ──────────────────────────────────────────────────
  const content = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(content)

  if (!parsed) {
    console.error('❌ フォーマットのパースに失敗しました')
    console.error('   ---METADATA--- / ---BODY--- 形式か YAML frontmatter 形式で記述してください')
    process.exit(1)
  }

  const { meta, body } = parsed

  // ── バリデーション ──────────────────────────────────────────
  const missing: string[] = []
  if (!meta.title) missing.push('title')
  if (!meta.slug) missing.push('slug')
  if (!meta.category) missing.push('category')
  if (!body) missing.push('本文(BODY)')
  if (missing.length > 0) {
    console.error(`❌ 必須フィールドがありません: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (!VALID_CATEGORIES.includes(meta.category)) {
    console.error(`❌ 無効なカテゴリ「${meta.category}」`)
    console.error(`   有効な値: ${VALID_CATEGORIES.join(', ')}`)
    process.exit(1)
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)) {
    console.error(`❌ slug「${meta.slug}」が不正な形式です`)
    console.error('   英小文字・数字・ハイフンのみ使用可（例: nba-playoff-preview-2026）')
    process.exit(1)
  }

  // ── slug 重複チェック ────────────────────────────────────────
  const { data: existing } = await supabase
    .from('articles')
    .select('id')
    .eq('slug', meta.slug)
    .maybeSingle()

  if (existing) {
    console.error(`❌ slug「${meta.slug}」はすでに存在します`)
    process.exit(1)
  }

  // ── 内容確認 ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('  投稿内容の確認')
  console.log('═'.repeat(60))
  console.log(`\nタイトル   : ${meta.title}`)
  console.log(`slug       : ${meta.slug}`)
  console.log(`カテゴリ   : ${meta.category}`)
  console.log(`タグ       : ${meta.tags.join(', ') || '（なし）'}`)
  console.log(`文字数     : ${body.length}文字`)
  console.log(`excerpt    : ${meta.excerpt || '（なし）'}`)
  console.log(`\n公開後URL  : ${SITE_URL}/articles/${meta.slug}`)
  console.log('')

  const answer = await ask('Supabaseに投稿しますか？ (y/n): ')
  if (answer.toLowerCase() !== 'y') {
    console.log('\n投稿をキャンセルしました')
    process.exit(0)
  }

  // ── INSERT ──────────────────────────────────────────────────
  console.log('\n投稿中...')
  const now = new Date().toISOString()

  const { error } = await supabase.from('articles').insert({
    title: meta.title,
    slug: meta.slug,
    category: meta.category,
    tags: meta.tags,
    excerpt: meta.excerpt || null,
    content: body,
    thumbnail_url: null,
    published: true,
    published_at: now,
    created_at: now,
    updated_at: now,
  })

  if (error) {
    console.error(`\n❌ 投稿に失敗しました: ${error.message}`)
    if (error.message.includes('row-level security')) {
      console.error('   RLSポリシーにより書き込みが拒否されました。')
      console.error('   Supabaseダッシュボードで articles テーブルの INSERT ポリシーを確認してください。')
    }
    process.exit(1)
  }

  console.log('\n✅ 投稿完了！')
  console.log(`\n🔗 ${SITE_URL}/articles/${meta.slug}`)
  console.log('')
}

main().catch((err: unknown) => {
  console.error('エラー:', err instanceof Error ? err.message : err)
  process.exit(1)
})
