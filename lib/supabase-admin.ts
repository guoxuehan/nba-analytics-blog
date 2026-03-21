import { createClient } from '@supabase/supabase-js'

// サービスロールキー（RLS をバイパスして全記事にアクセス）
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase管理者環境変数が設定されていません')
  }
  return createClient(url, key)
}
