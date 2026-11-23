/**
 * 🚀 公開: content/articles/*.md を Supabase に反映する（リポジトリが正）
 *
 * - 未掲載の記事 → INSERT（公開時刻は前の記事から PUBLISH_INTERVAL_HOURS ずつずらす）→ マーケ担当に回す
 * - 掲載済みで内容が変わった記事 → UPDATE（公開時刻は変えない）
 * - 管理画面だけで作った記事（リポジトリにない記事）には触れない
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { logUsageSummary } from '../auto-generate'
import { VALID_CATEGORIES } from '../auto-publish'
import { ARTICLES_DIR, ArticleFile, appendSummary, readArticle } from './_lib'
import { promote } from './marketer'

type Row = {
  slug: string
  title: string
  excerpt: string | null
  content: string
  tags: string[]
  category: string
  published_at: string | null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase の環境変数が設定されていません')
  const supabase = createClient(url, key)
  const intervalMs = Math.max(0, parseFloat(process.env.PUBLISH_INTERVAL_HOURS ?? '4')) * 3600 * 1000

  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log('content/articles/ がありません')
    return
  }
  const articles: ArticleFile[] = []
  for (const f of fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md')).sort()) {
    const a = readArticle(path.join(ARTICLES_DIR, f))
    if (!a || !a.meta.slug || !a.meta.title || !VALID_CATEGORIES.includes(a.meta.category)) {
      console.warn(`⚠️  ${f}: frontmatter が不正なためスキップ`)
      continue
    }
    articles.push(a)
  }

  const { data: existing, error } = await supabase
    .from('articles')
    .select('slug, title, excerpt, content, tags, category, published_at')
    .in('slug', articles.map((a) => a.meta.slug))
  if (error) throw new Error(`記事の取得に失敗: ${error.message}`)
  const bySlug = new Map((existing as Row[]).map((r) => [r.slug, r]))

  const { data: latestRow } = await supabase
    .from('articles')
    .select('published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let nextSlot = Math.max(Date.now(), latestRow?.published_at ? new Date(latestRow.published_at).getTime() + intervalMs : 0)

  const inserted: { article: ArticleFile; publishedAt: string }[] = []
  const updated: string[] = []
  const failures: string[] = []
  for (const a of articles) {
    const { meta, body } = a
    const row = bySlug.get(meta.slug)
    const fields = {
      title: meta.title,
      excerpt: meta.excerpt || null,
      content: body,
      tags: meta.tags,
      category: meta.category,
    }

    if (!row) {
      const publishedAt = new Date(nextSlot).toISOString()
      nextSlot += intervalMs
      const now = new Date().toISOString()
      const { error: insErr } = await supabase.from('articles').insert({
        ...fields,
        slug: meta.slug,
        thumbnail_url: null,
        published: true,
        published_at: publishedAt,
        created_at: now,
        updated_at: now,
      })
      if (insErr) {
        console.error(`❌ ${meta.slug}: INSERT 失敗 — ${insErr.message}`)
        failures.push(meta.slug)
        continue
      }
      console.log(`🚀 公開: ${meta.slug}（${publishedAt}）`)
      inserted.push({ article: a, publishedAt })
      continue
    }

    const changed =
      row.title !== fields.title ||
      (row.excerpt ?? null) !== fields.excerpt ||
      row.content !== fields.content ||
      row.category !== fields.category ||
      JSON.stringify(row.tags) !== JSON.stringify(fields.tags)
    if (!changed) continue

    const { error: updErr } = await supabase
      .from('articles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('slug', meta.slug)
    if (updErr) {
      console.error(`❌ ${meta.slug}: UPDATE 失敗 — ${updErr.message}（RLS の UPDATE ポリシーを確認）`)
      failures.push(meta.slug)
      continue
    }
    console.log(`✏️  更新: ${meta.slug}`)
    updated.push(meta.slug)
  }

  // マーケ担当: 新しく公開した記事の配信案を作る（失敗しても公開は取り消さない）
  for (const { article, publishedAt } of inserted) {
    try {
      await promote(article, publishedAt)
    } catch (err) {
      console.warn(`⚠️  ${article.meta.slug}: 配信案の作成に失敗 — ${err instanceof Error ? err.message : err}`)
    }
  }

  appendSummary(
    [
      '### 🚀 公開',
      ...inserted.map(({ article, publishedAt }) => `- 新規: ${article.meta.title}（${publishedAt}）`),
      ...updated.map((s) => `- 更新: ${s}`),
      inserted.length + updated.length === 0 ? '- 変更なし' : '',
    ].join('\n'),
  )
  if (inserted.length > 0) logUsageSummary()

  // 失敗として扱い、GitHub Actions の通知で気づけるようにする
  if (failures.length > 0) {
    throw new Error(`${failures.length}件の反映に失敗しました: ${failures.join(', ')}`)
  }
}

main().catch((err) => {
  console.error('❌ 公開:', err instanceof Error ? err.message : err)
  process.exit(1)
})
