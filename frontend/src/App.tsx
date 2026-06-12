import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// Components
import {
  ActionStatusToast,
  CanvaExportModal,
  CanvaImportModal,
  ImagePreviewModal,
  NewPostModal,
  PreparationCompleteModal,
} from './components/AppModals';
import { ConsoleLogs } from './components/ConsoleLogs';
import { RawSourceBrowser, RawSourceWorkspaceView, BatchPreviewView } from './components/Workflow';
import { SettingsView } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import { runCLICommand } from './components/Commands';
import { useCliStatus } from './hooks/useCliStatus';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import {
  createRawPost,
  deleteBatchImage,
  exportCanvaBatch,
  importCanvaBatch,
  renameBatch,
  updateBatchContent,
  uploadBatchImage,
} from './lib/appApi';
import { getErrorMessage } from './lib/errorMessage';
import { selectRawChild, selectRawSource } from './lib/prepareTarget';
import type {
  ActionStatus,
  AppView,
  BatchWorkflowStatus,
  CommandLog,
  CommandRunState,
  DepartmentEntry,
  WorkspaceNode,
} from './types/app';

function buildCanvasExportPreview(batchPath: string) {
  const now = new Date();
  const stamp = [
    now.getFullYear().toString().padStart(4, '0'),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0'),
  ].join('') + `-${[
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join('')}`;
  const batchName = batchPath.split('/').pop() ?? batchPath;
  return `Canvas/${batchName}/export-${stamp}`;
}

interface CommandSummary {
  tone: 'success' | 'error';
  title: string;
  lines: string[];
}

type RawEditorSaveState = 'idle' | 'saving' | 'saved' | 'error';

function extractJsonBlock(stdout: string): Record<string, unknown> | null {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeCommand(command: string, result: CommandLog): CommandSummary {
  if (result.returncode !== 0) {
    return {
      tone: 'error',
      title: `${command} failed`,
      lines: [result.stderr || 'The command did not complete successfully.'],
    };
  }

  if (command === 'generate') {
    const firstLine = result.stdout.split('\n').find((line) => line.trim()) ?? 'Generate complete';
    const outputHint = firstLine.includes('generated-preview.json')
      ? 'Preview generated. Existing batch.json is still active.'
      : 'batch.json is ready for preflight and post.';
    return {
      tone: 'success',
      title: 'Generate complete',
      lines: [firstLine.trim(), outputHint],
    };
  }

  if (command === 'preflight') {
    const validLine = result.stdout
      .split('\n')
      .find((line) => line.trim().startsWith('Valid batch:'))
      ?.trim() ?? 'Preflight complete';
    const payload = extractJsonBlock(result.stdout);
    const lines = [validLine];
    if (payload) {
      if (typeof payload.site_name === 'string') lines.push(`Site: ${payload.site_name}`);
      if (typeof payload.site_url === 'string') lines.push(`URL: ${payload.site_url}`);
      if (typeof payload.user_name === 'string') lines.push(`User: ${payload.user_name}`);
      if (typeof payload.taxonomy_posts_checked === 'number') lines.push(`Posts checked: ${payload.taxonomy_posts_checked}`);
    }
    return {
      tone: 'success',
      title: 'Preflight complete',
      lines,
    };
  }

  if (command === 'post') {
    const lines = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const summary = lines.find((line) => line.startsWith('Post complete:')) ?? 'Post complete';
    const report = lines.find((line) => line.startsWith('Report:')) ?? '';
    return {
      tone: 'success',
      title: 'Post complete',
      lines: report ? [summary, report] : [summary],
    };
  }

  return {
    tone: 'success',
    title: `${command} complete`,
    lines: [result.stdout || 'Command completed successfully.'],
  };
}

function getRawEditorSavePresentation(
  saveState: RawEditorSaveState,
  isDirty: boolean,
): { label: string; tone: 'muted' | 'saving' | 'success' | 'error' } {
  if (saveState === 'error') {
    return { label: 'Could not save', tone: 'error' };
  }
  if (saveState === 'saving') {
    return { label: 'Saving...', tone: 'saving' };
  }
  if (isDirty) {
    return { label: 'Changes pending', tone: 'muted' };
  }
  if (saveState === 'saved') {
    return { label: 'Saved', tone: 'success' };
  }
  return { label: 'Auto-saves after you pause typing', tone: 'muted' };
}

function App() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedRawSourcePath, setSelectedRawSourcePath] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'raw' | 'batch' | 'canvas' | 'legacy' | null>(null);
  const [rawSourceNode, setRawSourceNode] = useState<WorkspaceNode | null>(null);
  const {
    batchDetails,
    createRawSource,
    browseAndSaveRootPath,
    config,
    persistConfig,
    refreshBatchDetails,
    refreshWorkspace,
    refreshConfig,
    setBatchDetails,
    workspace,
    workspaceNode,
  } = useWorkspaceData();
  const { cliStatus, installCli, refreshCliStatus, updateCli } = useCliStatus();
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AppView>('editor');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostDate, setNewPostDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newPostTime, setNewPostTime] = useState('09:00');
  const [newPostDepartmentCode, setNewPostDepartmentCode] = useState('');
  const [newPostDepartments, setNewPostDepartments] = useState<DepartmentEntry[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [canvaExportBatchPath, setCanvaExportBatchPath] = useState<string | null>(null);
  const [canvaExportPreviewPath, setCanvaExportPreviewPath] = useState('');
  const [canvaImportBatchPath, setCanvaImportBatchPath] = useState<string | null>(null);
  const [featureZip, setFeatureZip] = useState<File | null>(null);
  const [newsWatermarkZip, setNewsWatermarkZip] = useState<File | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);
  
  // States for renaming
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [rawDraftPath, setRawDraftPath] = useState<string | null>(null);
  const [rawDraftContent, setRawDraftContent] = useState('');
  const [rawLastSavedContent, setRawLastSavedContent] = useState('');
  const [rawIsDirty, setRawIsDirty] = useState(false);
  const [rawSaveState, setRawSaveState] = useState<RawEditorSaveState>('idle');

  // Preparation Preview states
  const [showPreviewConfirm, setShowPreviewConfirm] = useState<string | null>(null);
  const [batchPreviewRefreshSignal, setBatchPreviewRefreshSignal] = useState(0);
  const [commandStates, setCommandStates] = useState<Record<string, CommandRunState>>({
    generate: 'idle',
    preflight: 'idle',
    post: 'idle',
  });
  const [commandSummaries, setCommandSummaries] = useState<Partial<Record<string, CommandSummary>>>({});
  const rawDraftRef = useRef(rawDraftContent);
  const rawDraftPathRef = useRef(rawDraftPath);
  const rawAutosaveTimerRef = useRef<number | null>(null);
  const rawSaveAttemptRef = useRef(0);
  const previousCliStatusRef = useRef(cliStatus.status);
  const batchDetailsPath = typeof batchDetails?.path === 'string' ? batchDetails.path : null;

  useEffect(() => {
    rawDraftRef.current = rawDraftContent;
  }, [rawDraftContent]);

  useEffect(() => {
    rawDraftPathRef.current = rawDraftPath;
  }, [rawDraftPath]);

  useEffect(() => {
    if (batchDetails) {
      setEditableName(batchDetails.name);
    } else if (selectedKind === 'raw' && rawSourceNode?.openable === false && rawSourceNode?.name) {
      setEditableName(rawSourceNode.name);
    } else if (workspaceNode?.openable === false && workspaceNode?.name) {
      setEditableName(workspaceNode.name);
    }
  }, [batchDetails, workspaceNode, rawSourceNode, selectedKind]);

  useEffect(() => {
    const previousStatus = previousCliStatusRef.current;
    if (
      ['installing', 'updating'].includes(previousStatus)
      && cliStatus.status === 'ready'
    ) {
      void refreshConfig();
    }
    previousCliStatusRef.current = cliStatus.status;
  }, [cliStatus.status, refreshConfig]);

  const resetWorkspaceSelection = () => {
    setSelectedPath(null);
    setSelectedRawSourcePath(null);
    setSelectedKind(null);
    setRawSourceNode(null);
    setBatchDetails(null);
    setEditableName('');
    setIsEditingName(false);
    setPreviewImage(null);
    setShowNewPostModal(false);
    setNewPostDepartmentCode('');
    setNewPostDepartments([]);
    setShowPreviewConfirm(null);
    setCanvaExportBatchPath(null);
    setCanvaExportPreviewPath('');
    setCanvaImportBatchPath(null);
    setFeatureZip(null);
    setNewsWatermarkZip(null);
    setView('editor');
    setRawDraftPath(null);
    setRawDraftContent('');
    setRawLastSavedContent('');
    setRawIsDirty(false);
    setRawSaveState('idle');
  };

  useEffect(() => {
    if (!showNewPostModal || !rawSourceNode) {
      return;
    }

    const departments = rawSourceNode.workspace_departments?.departments ?? [];
    setNewPostDepartments(departments);
    setNewPostDepartmentCode((current) => current || departments[0]?.code || '');
  }, [showNewPostModal, rawSourceNode]);

  useEffect(() => {
    if (selectedKind !== 'batch') {
      return;
    }
    setCommandStates({
      generate: 'idle',
      preflight: 'idle',
      post: 'idle',
    });
    setCommandSummaries({});
  }, [selectedKind, selectedPath]);

  useEffect(() => {
    if (selectedKind !== 'raw' || !batchDetails || !batchDetailsPath) {
      return;
    }

    if (rawDraftPath !== batchDetailsPath) {
      setRawDraftPath(batchDetailsPath);
      setRawDraftContent(batchDetails.content);
      setRawLastSavedContent(batchDetails.content);
      setRawIsDirty(false);
      setRawSaveState('idle');
      return;
    }

    if (!rawIsDirty && rawLastSavedContent !== batchDetails.content) {
      setRawDraftContent(batchDetails.content);
      setRawLastSavedContent(batchDetails.content);
      setRawSaveState('idle');
    }
  }, [batchDetails, batchDetailsPath, rawDraftPath, rawIsDirty, rawLastSavedContent, selectedKind]);

  useEffect(() => {
    if (rawAutosaveTimerRef.current !== null) {
      window.clearTimeout(rawAutosaveTimerRef.current);
      rawAutosaveTimerRef.current = null;
    }

    if (
      selectedKind !== 'raw'
      || !rawDraftPath
      || !rawIsDirty
      || rawDraftContent === rawLastSavedContent
    ) {
      return;
    }

    rawAutosaveTimerRef.current = window.setTimeout(() => {
      const path = rawDraftPathRef.current;
      const content = rawDraftRef.current;
      if (!path) {
        return;
      }

      const attempt = rawSaveAttemptRef.current + 1;
      rawSaveAttemptRef.current = attempt;
      setRawSaveState('saving');

      void updateBatchContent(path, content)
        .then(() => {
          if (rawSaveAttemptRef.current !== attempt) {
            return;
          }

          setRawLastSavedContent(content);
          const hasNewerDraft = rawDraftPathRef.current !== path || rawDraftRef.current !== content;
          setRawIsDirty(hasNewerDraft);
          setRawSaveState(hasNewerDraft ? 'idle' : 'saved');
          setBatchDetails((current) => {
            const currentPath = (current as (typeof current & { path?: string }) | null)?.path;
            if (!current || currentPath !== path) {
              return current;
            }
            return { ...current, content };
          });
        })
        .catch(() => {
          if (rawSaveAttemptRef.current !== attempt) {
            return;
          }
          setRawSaveState('error');
          setRawIsDirty(true);
        });
    }, 700);

    return () => {
      if (rawAutosaveTimerRef.current !== null) {
        window.clearTimeout(rawAutosaveTimerRef.current);
        rawAutosaveTimerRef.current = null;
      }
    };
  }, [rawDraftContent, rawDraftPath, rawIsDirty, rawLastSavedContent, selectedKind, setBatchDetails]);

  const handleSelectRawPath = async (path: string) => {
    setView('editor');
    const nextSelection = selectRawSource(path);
    setSelectedPath(nextSelection.selectedPath);
    setSelectedKind(nextSelection.selectedKind);
    setSelectedRawSourcePath(nextSelection.selectedRawSourcePath);
    const node = await refreshBatchDetails(path);
    setRawSourceNode(node);
  };

  const handleSelectRawChildPath = async (path: string) => {
    setView('editor');
    const nextSelection = selectRawChild(selectedRawSourcePath, path);
    setSelectedPath(nextSelection.selectedPath);
    setSelectedKind(nextSelection.selectedKind);
    setSelectedRawSourcePath(nextSelection.selectedRawSourcePath);
    await refreshBatchDetails(path);
  };

  const handleRename = async () => {
    if (!selectedPath || !editableName) {
      setIsEditingName(false);
      return;
    }
    const currentName = selectedPath.split('/').pop() ?? selectedPath;
    if (editableName === currentName) {
      setIsEditingName(false);
      return;
    }
    try {
      await renameBatch(selectedPath, editableName);
      await refreshWorkspace();
      const parentPath = selectedPath.includes('/') ? selectedPath.split('/').slice(0, -1).join('/') : '';
      const nextSelectedPath = parentPath ? `${parentPath}/${editableName}` : editableName;
      setSelectedPath(nextSelectedPath);
      setIsEditingName(false);
      await refreshBatchDetails(nextSelectedPath);
    } catch (error) {
      alert(`Error renaming folder: ${getErrorMessage(error)}`);
      setEditableName(currentName);
    }
  };

  const handleBrowse = async () => {
    try {
      const nextPath = await browseAndSaveRootPath();
      if (nextPath && nextPath !== config.root_path) {
        resetWorkspaceSelection();
      }
    } catch {
      alert('Error browsing folder');
    }
  };

  const appendLog = (entry: CommandLog) => {
    setLogs((previousLogs) => [entry, ...previousLogs].slice(0, 50));
  };

  const handleCommandResult = (result: CommandLog) => {
    appendLog(result);
    if (result.returncode !== 0) {
      setIsConsoleExpanded(true);
    }
  };

  const refreshCurrentRawSource = async () => {
    if (!selectedRawSourcePath) return;
    const node = await refreshBatchDetails(selectedRawSourcePath);
    setRawSourceNode(node);
  };

  const rawSourceHasDepartments = Boolean(
    rawSourceNode?.workspace_departments?.departments && rawSourceNode.workspace_departments.departments.length > 0,
  );

  const redirectToDepartmentsSettings = (actionLabel: string) => {
    setView('settings');
    setActionStatus({
      tone: 'error',
      title: 'Set departments first',
      message: `${actionLabel} requires workspace departments.json. Open Settings and configure it before continuing.`,
    });
  };

  const runPrepare = async (sourcePath: string) => {
    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const batchFolderName = `batch-${timestamp}`;
      const outputPath = `Batches/${batchFolderName}`;

      const result = await runCLICommand('prepare', [sourcePath, outputPath]);
      handleCommandResult(result);
      await refreshWorkspace();

      if (result.returncode === 0) {
        setShowPreviewConfirm(outputPath);
        setSelectedPath(outputPath);
        setSelectedKind('batch');
        await refreshBatchDetails(outputPath);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const runCommand = async (cmd: string, path: string) => {
    setCommandStates((current) => ({ ...current, [cmd]: 'running' }));
    try {
      const result = await runCLICommand(cmd, [path]);
      handleCommandResult(result);
      setCommandStates((current) => ({ ...current, [cmd]: result.returncode === 0 ? 'success' : 'error' }));
      setCommandSummaries((current) => ({ ...current, [cmd]: summarizeCommand(cmd, result) }));
      await refreshWorkspace();
      await refreshBatchDetails(path);
    } catch (error) {
      const failedResult = {
        stdout: '',
        stderr: getErrorMessage(error),
        returncode: 1,
        command: `${cmd} ${path}`,
      };
      handleCommandResult(failedResult);
      setCommandStates((current) => ({ ...current, [cmd]: 'error' }));
      setCommandSummaries((current) => ({ ...current, [cmd]: summarizeCommand(cmd, failedResult) }));
    }
  };

  const openCanvaExport = (batchPath: string) => {
    setCanvaExportBatchPath(batchPath);
    setCanvaExportPreviewPath(buildCanvasExportPreview(batchPath));
  };

  const openCanvaImport = (batchPath: string) => {
    setCanvaImportBatchPath(batchPath);
    setFeatureZip(null);
    setNewsWatermarkZip(null);
  };

  const closeCanvaExport = () => {
    setCanvaExportBatchPath(null);
    setCanvaExportPreviewPath('');
  };

  const closeCanvaImport = () => {
    setCanvaImportBatchPath(null);
    setFeatureZip(null);
    setNewsWatermarkZip(null);
  };

  const handleCanvaExport = async () => {
    if (!canvaExportBatchPath) return;
    setIsLoading(true);
    try {
      const result = await exportCanvaBatch(canvaExportBatchPath);
      handleCommandResult(result);
      await refreshWorkspace();
      if (result.returncode === 0) {
        setActionStatus({
          tone: 'success',
          title: 'Canva export complete',
          message: `Created Canva workbooks for ${canvaExportBatchPath} in ${result.output_path ?? canvaExportPreviewPath}.`,
        });
        closeCanvaExport();
      } else {
        setActionStatus({
          tone: 'error',
          title: 'Canva export failed',
          message: 'The export did not finish. The console output is open with the CLI error details.',
        });
      }
    } catch (error) {
      setIsConsoleExpanded(true);
      appendLog({
        stdout: '',
        stderr: getErrorMessage(error, 'Unable to export for Canva right now.'),
        returncode: 1,
        command: `canva export ${canvaExportBatchPath}`,
      });
      setActionStatus({
        tone: 'error',
        title: 'Canva export failed',
        message: getErrorMessage(error, 'Unable to export for Canva right now.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanvaImport = async () => {
    if (!canvaImportBatchPath || !featureZip || !newsWatermarkZip) return;
    setIsLoading(true);
    try {
      const result = await importCanvaBatch(canvaImportBatchPath, featureZip, newsWatermarkZip);
      handleCommandResult(result);
      await refreshWorkspace();
      await refreshBatchDetails(canvaImportBatchPath);
      if (result.returncode === 0) {
        setBatchPreviewRefreshSignal((current) => current + 1);
        setActionStatus({
          tone: 'success',
          title: 'Canva import complete',
          message: `Imported Canva images back into ${canvaImportBatchPath}. Next step: run Generate.`,
        });
        closeCanvaImport();
      } else {
        setActionStatus({
          tone: 'error',
          title: 'Canva import failed',
          message: 'The import did not finish. The console output is open with the CLI error details.',
        });
      }
    } catch (error) {
      setIsConsoleExpanded(true);
      appendLog({
        stdout: '',
        stderr: getErrorMessage(error, 'Unable to import the Canva ZIP files right now.'),
        returncode: 1,
        command: `canva import ${canvaImportBatchPath}`,
      });
      setActionStatus({
        tone: 'error',
        title: 'Canva import failed',
        message: getErrorMessage(error, 'Unable to import the Canva ZIP files right now.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (content: string) => {
    if (selectedKind !== 'raw' || !batchDetailsPath) return;
    setRawDraftPath(batchDetailsPath);
    setRawDraftContent(content);
    setRawIsDirty(content !== rawLastSavedContent);
    setRawSaveState('idle');
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    if (files.length === 0 || !selectedPath) return;
    setIsLoading(true);
    try {
      for (const file of files) {
        await uploadBatchImage(selectedPath, file);
      }
      await refreshBatchDetails(selectedPath);
    } catch (err) { console.error(err); }
    finally {
      input.value = '';
      setIsLoading(false);
    }
  };

  const handleDeleteImage = async (imageName: string) => {
    if (!selectedPath) return;
    try {
      await deleteBatchImage(selectedPath, imageName);
      await refreshBatchDetails(selectedPath);
    } catch (err) { console.error(err); }
  };

  const handleCreateRawSource = async (folderName: string) => {
    const result = await createRawSource(folderName);
    await refreshWorkspace();
    await handleSelectRawPath(result.path);
  };

  const handleCreateRawPost = async () => {
    if (!rawSourceNode) return;
    if (!rawSourceHasDepartments) {
      redirectToDepartmentsSettings('New Post');
      return;
    }
    setIsCreatingPost(true);
    try {
      const result = await createRawPost(rawSourceNode.path, {
        date: newPostDate,
        time: newPostTime,
        department_code: newPostDepartmentCode,
      });
      await refreshWorkspace();
      await refreshCurrentRawSource();
      setShowNewPostModal(false);
      setSelectedPath(result.path);
      await refreshBatchDetails(result.path);
      setActionStatus({
        tone: 'success',
        title: 'Raw post created',
        message: `Created ${result.name} in ${rawSourceNode.name}.`,
      });
    } catch (error) {
      setActionStatus({
        tone: 'error',
        title: 'Unable to create post',
        message: getErrorMessage(error, 'Unable to create the raw post folder right now.'),
      });
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handlePrepareFromRawSource = () => {
    if (!rawSourceNode) return;
    if (!rawSourceHasDepartments) {
      redirectToDepartmentsSettings('Prepare');
      return;
    }
    void runPrepare(rawSourceNode.path);
  };

  const handleOpenNewPostModal = () => {
    if (!rawSourceNode) return;
    if (!rawSourceHasDepartments) {
      redirectToDepartmentsSettings('New Post');
      return;
    }
    setShowNewPostModal(true);
  };

  const handleSelectBatchPath = async (path: string) => {
    setView('editor');
    setSelectedPath(path);
    setSelectedKind('batch');
    await refreshBatchDetails(path);
  };

  const handleSelectCanvasPath = async (path: string) => {
    setView('editor');
    setSelectedPath(path);
    setSelectedKind('canvas');
    await refreshBatchDetails(path);
  };

  const rawEditorContent = batchDetails
    ? selectedKind === 'raw' && rawDraftPath === batchDetailsPath
      ? rawDraftContent
      : batchDetails.content
    : '';
  const rawEditorDetails = batchDetails ? { ...batchDetails, content: rawEditorContent } : null;
  const rawSavePresentation = getRawEditorSavePresentation(rawSaveState, rawIsDirty);

  const mainContent = view === 'settings' ? (
    <SettingsView
      config={config}
      fetchConfig={refreshConfig}
      handleBrowse={handleBrowse}
      onClose={() => setView('editor')}
      onWorkspaceRootChange={resetWorkspaceSelection}
      saveConfig={persistConfig}
      cliStatus={cliStatus}
      setupCli={installCli}
      updateCli={updateCli}
      checkCliInfo={refreshCliStatus}
      refreshWorkspaceContext={refreshCurrentRawSource}
    />
  ) : selectedKind === 'batch' && selectedPath ? (
    <BatchPreviewView
      batchName={selectedPath}
      runCommand={runCommand}
      openCanvaExport={openCanvaExport}
      openCanvaImport={openCanvaImport}
      isLoading={isLoading}
      refreshSignal={batchPreviewRefreshSignal}
      workflowStatus={(workspaceNode?.workflow_status as BatchWorkflowStatus | undefined) ?? null}
      commandStates={commandStates}
      commandSummaries={commandSummaries}
    />
  ) : selectedKind === 'raw' && rawSourceNode ? (
    <RawSourceWorkspaceView
      sourceNode={rawSourceNode}
      selectedPath={selectedPath}
      editorDetails={rawEditorDetails}
      editorContent={rawEditorContent}
      onSelectChild={handleSelectRawChildPath}
      onNewPost={handleOpenNewPostModal}
      onPrepare={handlePrepareFromRawSource}
      handleContentChange={handleContentChange}
      handleUploadImages={handleUploadImages}
      handleDeleteImage={handleDeleteImage}
      fetchBatchDetails={refreshBatchDetails}
      setPreviewImage={setPreviewImage}
      isEditingName={isEditingName}
      setIsEditingName={setIsEditingName}
      editableName={editableName}
      setEditableName={setEditableName}
      handleRename={handleRename}
      isLoading={isLoading}
      saveStateLabel={rawSavePresentation.label}
      saveStateTone={rawSavePresentation.tone}
    />
  ) : selectedKind === 'raw' ? (
    <RawSourceBrowser
      node={workspaceNode}
      onSelectChild={handleSelectRawPath}
      selectedPath={selectedPath}
    />
  ) : selectedKind === 'canvas' ? (
    workspaceNode ? (
      <RawSourceBrowser node={workspaceNode} onSelectChild={handleSelectCanvasPath} selectedPath={selectedPath} />
    ) : (
      <div>Select a Canvas folder</div>
    )
  ) : selectedKind === 'legacy' ? (
    workspaceNode ? (
      <RawSourceBrowser node={workspaceNode} onSelectChild={handleSelectRawPath} selectedPath={selectedPath} />
    ) : (
      <div>Select a legacy folder</div>
    )
  ) : (
    <div>Select a folder</div>
  );

  return (
    <div className="h-screen overflow-hidden bg-[#050816] text-gray-100">
      <div className="flex h-full min-w-0">
        <Sidebar
          workspace={workspace}
          selectedPath={selectedPath}
          selectedRawPath={selectedRawSourcePath}
          onSelectRawPath={handleSelectRawPath}
          onSelectBatchPath={(path) => void handleSelectBatchPath(path)}
          onSelectCanvasPath={handleSelectCanvasPath}
          onCreateRawSource={handleCreateRawSource}
          setView={setView}
          config={config}
          cliStatus={cliStatus}
          handleBrowse={handleBrowse}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-white/5 bg-[radial-gradient(circle_at_top,_rgba(43,74,160,0.16),_transparent_45%),linear-gradient(180deg,_#091024_0%,_#040814_100%)]">
          <div className="flex-1 overflow-auto px-5 py-5">
            {mainContent}
          </div>
          <ConsoleLogs
            logs={logs}
            setLogs={setLogs}
            isExpanded={isConsoleExpanded}
            setIsExpanded={setIsConsoleExpanded}
          />
        </div>
      </div>

      {showPreviewConfirm && (
        <PreparationCompleteModal
          batchName={showPreviewConfirm}
          onClose={() => setShowPreviewConfirm(null)}
          onPreview={(batchName) => {
            setSelectedPath(batchName);
            setSelectedKind('batch');
            setShowPreviewConfirm(null);
          }}
        />
      )}

      {showNewPostModal && rawSourceNode && (
        <NewPostModal
          onClose={() => setShowNewPostModal(false)}
          rawSourceName={rawSourceNode.name}
          selectedDate={newPostDate}
          selectedTime={newPostTime}
          departments={newPostDepartments.map((item) => ({ code: item.code, name: item.name }))}
          selectedDepartmentCode={newPostDepartmentCode}
          isSubmitting={isCreatingPost}
          helperMessage={
            newPostDepartments.length === 0
              ? 'ยังไม่มี workspace departments.json ให้ไปตั้งค่าใน Settings ก่อน'
              : undefined
          }
          onDateChange={setNewPostDate}
          onTimeChange={setNewPostTime}
          onDepartmentChange={setNewPostDepartmentCode}
          onSubmit={() => void handleCreateRawPost()}
        />
      )}

      {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}

      {canvaExportBatchPath && (
        <CanvaExportModal
          batchName={canvaExportBatchPath}
          outputPath={canvaExportPreviewPath}
          isLoading={isLoading}
          onClose={closeCanvaExport}
          onConfirm={() => void handleCanvaExport()}
        />
      )}

      {canvaImportBatchPath && (
        <CanvaImportModal
          batchName={canvaImportBatchPath}
          featureZip={featureZip}
          newsWatermarkZip={newsWatermarkZip}
          isLoading={isLoading}
          onClose={closeCanvaImport}
          onFeatureChange={setFeatureZip}
          onNewsWatermarkChange={setNewsWatermarkZip}
          onConfirm={() => void handleCanvaImport()}
        />
      )}

      {actionStatus && <ActionStatusToast {...actionStatus} onClose={() => setActionStatus(null)} />}
    </div>
  );
}

export default App;
