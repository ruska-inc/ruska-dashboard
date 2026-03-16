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
