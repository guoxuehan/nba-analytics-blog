'use client'

import { useState } from 'react'
import { deleteArticleAction } from '../_actions'

export function DeleteButton({ id, title }: { id: string; title: string }) {
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm(`「${title}」を削除しますか？`)) return
    setError(null)
    const result = await deleteArticleAction(id)
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
