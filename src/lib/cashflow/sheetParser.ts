import * as XLSX from 'xlsx'

export type SheetParsedTransaction = {
  accountName: string
  date: string
  expense: number
  income: number
  description: string | null
}

function parseAmount(v: unknown): number {
  if (v == null || v === '') return 0
  const s = String(v).replace(/[¥,\s円]/g, '')
  const n = parseInt(s, 10)
  return isNaN(n) ? 0 : Math.abs(n)
}

function parseDate(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // XLSX number-serial date
  if (typeof v === 'number') {
    const date = XLSX.SSF.parse_date_code(v)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return ''
}

/**
 * スプレッドシートを読み込み、「日付」列と「口座名/費用」「口座名/収入」のペア列を
 * 検出して取引データを生成する。
 */
async function readWorkbook(file: File) {
  // CSV/TSV はテキストとして文字コード自動判定して読み込む
  const isCsv = /\.(csv|tsv|txt)$/i.test(file.name)
  if (isCsv) {
    const buffer = await file.arrayBuffer()
    const head = new Uint8Array(buffer.slice(0, 3))
    let text: string
    if (head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF) {
      text = new TextDecoder('utf-8').decode(buffer)
    } else {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        text = new TextDecoder('shift_jis').decode(buffer)
      }
    }
    return XLSX.read(text, { type: 'string', cellDates: true })
  }
  // .xlsx などはバイナリのまま
  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array', cellDates: true })
}

export async function parseSpreadsheetTransactions(file: File): Promise<{
  transactions: SheetParsedTransaction[]
  detectedAccounts: string[]
  sheetsScanned: string[]
}> {
  const wb = await readWorkbook(file)

  const transactions: SheetParsedTransaction[] = []
  const detectedAccounts = new Set<string>()
  const sheetsScanned: string[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
    if (rows.length === 0) continue

    // ヘッダー行を探す(先頭8行以内)
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const row = rows[i] as unknown[]
      if (row.some(c => {
        const s = String(c ?? '').trim()
        return s === '日付' || s === '年月日'
      })) {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) continue

    const headers = (rows[headerIdx] as unknown[]).map(c => String(c ?? '').trim())
    const dateIdx = headers.findIndex(h => h === '日付' || h === '年月日')
    if (dateIdx < 0) continue

    // 「<口座名>/費用」「<口座名>/収入」のペア列を検出
    const accountColumns: Record<string, { expense: number; income: number }> = {}
    headers.forEach((h, i) => {
      const m = h.match(/^(.+?)\/(費用|収入|出金|入金)$/)
      if (m) {
        const acctName = m[1].trim()
        if (!accountColumns[acctName]) accountColumns[acctName] = { expense: -1, income: -1 }
        const type = (m[2] === '費用' || m[2] === '出金') ? 'expense' : 'income'
        accountColumns[acctName][type] = i
      }
    })

    if (Object.keys(accountColumns).length === 0) continue
    sheetsScanned.push(sheetName)
    Object.keys(accountColumns).forEach(n => detectedAccounts.add(n))

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] as unknown[]
      if (!row) continue
      const date = parseDate(row[dateIdx])
      if (!date) continue

      for (const [acctName, cols] of Object.entries(accountColumns)) {
        const expense = cols.expense >= 0 ? parseAmount(row[cols.expense]) : 0
        const income = cols.income >= 0 ? parseAmount(row[cols.income]) : 0
        if (expense === 0 && income === 0) continue
        transactions.push({ accountName: acctName, date, expense, income, description: null })
      }
    }
  }

  return {
    transactions,
    detectedAccounts: Array.from(detectedAccounts),
    sheetsScanned,
  }
}
