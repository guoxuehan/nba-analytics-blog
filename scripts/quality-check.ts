/**
 * 記事品質チェックスクリプト
 * 使用方法: npm run article:check [ファイルパス]
 */
import * as fs from 'fs'
import * as path from 'path'
import { parseDraft } from './_parse-draft'

const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')

const BANNED_WORDS = [
  'と言っても過言ではない',
  '言うまでもなく',
  '非常に',
  'まさに',
  '改めて',
  'ご存知',
  'いわば',
]

const VALID_CATEGORIES = ['player_analysis', 'team_analysis', 'tactics', 'data']

type CheckResult = {
  score: number
  items: { label: string; points: number; pass: boolean; detail: string }[]
}

function checkArticle(filepath: string): CheckResult {
  const content = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(content)

  if (!parsed) {
    console.error('❌ フォーマットのパースに失敗しました。')
    console.error('   ---METADATA--- / ---BODY--- ブロック形式か、YAML frontmatter 形式で記述してください。')
    process.exit(1)
  }

  const { meta, body } = parsed
  const items: CheckResult['items'] = []
  let score = 0

  // ── 1. 文字数チェック（2000〜3000文字で10点）──────────────────
  const charCount = body.length
  const charPass = charCount >= 2000 && charCount <= 3000
  const charPartial = (charCount >= 1500 && charCount < 2000) || (charCount > 3000 && charCount <= 3500)
  const charPoints = charPass ? 10 : charPartial ? 5 : 0
  score += charPoints
  items.push({
    label: '文字数',
    points: charPoints,
    pass: charPass,
    detail: `${charCount}文字（2000〜3000文字推奨）`,
  })

  // ── 2. タイトル文字数（30〜40文字で10点）──────────────────────
  const titleLen = meta.title.length
  const titlePass = titleLen >= 30 && titleLen <= 40
  const titlePartial = (titleLen >= 20 && titleLen < 30) || (titleLen > 40 && titleLen <= 50)
  const titlePoints = titlePass ? 10 : titlePartial ? 5 : 0
  score += titlePoints
  items.push({
    label: 'タイトル文字数',
    points: titlePoints,
    pass: titlePass,
    detail: `"${meta.title}" （${titleLen}文字、30〜40文字推奨）`,
  })

  // ── 3. h2の数（3〜6個で10点）─────────────────────────────────
  const h2s = body.match(/^## .+$/gm) ?? []
  const h2Count = h2s.length
  const h2Pass = h2Count >= 3 && h2Count <= 6
  const h2Points = h2Pass ? 10 : 0
  score += h2Points
  items.push({
    label: 'h2見出し数',
    points: h2Points,
    pass: h2Pass,
    detail: `${h2Count}個（3〜6個推奨）`,
  })

  // ── 4. 禁止ワードチェック（-5点/個）─────────────────────────
  const bannedFound: string[] = []
  for (const word of BANNED_WORDS) {
    const count = body.split(word).length - 1
    for (let i = 0; i < count; i++) bannedFound.push(word)
  }
  const bannedDeduct = bannedFound.length * 5
  score -= bannedDeduct
  if (bannedFound.length > 0) {
    items.push({
      label: '禁止ワード',
      points: -bannedDeduct,
      pass: false,
      detail: bannedFound.map((w) => `「${w}」`).join(' '),
    })
  } else {
    items.push({ label: '禁止ワード', points: 0, pass: true, detail: 'なし' })
  }

  // ── 5. slug形式（英語ハイフン区切りで10点）───────────────────
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)
  const slugPoints = slugValid ? 10 : 0
  score += slugPoints
  items.push({
    label: 'slug形式',
    points: slugPoints,
    pass: slugValid,
    detail: `"${meta.slug}"${slugValid ? '' : ' → 英小文字・数字・ハイフンのみ使用可'}`,
  })

  // ── 6. excerpt文字数（100〜150文字で10点）────────────────────
  const excerptLen = meta.excerpt.length
  const excerptPass = excerptLen >= 100 && excerptLen <= 150
  const excerptPartial = (excerptLen >= 80 && excerptLen < 100) || (excerptLen > 150 && excerptLen <= 180)
  const excerptPoints = excerptPass ? 10 : excerptPartial ? 5 : 0
  score += excerptPoints
  items.push({
    label: 'excerpt文字数',
    points: excerptPoints,
    pass: excerptPass,
    detail: `${excerptLen}文字（100〜150文字推奨）`,
  })

  // ── 7. タグ数（5〜7個で10点）─────────────────────────────────
  const tagCount = meta.tags.length
  const tagPass = tagCount >= 5 && tagCount <= 7
  const tagPoints = tagPass ? 10 : 0
  score += tagPoints
  items.push({
    label: 'タグ数',
    points: tagPoints,
    pass: tagPass,
    detail: `${tagCount}個（5〜7個推奨）: ${meta.tags.join(', ')}`,
  })

  // ── 8. 一文の長さチェック（50文字超が20%以上で-10点）─────────
  const sentences = body
    .replace(/^#+.+$/gm, '') // 見出しを除外
    .split(/[。！？]/)
    .map((s) => s.replace(/[\s\n]/g, ''))
    .filter((s) => s.length > 0)
  const longSentences = sentences.filter((s) => s.length > 50)
  const longRatio = sentences.length > 0 ? longSentences.length / sentences.length : 0
  const longSentDeduct = longRatio >= 0.2 ? 10 : 0
  score -= longSentDeduct
  items.push({
    label: '一文の長さ',
    points: -longSentDeduct,
    pass: longRatio < 0.2,
    detail: `50文字超の文: ${Math.round(longRatio * 100)}%（20%未満推奨）`,
  })

  // ── 9. リード文チェック（「〜を分析する/検証する」始まりで-10点）──
  const firstParagraph = body
    .split('\n')
    .find((line) => line.trim().length > 0 && !line.startsWith('#')) ?? ''
  const leadBad = /を分析する|を検証する/.test(firstParagraph)
  const leadDeduct = leadBad ? 10 : 0
  score -= leadDeduct
  items.push({
    label: 'リード文',
    points: -leadDeduct,
    pass: !leadBad,
    detail: leadBad
      ? '「〜を分析する」「〜を検証する」で始まっています → 書き直してください'
      : 'OK',
  })

  // ── 10. h2に数字が含まれていれば+5点/個（ボーナス）─────────────
  const h2WithNum = h2s.filter((h) => /[0-9０-９]/.test(h))
  const numBonus = h2WithNum.length * 5
  score += numBonus
  items.push({
    label: '数字入りh2（ボーナス）',
    points: numBonus,
    pass: h2WithNum.length > 0,
    detail: h2WithNum.length > 0
      ? `${h2WithNum.length}個 → +${numBonus}点`
      : '数字入りの見出しがありません',
  })

  // ── カテゴリ確認 ────────────────────────────────────────────
  if (!VALID_CATEGORIES.includes(meta.category)) {
    items.push({
      label: 'カテゴリ',
      points: 0,
      pass: false,
      detail: `"${meta.category}" は無効です。有効値: ${VALID_CATEGORIES.join(', ')}`,
    })
  }

  return { score, items }
}

function listDrafts(): string[] {
  if (!fs.existsSync(DRAFT_DIR)) return []
  return fs.readdirSync(DRAFT_DIR).filter((f) => f.endsWith('.md'))
}

function main() {
  const arg = process.argv[2]

  if (!arg) {
    const files = listDrafts()
    if (files.length === 0) {
      console.log('articles-draft/ に .md ファイルがありません')
      process.exit(0)
    }
    console.log('\n📋 チェック可能なドラフト:')
    files.forEach((f, i) => console.log(`  [${i + 1}] articles-draft/${f}`))
    console.log('\n使用方法: npm run article:check articles-draft/<ファイル名>.md')
    process.exit(0)
  }

  const filepath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg)
  if (!fs.existsSync(filepath)) {
    console.error(`ファイルが見つかりません: ${arg}`)
    process.exit(1)
  }

  const content = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(content)
  if (!parsed) {
    console.error('❌ フォーマットのパースに失敗しました')
    process.exit(1)
  }

  const { score, items } = checkArticle(filepath)
  const grade =
    score >= 90 ? '🏆 S' :
    score >= 80 ? '✅ A' :
    score >= 70 ? '⚠️  B' : '❌ C'

  console.log('\n' + '═'.repeat(62))
  console.log('  NBA COURT VISION ─ 記事品質チェック')
  console.log('═'.repeat(62))
  console.log(`\nファイル : ${path.basename(filepath)}`)
  console.log(`タイトル : ${parsed.meta.title}`)
  console.log(`slug     : ${parsed.meta.slug}`)
  console.log(`カテゴリ : ${parsed.meta.category}`)
  console.log('')
  console.log('─'.repeat(62))
  console.log(' チェック項目                  点数  詳細')
  console.log('─'.repeat(62))

  for (const item of items) {
    const icon = item.pass ? '✅' : item.points < 0 ? '❌' : '⚠️ '
    const pointStr =
      item.points > 0 ? `+${item.points}点` :
      item.points < 0 ? `${item.points}点` : '±0点'
    const label = item.label.padEnd(22)
    console.log(` ${icon} ${label} ${pointStr.padStart(5)}  ${item.detail}`)
  }

  console.log('─'.repeat(62))
  console.log(`\n  スコア: ${score}点  ${grade}`)
  console.log('')

  if (score >= 80) {
    console.log('✅ 投稿可能です。')
    console.log(`   npm run article:publish ${arg}`)
  } else {
    console.log('⚠️  スコアが80点未満です。上記の改善点を修正してから投稿してください。')
  }
  console.log('')
}

main()
