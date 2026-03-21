import { test, expect, type Page } from '@playwright/test'

// ─── ユーティリティ ───────────────────────────────────────────

const FAILED_LINKS: { location: string; href: string }[] = []

/** リンクをクリックして404でないことを確認 */
async function assertLinkNotFound(
  page: Page,
  href: string,
  location: string,
) {
  const response = await page.goto(href)
  const status = response?.status() ?? 0

  if (status === 404) {
    FAILED_LINKS.push({ location, href })
    console.error(`❌ 404: [${location}] ${href}`)
  } else {
    console.log(`✅ ${status}: [${location}] ${href}`)
  }

  expect(status, `404 detected — location: ${location}, url: ${href}`).not.toBe(404)
}

/** ページ内のすべての内部リンクhrefを収集 */
async function collectInternalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (anchors) =>
    anchors
      .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
      .filter((href) =>
        href.startsWith('/') &&
        !href.startsWith('//_') &&
        !href.startsWith('/admin'),
      ),
  )
  return [...new Set(hrefs)]
}

// ─── テスト ───────────────────────────────────────────────────

test.describe('ページレスポンス確認', () => {
  test('トップページが200で返ること', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
  })

  test('カテゴリページが200で返ること', async ({ page }) => {
    const categories = ['player_analysis', 'team_analysis', 'tactics', 'data']
    for (const cat of categories) {
      const res = await page.goto(`/category/${cat}`)
      expect(res?.status(), `category: ${cat}`).toBe(200)
      console.log(`✅ 200: /category/${cat}`)
    }
  })

  test('/admin がリダイレクトまたは表示されること（404でないこと）', async ({ page }) => {
    const res = await page.goto('/admin')
    expect(res?.status()).not.toBe(404)
    console.log(`✅ ${res?.status()}: /admin`)
  })
})

test.describe('ヘッダーリンク確認', () => {
  test('ヘッダーの全リンクが404にならないこと', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page.$$eval(
      'header a[href]',
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    const internal = [...new Set(hrefs.filter((h) => h.startsWith('/')))]
    console.log(`\nヘッダーリンク: ${internal.join(', ')}`)

    for (const href of internal) {
      await assertLinkNotFound(page, href, 'ヘッダー')
    }
  })
})

test.describe('フッターリンク確認', () => {
  test('フッターの全リンクが404にならないこと', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page.$$eval(
      'footer a[href]',
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    const internal = [...new Set(hrefs.filter((h) => h.startsWith('/')))]
    console.log(`\nフッターリンク: ${internal.join(', ')}`)

    for (const href of internal) {
      await assertLinkNotFound(page, href, 'フッター')
    }
  })
})

test.describe('記事カードリンク確認', () => {
  test('トップページの記事カードが404にならないこと', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page.$$eval(
      'main a[href^="/articles/"]',
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    const unique = [...new Set(hrefs)]
    console.log(`\n記事カードリンク: ${unique.length}件`)

    for (const href of unique.slice(0, 10)) { // 最大10件チェック
      await assertLinkNotFound(page, href, 'トップページ記事カード')
    }
  })
})

test.describe('記事ページ内リンク確認', () => {
  test('記事ページのタグリンクが404にならないこと', async ({ page }) => {
    // トップページから最初の記事URLを取得
    await page.goto('/')
    const firstArticle = await page.$eval(
      'main a[href^="/articles/"]',
      (a) => (a as HTMLAnchorElement).getAttribute('href') ?? '',
    ).catch(() => null)

    if (!firstArticle) {
      console.log('記事が見つかりませんでした（スキップ）')
      test.skip()
      return
    }

    await page.goto(firstArticle)
    const tagHrefs = await page.$$eval(
      'a[href^="/tag/"]',
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    const unique = [...new Set(tagHrefs)]
    console.log(`\nタグリンク: ${unique.join(', ') || 'なし'}`)

    for (const href of unique) {
      await assertLinkNotFound(page, href, '記事ページ タグ')
    }
  })

  test('サイドバーの関連記事リンクが404にならないこと', async ({ page }) => {
    await page.goto('/')
    const firstArticle = await page.$eval(
      'main a[href^="/articles/"]',
      (a) => (a as HTMLAnchorElement).getAttribute('href') ?? '',
    ).catch(() => null)

    if (!firstArticle) {
      console.log('記事が見つかりませんでした（スキップ）')
      test.skip()
      return
    }

    await page.goto(firstArticle)
    const sidebarHrefs = await page.$$eval(
      'aside a[href^="/articles/"]',
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    const unique = [...new Set(sidebarHrefs)]
    console.log(`\nサイドバーリンク: ${unique.length}件`)

    for (const href of unique) {
      await assertLinkNotFound(page, href, 'サイドバー 関連記事')
    }
  })
})

test.afterAll(() => {
  if (FAILED_LINKS.length > 0) {
    console.error('\n━━━ 404が検出されたリンク一覧 ━━━')
    FAILED_LINKS.forEach(({ location, href }) => {
      console.error(`  ❌ [${location}] ${href}`)
    })
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } else {
    console.log('\n✅ 404リンクなし — すべてのリンクが正常です')
  }
})
