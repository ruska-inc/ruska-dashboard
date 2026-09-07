// =============================================
// マネーフォワード クラウド請求書 API v3 クライアント（サーバー専用）
//
// 認可: OAuth 2.0 認可コードフロー
//   authorize : https://api.biz.moneyforward.com/authorize
//   token     : https://api.biz.moneyforward.com/token
//   scope     : mfc/invoice/data.read（取得のみ。書き込みはしない）
// =============================================

// このモジュールはサーバー（Route Handler）からのみ読み込むこと。クライアントに含めない。
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MfBilling, MfQuote, MfListResponse, MfBillingRangeKey, MfQuoteRangeKey } from './types'

export const MF_AUTHORIZE_URL = 'https://api.biz.moneyforward.com/authorize'
export const MF_TOKEN_URL = 'https://api.biz.moneyforward.com/token'
export const MF_API_BASE = 'https://invoice.moneyforward.com/api/v3'
// 取得専用。請求書の作成・更新はダッシュボードからは行わない
export const MF_SCOPE = 'mfc/invoice/data.read'

const TOKEN_ROW_ID = 'default'
// アクセストークンの有効期限が切れる何秒前からリフレッシュするか
const REFRESH_MARGIN_SEC = 120

export class MfError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

export interface MfCredentials {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** 環境変数からOAuthアプリの認証情報を取得する */
export function getMfCredentials(origin: string): MfCredentials {
  const clientId = process.env.MF_CLIENT_ID
  const clientSecret = process.env.MF_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new MfError(
      'MF_CLIENT_ID / MF_CLIENT_SECRET が設定されていません。マネーフォワード クラウドの「アプリポータル」でアプリを作成し、.env.local または Vercel の環境変数に設定してください。',
      500,
    )
  }
  // アプリポータルに登録するリダイレクトURIと完全一致させる必要がある
  const redirectUri = process.env.MF_REDIRECT_URI || `${origin}/api/moneyforward/callback`
  return { clientId, clientSecret, redirectUri }
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
  token_type?: string
}

interface StoredToken {
  access_token: string | null
  refresh_token: string
  expires_at: string | null
  scope: string | null
}

async function requestToken(
  creds: MfCredentials,
  body: Record<string, string>,
): Promise<TokenResponse> {
  // アプリポータルの「クライアント認証方式」の設定に合わせる。
  // 既定の CLIENT_SECRET_BASIC は Authorization: Basic ヘッダー、
  // CLIENT_SECRET_POST はリクエストボディに client_id / client_secret を載せる。
  const useBasicAuth = process.env.MF_CLIENT_AUTH_METHOD !== 'client_secret_post'

  const params = new URLSearchParams(body)
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }

  if (useBasicAuth) {
    const basic = Buffer.from(`${encodeURIComponent(creds.clientId)}:${encodeURIComponent(creds.clientSecret)}`).toString('base64')
    headers.Authorization = `Basic ${basic}`
  } else {
    params.set('client_id', creds.clientId)
    params.set('client_secret', creds.clientSecret)
  }

  const res = await fetch(MF_TOKEN_URL, {
    method: 'POST',
    headers,
    body: params.toString(),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = json?.error_description || json?.error || `HTTP ${res.status}`
    throw new MfError(`マネーフォワードのトークン取得に失敗しました: ${detail}`, res.status)
  }
  return json as TokenResponse
}

/** 認可コードをアクセストークンに交換する */
export function exchangeCodeForToken(creds: MfCredentials, code: string) {
  return requestToken(creds, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: creds.redirectUri,
  })
}

/** リフレッシュトークンでアクセストークンを更新する */
export function refreshAccessToken(creds: MfCredentials, refreshToken: string) {
  return requestToken(creds, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

/** 取得したトークンをSupabaseに保存する */
export async function saveToken(
  supabase: SupabaseClient,
  token: TokenResponse,
  extra: { connected_by?: string | null; office_name?: string | null } = {},
) {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString()
  const { error } = await supabase.from('mf_oauth_tokens').upsert({
    id: TOKEN_ROW_ID,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: expiresAt,
    scope: token.scope ?? MF_SCOPE,
    ...(extra.connected_by !== undefined ? { connected_by: extra.connected_by } : {}),
    ...(extra.office_name !== undefined ? { office_name: extra.office_name } : {}),
  })
  if (error) throw new MfError(`トークンの保存に失敗しました: ${error.message}`, 500)
}

/**
 * 有効なアクセストークンを返す。
 * 期限切れ（間近）ならリフレッシュして保存し直す。
 * マネーフォワードはリフレッシュのたびに新しいrefresh_tokenを返すため、必ず上書き保存する。
 */
export async function getAccessToken(supabase: SupabaseClient, creds: MfCredentials): Promise<string> {
  const { data, error } = await supabase
    .from('mf_oauth_tokens')
    .select('access_token, refresh_token, expires_at, scope')
    .eq('id', TOKEN_ROW_ID)
    .maybeSingle()

  if (error) throw new MfError(`トークンの読み込みに失敗しました: ${error.message}`, 500)
  if (!data) {
    throw new MfError('マネーフォワードと未連携です。設定画面から連携してください。', 401)
  }

  const stored = data as StoredToken
  const expiresAt = stored.expires_at ? new Date(stored.expires_at).getTime() : 0
  const stillValid = stored.access_token && expiresAt - REFRESH_MARGIN_SEC * 1000 > Date.now()
  if (stillValid) return stored.access_token!

  const refreshed = await refreshAccessToken(creds, stored.refresh_token)
  await saveToken(supabase, refreshed)
  return refreshed.access_token
}

/** MF APIを叩く。トークン失効時は一度だけリフレッシュして再試行する */
async function mfFetch<T>(
  supabase: SupabaseClient,
  creds: MfCredentials,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') query.set(k, String(v))
  }
  const url = `${MF_API_BASE}${path}?${query.toString()}`

  const call = async (token: string) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })

  let res = await call(await getAccessToken(supabase, creds))

  if (res.status === 401) {
    // 期限内でも失効しているケースがあるため、強制リフレッシュして1度だけ再試行
    const { data } = await supabase
      .from('mf_oauth_tokens')
      .select('refresh_token')
      .eq('id', TOKEN_ROW_ID)
      .maybeSingle()
    if (!data?.refresh_token) {
      throw new MfError('マネーフォワードとの連携が切れています。設定画面から再連携してください。', 401)
    }
    const refreshed = await refreshAccessToken(creds, data.refresh_token)
    await saveToken(supabase, refreshed)
    res = await call(refreshed.access_token)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new MfError(`マネーフォワードAPIエラー (${res.status}): ${body.slice(0, 300)}`, res.status)
  }
  return (await res.json()) as T
}

const PER_PAGE = 100
// 暴走防止（100件 × 20ページ = 2000件）
const MAX_PAGES = 20

/** ページネーションを辿って全件取得する */
async function fetchAllPages<T>(
  supabase: SupabaseClient,
  creds: MfCredentials,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await mfFetch<MfListResponse<T>>(supabase, creds, path, {
      ...params,
      page,
      per_page: PER_PAGE,
    })
    all.push(...res.data)
    if (page >= (res.pagination?.total_pages ?? 1)) break
  }
  return all
}

export interface MfDateRange {
  from?: string  // "YYYY-MM-DD"
  to?: string
}

/** 請求書を取得する（既定は請求日で絞り込み） */
export function fetchBillings(
  supabase: SupabaseClient,
  creds: MfCredentials,
  range: MfDateRange = {},
  rangeKey: MfBillingRangeKey = 'billing_date',
) {
  return fetchAllPages<MfBilling>(supabase, creds, '/billings', {
    range_key: range.from || range.to ? rangeKey : undefined,
    from: range.from,
    to: range.to,
  })
}

/** 見積書を取得する（既定は見積日で絞り込み） */
export function fetchQuotes(
  supabase: SupabaseClient,
  creds: MfCredentials,
  range: MfDateRange = {},
  rangeKey: MfQuoteRangeKey = 'quote_date',
) {
  return fetchAllPages<MfQuote>(supabase, creds, '/quotes', {
    range_key: range.from || range.to ? rangeKey : undefined,
    from: range.from,
    to: range.to,
  })
}

/** 事業者情報（連携先の会社名の確認用） */
export function fetchOffice(supabase: SupabaseClient, creds: MfCredentials) {
  return mfFetch<{ id: string; name: string }>(supabase, creds, '/office', {})
}
