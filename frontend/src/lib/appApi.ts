import axios from 'axios';

import { API_BASE } from './api';
import type { CommandLog, RawPostCreateRequest } from '../types/app';

export async function fetchConfig() {
  const res = await axios.get(`${API_BASE}/config`);
  return res.data;
}

export async function fetchBatches() {
  const res = await axios.get(`${API_BASE}/batches`);
  return res.data;
}

export async function fetchWorkspace() {
  const res = await axios.get(`${API_BASE}/workspace`);
  return res.data;
}

export async function fetchCliInfo(forceRemote = false) {
  const endpoint = forceRemote ? 'info' : 'status';
  const res = await axios.get(`${API_BASE}/cli/${endpoint}`);
  return res.data;
}

export async function fetchBatchDetails(name: string) {
  const res = await axios.get(`${API_BASE}/workspace/nodes/${name}`);
  return res.data;
}

export async function installCli() {
  const res = await axios.post(`${API_BASE}/cli/install`);
  return res.data;
}

export async function updateCli() {
  const res = await axios.post(`${API_BASE}/cli/update`);
  return res.data;
}

export async function renameBatch(batchName: string, newName: string) {
  await axios.patch(`${API_BASE}/batches/${batchName}`, { new_name: newName });
}

export async function createRawSource(folderName: string) {
  const res = await axios.post(`${API_BASE}/workspace/raws`, { folder_name: folderName });
  return res.data;
}

export async function fetchWorkspaceDepartments() {
  const res = await axios.get(`${API_BASE}/workspace/departments`);
  return res.data;
}

export async function saveWorkspaceDepartments(departments: unknown) {
  const res = await axios.put(`${API_BASE}/workspace/departments`, departments);
  return res.data;
}

export async function createRawPost(workspacePath: string, payload: RawPostCreateRequest) {
  const res = await axios.post(`${API_BASE}/raws/${workspacePath}/posts`, payload);
  return res.data;
}

export async function browseFolder() {
  const res = await axios.get(`${API_BASE}/browse`);
  return res.data;
}

export async function saveConfig(config: unknown) {
  const res = await axios.post(`${API_BASE}/config`, config);
  return res.data;
}

export async function uploadBatchImage(batchName: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  await axios.post(`${API_BASE}/batches/${batchName}/images`, formData);
}

export async function deleteBatchImage(batchName: string, imageName: string) {
  await axios.delete(`${API_BASE}/batches/${batchName}/images/${imageName}`);
}

export async function updateBatchContent(workspacePath: string, content: string) {
  await axios.put(`${API_BASE}/batches/${workspacePath}`, { content });
}

export async function exportCanvaBatch(batchPath: string): Promise<CommandLog> {
  const formData = new FormData();
  formData.append('batch_path', batchPath);
  const res = await axios.post(`${API_BASE}/canva/export`, formData);
  return res.data;
}

export async function importCanvaBatch(
  batchPath: string,
  featureZip: File,
  newsWatermarkZip: File,
): Promise<CommandLog> {
  const formData = new FormData();
  formData.append('batch_path', batchPath);
  formData.append('feature_zip', featureZip);
  formData.append('news_watermark_zip', newsWatermarkZip);
  const res = await axios.post(`${API_BASE}/canva/import`, formData);
  return res.data;
}
