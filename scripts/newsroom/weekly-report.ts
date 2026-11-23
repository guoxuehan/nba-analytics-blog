/**
 * 📊 経営企画: 編集部の1週間の稼働をまとめ、週次レポートを Issue で起票する
 *
 * 集計するもの（すべて実データ。推測はしない）
 *   - Supabase: 公開した記事の本数・カテゴリ内訳、公開予約中の記事
 *   - GitHub Issue: 企画の提出数・採用・不採用・執筆失敗、未投稿の配信案
 *   - GitHub PR: 入稿数、自動公開・人間の確認待ち
 *   - GitHub Actions: 失敗したワークフロー
 * そのうえで経営企画担当（Claude）が所見を書く
 *
 * DRY_RUN=1 のときは Issue を作らずに表示だけする
 */
import { createClient } from '@supabase/supabase-js'
import { MODEL, logUsageSummary } from '../auto-generate'
import { fetchAnalytics } from './analytics'
import { LABELS, appendSummary, callJson, createIssue, ensureLabels, gh, ghJson, loadPersona, todayJST } from './_lib'

const DAYS = 7
const DRY_RUN = process.env.DRY_RUN === '1'
const REPORT_LABEL = '経営:週次レポート'

const CATEGORY_LABELS: Record<string, string> = {
  player_analysis: '選手分析',
  team_analysis: 'チーム分析',
  tactics: '戦術',
  data: 'データ',
}

type IssueRow = { number: number; title: string; state: string; createdAt: string; labels: { name: string }[] }
type PrRow = { number: number; title: string; state: string; createdAt: string; mergedAt: string | null; labels: { name: string }[] }
type RunRow = { workflowName: string; conclusion: string; createdAt: string; url: string; event: string; headBranch: string }
type Insight = { highlights: string[]; issues: string[]; actions: string[] }

const INSIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['highlights', 'issues', 'actions'],
  properties: {
    highlights: { type: 'array', items: { type: 'string' }, description: '良かったこと（1〜3個）' },
    issues: { type: 'array', items: { type: 'string' }, description: '問題と原因の仮説（0〜3個）' },
    actions: { type: 'array', items: { type: 'string' }, description: '来週のアクション。担当者を明記（1〜3個）' },
  },
}

const has = (row: { labels: { name: string }[] }, name: string) => row.labels.some((l) => l.name === name)

async function main() {
  const now = new Date()
  const since = new Date(now.getTime() - DAYS * 86_400_000)
  const inWindow = (iso: string | null) => !!iso && new Date(iso) >= since && new Date(iso) <= now

  // ── Supabase: 公開実績 ──
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: published, error } = await supabase
    .from('articles')
    .select('title, slug, category, published_at')
    .eq('published', true)
    .gte('published_at', since.toISOString())
    .order('published_at', { ascending: true })
  if (error) throw new Error(`記事の取得に失敗: ${error.message}`)
  const live = (published ?? []).filter((a) => new Date(a.published_at) <= now)
  const scheduled = (published ?? []).filter((a) => new Date(a.published_at) > now)
  const byCategory = Object.keys(CATEGORY_LABELS).map((c) => ({
    label: CATEGORY_LABELS[c],
    count: live.filter((a) => a.category === c).length,
  }))

  // ── GitHub: 企画・入稿・配信・ワークフロー ──
  const issues = ghJson<IssueRow[]>([
    'issue', 'list', '--state', 'all', '--limit', '300', '--json', 'number,title,state,createdAt,labels',
  ])
  const pitches = issues.filter((i) => i.title.startsWith('[企画]') && inWindow(i.createdAt))
  const approved = pitches.filter((i) => has(i, LABELS.written) || has(i, LABELS.approved))
  const rejected = pitches.filter((i) => has(i, LABELS.rejected))
  const writeFailed = pitches.filter((i) => has(i, LABELS.needsHuman))
  const pendingPromo = issues.filter((i) => i.state === 'OPEN' && has(i, LABELS.promo))

  const prs = ghJson<PrRow[]>([
    'pr', 'list', '--state', 'all', '--limit', '200', '--json', 'number,title,state,createdAt,mergedAt,labels',
  ]).filter((p) => p.title.startsWith('[入稿]'))
  const submitted = prs.filter((p) => inWindow(p.createdAt))
  const autoPublished = submitted.filter((p) => p.mergedAt && has(p, LABELS.reviewOk))
  const waitingHuman = prs.filter((p) => p.state === 'OPEN' && has(p, LABELS.needsHuman))

  const runs = ghJson<RunRow[]>([
    'run', 'list', '--limit', '200', '--json', 'workflowName,conclusion,createdAt,url,event,headBranch',
  ])
    .filter((r) => inWindow(r.createdAt))
    // ボットの記事PRで作られる pull_request の実行は、承認待ちのまま一度も動かずに「失敗」で終わるので数えない
    .filter((r) => !(r.event === 'pull_request' && r.headBranch.startsWith('article/')))
  const failedRuns = runs.filter((r) => r.conclusion === 'failure')
  const failedByWorkflow = [...new Set(failedRuns.map((r) => r.workflowName))].map((name) => ({
    name,
    count: failedRuns.filter((r) => r.workflowName === name).length,
    url: failedRuns.find((r) => r.workflowName === name)!.url,
  }))

  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
  const facts = [
    `期間: ${since.toISOString().slice(0, 10)} 〜 ${now.toISOString().slice(0, 10)}（${DAYS}日間）`,
    `公開した記事: ${live.length}本（目標 ${DAYS * 3}本）／公開予約中: ${scheduled.length}本`,
    `カテゴリ内訳: ${byCategory.map((c) => `${c.label} ${c.count}`).join('、')}`,
    `企画: 提出 ${pitches.length}本／採用 ${approved.length}本（採用率 ${pct(approved.length, pitches.length)}）／不採用 ${rejected.length}本／執筆失敗 ${writeFailed.length}本`,
    `入稿: ${submitted.length}本／校閲を通って自動公開 ${autoPublished.length}本（${pct(autoPublished.length, submitted.length)}）`,
    `人間の確認待ちPR（現在）: ${waitingHuman.length}本`,
    `未投稿の配信案（現在）: ${pendingPromo.length}件`,
    `失敗したワークフロー: ${failedRuns.length}回${failedByWorkflow.length ? `（${failedByWorkflow.map((f) => `${f.name} ${f.count}回`).join('、')}）` : ''}`,
  ]

  // ── GA4・Search Console（設定されていれば）──
  const analytics = await fetchAnalytics()
  const change = (cur: number, prev: number) =>
    prev > 0 ? `（前週比 ${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%）` : ''
  if (analytics?.ga) {
    const g = analytics.ga
    facts.push(
      `ユーザー数（GA4）: ${g.users.toLocaleString()}人${change(g.users, g.usersPrev)}`,
      `ページビュー（GA4）: ${g.pageViews.toLocaleString()}${change(g.pageViews, g.pageViewsPrev)}`,
      `流入元（GA4・セッション）: ${g.channels.map((c) => `${c.name} ${c.sessions}`).join('、') || 'データなし'}`,
    )
  } else if (analytics?.gaError) {
    facts.push(`GA4: 取得できず（${analytics.gaError}）`)
  }
  if (analytics?.gsc) {
    const s = analytics.gsc
    facts.push(
      `検索（Search Console ${s.period}）: クリック ${s.clicks} / 表示 ${s.impressions} / CTR ${(s.ctr * 100).toFixed(1)}% / 平均掲載順位 ${s.position.toFixed(1)}`,
    )
  } else if (analytics?.gscError) {
    facts.push(`Search Console: 取得できず（${analytics.gscError}）`)
  }

  console.log('📊 経営企画: 集計\n' + facts.map((f) => `  ${f}`).join('\n'))

  const insight = await callJson<Insight>({
    model: MODEL,
    system: loadPersona('strategist'),
    user: [
      '今週の編集部の稼働データ:',
      ...facts.map((f) => `- ${f}`),
      '',
      '公開した記事:',
      ...(live.length ? live.map((a) => `- [${CATEGORY_LABELS[a.category] ?? a.category}] ${a.title}`) : ['（なし）']),
      ...(analytics?.ga?.topPages.length
        ? ['', 'よく読まれた記事（GA4・PV）:', ...analytics.ga.topPages.map((p) => `- ${p.title}: ${p.views}`)]
        : []),
      ...(analytics?.gsc?.topQueries.length
        ? [
            '',
            '検索クエリ上位（Search Console）:',
            ...analytics.gsc.topQueries.map(
              (q) => `- ${q.query}: クリック ${q.clicks} / 表示 ${q.impressions} / 順位 ${q.position.toFixed(1)}`,
            ),
          ]
        : []),
    ].join('\n'),
    schema: INSIGHT_SCHEMA,
    effort: 'low',
    maxTokens: 8000,
  })

  const list = (items: string[]) => (items.length ? items.map((s) => `- ${s}`).join('\n') : '- 特になし')
  const body = [
    '> 📊 経営企画担当が作成した週次レポートです。数字はすべて Supabase・GitHub・GA4・Search Console の実データから集計しています。',
    '',
    '## 数字',
    '| 項目 | 値 |',
    '|---|---|',
    ...facts.map((f) => {
      const [k, ...v] = f.split(': ')
      return `| ${k} | ${v.join(': ')} |`
    }),
    '',
    '## 良かったこと',
    list(insight.highlights),
    '',
    '## 問題',
    list(insight.issues),
    '',
    '## 来週のアクション',
    list(insight.actions),
    '',
    ...(analytics?.ga?.topPages.length
      ? [
          '## よく読まれた記事（GA4・今週）',
          '| 記事 | PV |',
          '|---|---|',
          ...analytics.ga.topPages.map((p) => `| [${p.title.replace(/\|/g, '｜')}](https://sports-academia.com${p.path}) | ${p.views} |`),
          '',
        ]
      : []),
    ...(analytics?.gsc?.topQueries.length
      ? [
          `## 検索クエリ上位（Search Console ${analytics.gsc.period}）`,
          '| クエリ | クリック | 表示 | 平均順位 |',
          '|---|---|---|---|',
          ...analytics.gsc.topQueries.map(
            (q) => `| ${q.query.replace(/\|/g, '｜')} | ${q.clicks} | ${q.impressions} | ${q.position.toFixed(1)} |`,
          ),
          '',
        ]
      : []),
    ...(waitingHuman.length
      ? ['## 社長の確認待ち', ...waitingHuman.map((p) => `- #${p.number} ${p.title}`), '']
      : []),
    ...(failedByWorkflow.length
      ? ['## 失敗したワークフロー', ...failedByWorkflow.map((f) => `- ${f.name}: ${f.count}回（直近: ${f.url}）`), '']
      : []),
    '<details><summary>今週公開した記事</summary>',
    '',
    ...(live.length ? live.map((a) => `- ${a.published_at.slice(0, 10)} [${CATEGORY_LABELS[a.category] ?? a.category}] ${a.title}`) : ['（なし）']),
    '',
    '</details>',
  ].join('\n')

  if (DRY_RUN) {
    console.log('\n' + body)
  } else {
    ensureLabels()
    gh(['label', 'create', REPORT_LABEL, '--color', '0052cc', '--description', '経営企画担当の週次レポート', '--force'])
    const num = createIssue(`[週次レポート] ${todayJST()}`, body, [REPORT_LABEL])
    console.log(`📊 週次レポート #${num}`)
    appendSummary(`### 📊 週次レポート\n- #${num}`)
  }
  logUsageSummary()
}

main().catch((err) => {
  console.error('❌ 経営企画:', err instanceof Error ? err.message : err)
  process.exit(1)
})
