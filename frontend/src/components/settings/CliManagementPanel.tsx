import type { AppConfig, CliStatus } from '../../types/app';

interface CliManagementPanelProps {
  cliStatus: CliStatus;
  config: AppConfig;
  onCheckUpdates: (forceRemote?: boolean) => void;
  onInstall: () => void;
  onUpdate: () => void;
}

export function CliManagementPanel({
  cliStatus,
  config,
  onCheckUpdates,
  onInstall,
  onUpdate,
}: CliManagementPanelProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-800">
      <label className="text-sm font-semibold text-gray-300">CLI Management</label>

      <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                cliStatus.status === 'ready'
                  ? 'bg-green-500'
                  : cliStatus.status === 'update_available'
                    ? 'bg-amber-400'
                    : cliStatus.status === 'installing' || cliStatus.status === 'updating'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-600'
              }`}
            />
            <div>
              <div className="text-sm font-bold capitalize">{cliStatus.status.replace(/_/g, ' ')}</div>
              <div className="text-xs text-gray-500">{cliStatus.message}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {(cliStatus.status === 'not_installed' || cliStatus.status === 'error') && (
              <button
                onClick={onInstall}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
              >
                {cliStatus.status === 'error' ? 'Reinstall CLI' : 'Install CLI'}
              </button>
            )}
            {cliStatus.update_available && (
              <button
                onClick={onUpdate}
                className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
              >
                Update CLI
              </button>
            )}
            <button
              onClick={() => onCheckUpdates(true)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              Check Update
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Repository</div>
            <div className="font-mono text-gray-300 break-all">
              {cliStatus.repo_url || 'https://github.com/batty211/kppwppost'}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Installed Version</div>
            <div className="font-mono text-gray-300">{cliStatus.installed_version || '-'}</div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Latest Version</div>
            <div className="font-mono text-gray-300">{cliStatus.latest_version || '-'}</div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">CLI Path</div>
            <div className="font-mono text-gray-300 break-all">{config.cli_path || '-'}</div>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 flex flex-wrap gap-4">
          <span>Last checked: {cliStatus.last_checked ? new Date(cliStatus.last_checked).toLocaleString() : '-'}</span>
          <span>App data: {config.app_data_dir || '-'}</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">CLI Executable Path</label>
        <input
          type="text"
          value={config.cli_path}
          readOnly
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-gray-400"
          placeholder="Auto-detected after setup"
        />
      </div>
    </div>
  );
}
