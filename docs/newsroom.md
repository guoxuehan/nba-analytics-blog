# 編集部（AIエージェントの組織と業務フロー）

NBA COURT VISION の記事は、AIエージェントの「編集部」がGitHub上で作る。
人間（社長）は、企画を持ち込む、保留する、最終的に判断するという場面でだけ関わる。

## 組織図

| 役割 | 職務記述書 | 実行するもの | 動く場所 | 費用 |
|---|---|---|---|---|
| 📰 記者 | [.claude/agents/reporter.md](../.claude/agents/reporter.md) | [scripts/newsroom/reporter.ts](../scripts/newsroom/reporter.ts) | 朝会（毎日 JST 18:00） | API（Sonnet） |
| 🧑‍💼 編集長 | [.claude/agents/editor-in-chief.md](../.claude/agents/editor-in-chief.md) | [scripts/newsroom/editor.ts](../scripts/newsroom/editor.ts) | 朝会 | API（Sonnet） |
| ✍️ ライター | [.claude/agents/writer.md](../.claude/agents/writer.md) | [scripts/newsroom/writer.ts](../scripts/newsroom/writer.ts) | 企画が採用されたとき | API（Sonnet） |
| 📈 図版デスク | [.claude/agents/graphics-desk.md](../.claude/agents/graphics-desk.md) | [scripts/newsroom/graphics-desk.ts](../scripts/newsroom/graphics-desk.ts)（ライターの直後に呼ばれる） | 入稿の前 | API（Sonnet） |
| 🔍 校閲デスク | [.claude/agents/copy-desk.md](../.claude/agents/copy-desk.md) | claude-code-action（[newsroom-review.yml](../.github/workflows/newsroom-review.yml)） | 入稿されたとき | Claudeサブスク（Opus） |
| ✅ デスク判定 | — | [scripts/newsroom/review-gate.ts](../scripts/newsroom/review-gate.ts) | 校閲の後 | 無料 |
| 📣 マーケ担当 | [.claude/agents/marketer.md](../.claude/agents/marketer.md) | [scripts/newsroom/marketer.ts](../scripts/newsroom/marketer.ts) | 公開されたとき | API（Sonnet） |
| 📣 投稿係 | — | [scripts/newsroom/social.ts](../scripts/newsroom/social.ts) | 毎時（公開時刻を過ぎた配信案） | Bluesky は無料 / X は URL付き投稿1件 約$0.20 |
| 📊 経営企画 | [.claude/agents/strategist.md](../.claude/agents/strategist.md) | [scripts/newsroom/weekly-report.ts](../scripts/newsroom/weekly-report.ts) | 毎週月曜 JST 9:00 | API（Sonnet） |
| 🤖 @claude | — | claude-code-action（[claude.yml](../.github/workflows/claude.yml)） | `@claude` とコメントしたとき | Claudeサブスク |

職務記述書は、ローカルの Claude Code でもサブエージェントとしてそのまま使える。

## 業務フロー

```
[朝会 newsroom-daily.yml / 毎日 JST 18:00]
  取材: fetch-nba-data.ts → data/*.json
  📰 記者: 企画候補を Issue で提出                       ラベル: 企画:候補
  🧑‍💼 編集長: 審査
      ├ 採用（最大 DAILY_ARTICLE_COUNT 本）               ラベル: 企画:採用 → ライターを起動
      └ 不採用（理由をコメントしてクローズ）                ラベル: 企画:不採用

[執筆 newsroom-write.yml]
  ✍️ ライター: 記事と取材メモを書く
  📈 図版デスク: 主張を支えるグラフを0〜2点入れる（取材メモにない数字の図は自動で外す）
  → PR で入稿                                            ラベル: 入稿 / 企画:執筆済
      content/articles/<slug>.md   記事
      content/notes/<slug>.md      取材メモ（校閲が照合に使う）

[校閲 newsroom-review.yml]
  🔍 校閲デスク: ファクトチェックと校正（原稿を直接修正してコミット）
  ✅ デスク判定:
      ├ 判定 pass かつ スコア70点以上 かつ 保留ラベルなし → 自動マージ → 公開を起動
      └ それ以外 → ラベル: 校閲:要修正 / 要確認（人間がマージするまで待つ）

[公開 newsroom-publish.yml]
  🚀 content/articles/ を Supabase に反映（新規は PUBLISH_INTERVAL_HOURS ずつ公開時刻をずらす）
  📣 マーケ担当: X投稿文3パターンを配信 Issue で起票   ラベル: マーケ:配信待ち

[SNS 自動投稿 newsroom-social.yml / 毎時10分]
  📣 投稿係: 公開時刻を過ぎた配信 Issue の「最初の投稿文」を Bluesky（と、設定していれば X）に投稿
              → URL をコメントしてクローズ  ラベル: マーケ:配信済
              （1日 SOCIAL_DAILY_POST_LIMIT 本まで。既定は Bluesky だけなら3本、X を使うなら1本）

[週次レポート newsroom-weekly.yml / 毎週月曜 JST 9:00]
  📊 経営企画: 公開本数・カテゴリ内訳・企画の採用率・自動公開率・確認待ち・失敗したワークフローを集計し、
              所見と来週のアクションを Issue で報告                         ラベル: 経営:週次レポート
```

## 社長（人間）ができること

| やりたいこと | 操作 |
|---|---|
| 企画を持ち込む | Issue テンプレート「記事企画の持ち込み」から提出（翌日の朝会で審査） |
| 企画をすぐ書かせる | Issue に `企画:採用` ラベルを付ける |
| 公開を止める | 記事PRに `保留` ラベルを付ける |
| 記事を直させる | 記事PRで `@claude 〇〇を直して` とコメント |
| 確認待ちの記事を公開する | PR をマージする（マージで公開ワークフローが動く） |
| 校閲をやり直す | Actions →「編集部: 校閲デスク」→ Run workflow に PR 番号を入れる |
| 朝会を今すぐ開く | Actions →「編集部: 朝会」→ Run workflow |
| SNS に投稿する文面を選ぶ | 配信 Issue の本文で、投稿したいパターンを一番上にする（書き換えも可） |
| SNS に投稿させない | 配信 Issue から `マーケ:配信待ち` ラベルを外す |
| 週次レポートを今すぐ作る | Actions →「経営企画: 週次レポート」→ Run workflow |
| 記者の企画をローカルで試す | `DRY_RUN=1 npx tsx scripts/newsroom/reporter.ts`（GitHub を操作しない） |

## 初期設定

1. **Secrets**（Settings → Secrets and variables → Actions）
   - 既存: `ANTHROPIC_API_KEY`、`BALLDONTLIE_API_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - 追加: `CLAUDE_CODE_OAUTH_TOKEN`。ローカルで `claude setup-token` を実行して作る（Pro/Max の利用枠で校閲デスクと @claude を動かす）
2. **Variables**（任意）: `DAILY_ARTICLE_COUNT`（既定3）、`QUALITY_THRESHOLD`（既定70）、`PUBLISH_INTERVAL_HOURS`（既定4）、`NEXT_PUBLIC_SITE_URL`
3. **Actions の権限**（Settings → Actions → General → Workflow permissions）
   - 「Read and write permissions」を選ぶ
   - 「Allow GitHub Actions to create and approve pull requests」にチェックを入れる
4. **Bluesky 自動投稿**: Bluesky の「設定 → プライバシーとセキュリティ → アプリパスワード」で作ったパスワードを
   Secrets の `BLUESKY_APP_PASSWORD` に、ハンドル（例: `courtvision.bsky.social`）を Variables の `BLUESKY_HANDLE` に登録する。
   **X 自動投稿**（任意・有料）: X の開発者コンソールで権限「Read and write」のアプリを作り、Secrets に `X_API_KEY`、`X_API_SECRET`、
   `X_ACCESS_TOKEN`、`X_ACCESS_TOKEN_SECRET` を登録する。URL付きの投稿は1件 約$0.20（2026年11月時点の公式料金表）。
   **Google ニュース**: 申請は不要。`/news-sitemap.xml`（直近2日の記事）を robots.txt で案内している。
5. **GA4・Search Console**（週次レポートにアクセス数を入れる）: Google Cloud でサービスアカウントを作り、
   「Google Analytics Data API」と「Google Search Console API」を有効にして JSON キーを発行する。
   サービスアカウントのメールアドレスを、GA4 のプロパティに「閲覧者」、Search Console のプロパティに「制限付き」ユーザーとして追加する。
   JSON キーを Secrets の `GOOGLE_SERVICE_ACCOUNT_JSON` に、GA4 のプロパティID（数字）を Variables の `GA4_PROPERTY_ID` に登録する。
   Search Console がドメインプロパティなら、Variables の `GSC_SITE_URL` を `sc-domain:sports-academia.com` にする（既定は `https://sports-academia.com/`）。
6. **Supabase**: 記事の修正を反映するには、`articles` テーブルに UPDATE を許可する RLS ポリシーが必要（INSERT は既存の運用で許可済み）。

## 収益化

段階: ① アクセスを増やす（定番記事）＋アフィリエイト → ② 月間PV 1万で AdSense を申請 → ③ 有料コンテンツ・スポンサー・仕組みの外販を検討。
週次レポートの「月間PV」「AdSense 申請の目安」「アフィリエイトのクリック」「検索の表示回数」で進み具合を追う。

- **アフィリエイト**: ライターは、読者の「見る・買う」につながる記事に限り、本文の最後に `:::shop キーワード` を1行入れる。
  記事ではその位置に楽天・Amazon の**検索結果**へのリンク枠が出る（AI に商品URLを書かせない）。クリックは GA4 の `affiliate_click` イベントで数える。
- **ID の設定**: [lib/affiliates.ts](../lib/affiliates.ts) の `RAKUTEN_AFFILIATE_ID`・`AMAZON_ASSOCIATE_TAG`（または同名の `NEXT_PUBLIC_` 環境変数）。
  未設定のあいだは、枠も「プロモーションを含む」表示も、プライバシーポリシーのアフィリエイトの記載も出ない。
- **表示義務**: 枠のある記事は冒頭に「PR この記事にはプロモーションが含まれます」と出す（ステルスマーケティング規制）。Amazon を使うときは定型文も出す。

## 設計上の注意

- `GITHUB_TOKEN` で起きた操作（ラベル付与、PR作成、マージ）は、別のワークフローを起動しない（GitHub の仕様）。そのため、各段階で次のワークフローを `gh workflow run` で明示的に起動している。人間がラベルを付けたりマージしたりした場合は、通常のイベントで起動する。
- 記事の正はリポジトリ（`content/articles/`）。管理画面で直接作った記事は公開処理の対象外で、上書きもしない。
- 旧パイプライン（[auto-publish.yml](../.github/workflows/auto-publish.yml)）は定期実行を止め、手動実行だけ残している。
