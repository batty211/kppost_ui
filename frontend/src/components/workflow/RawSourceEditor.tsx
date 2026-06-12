import { FileText, Upload, Edit2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';

import { reorderBackendImages } from './helpers';
import { SortableImage } from './SortableImage';
import type { BatchDetails, ImageItem, WorkspaceNode } from '../../types/app';

interface RawSourceEditorProps {
  batchDetails: BatchDetails;
  content: string;
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
  saveStateLabel: string;
  saveStateTone: 'muted' | 'saving' | 'success' | 'error';
}

export function RawSourceEditor({
  batchDetails,
  content,
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
  saveStateLabel,
  saveStateTone,
}: RawSourceEditorProps) {
  const [orderedImages, setOrderedImages] = useState<ImageItem[]>(batchDetails.images);
  const batchPath = (batchDetails as BatchDetails & { path?: string }).path ?? batchDetails.name;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setOrderedImages(batchDetails.images);
  }, [batchDetails.images]);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedImages.findIndex((img) => img.name === active.id);
    const newIndex = orderedImages.findIndex((img) => img.name === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousImages = orderedImages;
    const newImages = arrayMove(orderedImages, oldIndex, newIndex);
    setOrderedImages(newImages);

    // Use the workspace-relative path, not just the folder name, so backend reorders the right folder.
    const success = await reorderBackendImages(batchPath, newImages.map((image) => image.name));
    if (!success) {
      setOrderedImages(previousImages);
      return;
    }

    if (fetchBatchDetails) {
      await fetchBatchDetails(batchPath);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-6 pb-6 border-b border-gray-800">
        <div>
          <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Folder Name</div>
          {isEditingName ? (
            <input
              type="text"
              value={editableName}
              onChange={(e) => setEditableName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              className="bg-gray-900 border border-blue-600 rounded px-2 py-0.5 text-xl font-bold focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
              <h2 className="text-xl font-bold">{batchDetails.name}</h2>
              <Edit2 size={14} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300">
              <FileText size={16} /> Post Content
            </h3>
            <div
              className={[
                'text-[10px]',
                saveStateTone === 'error'
                  ? 'text-red-400'
                  : saveStateTone === 'success'
                    ? 'text-emerald-400'
                    : saveStateTone === 'saving'
                      ? 'text-blue-400'
                      : 'text-gray-500',
              ].join(' ')}
            >
              {saveStateLabel}
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-[500px] bg-gray-900 border border-gray-800 rounded-xl p-6 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none font-sans leading-relaxed text-gray-200 shadow-inner"
            placeholder="Enter your post content here..."
          />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300">
              <Upload size={16} /> Images ({orderedImages.length})
            </h3>
            <label className="text-[10px] text-blue-500 hover:text-blue-400 font-bold cursor-pointer uppercase tracking-wider">
              Upload
              <input type="file" multiple className="hidden" onChange={handleUploadImages} />
            </label>
          </div>
          <div className="pr-2 custom-scrollbar max-h-[420px] overflow-y-auto">
            {orderedImages.length === 0 ? (
              <div className="border-2 border-dashed border-gray-800 rounded-xl p-8 text-center text-gray-600">
                <Upload size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">No images found</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={orderedImages.map((img) => img.name)} strategy={rectSortingStrategy}>
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                    {orderedImages.map((img) => (
                      <SortableImage
                        key={img.name}
                        img={img}
                        onDelete={handleDeleteImage}
                        onPreview={setPreviewImage}
                        variant="tight"
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <p className="mt-3 text-[11px] text-gray-500">
              ลำดับรูปสำคัญ: รูปแรกจะถูกใช้เป็น feature image ตาม workflow ของ CLI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
