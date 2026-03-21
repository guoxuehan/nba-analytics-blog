import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '免責事項',
  description: 'NBA COURT VISIONの免責事項です。',
}

export default function DisclaimerPage() {
  return (
    <div className="container-content py-12">
      <div style={{ maxWidth: '720px' }}>
        <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
          <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
          <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
            免責事項
          </h1>
        </div>

        <div className="article-prose">
          <h2>情報の正確性について</h2>
          <p>当サイト（NBA COURT VISION）に掲載している情報は、できる限り正確な情報の提供に努めていますが、正確性・完全性・最新性を保証するものではありません。当サイトの情報を利用したことによって生じたいかなる損害についても、運営者は責任を負いません。</p>
          <p>当サイトの記事は、公開時点の統計データ・報道情報に基づいて作成されています。NBA・チーム・選手に関するデータは変動するものであり、掲載後に変更される場合があります。</p>

          <h2>NBA関連の商標・著作権について</h2>
          <p>「NBA」「National Basketball Association」およびチーム名・選手名は、それぞれの権利者に帰属する商標です。当サイトはNBAおよび各チームと公式な提携関係にはありません。</p>
          <p>当サイトに掲載されている文章・分析・考察は、フェアユース・引用の範囲内で作成されたオリジナルコンテンツです。無断転載・複製はお断りします。</p>

          <h2>外部リンクについて</h2>
          <p>当サイトには外部サイトへのリンクが含まれる場合があります。リンク先のサイトのコンテンツ・運営方針については当サイトの管理外であり、責任を負いかねます。</p>

          <h2>広告について</h2>
          <p>当サイトではGoogle AdSenseによる広告を掲載しています。広告の内容は第三者によって配信されるものであり、当サイトはその内容について責任を負いません。</p>

          <h2>本免責事項の変更について</h2>
          <p>当サイトは、必要に応じて本免責事項を変更することがあります。変更後の免責事項は、当サイトへの掲載をもって効力を生じます。</p>
        </div>
      </div>
    </div>
  )
}
