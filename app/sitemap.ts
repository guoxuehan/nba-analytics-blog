import type { MetadataRoute } from 'next'
import { getPublishedPosts, getPostDate } from '@/lib/posts'
import { SITE_URL } from '@/lib/constants'

// 1時間ごとに作り直す。指定しないとデプロイ時点の記事一覧のまま固定され、
// 自動公開した新しい記事が検索エンジンに伝わらない
export const revalidate = 3600

const CATEGORIES =['player_analysis', 'team_analysis', 'tactics', 'data']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts(1000)

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...CATEGORIES.map((category) => ({
      url: `${SITE_URL}/category/${category}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]

  const articlePages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/articles/${post.slug}`,
    lastModified: new Date(getPostDate(post)),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...articlePages]
}
