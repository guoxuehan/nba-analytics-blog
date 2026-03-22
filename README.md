# NBA COURT VISION

NBA分析メディア。選手分析・チーム分析・戦術・データの4カテゴリで記事を配信する。管理画面からMarkdown記事を作成・公開でき、ClaudeによるAI下書き生成機能を備える。

## 技術スタック

| 用途 | 技術 |
|---|---|
| フレームワーク | Next.js 16.2.0 (App Router) |
| UI | React 19.2.4 + Tailwind CSS v4 |
| 言語 | TypeScript 5 |
| データベース | Supabase (PostgreSQL) |
| ホスティング | Vercel |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| E2Eテスト | Playwright |
| CIパイプライン | GitHub Actions (Node.js 20) |

## ディレクトリ構成

```
nba-analytics-blog/
├── app/                        # Next.js App Router
│   ├── articles/[slug]/        # 記事詳細ページ
│   ├── category/[category]/    # カテゴリ一覧ページ
│   ├── tag/[tag]/              # タグ一覧ページ
│   ├── contact/                # お問い合わせページ
│   ├── privacy-policy/         # プライバシーポリシー
│   ├── disclaimer/             # 免責事項
│   ├── admin/                  # 管理画面（要認証）
│   │   ├── login/              # 管理画面ログイン
│   │   ├── articles/           # 記事一覧・新規作成・編集
│   │   ├── comments/           # コメント管理
│   │   └── _components/        # 管理画面専用コンポーネント
│   ├── api/                    # APIルート
│   │   ├── admin/ai-draft/     # AI下書き生成
│   │   ├── admin/upload/       # 画像アップロード
│   │   ├── comments/           # コメント投稿
│   │   └── contact/            # お問い合わせ送信
│   ├── components/             # 共通コンポーネント
│   ├── globals.css             # グローバルスタイル・CSSカスタムプロパティ
│   ├── layout.tsx              # ルートレイアウト（フォント・テーマ設定）
│   └── sitemap.ts              # 動的サイトマップ
├── lib/
│   ├── posts.ts                # 記事取得クエリ・ユーティリティ関数
│   ├── supabase.ts             # Supabaseクライアント（anon key）
│   ├── supabase-admin.ts       # Supabaseクライアント（admin）
│   └── admin-auth.ts           # 管理画面認証ロジック
├── tests/
│   └── links.spec.ts           # Playwright E2Eリンク検証テスト
├── .claude/commands/           # Claude Codeカスタムコマンド
├── .github/workflows/ci.yml    # GitHub Actions CI/CDパイプライン
├── .husky/                     # Gitフック（pre-commit, pre-push）
├── next.config.ts              # Next.js設定
├── playwright.config.ts        # Playwright設定
├── CLAUDE.md / AGENTS.md       # AI向けコードベース指示
└── docs/                       # プロジェクトドキュメント
    ├── database.md             # Supabaseテーブル・RLS設計
    ├── deployment.md           # デプロイ・環境変数・CI手順
    └── content-guide.md        # 記事作成ガイド
```

## ローカル開発の始め方

### 必要な環境

- Node.js 20以上
- npm

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd nba-analytics-blog

# 2. 依存関係をインストール
npm install

# 3. 環境変数を設定
cp .env.local.example .env.local
# .env.local を編集（下記「環境変数」参照）

# 4. 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### 環境変数

`.env.local` に以下を設定する。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | Supabase anon（公開）キー |
| `ADMIN_PASSWORD` | 必須 | 管理画面ログインパスワード |
| `ANTHROPIC_API_KEY` | 必須 | AI下書き生成用 Claude APIキー |
| `NEXT_PUBLIC_SITE_URL` | 任意 | OGP用サイトURL（デフォルト: `https://courtvision.jp`） |
| `NEXT_PUBLIC_GA_ID` | 任意 | Google AnalyticsトラッキングID |

## デプロイ方法

`main` または `master` ブランチにpushすると GitHub Actions が自動的に lint・型チェック・ビルド・E2Eテストを実行する。Vercelはリポジトリと連携済みで、CIが通ると自動デプロイされる。

詳細は [docs/deployment.md](docs/deployment.md) を参照。

## テストの実行方法

```bash
# ESLint（構文・スタイルチェック）
npm run lint

# TypeScript型チェック
npx tsc --noEmit

# E2Eテスト全件（Playwright）
npm run test:e2e

# リンク検証テストのみ
npm run test:links

# lint + 型チェック + ビルドをまとめて実行
npm run check
```

E2EテストはChromiumを使用する。初回は `npx playwright install chromium` が必要。

## Claude Codeカスタムコマンド

`.claude/commands/` に定義したコマンドを Claude Code から呼び出せる。

| コマンド | 役割 | 概要 |
|---|---|---|
| `/today-topics` | 編集長 | 今日のNBAニュースを踏まえた記事ネタを3つ提案 |
| `/write-article` | 編集長 | 指定テーマで2,000〜3,000字のMarkdown記事を生成 |
| `/x-post` | マーケ担当 | 最新記事からX（Twitter）投稿文を3パターン生成 |
| `/weekly-report` | マーケ担当 | 週次パフォーマンスレポートを作成 |
| `/monthly-review` | 事業戦略担当 | 月次ビジネスレビューを作成 |

詳細は [docs/content-guide.md](docs/content-guide.md) を参照。
