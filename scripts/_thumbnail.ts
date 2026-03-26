/**
 * サムネイル自動解決モジュール
 * 優先1: thumbnails/ ローカル画像マッチング
 * 優先2: Unsplash API で取得
 * 優先3: なし
 */
import * as fs from 'fs'
import * as path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DraftMeta } from './_parse-draft'

const THUMBNAILS_DIR = path.resolve(process.cwd(), 'thumbnails')
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

// ── カタカナ → 英語マッピング ────────────────────────────────────
const KATA_TO_EN: Record<string, string> = {
  レイカーズ: 'lakers',
  スパーズ: 'spurs',
  サンダー: 'thunder',
  ウェンバンヤマ: 'wembanyama',
  ドンチッチ: 'doncic',
  セルティックス: 'celtics',
  ピストンズ: 'pistons',
  ヒート: 'heat',
  ニックス: 'knicks',
  ロケッツ: 'rockets',
  ウォリアーズ: 'warriors',
  ナゲッツ: 'nuggets',
  バックス: 'bucks',
  ラプターズ: 'raptors',
  マジック: 'magic',
  ホーネッツ: 'hornets',
  ペイサーズ: 'pacers',
  ブルズ: 'bulls',
  キャバリアーズ: 'cavaliers',
  ホークス: 'hawks',
  シクサーズ: 'sixers',
  サンズ: 'suns',
  クリッパーズ: 'clippers',
  キングス: 'kings',
  ジャズ: 'jazz',
  ブレイザーズ: 'blazers',
  ペリカンズ: 'pelicans',
  グリズリーズ: 'grizzlies',
  マーベリックス: 'mavericks',
  ネッツ: 'nets',
  ウィザーズ: 'wizards',
  カリー: 'curry',
  レブロン: 'lebron',
  ジョーカー: 'jokic',
  ヤニス: 'giannis',
  タトゥム: 'tatum',
  エンビード: 'embiid',
  デュラント: 'durant',
  ブロン: 'lebron',
}

// ── カテゴリ → 検索キーワードマッピング ─────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  player_analysis: ['player'],
  team_analysis: ['team'],
  tactics: ['tactics', 'court'],
  data: ['data', 'stats'],
}

// ── 型定義 ─────────────────────────────────────────────────────
export type ThumbnailResult = {
  url: string | null
  source: 'local' | 'unsplash' | 'none'
  label: string  // ターミナル表示用
}

// ── キーワード抽出 ──────────────────────────────────────────────
export function extractKeywords(meta: DraftMeta): string[] {
  const keywords: string[] = []

  for (const tag of meta.tags) {
    const mapped = KATA_TO_EN[tag.trim()]
    if (mapped) {
      keywords.push(mapped)
    } else if (/^[a-z0-9][a-z0-9\-]*$/i.test(tag.trim())) {
      keywords.push(tag.trim().toLowerCase())
    }
  }

  const catKws = CATEGORY_KEYWORDS[meta.category]
  if (catKws) keywords.push(...catKws)

  return [...new Set(keywords)]
}

// ── ローカルファイルマッチング ──────────────────────────────────
function scoreFilename(filename: string, keywords: string[]): number {
  const lower = filename.toLowerCase().replace(/[-_.]/g, ' ')
  return keywords.filter((kw) => lower.includes(kw)).length
}

function matchLocal(keywords: string[]): { filepath: string; filename: string } | null {
  if (!fs.existsSync(THUMBNAILS_DIR)) return null

  const files = fs
    .readdirSync(THUMBNAILS_DIR)
    .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))

  if (files.length === 0) return null

  const scored = files.map((f) => ({ f, score: scoreFilename(f, keywords) }))
  const maxScore = Math.max(...scored.map((s) => s.score))
  if (maxScore === 0) return null

  const best = scored.filter((s) => s.score === maxScore)
  const chosen = best[Math.floor(Math.random() * best.length)]
  return { filepath: path.join(THUMBNAILS_DIR, chosen.f), filename: chosen.f }
}

// ── Supabase Storage アップロード ───────────────────────────────
async function uploadBuffer(
  buffer: Buffer | ArrayBuffer,
  storageKey: string,
  contentType: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from('post-images')
    .upload(storageKey, buffer, { contentType, upsert: true })

  if (error) return null

  const { data } = supabase.storage.from('post-images').getPublicUrl(storageKey)
  return data.publicUrl
}

async function uploadLocalFile(
  filepath: string,
  slug: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const ext = path.extname(filepath).slice(1).toLowerCase()
  const contentType =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif' ? 'image/gif' : 'image/jpeg'
  const storageKey = `articles/${slug}-thumbnail.${ext}`

  const buffer = fs.readFileSync(filepath)
  return uploadBuffer(buffer, storageKey, contentType, supabase)
}

async function uploadFromUrl(
  imageUrl: string,
  slug: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const res = await fetch(imageUrl)
  if (!res.ok) return null
  const buffer = await res.arrayBuffer()
  const storageKey = `articles/${slug}-thumbnail.jpg`
  return uploadBuffer(buffer, storageKey, 'image/jpeg', supabase)
}

// ── Unsplash API ────────────────────────────────────────────────
async function fetchUnsplashImageUrl(keywords: string[]): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const query = ['basketball', ...keywords.slice(0, 2)].join(' ')
  const apiUrl =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}` +
    `&orientation=landscape` +
    `&per_page=5` +
    `&client_id=${accessKey}`

  try {
    const res = await fetch(apiUrl)
    if (!res.ok) return null
    const data = (await res.json()) as {
      results: Array<{ urls: { regular: string } }>
    }
    return data.results[0]?.urls.regular ?? null
  } catch {
    return null
  }
}

// ── メインエントリ ──────────────────────────────────────────────
export async function resolveThumbnail(
  meta: DraftMeta,
  slug: string,
  supabase: SupabaseClient,
): Promise<ThumbnailResult> {
  const keywords = extractKeywords(meta)

  // 優先1: ローカル thumbnails/ マッチング
  const local = matchLocal(keywords)
  if (local) {
    const url = await uploadLocalFile(local.filepath, slug, supabase)
    if (url) {
      return { url, source: 'local', label: `${local.filename}（ローカル）` }
    }
  }

  // 優先2: Unsplash API
  const unsplashUrl = await fetchUnsplashImageUrl(keywords)
  if (unsplashUrl) {
    const url = await uploadFromUrl(unsplashUrl, slug, supabase)
    if (url) {
      return { url, source: 'unsplash', label: 'Unsplashから取得' }
    }
  }

  // 優先3: サムネイルなし
  return { url: null, source: 'none', label: 'なし（スキップ）' }
}
