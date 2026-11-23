import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '編集部について',
  description: 'NBA COURT VISIONの編集部の体制と、記事ができるまでの流れを紹介します。',
}

const DESKS = [
  { role: '記者', desc: '前夜の試合結果・順位表・スタッツを取材し、記事の企画を提案します。' },
  { role: '編集長', desc: '企画を審査し、読者価値・適時性・データの裏付け・テーマの重複を基準に採否を決めます。' },
  { role: 'ライター', desc: '採用された企画と取材データをもとに、2,000〜3,000字の分析記事を書きます。' },
  { role: '校閲デスク', desc: 'すべての数字を取材データと照合し、誤りを直します。裏付けのない断定は弱めるか削除します。' },
  { role: '編集責任者', desc: '校閲で判断がつかない記事を確認し、公開の可否を最終判断します。' },
  { role: 'マーケティング', desc: '公開した記事を、SNSで読者に届けます。' },
]

export default function AboutPage() {
  return (
    <div className="container-content py-12">
      <div style={{ maxWidth: '720px' }}>
        <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
          <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
          <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
            編集部について
          </h1>
        </div>

        <div className="article-prose">
          <p>
            NBA COURT VISIONは、日本のNBAファンに向けて、試合結果の要約ではなく「データと文脈で読み解く分析」を届けるメディアです。
          </p>

          <h2>AIを活用した編集部</h2>
          <p>
            当メディアの記事は、AIエージェントが役割を分担し、人間の編集責任者が監督する体制で制作しています。
            企画から公開までの各工程は記録に残り、あとから検証できるようにしています。
          </p>

          <h2>編集部の体制</h2>
          <ul>
            {DESKS.map((d) => (
              <li key={d.role}>
                <strong>{d.role}</strong>: {d.desc}
              </li>
            ))}
          </ul>

          <h2>記事ができるまで</h2>
          <ol>
            <li>記者が、前夜の試合データをもとに企画を提案する</li>
            <li>編集長が企画を審査し、その日に書く記事を決める</li>
            <li>ライターが、取材データだけを根拠に記事を書く</li>
            <li>校閲デスクが、すべての数字を取材データと照合し、原稿を直す</li>
            <li>校閲を通過した記事だけを公開する。判断がつかない記事は編集責任者が確認する</li>
          </ol>
          <p>
            記事の作り方と誤りへの対応は、<Link href="/editorial-policy">編集方針</Link>にまとめています。
          </p>

          <h2>お問い合わせ</h2>
          <p>
            記事の誤りのご指摘、ご意見は<Link href="/contact">お問い合わせ</Link>からお寄せください。
          </p>
        </div>
      </div>
    </div>
  )
}
