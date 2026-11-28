'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { SHOP_LINE } from '@/lib/affiliates'
import { CHART_BLOCK, ChartSpec, parseChart } from '@/lib/chart'
import { ArticleChart } from './ArticleChart'
import { ShopBox } from './ShopBox'

// カスタムコンポーネント定義
const components: Components = {
  // 画像 → figure + figcaption
  img({ src, alt }) {
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src ?? ''} alt={alt ?? ''} loading="lazy" />
        {alt && <figcaption>{alt}</figcaption>}
      </figure>
    )
  },
}

type Props = { content: string }

type Part =
  | { type: 'md'; text: string }
  | { type: 'shop'; keyword: string }
  | { type: 'chart'; spec: ChartSpec }

/**
 * 本文を Markdown・`:::shop キーワード` の行（関連商品の枠）・```chart ブロック（グラフ）に分ける。
 * 形式の崩れた chart ブロックは何も表示しない（読者に JSON を見せない）
 */
function splitParts(content: string): Part[] {
  const blocks = [
    ...[...content.matchAll(new RegExp(SHOP_LINE.source, 'gm'))].map((m) => ({ m, kind: 'shop' as const })),
    ...[...content.matchAll(new RegExp(CHART_BLOCK.source, 'gm'))].map((m) => ({ m, kind: 'chart' as const })),
  ].sort((a, b) => a.m.index! - b.m.index!)

  const parts: Part[] = []
  let last = 0
  for (const { m, kind } of blocks) {
    if (m.index! < last) continue
    parts.push({ type: 'md', text: content.slice(last, m.index) })
    if (kind === 'shop') {
      parts.push({ type: 'shop', keyword: m[1] })
    } else {
      const result = parseChart(m[1])
      if ('spec' in result) parts.push({ type: 'chart', spec: result.spec })
    }
    last = m.index! + m[0].length
  }
  parts.push({ type: 'md', text: content.slice(last) })
  return parts.filter((part) => part.type !== 'md' || part.text.trim())
}

export function ArticleContent({ content }: Props) {
  return (
    <div className="article-prose">
      {splitParts(content).map((part, i) =>
        part.type === 'shop' ? (
          // アフィリエイト ID が未設定なら ShopBox は何も表示しない（行も本文に出さない）
          <ShopBox key={i} keyword={part.keyword} />
        ) : part.type === 'chart' ? (
          <ArticleChart key={i} spec={part.spec} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components}>
            {part.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  )
}
