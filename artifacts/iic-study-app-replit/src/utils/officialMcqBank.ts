import { MCQItem, ClassLevel, SystemSettings } from '../types';
import { parseMCQText, extractStatements } from './mcqParser';

export interface OfficialMcqProgress {
  date: string;
  classLevel: string;
  currentIndex: number;
  answers: Record<number, { selected: number; isCorrect: boolean; timestamp: number }>;
  attemptedCount: number;
  correctCount: number;
  wrongCount: number;
  isCompleted: boolean;
}

// ─── Deterministic PRNG (Mulberry32) ──────────────────────────────────────────
export function createMulberry32(seedStr: string): () => number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function () {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const getTodayDateKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Local Storage Progress Tracker ──────────────────────────────────────────
export const getOfficialDailyProgress = (userId: string, classLevel: string, dateKey: string): OfficialMcqProgress => {
  const key = `nst_official_mcq_${dateKey}_${classLevel}_${userId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === dateKey && parsed.classLevel === classLevel) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse official MCQ progress', e);
  }
  return {
    date: dateKey,
    classLevel,
    currentIndex: 0,
    answers: {},
    attemptedCount: 0,
    correctCount: 0,
    wrongCount: 0,
    isCompleted: false,
  };
};

export const saveOfficialDailyProgress = (userId: string, progress: OfficialMcqProgress): void => {
  const key = `nst_official_mcq_${progress.date}_${progress.classLevel}_${userId}`;
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save official MCQ progress', e);
  }
};

export const clearOfficialDailyProgress = (userId: string, classLevel: string, dateKey: string): void => {
  const key = `nst_official_mcq_${dateKey}_${classLevel}_${userId}`;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear official MCQ progress', e);
  }
};

// ─── Main Generator: Returns exactly 100 deterministic MCQs for Class + Date ──
// ─── Real App MCQs Loader for Official Mode ──────────────────────────────────
export function getOfficial100Mcqs(
  classLevel: string,
  dateStr = getTodayDateKey(),
  settings?: SystemSettings | null,
  firebaseLessons?: any[]
): MCQItem[] {
  const normTarget = String(classLevel || '').trim().toLowerCase();
  const isCompetition = normTarget === 'competition' || normTarget === 'comp';
  const existingPool: MCQItem[] = [];
  const seenQuestions = new Set<string>();

  // Ensure active settings (fallback to local cached nst_system_settings if props not yet loaded)
  let activeSettings: any = settings;
  if (!activeSettings) {
    try {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) activeSettings = JSON.parse(raw);
    } catch {}
  }

  const addUnique = (item: any) => {
    if (!item || !item.question) return;
    if (item.id) {
      const sId = String(item.id).toLowerCase();
      if (sId.startsWith('seed-') || sId.startsWith('curriculum_') || sId.startsWith('procedural_') || sId.startsWith('dummy') || sId.startsWith('mock_') || sId.startsWith('lucent_')) return;
    }
    if (item.userId) {
      const sUid = String(item.userId).toLowerCase();
      if (sUid.startsWith('seed_') || sUid.startsWith('dummy')) return;
    }
    const qText = String(item.question).trim();
    if (!qText || qText.length < 3) return;
    const optsRaw = Array.isArray(item.options) ? item.options : [];
    if (optsRaw.length < 2) return;
    let opts = optsRaw.map((o: any) => String(o || '').trim()).filter(Boolean);
    if (opts.length < 2) return;
    while (opts.length < 4) {
      opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
    }
    opts = opts.slice(0, 4);

    const cleanQ = qText.toLowerCase().replace(/\s+/g, ' ');
    if (seenQuestions.has(cleanQ)) return;
    seenQuestions.add(cleanQ);

    let correctAns = 0;
    if (typeof item.correctAnswer === 'number' && item.correctAnswer >= 0 && item.correctAnswer < opts.length) {
      correctAns = item.correctAnswer;
    } else if (Array.isArray(item.correctAnswers) && item.correctAnswers.length > 0) {
      const first = Number(item.correctAnswers[0]);
      if (!isNaN(first) && first >= 0 && first < opts.length) correctAns = first;
    } else if (typeof item.answer === 'number' && item.answer >= 0 && item.answer < opts.length) {
      correctAns = item.answer;
    } else if (typeof item.correctAnswer === 'string') {
      const idx = ['a', 'b', 'c', 'd'].indexOf(item.correctAnswer.trim().toLowerCase());
      if (idx >= 0) correctAns = idx;
    }

    let itemStmts = item.statements ?? item.statement ?? item.statementsList;
    let finalQText = qText;
    if ((!itemStmts || itemStmts.length === 0) && typeof item.question === 'string') {
      const ext = extractStatements(item.question);
      if (ext.statements.length > 0) {
        itemStmts = ext.statements;
        finalQText = ext.cleanedQuestion;
      }
    }

    existingPool.push({
      question: finalQText,
      statements: itemStmts && itemStmts.length > 0 ? itemStmts : undefined,
      options: opts,
      correctAnswer: correctAns,
      explanation: item.explanation || item.concept || '',
      topic: item.topic || item.subject || '',
      difficultyLevel: item.difficulty || item.difficultyLevel || 'Medium',
      questionNumber: item.questionNumber,
    });
  };

  // 1. Admin Competition MCQs (saved by Admin in Comp MCQ tab)
  if (isCompetition) {
    if (Array.isArray(activeSettings?.competitionMcqs)) {
      activeSettings.competitionMcqs.forEach(addUnique);
    }
    if (Array.isArray(activeSettings?.competitionPracticeMcqs)) {
      activeSettings.competitionPracticeMcqs.forEach(addUnique);
    }
  } else if (Array.isArray(activeSettings?.competitionMcqs)) {
    // If admin tagged any questions with specific class
    activeSettings.competitionMcqs.forEach((q: any) => {
      const qCls = String(q.classLevel || q.targetClass || '').trim().toLowerCase();
      if (qCls === normTarget) addUnique(q);
    });
  }

  // 2. Admin Homework & Page-Wise Book MCQs (Sar Sangrah, Speedy Science, Speedy Social, Lucent, MCQ Practice, etc.)
  if (Array.isArray(activeSettings?.homework)) {
    for (const hw of activeSettings.homework) {
      if (!hw) continue;
      const targetSub = String(hw.targetSubject || '').trim().toLowerCase();
      const classTarget = String(hw.classTarget || hw.classLevel || '').trim().toLowerCase();

      // Competition subjects include Sar Sangrah, Speedy Science, Speedy Social Science, Lucent, MCQ Practice, custom books, etc.
      const isCompetitionSubject =
        targetSub.includes('sangrah') ||
        targetSub.includes('speedy') ||
        targetSub.includes('lucent') ||
        targetSub === 'mcq' ||
        targetSub === 'current_affairs' ||
        targetSub === 'competition' ||
        targetSub === 'none' ||
        (Array.isArray(activeSettings?.customBooks) &&
          activeSettings.customBooks.some((b: any) => String(b.id).toLowerCase() === targetSub));

      const isMatch = isCompetition
        ? classTarget === 'competition' || classTarget === 'comp' || classTarget === 'all' || !classTarget || isCompetitionSubject
        : classTarget === normTarget || classTarget === 'all';

      if (isMatch) {
        let foundAny = false;
        if (Array.isArray(hw.parsedMcqs) && hw.parsedMcqs.length > 0) {
          hw.parsedMcqs.forEach(addUnique);
          foundAny = true;
        }
        if (Array.isArray(hw.mcqs) && hw.mcqs.length > 0) {
          hw.mcqs.forEach(addUnique);
          foundAny = true;
        }
        if (Array.isArray(hw.mcqList) && hw.mcqList.length > 0) {
          hw.mcqList.forEach(addUnique);
          foundAny = true;
        }
        // If parsed array not present, attempt to parse raw mcqText
        if (!foundAny && typeof hw.mcqText === 'string' && hw.mcqText.trim()) {
          try {
            const parsed = parseMCQText(hw.mcqText.trim());
            if (parsed && Array.isArray(parsed.questions)) {
              parsed.questions.forEach(addUnique);
            }
          } catch (e) {
            console.warn('Error parsing hw mcqText', e);
          }
        }
      }
    }
  }

  // 3. Admin Lucent & Multi-Page Book Notes (Pages contain curated MCQs)
  if (Array.isArray(activeSettings?.lucentNotes)) {
    for (const entry of activeSettings.lucentNotes) {
      if (!entry) continue;
      const entryCls = String(entry.classLevel || 'COMPETITION').trim().toLowerCase();
      const isMatch = isCompetition
        ? entryCls === 'competition' || entryCls === 'comp' || !entry.classLevel
        : entryCls === normTarget;

      if (isMatch && Array.isArray(entry.pages)) {
        for (const page of entry.pages) {
          if (!page) continue;
          let foundPageMcq = false;
          if (Array.isArray(page.mcqs) && page.mcqs.length > 0) {
            page.mcqs.forEach(addUnique);
            foundPageMcq = true;
          }
          if (Array.isArray(page.parsedMcqs) && page.parsedMcqs.length > 0) {
            page.parsedMcqs.forEach(addUnique);
            foundPageMcq = true;
          }
          if (Array.isArray(page.mcqList) && page.mcqList.length > 0) {
            page.mcqList.forEach(addUnique);
            foundPageMcq = true;
          }
          if (!foundPageMcq && typeof page.mcqText === 'string' && page.mcqText.trim()) {
            try {
              const parsed = parseMCQText(page.mcqText.trim());
              if (parsed && Array.isArray(parsed.questions)) {
                parsed.questions.forEach(addUnique);
              }
            } catch {}
          }
        }
      }
    }
  }

  // 4. From Firebase mcq_lessons (Admin Class MCQs & Competition MCQs)
  if (Array.isArray(firebaseLessons)) {
    for (const l of firebaseLessons) {
      if (!l) continue;
      const lCls = String(l.classLevel || '').trim().toLowerCase();
      const isMatch = isCompetition
        ? lCls === 'competition' || lCls === 'comp' || !lCls
        : lCls === normTarget;
      if (isMatch) {
        const qs = Array.isArray(l.mcqs)
          ? l.mcqs
          : Array.isArray(l.mcqList)
          ? l.mcqList
          : Array.isArray(l.parsedMcqs)
          ? l.parsedMcqs
          : [];
        qs.forEach(addUnique);
      }
    }
  }

  // 5. Admin Daily Challenge in settings matching this class
  if (activeSettings?.dailyChallenges && Array.isArray(activeSettings.dailyChallenges)) {
    for (const c of activeSettings.dailyChallenges) {
      const cCls = String(c.classLevel || '').trim().toLowerCase();
      const isMatch = isCompetition
        ? cCls === 'competition' || cCls === 'comp'
        : cCls === normTarget;
      if (c.isActive && isMatch && Array.isArray(c.questions)) {
        c.questions.forEach(addUnique);
      }
    }
  }

  // 6. Global Challenge MCQs
  if (Array.isArray(activeSettings?.globalChallengeMcq)) {
    activeSettings.globalChallengeMcq.forEach((q: any) => {
      const qCls = String(q.classLevel || '').trim().toLowerCase();
      if (!qCls || (isCompetition ? qCls === 'competition' || qCls === 'comp' : qCls === normTarget)) {
        addUnique(q);
      }
    });
  }

  // 7. Scan localStorage for existing content and notes matching this class
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const kLower = k.toLowerCase();
      if (
        kLower.startsWith('nst_content_') ||
        kLower.startsWith('nst_notes_') ||
        kLower.startsWith('nst_custom_notes_') ||
        kLower.startsWith('nst_chapter_notes_') ||
        kLower.startsWith('nst_chapter_content_') ||
        kLower.startsWith('nst_study_notes_') ||
        kLower.startsWith('nst_book_notes_') ||
        kLower.startsWith('nst_saved_notes')
      ) {
        const isMatch = isCompetition
          ? kLower.includes('competition') || kLower.includes('comp') || kLower.includes('lucent') || kLower.includes('sangrah') || kLower.includes('speedy')
          : kLower.includes(`_${normTarget}_`) || kLower.includes(`_${normTarget}-`) || kLower.endsWith(`_${normTarget}`) || kLower.includes(normTarget);
        if (isMatch || isCompetition) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const qs = [
                ...(Array.isArray(parsed.manualMcqData) ? parsed.manualMcqData : []),
                ...(Array.isArray(parsed.mcqList) ? parsed.mcqList : []),
                ...(Array.isArray(parsed.weeklyTestMcqData) ? parsed.weeklyTestMcqData : []),
                ...(Array.isArray(parsed.mcqData) ? parsed.mcqData : []),
                ...(Array.isArray(parsed.parsedMcqs) ? parsed.parsedMcqs : []),
                ...(Array.isArray(parsed.mcqs) ? parsed.mcqs : []),
                ...(Array.isArray(parsed.questions) ? parsed.questions : []),
              ];
              qs.forEach(addUnique);
            } catch {}
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading local content for official MCQs', e);
  }

  // 8. Question bank from localStorage
  try {
    const qbRaw = localStorage.getItem('nst_question_bank');
    if (qbRaw) {
      const qb = JSON.parse(qbRaw);
      if (Array.isArray(qb)) {
        qb.filter((item) => {
          const itemCls = String(item.classLevel || '').trim().toLowerCase();
          return isCompetition
            ? itemCls === 'competition' || itemCls === 'comp'
            : itemCls === normTarget;
        }).forEach((item) => addUnique(item.question || item));
      }
    }
  } catch (e) {}

  // 9. Revision Hub Questions (Spaced Repetition & Topic MCQs)
  try {
    // 9a. Revision Hub topics
    const revHubRaw = localStorage.getItem('nst_revision_hub_topics');
    if (revHubRaw) {
      const topics = JSON.parse(revHubRaw);
      if (Array.isArray(topics)) {
        topics.forEach((topic: any) => {
          const tCls = String(topic.classLevel || topic.targetClass || '').trim().toLowerCase();
          if (!tCls || (isCompetition ? tCls === 'competition' || tCls === 'comp' : tCls === normTarget)) {
            const topicQs = [
              ...(Array.isArray(topic.mcqData) ? topic.mcqData : []),
              ...(Array.isArray(topic.mcqs) ? topic.mcqs : []),
              ...(Array.isArray(topic.questions) ? topic.questions : []),
              ...(Array.isArray(topic.revisionMcqs) ? topic.revisionMcqs : [])
            ];
            topicQs.forEach(addUnique);
          }
        });
      }
    }

    // 9b. Revision buckets & weak/average/strong notes
    const revBuckets = ['nst_revision_mcqs', 'nst_weak_notes', 'nst_average_notes', 'nst_strong_notes', 'nst_revision_buckets'];
    revBuckets.forEach((bucketKey) => {
      try {
        const raw = localStorage.getItem(bucketKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item?.question) addUnique(item);
              if (Array.isArray(item?.mcqs)) item.mcqs.forEach(addUnique);
              if (Array.isArray(item?.questions)) item.questions.forEach(addUnique);
            });
          }
        }
      } catch {}
    });

    // 9c. User history past test questions for revision
    const userHistRaw = localStorage.getItem('nst_user_history');
    if (userHistRaw) {
      const userHist = JSON.parse(userHistRaw);
      if (Array.isArray(userHist)) {
        userHist.slice(0, 50).forEach((entry: any) => {
          if (Array.isArray(entry.questions)) entry.questions.forEach(addUnique);
          if (Array.isArray(entry.mcqs)) entry.mcqs.forEach(addUnique);
        });
      }
    }
  } catch (e) {
    console.warn('Error extracting revision hub MCQs', e);
  }

  // 10. Notes Pages MCQs (Settings notes, topic notes, additional notes)
  try {
    const notesSources = [
      activeSettings?.notes,
      activeSettings?.topicNotes,
      activeSettings?.schoolAdditionalNotes,
      activeSettings?.competitionAdditionalNotes,
      activeSettings?.schoolQuickNotes,
      activeSettings?.competitionQuickNotes,
    ];
    notesSources.forEach((source) => {
      if (Array.isArray(source)) {
        source.forEach((noteItem: any) => {
          const nCls = String(noteItem?.classLevel || '').trim().toLowerCase();
          if (!nCls || (isCompetition ? nCls === 'competition' || nCls === 'comp' : nCls === normTarget)) {
            const noteQs = [
              ...(Array.isArray(noteItem.mcqs) ? noteItem.mcqs : []),
              ...(Array.isArray(noteItem.parsedMcqs) ? noteItem.parsedMcqs : []),
              ...(Array.isArray(noteItem.mcqList) ? noteItem.mcqList : []),
              ...(Array.isArray(noteItem.questions) ? noteItem.questions : [])
            ];
            noteQs.forEach(addUnique);
          }
        });
      }
    });
  } catch (e) {
    console.warn('Error extracting notes page MCQs', e);
  }

  // 11. Battles MCQs (only real user battles created in the app)
  try {
    const battleRaw = localStorage.getItem('nst_cached_battle_mcqs') || localStorage.getItem('nst_user_battles');
    if (battleRaw) {
      const bList = JSON.parse(battleRaw);
      if (Array.isArray(bList)) {
        bList.forEach((b: any) => {
          if (!b) return;
          const bId = String(b.id || '').toLowerCase();
          if (bId.startsWith('seed-') || bId.startsWith('curriculum_') || bId.startsWith('procedural_') || bId.startsWith('dummy') || bId.startsWith('mock_') || bId.startsWith('lucent_')) return;
          if (Array.isArray(b.questions)) {
            b.questions.forEach((q: any) => {
              if (!q) return;
              const qId = String(q.id || '').toLowerCase();
              if (qId.startsWith('seed-') || qId.startsWith('curriculum_') || qId.startsWith('procedural_') || qId.startsWith('dummy') || qId.startsWith('mock_') || qId.startsWith('lucent_')) return;
              addUnique(q);
            });
          } else if (b.question && b.options) {
            addUnique(b);
          }
        });
      }
    }
  } catch {}

  // Strictly only real MCQs from the app (no dummy or procedural questions)
  if (existingPool.length === 0) {
    return [];
  }

  // ─── 14. Non-Repeating Daily Rotation System (100 Questions / Day) ─────────
  // User mandate:
  // - Exactly 100 unique questions each day with zero duplicates.
  // - Questions must not repeat daily.
  // - All available questions in the master bank must be served in sequential batches
  //   day-by-day across days/weeks/months.
  // - Only after all questions in the master pool have been served does the cycle repeat
  //   for spaced repetition and revision.

  // Stable master shuffle of the pool for this class
  const masterSeed = `nst_master_pool_order_v4_${normTarget}`;
  const masterRand = createMulberry32(masterSeed);
  const masterPool = seededShuffle(existingPool, masterRand);

  // If pool has fewer than 100, return the complete unique pool
  if (masterPool.length <= 100) {
    return masterPool;
  }

  // Calculate day offset since reference date
  let dayOffset = 0;
  try {
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const dateObj = new Date(yr || 2026, (mo || 1) - 1, dy || 1);
    const baseEpoch = new Date(2026, 0, 1).getTime();
    dayOffset = Math.max(0, Math.floor((dateObj.getTime() - baseEpoch) / (1000 * 60 * 60 * 24)));
  } catch {
    dayOffset = 0;
  }

  // Exactly 100 non-repeating questions per day
  const BATCH_SIZE = 100;
  const startIdx = (dayOffset * BATCH_SIZE) % masterPool.length;

  let dailySlice: MCQItem[] = [];
  if (startIdx + BATCH_SIZE <= masterPool.length) {
    dailySlice = masterPool.slice(startIdx, startIdx + BATCH_SIZE);
  } else {
    // Wrap around to beginning of master pool to complete the 100 batch
    const firstPart = masterPool.slice(startIdx);
    const neededFromStart = BATCH_SIZE - firstPart.length;
    const secondPart = masterPool.slice(0, neededFromStart);
    dailySlice = [...firstPart, ...secondPart];
  }

  return dailySlice;
}
