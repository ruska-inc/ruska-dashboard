import { NextRequest, NextResponse } from 'next/server'

const SALESNOW_BASE = 'https://api-data.api.salesnow.jp/v1/enterprise'

export async function POST(req: NextRequest) {
  const apiKey = process.env.SALESNOW_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SALESNOW_API_KEYが設定されていません。.env.localで設定してください。' },
      { status: 500 },
    )
  }
  const body = await req.json()
  try {
    const res = await fetch(`${SALESNOW_BASE}/companies/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
