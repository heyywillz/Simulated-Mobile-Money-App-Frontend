import React from 'react'

const statusStyles = {
  completed: 'bg-neutral-100 text-neutral-700',
  approved: 'bg-neutral-100 text-neutral-700',
  pending: 'bg-neutral-50 text-neutral-500',
  flagged: 'bg-red-50 text-[#8A0F13]',
  under_review: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
  open: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
  blocked: 'bg-[#8A0F13] text-white',
  escalated: 'bg-neutral-900 text-white',
}

const statusLabels = {
  completed: 'Completed',
  approved: 'Approved',
  pending: 'Pending',
  flagged: 'Flagged',
  under_review: 'Under review',
  open: 'Open',
  blocked: 'Blocked',
  escalated: 'Escalated',
}

export function StatusBadge({ status, size = 'sm' }) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap
        ${sizeClasses} ${statusStyles[status] ?? 'bg-neutral-100 text-neutral-600'}`}
    >
      {status === 'flagged' || status === 'under_review' || status === 'open' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse-soft" />
      ) : null}
      {statusLabels[status] ?? status}
    </span>
  )
}

const riskStyles = {
  low: 'bg-neutral-100 text-neutral-600',
  medium: 'bg-neutral-200 text-neutral-800',
  high: 'bg-[#F2D5D6] text-[#8A0F13]',
  critical: 'bg-[#8A0F13] text-white',
}

export function RiskBadge({ level }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5
        ${riskStyles[level]}`}
    >
      {level === 'critical' && (
        <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse-soft" />
      )}
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  )
}

export function DetectionBadge({ type }) {
  const isAtod = type === 'atod'

  return (
    <span
      className={`inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5
        ${isAtod ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'}`}
    >
      {isAtod ? 'Account takeover' : 'Transaction anomaly'}
    </span>
  )
}
