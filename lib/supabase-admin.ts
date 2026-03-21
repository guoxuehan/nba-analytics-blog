import { createClient } from '@supabase/supabase-js'

// サービスロールキー（RLS をバイパスして全記事にアクセス）
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
