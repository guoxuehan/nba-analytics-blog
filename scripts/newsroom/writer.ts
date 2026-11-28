/**
 * ✍️ ライター: 採用された企画（Issue）から記事を書き、PR で入稿する
 *
 * 使い方: npx tsx scripts/newsroom/writer.ts <issue番号>
 * 出力:
 *   content/articles/<slug>.md … 記事（YAML frontmatter）
 *   content/notes/<slug>.md    … 取材メモ（企画・取材データ・編集長の指示）。校閲デスクが照合に使う
 *   PR（ラベル「入稿」）→ 校閲ワークフローを起動
 */
import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  ARTICLE_RULES,
  EFFORT,
  MAX_TOKENS,
  MODEL,
  REAL_DATA_INSTRUCTION,
  logUsageSummary,
  recordUsage,
} from '../auto-generate'
import { removeInvalidCharts, stripCharts } from '../../lib/chart'
import { addCharts } from './graphics-desk'
import { removeUnknownViz } from '../../lib/viz'
import { VALID_CATEGORIES, computeScore } from '../auto-publish'
import { parseDraft } from '../_parse-draft'
import {
  ARTICLES_DIR,
  LABELS,
  NOTES_DIR,
  appendSummary,
  commentIssue,
  dispatchWorkflow,
  gh,
  ghJson,
  git,
  loadPersona,
  serializeArticle,
  todayJST,
  withBodyFile,
} from './_lib'

type IssueView = {
  number: number
  title: string
  body: string
  state: string
  labels: { name: string }[]
  comments: { author: { login: string }; body: string }[]
}

async function slugTaken(slug: string): Promise<boolean> {
  if (fs.existsSync(path.join(ARTICLES_DIR, `${slug}.md`))) return true
  if (git(['ls-remote', '--heads', 'origin', `article/${slug}`])) return true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false
  const { data } = await createClient(url, key).from('articles').select('id').eq('slug', slug).maybeSingle()
  return !!data
}

async function writeDraft(brief: string, hasData: boolean): Promise<string> {
  const client = new Anthropic()
  const dataInstruction = hasData ? `\n\n${REAL_DATA_INSTRUCTION}\n\n---\n\n` : '\n\n---\n\n'
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT },
    system: loadPersona('writer'),
    messages: [{ role: 'user', content: `${ARTICLE_RULES}${dataInstruction}${brief}` }],
  })
  const final = await stream.finalMessage()
  recordUsage(MODEL, final.usage)
  if (final.stop_reason === 'refusal') throw new Error('モデルが執筆を断りました')
  if (final.stop_reason === 'max_tokens') throw new Error('出力上限に達し、記事が途中で切れました')
  return final.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .replace(/---XPOST---[\s\S]*?---XPOST---/, '') // X投稿文はマーケ担当が公開時に作る
}

async function main() {
  const issueNumber = parseInt(process.argv[2] ?? process.env.ISSUE ?? '', 10)
  if (!issueNumber) throw new Error('Issue番号を指定してください')

  const issue = ghJson<IssueView>([
    'issue', 'view', String(issueNumber), '--json', 'number,title,body,state,labels,comments',
  ])
  const labels = issue.labels.map((l) => l.name)
  if (issue.state !== 'OPEN' || labels.includes(LABELS.written)) {
    console.log(`✍️ #${issueNumber} は執筆済みまたはクローズ済みのため、スキップします`)
    return
  }

  // 企画本文＋編集長・社長のコメントをまとめて「取材メモ」にする
  const notes = [
    `# 取材メモ: #${issue.number} ${issue.title}`,
    '',
    issue.body.replace(/<!--[\s\S]*?-->/g, '').trim(),
    '',
    '## 編集部のコメント',
    ...issue.comments.map((c) => `- ${c.author.login}: ${c.body.replace(/\s+/g, ' ').trim()}`),
  ].join('\n')
  const hasData = /```text[\s\S]+?```/.test(issue.body)

  console.log(`✍️ ライター: #${issue.number} ${issue.title} を執筆中…`)
  const draft = await writeDraft(
    `以下の企画で記事を書け。企画の「取材データ」以外の数字は使わないこと。\n\n${notes}`,
    hasData,
  )
  const parsed = parseDraft(draft)
  if (!parsed) throw new Error(`原稿の形式が崩れています。先頭: ${draft.slice(0, 200)}`)
  const { meta } = parsed
  // ライターはグラフを書かない（図版デスクの担当）。紛れ込んだ崩れたブロックは外す
  let { body } = removeInvalidCharts(removeUnknownViz(parsed.body).body)

  // 📈 図版デスク: 主張を支えるグラフを0〜2点入れる（失敗しても図なしで入稿する）
  let graphics = '図なし'
  try {
    const result = await addCharts(body, notes, meta.title)
    body = result.body
    for (const d of result.dropped) console.warn(`  ⚠️  図版デスク: 図を外しました — ${d}`)
    for (const a of result.added) console.log(`  📈 図版デスク: ${a.title}（${a.reason}）`)
    graphics = result.added.length > 0 ? result.added.map((a) => `「${a.title}」`).join('、') : '図なし（不要と判断）'
  } catch (err) {
    console.warn(`  ⚠️  図版デスク: 失敗したため図なしで入稿します — ${err instanceof Error ? err.message : err}`)
    graphics = '図なし（図版デスクが失敗）'
  }
  if (!VALID_CATEGORIES.includes(meta.category)) {
    meta.category = issue.body.match(/newsroom:category=(\w+)/)?.[1] ?? 'player_analysis'
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug)) {
    meta.slug = meta.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `article-${issue.number}`
  }
  if (await slugTaken(meta.slug)) meta.slug = `${meta.slug}-${todayJST().replace(/-/g, '')}`

  const articlePath = path.join(ARTICLES_DIR, `${meta.slug}.md`)
  const notesPath = path.join(NOTES_DIR, `${meta.slug}.md`)
  fs.mkdirSync(ARTICLES_DIR, { recursive: true })
  fs.mkdirSync(NOTES_DIR, { recursive: true })
  fs.writeFileSync(articlePath, serializeArticle({ meta: { ...meta, issue: issue.number }, body }), 'utf-8')
  fs.writeFileSync(notesPath, notes + '\n', 'utf-8')
  const score = computeScore(articlePath)
  const charCount = stripCharts(body).length
  console.log(`  slug: ${meta.slug} / ${charCount}字 / スコア ${score}点`)

  // ブランチを切って入稿
  const branch = `article/${meta.slug}`
  git(['checkout', '-b', branch])
  git(['add', articlePath, notesPath])
  git(['commit', '-m', `入稿: ${meta.title}\n\nRefs #${issue.number}`])
  git(['push', '-u', 'origin', branch])

  const prBody = [
    `✍️ ライターが入稿しました（📈 図版は図版デスク）。校閲デスクがファクトチェックと校正を行います。`,
    '',
    `Closes #${issue.number}`,
    '',
    '| 項目 | 値 |',
    '|---|---|',
    `| タイトル | ${meta.title} |`,
    `| カテゴリ | \`${meta.category}\` |`,
    `| 文字数 | ${charCount}字 |`,
    `| 図版 | ${graphics} |`,
    `| 品質スコア（機械判定） | ${score}点 |`,
    '',
    `**抜粋**: ${meta.excerpt}`,
    '',
    '---',
    `公開を止めたいときは \`${LABELS.hold}\` ラベルを付けてください。修正を頼むときは \`@claude\` とコメントしてください。`,
  ].join('\n')
  const prUrl = withBodyFile(prBody, (file) =>
    gh(['pr', 'create', '--head', branch, '--title', `[入稿] ${meta.title}`, '--body-file', file, '--label', LABELS.manuscript]),
  )
  const prNumber = prUrl.split('/').pop()!
  console.log(`  PR: ${prUrl}`)

  commentIssue(issue.number, `✍️ **ライター: 入稿しました** → ${prUrl}`)
  gh(['issue', 'edit', String(issue.number), '--remove-label', LABELS.approved, '--add-label', LABELS.written])
  dispatchWorkflow('newsroom-review.yml', { pr: prNumber })

  appendSummary(`### ✍️ ライター\n- #${issue.number} → ${prUrl}（${charCount}字 / ${score}点 / 図版: ${graphics}）`)
  logUsageSummary()
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('❌ ライター:', msg)
  // 失敗を企画Issueに残し、人間が気づけるようにする
  const issueNumber = process.argv[2] ?? process.env.ISSUE
  if (issueNumber) {
    try {
      commentIssue(parseInt(issueNumber, 10), `✍️ **ライター: 執筆に失敗しました**\n\n\`\`\`\n${msg.slice(0, 1000)}\n\`\`\`\n\n\`${LABELS.approved}\` ラベルを付け直すと再挑戦します。`)
      gh(['issue', 'edit', issueNumber, '--remove-label', LABELS.approved, '--add-label', LABELS.needsHuman])
    } catch {
      // コメントに失敗しても元のエラーで終了する
    }
  }
  process.exit(1)
})
