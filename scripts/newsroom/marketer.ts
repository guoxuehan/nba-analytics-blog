/**
 * 📣 マーケ担当: 公開した記事のX投稿文を作り、配信Issueを起票する
 *
 * publisher.ts から呼ばれる。単体でも実行できる:
 *   npx tsx scripts/newsroom/marketer.ts <slug>
 */
import * as path from 'path'
import { fileURLToPath } from 'url'
import { MODEL, logUsageSummary } from '../auto-generate'
import { ARTICLES_DIR, LABELS, SITE_URL, ArticleFile, callJson, createIssue, loadPersona, readArticle } from './_lib'

type Post = { type: string; text: string }

const POST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'text'],
        properties: {
          type: { type: 'string', enum: ['データ訴求型', '議論喚起型', 'ストーリー型'] },
          text: { type: 'string', description: 'X投稿文（ハッシュタグ込み、URLなし、120字以内）' },
        },
      },
    },
  },
}

function toJST(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' })
}

export async function promote(article: ArticleFile, publishedAt: string): Promise<number> {
  const { meta, body } = article
  const url = `${SITE_URL}/articles/${meta.slug}`
  const { posts } = await callJson<{ posts: Post[] }>({
    model: MODEL,
    system: loadPersona('marketer'),
    user: `次の記事のX投稿文を3パターン作ってほしい。\n\n# ${meta.title}\n\n${meta.excerpt}\n\n${body}`,
    schema: POST_SCHEMA,
    effort: 'low',
    maxTokens: 8000,
  })

  const issueBody = [
    `> 📣 マーケ担当が作った配信案です。投稿したらこのIssueをクローズしてください。`,
    '',
    `**記事**: [${meta.title}](${url})`,
    `**公開時刻**: ${toJST(publishedAt)}（この時刻以降に投稿）`,
    meta.issue ? `**企画**: #${meta.issue}` : '',
    '',
    ...posts.flatMap((p) => [`### ${p.type}（${p.text.length}字）`, '```text', `${p.text}\n${url}`, '```', '']),
  ].join('\n')

  const num = createIssue(`[配信] ${meta.title}`, issueBody, [LABELS.promo])
  console.log(`  📣 配信Issue #${num}`)
  return num
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (isMain) {
  const slug = process.argv[2]
  const article = slug ? readArticle(path.join(ARTICLES_DIR, `${slug}.md`)) : null
  if (!article) {
    console.error('使い方: npx tsx scripts/newsroom/marketer.ts <slug>')
    process.exit(1)
  }
  promote(article, new Date().toISOString())
    .then(() => logUsageSummary())
    .catch((err) => {
      console.error('❌ マーケ担当:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
