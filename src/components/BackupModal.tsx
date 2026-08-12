import React, { useState } from 'react';
import { 
  X, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { IDBStats, BackupData } from '../types';
import { exportDatabase, importDatabase, clearAllData } from '../lib/db';
import { formatBytes } from '../lib/utils';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: IDBStats;
  onDataChanged: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  stats,
  onDataChanged,
}) => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const data = await exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lesson-notebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ text: 'Backup downloaded successfully!', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: 'Failed to export backup data.', type: 'error' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData: BackupData = JSON.parse(content);
        await importDatabase(parsedData);
        setStatusMessage({ text: 'Database restored successfully!', type: 'success' });
        onDataChanged();
      } catch (err: any) {
        setStatusMessage({ text: err.message || 'Invalid backup file.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    try {
      await clearAllData();
      setStatusMessage({ text: 'Database cleared.', type: 'success' });
      setShowClearConfirm(false);
      onDataChanged();
    } catch (err) {
      setStatusMessage({ text: 'Failed to clear database.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">IndexedDB Manager</h3>
              <p className="text-xs text-slate-400">Client-side offline database statistics & backup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* IndexedDB Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 text-center">
              <span className="block text-xl font-bold text-slate-100">{stats.lessonsCount}</span>
              <span className="text-[11px] text-slate-400">Lessons</span>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 text-center">
              <span className="block text-xl font-bold text-indigo-400">{stats.notesCount}</span>
              <span className="text-[11px] text-slate-400">Notes</span>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 text-center">
              <span className="block text-xl font-bold text-emerald-400">
                {formatBytes(stats.estimatedBytes)}
              </span>
              <span className="text-[11px] text-slate-400">Storage Used</span>
            </div>
          </div>

          {/* Explanatory banner */}
          <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Why IndexedDB?
            </div>
            <p className="text-slate-400 leading-relaxed">
              IndexedDB provides high-capacity client-side browser storage (typically up to hundreds of megabytes or gigabytes), allowing you to save virtually unlimited notes, lessons, code snippets, and study material offline.
            </p>
          </div>

          {/* Export & Import Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Data Portability
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {/* Download Export */}
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 p-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium transition"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON Backup</span>
              </button>

              {/* Import File */}
              <label className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium cursor-pointer transition">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Import JSON Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset / Clear Data */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center gap-2 p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-medium transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Lessons & Notes</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2">
                <p className="text-xs text-rose-200 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  Are you sure? This will delete all IndexedDB records!
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAll}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Yes, Wipe All Data
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
