import { Loader2 } from 'lucide-react';

interface WorkflowButtonProps {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
}

export function WorkflowButton({
  label,
  onClick,
  isLoading = false,
  variant = 'secondary',
}: WorkflowButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700';

  return (
    <button
      disabled={isLoading}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}
    >
      {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
      {label}
    </button>
  );
}
