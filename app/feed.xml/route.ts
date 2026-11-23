import { getPublishedPosts, getPostDate, getCategoryLabel } from '@/lib/posts'
import { SITE_URL } from '@/lib/constants'

// 1時間ごとに作り直す（公開時刻をずらして予約した記事も、時刻を過ぎれば載る）
export const revalidate = 3600

const SITE_TITLE = 'NBA COURT VISION'
const SITE_DESCRIPTION = 'NBAの高度なアナリティクス、選手分析、戦術解説'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const posts = await getPublishedPosts(30)

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/articles/${post.slug}`
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(getPostDate(post)).toUTCString()}</pubDate>`,
        `      <category>${escapeXml(getCategoryLabel(post.category))}</category>`,
        post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const lastBuild = posts[0] ? new Date(getPostDate(posts[0])).toUTCString() : new Date().toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
