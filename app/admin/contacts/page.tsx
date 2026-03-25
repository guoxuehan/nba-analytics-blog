import { getAdminContacts } from './_actions'
import { ContactRow } from './_components/ContactRow'

const S = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px', background: '#fff', border: '1px solid #ddd' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: '#f5f5f5', borderBottom: '2px solid #ddd', color: '#555', whiteSpace: 'nowrap' as const },
}

export default async function AdminContactsPage() {
  const contacts = await getAdminContacts()
  const unreadCount = contacts.filter((c) => !c.read).length

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111' }}>
          お問い合わせ管理
          <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#888' }}>
            ({contacts.length}件
            {unreadCount > 0 && (
              <span style={{ color: '#D32F2F', fontWeight: 600 }}> / 未読 {unreadCount}件</span>
            )}
            )
          </span>
        </h1>
      </div>

      {contacts.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', border: '1px solid #ddd', color: '#888' }}>
          お問い合わせはありません
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>名前</th>
              <th style={S.th}>メールアドレス</th>
              <th style={S.th}>件名</th>
              <th style={S.th}>投稿日時</th>
              <th style={S.th}>本文</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
