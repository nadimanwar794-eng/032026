import React from 'react';
import { BookOpen, Database, Plus, Download, HardDrive, Search, Sparkles } from 'lucide-react';
import { IDBStats } from '../types';
import { formatBytes } from '../lib/utils';

interface NavbarProps {
  stats: IDBStats;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCreateLesson: () => void;
  onOpenCreateNote: () => void;
  onOpenBackupModal: () => void;
  activeLessonName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  searchQuery,
  onSearchChange,
  onOpenCreateLesson,
  onOpenCreateNote,
  onOpenBackupModal,
  activeLessonName,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight leading-none">
                  Lesson Notebook
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Database className="w-3 h-3" /> IndexedDB Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 hidden md:block">
                Unlimited local storage • Organized lesson-wise
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search notes across ${stats.lessonsCount} lessons or tags...`}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* IDB Storage Indicator */}
            <button
              onClick={onOpenBackupModal}
              title="View IndexedDB Storage & Backup Options"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>{stats.notesCount} Notes</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{formatBytes(stats.estimatedBytes)}</span>
            </button>

            {/* Backup / Export Button */}
            <button
              onClick={onOpenBackupModal}
              title="Backup & Restore IndexedDB Data"
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Create Lesson */}
            <button
              onClick={onOpenCreateLesson}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Lesson</span>
            </button>

            {/* Create Note */}
            <button
              onClick={onOpenCreateNote}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Note</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="pb-3 md:hidden">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes, lessons or tags..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
