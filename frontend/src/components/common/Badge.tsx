import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
  purple: 'bg-purple-500',
};

export default function Badge({ variant = 'neutral', children, dot, className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border', styles[variant], className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

// Status badge for transfer statuses
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  open_awaiting_donor: 'info', donor_review: 'warning', donor_approved: 'success', donor_rejected: 'danger', awaiting_mto_review: 'warning', mto_requested_documents: 'warning', mto_rejected: 'danger', final_approved: 'success', received_awaiting_verification: 'warning',
  recommended: 'info',
  pending_mto_review: 'warning',
  awaiting_donor_approval: 'warning',
  awaiting_receiver_approval: 'warning',
  approved: 'success',
  ready_for_dispatch: 'success',
  dispatched: 'purple',
  in_transit: 'info',
  delivered: 'info',
  receipt_verified: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  // batch statuses
  normal: 'success',
  approaching_expiry: 'warning',
  critical: 'danger',
  expired: 'danger',
  quarantined: 'neutral',
  recalled: 'danger',
  // priority
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
  // stockout risk
  low_risk: 'success',
  medium_risk: 'warning',
  high_risk: 'danger',
  critical_risk: 'danger',
  // hospital
  active: 'success',
  inactive: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] || 'neutral';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant} dot>{label}</Badge>;
}
