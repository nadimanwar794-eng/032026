import { ClassLevel, Board, Stream, MCQItem, SystemSettings } from '../types';
import { getSubjectsList } from '../constants';
import { sanitizeChallengeQuestions } from './challengeMcq';

const pad = (value: number) => String(value).padStart(2, '0');

export const getChallengeDateKey = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Daily challenges stay available until the next local midnight. */
export const getChallengeExpiryDate = (date = new Date()): Date => {
  const expiry = new Date(date);
  expiry.setHours(24, 0, 0, 0);
  return expiry;
};

export const isDailyChallenge20 = (challenge: any): boolean => {
  const type = String(challenge?.type || challenge?.challengeType || '').toUpperCase();
  const id = String(challenge?.id || '').toLowerCase();
  return type === 'DAILY_CHALLENGE' ||
    type === 'DAILY' ||
    id.startsWith('daily-') ||
    id.startsWith('daily-challenge-');
};

export const getChallengeWeekKey = (date = new Date()): string => {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  return getChallengeDateKey(monday);
};

export const getChallengeTitle = (
  mode: 'DAILY' | 'WEEKLY',
  date = new Date(),
): string => mode === 'DAILY'
  ? `Daily Challenge — ${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
  : `Weekly Challenge — Week of ${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

// ─── helpers ────────────────────────────────────────────────────────────────
function _shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * _seededShuffle
 * ---------------
 * Deterministic shuffle seeded by a string (e.g. today's date).
 * All users who pass the SAME seed get the SAME order — enabling fair
 * leaderboard comparison on identical question sets.
 */
function _seededShuffle<T>(arr: T[], seed: string): T[] {
  // Simple string → integer hash
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  // Mulberry32 PRNG
  const rand = () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const matchesClassLevel = (value: unknown, classLevel: ClassLevel): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => String(item) === String(classLevel));
  }
  return typeof value === 'string' && String(value) === String(classLevel);
};

/**
 * Centrally stored MCQs are only safe for a class-scoped challenge when the
 * source explicitly carries a matching class. Lesson MCQs get their class
 * from the nst_content_* key, so they are filtered separately below.
 */
const isClassScopedQuestion = (question: any, classLevel: ClassLevel): boolean =>
  matchesClassLevel(
    question?.classLevel ?? question?.targetClass ?? question?.targetClasses,
    classLevel,
  );

export const isContentKeyForClass = (
  key: string,
  classLevel: ClassLevel,
  board?: Board | null,
): boolean => {
  if (!key.startsWith('nst_content_')) return false;
  if (board && !key.startsWith(`nst_content_${board}_`)) return false;
  return key.includes(`_${classLevel}_`) || key.includes(`_${classLevel}-`);
};

/**
 * buildAutoMixQuestions
 * ---------------------
 * Collects class-scoped MCQs without any AI call. Questions from sources
 * without a class tag are intentionally excluded: a daily challenge must not
 * mix another class's content into the selected class.
 *
 * Returns a shuffled, deduplicated pool trimmed to `totalTarget` questions.
 */
export const buildAutoMixQuestions = (
  classLevel: ClassLevel,
  board: Board | null,
  stream: Stream | null,
  mode: 'DAILY' | 'WEEKLY' = 'DAILY',
  selectedChapterIds: string[] = [],
  settings?: SystemSettings,
): MCQItem[] => {
  const totalTarget = mode === 'DAILY' ? 100 : 100;
  const usedQuestions = new Set<string>();
  const pool: MCQItem[] = [];

  // ── 1. Lesson content from localStorage ──────────────────────────────────
  const streamKey = (classLevel === '11' || classLevel === '12') ? `-${stream}` : '';
  // When board is null (e.g. admin Auto Mix), scan across all boards for this class
  const autoPrefix = board
    ? `nst_content_${board}_${classLevel}${streamKey}`
    : `nst_content_`;
  const selectedSet = new Set(selectedChapterIds);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('nst_content_')) continue;

    if (selectedChapterIds.length > 0) {
      // Manual mode — only include selected chapter IDs
      const parts = key.split('_');
      const chId = parts[parts.length - 1];
      if (!selectedSet.has(chId)) continue;
    } else {
      // Auto mode — match class and, when supplied, the selected board.
      if (!isContentKeyForClass(key, classLevel, board)) continue;
      if (board && !key.startsWith(autoPrefix)) continue;
    }

    try {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      const content = JSON.parse(stored);
      const allQs: MCQItem[] = [
        ...(content.manualMcqData || []),
        ...(content.weeklyTestMcqData || []),
        ...(content.mcqData || []),
      ];
      allQs.forEach(q => {
        if (!q || !q.question) return;
        const key = q.question.trim().toLowerCase();
        if (!usedQuestions.has(key)) {
          pool.push(q);
          usedQuestions.add(key);
        }
      });
    } catch { /* skip corrupt entries */ }
  }

  // ── 2. Wrong-answer bank from Revision Hub ───────────────────────────────
  try {
    const raw = localStorage.getItem('nst_revision_tracker_v2');
    if (raw) {
      const trackerMap = JSON.parse(raw) as Record<string, any>;
      Object.values(trackerMap).forEach((bucket: any) => {
        (bucket.wrongQuestions || []).forEach((wq: any) => {
          if (!wq.question) return;
          const qKey = wq.question.trim().toLowerCase();
           if (usedQuestions.has(qKey)) return;
           if (!isClassScopedQuestion(wq, classLevel)) return;
           if (!wq.allOptions || wq.allOptions.length !== 4) return;
          const correctIdx = wq.allOptions.indexOf(wq.correctOption);
          if (correctIdx === -1) return;
          pool.push({
            question: wq.question,
            options: wq.allOptions,
            correctAnswer: correctIdx,
            explanation: wq.explanation || '',
          });
          usedQuestions.add(qKey);
        });
      });
    }
  } catch { /* ignore */ }

  // ── 3. Admin-published pools ─────────────────────────────────────────────
  // These sources are not stored under nst_content_* because they are
  // uploaded centrally. Include them so Auto Mix is not limited to chapters
  // opened on the current device.
  const addConfiguredQuestions = (questions: unknown, source: string) => {
    if (!Array.isArray(questions)) return;
    questions.forEach((q: any) => {
      if (!q?.question) return;
      if (!isClassScopedQuestion(q, classLevel)) return;
      const qKey = q.question.trim().toLowerCase();
      if (usedQuestions.has(qKey)) return;
      pool.push({ ...q, topic: q.topic || source });
      usedQuestions.add(qKey);
    });
  };
  addConfiguredQuestions(settings?.globalChallengeMcq, 'Challenge of the Day');
  addConfiguredQuestions(settings?.competitionMcqs, 'Competition');
  (settings?.homework || []).forEach((item: any) => {
    if (isClassScopedQuestion(item, classLevel)) {
      addConfiguredQuestions(
        (item.parsedMcqs || []).map((q: any) => ({ ...q, classLevel })),
        item.title || 'Homework',
      );
    }
  });
  (settings?.lucentNotes || []).forEach((entry: any) => {
    if (matchesClassLevel(entry.classLevel, classLevel)) {
      (entry.pages || []).forEach((page: any) => {
        addConfiguredQuestions(
          (page.mcqs || []).map((q: any) => ({ ...q, classLevel })),
          page.topicName || entry.lessonTitle || 'Lucent',
        );
      });
    }
  });

  // ── 4. Question Bank ──────────────────────────────────────────────────────
  try {
    const bank = JSON.parse(localStorage.getItem('nst_question_bank') || '[]');
    if (Array.isArray(bank)) {
      bank
        .filter((item: any) => matchesClassLevel(item?.classLevel, classLevel))
        .forEach((item: any) =>
          addConfiguredQuestions(
            [{ ...item.question, classLevel: item.classLevel }],
            item.subject || 'Question Bank',
          )
        );
    }
  } catch { /* ignore corrupt bank */ }

  return sanitizeChallengeQuestions(_shuffle(pool).slice(0, totalTarget));
};

export const generateDailyChallengeQuestions = async (
    classLevel: ClassLevel,
    board: Board,
    stream: Stream | null,
    settings: SystemSettings,
    userId: string,
    mode: 'DAILY' | 'WEEKLY' = 'DAILY'
): Promise<{ questions: MCQItem[], name: string, id: string, durationMinutes: number, expiryDate: string }> => {
    
    const isDaily = mode === 'DAILY';
    const periodKey = isDaily ? getChallengeDateKey() : getChallengeWeekKey();
    const challengeTitle = getChallengeTitle(mode);

    // 0. Check for a manually published challenge for this exact period.
    // Manual challenges are stored in system settings so every student sees
    // the same set, rather than relying on the admin browser's localStorage.
    if (settings.dailyChallenges && settings.dailyChallenges.length > 0) {
        const published = settings.dailyChallenges.find(c => {
            if (c.type !== (isDaily ? 'DAILY_CHALLENGE' : 'WEEKLY_TEST') || !c.isActive || c.classLevel !== classLevel) {
                return false;
            }
            if (c.board && c.board !== board) return false;
            const legacyPeriodKey = isDaily
              ? new Date(c.createdAt).toISOString().split('T')[0]
              : getChallengeWeekKey(new Date(c.createdAt));
            return (c.periodKey || legacyPeriodKey) === periodKey &&
              new Date(c.expiryDate).getTime() > Date.now();
        });

        if (published) {
            const publishedQuestions = sanitizeChallengeQuestions(published.questions);
            if (publishedQuestions.length > 0) {
                return {
                    id: `${published.id}-${userId}`, // User-specific attempt ID
                    name: published.title,
                    questions: publishedQuestions,
                    durationMinutes: Math.min(published.durationMinutes || (isDaily ? 60 : 60), 60),
                    expiryDate: published.expiryDate,
                };
            }
        }
    }

    // CONFIGURATION
    const totalTarget = isDaily ? 100 : 100;
    const durationMinutes = isDaily ? 60 : 60;
    
    // Date string used as PRNG seed — all users on the same date get the same
    // question order, making the leaderboard a fair comparison.
    const todayISO = getChallengeDateKey();

    // ── Source priority 2: ALL nst_content_* keys (whole syllabus, not just
    //    chapters the user has already studied) ───────────────────────────────
    const usedQuestions = new Set<string>();
    const questionsBySubject: Record<string, MCQItem[]> = {};

    const addQ = (q: MCQItem, subjectName: string) => {
        if (!q?.question) return;
        const k = q.question.trim().toLowerCase();
        if (usedQuestions.has(k)) return;
        usedQuestions.add(k);
        if (!questionsBySubject[subjectName]) questionsBySubject[subjectName] = [];
        questionsBySubject[subjectName].push(q);
    };

    // 1. Determine Source Keys (Manual vs Auto)
    let sourceChapterKeys: string[] = [];
    const isJuniorClass = ['6','7','8','9','10'].includes(classLevel);

    if (settings.dailyChallengeConfig?.mode === 'MANUAL' && settings.dailyChallengeConfig.selectedChapterIds?.length) {
        // MANUAL MODE — admin-selected specific chapters
        const selectedIds = new Set(settings.dailyChallengeConfig.selectedChapterIds);
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nst_content_')) {
                if (!isContentKeyForClass(key, classLevel, board)) continue;
                const parts = key.split('_');
                const chId = parts[parts.length - 1];
                if (selectedIds.has(chId)) sourceChapterKeys.push(key);
            }
        }
    } else {
        // AUTO MODE — scan only this class's content (and selected board).
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && isContentKeyForClass(key, classLevel, board)) {
                sourceChapterKeys.push(key);
            }
        }
    }

    // 2. Aggregate Questions By Subject from ALL available content
    for (const key of sourceChapterKeys) {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) continue;
            const content = JSON.parse(stored);
            let subjectName = content.subjectName || 'General';

            // Normalize Subject Names
            if (subjectName.includes('Math')) subjectName = 'Math';
            else if (subjectName.includes('Science') && !subjectName.includes('Social')) subjectName = 'Science';
            else if (subjectName.includes('Social')) subjectName = 'Social Science';

            const allQs: MCQItem[] = [
                ...(content.manualMcqData || []),
                ...(content.weeklyTestMcqData || []),
                ...(content.mcqData || []),
            ];
            sanitizeChallengeQuestions(allQs).forEach(q => addQ(q, subjectName));
        } catch { /* skip corrupt entries */ }
    }

    // Centrally uploaded MCQs are available even when the student has never
    // opened a chapter on this device.
    const addConfiguredBySubject = (questions: unknown, subjectName: string) => {
        if (!Array.isArray(questions)) return;
        sanitizeChallengeQuestions(questions).forEach(q => addQ(q, subjectName));
    };
    // Only explicitly class-scoped central sources belong in this challenge.
    // Generic/global, competition, or homework content without a target class
    // is intentionally not mixed into a school-class routine challenge.
    if (Array.isArray(settings.globalChallengeMcq)) {
        addConfiguredBySubject(
            settings.globalChallengeMcq.filter((q: any) => isClassScopedQuestion(q, classLevel)),
            'Challenge of the Day',
        );
    }
    if (Array.isArray(settings.competitionMcqs)) {
        addConfiguredBySubject(
            settings.competitionMcqs.filter((q: any) => isClassScopedQuestion(q, classLevel)),
            'Competition',
        );
    }
    (settings.homework || []).forEach((item: any) => {
        if (isClassScopedQuestion(item, classLevel)) {
            addConfiguredBySubject(
                (item.parsedMcqs || []).map((q: any) => ({ ...q, classLevel })),
                item.targetSubject || item.title || 'Homework',
            );
        }
    });
    (settings.lucentNotes || []).forEach((entry: any) => {
        if (!matchesClassLevel(entry.classLevel, classLevel)) return;
        (entry.pages || []).forEach((page: any) =>
            addConfiguredBySubject(
                (page.mcqs || []).map((q: any) => ({ ...q, classLevel })),
                page.topicName || entry.lessonTitle || 'Lucent',
            )
        );
    });
    try {
        const bank = JSON.parse(localStorage.getItem('nst_question_bank') || '[]');
        if (Array.isArray(bank)) {
            bank
                .filter((item: any) => matchesClassLevel(item?.classLevel, classLevel))
                .forEach((item: any) =>
                    addConfiguredBySubject(
                        [{ ...item.question, classLevel: item.classLevel }],
                        item.subject || 'Question Bank',
                    )
                );
        }
    } catch { /* ignore corrupt bank */ }

    // 3. Selection Logic
    let finalQuestions: MCQItem[] = [];
    const seed = `${todayISO}-${board}-${classLevel}`;
    const subjects = Object.keys(questionsBySubject);
    if (isDaily && isJuniorClass) {
        const targets: Record<string, number> = { 'Math': 10, 'Science': 10, 'Social Science': 10 };
        Object.entries(targets).forEach(([sub, count]) => {
            finalQuestions.push(..._seededShuffle(questionsBySubject[sub] || [], seed + sub).slice(0, count));
        });
    } else if (subjects.length > 0) {
        const targetPerSubject = Math.ceil(totalTarget / subjects.length);
        subjects.forEach(sub => {
            finalQuestions.push(..._seededShuffle(questionsBySubject[sub], seed + sub).slice(0, targetPerSubject));
        });
    }
    const usedInFinal = new Set(finalQuestions.map(q => q.question?.trim().toLowerCase()));
    const remaining = Object.values(questionsBySubject)
        .flat()
        .filter(q => !usedInFinal.has(q.question?.trim().toLowerCase()));
    finalQuestions.push(..._seededShuffle(remaining, seed + 'fill').slice(0, Math.max(0, totalTarget - finalQuestions.length)));
    finalQuestions = _seededShuffle(finalQuestions, seed).slice(0, totalTarget);

    // 4. Return Object — same period + cohort gives every student the same set.
    const idPrefix = isDaily ? 'daily-challenge' : 'weekly-challenge';
    const challengeId = `${idPrefix}-${board}-${classLevel}-${periodKey}`;
    
    return {
        id: challengeId,
        name: challengeTitle,
        questions: sanitizeChallengeQuestions(finalQuestions),
        durationMinutes: durationMinutes,
        expiryDate: getChallengeExpiryDate().toISOString(),
    };
};
