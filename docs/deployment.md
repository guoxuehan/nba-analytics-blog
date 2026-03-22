# デプロイ・CI/CD

## アーキテクチャ概要

```
GitHub (master) → GitHub Actions (CI) → Vercel (本番デプロイ)
                                      → Supabase (DB・Storage)
```

---

## GitHub Actions（CI）

設定ファイル: `.github/workflows/ci.yml`

`main` / `master` ブランチへの push および PR 作成時に自動で実行される。

### ジョブの実行順序

1. `actions/checkout@v4` でソースをチェックアウト
2. Node.js 20 をセットアップ（npm キャッシュ有効）
3. `npm ci` で依存関係をインストール
4. Playwright ブラウザ（Chromium）をインストール
5. `npm run lint` — ESLint チェック
6. `npx tsc --noEmit` — TypeScript 型チェック
7. `npm run build` — Next.js プロダクションビルド
8. `npm run start &` — ビルド成果物でサーバー起動
9. `npx wait-on http://localhost:3000` — サーバー起動待機（タイムアウト: 30秒）
10. `npx playwright test` — E2E テスト全件実行
11. テストレポートを artifact としてアップロード（保持: 14日）

### GitHub Secrets の設定

リポジトリの Settings → Secrets and variables → Actions に以下を登録する。

| Secret 名 | 説明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon キー |
| `ADMIN_PASSWORD` | 管理画面ログインパスワード |

> `ANTHROPIC_API_KEY` はCI環境では不要（AI生成APIはE2Eテスト対象外）。

---

## Vercel の設定

### プロジェクト連携

Vercel ダッシュボードから GitHub リポジトリを連携する。`master` ブランチへの push で自動デプロイが走る。

### 環境変数（Vercel ダッシュボード）

Vercel の Settings → Environment Variables に以下を設定する。

| 変数名 | 環境 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production / Preview / Development | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production / Preview / Development | Supabase anon キー |
| `ADMIN_PASSWORD` | Production / Preview / Development | 管理画面パスワード |
| `ANTHROPIC_API_KEY` | Production / Preview | Claude API キー |
| `NEXT_PUBLIC_SITE_URL` | Production | 本番サイトURL（OGP用） |
| `NEXT_PUBLIC_GA_ID` | Production | Google Analytics ID（任意） |

### ビルド設定

Vercel の自動検出に従う。特別な設定は不要。

| 項目 | 値 |
|---|---|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm ci` |

### `revalidate` 設定

記事詳細ページ (`app/articles/[slug]/page.tsx`) は `export const revalidate = 60` を設定しており、最大60秒のキャッシュを持つ。記事の公開・更新時は `revalidatePath` によってキャッシュが即時パージされる。

---

## 独自ドメインの設定

1. Vercel ダッシュボード → Project → Settings → Domains
2. ドメイン名を入力して「Add」
3. 表示された DNS レコード（A レコードまたは CNAME）をドメインレジストラに設定
4. Vercel が自動で SSL 証明書を発行する（Let's Encrypt）

設定後、`NEXT_PUBLIC_SITE_URL` を本番ドメインに更新する。

---

## ローカル開発での本番ビルド確認

```bash
# ビルド
npm run build

# ビルド成果物でサーバー起動
npm run start

# http://localhost:3000 で確認
```

---

## Git フック（Husky）

`.husky/` に pre-commit および pre-push フックが設定されている。push 前に自動チェックが走る場合がある。フックの内容は `.husky/pre-commit` および `.husky/pre-push` で確認できる。
