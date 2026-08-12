import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Lesson, Note, BackupData, IDBStats } from '../types';

interface NotebookDBSchema extends DBSchema {
  lessons: {
    key: string;
    value: Lesson;
    indexes: { 'by-created': number; 'by-updated': number };
  };
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-lesson': string;
      'by-created': number;
      'by-updated': number;
      'by-pinned': number;
    };
  };
}

const DB_NAME = 'NotebookAppDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NotebookDBSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<NotebookDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Lessons Store
        if (!db.objectStoreNames.contains('lessons')) {
          const lessonStore = db.createObjectStore('lessons', { keyPath: 'id' });
          lessonStore.createIndex('by-created', 'createdAt');
          lessonStore.createIndex('by-updated', 'updatedAt');
        }

        // Notes Store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('by-lesson', 'lessonId');
          noteStore.createIndex('by-created', 'createdAt');
          noteStore.createIndex('by-updated', 'updatedAt');
          noteStore.createIndex('by-pinned', 'isPinned');
        }
      },
    });
  }
  return dbPromise;
}

// Initial Sample Data Generator if database is empty
export async function seedInitialDataIfNeeded(): Promise<void> {
  const db = await getDB();
  const lessonCount = await db.count('lessons');

  if (lessonCount === 0) {
    const now = Date.now();
    const sampleLessons: Lesson[] = [
      {
        id: 'lesson-1',
        name: 'Lesson 1: Introduction to Web Development',
        category: 'Computer Science',
        description: 'Fundamentals of HTML5, CSS3, JavaScript ES6+ and modern frameworks.',
        color: '#3b82f6', // blue
        createdAt: now - 86400000 * 3,
        updatedAt: now - 86400000 * 3,
      },
      {
        id: 'lesson-2',
        name: 'Lesson 2: Physics - Laws of Motion & Energy',
        category: 'Science',
        description: 'Newtonian mechanics, conservation of energy, work, and dynamics.',
        color: '#10b981', // green
        createdAt: now - 86400000 * 2,
        updatedAt: now - 86400000 * 2,
      },
      {
        id: 'lesson-3',
        name: 'Lesson 3: General Knowledge & Current Affairs',
        category: 'General',
        description: 'Important facts, history timeline, and daily revisions.',
        color: '#8b5cf6', // purple
        createdAt: now - 86400000 * 1,
        updatedAt: now - 86400000 * 1,
      },
    ];

    const sampleNotes: Note[] = [
      {
        id: 'note-101',
        lessonId: 'lesson-1',
        title: 'HTML5 Semantic Elements & Accessibility',
        content: `# Key HTML5 Elements
- \`<header>\`: Container for introductory content or navigation links.
- \`<main>\`: Specifies the main content of a document.
- \`<article>\`: Represents self-contained composition.
- \`<section>\`: Standalone section of functionality.

### Best Practices for Accessibility (a11y)
1. Always use proper ARIA labels when custom controls are needed.
2. Ensure high contrast ratio for readable body text (minimum 4.5:1).
3. Use semantic tags instead of generic \`<div>\` for screen reader compatibility.`,
        tags: ['HTML5', 'WebDev', 'Important'],
        isPinned: true,
        isFavorite: true,
        createdAt: now - 86400000 * 3 + 3600000,
        updatedAt: now - 86400000 * 3 + 3600000,
      },
      {
        id: 'note-102',
        lessonId: 'lesson-1',
        title: 'JavaScript Promises & Async/Await',
        content: `## Asynchronous Programming
JavaScript uses an event loop to handle non-blocking asynchronous operations.

\`\`\`javascript
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
\`\`\`

**Key Points:**
* Promises have 3 states: *Pending*, *Fulfilled*, *Rejected*.
* \`async/await\` provides cleaner syntax over chaining \`.then()\`.`,
        tags: ['JavaScript', 'Async', 'Code'],
        isPinned: false,
        isFavorite: true,
        createdAt: now - 86400000 * 2.5,
        updatedAt: now - 86400000 * 2.5,
      },
      {
        id: 'note-201',
        lessonId: 'lesson-2',
        title: "Newton's Three Laws of Motion",
        content: `### 1st Law (Law of Inertia)
An object at rest stays at rest, and an object in motion stays in motion unless acted upon by an external net force.

### 2nd Law (Force & Acceleration)
**F = m × a**
- Force ($F$) is in Newtons ($N$)
- Mass ($m$) is in kilograms ($kg$)
- Acceleration ($a$) is in $m/s^2$

### 3rd Law (Action & Reaction)
For every action, there is an equal and opposite reaction.`,
        tags: ['Physics', 'Formulas', 'ExamPrep'],
        isPinned: true,
        isFavorite: false,
        createdAt: now - 86400000 * 2 + 1800000,
        updatedAt: now - 86400000 * 2 + 1800000,
      },
      {
        id: 'note-301',
        lessonId: 'lesson-3',
        title: 'Important Indian Constitution Articles to Remember',
        content: `* **Article 14**: Equality before law.
* **Article 19**: Protection of certain rights regarding freedom of speech, etc.
* **Article 21**: Protection of life and personal liberty.
* **Article 32**: Remedies for enforcement of rights (Heart and soul of the Constitution).`,
        tags: ['Polity', 'GK', 'Revision'],
        isPinned: false,
        isFavorite: false,
        createdAt: now - 86400000 * 1 + 7200000,
        updatedAt: now - 86400000 * 1 + 7200000,
      },
    ];

    const tx = db.transaction(['lessons', 'notes'], 'readwrite');
    for (const lesson of sampleLessons) {
      await tx.objectStore('lessons').add(lesson);
    }
    for (const note of sampleNotes) {
      await tx.objectStore('notes').add(note);
    }
    await tx.done;
  }
}

// Lesson CRUD Operations
export async function getAllLessons(): Promise<Lesson[]> {
  const db = await getDB();
  const lessons = await db.getAll('lessons');
  return lessons.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveLesson(lesson: Lesson): Promise<void> {
  const db = await getDB();
  await db.put('lessons', lesson);
}

export async function deleteLesson(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['lessons', 'notes'], 'readwrite');
  await tx.objectStore('lessons').delete(id);
  
  // Delete all notes belonging to this lesson
  const noteIndex = tx.objectStore('notes').index('by-lesson');
  let cursor = await noteIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Note CRUD Operations
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  return await db.getAll('notes');
}

export async function getNotesByLesson(lessonId: string): Promise<Note[]> {
  const db = await getDB();
  return await db.getAllFromIndex('notes', 'by-lesson', lessonId);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

// Database Stats & Management
export async function getDBStats(): Promise<IDBStats> {
  const db = await getDB();
  const lessonsCount = await db.count('lessons');
  const notesCount = await db.count('notes');
  
  let estimatedBytes = 0;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      estimatedBytes = estimate.usage || 0;
    } catch {
      estimatedBytes = 0;
    }
  }

  return { lessonsCount, notesCount, estimatedBytes };
}

export async function exportDatabase(): Promise<BackupData> {
  const lessons = await getAllLessons();
  const notes = await getAllNotes();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    lessons,
    notes,
  };
}

export async function importDatabase(data: BackupData): Promise<void> {
  if (!data.lessons || !data.notes || !Array.isArray(data.lessons) || !Array.isArray(data.notes)) {
    throw new Error('Invalid backup file format');
  }

  const db = await getDB();
  const tx = db.transaction(['lessons', 'notes'], 'readwrite');
  
  // Clear existing
  await tx.objectStore('lessons').clear();
  await tx.objectStore('notes').clear();

  // Insert imported
  for (const lesson of data.lessons) {
    await tx.objectStore('lessons').put(lesson);
  }
  for (const note of data.notes) {
    await tx.objectStore('notes').put(note);
  }

  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['lessons', 'notes'], 'readwrite');
  await tx.objectStore('lessons').clear();
  await tx.objectStore('notes').clear();
  await tx.done;
}
