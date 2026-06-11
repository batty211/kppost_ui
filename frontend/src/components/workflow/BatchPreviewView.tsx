import axios from 'axios';
import React from 'react';
import { Upload, FileText } from 'lucide-react';
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

import { API_BASE } from '../../lib/api';
import { DepartmentsEditor } from '../DepartmentsEditor';
import { reorderBackendImages } from './helpers';
import { SortableImage } from './SortableImage';
import { WorkflowButton } from './WorkflowButton';
import type { ImageItem, PreparedPost } from '../../types/app';

interface BatchPreviewViewProps {
  batchName: string;
  runCommand: (command: string, path: string) => void;
  openCanvaExport: (batchPath: string) => void;
  openCanvaImport: (batchPath: string) => void;
  isLoading: boolean;
}

export function BatchPreviewView({
  batchName,
  runCommand,
  openCanvaExport,
  openCanvaImport,
  isLoading,
}: BatchPreviewViewProps) {
  const [posts, setPosts] = React.useState<PreparedPost[]>([]);
  const [selectedPostIndex, setSelectedPostIndex] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'posts' | 'departments'>('posts');
  const [isSaving, setIsSaving] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchPreview = React.useCallback(async () => {
    try {
      const res = await axios.get<{ posts: PreparedPost[] }>(`${API_BASE}/batches/${batchName}/preview`);
      setPosts(res.data.posts);
    } catch (error) {
      console.error(error);
    }
  }, [batchName]);

  React.useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const handleMdChange = async (content: string) => {
    const post = posts[selectedPostIndex];
    if (!post) return;

    const newPosts = [...posts];
    newPosts[selectedPostIndex] = { ...post, content };
    setPosts(newPosts);

    try {
      setIsSaving(true);
      await axios.put(`${API_BASE}/batches/${batchName}/content/${post.name}`, { content });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const post = posts[selectedPostIndex];
    if (!post || !over || active.id === over.id) return;

    const oldIndex = post.images.findIndex((img) => img.name === active.id);
    const newIndex = post.images.findIndex((img) => img.name === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const previousPosts = posts;
    const newImages = arrayMove(post.images, oldIndex, newIndex);
    const newPosts = [...posts];
    newPosts[selectedPostIndex] = { ...post, images: newImages };
    setPosts(newPosts);

    const success = await reorderBackendImages(
      batchName,
      newImages.map((image) => image.name),
      post.name,
    );
    if (!success) {
      setPosts(previousPosts);
      return;
    }
    await fetchPreview();
  };

  const currentPost = posts[selectedPostIndex];

  return (
    <div className="h-full flex flex-col space-y-6">
      <header className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Batch Name</div>
            <h2 className="text-xl font-bold text-blue-400">{batchName}</h2>
          </div>
          <nav className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'posts' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Posts Review
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Departments Editor
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <WorkflowButton label="Export for Canva" onClick={() => openCanvaExport(batchName)} isLoading={isLoading} />
          <WorkflowButton label="Import from Canva" onClick={() => openCanvaImport(batchName)} isLoading={isLoading} />
          <WorkflowButton label="Generate" onClick={() => runCommand('generate', batchName)} isLoading={isLoading} />
          <WorkflowButton label="Preflight" onClick={() => runCommand('preflight', batchName)} isLoading={isLoading} />
          <WorkflowButton label="Post" onClick={() => runCommand('post', batchName)} variant="primary" isLoading={isLoading} />
        </div>
      </header>

      {activeTab === 'posts' ? (
        <div className="flex-1 flex gap-8 min-h-0">
          <div className="w-64 flex-shrink-0 flex flex-col space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Prepared Posts</h3>
            {posts.map((post, idx) => (
              <button
                key={post.name}
                onClick={() => setSelectedPostIndex(idx)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedPostIndex === idx ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {post.name}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {currentPost ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300">
                      <FileText size={16} /> Markdown Editor
                    </h3>
                    {isSaving && <div className="text-[10px] text-blue-500 animate-pulse">Saving...</div>}
                  </div>
                  <textarea
                    value={currentPost.content}
                    onChange={(e) => handleMdChange(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-6 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none font-mono text-sm leading-relaxed text-gray-200 shadow-inner"
                  />
                </div>
                <div className="flex flex-col space-y-4 overflow-hidden">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300">
                    <Upload size={16} /> Prepared Images ({currentPost.images.length})
                  </h3>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={currentPost.images.map((img: ImageItem) => img.name)} strategy={rectSortingStrategy}>
                        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                          {currentPost.images.map((img) => (
                            <SortableImage key={img.name} img={img} variant="tight" />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 italic">
                No posts found in this batch.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DepartmentsEditor batchName={batchName} />
        </div>
      )}
    </div>
  );
}
