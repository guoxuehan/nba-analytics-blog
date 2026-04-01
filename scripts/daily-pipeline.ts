/**
 * 自動記事生成・公開パイプライン（メインスクリプト）
 * fetch → generate → publish を一括実行
 * ログを logs/YYYY-MM-DD.log に保存
 * エラーが発生しても次のステップに進む
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { run as fetchData } from './fetch-nba-data'
import { run as generateArticles } from './auto-generate'
import { run as publishArticles } from './auto-publish'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const LOGS_DIR = path.resolve(process.cwd(), 'logs')
const today = new Date().toISOString().split('T')[0]
const LOG_FILE = path.join(LOGS_DIR, `${today}.log`)

// ─── Logger ─────────────────────────────────────────────────────────
const logBuffer: string[] = []

function log(message: string): void {
  const ts = new Date().toISOString()
  console.log(message)
  logBuffer.push(`[${ts}] ${message}`)
}

function flushLog(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
  const existing = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : ''
  fs.writeFileSync(LOG_FILE, existing + logBuffer.join('\n') + '\n', 'utf-8')
}

// ─── ステップ実行（直接関数呼び出し）────────────────────────────────
type StepResult = {
  label: string
  success: boolean
  error?: string
}

async function runStep<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: StepResult; value: T | null }> {
  log('')
  log('━'.repeat(50))
  log(`STEP: ${label}`)
  log('━'.repeat(50))

  try {
    const value = await fn()
    log(`✅ ${label} 完了`)
    return { result: { label, success: true }, value }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`❌ ${label} 失敗: ${msg}`)
    return { result: { label, success: false, error: msg }, value: null }
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now()

  log('═'.repeat(50))
  log('  NBA COURT VISION 自動パイプライン')
  log(`  開始: ${new Date().toISOString()}`)
  log('═'.repeat(50))

  // Step 1: データ取得
  const fetchStep = await runStep('データ取得 (fetch-nba-data)', fetchData)

  // Step 2: 記事生成（Step 1 失敗でも続行）
  const generateStep = await runStep('記事生成 (auto-generate)', generateArticles)

  // Step 3: 記事公開（Step 2 失敗でも続行）
  const publishStep = await runStep('記事公開 (auto-publish)', publishArticles)

  // ─── 最終サマリー ─────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const steps = [fetchStep.result, generateStep.result, publishStep.result]
  const publishStats = publishStep.value ?? { published: 0, needsReview: 0, skipped: 0 }

  log('')
  log('═'.repeat(50))
  log('  パイプライン完了')
  log('═'.repeat(50))
  log('')
  log('  ステップ結果:')
  for (const s of steps) {
    log(`    ${s.success ? '✅' : '❌'} ${s.label}${s.error ? ` — ${s.error}` : ''}`)
  }
  log('')
  log(
    `  生成: 4本 / 公開: ${publishStats.published}本 / レビュー待ち: ${publishStats.needsReview}本`,
  )
  log(`  実行時間: ${elapsed}秒`)
  log(`  ログ保存先: logs/${today}.log`)
  log('')

  flushLog()

  if (steps.some((s) => !s.success)) process.exit(1)
}

main().catch((err) => {
  log(`致命的エラー: ${err instanceof Error ? err.message : String(err)}`)
  flushLog()
  process.exit(1)
})
