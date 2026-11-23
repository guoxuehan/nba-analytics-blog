/**
 * ✅ デスク判定: 校閲デスクの結果と品質スコアから、自動公開するか人間に回すかを決める
 *
 * 自動マージの条件（すべて満たすこと）
 *   - 校閲デスクの判定が pass
 *   - 校閲後の品質スコアが QUALITY_THRESHOLD 以上
 *   - PR に「保留」ラベルがない
 *
 * 環境変数: PR, FILE, SCORE_BEFORE, SCORE_AFTER, DESK_RESULT（structured_output の JSON）, DESK_OUTCOME, CHANGED
 */
import { LABELS, QUALITY_THRESHOLD, appendSummary, commentPr, dispatchWorkflow, gh, ghJson } from './_lib'

type DeskResult = {
  verdict: 'pass' | 'needs_human' | 'reject'
  summary: string
  fact_issues: { claim: string; problem: string; action: string }[]
  edits: string[]
}

const pr = process.env.PR!
const file = process.env.FILE!
const scoreBefore = parseInt(process.env.SCORE_BEFORE ?? '0', 10)
const scoreAfter = parseInt(process.env.SCORE_AFTER ?? '0', 10)
const changed = process.env.CHANGED === 'true'

let desk: DeskResult | null = null
try {
  desk = process.env.DESK_RESULT ? (JSON.parse(process.env.DESK_RESULT) as DeskResult) : null
} catch {
  desk = null
}

const { labels } = ghJson<{ labels: { name: string }[] }>(['pr', 'view', pr, '--json', 'labels'])
const onHold = labels.some((l) => l.name === LABELS.hold)

const reasons: string[] = []
if (!desk) reasons.push(`校閲デスクが結果を返しませんでした（${process.env.DESK_OUTCOME ?? 'unknown'}）`)
else if (desk.verdict !== 'pass') reasons.push(`校閲デスクの判定が \`${desk.verdict}\``)
if (scoreAfter < QUALITY_THRESHOLD) reasons.push(`品質スコア ${scoreAfter}点 < 基準 ${QUALITY_THRESHOLD}点`)
if (onHold) reasons.push(`\`${LABELS.hold}\` ラベルが付いている`)
const autoMerge = reasons.length === 0

const verdictLabel = { pass: '✅ 公開OK', needs_human: '⚠️ 人間の確認が必要', reject: '❌ 掲載不可' }
const report = [
  '## 🔍 校閲デスク レポート',
  '',
  `**判定**: ${desk ? verdictLabel[desk.verdict] : '—（未実行）'}`,
  `**品質スコア**: ${scoreBefore}点 → ${scoreAfter}点${changed ? '（校閲で修正をコミットしました）' : ''}`,
  '',
  desk?.summary ?? '',
  '',
  ...(desk && desk.fact_issues.length > 0
    ? [
        '### ファクトチェック',
        '| 記述 | 問題 | 対応 |',
        '|---|---|---|',
        ...desk.fact_issues.map((f) => `| ${f.claim.replace(/\|/g, '｜')} | ${f.problem.replace(/\|/g, '｜')} | ${f.action.replace(/\|/g, '｜')} |`),
        '',
      ]
    : []),
  ...(desk && desk.edits.length > 0 ? ['### 主な修正', ...desk.edits.map((e) => `- ${e}`), ''] : []),
  '---',
  autoMerge
    ? '✅ **デスク判定: 自動公開します。**'
    : `👀 **デスク判定: 人間の確認待ちです。** 理由: ${reasons.join(' / ')}\n\n問題なければこのPRをマージしてください（マージすると公開されます）。修正を頼むときは \`@claude\` とコメントしてください。`,
].join('\n')

commentPr(parseInt(pr, 10), report)

if (autoMerge) {
  gh(['pr', 'edit', pr, '--add-label', LABELS.reviewOk])
  gh(['pr', 'merge', pr, '--squash', '--delete-branch'])
  // GITHUB_TOKEN によるマージでは push イベントが発火しないため、公開ワークフローを明示的に起動する
  dispatchWorkflow('newsroom-publish.yml')
} else {
  gh(['pr', 'edit', pr, '--add-label', LABELS.reviewNg, '--add-label', LABELS.needsHuman])
}

appendSummary(`### 🔍 校閲 → ${autoMerge ? '自動公開' : '人間の確認待ち'}\n- PR #${pr} \`${file}\` スコア ${scoreBefore}→${scoreAfter}${reasons.length ? `\n- 理由: ${reasons.join(' / ')}` : ''}`)
