'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/admin-auth'

export type AdminComment = {
  id: string
  author_name: string
  content: string
  created_at: string
  articles: { title: string; slug: string } | null
}

export async function getAdminComments(): Promise<AdminComment[]> {
  await requireAdminAuth()

  const { data, error } = await getSupabaseAdmin()
    .from('comments')
    .select('id, author_name, content, created_at, articles(title, slug)')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as AdminComment[]
}

export async function deleteCommentAction(id: string): Promise<{ error?: string }> {
  await requireAdminAuth()

  const { error } = await getSupabaseAdmin()
    .from('comments')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/comments')
  return {}
}
