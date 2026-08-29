import { ClassLevel, Board, Stream, MCQItem, SystemSettings } from '../types';
import { getSubjectsList } from '../constants';

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

/**
 * buildAutoMixQuestions
 * ---------------------
 * Collects MCQs from two sources — without any AI call:
 *   1. Completed lesson content stored in `nst_content_*` localStorage keys
 *      (manualMcqData, weeklyTestMcqData, mcqData fields)
 *   2. Wrong-answer history in the Revision Hub (`nst_revision_tracker_v2`)
 *
 * Returns a shuffled, deduplicated pool trimmed to `totalTarget` questions.
 */
export const buildAutoMixQuestions = (
  classLevel: ClassLevel,
  board: Board | null,
  stream: Stream | null,
  mode: 'DAILY' | 'WEEKLY' = 'DAILY',
  selectedChapterIds: string[] = []
): MCQItem[] => {
  const totalTarget = mode === 'DAILY' ? 50 : 100;
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
      // Auto mode — match prefix (board-specific or all-boards)
      if (!key.startsWith(autoPrefix)) continue;
      // When scanning all boards, still filter by class level embedded in key
      if (!board && !key.includes(`_${classLevel}_`) && !key.includes(`_${classLevel}-`)) continue;
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
          if (!wq.allOptions || wq.allOptions.length < 2) return;
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

  return _shuffle(pool).slice(0, totalTarget);
};

export const generateDailyChallengeQuestions = async (
    classLevel: ClassLevel,
    board: Board,
    stream: Stream | null,
    settings: SystemSettings,
    userId: string,
    mode: 'DAILY' | 'WEEKLY' = 'DAILY'
): Promise<{ questions: MCQItem[], name: string, id: string, durationMinutes: number }> => {
    
    // 0. Check for Published Challenge (Global)
    if (mode === 'DAILY' && settings.dailyChallenges && settings.dailyChallenges.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        // Find challenge matching date, board, class
        // ID Format: daily-{board}-{classLevel}-{date}
        const expectedIdPrefix = `daily-${board}-${classLevel}-${todayStr}`;
        
        const published = settings.dailyChallenges.find(c => 
            c.type === 'DAILY_CHALLENGE' &&
            c.isActive &&
            c.id.startsWith(expectedIdPrefix)
        );

        if (published) {
            return {
                id: `${published.id}-${userId}`, // User-specific attempt ID
                name: published.title,
                questions: published.questions,
                durationMinutes: published.durationMinutes || 15
            };
        }
    }

    // CONFIGURATION
    const isDaily = mode === 'DAILY';
    const totalTarget = isDaily ? 30 : 100;
    const durationMinutes = isDaily ? 15 : 60;
    
    // Date string used as PRNG seed — all users on the same date get the same
    // question order, making the leaderboard a fair comparison.
    const todayISO = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // ── Source priority 1: globalChallengeMcq (admin-curated syllabus pool) ──
    const globalPool: MCQItem[] = settings.globalChallengeMcq || [];

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
                const parts = key.split('_');
                const chId = parts[parts.length - 1];
                if (selectedIds.has(chId)) sourceChapterKeys.push(key);
            }
        }
    } else {
        // AUTO MODE — scan ALL nst_content_* keys (full syllabus, not just studied chapters)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nst_content_')) {
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
            allQs.forEach(q => addQ(q, subjectName));
        } catch { /* skip corrupt entries */ }
    }

    // 3. Selection Logic
    let finalQuestions: MCQItem[] = [];
    const seed = `${todayISO}-${board}-${classLevel}`;

    // If admin has a global MCQ pool, use it directly (seeded shuffle for fairness)
    if (globalPool.length >= Math.min(totalTarget, 10)) {
        const deduped = globalPool.filter(q => {
            const k = q.question?.trim().toLowerCase();
            return k && !usedQuestions.has(k);
        });
        finalQuestions = _seededShuffle([...globalPool], seed).slice(0, totalTarget);
    } else {
        // Fall back to all-syllabus content from localStorage
        if (isDaily && isJuniorClass) {
            // STRICT 10 Math, 10 Sci, 10 SST
            const targets: Record<string, number> = { 'Math': 10, 'Science': 10, 'Social Science': 10 };
            Object.entries(targets).forEach(([sub, count]) => {
                const pool = _seededShuffle(questionsBySubject[sub] || [], seed + sub);
                finalQuestions.push(...pool.slice(0, count));
            });
            // Fill shortfall from remaining subjects
            if (finalQuestions.length < totalTarget) {
                const usedInFinal = new Set(finalQuestions.map(q => q.question));
                const remaining = Object.values(questionsBySubject).flat().filter(q => !usedInFinal.has(q.question));
                finalQuestions.push(..._seededShuffle(remaining, seed + 'fill').slice(0, totalTarget - finalQuestions.length));
            }
        } else {
            // MIXED MODE (Weekly or Senior Classes) — equal share per subject
            const subjects = Object.keys(questionsBySubject);
            if (subjects.length > 0) {
                const targetPerSubject = Math.ceil(totalTarget / subjects.length);
                subjects.forEach(sub => {
                    const pool = _seededShuffle(questionsBySubject[sub], seed + sub);
                    finalQuestions.push(...pool.slice(0, targetPerSubject));
                });
            }
        }

        // Final deterministic shuffle + trim
        finalQuestions = _seededShuffle(finalQuestions, seed).slice(0, totalTarget);
    }

    // 4. Return Object — challenge ID is board+class+date (same for all users of same cohort)
    const idPrefix = isDaily ? 'daily-challenge' : 'weekly-challenge';
    const challengeId = `${idPrefix}-${board}-${classLevel}-${todayISO}`;
    
    return {
        id: challengeId,
        name: isDaily ? `Daily Challenge (${todayISO})` : `Weekly Mega Test (${todayISO})`,
        questions: finalQuestions,
        durationMinutes: durationMinutes
    };
};
