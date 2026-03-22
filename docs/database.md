# データベース設計

Supabase（PostgreSQL）を使用。テーブルはSupabaseダッシュボードまたはCLIで管理する。マイグレーションファイルはリポジトリには含まれていない。

## テーブル一覧

### articles

記事データを管理するメインテーブル。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | 主キー |
| `title` | text | NO | — | 記事タイトル |
| `slug` | text | NO | — | URL識別子（一意制約） |
| `category` | text | NO | — | カテゴリ（下記参照） |
| `excerpt` | text | YES | NULL | 抜粋・リード文（〜150字）。記事一覧・OGPに使用 |
| `content` | text | NO | — | 記事本文（Markdown形式） |
| `tags` | text[] | NO | `'{}'` | タグの配列 |
| `thumbnail_url` | text | YES | NULL | サムネイル画像URL（Supabase Storage） |
| `published` | boolean | NO | `false` | 公開フラグ。`true` のみフロントに表示 |
| `published_at` | timestamptz | YES | NULL | 公開日時。新規公開時に自動セット |
| `created_at` | timestamptz | NO | — | 作成日時 |
| `updated_at` | timestamptz | NO | — | 最終更新日時 |

**カテゴリ値（`category` カラム）:**

| 値 | 表示名（日本語） |
|---|---|
| `player_analysis` | 選手分析 |
| `team_analysis` | チーム分析 |
| `tactics` | 戦術 |
| `data` | データ |

**主なインデックス:**
- `slug` に一意制約
- `published` + `published_at` でフロント側のクエリを最適化することを推奨

---

### comments

各記事へのユーザーコメントを管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | 主キー |
| `article_id` | uuid | NO | — | 参照先記事のID（`articles.id` 外部キー） |
| `author_name` | text | NO | — | 投稿者名 |
| `content` | text | NO | — | コメント本文 |
| `created_at` | timestamptz | NO | `now()` | 投稿日時 |

**クエリパターン:**
```sql
-- 記事詳細ページでの取得（新しい順）
SELECT id, author_name, content, created_at
FROM comments
WHERE article_id = $1
ORDER BY created_at DESC;
```

---

### contacts

お問い合わせフォームの送信データを保存する。

| カラム | 型 | NULL | 説明 |
|---|---|---|---|
| `id` | uuid | NO | 主キー（`gen_random_uuid()`） |
| `name` | text | NO | 送信者名 |
| `email` | text | NO | 送信者メールアドレス |
| `subject` | text | NO | 件名 |
| `message` | text | NO | 本文 |
| `created_at` | timestamptz | NO | 送信日時（`now()` デフォルト推奨） |

データはSupabaseダッシュボードから確認する。メール通知を設定する場合はSupabase Webhookを使用する。

---

## RLSポリシー

Row Level Security（RLS）を有効化した上で以下のポリシーを設定することを推奨する。

### articles テーブル

| ポリシー名 | 操作 | 対象ロール | 条件 |
|---|---|---|---|
| `Public can read published articles` | SELECT | `anon`, `authenticated` | `published = true` |
| `Service role has full access` | ALL | `service_role` | 制限なし（RLSバイパス） |

> フロントエンドは anon キーを使用するため、`published = false` の記事は自動的に非表示になる。管理画面は `service_role` キーを使用し、RLSをバイパスして下書きも含む全記事を操作する。

### comments テーブル

| ポリシー名 | 操作 | 対象ロール | 条件 |
|---|---|---|---|
| `Public can read comments` | SELECT | `anon`, `authenticated` | 制限なし |
| `Public can insert comments` | INSERT | `anon`, `authenticated` | 制限なし |
| `Service role can delete comments` | DELETE | `service_role` | 制限なし |

### contacts テーブル

| ポリシー名 | 操作 | 対象ロール | 条件 |
|---|---|---|---|
| `Public can insert contacts` | INSERT | `anon`, `authenticated` | 制限なし |
| `Service role can read contacts` | SELECT | `service_role` | 制限なし |

---

## Storageバケット

### `post-images`

記事サムネイル画像を保存するバケット。

| 項目 | 設定値 |
|---|---|
| バケット名 | `post-images` |
| 公開設定 | Public（公開） |
| 許可MIMEタイプ | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| ファイルサイズ上限 | 推奨: 5MB以下 |

**アクセスURL形式:**
```
https://<project-id>.supabase.co/storage/v1/object/public/post-images/<filename>
```

`next.config.ts` の `images.remotePatterns` で `*.supabase.co` を許可済みのため、Next.js の `<Image>` コンポーネントで直接使用できる。

**アップロード方法:**
管理画面の記事編集フォームから「サムネイル画像」フィールドを使用してアップロードする（`/api/admin/upload` 経由）。
