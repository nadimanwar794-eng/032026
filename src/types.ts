export interface Lesson {
  id: string;
  name: string;
  category?: string;
  description?: string;
  color: string; // TailWind color code or hex string
  icon?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export interface Note {
  id: string;
  lessonId: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export type SortOrder = 'newest' | 'oldest' | 'updated' | 'alphabetical';

export interface FilterOptions {
  searchQuery: string;
  selectedLessonId: string | 'all' | 'favorites' | 'pinned';
  selectedTag: string | null;
  sortBy: SortOrder;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  lessons: Lesson[];
  notes: Note[];
}

export interface IDBStats {
  lessonsCount: number;
  notesCount: number;
  estimatedBytes: number;
}
