import axios from 'axios';

import { API_BASE } from '../lib/api';
import { getErrorMessage } from '../lib/errorMessage';
import type { CommandLog } from '../types/app';

export async function runCLICommand(command: string, args: string[]): Promise<CommandLog> {
  try {
    const res = await axios.post(`${API_BASE}/commands/${command}`, { args });
    return res.data;
  } catch (error) {
    return {
      stdout: '',
      stderr: getErrorMessage(error),
      returncode: 1,
      command: `${command} ${args.join(' ')}`,
    };
  }
}
