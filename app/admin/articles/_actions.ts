'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/admin-auth'

// ─── 型 ───────────────────────────────────────────────────────

export type AdminArticle = {
  id: string
  title: string
  slug: string
  category: string
  published: boolean
  published_at: string | null
  created_at: string
}

export type ArticleFormData = {
  id?: string
  title: string
  slug: string
  category: string
  excerpt: string
  content: string
  tags: string[]
  thumbnail_url: string
  published: boolean
  published_at?: string
}

type SaveResult = { success: true; id: string } | { error: string }

// ─── 一覧取得 ─────────────────────────────────────────────────

export async function getAdminArticles(
  filter: 'all' | 'published' | 'draft' = 'all',
): Promise<AdminArticle[]> {
  await requireAdminAuth()

  let query = getSupabaseAdmin()
    .from('articles')
    .select('id, title, slug, category, published, published_at, created_at')
    .order('created_at', { ascending: false })

  if (filter === 'published') query = query.eq('published', true)
  if (filter === 'draft') query = query.eq('published', false)

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as AdminArticle[]
}

// ─── 単件取得（編集画面用） ────────────────────────────────────

export async function getAdminArticle(id: string): Promise<ArticleFormData | null> {
  await requireAdminAuth()

  const { data, error } = await getSupabaseAdmin()
    .from('articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    title: data.title ?? '',
    slug: data.slug ?? '',
    category: data.category ?? '',
    excerpt: data.excerpt ?? '',
    content: data.content ?? '',
    tags: data.tags ?? [],
    thumbnail_url: data.thumbnail_url ?? '',
    published: data.published ?? false,
    published_at: data.published_at ?? undefined,
  }
}

// ─── 保存（新規 or 更新） ─────────────────────────────────────

export async function saveArticleAction(data: ArticleFormData): Promise<SaveResult> {
  await requireAdminAuth()

  const now = new Date().toISOString()

  const payload = {
    title: data.title,
    slug: data.slug,
    category: data.category,
    excerpt: data.excerpt || null,
    content: data.content,
    tags: data.tags,
    thumbnail_url: data.thumbnail_url || null,
    published: data.published,
    // 新規公開時のみ published_at をセット、既存は保持
    published_at: data.published
      ? data.published_at ?? now
      : (data.published_at ?? null),
    updated_at: now,
  }

  if (data.id) {
    const { error } = await getSupabaseAdmin().from('articles').update(payload).eq('id', data.id)
    if (error) return { error: error.message }

    revalidatePath('/admin/articles')
    revalidatePath('/')
    revalidatePath(`/articles/${data.slug}`)
    return { success: true, id: data.id }
  }

  const { data: created, error } = await getSupabaseAdmin()
    .from('articles')
    .insert({ ...payload, created_at: now })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/articles')
  if (data.published) {
    revalidatePath('/')
    revalidatePath(`/articles/${data.slug}`)
  }
  return { success: true, id: created.id }
}

// ─── 削除 ─────────────────────────────────────────────────────

export async function deleteArticleAction(id: string): Promise<{ error?: string }> {
  await requireAdminAuth()

  const { error } = await getSupabaseAdmin().from('articles').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/articles')
  revalidatePath('/')
  return {}
}
