import { useEffect, useState } from 'react';

import {
  browseFolder,
  fetchBatchDetails as loadBatchDetails,
  fetchConfig as loadConfig,
  fetchWorkspace as loadWorkspace,
  createRawSource as createRawSourceFolder,
  saveConfig,
} from '../lib/appApi';
import type { AppConfig, BatchDetails, WorkspaceNode, WorkspaceState } from '../types/app';

const DEFAULT_CONFIG: AppConfig = {
  root_path: '',
  cli_path: '',
  app_data_dir: '',
};

export function useWorkspaceData() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [workspaceNode, setWorkspaceNode] = useState<WorkspaceNode | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const refreshConfig = async () => {
    try {
      setConfig(await loadConfig());
    } catch (error) {
      console.error(error);
    }
  };

  const refreshWorkspace = async () => {
    try {
      setWorkspace(await loadWorkspace());
    } catch (error) {
      console.error(error);
    }
  };

  const refreshBatchDetails = async (name: string): Promise<WorkspaceNode | null> => {
    try {
      const node = await loadBatchDetails(name);
      setWorkspaceNode(node);
      setBatchDetails(node.openable ? node : null);
      return node;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const createRawSource = async (folderName: string) => {
    const result = await createRawSourceFolder(folderName);
    await refreshWorkspace();
    return result;
  };

  const browseAndSaveRootPath = async () => {
    const result = await browseFolder();
    if (!result.path) {
      return null;
    }

    const nextConfig = { ...config, root_path: result.path };
    await saveConfig(nextConfig);
    setConfig(nextConfig);
    await refreshWorkspace();
    return result.path;
  };

  const persistConfig = async (nextConfig: AppConfig) => {
    const savedConfig = await saveConfig(nextConfig) as AppConfig;
    setConfig(savedConfig);
    await refreshWorkspace();
    return savedConfig;
  };

  useEffect(() => {
    void refreshConfig();
    void refreshWorkspace();
  }, []);

  return {
    batchDetails,
    createRawSource,
    browseAndSaveRootPath,
    config,
    refreshBatchDetails,
    refreshWorkspace,
    refreshConfig,
    persistConfig,
    setBatchDetails,
    setConfig,
    workspace,
    workspaceNode,
    setWorkspaceNode,
  };
}
