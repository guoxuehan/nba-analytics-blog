/**
 * 作品型の図（:::viz 名前 の1行で記事に埋め込む）
 *
 * データは GitHub Actions が毎日集計して data/viz/ にコミットし、記事ページはそれを描く。
 * 図版デスクは、記事の主題に合うときだけ、この一覧から選んで本文に1行入れる。
 */
export const VIZ_LINE = /^:::viz[ \t]+([a-z0-9-]+)[ \t]*$/gm

export const VIZ_CATALOG: Record<string, { what: string; useWhen: string }> = {
  'scoring-clock': {
    what: '時計図: 今季の全得点を、試合の48分のどの時刻に入ったか（15秒ごと）で時計の上に積み上げた図',
    useWhen: '得点が入る時間帯、クォーター終盤の攻め方（2-for-1、ブザービーター、ファウルゲーム）が主題のとき',
  },
  'decided-at': {
    what: '試合はいつ決まるか: 1点＝1試合。勝ったチームが、その後一度もリードを譲らなかった時刻（試合の48分＋延長）に点を積んだ図',
    useWhen: '接戦、逆転、終盤の勝負強さ、「何点差なら安全か」、試合の決まり方が主題のとき',
  },
}

/** 一覧にない :::viz 行を本文から取り除く */
export function removeUnknownViz(body: string): { body: string; removed: string[] } {
  const removed: string[] = []
  const cleaned = body.replace(VIZ_LINE, (line, name: string) => {
    if (VIZ_CATALOG[name]) return line
    removed.push(name)
    return ''
  })
  return { body: cleaned, removed }
}
