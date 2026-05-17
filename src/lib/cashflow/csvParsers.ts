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
  // Excelの日付シリアル番号(40000以上を日付として扱う、概ね2009年以降)
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  const s = String(v).trim()
  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // YYYY年MM月DD日 (住信SBI などの典型)
  m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // YY/MM/DD (西暦下2桁)
  m = s.match(/^(\d{2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/)
  if (m) {
    const yy = parseInt(m[1], 10)
    const year = yy < 50 ? 2000 + yy : 1900 + yy
    return `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  // Excelシリアル番号(文字列)
  if (/^\d{4,6}$/.test(s)) {
    const n = parseInt(s, 10)
    if (n > 30000 && n < 80000) {
      const parsed = XLSX.SSF.parse_date_code(n)
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
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

/**
 * ファイルの内容を適切なエンコーディング(UTF-8 / Shift_JIS)で復号する。
 * 銀行のCSVは大抵 Shift_JIS。日本語が文字化けしないよう自動判定する。
 */
async function decodeFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const head = new Uint8Array(buffer.slice(0, 3))
  // UTF-8 BOM
  if (head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer)
  }
  // まず UTF-8 として strict 解釈を試みる
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    // UTF-8 として解釈できないバイトがあれば Shift_JIS と判定
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

export async function parseCsvFile(file: File, format: CsvFormat): Promise<ParsedTransaction[]> {
  const text = await decodeFile(file)
  // 復号済みテキストを XLSX に渡す。BOMや改行は xlsx が処理する。
  const wb = XLSX.read(text, { type: 'string' })
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
  let scannedRows = 0
  let dateFailedCount = 0
  let amountZeroCount = 0
  const dateFailedSamples: string[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue
    scannedRows++

    const date = parseDate(row[dateCol])
    if (!date) {
      dateFailedCount++
      if (dateFailedSamples.length < 3) {
        dateFailedSamples.push(String(row[dateCol] ?? ''))
      }
      continue
    }

    const expense = expenseCol >= 0 ? parseAmount(row[expenseCol]) : 0
    const income = incomeCol >= 0 ? parseAmount(row[incomeCol]) : 0
    if (expense === 0 && income === 0) {
      amountZeroCount++
      continue
    }

    const description = descCol >= 0
      ? String(row[descCol] ?? '').trim() || null
      : null

    transactions.push({ date, expense, income, description })
  }

  // 取り込めなかった場合は何が原因か診断情報を投げる
  if (transactions.length === 0 && scannedRows > 0) {
    const hints: string[] = []
    hints.push(`データ行 ${scannedRows} 行を確認しました`)
    if (dateFailedCount > 0) {
      hints.push(`日付パース失敗 ${dateFailedCount} 件 (サンプル: ${dateFailedSamples.map(s => `"${s}"`).join(', ')})`)
    }
    if (amountZeroCount > 0) {
      hints.push(`金額が0だった行 ${amountZeroCount} 件`)
    }
    hints.push(`検出列: 日付=${headers[dateCol] ?? '(?)'}, 出金=${expenseCol >= 0 ? headers[expenseCol] : '(なし)'}, 入金=${incomeCol >= 0 ? headers[incomeCol] : '(なし)'}`)
    throw new Error(hints.join(' / '))
  }

  return transactions
}

export function formatToSource(format: CsvFormat): TransactionSource {
  return format
}
