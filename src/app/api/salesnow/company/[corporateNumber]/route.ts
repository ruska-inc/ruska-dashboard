import { NextRequest, NextResponse } from 'next/server'

const SALESNOW_BASE = 'https://api-data.api.salesnow.jp/v1/enterprise'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ corporateNumber: string }> }) {
  const apiKey = process.env.SALESNOW_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SALESNOW_API_KEYが設定されていません' },
      { status: 500 },
    )
  }
  const { corporateNumber } = await ctx.params
  try {
    const res = await fetch(`${SALESNOW_BASE}/companies/${corporateNumber}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
