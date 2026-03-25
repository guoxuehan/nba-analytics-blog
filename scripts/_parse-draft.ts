/**
 * ドラフトMDファイルのパーサー（METADATA/BODYブロック形式 & YAML frontmatter 両対応）
 */

export type DraftMeta = {
  title: string
  slug: string
  category: string
  tags: string[]
  excerpt: string
}

export type ParsedDraft = {
  meta: DraftMeta
  body: string
}

/** ---METADATA--- / ---BODY--- 形式をパース */
function parseBlockFormat(content: string): ParsedDraft | null {
  const metaMatch = content.match(/---METADATA---\r?\n([\s\S]*?)\r?\n---METADATA---/)
  const bodyMatch = content.match(/---BODY---\r?\n([\s\S]*?)\r?\n---BODY---/)
  if (!metaMatch || !bodyMatch) return null

  const meta = parseKeyValues(metaMatch[1])
  return { meta, body: bodyMatch[1].trim() }
}

/** --- YAML frontmatter --- 形式をパース */
function parseYamlFrontmatter(content: string): ParsedDraft | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  const meta = parseKeyValues(match[1])
  return { meta, body: match[2].trim() }
}

function parseKeyValues(block: string): DraftMeta {
  const result: Record<string, string | string[]> = {}

  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()

    if (key === 'tags') {
      // "tag1, tag2" or '["tag1","tag2"]' どちらにも対応
      if (value.startsWith('[')) {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      } else {
        result[key] = value.split(',').map((t) => t.trim()).filter(Boolean)
      }
    } else {
      result[key] = value.replace(/^["']|["']$/g, '')
    }
  }

  return {
    title: (result['title'] as string) ?? '',
    slug: (result['slug'] as string) ?? '',
    category: (result['category'] as string) ?? '',
    tags: (result['tags'] as string[]) ?? [],
    excerpt: (result['excerpt'] as string) ?? '',
  }
}

export function parseDraft(content: string): ParsedDraft | null {
  return parseBlockFormat(content) ?? parseYamlFrontmatter(content)
}
