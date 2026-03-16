import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/moneyforward'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') ?? 1)
    const transactions = await getTransactions(page)
    return NextResponse.json({ transactions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
