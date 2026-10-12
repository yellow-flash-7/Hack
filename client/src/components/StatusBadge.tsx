import React from 'react';
import { ClaimStatus } from '../types';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, AlertCircle, Clock } from 'lucide-react';

interface Props {
  status: ClaimStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md', showIcon = true }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  switch (status) {
    case 'SUPPORTED':
      return (
        <span className={`inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          {showIcon && <CheckCircle2 className={iconSizes} />}
          Supported
        </span>
      );
    case 'CONTRADICTED':
      return (
        <span className={`inline-flex items-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses}`}>
          {showIcon && <XCircle className={iconSizes} />}
          Contradicted
        </span>
      );
    case 'PARTIALLY_SUPPORTED':
      return (
        <span className={`inline-flex items-center rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 ${sizeClasses}`}>
          {showIcon && <AlertCircle className={iconSizes} />}
          Partially Supported
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span className={`inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses}`}>
          {showIcon && <AlertTriangle className={iconSizes} />}
          Needs Review
        </span>
      );
    case 'INSUFFICIENT_EVIDENCE':
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 ${sizeClasses}`}>
          {showIcon && <HelpCircle className={iconSizes} />}
          Insufficient Evidence
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 ${sizeClasses}`}>
          {showIcon && <Clock className={iconSizes} />}
          Pending
        </span>
      );
  }
};
