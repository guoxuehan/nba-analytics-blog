'use client'

import { deleteCommentAction } from '../_actions'

export function DeleteCommentButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm('このコメントを削除しますか？')) return
    await deleteCommentAction(id)
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
