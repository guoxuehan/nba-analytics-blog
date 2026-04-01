/**
 * 記事品質チェックスクリプト
 * 使用方法: npm run article:check [ファイルパス]
 *
 * 配点（100点満点 + ボーナス最大15点）
 * ─────────────────────────────────────
 * 基礎点（85点）
 *   文字数 2000〜3000文字  : 15点（1800〜1999文字は10点、1800未満は5点）
 *   タイトル 30〜40文字    : 10点（25〜45文字は5点）
 *   h2見出し 3〜6個        : 10点
 *   禁止ワードなし         : 15点（1個あたり-3点）
 *   slug形式OK             :  5点
 *   excerpt 100〜150文字   : 10点（80〜99文字は5点）
 *   タグ 5〜7個            :  5点
 *   一文の長さ             :  5点（50文字超が20%以上で0点）
 *   リード文OK             : 10点（メタ文で始まっていたら0点）
 * ボーナス（最大15点）
 *   数字入りh2             : +3点/個（上限15点）
 * ─────────────────────────────────────
 * 評価: S(90〜) A(80〜89) B(70〜79) C(60〜69) D(〜59)
 * 自動公開閾値: 70点以上
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

type CheckItem = {
  label: string
  points: number
  pass: boolean
  detail: string
}

type CheckResult = {
  score: number
  items: CheckItem[]
}

function checkArticle(filepath: string): CheckResult {
  const content = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(content)

  if (!parsed) {
    console.error('❌ フォーマットのパースに失敗しました。')
    console.error('   ---METADATA--- / ---BODY--- 形式か YAML frontmatter 形式で記述してください。')
    process.exit(1)
  }

  const { meta, body } = parsed
  const items: CheckItem[] = []
  let score = 0

  // ── 1. 文字数（15点 / 10点 / 5点）────────────────────────────────
  const charCount = body.length
  const charPoints =
    charCount >= 2000 && charCount <= 3000 ? 15 :
    charCount >= 1800 && charCount < 2000  ? 10 :
    charCount > 3000  && charCount <= 3500 ? 10 :
    charCount >= 1500 && charCount < 1800  ?  5 :
    charCount > 3500  && charCount <= 4000 ?  5 : 0
  score += charPoints
  items.push({
    label: '文字数',
    points: charPoints,
    pass: charPoints === 15,
    detail: `${charCount}文字（2000〜3000文字で15点）`,
  })

  // ── 2. タイトル文字数（10点 / 5点）──────────────────────────────
  const titleLen = meta.title.length
  const titlePoints =
    titleLen >= 30 && titleLen <= 40 ? 10 :
    titleLen >= 25 && titleLen <= 45 ?  5 : 0
  score += titlePoints
  items.push({
    label: 'タイトル文字数',
    points: titlePoints,
    pass: titlePoints === 10,
    detail: `"${meta.title}" （${titleLen}文字、30〜40文字で10点）`,
  })

  // ── 3. h2の数（3〜6個で10点）─────────────────────────────────────
  const h2s = body.match(/^## .+$/gm) ?? []
  const h2Count = h2s.length
  const h2Points = h2Count >= 3 && h2Count <= 6 ? 10 : 0
  score += h2Points
  items.push({
    label: 'h2見出し数',
    points: h2Points,
    pass: h2Points === 10,
    detail: `${h2Count}個（3〜6個で10点）`,
  })

  // ── 4. 禁止ワード（1個あたり-3点、基礎15点から減算）──────────────
  const bannedFound: string[] = []
  for (const word of BANNED_WORDS) {
    const count = body.split(word).length - 1
    for (let i = 0; i < count; i++) bannedFound.push(word)
  }
  const bannedDeduct = bannedFound.length * 3
  const bannedPoints = Math.max(0, 15 - bannedDeduct)
  score += bannedPoints
  items.push({
    label: '禁止ワード',
    points: bannedPoints,
    pass: bannedFound.length === 0,
    detail:
      bannedFound.length === 0
        ? 'なし（15点）'
        : `${bannedFound.map((w) => `「${w}」`).join(' ')} → ${15 - bannedPoints}点減点`,
  })

  // ── 5. slug形式（5点）────────────────────────────────────────────
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)
  const slugPoints = slugValid ? 5 : 0
  score += slugPoints
  items.push({
    label: 'slug形式',
    points: slugPoints,
    pass: slugValid,
    detail: `"${meta.slug}"${slugValid ? '' : ' → 英小文字・数字・ハイフンのみ使用可'}`,
  })

  // ── 6. excerpt文字数（10点 / 5点）────────────────────────────────
  const excerptLen = meta.excerpt.length
  const excerptPoints =
    excerptLen >= 100 && excerptLen <= 150 ? 10 :
    excerptLen >= 80  && excerptLen < 100  ?  5 :
    excerptLen > 150  && excerptLen <= 180 ?  5 : 0
  score += excerptPoints
  items.push({
    label: 'excerpt文字数',
    points: excerptPoints,
    pass: excerptPoints === 10,
    detail: `${excerptLen}文字（100〜150文字で10点）`,
  })

  // ── 7. タグ数（5〜7個で5点）──────────────────────────────────────
  const tagCount = meta.tags.length
  const tagPoints = tagCount >= 5 && tagCount <= 7 ? 5 : 0
  score += tagPoints
  items.push({
    label: 'タグ数',
    points: tagPoints,
    pass: tagPoints === 5,
    detail: `${tagCount}個（5〜7個で5点）: ${meta.tags.join(', ')}`,
  })

  // ── 8. 一文の長さ（50文字超20%未満で5点）────────────────────────
  const sentences = body
    .replace(/^#+.+$/gm, '')
    .split(/[。！？]/)
    .map((s) => s.replace(/[\s\n]/g, ''))
    .filter((s) => s.length > 0)
  const longRatio =
    sentences.length > 0
      ? sentences.filter((s) => s.length > 50).length / sentences.length
      : 0
  const longSentPoints = longRatio < 0.2 ? 5 : 0
  score += longSentPoints
  items.push({
    label: '一文の長さ',
    points: longSentPoints,
    pass: longSentPoints === 5,
    detail: `50文字超の文: ${Math.round(longRatio * 100)}%（20%未満で5点）`,
  })

  // ── 9. リード文（10点）───────────────────────────────────────────
  const firstParagraph =
    body.split('\n').find((line) => line.trim().length > 0 && !line.startsWith('#')) ?? ''
  const leadBad = /を分析する|を検証する/.test(firstParagraph)
  const leadPoints = leadBad ? 0 : 10
  score += leadPoints
  items.push({
    label: 'リード文',
    points: leadPoints,
    pass: !leadBad,
    detail: leadBad
      ? '「〜を分析する」「〜を検証する」で始まっています → 書き直してください'
      : 'OK（10点）',
  })

  // ── 10. 数字入りh2ボーナス（+3点/個、最大+15点）──────────────────
  const h2WithNum = h2s.filter((h) => /[0-9０-９]/.test(h))
  const numBonus = Math.min(h2WithNum.length * 3, 15)
  score += numBonus
  items.push({
    label: '数字入りh2（ボーナス）',
    points: numBonus,
    pass: h2WithNum.length > 0,
    detail:
      h2WithNum.length > 0
        ? `${h2WithNum.length}個 → +${numBonus}点`
        : '数字入りの見出しがありません',
  })

  // ── カテゴリ確認（採点対象外）────────────────────────────────────
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
    score >= 70 ? '🟡 B' :
    score >= 60 ? '⚠️  C' : '❌ D'

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
    const icon =
      item.label.includes('ボーナス') ? '⭐' :
      item.pass ? '✅' :
      item.points > 0 ? '🟡' : '❌'
    const pointStr =
      item.points > 0 ? `+${item.points}点` :
      item.points < 0 ? `${item.points}点` : '  0点'
    const label = item.label.padEnd(22)
    console.log(` ${icon} ${label} ${pointStr.padStart(5)}  ${item.detail}`)
  }

  console.log('─'.repeat(62))
  console.log(`\n  スコア: ${score}点  ${grade}`)
  console.log('')

  if (score >= 70) {
    console.log('✅ 投稿可能です（70点以上）')
    console.log(`   npm run article:publish ${arg}`)
  } else if (score >= 60) {
    console.log('⚠️  C評価（60〜69点）：要修正。上記の改善点を修正してから投稿してください。')
  } else {
    console.log('❌ D評価（60点未満）：大幅な書き直しが必要です。')
  }
  console.log('')
}

main()
