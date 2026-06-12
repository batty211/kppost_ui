function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isFrontendDevServer(origin: string): boolean {
  try {
    const url = new URL(origin);
    const isLocalHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    const frontendPorts = new Set(['1420', '4173', '5173']);
    return isLocalHost && frontendPorts.has(url.port);
  } catch {
    return false;
  }
}

export function resolveApiBase(): string {
  const envBase = (
    import.meta as ImportMeta & {
      env?: {
        VITE_API_BASE?: string;
      };
    }
  ).env?.VITE_API_BASE?.trim();
  if (envBase) {
    return trimTrailingSlash(envBase);
  }

  if (typeof window === 'undefined' || !window.location?.origin) {
    return 'http://127.0.0.1:8000';
  }

  const origin = window.location.origin;
  if (isFrontendDevServer(origin)) {
    return 'http://127.0.0.1:8000';
  }

  return trimTrailingSlash(origin);
}

export const API_BASE = resolveApiBase();
