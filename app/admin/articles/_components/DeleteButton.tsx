'use client'

import { deleteArticleAction } from '../_actions'

export function DeleteButton({ id, title }: { id: string; title: string }) {
  async function handleDelete() {
    if (!confirm(`「${title}」を削除しますか？`)) return
    await deleteArticleAction(id)
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      style={{ fontSize: '12px', color: '#D32F2F', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
    >
      削除
    </button>
  )
}
