'use client'

import { useState, useTransition } from 'react'
import { markContactReadAction, type AdminContact } from '../_actions'

const S = {
  td: { padding: '10px 14px', borderBottom: '1px solid #eee', verticalAlign: 'top' as const, color: '#333' },
  expandTd: { padding: '0 14px 14px 14px', borderBottom: '1px solid #eee', background: '#fafafa' },
}

export function ContactRow({ contact }: { contact: AdminContact }) {
  const [expanded, setExpanded] = useState(false)
  const [isRead, setIsRead] = useState(contact.read)
  const [, startTransition] = useTransition()

  function handleClick() {
    const opening = !expanded
    setExpanded(opening)
    if (opening && !isRead) {
      setIsRead(true)
      startTransition(async () => {
        await markContactReadAction(contact.id)
      })
    }
  }

  const unreadStyle = !isRead ? { background: '#fffde7' } : {}

  return (
    <>
      <tr
        onClick={handleClick}
        style={{ cursor: 'pointer', transition: 'background 0.1s', ...unreadStyle }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f5f5f5' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isRead ? '' : '#fffde7' }}
      >
        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
          {!isRead && (
            <span style={{
              display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
              background: '#D32F2F', marginRight: '6px', verticalAlign: 'middle', flexShrink: 0,
            }} />
          )}
          <span style={{ fontWeight: isRead ? 400 : 700 }}>{contact.name}</span>
        </td>
        <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: '13px', color: '#555' }}>
          {contact.email}
        </td>
        <td style={{ ...S.td, maxWidth: '320px' }}>
          <span style={{ fontWeight: isRead ? 400 : 600, fontSize: '13px' }}>{contact.subject}</span>
        </td>
        <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: '12px', color: '#666' }}>
          {new Date(contact.created_at).toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
          })}
        </td>
        <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: '12px', color: '#999', userSelect: 'none' }}>
          {expanded ? '▲ 閉じる' : '▼ 本文'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={S.expandTd}>
            <div style={{
              padding: '12px 16px', background: '#fff', border: '1px solid #e0e0e0',
              borderRadius: '2px', fontSize: '14px', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#333',
            }}>
              {contact.message}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
