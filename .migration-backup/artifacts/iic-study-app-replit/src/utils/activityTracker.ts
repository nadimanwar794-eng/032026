/**
 * Small, versioned local activity store for page-wise study analytics.
 *
 * This intentionally stays local for the first phase. The record shape is
 * user-scoped and content-scoped so it can be synced to Firebase later
 * without changing the card/viewer contract.
 */

export type StudyActivityMode =
  | 'READING'
  | 'WRITING'
  | 'MCQ'
  | 'PROJECTOR'
  | 'FLASHCARD'
  | 'QA'
  | 'PDF'
  | 'VIDEO'
  | 'AUDIO';

export interface McqQuestionAttempt {
  questionId: string;
  correct: boolean;
  seconds: number;
  attemptedAt: string;
}

export interface McqScoreAttempt {
  correct: number;
  total: number;
  seconds: number;
  attemptedAt: string;
}

export interface StudyActivityRecord {
  seconds: number;
  sessions: number;
  opens: number;
  lastOpenedAt?: string;
  lastCompletedAt?: string;
  activityCount: number;
  questionsSeen: number;
  questionsAttempted: number;
  correctAnswers: number;
  cardsSeen: number;
  knownCards: number;
  unknownCards: number;
  attempts: McqQuestionAttempt[];
  scoreHistory: McqScoreAttempt[];
  topic?: string;
  subject?: string;
  chapter?: string;
}

export type StudyActivityMap = Record<string, Partial<Record<StudyActivityMode, StudyActivityRecord>>>;

const VERSION = 1;
const KEY = (userId: string) => `nst_study_activity_v${VERSION}_${userId}`;

const emptyRecord = (): StudyActivityRecord => ({
  seconds: 0,
  sessions: 0,
  opens: 0,
  activityCount: 0,
  questionsSeen: 0,
  questionsAttempted: 0,
  correctAnswers: 0,
  cardsSeen: 0,
  knownCards: 0,
  unknownCards: 0,
  attempts: [],
  scoreHistory: [],
});

const normaliseRecord = (value: Partial<StudyActivityRecord> | undefined): StudyActivityRecord => {
  const base = emptyRecord();
  return {
    ...base,
    ...(value || {}),
    seconds: Math.max(0, Number(value?.seconds) || 0),
    sessions: Math.max(0, Number(value?.sessions) || 0),
    opens: Math.max(0, Number(value?.opens) || 0),
    activityCount: Math.max(0, Number(value?.activityCount) || 0),
    questionsSeen: Math.max(0, Number(value?.questionsSeen) || 0),
    questionsAttempted: Math.max(0, Number(value?.questionsAttempted) || 0),
    correctAnswers: Math.max(0, Number(value?.correctAnswers) || 0),
    cardsSeen: Math.max(0, Number(value?.cardsSeen) || 0),
    knownCards: Math.max(0, Number(value?.knownCards) || 0),
    unknownCards: Math.max(0, Number(value?.unknownCards) || 0),
    attempts: Array.isArray(value?.attempts) ? value!.attempts!.filter(item => item && typeof item === 'object').slice(-5) : [],
    scoreHistory: Array.isArray(value?.scoreHistory) ? value!.scoreHistory.filter(item => item && typeof item === 'object').slice(-5) : [],
  };
};

export const getStudyActivity = (userId: string, contentId: string): Partial<Record<StudyActivityMode, StudyActivityRecord>> => {
  if (!userId || !contentId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(userId)) || '{}') as StudyActivityMap;
    const raw = parsed?.[contentId];
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw).map(([mode, record]) => [mode, normaliseRecord(record)])
    ) as Partial<Record<StudyActivityMode, StudyActivityRecord>>;
  } catch {
    return {};
  }
};

const update = (
  userId: string,
  contentId: string,
  mode: StudyActivityMode,
  mutate: (record: StudyActivityRecord) => void,
): StudyActivityRecord => {
  const all: StudyActivityMap = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY(userId)) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  })();
  const current = normaliseRecord(all[contentId]?.[mode]);
  mutate(current);
  all[contentId] = { ...(all[contentId] || {}), [mode]: current };
  try { localStorage.setItem(KEY(userId), JSON.stringify(all)); } catch {}
  return current;
};

export const recordActivityOpen = (userId: string, contentId: string, mode: StudyActivityMode) =>
  update(userId, contentId, mode, record => {
    record.opens += 1;
    record.sessions += 1;
    record.activityCount += 1;
    record.lastOpenedAt = new Date().toISOString();
  });

export const setActivityMeta = (
  userId: string,
  contentId: string,
  mode: StudyActivityMode,
  meta: { topic?: string; subject?: string; chapter?: string },
) => update(userId, contentId, mode, record => {
  if (meta.topic) record.topic = meta.topic;
  if (meta.subject) record.subject = meta.subject;
  if (meta.chapter) record.chapter = meta.chapter;
});

export const recordActivitySeconds = (userId: string, contentId: string, mode: StudyActivityMode, seconds = 1) =>
  update(userId, contentId, mode, record => {
    record.seconds += Math.max(0, Math.floor(seconds));
  });

export const recordActivityComplete = (userId: string, contentId: string, mode: StudyActivityMode) =>
  update(userId, contentId, mode, record => {
    record.lastCompletedAt = new Date().toISOString();
  });

export const recordMcqAnswer = (
  userId: string,
  contentId: string,
  questionId: string,
  correct: boolean,
  seconds: number,
  meta?: { topic?: string; subject?: string; chapter?: string },
) => update(userId, contentId, 'MCQ', record => {
  record.questionsAttempted += 1;
  record.correctAnswers += correct ? 1 : 0;
  record.activityCount += 1;
  record.attempts = [
    ...record.attempts.filter(item => item.questionId !== questionId),
    { questionId, correct, seconds: Math.max(0, Math.round(seconds)), attemptedAt: new Date().toISOString() },
  ].slice(-5);
  if (meta?.topic) record.topic = meta.topic;
  if (meta?.subject) record.subject = meta.subject;
  if (meta?.chapter) record.chapter = meta.chapter;
});

export const recordProjectorAnswer = (
  userId: string,
  contentId: string,
  questionId: string,
  correct: boolean,
  seconds: number,
) => update(userId, contentId, 'PROJECTOR', record => {
  record.questionsAttempted += 1;
  record.correctAnswers += correct ? 1 : 0;
  record.activityCount += 1;
  record.sessions = Math.max(record.sessions, 1);
  record.lastOpenedAt = new Date().toISOString();
  record.attempts = [
    ...record.attempts.filter(item => item.questionId !== questionId),
    { questionId, correct, seconds: Math.max(0, Math.round(seconds)), attemptedAt: new Date().toISOString() },
  ].slice(-200);
});

export const recordMcqScore = (
  userId: string,
  contentId: string,
  correct: number,
  total: number,
  seconds: number,
  meta?: { topic?: string; subject?: string; chapter?: string },
) => update(userId, contentId, 'MCQ', record => {
  record.scoreHistory = [
    ...record.scoreHistory,
    { correct: Math.max(0, correct), total: Math.max(0, total), seconds: Math.max(0, Math.round(seconds)), attemptedAt: new Date().toISOString() },
  ].slice(-5);
  if (meta?.topic) record.topic = meta.topic;
  if (meta?.subject) record.subject = meta.subject;
  if (meta?.chapter) record.chapter = meta.chapter;
});

export const recordStudyMetric = (
  userId: string,
  contentId: string,
  mode: StudyActivityMode,
  metric: 'questionsSeen' | 'cardsSeen' | 'knownCards' | 'unknownCards',
  amount = 1,
) => update(userId, contentId, mode, record => {
  record[metric] += Math.max(0, Math.floor(amount));
  record.activityCount += 1;
});

export const formatActivityDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${(minutes % 60).toString().padStart(2, '0')}m`;
};

export const getStudyActivityKey = (lessonId: string, pageIndex: number) =>
  `${lessonId}__page_${pageIndex}`;

export interface StudyActivitySummary {
  topic: string;
  subject?: string;
  chapter?: string;
  seconds: Partial<Record<StudyActivityMode, number>>;
  sessions: Partial<Record<StudyActivityMode, number>>;
  mcq: {
    latest?: McqScoreAttempt;
    previous?: McqScoreAttempt;
    attempts: number;
    questionAttempts: number;
    correctAnswers: number;
    timings: number[];
  };
}

export const getStudyActivitySummary = (userId: string): StudyActivitySummary[] => {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(userId)) || '{}') as StudyActivityMap;
    const grouped = new Map<string, StudyActivitySummary>();
    Object.values(parsed || {}).forEach(content => {
      Object.values(content || {}).forEach(raw => {
        const record = normaliseRecord(raw);
        const topic = record.topic?.trim();
        if (!topic) return;
        const key = `${record.subject || ''}::${topic}`;
        const summary = grouped.get(key) || {
          topic,
          subject: record.subject,
          chapter: record.chapter,
          seconds: {},
          sessions: {},
          mcq: { attempts: 0, questionAttempts: 0, correctAnswers: 0, timings: [] },
        };
        if (record.subject) summary.subject = record.subject;
        if (record.chapter) summary.chapter = record.chapter;
        const mode = Object.entries(content || {}).find(([, value]) => value === raw)?.[0] as StudyActivityMode | undefined;
        if (mode) {
          summary.seconds[mode] = (summary.seconds[mode] || 0) + record.seconds;
          summary.sessions[mode] = (summary.sessions[mode] || 0) + record.sessions;
        }
        if (mode === 'MCQ') {
          const history = record.scoreHistory || [];
          summary.mcq.attempts += history.length;
          summary.mcq.latest = history.at(-1) || summary.mcq.latest;
          summary.mcq.previous = history.at(-2) || summary.mcq.previous;
          summary.mcq.questionAttempts += record.questionsAttempted;
          summary.mcq.correctAnswers += record.correctAnswers;
          summary.mcq.timings = [...summary.mcq.timings, ...record.attempts.map(item => item.seconds)].slice(-5);
        }
        grouped.set(key, summary);
      });
    });
    return [...grouped.values()].sort((a, b) => (b.mcq.latest?.attemptedAt || '').localeCompare(a.mcq.latest?.attemptedAt || ''));
  } catch {
    return [];
  }
};