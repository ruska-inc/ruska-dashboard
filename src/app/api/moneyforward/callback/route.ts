import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMfCredentials, exchangeCodeForToken, saveToken, fetchOffice, MfError } from '@/lib/moneyforward/client'

export const dynamic = 'force-dynamic'

/** 認可コードを受け取り、アクセストークン／リフレッシュトークンを保存する */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const settings = (msg: string, ok = false) =>
    NextResponse.redirect(
      new URL(`/settings?${ok ? 'mf_connected' : 'mf_error'}=${encodeURIComponent(msg)}`, req.url),
    )

  const error = url.searchParams.get('error')
  if (error) {
    const desc = url.searchParams.get('error_description') ?? error
    return settings(`連携がキャンセルされました: ${desc}`)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = req.cookies.get('mf_oauth_state')?.value
  if (!code) return settings('認可コードが取得できませんでした')
  if (!state || !expectedState || state !== expectedState) {
    return settings('stateが一致しません。お手数ですが最初からやり直してください')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const creds = getMfCredentials(url.origin)
    const token = await exchangeCodeForToken(creds, code)
    await saveToken(supabase, token, { connected_by: user.id })

    // 連携先の事業者名を控えておく（設定画面での確認用。取得できなくても連携自体は成立する）
    try {
      const office = await fetchOffice(supabase, creds)
      await supabase.from('mf_oauth_tokens').update({ office_name: office.name }).eq('id', 'default')
    } catch {}

    const res = settings('マネーフォワードと連携しました', true)
    res.cookies.delete('mf_oauth_state')
    return res
  } catch (e) {
    const message = e instanceof MfError ? e.message : (e as Error).message
    return settings(message)
  }
}
