import React, { useEffect, useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  SortAsc, 
  FolderPlus, 
  Pin, 
  Star, 
  FileText, 
  Trash2, 
  Edit3, 
  Sparkles,
  Layers,
  Database
} from 'lucide-react';
import { Lesson, Note, FilterOptions, SortOrder, IDBStats } from './types';
import { 
  seedInitialDataIfNeeded, 
  getAllLessons, 
  getAllNotes, 
  saveLesson, 
  deleteLesson, 
  saveNote, 
  deleteNote, 
  getDBStats 
} from './lib/db';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { NoteCard } from './components/NoteCard';
import { NoteEditor } from './components/NoteEditor';
import { LessonModal } from './components/LessonModal';
import { BackupModal } from './components/BackupModal';

export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dbStats, setDbStats] = useState<IDBStats>({ lessonsCount: 0, notesCount: 0, estimatedBytes: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filter, setFilter] = useState<FilterOptions>({
    searchQuery: '',
    selectedLessonId: 'all',
    selectedTag: null,
    sortBy: 'newest',
  });

  // Modal visibility states
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Load IndexedDB data
  const refreshData = async () => {
    try {
      await seedInitialDataIfNeeded();
      const loadedLessons = await getAllLessons();
      const loadedNotes = await getAllNotes();
      const loadedStats = await getDBStats();

      setLessons(loadedLessons);
      setNotes(loadedNotes);
      setDbStats(loadedStats);
    } catch (err) {
      console.error('IndexedDB loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Lesson actions
  const handleSaveLesson = async (lesson: Lesson) => {
    await saveLesson(lesson);
    await refreshData();
    // Select newly created lesson
    setFilter((prev) => ({ ...prev, selectedLessonId: lesson.id }));
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (window.confirm('Are you sure you want to delete this lesson and ALL notes inside it?')) {
      await deleteLesson(lessonId);
      await refreshData();
      if (filter.selectedLessonId === lessonId) {
        setFilter((prev) => ({ ...prev, selectedLessonId: 'all' }));
      }
    }
  };

  // Note actions
  const handleSaveNote = async (note: Note) => {
    await saveNote(note);
    await refreshData();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId);
      await refreshData();
    }
  };

  const handleTogglePin = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (target) {
      const updated = { ...target, isPinned: !target.isPinned, updatedAt: Date.now() };
      await saveNote(updated);
      await refreshData();
    }
  };

  const handleToggleFavorite = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (target) {
      const updated = { ...target, isFavorite: !target.isFavorite, updatedAt: Date.now() };
      await saveNote(updated);
      await refreshData();
    }
  };

  // Filtered and Sorted Notes calculation
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        // Lesson ID filter
        if (filter.selectedLessonId === 'favorites') {
          if (!note.isFavorite) return false;
        } else if (filter.selectedLessonId === 'pinned') {
          if (!note.isPinned) return false;
        } else if (filter.selectedLessonId !== 'all') {
          if (note.lessonId !== filter.selectedLessonId) return false;
        }

        // Tag filter
        if (filter.selectedTag) {
          if (!note.tags || !note.tags.includes(filter.selectedTag)) return false;
        }

        // Search query filter
        if (filter.searchQuery.trim()) {
          const q = filter.searchQuery.toLowerCase();
          const matchTitle = note.title.toLowerCase().includes(q);
          const matchContent = note.content.toLowerCase().includes(q);
          const matchTag = note.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchContent && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned notes always come first unless sorted specifically
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

        if (filter.sortBy === 'newest') return b.createdAt - a.createdAt;
        if (filter.sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (filter.sortBy === 'updated') return b.updatedAt - a.updatedAt;
        if (filter.sortBy === 'alphabetical') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [notes, filter]);

  // Active Lesson Detail
  const activeLesson = useMemo(() => {
    if (filter.selectedLessonId === 'all' || filter.selectedLessonId === 'favorites' || filter.selectedLessonId === 'pinned') {
      return null;
    }
    return lessons.find((l) => l.id === filter.selectedLessonId) || null;
  }, [lessons, filter.selectedLessonId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Navbar */}
      <Navbar
        stats={dbStats}
        searchQuery={filter.searchQuery}
        onSearchChange={(q) => setFilter((prev) => ({ ...prev, searchQuery: q }))}
        onOpenCreateLesson={() => {
          setEditingLesson(null);
          setIsLessonModalOpen(true);
        }}
        onOpenCreateNote={() => {
          setEditingNote(null);
          setIsNoteEditorOpen(true);
        }}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        activeLessonName={activeLesson ? activeLesson.name : 'All Lessons'}
      />

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        
        {/* Sidebar */}
        <Sidebar
          lessons={lessons}
          notes={notes}
          filter={filter}
          onSelectFilter={(lessonId) => setFilter((prev) => ({ ...prev, selectedLessonId: lessonId }))}
          onSelectTag={(tag) => setFilter((prev) => ({ ...prev, selectedTag: tag }))}
          onOpenCreateLesson={() => {
            setEditingLesson(null);
            setIsLessonModalOpen(true);
          }}
          onOpenEditLesson={(lesson) => {
            setEditingLesson(lesson);
            setIsLessonModalOpen(true);
          }}
          onDeleteLesson={handleDeleteLesson}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          
          {/* Header Banner for Current Active View / Lesson */}
          <div className="mb-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {activeLesson ? (
                  <>
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: activeLesson.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      {activeLesson.category || 'Lesson Topic'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {filter.selectedLessonId === 'favorites'
                      ? 'Starred Notes'
                      : filter.selectedLessonId === 'pinned'
                      ? 'Pinned Notes'
                      : 'All Lessons Notebook'}
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {activeLesson
                  ? activeLesson.name
                  : filter.selectedLessonId === 'favorites'
                  ? 'Starred & Favorite Notes'
                  : filter.selectedLessonId === 'pinned'
                  ? 'Pinned Quick Notes'
                  : 'All Saved Notes'}
              </h2>

              {activeLesson?.description && (
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {activeLesson.description}
                </p>
              )}

              {filter.selectedTag && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs">
                  Filtering by Tag: #{filter.selectedTag}
                  <button
                    onClick={() => setFilter((prev) => ({ ...prev, selectedTag: null }))}
                    className="hover:text-white font-bold ml-1"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Sorting dropdown */}
            <div className="flex items-center gap-3 shrink-0">
              
              {/* Sort By selector */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                <SortAsc className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filter.sortBy}
                  onChange={(e) => setFilter((prev) => ({ ...prev, sortBy: e.target.value as SortOrder }))}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-slate-900">Newest First</option>
                  <option value="oldest" className="bg-slate-900">Oldest First</option>
                  <option value="updated" className="bg-slate-900">Recently Updated</option>
                  <option value="alphabetical" className="bg-slate-900">Title (A-Z)</option>
                </select>
              </div>

              {/* Add Note Button */}
              <button
                onClick={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Note</span>
              </button>
            </div>
          </div>

          {/* Notes Grid */}
          {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading IndexedDB storage...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">No notes found</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {filter.searchQuery
                  ? `No notes match "${filter.searchQuery}". Try a different keyword.`
                  : activeLesson
                  ? `No notes added to "${activeLesson.name}" yet.`
                  : 'Start adding your study notes, formulas, or lesson summaries.'}
              </p>
              <button
                onClick={() => {
                  setEditingNote(null);
                  setIsNoteEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Note</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => {
                const noteLesson = lessons.find((l) => l.id === note.lessonId);
                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    lesson={noteLesson}
                    onEdit={(selectedNote) => {
                      setEditingNote(selectedNote);
                      setIsNoteEditorOpen(true);
                    }}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectTag={(tag) => setFilter((prev) => ({ ...prev, selectedTag: tag }))}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <NoteEditor
        isOpen={isNoteEditorOpen}
        onClose={() => {
          setIsNoteEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        lessons={lessons}
        existingNote={editingNote}
        defaultLessonId={filter.selectedLessonId}
      />

      <LessonModal
        isOpen={isLessonModalOpen}
        onClose={() => {
          setIsLessonModalOpen(false);
          setEditingLesson(null);
        }}
        onSave={handleSaveLesson}
        existingLesson={editingLesson}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        stats={dbStats}
        onDataChanged={refreshData}
      />
    </div>
  );
}
