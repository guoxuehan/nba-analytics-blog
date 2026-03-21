import Link from 'next/link'
import { getAdminArticles } from './_actions'
import { DeleteButton } from './_components/DeleteButton'

const S = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px', background: '#fff', border: '1px solid #ddd' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: '#f5f5f5', borderBottom: '2px solid #ddd', color: '#555', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 14px', borderBottom: '1px solid #eee', verticalAlign: 'top' as const, color: '#333' },
  badge: (published: boolean) => ({
    display: 'inline-block' as const,
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '2px',
    background: published ? '#1565C0' : '#757575',
    color: '#fff',
  }),
  link: { color: '#1565C0', textDecoration: 'none' as const, fontWeight: 600 },
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const validFilter = (filter === 'published' || filter === 'draft') ? filter : 'all'
  const articles = await getAdminArticles(validFilter)

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111' }}>記事一覧</h1>
        <Link href="/admin/articles/new" style={{ background: '#D32F2F', color: '#fff', padding: '8px 16px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', borderRadius: '2px' }}>
          + 新規作成
        </Link>
      </div>

      {/* フィルタ */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['all', 'published', 'draft'] as const).map((f) => (
          <Link
            key={f}
            href={`/admin/articles${f !== 'all' ? `?filter=${f}` : ''}`}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '2px',
              border: '1px solid #ddd',
              background: validFilter === f ? '#111' : '#fff',
              color: validFilter === f ? '#fff' : '#555',
            }}
          >
            {f === 'all' ? 'すべて' : f === 'published' ? '公開中' : '下書き'}
            {' '}
            {validFilter === f && `(${articles.length})`}
          </Link>
        ))}
      </div>

      {/* テーブル */}
      {articles.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', border: '1px solid #ddd', color: '#888' }}>
          記事がありません
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>タイトル</th>
              <th style={S.th}>カテゴリ</th>
              <th style={S.th}>状態</th>
              <th style={S.th}>公開日時</th>
              <th style={S.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td style={S.td}>
                  <Link href={`/admin/articles/${article.id}/edit`} style={S.link}>
                    {article.title || '(無題)'}
                  </Link>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    /{article.slug}
                  </div>
                </td>
                <td style={S.td}>{article.category}</td>
                <td style={S.td}>
                  <span style={S.badge(article.published)}>
                    {article.published ? '公開中' : '下書き'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {article.published_at
                      ? new Date(article.published_at).toLocaleDateString('ja-JP')
                      : '—'}
                  </span>
                </td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link href={`/admin/articles/${article.id}/edit`} style={{ ...S.link, fontSize: '12px' }}>
                      編集
                    </Link>
                    <Link href={`/articles/${article.slug}`} target="_blank" style={{ fontSize: '12px', color: '#555', textDecoration: 'none' }}>
                      表示
                    </Link>
                    <DeleteButton id={article.id} title={article.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
