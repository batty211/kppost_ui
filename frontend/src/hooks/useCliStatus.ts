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
  const [pendingOperation, setPendingOperation] = useState<'installing' | 'updating' | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');

  const refreshCliStatus = async (forceRemote = false) => {
    try {
      setCliStatus(await fetchCliInfo(forceRemote));
    } catch (error) {
      console.error(error);
    }
  };

  const installCli = async () => {
    try {
      setPendingOperation('installing');
      setPendingMessage('Starting CLI install...');
      const response = await startCliInstall();
      setPendingMessage(response?.message ?? 'CLI install started');
      void refreshCliStatus(true);
    } catch {
      setPendingOperation(null);
      setPendingMessage('');
      alert('Failed to start CLI install');
    }
  };

  const updateCli = async () => {
    try {
      setPendingOperation('updating');
      setPendingMessage('Starting CLI update...');
      const response = await startCliUpdate();
      setPendingMessage(response?.message ?? 'CLI update started');
      void refreshCliStatus(true);
    } catch {
      setPendingOperation(null);
      setPendingMessage('');
      alert('Failed to start CLI update');
    }
  };

  useEffect(() => {
    void refreshCliStatus(true);
  }, []);

  useEffect(() => {
    if (!pendingOperation && !['installing', 'updating'].includes(cliStatus.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshCliStatus();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [cliStatus.status, pendingOperation]);

  useEffect(() => {
    if (!pendingOperation) {
      return;
    }

    if (
      cliStatus.status === pendingOperation
      || cliStatus.status === 'ready'
      || cliStatus.status === 'error'
    ) {
      setPendingOperation(null);
      setPendingMessage('');
    }
  }, [cliStatus.status, pendingOperation]);

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

  const effectiveCliStatus =
    pendingOperation && !['ready', 'error', pendingOperation].includes(cliStatus.status)
      ? {
          ...cliStatus,
          status: pendingOperation,
          message: pendingMessage || cliStatus.message || `CLI ${pendingOperation} started`,
        }
      : cliStatus;

  return {
    cliStatus: effectiveCliStatus,
    installCli,
    refreshCliStatus,
    updateCli,
  };
}
