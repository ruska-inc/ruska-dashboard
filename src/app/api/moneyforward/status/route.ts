import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** 連携状態を返す（アプリ設定の有無・接続済みか・最終同期） */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未ログインです' }, { status: 401 })

  const configured = !!(process.env.MF_CLIENT_ID && process.env.MF_CLIENT_SECRET)

  const { data: token } = await supabase
    .from('mf_oauth_tokens')
    .select('office_name, scope, expires_at, updated_at')
    .eq('id', 'default')
    .maybeSingle()

  const { data: lastSync } = await supabase
    .from('mf_sync_logs')
    .select('synced_at, created_count, updated_count, error')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    configured,
    connected: !!token,
    office_name: token?.office_name ?? null,
    scope: token?.scope ?? null,
    connected_at: token?.updated_at ?? null,
    last_sync: lastSync ?? null,
  })
}

/** 連携解除（保存済みトークンを削除する） */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未ログインです' }, { status: 401 })

  const { error } = await supabase.from('mf_oauth_tokens').delete().eq('id', 'default')
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })
  return NextResponse.json({ ok: true })
}
