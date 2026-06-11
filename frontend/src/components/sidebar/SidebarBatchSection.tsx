import { CheckCircle2, Folder, FolderOpen } from 'lucide-react';

import type { WorkspaceItem } from '../../types/app';

interface SidebarBatchSectionProps {
  items: WorkspaceItem[];
  selectedPath: string | null;
  title: string;
  tone: 'raw' | 'prepared' | 'canvas' | 'legacy';
  onSelect: (itemPath: string) => void | Promise<void>;
}

export function SidebarBatchSection({
  items,
  selectedPath,
  title,
  tone,
  onSelect,
}: SidebarBatchSectionProps) {
  const iconMap = {
    raw: Folder,
    prepared: CheckCircle2,
    canvas: FolderOpen,
    legacy: Folder,
  } as const;
  const selectedClassMap = {
    raw: 'border-blue-400/30 bg-blue-500/10 text-blue-300 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.08)]',
    prepared: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]',
    canvas: 'border-amber-400/30 bg-amber-500/10 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]',
    legacy: 'border-white/10 bg-white/5 text-gray-200',
  } as const;
  const Icon = iconMap[tone];
  const selectedClassName = selectedClassMap[tone];

  return (
    <section className="rounded-[18px] border border-white/6 bg-white/[0.02] p-3">
      <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => void onSelect(item.path)}
            className={`flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors ${
              selectedPath === item.path ? selectedClassName : 'text-gray-400 hover:bg-gray-800/50'
            }`}
          >
            <Icon size={15} />
            <span className="truncate text-sm">{item.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
