import { NextResponse } from 'next/server'
import { getAccounts } from '@/lib/moneyforward'

export async function GET() {
  try {
    const accounts = await getAccounts()
    return NextResponse.json({ accounts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
