import * as XLSX from 'xlsx'
import type { TransactionSource } from '@/lib/types'

export type ParsedTransaction = {
  date: string // ISO "YYYY-MM-DD"
  expense: number
  income: number
  description: string | null
}

export type CsvFormat = 'csv_sbi' | 'csv_smbc' | 'csv_generic'

export const FORMAT_LABELS: Record<CsvFormat, string> = {
  csv_sbi: '住信SBIネット銀行',
  csv_smbc: '三井住友銀行',
  csv_generic: '汎用(日付/出金/入金/摘要)',
}

const HEADER_ALIASES: Record<keyof Omit<ParsedTransaction, never>, string[]> = {
  date: ['日付', '取引日', '年月日', '日時'],
  expense: ['お引き出し金額', 'お引出し金額', 'お引出し', '出金金額', '出金金額(円)', '出金額', '出金'],
  income: ['お預け入れ金額', 'お預入れ金額', 'お預入れ', '入金金額', '入金金額(円)', '入金額', 'お預入れ金額(円)', '入金'],
  description: ['内容', '摘要', 'お取り扱い内容', 'メモ', '取引内容'],
}

function parseAmount(v: unknown): number {
  if (v == null || v === '') return 0
  const s = String(v).replace(/[¥,\s]/g, '').replace(/円/g, '')
  const n = parseInt(s, 10)
  return isNaN(n) ? 0 : Math.abs(n)
}

function parseDate(v: unknown): string {
  if (v == null || v === '') return ''
  // XLSXがDateを返した場合
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  // YYYY/MM/DD or YYYY-MM-DD or YYYY/M/D
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  return ''
}

function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h && h.trim().replace(/\s/g, '') === alias.replace(/\s/g, ''))
    if (idx >= 0) return idx
  }
  return -1
}

export async function parseCsvFile(file: File, format: CsvFormat): Promise<ParsedTransaction[]> {
  const buffer = await file.arrayBuffer()
  // SBIなどは Shift_JIS の場合があるが、xlsx が自動判定する
  const wb = XLSX.read(buffer, { type: 'array', codepage: 932 })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true })

  if (rows.length === 0) return []

  // ヘッダー行を探す(最初の数行に "日付" などが含まれる行)
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] as unknown[]
    if (row.some(c => HEADER_ALIASES.date.some(a => String(c ?? '').includes(a)))) {
      headerIdx = i
      break
    }
  }

  const headers = (rows[headerIdx] as unknown[]).map(c => String(c ?? '').trim())
  const dateCol = findColumn(headers, HEADER_ALIASES.date)
  const expenseCol = findColumn(headers, HEADER_ALIASES.expense)
  const incomeCol = findColumn(headers, HEADER_ALIASES.income)
  const descCol = findColumn(headers, HEADER_ALIASES.description)

  if (dateCol < 0 || (expenseCol < 0 && incomeCol < 0)) {
    throw new Error(`CSVヘッダーに必要な列(日付・出金/入金)が見つかりません。検出ヘッダー: ${headers.join(', ')}`)
  }

  const transactions: ParsedTransaction[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue

    const date = parseDate(row[dateCol])
    if (!date) continue

    const expense = expenseCol >= 0 ? parseAmount(row[expenseCol]) : 0
    const income = incomeCol >= 0 ? parseAmount(row[incomeCol]) : 0
    if (expense === 0 && income === 0) continue

    const description = descCol >= 0
      ? String(row[descCol] ?? '').trim() || null
      : null

    transactions.push({ date, expense, income, description })
  }

  // ソース指定を返す側で活用するためformatは引数のまま
  return transactions
}

export function formatToSource(format: CsvFormat): TransactionSource {
  return format
}
