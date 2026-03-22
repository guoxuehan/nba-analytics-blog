import Anthropic from '@anthropic-ai/sdk'
import { verifyAdminRequest } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const client = new Anthropic()
  // 認証チェック
  const isAdmin = await verifyAdminRequest(request)
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { theme } = await request.json().catch(() => ({}))
  if (!theme || typeof theme !== 'string') {
    return Response.json({ error: 'theme が必要です' }, { status: 400 })
  }
  if (theme.length > 500) {
    return Response.json({ error: 'theme は500文字以内で入力してください' }, { status: 400 })
  }

  const prompt = `あなたはNBAに精通したスポーツアナリストです。
以下のテーマについて、日本語でデータに基づいた分析記事の下書きを書いてください。

テーマ：${theme}

記事の構成：
1. リード文（読者の興味を引く導入、3-4文）
2. データ分析セクション（具体的な数字を使った分析）
3. 考察セクション（データから読み取れる傾向や意味）
4. 【ここにあなたの見解を追加してください】（プレースホルダー）
5. まとめ（3文程度）

文体：
- 客観的だが情熱的
- 専門用語を使いつつも、バスケ初心者にも伝わるように補足
- 短い段落で読みやすく

マークダウン形式で出力してください。`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return Response.json({ content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '生成に失敗しました'
    return Response.json({ error: msg }, { status: 500 })
  }
}
