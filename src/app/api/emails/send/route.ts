import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// リクエストボディ
type SendPayload = {
  items: Array<{
    lead_id: string
    to_email: string
    subject: string
    body: string
  }>
  template_id?: string | null
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const fromName = process.env.RESEND_FROM_NAME || ''

  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY / RESEND_FROM_EMAIL が設定されていません' },
      { status: 500 },
    )
  }

  const payload: SendPayload = await req.json()
  if (!payload.items?.length) {
    return NextResponse.json({ error: '送信対象がありません' }, { status: 400 })
  }

  // Supabase (履歴保存用)
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()

  const resend = new Resend(apiKey)
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail

  const results: Array<{ lead_id: string; success: boolean; error?: string; resend_id?: string }> = []

  for (const it of payload.items) {
    if (!it.to_email || !/@/.test(it.to_email)) {
      results.push({ lead_id: it.lead_id, success: false, error: 'メールアドレスが不正' })
      await supabase.from('sent_emails').insert({
        lead_id: it.lead_id,
        template_id: payload.template_id ?? null,
        to_email: it.to_email || '',
        from_email: fromEmail,
        subject: it.subject,
        body: it.body,
        status: 'failed',
        error_message: 'メールアドレスが不正',
        sent_by: user?.id ?? null,
      })
      continue
    }
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [it.to_email],
        subject: it.subject,
        text: it.body,
      })
      if (error) throw new Error(error.message)
      results.push({ lead_id: it.lead_id, success: true, resend_id: data?.id })
      await supabase.from('sent_emails').insert({
        lead_id: it.lead_id,
        template_id: payload.template_id ?? null,
        to_email: it.to_email,
        from_email: fromEmail,
        subject: it.subject,
        body: it.body,
        status: 'sent',
        resend_id: data?.id ?? null,
        sent_by: user?.id ?? null,
      })
    } catch (e) {
      const msg = (e as Error).message
      results.push({ lead_id: it.lead_id, success: false, error: msg })
      await supabase.from('sent_emails').insert({
        lead_id: it.lead_id,
        template_id: payload.template_id ?? null,
        to_email: it.to_email,
        from_email: fromEmail,
        subject: it.subject,
        body: it.body,
        status: 'failed',
        error_message: msg,
        sent_by: user?.id ?? null,
      })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.length - succeeded
  return NextResponse.json({ results, succeeded, failed })
}
