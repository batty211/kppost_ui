import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrepareTargetSummary,
  getPrepareTargetName,
  selectRawChild,
  selectRawSource,
} from './prepareTarget.ts';

test('selectRawSource keeps the raw source as both selected and prepare target', () => {
  const state = selectRawSource('Raws/2026-news-1');

  assert.equal(state.selectedPath, 'Raws/2026-news-1');
  assert.equal(state.selectedKind, 'raw');
  assert.equal(state.selectedRawSourcePath, 'Raws/2026-news-1');
});

test('selectRawChild keeps prepare target on the raw root while opening the child path', () => {
  const state = selectRawChild('Raws/2026-news-1', 'Raws/2026-news-1/260603-gen');

  assert.equal(state.selectedPath, 'Raws/2026-news-1/260603-gen');
  assert.equal(state.selectedKind, 'raw');
  assert.equal(state.selectedRawSourcePath, 'Raws/2026-news-1');
});

test('buildPrepareTargetSummary shows the selected raw source name and path', () => {
  const summary = buildPrepareTargetSummary('Raws/2026-news-1');

  assert.equal(summary.name, '2026-news-1');
  assert.equal(summary.path, 'Raws/2026-news-1');
  assert.equal(summary.emptyMessage, null);
});

test('buildPrepareTargetSummary falls back to an empty-state message when nothing is selected', () => {
  const summary = buildPrepareTargetSummary(null);

  assert.equal(summary.name, null);
  assert.equal(summary.path, null);
  assert.equal(summary.emptyMessage, 'Select a raw source to prepare.');
});

test('getPrepareTargetName reads the last path segment', () => {
  assert.equal(getPrepareTargetName('Raws/2026-news-1'), '2026-news-1');
});
