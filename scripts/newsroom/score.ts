/**
 * 記事ファイルの品質スコア（機械判定）を出力する
 * 使い方: npx tsx scripts/newsroom/score.ts content/articles/<slug>.md
 */
import { computeScore } from '../auto-publish'
import { setOutput } from './_lib'

const file = process.argv[2]
if (!file) {
  console.error('ファイルを指定してください')
  process.exit(1)
}
const score = computeScore(file)
console.log(score)
setOutput('score', String(score))
