import { useEffect, useRef, useState } from 'react';

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
  const previousStatusRef = useRef(cliStatus.status);

  const refreshCliStatus = async (forceRemote = false) => {
    try {
      setCliStatus(await fetchCliInfo(forceRemote));
    } catch (error) {
      console.error(error);
    }
  };

  const installCli = async () => {
    try {
      const response = await startCliInstall();
      setCliStatus((current) => ({
        ...current,
        status: 'installing',
        message: response?.message ?? 'CLI install started',
      }));
      void refreshCliStatus(true);
    } catch {
      alert('Failed to start CLI install');
    }
  };

  const updateCli = async () => {
    try {
      const response = await startCliUpdate();
      setCliStatus((current) => ({
        ...current,
        status: 'updating',
        message: response?.message ?? 'CLI update started',
      }));
      void refreshCliStatus(true);
    } catch {
      alert('Failed to start CLI update');
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

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (previousStatus !== cliStatus.status) {
      if (
        previousStatus === 'updating' &&
        cliStatus.status === 'ready' &&
        cliStatus.message
      ) {
        alert(cliStatus.message);
      } else if (
        previousStatus === 'installing' &&
        cliStatus.status === 'ready' &&
        cliStatus.message
      ) {
        alert(cliStatus.message);
      } else if (
        ['installing', 'updating'].includes(previousStatus) &&
        cliStatus.status === 'error' &&
        cliStatus.message
      ) {
        alert(cliStatus.message);
      }
    }

    previousStatusRef.current = cliStatus.status;
  }, [cliStatus.status, cliStatus.message]);

  return {
    cliStatus,
    installCli,
    refreshCliStatus,
    updateCli,
  };
}
