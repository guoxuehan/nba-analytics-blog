'use client'

import { useRef, useState } from 'react'

type Props = {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add(value: string) {
    const tag = value.trim().replace(/,$/, '')
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '6px 8px',
        border: '1px solid #ddd',
        borderRadius: '2px',
        background: '#fff',
        cursor: 'text',
        minHeight: '38px',
        alignItems: 'center',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '12px',
            borderRadius: '2px',
          }}
        >
          #{tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(tag) }}
            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '14px' }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length === 0 ? 'タグを入力（Enter or , で追加）' : ''}
        style={{
          border: 'none',
          outline: 'none',
          fontSize: '13px',
          flex: '1',
          minWidth: '120px',
          background: 'transparent',
        }}
      />
    </div>
  )
}
