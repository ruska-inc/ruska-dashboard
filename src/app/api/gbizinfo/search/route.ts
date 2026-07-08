import { NextRequest, NextResponse } from 'next/server'

const GBIZINFO_BASE = 'https://info.gbiz.go.jp/hojin/v1'

export async function GET(req: NextRequest) {
  const token = process.env.GBIZINFO_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'GBIZINFO_API_TOKENが設定されていません。gBizINFOのマイページでトークン取得後、.env.localまたはVercel環境変数で設定してください。' },
      { status: 500 },
    )
  }
  const url = new URL(req.url)
  const params = new URLSearchParams()
  const name = url.searchParams.get('name')
  const page = url.searchParams.get('page') ?? '1'
  const limit = url.searchParams.get('limit') ?? '20'
  const corporateType = url.searchParams.get('corporate_type')

  if (!name) {
    return NextResponse.json({ error: 'name パラメータは必須です' }, { status: 400 })
  }
  params.set('name', name)
  params.set('page', page)
  params.set('limit', limit)
  if (corporateType) params.set('corporate_type', corporateType)

  try {
    const res = await fetch(`${GBIZINFO_BASE}/hojin?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-hojinInfo-api-token': token,
        'Accept': 'application/json',
      },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
