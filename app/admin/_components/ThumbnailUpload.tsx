'use client'

import { useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (url: string) => void
}

export function ThumbnailUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onChange(json.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* プレビュー */}
      {value && (
        <div style={{ marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="サムネイル" style={{ height: '120px', width: 'auto', borderRadius: '2px', border: '1px solid #ddd', display: 'block' }} />
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer', padding: '2px 6px', fontSize: '11px' }}
          >
            削除
          </button>
        </div>
      )}

      {/* URL 直接入力 */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://... または下からアップロード"
        style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '2px', boxSizing: 'border-box', marginBottom: '8px' }}
      />

      {/* ファイルアップロードボタン */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 600,
          border: '1px solid #ddd',
          borderRadius: '2px',
          background: uploading ? '#f0f0f0' : '#fff',
          cursor: uploading ? 'not-allowed' : 'pointer',
          color: '#333',
        }}
      >
        {uploading ? 'アップロード中...' : '画像を選択'}
      </button>

      {error && <p style={{ color: '#D32F2F', fontSize: '12px', marginTop: '4px' }}>{error}</p>}
    </div>
  )
}
