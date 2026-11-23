import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '編集方針',
  description: 'NBA COURT VISIONの編集方針、ファクトチェック、AIの利用、訂正についての方針です。',
}

export default function EditorialPolicyPage() {
  return (
    <div className="container-content py-12">
      <div style={{ maxWidth: '720px' }}>
        <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
          <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
          <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
            編集方針
          </h1>
        </div>

        <div className="article-prose">
          <h2>私たちが書く記事</h2>
          <p>
            試合結果をなぞるのではなく、1つの問いを立て、データを根拠に答えを探る分析記事を書きます。
            賞賛や批判に偏らず、反対の見方も示したうえで、編集部としての考えを明確にします。
          </p>

          <h2>データと事実の扱い</h2>
          <ul>
            <li>記事中の試合結果・スタッツ・順位は、公開されている統計データから取得したものだけを使います。</li>
            <li>取得したデータにない数字や記録は書きません。推測で数字を補うこともしません。</li>
            <li>選手・コーチの発言は、出典を確認できるものだけを引用します。</li>
            <li>データが欠けている、または不自然な値は、事実として扱いません。</li>
          </ul>

          <h2>ファクトチェック</h2>
          <p>
            すべての記事は、公開前に校閲デスクのチェックを受けます。校閲デスクは、記事中の勝敗・スコア・スタッツ・チーム名・選手名を取材データと1つずつ照合し、
            誤りを直し、裏付けのない断定を弱めるか削除します。校閲で判断がつかない記事は、人間の編集責任者が確認するまで公開しません。
          </p>

          <h2>AIの利用について</h2>
          <p>
            当メディアは、企画・執筆・校閲の各工程でAI（大規模言語モデル）を利用しています。
            AIは誤った内容を生成することがあるため、上記のとおりデータとの照合を必ず行い、人間の編集責任者が体制全体を監督しています。
            体制の詳細は<Link href="/about">編集部について</Link>をご覧ください。
          </p>

          <h2>訂正について</h2>
          <p>
            記事に誤りが見つかった場合は、速やかに記事を修正します。記事の主張に関わる重要な訂正は、記事内に訂正した旨と内容を明記します。
            誤りにお気づきの際は、<Link href="/contact">お問い合わせ</Link>からお知らせください。
          </p>

          <h2>独立性</h2>
          <p>
            当メディアは、NBAおよび各チームと提携関係になく、特定のチーム・選手・企業から対価を受けて記事を書くことはありません。
            広告は記事の内容と切り離して掲載しています。
          </p>
        </div>
      </div>
    </div>
  )
}
