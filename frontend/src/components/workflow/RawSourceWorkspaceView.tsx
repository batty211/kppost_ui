import { ChevronRight, FolderOpen, Plus } from 'lucide-react';

import type { BatchDetails, WorkspaceNode } from '../../types/app';
import { RawSourceBrowser } from './RawSourceBrowser';
import { RawSourceEditor } from './RawSourceEditor';

interface RawSourceWorkspaceViewProps {
  sourceNode: WorkspaceNode | null;
  selectedPath: string | null;
  editorDetails: BatchDetails | null;
  onSelectChild: (path: string) => void;
  onNewPost: () => void;
  handleContentChange: (content: string) => void;
  handleUploadImages: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteImage: (imageName: string) => Promise<void>;
  fetchBatchDetails?: (name: string) => Promise<WorkspaceNode | null>;
  setPreviewImage?: (url: string | null) => void;
  isEditingName: boolean;
  setIsEditingName: (value: boolean) => void;
  editableName: string;
  setEditableName: (value: string) => void;
  handleRename: () => Promise<void>;
}

export function RawSourceWorkspaceView({
  sourceNode,
  selectedPath,
  editorDetails,
  onSelectChild,
  onNewPost,
  handleContentChange,
  handleUploadImages,
  handleDeleteImage,
  fetchBatchDetails,
  setPreviewImage,
  isEditingName,
  setIsEditingName,
  editableName,
  setEditableName,
  handleRename,
}: RawSourceWorkspaceViewProps) {
  const breadcrumb = sourceNode?.path.split('/').filter(Boolean) ?? [];

  if (!sourceNode) {
    return (
      <div className="flex h-full min-h-[680px] items-center justify-center rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-gray-500">
        Select a raw source from Raws to inspect it.
      </div>
    );
  }

  return (
    <div className="grid min-h-[720px] min-w-[1080px] grid-cols-[340px_minmax(0,1fr)] gap-5">
        <aside className="min-h-[720px] rounded-[28px] border border-white/8 bg-white/[0.03] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)]">
          <header className="mb-5 border-b border-white/8 px-1 pb-5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
              Raw Source
            </div>
            <h2 className="truncate text-2xl font-semibold text-blue-300">{sourceNode.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
              {breadcrumb.map((part, index) => (
                <span key={`${part}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight size={12} />}
                  <span>{part}</span>
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/8 bg-[#0b1327] px-3 py-1.5 text-xs text-gray-300">
                <FolderOpen size={14} />
                {sourceNode.children.length} subfolder(s)
              </div>
              <button
                onClick={onNewPost}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
              >
                <Plus size={16} />
                New Post
              </button>
            </div>
          </header>
          <RawSourceBrowser
            node={sourceNode}
            onSelectChild={onSelectChild}
            selectedPath={selectedPath}
            showHeader={false}
          />
        </aside>

        <section className="min-w-0 rounded-[28px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.16)]">
          {editorDetails ? (
            <RawSourceEditor
              batchDetails={editorDetails}
              handleContentChange={handleContentChange}
              handleUploadImages={handleUploadImages}
              handleDeleteImage={handleDeleteImage}
              fetchBatchDetails={fetchBatchDetails}
              setPreviewImage={setPreviewImage}
              isEditingName={isEditingName}
              setIsEditingName={setIsEditingName}
              editableName={editableName}
              setEditableName={setEditableName}
              handleRename={handleRename}
            />
          ) : (
            <div className="flex min-h-[720px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/10 p-8 text-center text-sm text-gray-500">
              Select a subfolder from the left sidebar to open the editor.
            </div>
          )}
        </section>
    </div>
  );
}
