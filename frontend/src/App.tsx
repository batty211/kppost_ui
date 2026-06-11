import React, { useState, useEffect } from 'react';
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
  deleteBatchImage,
  exportCanvaBatch,
  importCanvaBatch,
  renameBatch,
  uploadBatchImage,
} from './lib/appApi';
import { getErrorMessage } from './lib/errorMessage';
import { selectRawChild, selectRawSource } from './lib/prepareTarget';
import type { ActionStatus, AppView, BatchDetails, CommandLog, WorkspaceNode } from './types/app';

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

  // Preparation Preview states
  const [showPreviewConfirm, setShowPreviewConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (batchDetails) {
      setEditableName(batchDetails.name);
    } else if (selectedKind === 'raw' && rawSourceNode?.openable === false && rawSourceNode?.name) {
      setEditableName(rawSourceNode.name);
    } else if (workspaceNode?.openable === false && workspaceNode?.name) {
      setEditableName(workspaceNode.name);
    }
  }, [batchDetails, workspaceNode, rawSourceNode, selectedKind]);

  const handleSelectRawPath = async (path: string) => {
    const nextSelection = selectRawSource(path);
    setSelectedPath(nextSelection.selectedPath);
    setSelectedKind(nextSelection.selectedKind);
    setSelectedRawSourcePath(nextSelection.selectedRawSourcePath);
    const node = await refreshBatchDetails(path);
    setRawSourceNode(node);
  };

  const handleSelectRawChildPath = async (path: string) => {
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
      await browseAndSaveRootPath();
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
      }
    } finally {
      setIsLoading(false);
    }
  };

  const runCommand = async (cmd: string, path: string) => {
    setIsLoading(true);
    const result = await runCLICommand(cmd, [path]);
    handleCommandResult(result);
    await refreshWorkspace();
    setIsLoading(false);
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
    if (!batchDetails) return;
    setBatchDetails({ ...(batchDetails as BatchDetails), content });
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedPath) return;
    setIsLoading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await uploadBatchImage(selectedPath, file);
      }
      await refreshBatchDetails(selectedPath);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
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

  const handleSelectBatchPath = (path: string) => {
    setSelectedPath(path);
    setSelectedKind('batch');
    setBatchDetails(null);
  };

  const handleSelectCanvasPath = async (path: string) => {
    setSelectedPath(path);
    setSelectedKind('canvas');
    await refreshBatchDetails(path);
  };

  const mainContent = view === 'settings' ? (
    <SettingsView
      config={config}
      fetchConfig={refreshConfig}
      handleBrowse={handleBrowse}
      cliStatus={cliStatus}
      setupCli={installCli}
      updateCli={updateCli}
      checkCliInfo={refreshCliStatus}
    />
  ) : selectedKind === 'batch' && selectedPath ? (
    <BatchPreviewView
      batchName={selectedPath}
      runCommand={runCommand}
      openCanvaExport={openCanvaExport}
      openCanvaImport={openCanvaImport}
      isLoading={isLoading}
    />
  ) : selectedKind === 'raw' && rawSourceNode ? (
    <RawSourceWorkspaceView
      sourceNode={rawSourceNode}
      selectedPath={selectedPath}
      editorDetails={batchDetails}
      onSelectChild={handleSelectRawChildPath}
      onNewPost={() => setShowNewPostModal(true)}
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
          onSelectBatchPath={handleSelectBatchPath}
          onSelectCanvasPath={handleSelectCanvasPath}
          onCreateRawSource={handleCreateRawSource}
          setView={setView}
          config={config}
          cliStatus={cliStatus}
          handleBrowse={handleBrowse}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          runPrepare={runPrepare}
          isLoading={isLoading}
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

      {showNewPostModal && <NewPostModal onClose={() => setShowNewPostModal(false)} />}

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
