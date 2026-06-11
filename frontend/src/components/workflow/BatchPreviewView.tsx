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
import type { BatchWorkflowStatus, CommandRunState, ImageItem, PreparedPost } from '../../types/app';

interface CommandSummary {
  tone: 'success' | 'error';
  title: string;
  lines: string[];
}

interface BatchPreviewViewProps {
  batchName: string;
  runCommand: (command: string, path: string) => void;
  openCanvaExport: (batchPath: string) => void;
  openCanvaImport: (batchPath: string) => void;
  isLoading: boolean;
  refreshSignal?: number;
  workflowStatus?: BatchWorkflowStatus | null;
  commandStates: Record<string, CommandRunState>;
  commandSummaries: Partial<Record<string, CommandSummary>>;
}

export function BatchPreviewView({
  batchName,
  runCommand,
  openCanvaExport,
  openCanvaImport,
  isLoading,
  refreshSignal = 0,
  workflowStatus,
  commandStates,
  commandSummaries,
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
  }, [fetchPreview, refreshSignal]);

  React.useEffect(() => {
    setSelectedPostIndex(0);
  }, [batchName]);

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
  const generateState = commandStates.generate ?? 'idle';
  const preflightState = commandStates.preflight ?? 'idle';
  const postState = commandStates.post ?? 'idle';
  const preflightDisabled = !workflowStatus?.has_batch_json;
  const postDisabled = !workflowStatus?.has_batch_json;

  const renderSummary = (result: CommandSummary | undefined) => {
    if (!result) return null;
    const styles =
      result.tone === 'success'
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-100';
    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
        <div className="font-semibold">{result.title}</div>
        <div className="mt-2 space-y-1 text-xs leading-relaxed text-white/80">
          {result.lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    );
  };

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
          <WorkflowButton label="Export for Canva" onClick={() => openCanvaExport(batchName)} disabled={isLoading} />
          <WorkflowButton label="Import from Canva" onClick={() => openCanvaImport(batchName)} disabled={isLoading} />
          <WorkflowButton
            label="Generate"
            successLabel="Generated"
            runningLabel="Generating..."
            onClick={() => runCommand('generate', batchName)}
            state={generateState}
          />
          <WorkflowButton
            label="Preflight"
            successLabel="Preflight Complete"
            runningLabel="Preflighting..."
            onClick={() => runCommand('preflight', batchName)}
            state={preflightState}
            disabled={preflightDisabled}
            disabledReason={preflightDisabled ? 'Generate before preflight.' : undefined}
          />
          <WorkflowButton
            label="Post"
            successLabel="Post Complete"
            runningLabel="Posting..."
            onClick={() => runCommand('post', batchName)}
            variant="primary"
            state={postState}
            disabled={postDisabled}
            disabledReason={postDisabled ? 'Generate before post.' : undefined}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-gray-300">
          <div className="text-[10px] uppercase font-bold tracking-[0.25em] text-gray-500">Workflow Readiness</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 ${workflowStatus?.has_batch_json ? 'bg-emerald-500/15 text-emerald-100' : 'bg-gray-800 text-gray-400'}`}>
              {workflowStatus?.has_batch_json ? 'batch.json ready' : 'Generate required'}
            </span>
            {workflowStatus?.latest_generate_output ? (
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-100">
                output: {workflowStatus.latest_generate_output.split('/').pop()}
              </span>
            ) : null}
            {workflowStatus?.latest_post_report ? (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">
                report: {workflowStatus.latest_post_report.split('/').pop()}
              </span>
            ) : null}
          </div>
          {!workflowStatus?.has_batch_json ? (
            <div className="mt-3 text-gray-400">ต้อง Generate ก่อน จึงจะใช้ Preflight และ Post ได้</div>
          ) : null}
        </div>
        <div className="space-y-3">
          {renderSummary(commandSummaries.generate)}
          {renderSummary(commandSummaries.preflight)}
          {renderSummary(commandSummaries.post)}
        </div>
      </div>

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
