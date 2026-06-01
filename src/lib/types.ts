// ユーザーロール
export type UserRole = 'admin' | 'management' | 'accounting' | 'internal' | 'contractor'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

// 顧客マスタ
export interface Client {
  id: string
  name: string
  created_at: string
}

// プロジェクトステータス
export type ProjectStatus =
  | '見積もり中'
  | '進行中'
  | '外注'
  | '請求済み'
  | '着金済み'
  | '立て替え'
  | '完了済'
  | '失注'

// 確度
export type ProjectProbability =
  | '確度（低）'
  | '確度（中）'
  | '確度（高）'
  | '確定'
  | '保留・トラブル有り'
  | '失注'

// 期
export type Period = string

export interface PeriodSetting {
  id: string
  name: string
  sort_order: number
  start_year_month: string | null  // "YYYY-MM"形式、期の開始年月
  end_year_month: string | null    // "YYYY-MM"形式、期の終了年月(未設定は次期開始月の前月まで)
  created_at: string
}

// プロジェクト
export interface Project {
  id: string
  name: string
  client_name: string
  status: ProjectStatus
  probability: ProjectProbability
  amount: number
  tax_amount: number
  period: Period
  invoice_month: string | null
  payment_month: string | null
  notes: string | null
  estimate_url: string | null
  invoice_url: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

// 入金記録
export interface PaymentRecord {
  id: string
  project_id: string | null
  project_name: string
  client_name: string
  payment_date: string
  amount: number
  payment_month: string
  period: Period
  created_at: string
}

// 業務委託先
export type InvoiceStatus = '登録済み' | '免税事業者' | '申請中' | '未定'

export interface Contractor {
  id: string
  skills: string[]
  company_name: string
  contact_name: string
  invoice_status: InvoiceStatus
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

// 銀行口座
export interface BankAccount {
  id: string
  name: string
  sort_order: number
  created_at: string
}

// 入出金明細
export type TransactionSource = 'manual' | 'csv_sbi' | 'csv_smbc' | 'csv_generic' | 'sheet_import'

export interface BankTransaction {
  id: string
  account_id: string
  account?: BankAccount
  transaction_date: string
  expense: number
  income: number
  description: string | null
  source: TransactionSource
  created_at: string
}

// 月次予測(月別の予想収入・予想費用 — 口座横断のグローバル予測)
export interface MonthlyForecast {
  id: string
  year_month: string  // "YYYY-MM"
  expected_income: number
  expected_expense: number
  created_at: string
  updated_at: string
}

// 営業リスト(SalesNow API連携)
export type LeadStatus = '未アプローチ' | 'アプローチ中' | '商談中' | '提案中' | '受注' | '失注' | '保留'
export type LeadPriority = '高' | '中' | '低'

export interface SalesLead {
  id: string
  corporate_number: string | null
  company_name: string
  url: string | null
  address: string | null
  phone: string | null
  industry: string | null
  representative: string | null
  employees: number | null
  capital: number | null
  revenue: number | null
  established_year: number | null
  salesnow_score: number | null
  status: LeadStatus
  priority: LeadPriority
  assigned_to: string | null
  notes: string | null
  next_action_date: string | null
  created_at: string
  updated_at: string
}

// SalesNow API レスポンスの企業情報(検索結果)
export interface SalesNowCompany {
  corporateNumber?: string
  companyName: string
  companyUrl?: string | null
  address?: string | null
  phoneNumber?: string | null
  industryLarge?: string | null
  industryMedium?: string | null
  industrySmall?: string | null
  representativeName?: string | null
  employeeCount?: number | null
  capital?: number | null
  revenue?: number | null
  establishedYearMonth?: string | null
  salesnowScore?: number | null
  [key: string]: unknown  // SalesNow APIは多くのフィールドを返す
}

// 業務委託案件
export type PaymentStatus = '支払済' | '未対応' | '確認中'

export interface ContractorAssignment {
  id: string
  contractor_id: string
  contractor?: Contractor
  project_name: string
  amount_excl_tax: number
  amount_incl_tax: number
  invoice_month: string | null
  payment_month: string | null
  payment_status: PaymentStatus
  period: Period
  notes: string | null
  created_at: string
}
