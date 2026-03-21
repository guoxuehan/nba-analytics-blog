import { createClient } from '@supabase/supabase-js'

// anon key + RLS で管理操作を行う
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase環境変数が設定されていません')
  }
  return createClient(url, key)
}
