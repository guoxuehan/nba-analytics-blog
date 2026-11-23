/**
 * アフィリエイト（楽天・Amazon）
 *
 * 記事本文に `:::shop キーワード` の行があると、その位置に「関連商品を探す」枠を出す。
 * リンク先は各ストアの検索結果（特定の商品URLを AI に書かせると、存在しない商品を作るおそれがあるため）。
 * ID が未設定のストアは表示しない。両方未設定なら枠も「プロモーションを含む」表示も出さない。
 *
 * ID は公開リンクに含まれる値なので、ここに直接書いてよい（環境変数があればそちらを優先）
 */

const AMAZON_ASSOCIATE_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG || 'nbacourtvisio-22'
const RAKUTEN_AFFILIATE_ID = process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID || '59e51b29.e88e86e3.59e51b2a.8bc7dd81'

/** `:::shop キーワード` の行 */
export const SHOP_LINE = /^:::shop[ \t]+(.+?)[ \t]*$/gm

export type ShopLink = { store: 'rakuten' | 'amazon'; label: string; url: string }

export function shopLinks(keyword: string): ShopLink[] {
  const links: ShopLink[] = []
  if (RAKUTEN_AFFILIATE_ID) {
    const target = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`
    links.push({
      store: 'rakuten',
      label: '楽天市場で探す',
      url: `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(target)}&m=${encodeURIComponent(target)}`,
    })
  }
  if (AMAZON_ASSOCIATE_TAG) {
    links.push({
      store: 'amazon',
      label: 'Amazonで探す',
      url: `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${encodeURIComponent(AMAZON_ASSOCIATE_TAG)}`,
    })
  }
  return links
}

export const affiliateEnabled = () => !!(AMAZON_ASSOCIATE_TAG || RAKUTEN_AFFILIATE_ID)
export const amazonEnabled = () => !!AMAZON_ASSOCIATE_TAG

/** 記事にアフィリエイトの枠が表示されるか（「プロモーションを含む」表示の判定に使う） */
export function hasShop(content: string): boolean {
  return affiliateEnabled() && new RegExp(SHOP_LINE.source, 'm').test(content)
}
