import { getSupabase } from '@/lib/supabase'

// ─── 型定義 ────────────────────────────────────────────────────

export type Post = {
  id: string
  title: string
  excerpt: string | null
  category: string
  published_at: string | null
  created_at: string
  thumbnail_url: string | null
  slug: string
  published: boolean
}

export type PostDetail = Post & {
  content: string
  tags: string[]
}

// ─── 読了時間（500字/分で計算） ───────────────────────────────

export function calculateReadingTime(content: string): number {
  const charCount = content.replace(/\s/g, '').length
  return Math.max(1, Math.ceil(charCount / 500))
}

// ─── カテゴリ別プレースホルダーグラデーション ─────────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  player_analysis: 'linear-gradient(155deg, #0a1628 0%, #0f2744 60%, #153455 100%)',
  team_analysis:   'linear-gradient(155deg, #0a150a 0%, #112211 60%, #172b17 100%)',
  tactics:         'linear-gradient(155deg, #1a0800 0%, #3a1200 60%, #4a1a00 100%)',
  data:            'linear-gradient(155deg, #090912 0%, #10101e 60%, #191930 100%)',
}

const CATEGORY_LABELS: Record<string, string> = {
  player_analysis: '選手分析',
  team_analysis:   'チーム分析',
  tactics:         '戦術',
  data:            'データ',
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? 'linear-gradient(155deg, #0d0d0d 0%, #1a1a1a 100%)'
}

// ─── 日付ユーティリティ ──────────────────────────────────────

/**
 * 表示用の日付文字列を返す。
 * published_at が null の場合は created_at をフォールバックとして使用。
 */
export function getPostDate(post: { published_at: string | null; created_at: string }): string {
  return post.published_at ?? post.created_at
}

/**
 * ISO 日付文字列を「2026年3月25日」形式にフォーマットする。
 * タイムゾーンは Asia/Tokyo に統一。
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}

// ─── Supabase クエリ ──────────────────────────────────────────

export async function getPublishedPosts(limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (error || !data) return null
    return data as PostDetail
  } catch {
    return null
  }
}

export async function getRelatedPosts(
  category: string,
  currentSlug: string,
  limit = 3,
): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .eq('category', category)
      .neq('slug', currentSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}

export async function getPostsByCategory(category: string, limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .eq('category', category)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}

export async function getPostsByTag(tag: string, limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .contains('tags', [tag])
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}

export async function getRecentPosts(excludeSlug: string, limit = 5): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .neq('slug', excludeSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}
