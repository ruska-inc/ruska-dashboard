// =============================================
// マネーフォワードの見積書／請求書 → ダッシュボードの Project へのマッピング
//
// ・見積書 = 見込み（見積もり中 / 確度）
// ・請求書 = 売上（請求済み → 入金済みなら着金済み）
// ・同一取引先 × 同一件名 の見積書と請求書は「1案件」にまとめる
//   （MFのAPIには見積→請求の参照フィールドが無いため、取引先＋件名で突合する）
// =============================================

import type { Project, ProjectStatus, ProjectProbability, PeriodSetting } from '@/lib/types'
import type { MfBilling, MfQuote } from './types'

// ---------------------------------------------
// 値の正規化
// ---------------------------------------------

/** "2023/08/24" も "2023-08-24" も "2023-08-24" に揃える */
export function normalizeDate(input: string | undefined | null): string | null {
  if (!input) return null
  const m = input.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

/** "2023-08-24" → "2023-08"（期の判定など、内部比較用のISO形式） */
export function toYearMonth(input: string | undefined | null): string | null {
  const d = normalizeDate(input)
  return d ? d.slice(0, 7) : null
}

/**
 * "2023-08-24" → "2023年8月"
 *
 * invoice_month / payment_month はダッシュボード全体で「YYYY年M月」形式（ゼロ埋めなし）
 * を使っている。MonthPicker の出力・月次集計のキー・並び替え（monthSortValue）が
 * すべてこの形式を前提にしているため、取り込み時もこれに合わせる。
 */
export function toJpMonth(input: string | undefined | null): string | null {
  const d = normalizeDate(input)
  if (!d) return null
  const [y, m] = d.split('-')
  return `${y}年${Number(m)}月`
}

/** MFは金額を文字列で返す（"1,100" や "1100.0" のことがある） */
export function parseYen(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0
  if (typeof input === 'number') return Math.round(input)
  const cleaned = input.replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** 突合用に件名を正規化（全角半角・空白・大文字小文字の揺れを吸収） */
export function normalizeTitle(title: string | undefined | null): string {
  return (title ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 取引先＋件名の突合キー */
export function matchKeyOf(partnerName: string | undefined | null, title: string | undefined | null): string {
  return `${normalizeTitle(partnerName)}|${normalizeTitle(title)}`
}

// ---------------------------------------------
// 期の判定
// ---------------------------------------------

/**
 * "YYYY-MM" がどの期に属するかを判定する。
 * end_year_month が未設定の期は「次の期の開始月の前月まで」とみなす。
 */
export function resolvePeriod(yearMonth: string | null, periods: PeriodSetting[]): string {
  const fallback = periods[0]?.name ?? '第1期'
  if (!yearMonth) return fallback

  const dated = periods
    .filter(p => p.start_year_month)
    .sort((a, b) => (a.start_year_month ?? '').localeCompare(b.start_year_month ?? ''))
  if (dated.length === 0) return fallback

  // 最初の期より前なら最初の期に寄せる
  if (yearMonth < dated[0].start_year_month!) return dated[0].name

  for (let i = 0; i < dated.length; i++) {
    const start = dated[i].start_year_month!
    const explicitEnd = dated[i].end_year_month
    const nextStart = dated[i + 1]?.start_year_month ?? null
    const end = explicitEnd ?? (nextStart ? prevYearMonth(nextStart) : null)
    if (yearMonth >= start && (end === null || yearMonth <= end)) return dated[i].name
  }
  // どの期にも収まらない（最後の期の終了月より後）場合は最新の期
  return dated[dated.length - 1].name
}

function prevYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------
// ステータス／確度の判定
// ---------------------------------------------

/** 請求書の入金ステータス → 案件ステータス */
export function statusFromBilling(billing: MfBilling): ProjectStatus {
  const paid = billing.payment_status === '入金済み' || billing.payment_status === '振込済み'
  return paid ? '着金済み' : '請求済み'
}

/** 見積書の受注ステータス → 案件ステータス */
export function statusFromQuote(quote: MfQuote): ProjectStatus {
  switch (quote.order_status) {
    case 'failure': return '失注'
    case 'received': return '進行中'
    default: return '見積もり中'
  }
}

/**
 * 見積書の受注ステータス → 確度
 *
 * 見積書は請求書が発行されるまで「見込み」として扱うため、受注済みでも確度は
 * 「確度（高）」までに留める。ダッシュボードの売上は確度「確定」で集計しており、
 * ここで確定にすると、あとから発行される請求書と二重計上になる。
 * 確度が「確定」になるのは請求書が存在する場合のみ。
 */
export function probabilityFromQuote(quote: MfQuote): ProjectProbability {
  switch (quote.order_status) {
    case 'failure': return '失注'
    case 'received': return '確度（高）'
    default: return '確度（中）'
  }
}

// ---------------------------------------------
// 差分計算
// ---------------------------------------------

/** MF由来で上書きする対象フィールド（notes / name / payment_month は手入力を尊重して上書きしない） */
export const SYNCED_FIELDS = [
  'client_name',
  'status',
  'probability',
  'amount',
  'tax_amount',
  'period',
  'invoice_month',
  'estimate_url',
  'invoice_url',
] as const

export type SyncedField = (typeof SYNCED_FIELDS)[number]

export const FIELD_LABELS: Record<string, string> = {
  name: '案件名',
  client_name: '顧客名',
  status: 'ステータス',
  probability: '確度',
  amount: '金額（税抜）',
  tax_amount: '消費税',
  period: '期',
  invoice_month: '請求月',
  estimate_url: '見積書',
  invoice_url: '請求書',
}

export interface FieldChange {
  field: string
  label: string
  before: string | number | null
  after: string | number | null
}

export type SyncAction = 'create' | 'update' | 'unchanged'
export type MatchedBy = 'mf_billing_id' | 'mf_quote_id' | 'title' | null

export interface SyncRow {
  /** 選択・適用時の一意キー */
  key: string
  action: SyncAction
  /** 突合方法（既存案件にどう紐付いたか） */
  matchedBy: MatchedBy
  targetProjectId: string | null
  targetProjectName: string | null
  /** 元になったMFの帳票 */
  quoteId: string | null
  quoteNumber: string | null
  billingId: string | null
  billingNumber: string | null
  /** 表示用 */
  name: string
  client_name: string
  status: ProjectStatus
  amount: number
  tax_amount: number
  period: string
  invoice_month: string | null
  /** 適用する値 */
  values: Partial<Project> & { mf_quote_id: string | null; mf_billing_id: string | null }
  changes: FieldChange[]
}

/** MF側の帳票をまとめた1案件分 */
interface DocumentGroup {
  key: string
  quote: MfQuote | null
  billing: MfBilling | null
}

/** 見積書・請求書を「取引先＋件名」で1案件にまとめる */
function groupDocuments(quotes: MfQuote[], billings: MfBilling[]): DocumentGroup[] {
  const groups = new Map<string, DocumentGroup>()

  for (const q of quotes) {
    const key = matchKeyOf(q.partner_name, q.title)
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { key, quote: q, billing: null })
    } else if (!existing.quote) {
      existing.quote = q
    } else {
      // 同一取引先・同一件名の見積書が複数ある場合は別案件として扱う
      groups.set(`${key}#q:${q.id}`, { key: `${key}#q:${q.id}`, quote: q, billing: null })
    }
  }

  // 請求日の古い順に処理し、最初の1件だけ見積書と同じ案件にまとめる
  const sortedBillings = [...billings].sort((a, b) =>
    (normalizeDate(a.billing_date) ?? '').localeCompare(normalizeDate(b.billing_date) ?? ''),
  )
  for (const b of sortedBillings) {
    const key = matchKeyOf(b.partner_name, b.title)
    const existing = groups.get(key)
    if (existing && !existing.billing) {
      existing.billing = b
    } else if (!existing) {
      groups.set(key, { key, quote: null, billing: b })
    } else {
      // 分割請求など、同一件名で2件目以降の請求書は別案件として扱う
      groups.set(`${key}#b:${b.id}`, { key: `${key}#b:${b.id}`, quote: null, billing: b })
    }
  }

  return [...groups.values()]
}

/**
 * MFから取得した帳票と既存プロジェクトを突合して、取り込みプランを組み立てる。
 * 副作用はなく、プレビューにも適用にも同じ結果を使う。
 */
export function buildSyncPlan(
  quotes: MfQuote[],
  billings: MfBilling[],
  projects: Project[],
  periods: PeriodSetting[],
): SyncRow[] {
  const byBillingId = new Map<string, Project>()
  const byQuoteId = new Map<string, Project>()
  const byTitle = new Map<string, Project>()

  for (const p of projects) {
    if (p.mf_billing_id) byBillingId.set(p.mf_billing_id, p)
    if (p.mf_quote_id) byQuoteId.set(p.mf_quote_id, p)
    const key = matchKeyOf(p.client_name, p.name)
    // 同名が複数ある場合は最初の1件のみを候補にする
    if (!byTitle.has(key)) byTitle.set(key, p)
  }

  const claimed = new Set<string>()
  const rows: SyncRow[] = []

  for (const group of groupDocuments(quotes, billings)) {
    const { quote, billing } = group

    // --- 既存プロジェクトの特定 ---
    let target: Project | null = null
    let matchedBy: MatchedBy = null
    if (billing && byBillingId.has(billing.id)) {
      target = byBillingId.get(billing.id)!
      matchedBy = 'mf_billing_id'
    } else if (quote && byQuoteId.has(quote.id)) {
      target = byQuoteId.get(quote.id)!
      matchedBy = 'mf_quote_id'
    } else {
      // MF側のIDが未設定の既存案件（Excel取込や手入力）にも、取引先＋件名が一致すれば紐付ける
      const titleKey = matchKeyOf(
        billing?.partner_name ?? quote?.partner_name,
        billing?.title ?? quote?.title,
      )
      const candidate = byTitle.get(titleKey)
      // 別の請求書に既に紐付いている案件は奪わない（紐付けが入れ替わって重複が生まれるため）
      const alreadyLinkedToOtherBilling =
        !!candidate?.mf_billing_id && candidate.mf_billing_id !== billing?.id
      if (candidate && !claimed.has(candidate.id) && !alreadyLinkedToOtherBilling) {
        target = candidate
        matchedBy = 'title'
      }
    }

    // 見積書から辿り着いた案件が、既に別の請求書に紐付いている場合は取り込み先にしない。
    // （同じ見積書に対して請求書が複数発行されたケース。既存案件の金額を新しい請求書で
    //   上書きしてしまうため、この請求書は別案件として起票する）
    if (target && billing && target.mf_billing_id && target.mf_billing_id !== billing.id) {
      target = null
      matchedBy = null
    }
    if (target) claimed.add(target.id)

    // --- 値の組み立て（請求書があれば請求書を優先） ---
    const source = billing ?? quote!
    const baseDate = billing ? billing.billing_date : quote!.quote_date
    const period = resolvePeriod(toYearMonth(baseDate), periods)
    const amount = parseYen(source.subtotal_price)
    const tax_amount = parseYen(source.excise_price)
    const status: ProjectStatus = billing ? statusFromBilling(billing) : statusFromQuote(quote!)
    const probability: ProjectProbability = billing ? '確定' : probabilityFromQuote(quote!)
    const name = (source.title || source.document_name || '（件名なし）').trim()

    const values: SyncRow['values'] = {
      client_name: source.partner_name,
      status,
      probability,
      amount,
      tax_amount,
      period,
      invoice_month: billing ? toJpMonth(billing.billing_date) : null,
      estimate_url: quote?.pdf_url ?? null,
      invoice_url: billing?.pdf_url ?? null,
      mf_quote_id: quote?.id ?? null,
      mf_billing_id: billing?.id ?? null,
    }
    // メモは新規作成時のみMFから引き継ぐ（更新時は手入力のメモを残す）
    if (!target) {
      values.notes = buildNotes(quote, billing)
      // 見積書が既に別の案件に紐付いている場合、同じIDを2案件に持たせられない
      // （DB側のunique制約に引っかかる）ため、新規側は見積書との紐付けを持たせない
      if (quote && byQuoteId.has(quote.id)) {
        values.mf_quote_id = null
        values.estimate_url = null
      }
    }

    // --- 差分の算出 ---
    const changes: FieldChange[] = []
    if (target) {
      for (const field of SYNCED_FIELDS) {
        const after = values[field] ?? null
        const before = (target[field] ?? null) as string | number | null
        // 見積書だけの再同期で、既に入っている請求書情報を消さない
        if ((field === 'invoice_month' || field === 'invoice_url') && after === null && before !== null) continue
        if (field === 'estimate_url' && after === null && before !== null) continue
        if (before !== after) {
          changes.push({ field, label: FIELD_LABELS[field] ?? field, before, after })
        }
      }
      if (!target.mf_quote_id && values.mf_quote_id) {
        changes.push({ field: 'mf_quote_id', label: 'MF見積書ID', before: null, after: values.mf_quote_id })
      }
      if (!target.mf_billing_id && values.mf_billing_id) {
        changes.push({ field: 'mf_billing_id', label: 'MF請求書ID', before: null, after: values.mf_billing_id })
      }
    }

    const action: SyncAction = !target ? 'create' : changes.length > 0 ? 'update' : 'unchanged'

    rows.push({
      key: billing ? `billing:${billing.id}` : `quote:${quote!.id}`,
      action,
      matchedBy,
      targetProjectId: target?.id ?? null,
      targetProjectName: target?.name ?? null,
      quoteId: quote?.id ?? null,
      quoteNumber: quote?.quote_number ?? null,
      billingId: billing?.id ?? null,
      billingNumber: billing?.billing_number ?? null,
      name: target?.name ?? name,
      client_name: values.client_name as string,
      status,
      amount,
      tax_amount,
      period,
      invoice_month: values.invoice_month ?? null,
      values,
      changes,
    })
  }

  // 新規 → 更新 → 変更なし の順、同じ区分内では請求月／案件名順
  const order: Record<SyncAction, number> = { create: 0, update: 1, unchanged: 2 }
  return rows.sort((a, b) =>
    order[a.action] - order[b.action] ||
    (b.invoice_month ?? '').localeCompare(a.invoice_month ?? '') ||
    a.name.localeCompare(b.name, 'ja'),
  )
}

/** 新規作成時のメモ（MFのメモ・備考を引き継ぐ） */
export function buildNotes(quote: MfQuote | null, billing: MfBilling | null): string | null {
  const parts = [billing?.memo, billing?.note, quote?.memo, quote?.note]
    .map(s => s?.trim())
    .filter((s): s is string => !!s)
  const unique = [...new Set(parts)]
  return unique.length > 0 ? unique.join('\n') : null
}
