/**
 * 自動記事生成・公開パイプライン（メインスクリプト）
 * fetch → generate → publish を一括実行
 * ログを logs/YYYY-MM-DD.log に保存
 * エラーが発生しても次のステップに進む
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { spawnSync } from 'child_process'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const LOGS_DIR = path.resolve(process.cwd(), 'logs')
const today = new Date().toISOString().split('T')[0]
const LOG_FILE = path.join(LOGS_DIR, `${today}.log`)

// ─── Logger ─────────────────────────────────────────────────────────
const logBuffer: string[] = []

function log(message: string): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${message}`
  console.log(message)
  logBuffer.push(line)
}

function flushLog(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  }
  const existing = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : ''
  fs.writeFileSync(LOG_FILE, existing + logBuffer.join('\n') + '\n', 'utf-8')
}

// ─── ステップ実行 ────────────────────────────────────────────────────
type StepResult = {
  label: string
  success: boolean
  output: string
}

function runStep(label: string, scriptPath: string): StepResult {
  log('')
  log('━'.repeat(50))
  log(`STEP: ${label}`)
  log('━'.repeat(50))

  const result = spawnSync('npx', ['tsx', scriptPath], {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: { ...process.env },
    timeout: 300_000, // 5分タイムアウト
  })

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const combined = stdout + (stderr ? `\n[stderr]\n${stderr}` : '')

  // 出力をそのままターミナルに表示
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)

  // ログにも記録
  if (combined.trim()) {
    for (const line of combined.split('\n')) {
      logBuffer.push(`[${new Date().toISOString()}] ${line}`)
    }
  }

  const success = result.status === 0 && !result.error

  if (result.error) {
    const errMsg = result.error instanceof Error ? result.error.message : String(result.error)
    log(`❌ ${label} 失敗: ${errMsg}`)
  } else if (result.status !== 0) {
    log(`❌ ${label} 終了コード: ${result.status}`)
  } else {
    log(`✅ ${label} 完了`)
  }

  return { label, success, output: combined }
}

// ─── サマリー解析 ────────────────────────────────────────────────────
function parseSummary(results: StepResult[]): {
  generated: number
  published: number
  needsReview: number
} {
  const generateOutput = results.find((r) => r.label.includes('generate'))?.output ?? ''
  const publishOutput = results.find((r) => r.label.includes('publish'))?.output ?? ''

  const genMatch = generateOutput.match(/生成完了:\s*(\d+)\/\d+/)
  const pubMatch = publishOutput.match(/公開:\s*(\d+)本/)
  const reviewMatch = publishOutput.match(/レビュー待ち:\s*(\d+)本/)

  return {
    generated: genMatch ? parseInt(genMatch[1], 10) : 0,
    published: pubMatch ? parseInt(pubMatch[1], 10) : 0,
    needsReview: reviewMatch ? parseInt(reviewMatch[1], 10) : 0,
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now()

  log('═'.repeat(50))
  log('  NBA COURT VISION 自動パイプライン')
  log(`  開始: ${new Date().toISOString()}`)
  log('═'.repeat(50))

  const steps = [
    {
      label: 'データ取得 (fetch-nba-data)',
      script: 'scripts/fetch-nba-data.ts',
    },
    {
      label: '記事生成 (auto-generate)',
      script: 'scripts/auto-generate.ts',
    },
    {
      label: '記事公開 (auto-publish)',
      script: 'scripts/auto-publish.ts',
    },
  ]

  const results: StepResult[] = []

  // エラーが発生しても次のステップに進む
  for (const step of steps) {
    const result = runStep(step.label, step.script)
    results.push(result)
  }

  // 最終サマリー
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const { generated, published, needsReview } = parseSummary(results)

  log('')
  log('═'.repeat(50))
  log('  パイプライン完了')
  log('═'.repeat(50))
  log('')
  log('  ステップ結果:')
  for (const r of results) {
    log(`    ${r.success ? '✅' : '❌'} ${r.label}`)
  }
  log('')
  log(`  生成: ${generated}本 / 公開: ${published}本 / レビュー待ち: ${needsReview}本`)
  log(`  実行時間: ${elapsed}秒`)
  log(`  ログ保存先: logs/${today}.log`)
  log('')

  flushLog()

  // いずれかのステップが失敗していた場合は exit code 1
  const hasFailure = results.some((r) => !r.success)
  if (hasFailure) process.exit(1)
}

main().catch((err) => {
  log(`致命的エラー: ${err instanceof Error ? err.message : String(err)}`)
  flushLog()
  process.exit(1)
})
