/**
 * 記事生成スクリプト
 * 使用方法: npm run article:generate "テーマ"
 */
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DRAFT_DIR = path.resolve(process.cwd(), 'articles-draft')

const SYSTEM_PROMPT = `あなたはNBA分析メディア「NBA COURT VISION」の編集長です。
戦略コンサルタント兼PhDデータサイエンティストの視点で記事を作成してください。

以下のフォーマットで出力すること（フォーマットを厳守）：

---METADATA---
title: （30〜40文字、キーワードを前半に）
slug: （英語、ハイフン区切り、例: nba-playoff-preview-2026）
category: （player_analysis / team_analysis / tactics / data のいずれか1つ）
tags: （カンマ区切り、5〜7個）
excerpt: （100〜150文字）
---METADATA---

---BODY---
（Markdown形式の記事本文、2,000〜3,000文字）

構成：
1. リード文（3〜4文）
2. ## データ分析セクション1（具体的な数字入りの見出し）
3. ## データ分析セクション2（具体的な数字入りの見出し）
4. ## 考察・深掘り
5. ## 筆者の視点（戦略コンサル×データサイエンティストとして1〜2段落）
6. ## まとめ
---BODY---

文体：客観的だが情熱的、専門用語は補足付き、短い段落。
禁止：「と言っても過言ではない」「言うまでもなく」「非常に」「まさに」「改めて」
禁止：リード文を「〜を分析する」「〜を検証する」で始めること`

async function main() {
  const theme = process.argv[2]
  if (!theme) {
    console.error('使用方法: npm run article:generate "テーマ"')
    console.error('例: npm run article:generate "プレーオフ展望 2026"')
    process.exit(1)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY が .env.local に設定されていません')
    process.exit(1)
  }

  console.log(`\n📝 テーマ: "${theme}"`)
  console.log('記事を生成中...\n')

  const client = new Anthropic({ apiKey })

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `以下のテーマでNBA分析記事を生成してください。\n\nテーマ: ${theme}`,
      },
    ],
  })

  // ストリーミングで進捗を表示
  let dotCount = 0
  stream.on('text', () => {
    if (dotCount % 100 === 0) process.stdout.write('.')
    dotCount++
  })

  const response = await stream.finalMessage()
  console.log('\n')

  const text = response.content[0]
  if (text.type !== 'text') {
    console.error('予期しないレスポンス形式です')
    process.exit(1)
  }

  const rawText = text.text.trim()

  // slug を抽出
  const slugMatch = rawText.match(/^slug:\s*(.+)$/m)
  if (!slugMatch) {
    console.error('❌ slugが生成されませんでした。出力内容を確認してください:')
    console.error(rawText.slice(0, 500))
    process.exit(1)
  }
  const slug = slugMatch[1].trim().replace(/['"]/g, '')

  if (!fs.existsSync(DRAFT_DIR)) {
    fs.mkdirSync(DRAFT_DIR, { recursive: true })
  }

  const filename = `${slug}.md`
  const filepath = path.join(DRAFT_DIR, filename)
  fs.writeFileSync(filepath, rawText, 'utf-8')

  console.log(`✅ 保存しました: articles-draft/${filename}`)
  console.log('\n次のステップ:')
  console.log(`  npm run article:check articles-draft/${filename}`)
  console.log(`  npm run article:publish articles-draft/${filename}`)
  console.log('')
}

main().catch((err: unknown) => {
  console.error('エラー:', err instanceof Error ? err.message : err)
  process.exit(1)
})
