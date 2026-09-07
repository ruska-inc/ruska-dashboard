// =============================================
// マネーフォワード クラウド請求書 API v3 の型
// OpenAPI 3.6.0 (https://invoice.moneyforward.com/docs/api/v3/) より
// =============================================

// 入金ステータス
export type MfPaymentStatus = '未設定' | '未入金' | '入金済み' | '未払い' | '振込済み'

// 受注ステータス
export type MfOrderStatus = 'failure' | 'default' | 'not_received' | 'received'

export interface MfPagination {
  total_count: number
  total_pages: number
  per_page: number
  current_page: number
}

// 請求書
export interface MfBilling {
  id: string
  pdf_url: string
  partner_id: string
  partner_name: string
  office_name: string
  title: string
  memo?: string
  note?: string
  billing_date: string   // "YYYY-MM-DD" もしくは "YYYY/MM/DD"
  due_date: string
  sales_date?: string
  billing_number?: string
  document_name?: string
  payment_status?: MfPaymentStatus
  tag_names?: string[]
  excise_price: string    // 消費税額（文字列で返る）
  subtotal_price: string  // 税抜小計
  total_price: string     // 税込合計
  is_locked?: boolean
  created_at: string
  updated_at?: string
}

// 見積書
export interface MfQuote {
  id: string
  pdf_url: string
  partner_id: string
  partner_name: string
  office_name: string
  title: string
  memo?: string
  note?: string
  quote_date: string
  quote_number?: string
  expired_date?: string
  document_name?: string
  order_status?: MfOrderStatus
  tag_names?: string[]
  excise_price: string
  subtotal_price: string
  total_price: string
  is_locked?: boolean
  created_at: string
  updated_at?: string
}

export interface MfListResponse<T> {
  data: T[]
  pagination: MfPagination
}

// 期間絞込の対象日付項目
export type MfBillingRangeKey = 'billing_date' | 'due_date' | 'sales_date' | 'created_at' | 'updated_at'
export type MfQuoteRangeKey = 'quote_date' | 'expired_date' | 'created_at' | 'updated_at'
