import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import type { CommandRunState } from '../../types/app';

interface WorkflowButtonProps {
  label: string;
  onClick: () => void;
  state?: CommandRunState;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  disabledReason?: string;
  successLabel?: string;
  runningLabel?: string;
}

export function WorkflowButton({
  label,
  onClick,
  state = 'idle',
  variant = 'secondary',
  disabled = false,
  disabledReason,
  successLabel,
  runningLabel,
}: WorkflowButtonProps) {
  const baseStyles =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700';
  const stateStyles =
    state === 'success'
      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
      : state === 'error'
        ? 'border border-rose-500/30 bg-rose-500/15 text-rose-100'
        : baseStyles;
  const buttonLabel =
    state === 'running'
      ? runningLabel ?? label
      : state === 'success'
        ? successLabel ?? label
        : label;

  return (
    <button
      disabled={disabled || state === 'running'}
      onClick={onClick}
      title={disabledReason}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${stateStyles}`}
    >
      {state === 'running' ? <Loader2 size={12} className="animate-spin" /> : null}
      {state === 'success' ? <CheckCircle2 size={12} /> : null}
      {state === 'error' ? <AlertCircle size={12} /> : null}
      {buttonLabel}
    </button>
  );
}
