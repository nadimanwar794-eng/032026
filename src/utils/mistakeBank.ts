import { storage } from './storage';

const MISTAKE_BANK_KEY = 'nst_mistake_bank_v1';

export interface MistakeEntry {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  topic?: string;
  chapterTitle?: string;
  subjectName?: string;
  classLevel?: string;
  board?: string;
  addedAt: number;
  lastSeenAt: number;
  attempts: number;
  source?: string;
}

const hashQuestion = (q: string, correctAnswer: number): string => {
  const norm = (q || '').replace(/\s+/g, ' ').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = ((hash << 5) - hash) + norm.charCodeAt(i);
    hash |= 0;
  }
  return `mst_${Math.abs(hash).toString(36)}_${correctAnswer}`;
};

export const getMistakeBank = async (): Promise<MistakeEntry[]> => {
  try {
    const items = await storage.getItem<MistakeEntry[]>(MISTAKE_BANK_KEY);
    if (Array.isArray(items) && items.length > 0) return items;
    // Fallback to localStorage if localforage returned empty/null
    return getMistakeBankSync();
  } catch {
    return getMistakeBankSync();
  }
};

export const getMistakeBankSync = (): MistakeEntry[] => {
  try {
    const raw = localStorage.getItem(MISTAKE_BANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeMistakeBank = async (items: MistakeEntry[]): Promise<void> => {
  // Always write to localStorage first (sync, reliable)
  try { localStorage.setItem(MISTAKE_BANK_KEY, JSON.stringify(items)); } catch {}
  // Also write to localforage (async, IndexedDB)
  try {
    await storage.setItem(MISTAKE_BANK_KEY, items);
  } catch (e) {
    console.error('writeMistakeBank localforage failed (localStorage backup used):', e);
  }
};

// Mutex-style queue to prevent race conditions on concurrent read-modify-write
let _writeQueue: Promise<void> = Promise.resolve();

const enqueue = (fn: () => Promise<void>): Promise<void> => {
  _writeQueue = _writeQueue.then(() => fn()).catch(() => fn());
  return _writeQueue;
};

export const addMistakes = (
  newItems: Array<Omit<MistakeEntry, 'id' | 'addedAt' | 'lastSeenAt' | 'attempts'>>
): Promise<number> => {
  if (!newItems || newItems.length === 0) return Promise.resolve(0);
  return enqueue(async () => {
    const existing = await getMistakeBank();
    const byId = new Map<string, MistakeEntry>();
    existing.forEach(e => byId.set(e.id, e));
    const now = Date.now();
    let added = 0;
    for (const raw of newItems) {
      if (!raw.question || !Array.isArray(raw.options) || raw.options.length < 2) continue;
      const id = hashQuestion(raw.question, raw.correctAnswer);
      if (byId.has(id)) {
        const prev = byId.get(id)!;
        byId.set(id, { ...prev, lastSeenAt: now, attempts: (prev.attempts || 0) + 1 });
      } else {
        byId.set(id, {
          id,
          question: raw.question,
          options: raw.options,
          correctAnswer: raw.correctAnswer,
          explanation: raw.explanation,
          topic: raw.topic,
          chapterTitle: raw.chapterTitle,
          subjectName: raw.subjectName,
          classLevel: raw.classLevel,
          board: raw.board,
          source: raw.source,
          addedAt: now,
          lastSeenAt: now,
          attempts: 1,
        });
        added++;
      }
    }
    await writeMistakeBank(Array.from(byId.values()));
    return added;
  }) as unknown as Promise<number>;
};

export const removeMistakes = (ids: string[]): Promise<void> => {
  if (!ids || ids.length === 0) return Promise.resolve();
  return enqueue(async () => {
    const existing = await getMistakeBank();
    const set = new Set(ids);
    await writeMistakeBank(existing.filter(e => !set.has(e.id)));
  });
};

export const removeMistakeByQuestion = (question: string, correctAnswer: number): Promise<void> => {
  const id = hashQuestion(question, correctAnswer);
  return removeMistakes([id]);
};

export const clearMistakeBank = (): Promise<void> => {
  return enqueue(async () => {
    await writeMistakeBank([]);
  });
};

export const getMistakeCount = (): number => {
  return getMistakeBankSync().length;
};
