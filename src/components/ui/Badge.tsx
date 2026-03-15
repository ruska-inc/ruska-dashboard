import { cn } from '@/lib/utils'
import { ProjectStatus, ProjectProbability, PaymentStatus } from '@/lib/types'

const statusColors: Record<ProjectStatus, string> = {
  '見積もり中': 'bg-blue-50 text-blue-700 border-blue-200',
  '進行中': 'bg-green-50 text-green-700 border-green-200',
  '外注': 'bg-purple-50 text-purple-700 border-purple-200',
  '請求済み': 'bg-orange-50 text-orange-700 border-orange-200',
  '着金済み': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '立て替え': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  '完了済': 'bg-gray-50 text-gray-600 border-gray-200',
  '失注': 'bg-red-50 text-red-700 border-red-200',
}

const probabilityColors: Record<ProjectProbability, string> = {
  '確度（低）': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  '確度（中）': 'bg-orange-50 text-orange-700 border-orange-200',
  '確度（高）': 'bg-blue-50 text-blue-700 border-blue-200',
  '確定': 'bg-green-50 text-green-700 border-green-200',
  '保留・トラブル有り': 'bg-red-50 text-red-700 border-red-200',
  '失注': 'bg-gray-50 text-gray-500 border-gray-200',
}

const paymentStatusColors: Record<PaymentStatus, string> = {
  '支払済': 'bg-green-50 text-green-700 border-green-200',
  '未対応': 'bg-red-50 text-red-700 border-red-200',
  '確認中': 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

interface StatusBadgeProps {
  status: ProjectStatus
  className?: string
}

interface ProbabilityBadgeProps {
  probability: ProjectProbability
  className?: string
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        statusColors[status],
        className
      )}
    >
      {status}
    </span>
  )
}

export function ProbabilityBadge({ probability, className }: ProbabilityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        probabilityColors[probability],
        className
      )}
    >
      {probability}
    </span>
  )
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        paymentStatusColors[status],
        className
      )}
    >
      {status}
    </span>
  )
}
