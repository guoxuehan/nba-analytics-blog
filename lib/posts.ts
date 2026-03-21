import { getSupabase } from '@/lib/supabase'

// ─── 型定義 ────────────────────────────────────────────────────

export type Post = {
  id: string
  title: string
  excerpt: string | null
  category: string
  published_at: string
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

// ─── 日付フォーマット ─────────────────────────────────────────

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Supabase クエリ ──────────────────────────────────────────

export async function getPublishedPosts(limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
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
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
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
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
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
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
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
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
      .neq('slug', excludeSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as Post[]
  } catch {
    return []
  }
}
