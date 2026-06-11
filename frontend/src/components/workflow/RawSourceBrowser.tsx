import { FolderOpen, ChevronRight } from 'lucide-react';

import type { WorkspaceNode } from '../../types/app';

interface RawSourceBrowserProps {
  node: WorkspaceNode | null;
  onSelectChild: (path: string) => void;
  selectedPath?: string | null;
  showHeader?: boolean;
}

export function RawSourceBrowser({
  node,
  onSelectChild,
  selectedPath,
  showHeader = true,
}: RawSourceBrowserProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-white/8 bg-black/10 p-8 text-gray-500">
        Select a raw source from Raws to inspect it.
      </div>
    );
  }

  const breadcrumb = node.path.split('/').filter(Boolean);

  return (
    <div className={showHeader ? 'space-y-6' : 'space-y-4'}>
      {showHeader && (
        <header className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4">
          <div>
            <div className="mb-1 text-[10px] uppercase font-semibold tracking-[0.3em] text-gray-500">Raw Source</div>
            <h2 className="text-2xl font-semibold text-blue-300">{node.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
              {breadcrumb.map((part, index) => (
                <span key={`${part}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight size={12} />}
                  <span>{part}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/8 bg-[#0b1327] px-3 py-1.5 text-xs text-gray-300">
            <FolderOpen size={14} />
            {node.openable ? 'Editor ready' : `${node.children.length} subfolder(s)`}
          </div>
        </header>
      )}

      {!node.openable ? (
        <div className={showHeader ? 'rounded-[24px] border border-white/8 bg-white/[0.03] p-4' : ''}>
          <div className="mb-4 text-sm font-semibold text-gray-300">Subfolders</div>
          {node.children.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 p-8 text-center text-sm text-gray-600">
              No readable source file yet. Create a raw source folder in Raws, or drop subfolders/files here first.
            </div>
          ) : (
            <div className="space-y-3">
              {node.children.map((child) => (
                <button
                  key={child.path}
                  onClick={() => onSelectChild(child.path)}
                  className={`flex items-center justify-between rounded-[20px] border px-4 py-4 text-left text-base transition-colors ${
                    selectedPath === child.path
                      ? 'border-blue-400/30 bg-blue-500/15 text-blue-200 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.08)]'
                      : 'border-white/8 bg-[#0b1327] text-gray-300 hover:border-blue-400/25 hover:bg-[#0f1731]'
                  }`}
                >
                  <span className="truncate">{child.name}</span>
                  <ChevronRight size={16} className="text-gray-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-sm text-gray-500">
          This raw source already has a readable source file. Use the editor view to review text and images.
        </div>
      )}
    </div>
  );
}
