'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/admin-auth'

export type AdminContact = {
  id: string
  name: string
  email: string
  subject: string
  message: string
  read: boolean
  created_at: string
}

export async function getAdminContacts(): Promise<AdminContact[]> {
  await requireAdminAuth()

  const { data, error } = await getSupabaseAdmin()
    .from('contacts')
    .select('id, name, email, subject, message, read, created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as AdminContact[]
}

export async function getUnreadContactCount(): Promise<number> {
  try {
    const { count } = await getSupabaseAdmin()
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
    return count ?? 0
  } catch {
    return 0
  }
}

export async function markContactReadAction(id: string): Promise<{ error?: string }> {
  await requireAdminAuth()

  const { error } = await getSupabaseAdmin()
    .from('contacts')
    .update({ read: true })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/contacts')
  return {}
}
