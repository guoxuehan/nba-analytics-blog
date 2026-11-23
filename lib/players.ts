import { getSupabase } from '@/lib/supabase'
import type { Post } from '@/lib/posts'
import { TEAMS, mentionsTeam, type Team } from '@/lib/teams'

// ─── 選手 ─────────────────────────────────────────────────────
// 記事によく登場する選手と、日本の読者の関心が高い選手。
// 所属チームは移籍で変わるため持たない（ページでは、記事から関連チームを割り出す）

export type Player = {
  slug: string
  en: string
  /** 記事タグで使う日本語名（例: ルカ・ドンチッチ） */
  ja: string
  /** 記事タイトルでよく使う呼び名。ほかの選手と紛らわしいものは入れない */
  short?: string
  /** 表記ゆれのタグ */
  aliases?: string[]
}

const p = (slug: string, en: string, ja: string, short?: string, aliases?: string[]): Player => ({
  slug,
  en,
  ja,
  short,
  aliases,
})

export const PLAYERS: Player[] = [
  // 日本人選手
  p('rui-hachimura', 'Rui Hachimura', '八村塁', '八村'),
  p('yuki-kawamura', 'Yuki Kawamura', '河村勇輝', '河村'),
  // 現役のスター・注目選手
  p('luka-doncic', 'Luka Doncic', 'ルカ・ドンチッチ', 'ドンチッチ'),
  p('victor-wembanyama', 'Victor Wembanyama', 'ビクター・ウェンバンヤマ', 'ウェンバンヤマ', ['ヴィクター・ウェンバンヤマ']),
  p('lebron-james', 'LeBron James', 'レブロン・ジェームズ', 'レブロン'),
  // 「カリー」は「カリーム（アブドゥル＝ジャバー）」にも一致するので、短い呼び名は使わない
  p('stephen-curry', 'Stephen Curry', 'ステフィン・カリー'),
  p('shai-gilgeous-alexander', 'Shai Gilgeous-Alexander', 'シェイ・ギルジャス＝アレクサンダー', 'ギルジャス', [
    'シャイ・ギルジャス＝アレクサンダー',
    'シェイ・ギルジャス・アレクサンダー',
  ]),
  p('nikola-jokic', 'Nikola Jokic', 'ニコラ・ヨキッチ', 'ヨキッチ'),
  p('giannis-antetokounmpo', 'Giannis Antetokounmpo', 'ヤニス・アデトクンボ', 'アデトクンボ'),
  p('jayson-tatum', 'Jayson Tatum', 'ジェイソン・テイタム', 'テイタム'),
  p('anthony-edwards', 'Anthony Edwards', 'アンソニー・エドワーズ'),
  p('kevin-durant', 'Kevin Durant', 'ケビン・デュラント', 'デュラント'),
  p('devin-booker', 'Devin Booker', 'デビン・ブッカー', 'ブッカー'),
  p('donovan-mitchell', 'Donovan Mitchell', 'ドノバン・ミッチェル'),
  p('jalen-brunson', 'Jalen Brunson', 'ジェイレン・ブランソン', 'ブランソン'),
  p('kawhi-leonard', 'Kawhi Leonard', 'カワイ・レナード'),
  p('cade-cunningham', 'Cade Cunningham', 'ケイド・カニングハム', 'カニングハム'),
  p('chet-holmgren', 'Chet Holmgren', 'チェット・ホルムグレン', 'ホルムグレン'),
  p('austin-reaves', 'Austin Reaves', 'オースティン・リーブス', 'リーブス'),
  p('lamelo-ball', 'LaMelo Ball', 'ラメロ・ボール', 'ラメロ'),
  p('walker-kessler', 'Walker Kessler', 'ウォーカー・ケスラー', 'ケスラー'),
  p('deni-avdija', 'Deni Avdija', 'デニ・アヴディヤ', 'アヴディヤ'),
  p('franz-wagner', 'Franz Wagner', 'フランツ・ワグナー'),
  p('draymond-green', 'Draymond Green', 'ドレイモンド・グリーン'),
  p('cooper-flagg', 'Cooper Flagg', 'クーパー・フラッグ', 'フラッグ'),
  // 歴代のレジェンド（定番記事でよく扱う）
  p('michael-jordan', 'Michael Jordan', 'マイケル・ジョーダン'),
  p('kobe-bryant', 'Kobe Bryant', 'コービー・ブライアント', 'コービー'),
  p('tim-duncan', 'Tim Duncan', 'ティム・ダンカン', 'ダンカン'),
  p('wilt-chamberlain', 'Wilt Chamberlain', 'ウィルト・チェンバレン', 'チェンバレン'),
]

export function getPlayer(slug: string): Player | undefined {
  return PLAYERS.find((player) => player.slug === slug)
}

/** タグが選手名（表記ゆれを含む）なら、その選手を返す */
export function findPlayerByTag(tag: string): Player | undefined {
  return PLAYERS.find((player) => player.ja === tag || player.aliases?.includes(tag))
}

export function mentionsPlayer(player: Player, post: { title: string; tags?: string[] | null }): boolean {
  const names = [player.ja, ...(player.aliases ?? [])]
  return (
    (post.tags ?? []).some((tag) => names.includes(tag)) ||
    names.some((name) => post.title.includes(name)) ||
    (!!player.short && post.title.includes(player.short))
  )
}

// ─── 記事 ─────────────────────────────────────────────────────

type TaggedPost = Post & { tags: string[] | null }

/** 直近の公開記事（タグつき）。選手ページ・チームページの絞り込み用 */
export async function getRecentTaggedPosts(limit = 500): Promise<TaggedPost[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published, tags')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as TaggedPost[]
  } catch {
    return []
  }
}

/** 選手の記事と、その記事によく出てくるチーム（出現回数の多い順に最大3つ） */
export async function getPlayerPage(player: Player): Promise<{ posts: Post[]; teams: Team[] }> {
  const posts = (await getRecentTaggedPosts()).filter((post) => mentionsPlayer(player, post))
  const teamCounts = TEAMS.map((team) => ({ team, count: posts.filter((post) => mentionsTeam(team, post)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  return { posts: posts.slice(0, 30), teams: teamCounts.map((t) => t.team) }
}

/** 選手ごとの記事数（一覧ページ用） */
export async function getPlayerArticleCounts(): Promise<Map<string, number>> {
  const posts = await getRecentTaggedPosts()
  return new Map(PLAYERS.map((player) => [player.slug, posts.filter((post) => mentionsPlayer(player, post)).length]))
}
