'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { SHOP_LINE } from '@/lib/affiliates'
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

type Part = { type: 'md'; text: string } | { type: 'shop'; keyword: string }

/** 本文を Markdown と `:::shop キーワード` の行（関連商品の枠）に分ける */
function splitShop(content: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const m of content.matchAll(new RegExp(SHOP_LINE.source, 'gm'))) {
    parts.push({ type: 'md', text: content.slice(last, m.index) })
    parts.push({ type: 'shop', keyword: m[1] })
    last = m.index! + m[0].length
  }
  parts.push({ type: 'md', text: content.slice(last) })
  return parts.filter((part) => part.type === 'shop' || part.text.trim())
}

export function ArticleContent({ content }: Props) {
  return (
    <div className="article-prose">
      {splitShop(content).map((part, i) =>
        part.type === 'shop' ? (
          // アフィリエイト ID が未設定なら ShopBox は何も表示しない（行も本文に出さない）
          <ShopBox key={i} keyword={part.keyword} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={components}>
            {part.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  )
}
