import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2 } from 'lucide-react';

import { fetchWorkspaceDepartments, saveWorkspaceDepartments } from '../lib/appApi';
import { getErrorMessage } from '../lib/errorMessage';
import type { DepartmentsFile } from '../types/app';
import axios from 'axios';
import { API_BASE } from '../lib/api';

interface DepartmentsEditorProps {
  batchName?: string;
  workspaceLevel?: boolean;
  title?: string;
  onSaved?: () => void | Promise<void>;
}

export function DepartmentsEditor({
  batchName,
  workspaceLevel,
  title = 'departments.json',
  onSaved,
}: DepartmentsEditorProps) {
  const [depts, setDepts] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState('');

  const fetchDepts = useCallback(async () => {
    try {
      if (workspaceLevel) {
        const data = await fetchWorkspaceDepartments();
        setDepts(JSON.stringify(data, null, 2));
        return;
      }
      const res = await axios.get<DepartmentsFile>(`${API_BASE}/batches/${batchName}/departments`);
      setDepts(JSON.stringify(res.data, null, 2));
    } catch (error) {
      console.error('Error fetching depts', error);
    }
  }, [batchName, workspaceLevel]);

  useEffect(() => {
    void fetchDepts();
  }, [fetchDepts]);

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(depts ?? '') as DepartmentsFile;
      if (workspaceLevel) {
        await saveWorkspaceDepartments(parsed);
      } else {
        await axios.put(`${API_BASE}/batches/${batchName}/departments`, parsed);
      }
      alert('Departments updated!');
      setJsonError('');
      if (onSaved) {
        await onSaved();
      }
    } catch (error) {
      setJsonError(getErrorMessage(error, 'Invalid JSON'));
    }
  };

  if (!depts) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-300">{title}</h3>
        <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-bold">
          <Save size={12} /> Save
        </button>
      </div>
      <textarea
        value={depts}
        onChange={(e) => setDepts(e.target.value)}
        className="w-full h-64 bg-gray-950 font-mono text-xs border border-gray-800 rounded p-4 text-gray-300 focus:ring-1 focus:ring-blue-600"
      />
      {jsonError && <div className="text-red-500 text-xs">{jsonError}</div>}
    </div>
  );
}
