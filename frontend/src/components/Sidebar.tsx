import { Settings as SettingsIcon, Upload } from 'lucide-react';
import { useState } from 'react';

import { SidebarBatchSection } from './sidebar/SidebarBatchSection';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { buildPrepareTargetSummary } from '../lib/prepareTarget';
import type { AppConfig, AppView, CliStatus, WorkspaceState } from '../types/app';

interface SidebarProps {
  workspace: WorkspaceState | null;
  selectedPath: string | null;
  selectedRawPath: string | null;
  onSelectRawPath: (path: string) => Promise<void>;
  onSelectBatchPath: (path: string) => void;
  onSelectCanvasPath: (path: string) => void;
  onCreateRawSource: (folderName: string) => Promise<void>;
  setView: (view: AppView) => void;
  config: AppConfig;
  cliStatus: CliStatus;
  handleBrowse: () => Promise<void>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export function Sidebar({
  workspace,
  selectedPath,
  selectedRawPath,
  onSelectRawPath,
  onSelectBatchPath,
  onSelectCanvasPath,
  onCreateRawSource,
  setView,
  config,
  cliStatus,
  handleBrowse,
  searchTerm,
  setSearchTerm,
}: SidebarProps) {
  const [newRawSourceName, setNewRawSourceName] = useState('');
  const prepareTarget = buildPrepareTargetSummary(selectedRawPath);
  const rawSources = workspace?.zones.raws.items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];
  const preparedBatches = workspace?.zones.batches.items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];
  const canvasItems = workspace?.zones.canvas.items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];
  const legacyItems = workspace?.legacy.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-white/5 bg-[#0a1020]/95 px-4 py-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between border-b border-white/10 px-1 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20">
            <Upload size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-gray-500">KPPPost</div>
            <div className="text-lg font-semibold text-gray-100">Workspace</div>
          </div>
        </div>
        <button
          onClick={() => setView('settings')}
          className="rounded-xl border border-white/10 p-2 text-gray-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
          aria-label="Open settings"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">Step 0 • Raws</div>
            <div className="mt-1 text-sm text-gray-400">Create source folders here</div>
          </div>
          <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">
            Ready
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRawSourceName}
            onChange={(e) => setNewRawSourceName(e.target.value)}
            placeholder="new-raw-folder"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1327] px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none transition-colors focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={async () => {
              if (!newRawSourceName.trim()) return;
              await onCreateRawSource(newRawSourceName.trim());
              setNewRawSourceName('');
            }}
            className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
          >
            Add
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/8 bg-[#0b1327] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
            Prepare target
          </div>
          {prepareTarget.name && prepareTarget.path ? (
            <div className="mt-1">
              <div className="truncate text-sm font-semibold text-emerald-200">{prepareTarget.name}</div>
              <div className="truncate text-xs text-gray-500">{prepareTarget.path}</div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-gray-500">{prepareTarget.emptyMessage}</div>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-white/8 bg-[#0b1327] p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
            Raw folders
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {rawSources.length > 0 ? rawSources.map((item) => (
              <button
                key={item.path}
                onClick={() => void onSelectRawPath(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selectedRawPath === item.path
                    ? 'border-blue-400/30 bg-blue-500/10 text-blue-300'
                    : 'border-transparent text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <Upload size={14} />
                <span className="truncate text-sm">{item.name}</span>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-gray-500">
                No raw folders yet
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="text"
          placeholder="Search folders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#0b1327] px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 outline-none transition-colors focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="custom-scrollbar mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <SidebarBatchSection
          items={preparedBatches}
          selectedPath={selectedPath}
          title="Batches"
          tone="prepared"
          onSelect={onSelectBatchPath}
        />
        <SidebarBatchSection
          items={canvasItems}
          selectedPath={selectedPath}
          title="Canvas"
          tone="canvas"
          onSelect={onSelectCanvasPath}
        />
        {legacyItems.length > 0 && (
          <SidebarBatchSection
            items={legacyItems}
            selectedPath={selectedPath}
            title="Legacy"
            tone="legacy"
            onSelect={onSelectRawPath}
          />
        )}
      </div>

      <SidebarFooter cliStatus={cliStatus} config={config} handleBrowse={handleBrowse} />
    </aside>
  );
}
