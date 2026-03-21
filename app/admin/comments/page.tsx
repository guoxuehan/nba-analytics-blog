import Link from 'next/link'
import { getAdminComments } from './_actions'
import { DeleteCommentButton } from './_components/DeleteCommentButton'

const S = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px', background: '#fff', border: '1px solid #ddd' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: '#f5f5f5', borderBottom: '2px solid #ddd', color: '#555', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 14px', borderBottom: '1px solid #eee', verticalAlign: 'top' as const, color: '#333' },
}

export default async function AdminCommentsPage() {
  const comments = await getAdminComments()

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111' }}>
          コメント管理
          <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#888' }}>
            ({comments.length}件)
          </span>
        </h1>
      </div>

      {comments.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', border: '1px solid #ddd', color: '#888' }}>
          コメントはありません
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>投稿者</th>
              <th style={S.th}>コメント</th>
              <th style={S.th}>記事</th>
              <th style={S.th}>投稿日時</th>
              <th style={S.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id}>
                <td style={{ ...S.td, whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {comment.author_name}
                </td>
                <td style={{ ...S.td, maxWidth: '360px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', lineHeight: 1.5 }}>
                    {comment.content}
                  </p>
                </td>
                <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                  {comment.article ? (
                    <Link
                      href={`/articles/${comment.article.slug}`}
                      target="_blank"
                      style={{ color: '#1565C0', textDecoration: 'none', fontSize: '12px' }}
                    >
                      {comment.article.title}
                    </Link>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: '12px', color: '#666' }}>
                  {new Date(comment.created_at).toLocaleString('ja-JP', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td style={S.td}>
                  <DeleteCommentButton id={comment.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
