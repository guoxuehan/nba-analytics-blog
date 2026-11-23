/**
 * 編集部エージェント共通ライブラリ
 * - GitHub 操作（gh CLI）
 * - 職務記述書（.claude/agents/*.md）の読み込み
 * - Claude API の構造化出力呼び出し
 * - 記事ファイル（content/articles/*.md）の読み書き
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execFileSync } from 'child_process'
import * as dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { recordUsage } from '../auto-generate'
import { parseDraft } from '../_parse-draft'
import type { DraftMeta } from '../_parse-draft'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

export const ROOT = process.cwd()
export const ARTICLES_DIR = path.join(ROOT, 'content', 'articles')
export const NOTES_DIR = path.join(ROOT, 'content', 'notes')
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sports-academia.com').replace(/\/$/, '')

/** 1日に採用・執筆する記事の上限 */
export const DAILY_ARTICLE_COUNT = Math.max(1, parseInt(process.env.DAILY_ARTICLE_COUNT ?? '3', 10))
/** 自動マージに必要な品質スコア */
export const QUALITY_THRESHOLD = parseInt(process.env.QUALITY_THRESHOLD ?? '70', 10)

// ─── ラベル（＝部署・ステータス）─────────────────────────────────────
export const LABELS = {
  pitch: '企画:候補',
  approved: '企画:採用',
  rejected: '企画:不採用',
  written: '企画:執筆済',
  manuscript: '入稿',
  reviewOk: '校閲:OK',
  reviewNg: '校閲:要修正',
  needsHuman: '要確認',
  hold: '保留',
  promo: 'マーケ:配信待ち',
} as const

const LABEL_DEFS: { name: string; color: string; description: string }[] = [
  { name: LABELS.pitch, color: 'fbca04', description: '記者・社長が出した企画候補（編集長の審査待ち）' },
  { name: LABELS.approved, color: '0e8a16', description: '編集長が採用した企画（ライターが執筆する）' },
  { name: LABELS.rejected, color: 'cfd3d7', description: '編集長が不採用にした企画' },
  { name: LABELS.written, color: '1d76db', description: '執筆済み（PRで入稿済み）' },
  { name: LABELS.manuscript, color: '5319e7', description: 'ライターが入稿した記事PR' },
  { name: LABELS.reviewOk, color: '0e8a16', description: '校閲デスクが公開OKと判定' },
  { name: LABELS.reviewNg, color: 'd93f0b', description: '校閲デスクが修正・確認が必要と判定' },
  { name: LABELS.needsHuman, color: 'b60205', description: '人間（社長）の判断が必要' },
  { name: LABELS.hold, color: '000000', description: 'このラベルがあるPRは自動マージしない' },
  { name: LABELS.promo, color: 'c5def5', description: 'マーケ担当が作った配信案（投稿待ち）' },
]

// ─── GitHub（gh CLI）──────────────────────────────────────────────────
export function gh(args: string[], input?: string): string {
  return execFileSync('gh', args, {
    encoding: 'utf-8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
  }).trim()
}

export function ghJson<T>(args: string[]): T {
  return JSON.parse(gh(args)) as T
}

export function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
}

export function ensureLabels(): void {
  for (const l of LABEL_DEFS) {
    gh(['label', 'create', l.name, '--color', l.color, '--description', l.description, '--force'])
  }
}

/** 長い本文はコマンドライン引数ではなく一時ファイルで渡す */
export function withBodyFile<T>(body: string, fn: (file: string) => T): T {
  const dir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'newsroom-'))
  const file = path.join(dir, 'body.md')
  fs.writeFileSync(file, body, 'utf-8')
  try {
    return fn(file)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function createIssue(title: string, body: string, labels: string[]): number {
  const url = withBodyFile(body, (file) =>
    gh(['issue', 'create', '--title', title, '--body-file', file, ...labels.flatMap((l) => ['--label', l])]),
  )
  return parseInt(url.split('/').pop() ?? '0', 10)
}

export function commentIssue(num: number, body: string): void {
  withBodyFile(body, (file) => gh(['issue', 'comment', String(num), '--body-file', file]))
}

export function commentPr(num: number, body: string): void {
  withBodyFile(body, (file) => gh(['pr', 'comment', String(num), '--body-file', file]))
}

export function dispatchWorkflow(workflow: string, inputs: Record<string, string> = {}): void {
  gh(['workflow', 'run', workflow, ...Object.entries(inputs).flatMap(([k, v]) => ['-f', `${k}=${v}`])])
}

/** GitHub Actions の出力・サマリー */
export function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT
  if (file) fs.appendFileSync(file, `${name}=${value}\n`)
}

export function appendSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY
  if (file) fs.appendFileSync(file, markdown + '\n')
  else console.log(markdown)
}

// ─── 職務記述書 ──────────────────────────────────────────────────────
/** .claude/agents/<name>.md の本文（frontmatter を除く）をシステムプロンプトとして返す */
export function loadPersona(name: string): string {
  const raw = fs.readFileSync(path.join(ROOT, '.claude', 'agents', `${name}.md`), 'utf-8')
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

// ─── Claude API（構造化出力）─────────────────────────────────────────
let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY が設定されていません')
    client = new Anthropic()
  }
  return client
}

/**
 * JSON スキーマに沿った出力を得る。スキーマは additionalProperties: false と required を明示すること
 */
export async function callJson<T>(opts: {
  model: string
  system: string
  user: string
  schema: Record<string, unknown>
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
}): Promise<T> {
  const stream = getClient().messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 32000,
    system: opts.system,
    output_config: {
      effort: opts.effort ?? 'medium',
      format: { type: 'json_schema', schema: opts.schema },
    },
    messages: [{ role: 'user', content: opts.user }],
  })
  const final = await stream.finalMessage()
  recordUsage(opts.model, final.usage)
  if (final.stop_reason === 'refusal') throw new Error('モデルが応答を断りました')
  if (final.stop_reason === 'max_tokens') throw new Error('出力上限に達しました')
  const text = final.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  return JSON.parse(text) as T
}

// ─── 記事ファイル ────────────────────────────────────────────────────
export type ArticleFile = { meta: DraftMeta & { issue?: number }; body: string }

const oneLine = (s: string) => s.replace(/\s*\r?\n\s*/g, ' ').trim()

export function serializeArticle({ meta, body }: ArticleFile): string {
  const lines = [
    '---',
    `title: ${oneLine(meta.title)}`,
    `slug: ${meta.slug}`,
    `category: ${meta.category}`,
    `tags: ${meta.tags.map(oneLine).join(', ')}`,
    `excerpt: ${oneLine(meta.excerpt)}`,
  ]
  if (meta.issue) lines.push(`issue: ${meta.issue}`)
  lines.push('---', '', body.trim(), '')
  return lines.join('\n')
}

export function readArticle(filepath: string): ArticleFile | null {
  const raw = fs.readFileSync(filepath, 'utf-8')
  const parsed = parseDraft(raw)
  if (!parsed) return null
  const issue = raw.match(/^issue:\s*(\d+)/m)?.[1]
  return { meta: { ...parsed.meta, issue: issue ? parseInt(issue, 10) : undefined }, body: parsed.body }
}

const CATEGORY_JA: Record<string, string> = {
  player_analysis: '選手分析',
  team_analysis: 'チーム分析',
  tactics: '戦術',
  data: 'データ',
}

/**
 * 直近の掲載記事を、カテゴリ別の本数とカテゴリ付きの一覧にする（記者・編集長の重複・偏りチェック用）
 */
export function describeRecent(recent: { title: string; category?: string }[]): string[] {
  if (recent.length === 0) return ['（なし）']
  const counts = Object.entries(CATEGORY_JA)
    .map(([key, ja]) => `${ja} ${recent.filter((a) => a.category === key).length}本`)
    .join('、')
  return [
    `カテゴリ別: ${counts}（4カテゴリが偏らないようにする）`,
    ...recent.map((a) => `- [${CATEGORY_JA[a.category ?? ''] ?? '不明'}] ${a.title}`),
  ]
}

export function todayJST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0]
}
