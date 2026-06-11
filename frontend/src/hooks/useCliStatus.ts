import { useEffect, useState } from 'react';

import {
  fetchCliInfo,
  installCli as startCliInstall,
  updateCli as startCliUpdate,
} from '../lib/appApi';
import type { CliStatus } from '../types/app';

const DEFAULT_CLI_STATUS: CliStatus = {
  status: 'not_installed',
  message: '',
  repo_url: '',
  installed_version: '',
  latest_version: '',
  update_available: false,
  last_checked: '',
};

export function useCliStatus() {
  const [cliStatus, setCliStatus] = useState<CliStatus>(DEFAULT_CLI_STATUS);

  const refreshCliStatus = async (forceRemote = false) => {
    try {
      setCliStatus(await fetchCliInfo(forceRemote));
    } catch (error) {
      console.error(error);
    }
  };

  const installCli = async () => {
    try {
      await startCliInstall();
      void refreshCliStatus(true);
    } catch {
      alert('Failed');
    }
  };

  const updateCli = async () => {
    try {
      await startCliUpdate();
      void refreshCliStatus(true);
    } catch {
      alert('Failed');
    }
  };

  useEffect(() => {
    void refreshCliStatus(true);
  }, []);

  useEffect(() => {
    if (!['installing', 'updating'].includes(cliStatus.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshCliStatus();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [cliStatus.status]);

  return {
    cliStatus,
    installCli,
    refreshCliStatus,
    updateCli,
  };
}
