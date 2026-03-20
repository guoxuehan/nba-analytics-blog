'use client'

import { useRef } from 'react'
import { ArticleContent } from '@/app/components/ArticleContent'

type Props = {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Tab キーでインデント
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      // カーソル位置を維持
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '2px', overflow: 'hidden' }}>
      {/* ツールバー */}
      <div style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '6px 10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[
          { label: 'H2', insert: '\n## ' },
          { label: 'H3', insert: '\n### ' },
          { label: 'B', insert: '**テキスト**' },
          { label: 'I', insert: '*テキスト*' },
          { label: 'Link', insert: '[テキスト](URL)' },
          { label: 'Code', insert: '`code`' },
          { label: 'Block', insert: '\n```\ncode\n```\n' },
          { label: 'Quote', insert: '\n> ' },
          { label: 'UL', insert: '\n- ' },
          { label: 'OL', insert: '\n1. ' },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => {
              const ta = textareaRef.current
              if (!ta) return
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const selected = value.substring(start, end)
              const insert = selected || btn.insert
              const newValue = value.substring(0, start) + insert + value.substring(end)
              onChange(newValue)
              requestAnimationFrame(() => {
                ta.focus()
                ta.selectionStart = start
                ta.selectionEnd = start + insert.length
              })
            }}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid #ccc',
              borderRadius: '2px',
              background: '#fff',
              cursor: 'pointer',
              color: '#333',
              fontFamily: btn.label === 'I' ? 'serif' : 'inherit',
            }}
          >
            {btn.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#999' }}>
          {value.length.toLocaleString()} 文字
        </span>
      </div>

      {/* 分割エディタ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '520px' }}>
        {/* 入力エリア */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={{
            width: '100%',
            height: '100%',
            padding: '1rem',
            fontSize: '13px',
            lineHeight: '1.7',
            fontFamily: '"Fira Code", "Consolas", "Courier New", monospace',
            border: 'none',
            borderRight: '1px solid #ddd',
            outline: 'none',
            resize: 'none',
            background: '#1e1e1e',
            color: '#d4d4d4',
            boxSizing: 'border-box',
          }}
          placeholder="Markdown を入力..."
        />

        {/* プレビューエリア */}
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '1rem',
            background: '#fff',
            fontSize: '14px',
          }}
        >
          {value ? (
            <ArticleContent content={value} />
          ) : (
            <p style={{ color: '#bbb', fontSize: '13px' }}>プレビューがここに表示されます</p>
          )}
        </div>
      </div>
    </div>
  )
}
