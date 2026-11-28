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
  describeRecent,
  ensureLabels,
  ghJson,
  loadPersona,
  todayJST,
} from './_lib'
import { fetchAnalytics } from './analytics'

const CATEGORIES = ['player_analysis', 'team_analysis', 'tactics', 'data'] as const

type Pitch = {
  kind: 'news' | 'evergreen'
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
        required: ['kind', 'title', 'category', 'focus', 'angle', 'why_now', 'writer_brief', 'facts'],
        properties: {
          kind: {
            type: 'string',
            enum: ['news', 'evergreen'],
            description: 'news = 昨夜の試合など今日の出来事が起点 / evergreen = 時間がたっても読まれるデータ・歴史・解説',
          },
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

/**
 * 発見データ: 図版の集計（data/viz/）から、「へー！」の種になる事実を1行ずつ作る。
 * 試合経過を全試合ぶん自分たちで数えた数字なので、他のメディアにない切り口になる。
 * 値はここで計算して丸める（記者・ライターは行をそのまま引用する）
 */
function buildDiscoverySheet(): string[] {
  const read = <T,>(name: string): T | null => {
    const file = path.resolve('data', 'viz', name)
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as T) : null
  }
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-')
  const lines: string[] = []

  const clock = read<{ season: string; through: string; games: string[]; points: { pt3: number[]; pt2: number[]; ft: number[] } }>('scoring-clock.json')
  if (clock && clock.games.length > 0) {
    const n = clock.games.length
    const { pt2, pt3, ft } = clock.points
    const tot = pt2.map((_, i) => pt2[i] + pt3[i] + ft[i])
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
    const head = `[発見 時刻 ${clock.season} ${clock.through}まで${n}試合]`
    const all = sum(tot)
    lines.push(`${head} 総得点 ${all}点（3P ${pct(sum(pt3), all)} / 2P ${pct(sum(pt2), all)} / フリースロー ${pct(sum(ft), all)}）`)
    for (let q = 0; q < 4; q++) {
      const seg = tot.slice(q * 48, q * 48 + 48)
      lines.push(`${head} 第${q + 1}Qの得点 1試合あたり ${(sum(seg) / n).toFixed(1)}点 / 最初の15秒 ${seg[0]}点 / 最後の15秒 ${seg[47]}点`)
    }
    const normalBins = [0, 1, 2, 3].flatMap((q) => Array.from({ length: 36 }, (_, i) => q * 48 + 4 + i))
    const normal = sum(normalBins.map((i) => tot[i])) / normalBins.length
    const normal3 = sum(normalBins.map((i) => pt3[i])) / sum(normalBins.map((i) => tot[i]))
    lines.push(`${head} 通常時（各Q 残り11:00〜3:00）の15秒あたりの得点 ${normal.toFixed(1)}点 / うち3Pの割合 ${(normal3 * 100).toFixed(1)}%`)
    const labels = ['残り1:00〜0:45', '残り0:45〜0:30', '残り0:30〜0:15', '残り0:15〜0:00']
    labels.forEach((label, k) => {
      const bins = [0, 1, 2].map((q) => q * 48 + 44 + k)
      const v = sum(bins.map((i) => tot[i])) / 3
      const s3 = sum(bins.map((i) => pt3[i])) / sum(bins.map((i) => tot[i]))
      lines.push(`${head} 第1〜第3Qの${label} 15秒あたり ${v.toFixed(1)}点（通常時比 ${v >= normal ? '+' : ''}${(((v / normal) - 1) * 100).toFixed(1)}%）/ うち3P ${(s3 * 100).toFixed(1)}%`)
    })
    const q4last2 = Array.from({ length: 8 }, (_, i) => 3 * 48 + 40 + i)
    lines.push(`${head} 第4Q残り2分の得点 ${sum(q4last2.map((i) => tot[i]))}点のうちフリースロー ${pct(sum(q4last2.map((i) => ft[i])), sum(q4last2.map((i) => tot[i])))}（試合全体では ${pct(sum(ft), all)}）`)
  }

  const decided = read<{ season: string; through: string; decided: { t: number; ot: boolean; margin: number }[] }>('decided-at.json')
  if (decided && decided.decided.length > 0) {
    const d = decided.decided
    const head = `[発見 決着 ${decided.season} ${decided.through}まで${d.length}試合]`
    const firstHalf = (g: { t: number; ot: boolean }) => !g.ot && g.t < 1440
    const late = (g: { t: number; ot: boolean }) => g.ot || g.t >= 43 * 60
    lines.push(`${head} 勝ったチームが最後にリードを奪った時刻: 前半 ${d.filter(firstHalf).length}試合（${pct(d.filter(firstHalf).length, d.length)}）/ 第4Q残り5分以降・延長 ${d.filter(late).length}試合（${pct(d.filter(late).length, d.length)}）/ 延長 ${d.filter((g) => g.ot).length}試合`)
    lines.push(`${head} 試合開始1分以内にリードを奪い、最後まで一度も譲らなかった試合 ${d.filter((g) => !g.ot && g.t < 60).length}試合`)
    const close = d.filter((g) => g.margin <= 5)
    const blowout = d.filter((g) => g.margin >= 15)
    lines.push(`${head} 最終点差5点以内の試合 ${close.length}試合のうち、第4Q残り5分以降・延長に決着 ${pct(close.filter(late).length, close.length)} / 前半に決着 ${pct(close.filter(firstHalf).length, close.length)}`)
    lines.push(`${head} 最終点差15点以上の試合 ${blowout.length}試合のうち、前半に決着 ${pct(blowout.filter(firstHalf).length, blowout.length)}`)
  }
  return lines
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
    `**種類**: ${p.kind === 'evergreen' ? '定番（データ・歴史・解説）' : '速報（今日の出来事）'} / **カテゴリ**: \`${p.category}\` / **主役**: ${p.focus}`,
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
    `<!-- newsroom:category=${p.category} kind=${p.kind} -->`,
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

  // 読者の需要: 直近28日によく読まれた記事と検索クエリ（GA4・Search Console が設定されていれば）
  const analytics = await fetchAnalytics({ days: 28, top: 10 }).catch(() => null)
  const demand = [
    ...(analytics?.ga?.topPages.length
      ? ['よく読まれた記事（GA4・直近28日のPV）:', ...analytics.ga.topPages.map((p) => `- ${p.title}: ${p.views}`)]
      : []),
    ...(analytics?.gsc?.topQueries.length
      ? [
          '検索クエリ（Search Console・直近28日。表示が多いのに順位が低いものは伸びしろ）:',
          ...analytics.gsc.topQueries.map(
            (q) => `- ${q.query}: 表示 ${q.impressions} / クリック ${q.clicks} / 平均順位 ${q.position.toFixed(1)}`,
          ),
        ]
      : []),
  ]

  const sheetLines = [...buildDataSheet(data, standings), ...buildDiscoverySheet()]
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
    ...describeRecent(recent),
    '',
    '## 読者の需要（定番企画のヒント）',
    ...(demand.length > 0 ? demand : ['（データなし）']),
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
