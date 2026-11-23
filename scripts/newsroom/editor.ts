/**
 * 🧑‍💼 編集長: 企画候補（Issue）を審査し、採用・不採用を決める
 *
 * - 採用 → ラベル「企画:採用」を付け、ライターのワークフローを起動
 * - 不採用 → 理由をコメントしてクローズ
 * 採用数の上限は DAILY_ARTICLE_COUNT
 */
import { MODEL, fetchRecentArticles, logUsageSummary } from '../auto-generate'
import {
  DAILY_ARTICLE_COUNT,
  LABELS,
  appendSummary,
  callJson,
  commentIssue,
  dispatchWorkflow,
  ensureLabels,
  gh,
  ghJson,
  loadPersona,
  todayJST,
} from './_lib'

type Candidate = { number: number; title: string; body: string; author: { login: string }; createdAt: string }
type Decision = { issue: number; decision: 'approve' | 'reject'; priority: number; note: string }

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decisions'],
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['issue', 'decision', 'priority', 'note'],
        properties: {
          issue: { type: 'integer', description: 'Issue番号' },
          decision: { type: 'string', enum: ['approve', 'reject'] },
          priority: { type: 'integer', description: '採用時の優先順位（1が最優先）。不採用は0' },
          note: {
            type: 'string',
            description: '採用ならライターへの追加指示、不採用なら記者への具体的な理由（1〜2文）',
          },
        },
      },
    },
  },
}

const isBot = (login: string) => login.endsWith('[bot]') || login === 'github-actions'

async function main() {
  ensureLabels()

  const candidates = ghJson<Candidate[]>([
    'issue', 'list', '--state', 'open', '--label', LABELS.pitch,
    '--json', 'number,title,body,author,createdAt', '--limit', '30',
  ])
  if (candidates.length === 0) {
    console.log('🧑‍💼 編集長: 審査する企画がありません')
    return
  }

  const recent = await fetchRecentArticles()
  const user = [
    `今日は ${todayJST()}（日本時間）。採用は最大 ${DAILY_ARTICLE_COUNT} 本。`,
    'すべての候補について、採用か不採用かを決めること。',
    '',
    '## 直近14日に掲載した記事',
    ...(recent.length > 0 ? recent.map((a) => `- ${a.title}`) : ['（なし）']),
    '',
    '## 企画候補',
    ...candidates.map((c) =>
      [
        `### #${c.number} ${c.title}`,
        `提出者: ${isBot(c.author.login) ? '記者（AI）' : '社長（人間）'} / 提出日時: ${c.createdAt}`,
        c.body,
      ].join('\n'),
    ),
  ].join('\n\n')

  const { decisions } = await callJson<{ decisions: Decision[] }>({
    model: MODEL,
    system: loadPersona('editor-in-chief'),
    user,
    schema: DECISION_SCHEMA,
    effort: 'medium',
  })

  const byIssue = new Map(decisions.map((d) => [d.issue, d]))
  // 上限を超えた採用は、優先順位の低いものから不採用扱いにする
  const approved = decisions
    .filter((d) => d.decision === 'approve' && candidates.some((c) => c.number === d.issue))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, DAILY_ARTICLE_COUNT)
  const approvedSet = new Set(approved.map((d) => d.issue))

  const summary: string[] = ['### 🧑‍💼 編集長: 審査結果']
  for (const c of candidates) {
    const d = byIssue.get(c.number)
    if (approvedSet.has(c.number)) {
      commentIssue(c.number, `🧑‍💼 **編集長: 採用**（優先度 ${d!.priority}）\n\n${d!.note}\n\nライターに執筆を依頼しました。`)
      gh(['issue', 'edit', String(c.number), '--remove-label', LABELS.pitch, '--add-label', LABELS.approved])
      dispatchWorkflow('newsroom-write.yml', { issue: String(c.number) })
      summary.push(`- ✅ #${c.number} ${c.title}`)
    } else {
      const note = d?.decision === 'reject' ? d.note : '本日の採用枠に入らなかったため見送ります。'
      commentIssue(c.number, `🧑‍💼 **編集長: 不採用**\n\n${note}`)
      gh(['issue', 'edit', String(c.number), '--remove-label', LABELS.pitch, '--add-label', LABELS.rejected])
      gh(['issue', 'close', String(c.number), '--reason', 'not planned'])
      summary.push(`- ❌ #${c.number} ${c.title} — ${note}`)
    }
  }

  appendSummary(summary.join('\n'))
  logUsageSummary()
}

main().catch((err) => {
  console.error('❌ 編集長:', err instanceof Error ? err.message : err)
  process.exit(1)
})
