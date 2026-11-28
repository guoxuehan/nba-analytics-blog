/**
 * 📈 図版デスク: ライターの原稿と取材メモから、主張を支えるグラフ（```chart ブロック）を0〜2点入れる
 *
 * - 職務記述書は .claude/agents/graphics-desk.md
 * - 取材メモにない数字を含む図、形式の崩れた図は、ここで機械的に外す
 * - 失敗しても執筆は止めない（図なしで入稿する）
 */
import { MODEL } from '../auto-generate'
import { ChartSpec, parseChart } from '../../lib/chart'
import { callJson, loadPersona } from './_lib'

const MAX_CHARTS = 2

type Proposal = {
  after: string
  reason: string
  type: 'line' | 'bar'
  title: string
  subtitle: string
  unit: string
  x: string[]
  series: { name: string; values: number[] }[]
  highlight: string
  source: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['charts'],
  properties: {
    charts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['after', 'reason', 'type', 'title', 'subtitle', 'unit', 'x', 'series', 'highlight', 'source'],
        properties: {
          after: { type: 'string', description: '図を置く直前の本文の1文（原文のまま）' },
          reason: { type: 'string', description: 'この図で読者に何が伝わるか（1文）' },
          type: { type: 'string', enum: ['line', 'bar'] },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          unit: { type: 'string' },
          x: { type: 'array', items: { type: 'string' } },
          series: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'values'],
              properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'number' } } },
            },
          },
          highlight: { type: 'string', description: '強調する x の値。なければ空文字' },
          source: { type: 'string' },
        },
      },
    },
  },
}

/** 値が取材メモに書かれているか（「35.1」「35.10」「35」などの表記ゆれは許す） */
function inNotes(v: number, notes: string): boolean {
  const forms = new Set([String(v), v.toFixed(1), v.toFixed(2), v.toLocaleString('en-US')])
  // 前後が数字（「35」が「135」や「35.1」の一部）の場合は一致とみなさない
  return [...forms].some((f) => new RegExp(`(^|[^0-9.])${f.replace(/[.,]/g, '\\$&')}(?![0-9]|\\.[0-9])`).test(notes))
}

/** 図を置く段落の位置。見つからなければ -1 */
function findAnchor(paragraphs: string[], after: string): number {
  const needle = after.trim().replace(/\s+/g, '')
  if (needle.length < 8) return -1
  const flat = paragraphs.map((p) => p.replace(/\s+/g, ''))
  let i = flat.findIndex((p) => !p.startsWith('#') && p.includes(needle))
  if (i < 0) i = flat.findIndex((p) => !p.startsWith('#') && p.includes(needle.slice(0, 20)))
  return i
}

export async function addCharts(
  body: string,
  notes: string,
  title: string,
): Promise<{ body: string; added: { title: string; reason: string }[]; dropped: string[] }> {
  const { charts } = await callJson<{ charts: Proposal[] }>({
    model: MODEL,
    system: loadPersona('graphics-desk'),
    user: [
      `次の原稿に、主張を支えるグラフを0〜${MAX_CHARTS}点入れるか判断してほしい。入れない場合は charts を空にする。`,
      '',
      `# 原稿: ${title}`,
      '',
      body,
      '',
      '---',
      '',
      notes,
    ].join('\n'),
    schema: SCHEMA,
    effort: 'medium',
    maxTokens: 16000,
  })

  const paragraphs = body.split(/\n{2,}/)
  const inserts = new Map<number, string[]>()
  const added: { title: string; reason: string }[] = []
  const dropped: string[] = []

  for (const c of charts.slice(0, MAX_CHARTS)) {
    const raw = {
      type: c.type,
      title: c.title,
      subtitle: c.subtitle || undefined,
      unit: c.unit || undefined,
      x: c.x,
      series: c.series,
      highlight: c.highlight || undefined,
      source: c.source,
    }
    const parsed = parseChart(JSON.stringify(raw))
    if ('error' in parsed) {
      dropped.push(`「${c.title}」: ${parsed.error}`)
      continue
    }
    const spec: ChartSpec = parsed.spec
    const missing = spec.series.flatMap((s) => s.values).filter((v) => !inNotes(v, notes))
    if (missing.length > 0) {
      dropped.push(`「${c.title}」: 取材メモにない値（${missing.slice(0, 3).join(', ')}）`)
      continue
    }
    const at = findAnchor(paragraphs, c.after)
    if (at < 0) {
      dropped.push(`「${c.title}」: 置き場所の文が本文に見つからない`)
      continue
    }
    const block = ['```chart', JSON.stringify(spec), '```'].join('\n')
    inserts.set(at, [...(inserts.get(at) ?? []), block])
    added.push({ title: spec.title, reason: c.reason })
  }

  const out = paragraphs.flatMap((p, i) => [p, ...(inserts.get(i) ?? [])])
  return { body: out.join('\n\n'), added, dropped }
}
