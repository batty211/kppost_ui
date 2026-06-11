import type { AppConfig, CliStatus } from '../../types/app';

interface SidebarFooterProps {
  cliStatus: CliStatus;
  config: AppConfig;
  handleBrowse: () => Promise<void>;
}

export function SidebarFooter({ cliStatus, config, handleBrowse }: SidebarFooterProps) {
  return (
    <footer className="mt-4 rounded-[18px] border border-white/6 bg-white/[0.02] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">CLI Status</div>
      <div className="mb-4 text-sm text-gray-300">{cliStatus.message || 'CLI not installed.'}</div>

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">Root Directory</div>
      <div className="mb-3 truncate rounded-xl border border-white/8 bg-[#0b1327] px-3 py-2 font-mono text-xs text-gray-300">
        {config.root_path || 'Not set'}
      </div>
      <button
        onClick={() => void handleBrowse()}
        className="text-sm font-semibold text-blue-300 transition-colors hover:text-blue-200"
      >
        Browse
      </button>
    </footer>
  );
}
