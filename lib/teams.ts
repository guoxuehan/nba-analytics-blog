import { getSupabase } from '@/lib/supabase'
import type { Post } from '@/lib/posts'

// ─── NBA 30チーム ─────────────────────────────────────────────

export type Conference = 'East' | 'West'

export type Team = {
  /** URL に使う識別子（小文字の略称） */
  slug: string
  abbr: string
  /** ESPN の順位表で使われている略称（NBA 公式と異なるものがある） */
  espnAbbr: string
  en: string
  /** 記事タグで使う日本語の正式名（例: マイアミ・ヒート） */
  ja: string
  /** 記事タイトルでよく使う短い呼び名（例: ヒート） */
  short: string
  conference: Conference
  division: string
}

const t = (
  abbr: string,
  en: string,
  ja: string,
  short: string,
  conference: Conference,
  division: string,
  espnAbbr = abbr,
): Team => ({ slug: abbr.toLowerCase(), abbr, espnAbbr, en, ja, short, conference, division })

export const TEAMS: Team[] = [
  // イースタン・カンファレンス
  t('BOS', 'Boston Celtics', 'ボストン・セルティックス', 'セルティックス', 'East', 'アトランティック'),
  t('BKN', 'Brooklyn Nets', 'ブルックリン・ネッツ', 'ネッツ', 'East', 'アトランティック'),
  t('NYK', 'New York Knicks', 'ニューヨーク・ニックス', 'ニックス', 'East', 'アトランティック', 'NY'),
  t('PHI', 'Philadelphia 76ers', 'フィラデルフィア・76ers', '76ers', 'East', 'アトランティック'),
  t('TOR', 'Toronto Raptors', 'トロント・ラプターズ', 'ラプターズ', 'East', 'アトランティック'),
  t('CHI', 'Chicago Bulls', 'シカゴ・ブルズ', 'ブルズ', 'East', 'セントラル'),
  t('CLE', 'Cleveland Cavaliers', 'クリーブランド・キャバリアーズ', 'キャバリアーズ', 'East', 'セントラル'),
  t('DET', 'Detroit Pistons', 'デトロイト・ピストンズ', 'ピストンズ', 'East', 'セントラル'),
  t('IND', 'Indiana Pacers', 'インディアナ・ペイサーズ', 'ペイサーズ', 'East', 'セントラル'),
  t('MIL', 'Milwaukee Bucks', 'ミルウォーキー・バックス', 'バックス', 'East', 'セントラル'),
  t('ATL', 'Atlanta Hawks', 'アトランタ・ホークス', 'ホークス', 'East', 'サウスイースト'),
  t('CHA', 'Charlotte Hornets', 'シャーロット・ホーネッツ', 'ホーネッツ', 'East', 'サウスイースト'),
  t('MIA', 'Miami Heat', 'マイアミ・ヒート', 'ヒート', 'East', 'サウスイースト'),
  t('ORL', 'Orlando Magic', 'オーランド・マジック', 'マジック', 'East', 'サウスイースト'),
  t('WAS', 'Washington Wizards', 'ワシントン・ウィザーズ', 'ウィザーズ', 'East', 'サウスイースト', 'WSH'),
  // ウエスタン・カンファレンス
  t('DEN', 'Denver Nuggets', 'デンバー・ナゲッツ', 'ナゲッツ', 'West', 'ノースウエスト'),
  t('MIN', 'Minnesota Timberwolves', 'ミネソタ・ティンバーウルブズ', 'ティンバーウルブズ', 'West', 'ノースウエスト'),
  t('OKC', 'Oklahoma City Thunder', 'オクラホマシティ・サンダー', 'サンダー', 'West', 'ノースウエスト'),
  t('POR', 'Portland Trail Blazers', 'ポートランド・トレイルブレイザーズ', 'ブレイザーズ', 'West', 'ノースウエスト'),
  t('UTA', 'Utah Jazz', 'ユタ・ジャズ', 'ジャズ', 'West', 'ノースウエスト', 'UTAH'),
  t('GSW', 'Golden State Warriors', 'ゴールデンステート・ウォリアーズ', 'ウォリアーズ', 'West', 'パシフィック', 'GS'),
  t('LAC', 'LA Clippers', 'ロサンゼルス・クリッパーズ', 'クリッパーズ', 'West', 'パシフィック'),
  t('LAL', 'Los Angeles Lakers', 'ロサンゼルス・レイカーズ', 'レイカーズ', 'West', 'パシフィック'),
  t('PHX', 'Phoenix Suns', 'フェニックス・サンズ', 'サンズ', 'West', 'パシフィック'),
  t('SAC', 'Sacramento Kings', 'サクラメント・キングス', 'キングス', 'West', 'パシフィック'),
  t('DAL', 'Dallas Mavericks', 'ダラス・マーベリックス', 'マーベリックス', 'West', 'サウスウエスト'),
  t('HOU', 'Houston Rockets', 'ヒューストン・ロケッツ', 'ロケッツ', 'West', 'サウスウエスト'),
  t('MEM', 'Memphis Grizzlies', 'メンフィス・グリズリーズ', 'グリズリーズ', 'West', 'サウスウエスト'),
  t('NOP', 'New Orleans Pelicans', 'ニューオーリンズ・ペリカンズ', 'ペリカンズ', 'West', 'サウスウエスト', 'NO'),
  t('SAS', 'San Antonio Spurs', 'サンアントニオ・スパーズ', 'スパーズ', 'West', 'サウスウエスト', 'SA'),
]

export function getTeam(slug: string): Team | undefined {
  return TEAMS.find((team) => team.slug === slug)
}

// ─── 順位表（ESPN の公開データ）──────────────────────────────

export type Standing = {
  teamSlug: string
  conference: Conference
  seed: number
  wins: number
  losses: number
  winPct: number
  gamesBehind: string
}

type ESPNEntry = {
  team: { abbreviation: string }
  stats: { name: string; value?: number; displayValue?: string }[]
}
type ESPNStandings = { children?: { name: string; standings: { entries: ESPNEntry[] } }[] }

/**
 * 現在の順位表を取る。6時間キャッシュし、取得できなければ空配列を返す（ページの表示は止めない）
 */
export async function getStandings(): Promise<Standing[]> {
  try {
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings', {
      next: { revalidate: 6 * 3600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as ESPNStandings
    const standings: Standing[] = []
    for (const conf of data.children ?? []) {
      const conference: Conference = conf.name.toLowerCase().includes('eastern') ? 'East' : 'West'
      for (const entry of conf.standings.entries) {
        const team = TEAMS.find((tm) => tm.espnAbbr === entry.team.abbreviation)
        if (!team) continue
        const stat = (name: string) => entry.stats.find((s) => s.name === name)
        standings.push({
          teamSlug: team.slug,
          conference,
          seed: stat('playoffSeed')?.value ?? 0,
          wins: stat('wins')?.value ?? 0,
          losses: stat('losses')?.value ?? 0,
          winPct: stat('winPercent')?.value ?? 0,
          gamesBehind: stat('gamesBehind')?.displayValue ?? '-',
        })
      }
    }
    return standings.sort((a, b) => a.seed - b.seed)
  } catch {
    return []
  }
}

// ─── チームの記事 ─────────────────────────────────────────────

/** タグにチームの正式名がある記事、またはタイトルにチームの呼び名がある記事 */
export function mentionsTeam(team: Team, post: { title: string; tags?: string[] | null }): boolean {
  return (post.tags ?? []).includes(team.ja) || post.title.includes(team.short) || post.title.includes(team.ja)
}

/**
 * 直近の公開記事から、チームに関する記事を新しい順に返す
 */
export async function getTeamPosts(team: Team, limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, created_at, thumbnail_url, slug, published, tags')
      .eq('published', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(500)
    if (error || !data) return []
    return (data as (Post & { tags: string[] | null })[]).filter((p) => mentionsTeam(team, p)).slice(0, limit)
  } catch {
    return []
  }
}
