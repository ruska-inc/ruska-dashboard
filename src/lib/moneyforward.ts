// MoneyForward ME API client (server-side only)
const MF_BASE = 'https://moneyforward.com/api/v1'

async function mfFetch(path: string) {
  const apiKey = process.env.MF_API_KEY
  if (!apiKey) throw new Error('MF_API_KEY が設定されていません')

  const res = await fetch(`${MF_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MoneyForward API エラー (${res.status}): ${text}`)
  }
  return res.json()
}

export interface MfAccount {
  id: string
  name: string
  balance: number
  asset: number
  last_succeeded_at: string | null
  error_msg: string | null
  service: { id: string; name: string }
}

export interface MfTransaction {
  id: string
  date: string
  content: string
  amount: number
  grand_total: number
  is_income: boolean
  is_transfer: boolean
  service_name: string
  account_id: string
  memo: string
}

export async function getAccounts(): Promise<MfAccount[]> {
  const data = await mfFetch('/accounts')
  return data.accounts ?? []
}

export async function getTransactions(page = 1): Promise<MfTransaction[]> {
  const data = await mfFetch(`/histories?page=${page}&limit=100`)
  return data.entries ?? []
}

export async function getUserAssetSummary() {
  const data = await mfFetch('/user_asset_summaries')
  return data
}
