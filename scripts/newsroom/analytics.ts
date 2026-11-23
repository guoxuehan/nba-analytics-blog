/**
 * GA4（Google アナリティクス）と Search Console から、週次レポート用の数字を取る
 *
 * 認証: サービスアカウントの JSON キー（GOOGLE_SERVICE_ACCOUNT_JSON）。閲覧権限だけを使う
 * 設定:
 *   GA4_PROPERTY_ID … GA4 のプロパティID（数字。G-XXXX の測定IDではない）
 *   GSC_SITE_URL    … Search Console のプロパティ（既定 https://sports-academia.com/。ドメインプロパティなら sc-domain:sports-academia.com）
 * どれかが未設定・失敗しても例外は投げず、その旨を返す（週次レポート自体は止めない）
 */
import * as crypto from 'crypto'

type ServiceAccount = { client_email: string; private_key: string }

export type AnalyticsReport = {
  ga: null | {
    users: number
    usersPrev: number
    pageViews: number
    pageViewsPrev: number
    channels: { name: string; sessions: number }[]
    topPages: { path: string; title: string; views: number }[]
  }
  gaError?: string
  gsc: null | {
    period: string
    clicks: number
    impressions: number
    ctr: number
    position: number
    topQueries: { query: string; clicks: number; impressions: number; position: number }[]
  }
  gscError?: string
}

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ')

/** サービスアカウントの JWT を署名して、アクセストークンと交換する */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
  const json = (await res.json()) as { access_token?: string; error_description?: string; error?: string }
  if (!json.access_token) throw new Error(`認証に失敗: ${json.error_description ?? json.error ?? res.status}`)
  return json.access_token
}

async function googlePost<T>(url: string, token: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok) throw new Error(`${res.status} ${json.error?.message ?? ''}`.trim())
  return json
}

// ─── GA4 ─────────────────────────────────────────────────────────────
type GaReport = { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[] }

type Options = { days: number; top: number }

async function fetchGa(token: string, propertyId: string, { days, top }: Options): Promise<NonNullable<AnalyticsReport['ga']>> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const thisWeek = { startDate: `${days}daysAgo`, endDate: 'yesterday' }
  const lastWeek = { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` }
  const totals = (dateRange: object) =>
    googlePost<GaReport>(url, token, {
      dateRanges: [dateRange],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
    })
  const [cur, prev, channels, pages] = await Promise.all([
    totals(thisWeek),
    totals(lastWeek),
    googlePost<GaReport>(url, token, {
      dateRanges: [thisWeek],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 6,
    }),
    googlePost<GaReport>(url, token, {
      dateRanges: [thisWeek],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/articles/' } } },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: top,
    }),
  ])
  const num = (r: GaReport, i: number) => Number(r.rows?.[0]?.metricValues[i]?.value ?? 0)
  return {
    users: num(cur, 0),
    pageViews: num(cur, 1),
    usersPrev: num(prev, 0),
    pageViewsPrev: num(prev, 1),
    channels: (channels.rows ?? []).map((r) => ({
      name: r.dimensionValues![0].value,
      sessions: Number(r.metricValues[0].value),
    })),
    topPages: (pages.rows ?? []).map((r) => ({
      path: r.dimensionValues![0].value,
      title: r.dimensionValues![1].value.replace(/\s*\|\s*NBA COURT VISION$/, ''),
      views: Number(r.metricValues[0].value),
    })),
  }
}

// ─── Search Console ──────────────────────────────────────────────────
type GscResponse = { rows?: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }

async function fetchGsc(token: string, siteUrl: string, { days, top }: Options): Promise<NonNullable<AnalyticsReport['gsc']>> {
  // Search Console のデータは2〜3日遅れて確定するため、3日前までの期間を見る
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
  const range = { startDate: day(days + 2), endDate: day(3) }
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const [total, queries] = await Promise.all([
    googlePost<GscResponse>(url, token, { ...range }),
    googlePost<GscResponse>(url, token, { ...range, dimensions: ['query'], rowLimit: top * 2 }),
  ])
  const t = total.rows?.[0]
  return {
    period: `${range.startDate}〜${range.endDate}`,
    clicks: t?.clicks ?? 0,
    impressions: t?.impressions ?? 0,
    ctr: t?.ctr ?? 0,
    position: t?.position ?? 0,
    topQueries: (queries.rows ?? []).map((r) => ({
      query: r.keys![0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    })),
  }
}

/**
 * 認証情報がなければ null を返す
 * @param days 集計する日数（既定7日。GA4 は前の同じ日数と比べる）
 * @param top  よく読まれた記事の件数（検索クエリはその2倍）
 */
export async function fetchAnalytics({ days = 7, top = 5 }: Partial<Options> = {}): Promise<AnalyticsReport | null> {
  const opts = { days, top }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  const report: AnalyticsReport = { ga: null, gsc: null }
  let token: string
  try {
    token = await getAccessToken(JSON.parse(raw) as ServiceAccount)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ...report, gaError: msg, gscError: msg }
  }

  const propertyId = process.env.GA4_PROPERTY_ID
  if (propertyId) {
    try {
      report.ga = await fetchGa(token, propertyId, opts)
    } catch (err) {
      report.gaError = err instanceof Error ? err.message : String(err)
    }
  } else {
    report.gaError = 'GA4_PROPERTY_ID が未設定'
  }

  try {
    report.gsc = await fetchGsc(token, process.env.GSC_SITE_URL || 'https://sports-academia.com/', opts)
  } catch (err) {
    report.gscError = err instanceof Error ? err.message : String(err)
  }
  return report
}
