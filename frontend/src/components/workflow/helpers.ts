import axios from 'axios';

import { API_BASE } from '../../lib/api';

export async function reorderBackendImages(batchName: string, order: string[], postName?: string) {
  try {
    const url = postName
      ? `${API_BASE}/batches/${batchName}/reorder?post_name=${postName}`
      : `${API_BASE}/batches/${batchName}/reorder`;
    await axios.post(url, { order });
    return true;
  } catch (err) {
    console.error('Reorder failed:', err);
    return false;
  }
}
