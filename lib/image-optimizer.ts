/**
 * 画像最適化ユーティリティ
 * - サムネイルを 1200×630px（OGP標準サイズ）にリサイズ
 * - JPEG 品質80% に圧縮
 * - Supabase Storage へのアップロード前に適用する
 */
import sharp from 'sharp'

const OGP_WIDTH = 1200
const OGP_HEIGHT = 630
const JPEG_QUALITY = 80

/**
 * 画像を OGP サイズ（1200×630）にリサイズして JPEG に変換する。
 * 元画像がこのサイズより小さい場合は拡大しない（withoutEnlargement）。
 */
export async function optimizeImage(input: Buffer | ArrayBuffer): Promise<Buffer> {
  const buf = input instanceof ArrayBuffer ? Buffer.from(input) : input

  return sharp(buf)
    .resize(OGP_WIDTH, OGP_HEIGHT, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, progressive: true })
    .toBuffer()
}
