import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatMonth(date: string | Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(date))
}

// "2025年5月" → "2025-05" (input[type=month]用)
export function toMonthInputValue(jp: string | null | undefined): string {
  if (!jp) return ''
  const m = jp.match(/(\d+)年(\d+)月/)
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}`
}

// "2025-05" → "2025年5月"
export function fromMonthInputValue(iso: string): string {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  if (!y || !m) return ''
  return `${y}年${parseInt(m, 10)}月`
}
