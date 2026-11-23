/**
 * 📰 記者: 取材データから企画候補を作り、GitHub Issue として提出する
 *
 * 入力: data/nba-latest.json, data/standings.json（fetch-nba-data.ts が作成）
 * 出力: Issue（ラベル「企画:候補」）× (DAILY_ARTICLE_COUNT + 2) 件程度
 */
import * as fs from 'fs'
import * as path from 'path'
import type { NBALatestData } from '../fetch-nba-data'
import {
  MODEL,
  fetchRecentArticles,
  formatLeaders,
  isEarlySeason,
  loadStandings,
  logUsageSummary,
  resultText,
  selectThemes,
} from '../auto-generate'
import type { StandingsData } from '../auto-generate'
import {
  DAILY_ARTICLE_COUNT,
  LABELS,
  appendSummary,
  callJson,
  createIssue,
  ensureLabels,
  ghJson,
  loadPersona,
  todayJST,
} from './_lib'

const CATEGORIES = ['player_analysis', 'team_analysis', 'tactics', 'data'] as const

type Pitch = {
  title: string
  category: (typeof CATEGORIES)[number]
  focus: string
  angle: string
  why_now: string
  writer_brief: string
  facts: string[]
}

const PITCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pitches'],
  properties: {
    pitches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'focus', 'angle', 'why_now', 'writer_brief', 'facts'],
        properties: {
          title: { type: 'string', description: '仮タイトル（30〜40字）' },
          category: { type: 'string', enum: [...CATEGORIES] },
          focus: { type: 'string', description: '中心となるチーム名または選手名（日本語）' },
          angle: { type: 'string', description: '記事が立てる1つの問いと切り口（2〜3文）' },
          why_now: { type: 'string', description: '今日出す理由（1〜2文）' },
          writer_brief: { type: 'string', description: 'ライターへの具体的な指示（3〜5文）' },
          facts: {
            type: 'array',
            items: { type: 'string' },
            description: '根拠に使う取材データの行。取材データから一字一句そのまま写すこと',
          },
        },
      },
    },
  },
}

/** 取材データを「1行=1事実」のテキストにする。記者が引用できるのはこの行だけ */
function buildDataSheet(data: NBALatestData, standings: StandingsData | null): string[] {
  const lines: string[] = []
  for (const g of data.games) {
    const leaders = formatLeaders(g.leaders, g.homeTeam, g.awayTeam).replace(/^\n/, ' / ')
    lines.push(`[試合 ${data.date}] ${resultText(g)}（${g.scoreDiff}点差）${leaders}`)
  }
  for (const s of data.topScorers ?? []) {
    // 不明な値（null）は書かない。0 と書くと「0本だった」という誤った事実になる
    const extra = [s.reb != null ? `${s.reb}リバウンド` : '', s.ast != null ? `${s.ast}アシスト` : '']
      .filter(Boolean)
      .join(' ')
    lines.push(`[個人 ${data.date}] ${s.playerName}（${s.team}）${s.pts}得点${extra ? ` ${extra}` : ''}`)
  }
  if (standings) {
    const early = isEarlySeason(standings)
    for (const [conf, teams] of [['東', standings.east], ['西', standings.west]] as const) {
      for (const t of teams) {
        lines.push(
          `[順位 ${standings.season} ${conf}${t.rank}位] ${t.teamCity} ${t.teamName} ${t.wins}勝${t.losses}敗` +
            (early ? '（開幕直後のため参考値）' : `（勝率${t.winPct.toFixed(3)}）`),
        )
      }
    }
  }
  return lines
}

function issueBody(p: Pitch, sheet: Set<string>): string {
  const facts = p.facts.map((f) => f.trim()).filter((f) => sheet.has(f))
  return [
    '> 📰 記者が提出した企画候補です。編集長が審査し、採用されるとライターが執筆します。',
    '',
    `**カテゴリ**: \`${p.category}\` / **主役**: ${p.focus}`,
    '',
    '## 切り口',
    p.angle,
    '',
    '## なぜ今日か',
    p.why_now,
    '',
    '## ライターへの指示',
    p.writer_brief,
    '',
    '## 取材データ',
    facts.length > 0
      ? ['```text', ...facts, '```'].join('\n')
      : '（取材データの引用なし。一般的な分析テーマ）',
    '',
    `<!-- newsroom:category=${p.category} -->`,
  ].join('\n')
}

/** DRY_RUN=1 のときは GitHub を操作せず、企画候補を表示するだけ（ローカル確認用） */
const DRY_RUN = process.env.DRY_RUN === '1'

export async function run(): Promise<number[]> {
  if (!DRY_RUN) ensureLabels()

  const dataPath = path.resolve('data', 'nba-latest.json')
  const data: NBALatestData = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    : { date: todayJST(), fetchedAt: '', gamesCount: 0, games: [], topScorers: [], dataSource: 'none' }
  const standings = loadStandings()
  const recent = await fetchRecentArticles()

  // 既存ロジック（ドラマ型・論争型・ローテーション型）の選定結果を「定番企画案」として渡す
  const seeds = await selectThemes(data, standings, [], recent)

  // 進行中の企画・入稿中の記事（重複を避ける）
  const listOpen = (label: string) =>
    DRY_RUN
      ? []
      : ghJson<{ number: number; title: string }[]>([
          'issue', 'list', '--state', 'open', '--label', label, '--json', 'number,title', '--limit', '50',
        ])
  const openPitches = listOpen(LABELS.pitch)
  const openApproved = listOpen(LABELS.approved)

  const sheetLines = buildDataSheet(data, standings)
  const sheet = new Set(sheetLines)
  const count = DAILY_ARTICLE_COUNT + 2

  const user = [
    `今日は ${todayJST()}（日本時間）。企画候補を ${count} 本出してほしい。`,
    '',
    '## 取材データ（引用できるのはこの行だけ）',
    sheetLines.length > 0 ? sheetLines.join('\n') : '（本日は試合データなし）',
    '',
    '## 定番ロジックが選んだ企画案（参考。採用・改良・却下は自由）',
    ...seeds.map((s) => `- ${s.title}: ${s.prompt.replace(/\s+/g, ' ').slice(0, 300)}`),
    '',
    '## 直近14日に掲載した記事（同じ主役・同じ問いは避ける）',
    ...(recent.length > 0 ? recent.map((a) => `- ${a.title}`) : ['（なし）']),
    '',
    '## 進行中の企画（重複させない）',
    ...[...openPitches, ...openApproved].map((i) => `- #${i.number} ${i.title}`),
  ].join('\n')

  console.log(`📰 記者: 取材データ ${sheetLines.length} 行 / 定番案 ${seeds.length} 本 / 直近記事 ${recent.length} 本`)

  const { pitches } = await callJson<{ pitches: Pitch[] }>({
    model: MODEL,
    system: loadPersona('reporter'),
    user,
    schema: PITCH_SCHEMA,
    effort: 'medium',
  })

  const created: number[] = []
  if (DRY_RUN) {
    for (const p of pitches.slice(0, count)) console.log(`
=== [企画] ${p.title}
${issueBody(p, sheet)}`)
    logUsageSummary()
    return []
  }
  for (const p of pitches.slice(0, count)) {
    const num = createIssue(`[企画] ${p.title}`, issueBody(p, sheet), [LABELS.pitch])
    created.push(num)
    console.log(`  #${num} ${p.title}`)
  }

  appendSummary(
    ['### 📰 記者: 企画候補', ...pitches.slice(0, count).map((p, i) => `- #${created[i]} ${p.title}`)].join('\n'),
  )
  logUsageSummary()
  return created
}

run().catch((err) => {
  console.error('❌ 記者:', err instanceof Error ? err.message : err)
  process.exit(1)
})
