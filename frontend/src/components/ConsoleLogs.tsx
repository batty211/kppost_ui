import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';

import type { CommandLog } from '../types/app';

interface ConsoleLogsProps {
  logs: CommandLog[];
  setLogs: React.Dispatch<React.SetStateAction<CommandLog[]>>;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ConsoleLogs({ logs, setLogs, isExpanded, setIsExpanded }: ConsoleLogsProps) {
  return (
    <section className="shrink-0 border-t border-white/5 bg-[#050816]/90 px-5 py-3 backdrop-blur-sm">
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-3' : ''}`}>
        <button
          onClick={() => setIsExpanded((value) => !value)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-200"
          aria-expanded={isExpanded}
        >
          <Terminal size={16} />
          Console Output
          <span className="text-xs font-normal text-gray-500">({logs.length})</span>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {isExpanded && (
          <button
            onClick={() => setLogs([])}
            className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 transition-colors hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/35 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center italic text-gray-600">No output...</div>
          ) : (
            <div className="custom-scrollbar max-h-48 divide-y divide-white/5 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="space-y-2 p-4">
                  <div className="flex items-center justify-between text-gray-500">
                    <div className="flex gap-4">
                      <span><span className="text-gray-600">CWD:</span> {log.cwd}</span>
                      <span><span className="text-gray-600">CMD:</span> {log.command}</span>
                    </div>
                    <span className={log.returncode === 0 ? 'text-green-500' : 'text-red-500'}>
                      EXIT {log.returncode}
                    </span>
                  </div>
                  {log.stdout && <pre className="whitespace-pre-wrap text-green-400/80">{log.stdout}</pre>}
                  {log.stderr && <pre className="whitespace-pre-wrap text-red-400">{log.stderr}</pre>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
