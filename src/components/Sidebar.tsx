import React, { useState } from 'react';
import { 
  BookOpen, 
  FolderPlus, 
  Star, 
  Pin, 
  Clock, 
  Tag, 
  ChevronRight, 
  Edit3, 
  Trash2, 
  Layers,
  Search,
  CheckCircle2
} from 'lucide-react';
import { Lesson, Note, FilterOptions } from '../types';

interface SidebarProps {
  lessons: Lesson[];
  notes: Note[];
  filter: FilterOptions;
  onSelectFilter: (lessonId: string | 'all' | 'favorites' | 'pinned') => void;
  onSelectTag: (tag: string | null) => void;
  onOpenCreateLesson: () => void;
  onOpenEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lessons,
  notes,
  filter,
  onSelectFilter,
  onSelectTag,
  onOpenCreateLesson,
  onOpenEditLesson,
  onDeleteLesson,
}) => {
  const [lessonSearch, setLessonSearch] = useState('');

  // Extract all unique tags across all notes
  const allTags = Array.from(
    new Set(notes.flatMap((note) => note.tags || []))
  ).filter(Boolean);

  // Note counts calculation
  const getLessonNoteCount = (lessonId: string) =>
    notes.filter((note) => note.lessonId === lessonId).length;

  const favoriteCount = notes.filter((n) => n.isFavorite).length;
  const pinnedCount = notes.filter((n) => n.isPinned).length;

  const filteredLessons = lessons.filter(
    (l) =>
      l.name.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      (l.category && l.category.toLowerCase().includes(lessonSearch.toLowerCase()))
  );

  return (
    <aside className="w-full lg:w-72 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-[calc(100vh-4rem)] sticky top-16 select-none shrink-0">
      {/* Navigation Quick Filters */}
      <div className="p-3 border-b border-slate-800/80 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          Views & Filters
        </div>

        <button
          onClick={() => {
            onSelectFilter('all');
            onSelectTag(null);
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
            filter.selectedLessonId === 'all' && filter.selectedTag === null
              ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>All Lessons & Notes</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
            {notes.length}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectFilter('favorites');
            onSelectTag(null);
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
            filter.selectedLessonId === 'favorites'
              ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <span>Starred / Favorites</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
            {favoriteCount}
          </span>
        </button>

        <button
          onClick={() => {
            onSelectFilter('pinned');
            onSelectTag(null);
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
            filter.selectedLessonId === 'pinned'
              ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Pin className="w-4 h-4 text-purple-400" />
            <span>Pinned Notes</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
            {pinnedCount}
          </span>
        </button>
      </div>

      {/* Lessons Section Header */}
      <div className="p-3 pb-1 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            Lessons ({lessons.length})
          </span>
        </div>
        <button
          onClick={onOpenCreateLesson}
          className="p-1 hover:bg-indigo-600/20 text-indigo-400 rounded-md transition hover:text-indigo-300"
          title="Create New Lesson"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Lesson Search Input */}
      {lessons.length > 5 && (
        <div className="px-3 py-2 border-b border-slate-800/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={lessonSearch}
              onChange={(e) => setLessonSearch(e.target.value)}
              placeholder="Filter lessons..."
              className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Lessons List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {filteredLessons.length === 0 ? (
          <div className="text-center py-6 px-3">
            <p className="text-xs text-slate-500 mb-2">No lessons created yet.</p>
            <button
              onClick={onOpenCreateLesson}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Create Lesson 1</span>
            </button>
          </div>
        ) : (
          filteredLessons.map((lesson) => {
            const isSelected = filter.selectedLessonId === lesson.id;
            const count = getLessonNoteCount(lesson.id);

            return (
              <div
                key={lesson.id}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-slate-800 text-white font-medium border border-indigo-500/40 shadow-sm'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
                onClick={() => {
                  onSelectFilter(lesson.id);
                  onSelectTag(null);
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: lesson.color || '#3b82f6' }}
                  />
                  <div className="truncate">
                    <p className="truncate text-slate-200 font-medium group-hover:text-white">
                      {lesson.name}
                    </p>
                    {lesson.category && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {lesson.category}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-mono text-slate-400">
                    {count}
                  </span>

                  {/* Actions on hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditLesson(lesson);
                      }}
                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 rounded"
                      title="Edit Lesson"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLesson(lesson.id);
                      }}
                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded"
                      title="Delete Lesson"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tags Filter Section */}
      {allTags.length > 0 && (
        <div className="p-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" /> Filter by Tags
            </span>
            {filter.selectedTag && (
              <button
                onClick={() => onSelectTag(null)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
            {allTags.map((tag) => {
              const isSelected = filter.selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => onSelectTag(isSelected ? null : tag)}
                  className={`px-2 py-0.5 rounded-md text-[11px] transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/40">
        <span className="flex items-center gap-1 text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          IndexedDB Synced
        </span>
        <button
          onClick={onOpenCreateLesson}
          className="text-indigo-400 hover:text-indigo-300 font-medium"
        >
          + Add Lesson
        </button>
      </div>
    </aside>
  );
};
