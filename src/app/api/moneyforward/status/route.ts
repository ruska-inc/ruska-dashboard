import { NextResponse } from 'next/server'
import { getAccounts } from '@/lib/moneyforward'

export async function GET() {
  try {
    const accounts = await getAccounts()
    return NextResponse.json({ connected: true, accountCount: accounts.length })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 200 })
  }
}
