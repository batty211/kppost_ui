import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { API_BASE } from '../../lib/api';
import type { ImageItem } from '../../types/app';

interface SortableImageProps {
  img: ImageItem;
  onDelete?: (name: string) => void;
  onPreview?: (url: string) => void;
  variant?: 'default' | 'compact' | 'tight';
}

export function SortableImage({
  img,
  onDelete,
  onPreview,
  variant = 'default',
}: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompact = variant === 'compact';
  const isTight = variant === 'tight';
  const containerClassName = isTight
    ? 'group relative w-full min-w-0 bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-lg overflow-hidden aspect-[4/3] shadow-sm'
    : isCompact
      ? 'group relative bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl overflow-hidden aspect-square shadow-sm'
    : 'group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col items-center justify-center aspect-square';
  const overlayClassName = isTight
    ? 'absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity'
    : isCompact
      ? 'absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity'
    : 'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2';
  const handleClassName = isTight
    ? 'absolute left-1.5 top-1.5 z-20 p-1.5 bg-black/70 backdrop-blur-sm rounded-md text-white cursor-grab active:cursor-grabbing shadow-sm'
    : isCompact
      ? 'absolute left-2 top-2 p-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-white cursor-grab active:cursor-grabbing shadow-sm'
    : 'p-1.5 bg-gray-800 rounded text-white cursor-grab active:cursor-grabbing';
  const deleteButtonClassName = isTight
    ? 'absolute right-1.5 top-1.5 p-1 bg-red-600/90 backdrop-blur-sm rounded-md text-white hover:bg-red-500 shadow-sm'
    : isCompact
      ? 'absolute right-2 top-2 p-1.5 bg-red-600/90 backdrop-blur-sm rounded-lg text-white hover:bg-red-500 shadow-sm'
    : 'p-1.5 bg-red-600 rounded text-white hover:bg-red-500';
  const fileNameClassName = isTight
    ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-2 pt-8 text-xs font-semibold leading-tight text-white truncate'
    : isCompact
      ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-2 pt-8 text-xs font-semibold leading-tight text-white truncate'
    : 'max-w-[80%] truncate rounded bg-black/60 px-2 py-1 font-mono text-xs text-white';
  const gripSize = isTight ? 10 : isCompact ? 12 : 14;
  const trashSize = isTight ? 9 : isCompact ? 10 : 12;

  return (
    <div ref={setNodeRef} style={style} className={containerClassName}>
      <img
        src={`${API_BASE}${img.url}`}
        alt={img.name}
        className={isTight ? 'w-full h-full object-contain bg-gray-950 p-1 cursor-pointer' : isCompact ? 'w-full h-full object-contain bg-gray-950 p-2 cursor-pointer' : 'w-full h-full object-cover cursor-pointer'}
        onClick={() => onPreview?.(`${API_BASE}${img.url}`)}
      />

      {isCompact || isTight ? (
        <>
          <div className={overlayClassName} />
          <div {...attributes} {...listeners} className={handleClassName}>
            <GripVertical size={gripSize} />
          </div>
          {onDelete && (
            <button onClick={() => onDelete(img.name)} className={deleteButtonClassName}>
              <Trash2 size={trashSize} />
            </button>
          )}
          <div className={fileNameClassName} title={img.name}>
            {img.name}
          </div>
        </>
      ) : (
        <div className={overlayClassName}>
          <div {...attributes} {...listeners} className={handleClassName}>
            <GripVertical size={gripSize} />
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <button onClick={() => onDelete(img.name)} className={deleteButtonClassName}>
                <Trash2 size={trashSize} />
              </button>
            )}
          </div>
          <div className={fileNameClassName} title={img.name}>
            {img.name}
          </div>
        </div>
      )}
    </div>
  );
}
