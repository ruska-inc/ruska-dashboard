import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMfCredentials, MfError, MF_AUTHORIZE_URL, MF_SCOPE } from '@/lib/moneyforward/client'

export const dynamic = 'force-dynamic'

/**
 * マネーフォワードの認可画面へリダイレクトする。
 * CSRF対策のstateはHttpOnly Cookieに保存し、コールバックで突合する。
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const creds = getMfCredentials(new URL(req.url).origin)
    const state = crypto.randomUUID()

    const authorizeUrl = new URL(MF_AUTHORIZE_URL)
    authorizeUrl.searchParams.set('client_id', creds.clientId)
    authorizeUrl.searchParams.set('redirect_uri', creds.redirectUri)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', MF_SCOPE)
    authorizeUrl.searchParams.set('state', state)

    const res = NextResponse.redirect(authorizeUrl.toString())
    res.cookies.set('mf_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return res
  } catch (e) {
    const message = e instanceof MfError ? e.message : (e as Error).message
    return NextResponse.redirect(
      new URL(`/settings?mf_error=${encodeURIComponent(message)}`, req.url),
    )
  }
}
