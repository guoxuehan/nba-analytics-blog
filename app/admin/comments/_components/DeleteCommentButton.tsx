'use client'

import { useState } from 'react'
import { deleteCommentAction } from '../_actions'

export function DeleteCommentButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm('このコメントを削除しますか？')) return
    setError(null)
    const result = await deleteCommentAction(id)
    if (result.error) setError(result.error)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        style={{ fontSize: '12px', color: '#D32F2F', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
      >
        削除
      </button>
      {error && (
        <span style={{ fontSize: '12px', color: '#D32F2F', marginLeft: '4px' }}>
          エラー: {error}
        </span>
      )}
    </>
  )
}
