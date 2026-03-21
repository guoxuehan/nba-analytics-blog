'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from './MarkdownEditor'
import { TagInput } from './TagInput'
import { ThumbnailUpload } from './ThumbnailUpload'
import { saveArticleAction, type ArticleFormData } from '@/app/admin/articles/_actions'

const CATEGORIES = [
  { value: 'player_analysis', label: '選手分析' },
  { value: 'team_analysis',   label: 'チーム分析' },
  { value: 'tactics',         label: '戦術' },
  { value: 'data',            label: 'データ' },
] as const

// slug 自動生成（ASCII 抽出 → フォールバックで timestamp）
function generateSlug(title: string): string {
  const ascii = title
    .replace(/[^\x00-\x7F]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return ascii.length >= 3 ? ascii : `post-${Date.now()}`
}

const defaultForm: ArticleFormData = {
  title: '',
  slug: '',
  category: 'player_analysis',
  excerpt: '',
  content: '',
  tags: [],
  thumbnail_url: '',
  published: false,
}

// ─── ラベル + フィールドのラッパー ────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '14px',
  border: '1px solid #ddd',
  borderRadius: '2px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  background: '#fff',
}

// ─── メインエディタ ───────────────────────────────────────────

export function ArticleEditor({ initialData }: { initialData?: ArticleFormData }) {
  const router = useRouter()
  const [form, setForm] = useState<ArticleFormData>(initialData ?? defaultForm)
  const [slugLocked, setSlugLocked] = useState(!!initialData?.id)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [aiTheme, setAiTheme] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const update = useCallback(<K extends keyof ArticleFormData>(key: K, value: ArticleFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  // タイトルから slug 自動生成
  useEffect(() => {
    if (!slugLocked) {
      update('slug', generateSlug(form.title))
    }
  }, [form.title, slugLocked, update])

  // 抜粋自動生成
  function autoExcerpt() {
    const plain = form.content.replace(/[#*`>_~\[\]()]/g, '').replace(/\n+/g, ' ').trim()
    update('excerpt', plain.slice(0, 150) + (plain.length > 150 ? '…' : ''))
  }

  // AI 下書き生成
  async function generateAIDraft() {
    if (!aiTheme.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/admin/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: aiTheme }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? '生成失敗')
      update('content', json.content)
      setMessage({ type: 'success', text: 'AI下書きを挿入しました' })
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setAiLoading(false)
    }
  }

  // 保存
  async function save(publish: boolean) {
    if (!form.title.trim()) { setMessage({ type: 'error', text: 'タイトルを入力してください' }); return }
    if (!form.slug.trim()) { setMessage({ type: 'error', text: 'slug を入力してください' }); return }
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveArticleAction({ ...form, published: publish })
      if ('error' in result) throw new Error(result.error)
      setMessage({ type: 'success', text: publish ? '公開しました' : '下書きを保存しました' })
      if (!form.id && result.id) {
        router.push(`/admin/articles/${result.id}/edit`)
      } else {
        setForm((f) => ({ ...f, published: publish }))
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* ─── ヘッダーバー ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="記事タイトルを入力"
            style={{ ...inputStyle, fontSize: '22px', fontWeight: 700, border: 'none', borderBottom: '2px solid #ddd', borderRadius: 0, padding: '6px 0', background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {message && (
            <span style={{ fontSize: '12px', color: message.type === 'success' ? '#2e7d32' : '#D32F2F', fontWeight: 600 }}>
              {message.text}
            </span>
          )}
          <button onClick={() => save(false)} disabled={saving} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, border: '1px solid #ddd', borderRadius: '2px', background: '#fff', cursor: 'pointer', color: '#333' }}>
            下書き保存
          </button>
          <button onClick={() => save(true)} disabled={saving} style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700, border: 'none', borderRadius: '2px', background: saving ? '#999' : '#D32F2F', color: '#fff', cursor: 'pointer' }}>
            {saving ? '保存中...' : '公開する'}
          </button>
        </div>
      </div>

      {/* ─── AI 下書き生成 ──────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderLeft: '3px solid #1565C0', padding: '1rem', marginBottom: '1.5rem', borderRadius: '0 2px 2px 0' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          AI 下書き生成
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={aiTheme}
            onChange={(e) => setAiTheme(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateAIDraft()}
            placeholder="例：カイリー・アービングの今季における3Pショット選択の変化"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={generateAIDraft}
            disabled={aiLoading || !aiTheme.trim()}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: aiLoading ? '#999' : '#1565C0', color: '#fff', border: 'none', borderRadius: '2px', cursor: aiLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {aiLoading ? '生成中...' : 'AI 下書き生成'}
          </button>
        </div>
        {aiError && <p style={{ color: '#D32F2F', fontSize: '12px', marginTop: '6px' }}>{aiError}</p>}
        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: '#555', fontSize: '13px' }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Claude が生成中です...
          </div>
        )}
      </div>

      {/* ─── Markdown エディタ ──────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
          本文（Markdown）
        </label>
        <MarkdownEditor value={form.content} onChange={(v) => update('content', v)} />
      </div>

      {/* ─── メタデータ（2カラム） ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* 左カラム */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="Slug（URL）">
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={form.slug}
                onChange={(e) => { setSlugLocked(true); update('slug', e.target.value) }}
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => { setSlugLocked(false); update('slug', generateSlug(form.title)) }}
                style={{ padding: '0 10px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '2px', background: '#f5f5f5', cursor: 'pointer', whiteSpace: 'nowrap', color: '#555' }}
              >
                再生成
              </button>
            </div>
          </Field>

          <Field label="カテゴリ">
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              style={{ ...inputStyle }}
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="タグ">
            <TagInput tags={form.tags} onChange={(t) => update('tags', t)} />
          </Field>
        </div>

        {/* 右カラム */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label="抜粋（リード文）">
            <div>
              <textarea
                value={form.excerpt}
                onChange={(e) => update('excerpt', e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
                placeholder="記事一覧・OGPに使用される要約文"
              />
              <button
                type="button"
                onClick={autoExcerpt}
                style={{ marginTop: '4px', fontSize: '11px', padding: '3px 10px', border: '1px solid #ddd', borderRadius: '2px', background: '#f5f5f5', cursor: 'pointer', color: '#555' }}
              >
                本文から自動生成（150字）
              </button>
            </div>
          </Field>

          <Field label="サムネイル画像">
            <ThumbnailUpload value={form.thumbnail_url} onChange={(url) => update('thumbnail_url', url)} />
          </Field>
        </div>
      </div>

      {/* ─── ステータス表示 ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 1rem', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '2px', fontSize: '12px', color: '#555' }}>
        <span>状態: <strong style={{ color: form.published ? '#1565C0' : '#757575' }}>{form.published ? '公開中' : '下書き'}</strong></span>
        {form.id && <span>ID: <code style={{ fontFamily: 'monospace' }}>{form.id}</code></span>}
        {form.published_at && <span>公開日: {new Date(form.published_at).toLocaleDateString('ja-JP')}</span>}
      </div>
    </div>
  )
}
