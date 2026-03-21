'use client'

import { useState, useTransition } from 'react'
import { formatDate } from '@/lib/posts'

export type Comment = {
  id: string
  author_name: string
  content: string
  created_at: string
}

type Props = {
  articleId: string
  initialComments: Comment[]
}

export function CommentSection({ articleId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    startTransition(async () => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, authorName, content }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? '投稿に失敗しました')
        return
      }

      setComments((prev) => [json.comment, ...prev])
      setAuthorName('')
      setContent('')
      setSuccess(true)
    })
  }

  return (
    <section className="mt-12 pt-8 border-t border-border">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-3 mb-8 pb-3 border-b border-border">
        <div
          className="shrink-0"
          style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }}
          aria-hidden="true"
        />
        <h2
          className="font-heading font-bold text-text-primary uppercase"
          style={{ fontSize: '13px', letterSpacing: '0.1em' }}
        >
          COMMENTS
          {comments.length > 0 && (
            <span className="ml-2 text-text-secondary font-body normal-case" style={{ fontSize: '12px' }}>
              ({comments.length})
            </span>
          )}
        </h2>
      </div>

      {/* 投稿フォーム */}
      <form onSubmit={handleSubmit} className="mb-10">
        <div className="flex flex-col gap-4" style={{ maxWidth: '560px' }}>
          <div>
            <label
              htmlFor="comment-author"
              className="block font-heading font-bold text-text-secondary uppercase mb-1"
              style={{ fontSize: '11px', letterSpacing: '0.08em' }}
            >
              名前 *
            </label>
            <input
              id="comment-author"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={100}
              required
              placeholder="表示名"
              className="w-full bg-bg-secondary border border-border text-text-primary font-body focus:outline-none focus:border-accent transition-colors duration-150"
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label
              htmlFor="comment-content"
              className="block font-heading font-bold text-text-secondary uppercase mb-1"
              style={{ fontSize: '11px', letterSpacing: '0.08em' }}
            >
              コメント *
            </label>
            <textarea
              id="comment-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              required
              rows={4}
              placeholder="コメントを入力..."
              className="w-full bg-bg-secondary border border-border text-text-primary font-body focus:outline-none focus:border-accent transition-colors duration-150 resize-y"
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '2px', minHeight: '96px' }}
            />
          </div>

          {error && (
            <p className="text-[13px] font-body" style={{ color: 'var(--accent)' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-[13px] font-body text-text-secondary">
              コメントを投稿しました。
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="self-start font-heading font-bold uppercase transition-opacity duration-150"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '8px 20px',
              fontSize: '12px',
              letterSpacing: '0.08em',
              borderRadius: '2px',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? '投稿中...' : '投稿する'}
          </button>
        </div>
      </form>

      {/* コメント一覧 */}
      {comments.length === 0 ? (
        <p className="text-text-secondary font-body text-sm">まだコメントはありません。</p>
      ) : (
        <div className="flex flex-col">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="py-5 border-b border-border last:border-b-0"
            >
              <div className="flex items-baseline gap-3 mb-2">
                <span
                  className="font-heading font-bold text-text-primary"
                  style={{ fontSize: '13px', letterSpacing: '0.02em' }}
                >
                  {comment.author_name}
                </span>
                <time
                  className="text-text-secondary font-body"
                  style={{ fontSize: '11px' }}
                  dateTime={comment.created_at}
                >
                  {formatDate(comment.created_at)}
                </time>
              </div>
              <p
                className="text-text-primary font-body leading-relaxed whitespace-pre-wrap"
                style={{ fontSize: '14px' }}
              >
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
