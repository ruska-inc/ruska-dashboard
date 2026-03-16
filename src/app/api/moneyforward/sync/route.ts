import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/moneyforward'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // 既存の入金記録を取得
    const { data: existing } = await supabase
      .from('payment_records')
      .select('payment_date, amount, mf_transaction_id')

    const existingKeys = new Set(
      (existing ?? []).map(r => `${r.payment_date}_${r.amount}`)
    )
    const existingMfIds = new Set(
      (existing ?? []).filter(r => r.mf_transaction_id).map(r => r.mf_transaction_id)
    )

    // MoneyForwardから入金トランザクションを取得（最大3ページ）
    const allTx = (await Promise.all([1, 2, 3].map(p => getTransactions(p)))).flat()
    const incomeTx = allTx.filter(tx => tx.is_income && !tx.is_transfer)

    const toInsert = incomeTx.filter(tx => {
      if (existingMfIds.has(tx.id)) return false
      const dateStr = tx.date.slice(0, 10)
      const key = `${dateStr}_${tx.amount}`
      return !existingKeys.has(key)
    })

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, message: '新しい入金データはありません' })
    }

    const records = toInsert.map(tx => ({
      project_id: null,
      project_name: tx.content || '（MoneyForward同期）',
      client_name: tx.service_name,
      payment_date: tx.date.slice(0, 10),
      amount: tx.amount,
      payment_month: formatPaymentMonth(tx.date),
      period: '',
      mf_transaction_id: tx.id,
    }))

    const { error } = await supabase.from('payment_records').insert(records)
    if (error) throw new Error(error.message)

    return NextResponse.json({ inserted: records.length, records })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function formatPaymentMonth(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}
