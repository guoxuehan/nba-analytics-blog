'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

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

export function ArticleContent({ content }: Props) {
  return (
    <div className="article-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
