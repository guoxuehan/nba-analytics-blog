import { getPublishedPosts, getPostDate } from '@/lib/posts'
import { SITE_URL } from '@/lib/constants'

// Google ニュース用サイトマップ。直近2日の記事だけを載せる決まりのため、1時間ごとに作り直す
export const revalidate = 3600

const PUBLICATION_NAME = 'NBA COURT VISION'
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const now = Date.now()
  const posts = (await getPublishedPosts(100)).filter((p) => now - new Date(getPostDate(p)).getTime() <= MAX_AGE_MS)

  const urls = posts
    .map((post) =>
      [
        '  <url>',
        `    <loc>${SITE_URL}/articles/${post.slug}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        `        <news:name>${PUBLICATION_NAME}</news:name>`,
        '        <news:language>ja</news:language>',
        '      </news:publication>',
        `      <news:publication_date>${new Date(getPostDate(post)).toISOString()}</news:publication_date>`,
        `      <news:title>${escapeXml(post.title)}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n'),
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
