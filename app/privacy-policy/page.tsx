import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: 'NBA COURT VISIONのプライバシーポリシーです。',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container-content py-12">
      <div style={{ maxWidth: '720px' }}>
        <div className="flex items-center gap-3 pb-3 border-b border-border mb-8">
          <div style={{ width: '4px', height: '22px', background: 'var(--accent)', borderRadius: '1px' }} aria-hidden="true" />
          <h1 className="font-heading font-bold text-text-primary uppercase" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
            プライバシーポリシー
          </h1>
        </div>

        <div className="article-prose">
          <p>NBA COURT VISION（以下「当サイト」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。本ポリシーは当サイトにおける個人情報の取り扱いについて説明するものです。</p>

          <h2>個人情報の収集について</h2>
          <p>当サイトでは、お問い合わせフォームの送信時に氏名・メールアドレス・メッセージ内容を収集します。収集した情報はお問い合わせへの返答のみに使用し、第三者への提供は行いません。</p>

          <h2>Cookieの使用について</h2>
          <p>当サイトでは、アクセス解析および広告配信のためにCookieを使用しています。Cookieとは、ウェブサーバーからブラウザに送信される小さなテキストファイルです。ブラウザの設定によりCookieを無効にすることができますが、その場合一部の機能が利用できなくなる場合があります。</p>

          <h2>アクセス解析ツールについて</h2>
          <p>当サイトでは、Googleが提供するアクセス解析ツール「Google Analytics」を使用しています。Google AnalyticsはCookieを使用してデータを収集しますが、このデータは匿名で収集されており、個人を特定するものではありません。</p>
          <p>Google Analyticsのデータ収集・処理の仕組みについては、<a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Googleのポリシーと規約</a>をご確認ください。Google Analyticsのオプトアウトは<a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analyticsオプトアウトアドオン</a>から行えます。</p>

          <h2>広告配信について</h2>
          <p>当サイトでは、Google AdSenseを利用した広告を掲載しています。Google AdSenseは、ユーザーの興味に基づいた広告を表示するためにCookieを使用します。広告のカスタマイズを無効にしたい場合は、<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Googleの広告設定ページ</a>から設定できます。</p>
          <p>第三者配信の広告サービスに関する詳細は、<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Googleの広告ポリシー</a>をご確認ください。</p>

          <h2>外部リンクについて</h2>
          <p>当サイトには外部サイトへのリンクが含まれる場合があります。リンク先のプライバシーポリシーについては各サイトにてご確認ください。当サイトは外部サイトのコンテンツについて責任を負いません。</p>

          <h2>プライバシーポリシーの変更について</h2>
          <p>当サイトは、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは、当サイトに掲載した時点から効力を生じるものとします。</p>

          <h2>お問い合わせ</h2>
          <p>本ポリシーに関するお問い合わせは、当サイトの<a href="/contact">お問い合わせフォーム</a>よりお願いいたします。</p>
        </div>
      </div>
    </div>
  )
}
