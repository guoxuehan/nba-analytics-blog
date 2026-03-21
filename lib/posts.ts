import { getSupabase } from '@/lib/supabase'

// ─── 型定義 ────────────────────────────────────────────────────

export type Post = {
  id: string
  title: string
  excerpt: string | null
  category: string
  published_at: string
  thumbnail_url: string | null
  slug: string
  published: boolean
}

export type PostDetail = Post & {
  content: string
  tags: string[]
}

// ─── 読了時間（500字/分で計算） ───────────────────────────────

export function calculateReadingTime(content: string): number {
  const charCount = content.replace(/\s/g, '').length
  return Math.max(1, Math.ceil(charCount / 500))
}

// ─── ダミーデータ ─────────────────────────────────────────────

export const DUMMY_POSTS: Post[] = [
  {
    id: '1',
    title: 'シェイ・ギルジャス＝アレクサンダーが示す次世代エースの条件',
    excerpt: 'SGA は今シーズン平均32.7得点を記録しながら真のエフィシェンシーを維持。得点を積み上げる「方法論」の変化をトラッキングデータで紐解く。',
    category: '選手分析',
    published_at: '2026-03-18T10:00:00Z',
    thumbnail_url: null,
    slug: 'sga-next-generation-ace',
    published: true,
  },
  {
    id: '2',
    title: 'サンダーの守備システム解析：スイッチングと2-3ゾーンの使い分け',
    excerpt: 'マーク・ダーニオーヘッドコーチが今季導入した守備ローテーションは、従来のNBAセオリーを根本から覆す。その設計思想を戦術図と映像分析で解説する。',
    category: '戦術',
    published_at: '2026-03-17T08:00:00Z',
    thumbnail_url: null,
    slug: 'thunder-defense-system-2026',
    published: true,
  },
  {
    id: '3',
    title: 'セルティックスは本当に今季最強チームか？4つの指標で検証する',
    excerpt: 'Net Rating、Second Chance Points、Clutch Time Win%……。複数の高度指標を組み合わせて「強さ」の本質を定量化する。',
    category: 'チーム分析',
    published_at: '2026-03-16T12:00:00Z',
    thumbnail_url: null,
    slug: 'celtics-best-team-2026',
    published: true,
  },
  {
    id: '4',
    title: 'ニコラ・ヨキッチのパスから読む「重力」の経済学',
    excerpt: '1プレーで複数のディフェンスを引きつける「重力指数」。ヨキッチが生み出す空間的優位性をデータで可視化した。',
    category: '選手分析',
    published_at: '2026-03-15T09:00:00Z',
    thumbnail_url: null,
    slug: 'jokic-gravity-economics',
    published: true,
  },
  {
    id: '5',
    title: 'ピック＆ロールの「死」と再生：3Pライン外でのハンドオフが変える攻撃設計',
    excerpt: 'ここ3シーズンでPnRのFrequencyが14%低下。代わりに台頭するのはPinDown, DHO, Ghost Screenの組み合わせだ。',
    category: '戦術',
    published_at: '2026-03-14T11:00:00Z',
    thumbnail_url: null,
    slug: 'pnr-death-and-rebirth',
    published: true,
  },
  {
    id: '6',
    title: 'PER・WS・BPMを超えて：2025-26の選手評価はどこまで進化したか',
    excerpt: 'オールインワン指標の限界を乗り越えようとするEPM、LEBRON、DRAPMの差異と、実務での使い分けを整理する。',
    category: 'データ',
    published_at: '2026-03-13T08:30:00Z',
    thumbnail_url: null,
    slug: 'advanced-metrics-evolution-2026',
    published: true,
  },
  {
    id: '7',
    title: 'レイカーズ再建の設計図：ドラフトとトレードの最適化戦略',
    excerpt: 'サラリーキャップの制約下でどう戦力を積み上げるか。コントラクトのタイムラインとドラフトアセット管理の観点から分析する。',
    category: 'チーム分析',
    published_at: '2026-03-12T10:00:00Z',
    thumbnail_url: null,
    slug: 'lakers-rebuild-blueprint',
    published: true,
  },
  {
    id: '8',
    title: 'アンソニー・エドワーズのミッドレンジ復権が意味すること',
    excerpt: 'Ant は今季のミッドレンジ成功率が48.3%。「時代遅れ」とされた中距離シュートが最新トラッキングで再評価される理由とは。',
    category: '選手分析',
    published_at: '2026-03-11T09:00:00Z',
    thumbnail_url: null,
    slug: 'ant-midrange-revival',
    published: true,
  },
  {
    id: '9',
    title: 'スペーシングの数値化：コート上の「面積」が勝敗を決める',
    excerpt: 'Tracking data から算出される Average Floor Spacing は、チームのオフェンス効率と0.73の相関を示す。その計測方法と活用法。',
    category: 'データ',
    published_at: '2026-03-10T07:00:00Z',
    thumbnail_url: null,
    slug: 'spacing-quantification',
    published: true,
  },
  {
    id: '10',
    title: 'ウォリアーズのオフボールムーブメントが復活した本当の理由',
    excerpt: 'Curry 離脱後もオフェンスを維持できたのはなぜか。HORN セット、Floppy アクション、そしてシューター連鎖の設計に迫る。',
    category: '戦術',
    published_at: '2026-03-09T11:00:00Z',
    thumbnail_url: null,
    slug: 'warriors-off-ball-revival',
    published: true,
  },
  {
    id: '11',
    title: 'ルカ・ドンチッチのステップバック3Pは本当に「良いショット」か',
    excerpt: 'Expected Value フレームワークで評価すると、あの難易度の高いショットセレクションはチームにとってプラスなのか。データが示す意外な答え。',
    category: '選手分析',
    published_at: '2026-03-08T10:00:00Z',
    thumbnail_url: null,
    slug: 'luka-stepback-ev-analysis',
    published: true,
  },
  {
    id: '12',
    title: 'ナゲッツのローテーション最適化：8人 vs 9人の分岐点',
    excerpt: 'プレーオフに向けたローテーション短縮のタイミングと、疲労管理の数値的根拠。過去5年のレギュラーシーズン最終月のデータが示すパターン。',
    category: 'チーム分析',
    published_at: '2026-03-07T09:00:00Z',
    thumbnail_url: null,
    slug: 'nuggets-rotation-optimization',
    published: true,
  },
]

// ─── ダミー記事本文 ────────────────────────────────────────────

const DUMMY_CONTENT = `## はじめに：数字が語る異常な効率性

今シーズン、シェイ・ギルジャス＝アレクサンダー（SGA）はNBAスコアリングタイトル争いの筆頭に立っている。しかし注目すべきは得点数だけではない。**真のシューティング率（True Shooting%）が61.2%** という数値こそが、彼を単なる「得点王候補」から「世代最高のスコアラー」へと押し上げている要因だ。

比較として、同じようなボールハンドリング主体のスコアラーであるデイミアン・リラードの同年齢時のTS%は57.3%。SGAはそれを4ポイント近く上回っている。

## ペイントアタックの「変化」をトレースする

### フローターの習得と3Pへの移行

2022-23シーズンと現在を比較すると、SGAの得点エリアに明確なシフトが見られる。

| エリア | 2022-23 | 2025-26 | 変化 |
|--------|---------|---------|------|
| ペイント内 | 38% | 31% | -7% |
| ミッドレンジ | 24% | 19% | -5% |
| 3ポイント | 22% | 34% | +12% |
| フリースロー | 16% | 16% | 0% |

この変化の核心は「フローターの習得」だ。ペイント内のアテンプトは減少しているが、その代わりに**3Pラインに近いフローターやステップバックジャンパーでの得点が増加**している。これにより、ディフェンスはより広いエリアをカバーせざるを得なくなった。

### スペーシングが生む「選択肢の多様性」

> ディフェンスが引けばドライブ、詰めてくれば3P。どちらを選んでも正解という状況を作り出すことが、エリートスコアラーの条件だ。
> — The Athletic, NBA Scout Interview (2026年2月)

SGAが現在達成しているのは、まさにこの「選択肢の等価化」だ。スポーツVUトラッキングデータによると、彼がボールを持った際のディフェンスの平均ステップバック距離は4.2フィートで、リーグ平均の3.1フィートを大きく上回る。

## クラッチタイムでの支配力

以下の指標を見れば、SGAがプレッシャー下でいかに安定しているかがわかる：

- **クラッチシチュエーション（4Q残り5分以内、5点差以内）での得点：** 平均8.3点（リーグ1位）
- **クラッチTS%：** 63.7%（最低100クラッチアテンプト以上の選手中1位）
- **ゲームウィニングショット成功率：** 43.8%（過去3シーズン通算）

特に注目すべきは、疲労が蓄積するはずの4Qでも効率が落ちない点だ。多くのスコアラーは4Qにフィールドゴール成功率が2〜3%落ちるが、SGAは逆に**1Qより4Qのほうが0.8%高い**という異常な数値を示している。

## オフボールの動きとチームへの貢献

SGAの評価が難しいのは、彼がボールを持っていないときの貢献度だ。

\`\`\`
// オフボール時のチームオフェンス影響指標（推定）
WITHOUT SGA: 108.4 OffRtg
WITH SGA (ball handler): 118.7 OffRtg
WITH SGA (off ball): 114.2 OffRtg

// SGAのオフボール時でも+5.8のオフェンスレーティング差
\`\`\`

これはスクリーンアクションを使ってディフェンスを引きつけているためだ。彼のコート上の存在自体が、チームメイトのシュートチャンスを創出している。

## 結論：「次世代」が意味するもの

SGAは技術的な進化を止めていない。毎シーズン新しいスキルを追加し、ディフェンスへの対応力を高め続けている。現時点での彼の課題としては：

1. プレーオフでの対強度ディフェンスへの適応
2. チームとしての総合力（現在のサンダーは若いロスター）
3. 長期的な耐久性の維持

しかしこれらは「懸念点」というより「次の観察ポイント」に近い。現在の軌跡を見る限り、SGAは向こう5〜7年のリーグを代表するスコアラーになる可能性が極めて高い。
`

const DUMMY_POST_DETAILS: Record<string, PostDetail> = {
  'sga-next-generation-ace': {
    ...DUMMY_POSTS[0],
    content: DUMMY_CONTENT,
    tags: ['SGA', 'オクラホマシティ・サンダー', 'スコアリング', 'トラッキングデータ', 'エフィシェンシー'],
  },
}

function getDummyPostDetail(slug: string): PostDetail | null {
  if (DUMMY_POST_DETAILS[slug]) return DUMMY_POST_DETAILS[slug]
  const base = DUMMY_POSTS.find((p) => p.slug === slug)
  if (!base) return null
  return {
    ...base,
    content: DUMMY_CONTENT,
    tags: [base.category, 'NBA', 'アナリティクス'],
  }
}

// ─── カテゴリ別プレースホルダーグラデーション ─────────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  '選手分析':   'linear-gradient(155deg, #0a1628 0%, #0f2744 60%, #153455 100%)',
  'チーム分析': 'linear-gradient(155deg, #0a150a 0%, #112211 60%, #172b17 100%)',
  '戦術':       'linear-gradient(155deg, #1a0800 0%, #3a1200 60%, #4a1a00 100%)',
  'データ':     'linear-gradient(155deg, #090912 0%, #10101e 60%, #191930 100%)',
}

export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? 'linear-gradient(155deg, #0d0d0d 0%, #1a1a1a 100%)'
}

// ─── 日付フォーマット ─────────────────────────────────────────

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Supabase クエリ ──────────────────────────────────────────

export async function getPublishedPosts(limit = 20): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) return DUMMY_POSTS.slice(0, limit)
    return data as Post[]
  } catch {
    return DUMMY_POSTS.slice(0, limit)
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (error || !data) return getDummyPostDetail(slug)
    return data as PostDetail
  } catch {
    return getDummyPostDetail(slug)
  }
}

export async function getRelatedPosts(
  category: string,
  currentSlug: string,
  limit = 3,
): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
      .eq('category', category)
      .neq('slug', currentSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) {
      return DUMMY_POSTS.filter(
        (p) => p.category === category && p.slug !== currentSlug,
      ).slice(0, limit)
    }
    return data as Post[]
  } catch {
    return DUMMY_POSTS.filter(
      (p) => p.category === category && p.slug !== currentSlug,
    ).slice(0, limit)
  }
}

export async function getRecentPosts(excludeSlug: string, limit = 5): Promise<Post[]> {
  try {
    const { data, error } = await getSupabase()
      .from('articles')
      .select('id, title, excerpt, category, published_at, thumbnail_url, slug, published')
      .eq('published', true)
      .neq('slug', excludeSlug)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data || data.length === 0) {
      return DUMMY_POSTS.filter((p) => p.slug !== excludeSlug).slice(0, limit)
    }
    return data as Post[]
  } catch {
    return DUMMY_POSTS.filter((p) => p.slug !== excludeSlug).slice(0, limit)
  }
}
