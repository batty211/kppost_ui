import { useState, useEffect } from 'react';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';

import type { AppConfig, CliStatus } from '../types/app';
import { DepartmentsEditor } from './DepartmentsEditor';
import { CliManagementPanel } from './settings/CliManagementPanel';
import { WordPressSettings } from './settings/WordPressSettings';

interface SettingsViewProps {
  config: AppConfig;
  fetchConfig: () => Promise<void>;
  handleBrowse: () => Promise<void>;
  onClose: () => void;
  onWorkspaceRootChange: () => void;
  saveConfig: (config: AppConfig) => Promise<AppConfig>;
  cliStatus: CliStatus;
  setupCli: () => Promise<void>;
  updateCli: () => Promise<void>;
  checkCliInfo: (forceRemote?: boolean) => Promise<void>;
  refreshWorkspaceContext?: () => Promise<void>;
}

export function SettingsView({
  config,
  fetchConfig,
  handleBrowse,
  onClose,
  onWorkspaceRootChange,
  saveConfig,
  cliStatus,
  setupCli,
  updateCli,
  checkCliInfo,
  refreshWorkspaceContext,
}: SettingsViewProps) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    try {
      const rootPathChanged = localConfig.root_path !== config.root_path;
      await saveConfig(localConfig);
      await fetchConfig();
      if (rootPathChanged) {
        onWorkspaceRootChange();
      }
      alert('Settings saved!');
    } catch {
      alert('Error saving settings');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-12 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gray-800 p-3 rounded-xl">
          <SettingsIcon size={24} className="text-gray-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-gray-500 text-sm">Configure your workspace and CLI path.</p>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-700 hover:bg-gray-800"
        >
          <ArrowLeft size={16} />
          Back to workspace
        </button>
      </div>

      <div className="space-y-8 bg-gray-900 border border-gray-800 p-8 rounded-2xl">
        <div className="space-y-4">
          <label className="text-sm font-semibold text-gray-300">Root Working Directory</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={localConfig.root_path}
              onChange={(e) => setLocalConfig({ ...localConfig, root_path: e.target.value })}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono text-sm"
              placeholder="/Users/name/posts"
            />
            <button 
              onClick={handleBrowse}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 rounded-xl font-bold text-sm transition-colors"
            >
              Browse
            </button>
          </div>
          <p className="text-xs text-gray-500">The folder where your post directories are stored.</p>
        </div>

        <CliManagementPanel
          cliStatus={cliStatus}
          config={config}
          onCheckUpdates={checkCliInfo}
          onInstall={setupCli}
          onUpdate={updateCli}
        />

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all mt-4"
        >
          Save Configuration
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-900/40 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
        WordPress credentials are app-wide and stay available when you switch workspace folders.
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-8">
        <div>
          <h3 className="text-lg font-bold text-gray-100">Workspace departments.json</h3>
          <p className="mt-1 text-sm text-gray-400">
            Manage department mappings once for the whole workspace. New Post and Prepare will use this shared file.
          </p>
        </div>
        <DepartmentsEditor
          workspaceLevel
          title="Workspace departments.json"
          onSaved={refreshWorkspaceContext}
        />
      </div>

      <WordPressSettings />
    </div>
  );
}
