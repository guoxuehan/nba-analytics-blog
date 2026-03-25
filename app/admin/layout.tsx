import { cookies } from 'next/headers'
import Link from 'next/link'
import { logoutAction } from './login/_actions'
import { getUnreadContactCount } from './contacts/_actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const isAuthenticated = !!cookieStore.get('admin_session')
  const unreadContactCount = isAuthenticated ? await getUnreadContactCount() : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0', fontFamily: 'system-ui, sans-serif' }}>
      {isAuthenticated && (
        <nav style={{
          background: '#111',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '48px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '3px solid #D32F2F',
        }}>
          <Link href="/admin/articles" style={{ color: '#fff', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textDecoration: 'none' }}>
            NBA COURT VISION ADMIN
          </Link>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/admin/articles" style={{ color: '#ccc', fontSize: '13px', textDecoration: 'none' }}>
              記事一覧
            </Link>
            <Link href="/admin/comments" style={{ color: '#ccc', fontSize: '13px', textDecoration: 'none' }}>
              コメント
            </Link>
            <Link href="/admin/contacts" style={{ color: '#ccc', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              お問い合わせ
              {unreadContactCount > 0 && (
                <span style={{
                  background: '#D32F2F', color: '#fff', fontSize: '10px', fontWeight: 700,
                  borderRadius: '10px', padding: '1px 6px', lineHeight: 1.6, minWidth: '18px', textAlign: 'center',
                }}>
                  {unreadContactCount}
                </span>
              )}
            </Link>
            <Link href="/admin/articles/new" style={{ color: '#fff', fontSize: '12px', background: '#D32F2F', padding: '4px 12px', textDecoration: 'none', borderRadius: '2px', fontWeight: 700 }}>
              + 新規作成
            </Link>
            <form action={logoutAction}>
              <button type="submit" style={{ color: '#999', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ログアウト
              </button>
            </form>
          </div>
        </nav>
      )}
      <main style={{ padding: isAuthenticated ? '2rem' : '0' }}>
        {children}
      </main>
    </div>
  )
}
