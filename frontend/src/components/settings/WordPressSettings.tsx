import { useEffect, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../../lib/api';
import type { WordPressConfig } from '../../types/app';

const DEFAULT_WP_CONFIG: WordPressConfig = {
  WP_URL: '',
  WP_USERNAME: '',
  WP_APPLICATION_PASSWORD: '',
};

export function WordPressSettings() {
  const [wpConfig, setWpConfig] = useState<WordPressConfig>(DEFAULT_WP_CONFIG);

  const fetchWpConfig = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config/wp`);
      setWpConfig(response.data);
    } catch (error) {
      console.error('Error fetching WP config', error);
    }
  };

  const handleSaveWpConfig = async () => {
    try {
      await axios.post(`${API_BASE}/config/wp`, wpConfig);
      alert('WordPress settings saved!');
    } catch {
      alert('Error saving WordPress settings');
    }
  };

  useEffect(() => {
    void fetchWpConfig();
  }, []);

  return (
    <div className="mt-8 space-y-8 bg-gray-900 border border-gray-800 p-8 rounded-2xl">
      <h3 className="text-lg font-bold">WordPress Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">WordPress URL</label>
          <input
            type="text"
            value={wpConfig.WP_URL}
            onChange={(event) => setWpConfig({ ...wpConfig, WP_URL: event.target.value })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Username</label>
          <input
            type="text"
            value={wpConfig.WP_USERNAME}
            onChange={(event) => setWpConfig({ ...wpConfig, WP_USERNAME: event.target.value })}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Application Password</label>
          <input
            type="password"
            value={wpConfig.WP_APPLICATION_PASSWORD}
            onChange={(event) =>
              setWpConfig({ ...wpConfig, WP_APPLICATION_PASSWORD: event.target.value })
            }
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSaveWpConfig}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold transition-all"
        >
          Save WordPress Credentials
        </button>
      </div>
    </div>
  );
}
