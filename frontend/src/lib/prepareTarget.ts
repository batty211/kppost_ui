export function getPrepareTargetName(path: string | null): string | null {
  return path?.split('/').filter(Boolean).pop() ?? null;
}

export interface PrepareTargetSummary {
  name: string | null;
  path: string | null;
  emptyMessage: string | null;
}

export function buildPrepareTargetSummary(path: string | null): PrepareTargetSummary {
  const name = getPrepareTargetName(path);
  if (!name || !path) {
    return {
      name: null,
      path: null,
      emptyMessage: 'Select a raw source to prepare.',
    };
  }
  return {
    name,
    path,
    emptyMessage: null,
  };
}

export interface RawSelectionState {
  selectedPath: string;
  selectedKind: 'raw';
  selectedRawSourcePath: string | null;
}

export function selectRawSource(path: string): RawSelectionState {
  return {
    selectedPath: path,
    selectedKind: 'raw',
    selectedRawSourcePath: path,
  };
}

export function selectRawChild(
  selectedRawSourcePath: string | null,
  childPath: string,
): RawSelectionState {
  return {
    selectedPath: childPath,
    selectedKind: 'raw',
    selectedRawSourcePath,
  };
}
