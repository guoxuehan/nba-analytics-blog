以下の記事投稿ワークフローを案内してください。

---

# NBA COURT VISION ─ 記事投稿ワークフロー

記事の生成から公開まで、以下の手順で進めてください。

---

## ステップ 1：記事を生成する

**方法A：スクリプトで自動生成（推奨）**

```bash
npm run article:generate "テーマ"
# 例: npm run article:generate "カリーのプレーオフPER推移と勝利貢献度"
```

- Claude claude-opus-4-6 が `---METADATA---` / `---BODY---` 形式で記事を生成
- `articles-draft/<slug>.md` に自動保存
- 事前に `.env.local` に `ANTHROPIC_API_KEY=sk-ant-...` を設定すること

**方法B：Claude.aiで手動生成**

1. Claude.ai で `/write-article` コマンドを使用してテーマを指定
2. 生成されたMDをコピーして `articles-draft/<slug>.md` として保存
3. ファイル名は slug と一致させること（例: `nba-playoff-2026.md`）

---

## ステップ 2：品質チェック

```bash
npm run article:check articles-draft/<ファイル名>.md
```

**チェック項目と配点（100点満点）：**

| 項目 | 配点 |
|---|---|
| 文字数（2000〜3000文字） | +10点 |
| タイトル文字数（30〜40文字） | +10点 |
| h2見出し数（3〜6個） | +10点 |
| slug形式（英語ハイフン区切り） | +10点 |
| excerpt文字数（100〜150文字） | +10点 |
| タグ数（5〜7個） | +10点 |
| 禁止ワード | -5点/個 |
| 長文率（50文字超が20%以上） | -10点 |
| リード文（「〜を分析/検証する」始まり） | -10点 |
| h2に数字（ボーナス） | +5点/個 |

**目標スコア: 80点以上**

---

## ステップ 3：スコアが80点未満の場合は修正

よくある改善点：

- **文字数不足** → BODYセクションを加筆。各h2に3〜5段落を目安に
- **タイトルが短い** → 「[チーム/選手名]の[指標]が示す[洞察]」形式に変更
- **禁止ワード** → 「と言っても過言ではない」→ 削除、「非常に」→ 具体的な数値に置換
- **リード文** → 「〜を分析する」以外の書き出しに変更（例：「数字が示す事実は明確だ。」）
- **h2に数字がない** → 「## 第4クォーター平均27.3点が示す決定力」のように具体的な数値を入れる

---

## ステップ 4：Supabaseに投稿

```bash
npm run article:publish articles-draft/<ファイル名>.md
```

または引数なしで実行するとファイル選択メニューが表示されます：

```bash
npm run article:publish
```

**投稿前に確認されること：**
- タイトル・slug・カテゴリ・タグ・文字数・excerpt
- 公開後URLのプレビュー
- 「投稿しますか？(y/n)」の確認プロンプト

---

## トラブルシューティング

**「RLSポリシーにより書き込みが拒否」エラーが出る場合**

Supabaseダッシュボードで `articles` テーブルの INSERT ポリシーを確認してください。
anon キーからの INSERT を許可するポリシーが必要です：

```sql
CREATE POLICY "Admin can insert articles"
  ON articles FOR INSERT
  TO anon
  WITH CHECK (true);
```

**「ANTHROPIC_API_KEY が設定されていません」エラーが出る場合**

`.env.local` に以下を追加してください：

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```
