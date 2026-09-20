import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  MessageSquare,
  Sparkles,
  Send,
  X,
  Copy,
  Check,
  Trophy,
  Flame,
  Radio,
  ExternalLink,
  Plus,
  Lock,
  Globe,
  Award,
  Clock,
  Zap,
  HelpCircle,
  Video,
  ChevronRight,
  UserCheck,
  Minimize2,
  Compass,
  Search,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  MonitorPlay,
  FastForward,
  Timer,
  CheckCircle2,
  XCircle,
  BarChart3,
  Medal,
  Trash2,
  Crown,
} from 'lucide-react';
import {
  type GroupStudyRoom,
  type GroupStudyMember,
  type GroupStudyMessage,
  type GroupStudyMcqQuestion,
  type StudyRoomMcqType,
  type McqAnswerOutcome,
  CURATED_MCQ_SETS,
  subscribeToActiveRooms,
  subscribeToRoom,
  createGroupRoom,
  joinGroupRoom,
  leaveGroupRoom,
  deleteGroupRoom,
  markRoomAsCreatedByMe,
  isRoomCreatedByMe,
  getCachedRooms,
  sendRoomMessage,
  toggleHandRaise,
  setRoomMode,
  setRoomMcqType,
  startLiveMcqBattle,
  setRoomMcqDuration,
  setRoomMcqAutoAdvance,
  revealMcqAnswer,
  advanceMcqQuestion,
  submitMcqAnswer,
  awardFinalStreakBonus,
  autoSubmitRoom,
  endLiveMcqBattle,
  syncHostActivity,
  cleanRtdbPayload,
} from '../services/groupStudyService';
import { auth, getChapterData, saveUserToLive, subscribeMcqLessons } from '../firebase';
import { STATIC_SYLLABUS, ADMIN_EMAIL } from '../constants';
import { parseMCQText } from '../utils/mcqParser';

// Normalize any raw MCQ question to GroupStudyMcqQuestion format
function parseQuestionToGroupMcq(q: any): GroupStudyMcqQuestion | null {
  if (!q) return null;
  const questionText = String(q.question || q.title || q.prompt || '').trim();
  if (!questionText) return null;

  let rawOptions: string[] = [];
  if (Array.isArray(q.options) && q.options.length > 0) {
    rawOptions = q.options.map((o: any) => String(o ?? '').trim()).filter(Boolean);
  } else if (q.optionA || q.optionB) {
    rawOptions = [q.optionA, q.optionB, q.optionC, q.optionD]
      .map((o: any) => String(o ?? '').trim())
      .filter(Boolean);
  } else if (q.choices && Array.isArray(q.choices)) {
    rawOptions = q.choices.map((o: any) => String(o ?? '').trim()).filter(Boolean);
  }

  if (rawOptions.length < 2) return null;

  let correctIndex = 0;
  if (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < rawOptions.length) {
    correctIndex = q.correctIndex;
  } else if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < rawOptions.length) {
    correctIndex = q.correctAnswer;
  } else if (typeof q.correctAnswer === 'string') {
    const ca = q.correctAnswer.trim().toLowerCase();
    const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
    if (letterMap[ca] !== undefined && letterMap[ca] < rawOptions.length) {
      correctIndex = letterMap[ca];
    } else {
      const idx = rawOptions.findIndex(opt => opt.toLowerCase() === ca);
      if (idx >= 0) correctIndex = idx;
    }
  }

  return {
    question: questionText,
    options: rawOptions.slice(0, 4),
    correctIndex,
    explanation: q.explanation ? String(q.explanation).trim() : '',
  };
}

export interface GroupStudyPrefilledContext {
  contentType: 'READING_NOTES' | 'WRITING_NOTES' | 'MCQ' | 'PREMIUM_MCQ' | 'FLASHCARD' | 'PDF';
  title?: string;
  subject?: string;
  chapterId?: string;
  chapterTitle?: string;
  board?: string;
  classLevel?: string;
  totalQuestions?: number;
  pdfUrl?: string;
  mcqData?: any[];
}

interface GroupStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  settings?: any;
  tierTheme: any;
  activeRoom?: GroupStudyRoom | null;
  prefilledContext?: GroupStudyPrefilledContext | null;
  onActiveRoomChange?: (room: GroupStudyRoom | null) => void;
  onOpenStore?: () => void;
  onNavigateToContent?: (target: {
    tab?: string;
    board?: string;
    classLevel?: string;
    subjectId?: string;
    subjectName?: string;
    chapterId?: string;
    chapterTitle?: string;
    mode?: 'NOTES' | 'MCQ' | 'PDF';
  }) => void;
  onUserUpdate?: (user: any) => void;
}

export const GroupStudyModal: React.FC<GroupStudyModalProps> = ({
  isOpen,
  onClose,
  user,
  settings,
  tierTheme,
  activeRoom,
  prefilledContext,
  onActiveRoomChange,
  onOpenStore,
  onNavigateToContent,
  onUserUpdate,
}) => {
  // ── Plan & Tier Permissions ───────────────────────────────────────────────
  const userTier: 'FREE' | 'BASIC' | 'ULTRA' = (user?.subscriptionLevel || 'FREE')?.toUpperCase() as any;
  const userEmail = (user?.email || auth.currentUser?.email || '').toLowerCase().trim();
  const isAdmin = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'SUB_ADMIN' ||
    user?.isAdmin ||
    userEmail === 'n44438403@gmail.com' ||
    userEmail === ADMIN_EMAIL.toLowerCase() ||
    userEmail.includes('admin') ||
    user?.isSuperAdmin
  );

  // Limits mandated:
  // Admin: UNLIMITED rooms, up to 240 min (4 hrs) duration, up to 500 members capacity!
  // Ultra: max 5 rooms per day, max 120 min (2 hr) duration
  // Basic: max 3 rooms per day, max 60 min (1 hr) duration
  // Free: max 2 rooms per day, max 30 min duration
  const maxRoomsPerDay = isAdmin ? Infinity : (
    userTier === 'ULTRA' ? 5 :
    userTier === 'BASIC' ? 3 :
    2
  );

  const maxDurationMinutesAllowed = isAdmin ? 240 : (
    userTier === 'ULTRA' ? 120 :
    userTier === 'BASIC' ? 60 :
    30
  );

  const durationOptions = useMemo(() => {
    if (isAdmin) return [15, 30, 45, 60, 90, 120, 180, 240];
    if (userTier === 'ULTRA') return [30, 60, 90, 120];
    if (userTier === 'BASIC') return [15, 30, 45, 60];
    return [30];
  }, [isAdmin, userTier]);

  const maxRoomCapacityAllowed = isAdmin ? 500 : (
    userTier === 'ULTRA' ? 100 :
    userTier === 'BASIC' ? 35 :
    15
  );

  const isCreateRoomGloballyHidden = false;

  // ── Daily Created Rooms Tracking ──────────────────────────────────────────
  const [todayCreatedRoomsCount, setTodayCreatedRoomsCount] = useState<number>(0);
  const [upgradePromptReason, setUpgradePromptReason] = useState<'DAILY_ROOM_LIMIT' | 'HOST_BATTLE' | null>(null);

  const getTodayDateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const getRecordedCreatedRoomsToday = () => {
    try {
      const key = `group_study_created_rooms_${user?.id || 'guest'}_${getTodayDateKey()}`;
      return parseInt(localStorage.getItem(key) || '0', 10);
    } catch {
      return 0;
    }
  };

  const recordCreatedRoomToday = () => {
    if (isAdmin) return;
    try {
      const key = `group_study_created_rooms_${user?.id || 'guest'}_${getTodayDateKey()}`;
      const updated = getRecordedCreatedRoomsToday() + 1;
      localStorage.setItem(key, String(updated));
      setTodayCreatedRoomsCount(updated);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setTodayCreatedRoomsCount(getRecordedCreatedRoomsToday());
    }
  }, [isOpen, user?.id]);

  // ── Rooms & Navigation State ──────────────────────────────────────────────
  const [activeRooms, setActiveRooms] = useState<GroupStudyRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<GroupStudyRoom | null>(() => activeRoom || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinCodeError, setJoinCodeError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'MCQ' | 'LEADERBOARD' | 'MEMBERS'>('MCQ');

  // ── Password Protection State for Joining ─────────────────────────────────
  const [passwordModalRoom, setPasswordModalRoom] = useState<GroupStudyRoom | null>(null);
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);

  // ── Create Room Form State ────────────────────────────────────────────────
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomSubject, setNewRoomSubject] = useState<string>('Lucent Samanya Gyan');
  const [newRoomPassword, setNewRoomPassword] = useState<string>('');
  const [showCreatePassword, setShowCreatePassword] = useState<boolean>(false);
  const [newRoomMcqType, setNewRoomMcqType] = useState<StudyRoomMcqType>('PROJECTOR_MODE');
  const [newRoomDurationMinutes, setNewRoomDurationMinutes] = useState<number>(maxDurationMinutesAllowed);
  const [newRoomMaxMembers, setNewRoomMaxMembers] = useState<number>(30);
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState<boolean>(false);
  const [selectedPreloadLesson, setSelectedPreloadLesson] = useState<any | null>(null);
  const [createModeClass, setCreateModeClass] = useState<string>('10');
  const [createModeSubject, setCreateModeSubject] = useState<string>('ALL');
  const [createModeSearch, setCreateModeSearch] = useState<string>('');
  const [createModeSourceFilter, setCreateModeSourceFilter] = useState<'ALL' | 'NOTES' | 'HOMEWORK' | 'REVISION_HUB'>('ALL');

  // ── Room Time Expiry Countdown ────────────────────────────────────────────
  const [roomSecondsLeft, setRoomSecondsLeft] = useState<number>(0);

  // ── Chat & Doubts State ───────────────────────────────────────────────────
  const [chatMessage, setChatMessage] = useState<string>('');
  const [chatFilter, setChatFilter] = useState<'ALL' | 'DOUBTS'>('ALL');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Live MCQ Battle State ─────────────────────────────────────────────────
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState<boolean>(false);
  const [mcqSecondsLeft, setMcqSecondsLeft] = useState<number>(20);
  const [selectedCuratedSet, setSelectedCuratedSet] = useState<string>('');
  const [lastXpOutcome, setLastXpOutcome] = useState<McqAnswerOutcome | null>(null);
  const [showXpBanner, setShowXpBanner] = useState<boolean>(false);
  const [selectedTimerDuration, setSelectedTimerDuration] = useState<number>(20);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState<number>(3);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(true);
  const [showLiveAnswersSheet, setShowLiveAnswersSheet] = useState<boolean>(true);
  const [selectedReviewQIdx, setSelectedReviewQIdx] = useState<number | null>(null);

  // ── Free Chapter MCQ Chooser for Host (0 Credits) ─────────────────────────
  const [showChapterChooser, setShowChapterChooser] = useState<boolean>(false);
  const [chooserClass, setChooserClass] = useState<string>('ALL');
  const [chooserSubject, setChooserSubject] = useState<string>('ALL');
  const [chooserSearch, setChooserSearch] = useState<string>('');
  const [chooserSource, setChooserSource] = useState<'ALL' | 'REVISION_HUB' | 'NOTES' | 'HOMEWORK'>('ALL');
  const [isLoadingChapterMcq, setIsLoadingChapterMcq] = useState<boolean>(false);
  const [firebaseMcqLessons, setFirebaseMcqLessons] = useState<any[]>([]);

  // Subscribe to real-time mcq_lessons from Firebase / cache
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeMcqLessons((lessons) => {
      setFirebaseMcqLessons(lessons || []);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [isOpen]);

  // Keep ref to onActiveRoomChange
  const onActiveRoomChangeRef = useRef(onActiveRoomChange);
  useEffect(() => {
    onActiveRoomChangeRef.current = onActiveRoomChange;
  });

  // Sync external activeRoom changes
  useEffect(() => {
    if (activeRoom && (!currentRoom || currentRoom.id !== activeRoom.id)) {
      setCurrentRoom(activeRoom);
    }
  }, [activeRoom?.id]);

  // ── Unified Real MCQ Lessons Actually Added in the App ────────────────────
  // STRICT: Only lessons that actually contain questions are included!
  const allRealLessons = useMemo(() => {
    const lessonsMap = new Map<string, {
      id: string;
      lessonTitle: string;
      classLevel: string;
      subject: string;
      board?: string;
      questions: GroupStudyMcqQuestion[];
      mcqCount: number;
      sourceType: 'REVISION_HUB' | 'NOTES' | 'HOMEWORK' | 'CURATED' | 'CONTEXT';
    }>();

    // 1. From Firebase mcq_lessons (Admin Class MCQs & Competition MCQs - Revision Hub)
    (firebaseMcqLessons || []).forEach((l: any) => {
      if (!l) return;
      const title = (l.lessonTitle || l.title || l.name || '').trim();
      if (!title) return;

      const rawQs = Array.isArray(l.mcqs) ? l.mcqs : (Array.isArray(l.mcqList) ? l.mcqList : (Array.isArray(l.parsedMcqs) ? l.parsedMcqs : []));
      const cleanQs: GroupStudyMcqQuestion[] = [];
      for (const q of rawQs) {
        const parsed = parseQuestionToGroupMcq(q);
        if (parsed) cleanQs.push(parsed);
      }

      if (cleanQs.length === 0) return; // Only include if it actually has MCQs!

      let cls = String(l.classLevel || '').trim().toUpperCase();
      if (cls.startsWith('CLASS_') || cls.startsWith('CLASS ')) cls = cls.replace(/CLASS[_ ]/i, '');
      if (!cls || cls === 'ALL' || cls === 'LUCENT') cls = 'COMPETITION';

      const key = `${cls}__${title.toLowerCase()}`;
      lessonsMap.set(key, {
        id: l.id || `mcq_${title}`,
        lessonTitle: title,
        classLevel: cls,
        subject: l.subject || 'General',
        board: l.board,
        questions: cleanQs,
        mcqCount: cleanQs.length,
        sourceType: 'REVISION_HUB',
      });
    });

    // 2. From Admin Lucent & Class Notes in settings
    if (Array.isArray(settings?.lucentNotes)) {
      for (const n of settings.lucentNotes) {
        if (!n || !n.lessonTitle) continue;
        const title = n.lessonTitle.trim();
        if (!title) continue;

        let cls = String(n.classLevel || '').trim().toUpperCase();
        if (cls.startsWith('CLASS_') || cls.startsWith('CLASS ')) cls = cls.replace(/CLASS[_ ]/i, '');
        if (!cls || cls === 'ALL' || cls === 'LUCENT') cls = 'COMPETITION';

        const key = `${cls}__${title.toLowerCase()}`;
        if (lessonsMap.has(key)) continue;

        const cleanQs: GroupStudyMcqQuestion[] = [];
        if (Array.isArray(n.pages)) {
          for (const page of n.pages) {
            if (!page) continue;
            let found = false;
            for (const qKey of ['mcqs', 'parsedMcqs', 'mcqList'] as const) {
              if (Array.isArray(page[qKey])) {
                for (const q of page[qKey]) {
                  const parsed = parseQuestionToGroupMcq(q);
                  if (parsed) {
                    cleanQs.push(parsed);
                    found = true;
                  }
                }
              }
            }
            if (!found && typeof page.mcqText === 'string' && page.mcqText.trim()) {
              try {
                const parsed = parseMCQText(page.mcqText.trim());
                if (parsed && Array.isArray(parsed.questions)) {
                  for (const q of parsed.questions) {
                    const pq = parseQuestionToGroupMcq(q);
                    if (pq) cleanQs.push(pq);
                  }
                }
              } catch (_) {}
            }
          }
        }

        if (cleanQs.length === 0) continue; // Only include if it actually has MCQs!

        lessonsMap.set(key, {
          id: n.id || `note_${title}`,
          lessonTitle: title,
          classLevel: cls,
          subject: n.subject || 'General',
          board: n.board,
          questions: cleanQs,
          mcqCount: cleanQs.length,
          sourceType: 'NOTES',
        });
      }
    }

    // 3. From Admin Homework & Competition Homework in settings
    if (Array.isArray(settings?.homework)) {
      for (const hw of settings.homework) {
        if (!hw) continue;
        const title = (hw.lessonTitle || hw.title || hw.name || hw.targetSubject || '').trim();
        if (!title) continue;

        let cls = String(hw.classTarget || hw.classLevel || '').trim().toUpperCase();
        if (cls.startsWith('CLASS_') || cls.startsWith('CLASS ')) cls = cls.replace(/CLASS[_ ]/i, '');
        if (!cls || cls === 'ALL' || cls === 'LUCENT' || cls === 'COMP') cls = 'COMPETITION';

        const key = `${cls}__${title.toLowerCase()}`;
        if (lessonsMap.has(key)) continue;

        const cleanQs: GroupStudyMcqQuestion[] = [];
        for (const qKey of ['parsedMcqs', 'mcqs', 'mcqList'] as const) {
          if (Array.isArray(hw[qKey])) {
            for (const q of hw[qKey]) {
              const parsed = parseQuestionToGroupMcq(q);
              if (parsed) cleanQs.push(parsed);
            }
          }
        }

        if (Array.isArray(hw.pages)) {
          for (const page of hw.pages) {
            if (!page) continue;
            let found = false;
            for (const qKey of ['mcqs', 'parsedMcqs', 'mcqList'] as const) {
              if (Array.isArray(page[qKey])) {
                for (const q of page[qKey]) {
                  const parsed = parseQuestionToGroupMcq(q);
                  if (parsed) {
                    cleanQs.push(parsed);
                    found = true;
                  }
                }
              }
            }
            if (!found && typeof page.mcqText === 'string' && page.mcqText.trim()) {
              try {
                const parsed = parseMCQText(page.mcqText.trim());
                if (parsed && Array.isArray(parsed.questions)) {
                  for (const q of parsed.questions) {
                    const pq = parseQuestionToGroupMcq(q);
                    if (pq) cleanQs.push(pq);
                  }
                }
              } catch (_) {}
            }
          }
        }

        if (cleanQs.length === 0 && typeof hw.mcqText === 'string' && hw.mcqText.trim()) {
          try {
            const parsed = parseMCQText(hw.mcqText.trim());
            if (parsed && Array.isArray(parsed.questions)) {
              for (const q of parsed.questions) {
                const pq = parseQuestionToGroupMcq(q);
                if (pq) cleanQs.push(pq);
              }
            }
          } catch (_) {}
        }

        if (cleanQs.length === 0) continue;

        lessonsMap.set(key, {
          id: hw.id || `hw_${title}`,
          lessonTitle: title,
          classLevel: cls,
          subject: hw.targetSubject || hw.subject || 'Competition Homework',
          board: hw.board,
          questions: cleanQs,
          mcqCount: cleanQs.length,
          sourceType: 'HOMEWORK',
        });
      }
    }

    // 4. Built-in curated sets (Lucent Samanya Gyan, General Science, etc.)
    CURATED_MCQ_SETS.forEach((s) => {
      if (s.questions && s.questions.length > 0) {
        const key = `COMPETITION__${s.name.toLowerCase()}`;
        if (!lessonsMap.has(key)) {
          lessonsMap.set(key, {
            id: s.id,
            lessonTitle: s.name,
            classLevel: 'COMPETITION',
            subject: s.subject || 'Competition',
            questions: s.questions,
            mcqCount: s.questions.length,
            sourceType: 'CURATED',
          });
        }
      }
    });

    // 5. From prefilledContext if present
    if (prefilledContext && Array.isArray(prefilledContext.mcqData) && prefilledContext.mcqData.length > 0) {
      const cleanQs: GroupStudyMcqQuestion[] = [];
      for (const q of prefilledContext.mcqData) {
        const parsed = parseQuestionToGroupMcq(q);
        if (parsed) cleanQs.push(parsed);
      }
      if (cleanQs.length > 0) {
        const title = prefilledContext.chapterTitle || prefilledContext.title || 'Selected Topic MCQ';
        const cls = String(prefilledContext.classLevel || user.classLevel || '10').replace(/class[_ ]/i, '').toUpperCase();
        const key = `${cls}__${title.toLowerCase()}`;
        lessonsMap.set(key, {
          id: 'context_prefilled_lesson',
          lessonTitle: title,
          classLevel: cls || '10',
          subject: prefilledContext.subject || 'General',
          questions: cleanQs,
          mcqCount: cleanQs.length,
          sourceType: 'CONTEXT',
        });
      }
    }

    return Array.from(lessonsMap.values());
  }, [firebaseMcqLessons, settings?.lucentNotes, settings?.homework, prefilledContext, user.classLevel]);

  // Available classes in sorted order
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    allRealLessons.forEach((l) => {
      if (l.classLevel) classSet.add(l.classLevel);
    });
    const order = ['10', '12', '9', '8', '7', '6', '11', 'COMPETITION'];
    return Array.from(classSet).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [allRealLessons]);

  // Filter lessons by chosen class
  const lessonsForSelectedClass = useMemo(() => {
    if (chooserClass === 'ALL') return allRealLessons;
    return allRealLessons.filter((l) => l.classLevel === chooserClass);
  }, [allRealLessons, chooserClass]);

  // Available subjects for the chosen class
  const availableSubjectsForClass = useMemo(() => {
    const subjSet = new Set<string>();
    lessonsForSelectedClass.forEach((l) => {
      if (l.subject) subjSet.add(l.subject);
    });
    return Array.from(subjSet).sort();
  }, [lessonsForSelectedClass]);

  // Filtered lessons by source, class, subject, and search query
  const filteredRealLessons = useMemo(() => {
    let list = lessonsForSelectedClass;
    if (chooserSource !== 'ALL') {
      list = list.filter((l) => l.sourceType === chooserSource);
    }
    if (chooserSubject !== 'ALL') {
      list = list.filter((l) => l.subject === chooserSubject);
    }
    if (chooserSearch.trim()) {
      const q = chooserSearch.trim().toLowerCase();
      list = list.filter((l) =>
        l.lessonTitle.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        (l.classLevel && l.classLevel.toLowerCase().includes(q))
      );
    }
    return list;
  }, [lessonsForSelectedClass, chooserSource, chooserSubject, chooserSearch]);

  // ── Build Available Real MCQ Sets from Syllabus / Context / App Data ─────
  const availableBattleSets = useMemo(() => {
    const sets: Array<{ id: string; name: string; subject: string; emoji: string; questions: GroupStudyMcqQuestion[] }> = [];

    // 1. From prefilledContext if launched from a chapter/topic
    if (prefilledContext && prefilledContext.mcqData && Array.isArray(prefilledContext.mcqData)) {
      const qs: GroupStudyMcqQuestion[] = prefilledContext.mcqData
        .map((q: any) => parseQuestionToGroupMcq(q))
        .filter(Boolean) as GroupStudyMcqQuestion[];

      if (qs.length > 0) {
        sets.push({
          id: 'context_chapter_set',
          name: prefilledContext.chapterTitle || prefilledContext.title || 'Selected Chapter MCQ',
          subject: prefilledContext.subject || 'General',
          emoji: '🎯',
          questions: qs,
        });
      }
    }

    // 2. From all real lessons in the app
    allRealLessons.forEach((l) => {
      sets.push({
        id: l.id,
        name: `${l.lessonTitle} (${l.classLevel === 'COMPETITION' ? 'Competition' : `Class ${l.classLevel}`} • ${l.subject})`,
        subject: l.subject,
        emoji: l.classLevel === 'COMPETITION' ? '🏆' : '📚',
        questions: l.questions,
      });
    });

    return sets;
  }, [prefilledContext, allRealLessons]);

  useEffect(() => {
    if (availableBattleSets.length > 0) {
      if (!availableBattleSets.some((s) => s.id === selectedCuratedSet)) {
        setSelectedCuratedSet(availableBattleSets[0].id);
      }
    } else {
      setSelectedCuratedSet('');
    }
  }, [availableBattleSets, selectedCuratedSet]);

  // ── Auto-populate create room from prefilledContext ───────────────────────
  useEffect(() => {
    if (isOpen && prefilledContext) {
      const titleText = (prefilledContext.chapterTitle || prefilledContext.title || '').trim();
      const generatedName = titleText
        ? `${titleText.slice(0, 28)} · Live MCQ`
        : `${prefilledContext.subject || 'Live'} · MCQ Battle`;

      setNewRoomName(generatedName);
      if (prefilledContext.subject) {
        setNewRoomSubject(prefilledContext.subject);
      }
      if (!currentRoom) {
        setShowCreateModal(true);
      }
    }
  }, [isOpen, prefilledContext]);

  const isHost = currentRoom
    ? (isRoomCreatedByMe(currentRoom.id, currentRoom.hostId, user?.id) ||
       Boolean(auth.currentUser?.uid && currentRoom.hostId === auth.currentUser.uid) ||
       (Boolean(user?.name && currentRoom.hostName) && user?.name?.toLowerCase() === currentRoom.hostName?.toLowerCase()) ||
       isAdmin)
    : false;
  const currentMember = currentRoom?.members?.[user?.id] || (auth.currentUser?.uid ? currentRoom?.members?.[auth.currentUser.uid] : undefined);

  // ── 1. Subscribe to Active Rooms in Lobby ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToActiveRooms((rooms) => {
      setActiveRooms(rooms);
    });
    return () => unsub();
  }, [isOpen]);

  // ── 2. Subscribe to Currently Joined Room ────────────────────────────────
  useEffect(() => {
    const roomId = currentRoom?.id;
    if (!roomId) return;
    const unsub = subscribeToRoom(roomId, (room) => {
      if (!room) {
        setCurrentRoom(null);
        onActiveRoomChangeRef.current?.(null);
        return;
      }
      setCurrentRoom(room);
      onActiveRoomChangeRef.current?.(room);
    });

    return () => unsub();
  }, [currentRoom?.id]);

  // ── 3. Synchronized Room Expiry Countdown & Auto-Submit ──────────────────
  useEffect(() => {
    if (!currentRoom) return;

    const calculateRemaining = () => {
      const expiry = currentRoom.expiresAt || (currentRoom.createdAt + (currentRoom.durationMinutes || 30) * 60 * 1000);
      const diffMs = expiry - Date.now();
      const remainingSec = Math.max(0, Math.floor(diffMs / 1000));
      setRoomSecondsLeft(remainingSec);

      // Auto-submit when time expires!
      if (remainingSec <= 0 && !currentRoom.isExpired) {
        handleTimeExpiredAutoSubmit();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [currentRoom?.id, currentRoom?.expiresAt, currentRoom?.isExpired]);

  const handleTimeExpiredAutoSubmit = async () => {
    if (!currentRoom) return;
    try {
      // Award final unbroken streak bonus for the current user
      if (user?.id) {
        const streakBonus = await awardFinalStreakBonus(currentRoom.id, user.id);
        if (streakBonus > 0 && onUserUpdate) {
          const currentXp = user.xp || user.totalScore || 0;
          const updatedUser = {
            ...user,
            xp: currentXp + streakBonus,
            totalScore: currentXp + streakBonus,
          };
          onUserUpdate(updatedUser);
        }
      }

      // If host, update room state in RTDB to auto-submit
      if (isHost) {
        await autoSubmitRoom(currentRoom.id);
      }
    } catch (err) {
      console.warn('Auto-submit execution error:', err);
    }
  };

  // ── 4. Synchronized Live MCQ Question Countdown & Auto-Advance ─────────
  useEffect(() => {
    if (!currentRoom || !currentRoom.liveMcq?.isActive) return;
    const { liveMcq } = currentRoom;

    let interval: any = null;
    if (liveMcq.status === 'QUESTION' && liveMcq.questionStartTime) {
      const updateMcqTick = () => {
        const elapsedSec = Math.floor((Date.now() - liveMcq.questionStartTime) / 1000);
        const remaining = Math.max(0, liveMcq.durationPerQuestion - elapsedSec);
        setMcqSecondsLeft(remaining);

        // Auto-reveal if time expires and host hasn't revealed
        if (remaining <= 0 && isHost && liveMcq.status === 'QUESTION') {
          revealMcqAnswer(currentRoom.id);
          return;
        }

        // Also if all active members in the room have answered before time expires
        const curQIdx = liveMcq.currentQuestionIndex;
        const qAnswers = liveMcq.questionAnswers?.[curQIdx] || {};
        const membersCount = Object.keys(currentRoom.members || {}).length;
        if (
          isHost &&
          membersCount > 0 &&
          Object.keys(qAnswers).length >= membersCount &&
          remaining > 2 &&
          liveMcq.status === 'QUESTION'
        ) {
          revealMcqAnswer(currentRoom.id);
        }
      };

      updateMcqTick();
      interval = setInterval(updateMcqTick, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    currentRoom?.liveMcq?.status,
    currentRoom?.liveMcq?.questionStartTime,
    currentRoom?.liveMcq?.durationPerQuestion,
    currentRoom?.liveMcq?.questionAnswers,
    currentRoom?.members,
    isHost,
  ]);

  // ── Auto-advance Countdown during REVEAL ──
  useEffect(() => {
    if (!currentRoom || !currentRoom.liveMcq?.isActive) return;
    const { liveMcq } = currentRoom;

    if (liveMcq.status !== 'REVEAL') {
      setRevealSecondsLeft(3);
      return;
    }

    const shouldAutoAdvance = liveMcq.autoAdvance !== false && autoAdvanceEnabled;
    if (!shouldAutoAdvance) return;

    setRevealSecondsLeft(3);
    const revealTimer = setInterval(() => {
      setRevealSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(revealTimer);
          if (isHost && liveMcq.status === 'REVEAL') {
            handleNextMcqQuestion();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(revealTimer);
  }, [
    currentRoom?.liveMcq?.status,
    currentRoom?.liveMcq?.currentQuestionIndex,
    currentRoom?.liveMcq?.autoAdvance,
    autoAdvanceEnabled,
    isHost,
  ]);

  // Reset local answer selection on new question
  useEffect(() => {
    setSelectedOption(null);
    setHasAnsweredCurrentQ(false);
    setShowXpBanner(false);
  }, [currentRoom?.liveMcq?.currentQuestionIndex]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentRoom?.chat]);

  // ── Action Handlers: Create Room ──────────────────────────────────────────
  const handleOpenCreateModal = () => {
    if (isCreateRoomGloballyHidden) {
      alert('Naya Study Room create karne ka option admin dwara band kiya gaya hai.');
      return;
    }
    if (!isAdmin && todayCreatedRoomsCount >= maxRoomsPerDay) {
      setUpgradePromptReason('DAILY_ROOM_LIMIT');
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRoomName = newRoomName.trim() || `${user?.name || 'Live'} MCQ Arena`;
    const cleanPassword = newRoomPassword.trim();

    // Mandated: Password cannot be empty!
    if (!cleanPassword) {
      alert('Room ka Password daalna zaroori hai! Bina password ke room create nahi ho sakta.');
      return;
    }

    if (isCreateRoomGloballyHidden) {
      setShowCreateModal(false);
      alert('Naya Study Room create karne ka option admin dwara band kiya gaya hai.');
      return;
    }

    if (!isAdmin && todayCreatedRoomsCount >= maxRoomsPerDay) {
      setShowCreateModal(false);
      setUpgradePromptReason('DAILY_ROOM_LIMIT');
      return;
    }

    setIsLoading(true);
    try {
      const effectiveUid = auth.currentUser?.uid || user?.id || 'guest';
      const effectiveName = user?.name || auth.currentUser?.displayName || 'Host';

      const durationMinutes = Math.min(newRoomDurationMinutes || 30, maxDurationMinutesAllowed);

      const roomId = await createGroupRoom(
        {
          name: effectiveRoomName,
          subject: newRoomSubject || 'General Knowledge',
          mode: 'LIVE_MCQ',
          mcqType: newRoomMcqType,
          password: cleanPassword,
          durationMinutes,
          maxMembers: Math.min(newRoomMaxMembers || 30, maxRoomCapacityAllowed),
          isPrivate: !!newRoomIsPrivate,
        },
        {
          id: effectiveUid,
          name: effectiveName,
          photoURL: user?.photoURL || auth.currentUser?.photoURL || '',
          level: user?.level || 1,
        }
      );

      recordCreatedRoomToday();
      markRoomAsCreatedByMe(roomId);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomPassword('');

      // Instantly open room for host from local cache
      const cached = getCachedRooms()[roomId];
      if (cached) {
        setCurrentRoom(cached);
        if (onActiveRoomChange) onActiveRoomChange(cached);
      }

      // Launch selected preloaded lesson MCQs or prefilled MCQs immediately if available
      const lessonToLaunch = selectedPreloadLesson || (
        prefilledContext?.mcqData && Array.isArray(prefilledContext.mcqData) && prefilledContext.mcqData.length > 0
          ? {
              lessonTitle: prefilledContext.chapterTitle || prefilledContext.title || 'Chapter MCQ Battle',
              questions: prefilledContext.mcqData
                .map((q: any) => ({
                  question: q.question,
                  options: (q.options || []).slice(0, 4),
                  correctIndex: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
                  explanation: q.explanation || '',
                }))
                .filter((q: any) => q.question && q.options.length >= 2),
            }
          : null
      );

      if (lessonToLaunch && Array.isArray(lessonToLaunch.questions) && lessonToLaunch.questions.length > 0) {
        try {
          await startLiveMcqBattle(
            roomId,
            lessonToLaunch.lessonTitle,
            lessonToLaunch.questions,
            newRoomMcqType === 'REVISION_HUB' ? 15 : 25
          );
        } catch (e) {
          console.warn('Could not auto-start prefilled MCQ battle:', e);
        }
      }
      setSelectedPreloadLesson(null);

      // Safely set the current room with one-shot subscription
      let unsubRoom: (() => void) | null = null;
      unsubRoom = subscribeToRoom(roomId, (room) => {
        if (room) {
          setCurrentRoom(room);
          if (onActiveRoomChange) onActiveRoomChange(room);
        }
        if (unsubRoom) {
          unsubRoom();
        } else {
          setTimeout(() => {
            if (unsubRoom) unsubRoom();
          }, 0);
        }
      });
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('Could not create room: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Action Handlers: Join Room with Password Prompt ───────────────────────
  const handleInitiateJoin = (room: GroupStudyRoom) => {
    // If user is the host of the room, they can enter directly without password check
    const userIsHost = isRoomCreatedByMe(room.id, room.hostId, user?.id) ||
      (Boolean(auth.currentUser?.uid) && room.hostId === auth.currentUser.uid) ||
      (Boolean(user?.name && room.hostName) && user?.name?.toLowerCase() === room.hostName?.toLowerCase()) ||
      isAdmin;

    if (userIsHost) {
      handleJoinRoom(room);
      return;
    }

    // If room has no password, enter directly
    if (!room.password || !room.password.trim()) {
      handleJoinRoom(room);
      return;
    }

    // Open password verification modal
    setPasswordModalRoom(room);
    setEnteredPassword('');
    setPasswordError('');
  };

  const handleVerifyPasswordAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalRoom) return;

    const correctPassword = passwordModalRoom.password?.trim() || '';
    const typedPassword = enteredPassword.trim();

    if (!correctPassword || typedPassword.toLowerCase() === correctPassword.toLowerCase() || typedPassword === correctPassword) {
      const roomToJoin = passwordModalRoom;
      setPasswordModalRoom(null);
      await handleJoinRoom(roomToJoin);
    } else {
      setPasswordError('Galat Password! Kripya Host se sahi room password maangein.');
    }
  };

  const handleJoinRoom = async (room: GroupStudyRoom) => {
    setIsLoading(true);
    // Instantly transition into room in UI so user is never blocked or left in lobby
    setCurrentRoom(room);
    if (onActiveRoomChange) onActiveRoomChange(room);

    try {
      await joinGroupRoom(room.id, {
        id: user?.id || auth.currentUser?.uid || 'guest',
        name: user?.name || auth.currentUser?.displayName || 'Student',
        photoURL: user?.photoURL || auth.currentUser?.photoURL || '',
        level: user?.level || 1,
      });
    } catch (err: any) {
      console.warn('[GroupStudy] Background join error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim()?.toUpperCase();
    if (!code) return;

    setJoinCodeError('');
    setIsLoading(true);
    try {
      const found = activeRooms.find((r) => r.code?.toUpperCase() === code);
      if (!found) {
        setJoinCodeError('Room not found or session has ended. Please check code.');
        setIsLoading(false);
        return;
      }
      setJoinCodeInput('');
      handleInitiateJoin(found);
    } catch (err: any) {
      setJoinCodeError(err.message || 'Failed to join');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    if (confirm('Kya aap is Group Study Room se bahar aana chahte hain?')) {
      const rId = currentRoom.id;
      setCurrentRoom(null);
      if (onActiveRoomChange) onActiveRoomChange(null);
      await leaveGroupRoom(rId, user?.id || 'guest', user?.name || 'Student');
    }
  };

  const handleDestroyRoom = async (targetRoomId?: string) => {
    const roomId = targetRoomId || currentRoom?.id;
    if (!roomId) return;
    if (confirm('⚠️ Kya aap is Study Room ko poori tarah DESTROY / DELETE karna chahte hain? Sabhi jude hue members room se bahar ho jayenge aur room list se hat jayega.')) {
      setIsLoading(true);
      try {
        if (currentRoom?.id === roomId) {
          setCurrentRoom(null);
          if (onActiveRoomChange) onActiveRoomChange(null);
        }
        await deleteGroupRoom(roomId);
      } catch (err: any) {
        console.error('Failed to destroy room:', err);
        alert('Room delete nahi ho paya: ' + (err.message || 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopyCode = () => {
    if (!currentRoom?.code) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent, isDoubt: boolean = false) => {
    e.preventDefault();
    if (!currentRoom || !chatMessage.trim()) return;

    sendRoomMessage(
      currentRoom.id,
      {
        id: user?.id || 'guest',
        name: user?.name || 'Student',
        photoURL: user?.photoURL,
      },
      chatMessage.trim(),
      isDoubt ? 'DOUBT' : 'MESSAGE'
    );
    setChatMessage('');
  };

  // ── MCQ Battle Handlers & Host Free Lesson Launch ─────────────────────────
  const handleLaunchCuratedMcq = async () => {
    if (!currentRoom || !isHost) return;
    const selectedSet = availableBattleSets.find((s) => s.id === selectedCuratedSet);
    if (!selectedSet || !selectedSet.questions.length) return;

    const duration = selectedTimerDuration || (
      currentRoom.mcqType === 'REVISION_HUB' ? 15 : (currentRoom.mcqType === 'PROJECTOR_MODE' ? 25 : 20)
    );

    await startLiveMcqBattle(
      currentRoom.id,
      selectedSet.name,
      selectedSet.questions,
      duration,
      autoAdvanceEnabled
    );
  };

  // Host launches ANY real lesson MCQ for FREE (0 credits)
  const handleLaunchRealLessonMcq = async (lesson: {
    id: string;
    lessonTitle: string;
    classLevel?: string;
    subject?: string;
    questions: GroupStudyMcqQuestion[];
  }) => {
    if (!currentRoom || !isHost) return;
    if (!lesson.questions || lesson.questions.length === 0) {
      alert('Is lesson me koi MCQ uplabdh nahi hai.');
      return;
    }

    setIsLoadingChapterMcq(true);
    try {
      const duration = selectedTimerDuration || (
        currentRoom.mcqType === 'REVISION_HUB' ? 15 : (currentRoom.mcqType === 'PROJECTOR_MODE' ? 25 : 20)
      );

      const displayTitle = `${lesson.lessonTitle} (${lesson.classLevel === 'COMPETITION' ? 'Competition' : `Class ${lesson.classLevel}`} • ${lesson.subject || 'MCQ'})`;

      await startLiveMcqBattle(
        currentRoom.id,
        displayTitle,
        lesson.questions,
        duration,
        autoAdvanceEnabled
      );

      setShowChapterChooser(false);
    } catch (err: any) {
      alert('MCQ shuru karne me samasya: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingChapterMcq(false);
    }
  };

  // Host launches ANY lesson MCQ for FREE (0 credits)
  const handleLaunchFreeLessonMcq = async (chapterTitle: string, subjectKey: string) => {
    if (!currentRoom || !isHost) return;
    setIsLoadingChapterMcq(true);
    try {
      let questions: GroupStudyMcqQuestion[] = [];

      // 1. Fetch from Firestore / local storage via getChapterData
      try {
        const chapterData = await getChapterData(chapterTitle) || await getChapterData(`nst_${chapterTitle}`);
        if (chapterData && Array.isArray(chapterData.mcq) && chapterData.mcq.length > 0) {
          questions = chapterData.mcq.map((q: any) => ({
            question: q.question,
            options: (q.options || []).slice(0, 4),
            correctIndex: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
            explanation: q.explanation || '',
          })).filter((q: any) => q.question && q.options.length >= 2);
        }
      } catch (e) {
        console.warn('Chapter MCQ fetch note:', e);
      }

      // 2. If chapter didn't have stored MCQs, pick from syllabus bank or curated sets
      if (questions.length === 0) {
        const fallbackSet = availableBattleSets[0];
        if (fallbackSet && fallbackSet.questions.length > 0) {
          questions = fallbackSet.questions.slice(0, 15);
        }
      }

      if (questions.length === 0) {
        alert('Is chapter ke MCQs abhi taiyaar nahi hain. Kripya doosra chapter chunein.');
        return;
      }

      const duration = selectedTimerDuration || (
        currentRoom.mcqType === 'REVISION_HUB' ? 15 : (currentRoom.mcqType === 'PROJECTOR_MODE' ? 25 : 20)
      );

      await startLiveMcqBattle(
        currentRoom.id,
        `${chapterTitle} · Free Lesson MCQ`,
        questions,
        duration,
        autoAdvanceEnabled
      );

      setShowChapterChooser(false);
    } catch (err: any) {
      alert('MCQ shuru karne me samasya: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingChapterMcq(false);
    }
  };

  // Host adjusts question timer on the fly
  const handleSetDuration = async (sec: number) => {
    setSelectedTimerDuration(sec);
    if (currentRoom?.id && isHost) {
      await setRoomMcqDuration(currentRoom.id, sec);
    }
  };

  // Host toggles auto-advance
  const handleToggleAutoAdvance = async () => {
    const nextVal = !autoAdvanceEnabled;
    setAutoAdvanceEnabled(nextVal);
    if (currentRoom?.id && isHost) {
      await setRoomMcqAutoAdvance(currentRoom.id, nextVal);
    }
  };

  // Host manually finishes and submits battle early
  const handleForceEndBattle = async () => {
    if (!currentRoom?.id || !isHost || !currentRoom.liveMcq) return;
    const confirmEnd = window.confirm('Kya aap sach me Live MCQ Battle submit karke sabhi ko final data dikhana chahte hain?');
    if (!confirmEnd) return;
    await advanceMcqQuestion(currentRoom.id, currentRoom.liveMcq.currentQuestionIndex, true);
    if (user?.id) {
      await awardFinalStreakBonus(currentRoom.id, user.id);
    }
  };

  // Student/Member submits answer
  const handleSelectOption = async (optIdx: number) => {
    if (!currentRoom || hasAnsweredCurrentQ || !currentRoom.liveMcq) return;
    setSelectedOption(optIdx);
    setHasAnsweredCurrentQ(true);

    const q = currentRoom.liveMcq.questions[currentRoom.liveMcq.currentQuestionIndex];
    const isCorrect = optIdx === q.correctIndex;
    const durationLimit = currentRoom.liveMcq.durationPerQuestion || 20;
    const timeTaken = Math.max(0.5, durationLimit - mcqSecondsLeft);

    const outcome = await submitMcqAnswer(
      currentRoom.id,
      user?.id || 'guest',
      user?.name || 'Student',
      isCorrect,
      timeTaken,
      optIdx,
      currentRoom.liveMcq.currentQuestionIndex,
      user?.photoURL
    );

    setLastXpOutcome(outcome);
    setShowXpBanner(true);

    // Synchronize XP to user profile & localStorage & Firebase
    if (outcome.netXpChange !== 0 && user?.id) {
      const currentXp = user.xp || user.totalScore || 0;
      const newXp = Math.max(0, currentXp + outcome.netXpChange);
      const updatedUser = {
        ...user,
        xp: newXp,
        totalScore: newXp,
      };

      try {
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        localStorage.setItem(`nst_user_profile_${user.id}`, JSON.stringify(updatedUser));
      } catch (_) {}

      saveUserToLive(updatedUser, { immediate: true }).catch(() => {});
      onUserUpdate?.(updatedUser);
    }
  };

  const handleNextMcqQuestion = async () => {
    if (!currentRoom || !isHost || !currentRoom.liveMcq) return;
    const nextIdx = currentRoom.liveMcq.currentQuestionIndex + 1;
    if (nextIdx >= currentRoom.liveMcq.totalQuestions) {
      // End battle and award final streak bonus
      await advanceMcqQuestion(currentRoom.id, nextIdx, true);
      if (user?.id) {
        await awardFinalStreakBonus(currentRoom.id, user.id);
      }
    } else {
      await advanceMcqQuestion(currentRoom.id, nextIdx, false);
    }
  };

  const handleSwitchMcqType = async (type: StudyRoomMcqType) => {
    if (!currentRoom || !isHost) return;
    await setRoomMcqType(currentRoom.id, type);
  };

  // Filtered Live Rooms for Search
  const filteredActiveRooms = useMemo(() => {
    const q = roomSearchQuery.trim().toLowerCase();
    if (!q) return activeRooms;
    return activeRooms.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.subject && r.subject.toLowerCase().includes(q)) ||
        (r.hostName && r.hostName.toLowerCase().includes(q)) ||
        (r.code && r.code.toLowerCase().includes(q))
    );
  }, [activeRooms, roomSearchQuery]);

  const brandColor = tierTheme?.primary || '#6366f1';

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-sans"
      id="group-study-modal-overlay"
    >
      <div
        className="w-full h-full md:h-[92vh] md:max-w-4xl bg-slate-900 border border-slate-700/70 md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        style={{
          boxShadow: `0 25px 50px -12px ${brandColor}33`,
        }}
      >
        {/* ── TOP NAV BAR ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-md text-white shrink-0"
              style={{ background: brandColor }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm md:text-base tracking-wide text-white line-clamp-1">
                  {currentRoom ? currentRoom.name : 'Study Room · Live MCQ Arena'}
                </span>
                {currentRoom && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      currentRoom.mcqType === 'REVISION_HUB'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {currentRoom.mcqType === 'REVISION_HUB'
                      ? '⚡ MCQ +'
                      : '🎯 MCQ'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1">
                {currentRoom
                  ? `${currentRoom.subject} • ${Object.keys(currentRoom.members || {}).length} Online • Free MCQ Hosting`
                  : 'Live peer MCQ battles, instant XP (+5 / -2), streak bonuses & projector mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentRoom && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold ${
                  roomSecondsLeft <= 120
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                    : 'bg-slate-800/80 text-amber-300 border-slate-700'
                }`}
                title="Room Auto-Submit Timer"
              >
                <Clock size={13} />
                <span>{formatSeconds(roomSecondsLeft)}</span>
              </div>
            )}

            {currentRoom && (
              <button
                onClick={handleCopyCode}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 active:scale-95 transition"
                title="Room Code copy karein"
              >
                {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="font-mono text-[11px]">{currentRoom.code}</span>
              </button>
            )}

            {currentRoom && (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold active:scale-95 transition shadow-md cursor-pointer"
                title="App me padhein — Room active rahega aur screen pe Live symbol aayega"
              >
                <Minimize2 size={13} />
                <span className="hidden sm:inline">App Par Jayein</span>
              </button>
            )}

            {currentRoom && isHost && (
              <button
                onClick={() => handleDestroyRoom()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black active:scale-95 transition shadow-md cursor-pointer border border-rose-500"
                title="Host: Is Study Room ko destroy / delete karein"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Destroy Room</span>
              </button>
            )}

            {currentRoom && (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white text-xs font-bold active:scale-95 transition cursor-pointer"
                title="Room se bahar aayein"
              >
                Leave
              </button>
            )}

            {!currentRoom && (
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-black shadow-md active:scale-95 transition cursor-pointer"
                style={{ background: brandColor }}
              >
                <Plus size={14} />
                <span>+ Room Banayein</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition shrink-0 cursor-pointer"
              title={currentRoom ? 'Minimize Room' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── CONDITIONAL CONTENT: LOBBY vs ACTIVE ROOM ── */}
        {!currentRoom ? (
          /* ─────────────────────────────────────────────────────────────────
             LOBBY VIEW (Explore active live rooms, search by name, join via password)
          ─────────────────────────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Banner with Tier Quotas */}
            <div
              className="rounded-2xl p-5 relative overflow-hidden border border-indigo-500/30 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${brandColor}22, #0f172a 80%)`,
              }}
            >
              <div className="relative z-10 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                      isAdmin
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : userTier === 'ULTRA'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                        : userTier === 'BASIC'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {isAdmin
                      ? '👑 Admin: Unlimited Rooms & 4 Hr Max'
                      : userTier === 'ULTRA'
                      ? `👑 Ultra VIP: ${todayCreatedRoomsCount}/5 Daily Rooms (2 Hr Max)`
                      : userTier === 'BASIC'
                      ? `⭐ Basic Plan: ${todayCreatedRoomsCount}/3 Daily Rooms (1 Hr Max)`
                      : `🆓 Free User: ${todayCreatedRoomsCount}/2 Daily Rooms (30 Min Max)`}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    🎁 Free Lesson MCQs (0 Credits)
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">
                  Live MCQ Study Room me Doston ke Sath Muqabala Karein!
                </h2>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-4">
                  Har sahi jawab par <b>+5 XP</b> aur galat par <b>-2 XP</b>. Continuous streak todne par payein{' '}
                  <b>+10, +15, ya +20 XP Bonus</b>! Password enter karke room join karein ya apna room banayein.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {!isCreateRoomGloballyHidden && (
                    <button
                      onClick={handleOpenCreateModal}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-black text-xs md:text-sm shadow-xl active:scale-95 transition cursor-pointer"
                      style={{ background: brandColor }}
                    >
                      <Plus size={16} /> Apna MCQ Room Banayein
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-700 rounded-xl px-2.5 py-1">
                    <input
                      type="text"
                      placeholder="Enter 6-digit Code"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs font-mono uppercase text-white px-1 py-1 w-32 placeholder:text-slate-500"
                      maxLength={6}
                    />
                    <button
                      onClick={handleJoinByCode}
                      disabled={!joinCodeInput.trim() || isLoading}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      Join
                    </button>
                  </div>
                </div>

                {joinCodeError && (
                  <p className="text-xs font-bold text-rose-400 mt-2">{joinCodeError}</p>
                )}
              </div>
            </div>

            {/* Room Discovery & Search Header */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-emerald-400 animate-pulse" />
                  <h3 className="font-black text-base text-white">Live MCQ Rooms</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300">
                    {filteredActiveRooms.length} Live
                  </span>
                </div>

                {/* Search Input */}
                <div className="w-full sm:w-72 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by room name, subject or host..."
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                  {roomSearchQuery && (
                    <button
                      onClick={() => setRoomSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Rooms Grid */}
              {filteredActiveRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredActiveRooms.map((room) => {
                    const memberCount = Object.keys(room.members || {}).length;
                    const modeBadge =
                      room.mcqType === 'REVISION_HUB'
                        ? { label: '⚡ MCQ +', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
                        : { label: '🎯 MCQ', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };

                    const expiry = room.expiresAt || (room.createdAt + (room.durationMinutes || 30) * 60 * 1000);
                    const remainingMin = Math.max(0, Math.ceil((expiry - Date.now()) / (60 * 1000)));
                    const isMyRoom = isRoomCreatedByMe(room.id, room.hostId, user?.id) ||
                      (Boolean(auth.currentUser?.uid) && room.hostId === auth.currentUser.uid) ||
                      (Boolean(user?.name && room.hostName) && user?.name?.toLowerCase() === room.hostName?.toLowerCase()) ||
                      isAdmin;

                    return (
                      <div
                        key={room.id}
                        className={`border rounded-2xl p-4 transition flex flex-col justify-between group shadow-sm ${
                          isMyRoom 
                            ? 'bg-slate-800/90 border-emerald-500/50 shadow-emerald-950/30 ring-1 ring-emerald-500/30' 
                            : 'bg-slate-800/70 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${modeBadge.bg}`}>
                                {modeBadge.label}
                              </span>
                              {isMyRoom && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                  👑 Aap Host Hain
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock size={11} className="text-amber-400" />
                                <span className="text-slate-300 font-bold">{remainingMin}m</span> left
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                <span className="text-white font-bold">{memberCount}</span>/{room.maxMembers}
                              </span>
                            </div>
                          </div>

                          <h4 className="font-black text-sm text-white group-hover:text-indigo-300 transition line-clamp-1">
                            {room.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mb-3">
                            Topic: <span className="text-slate-200 font-semibold">{room.subject}</span>
                          </p>

                          <div className="flex items-center justify-between gap-2 mb-4 text-xs text-slate-400 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                {room.hostName?.charAt(0)?.toUpperCase() || 'H'}
                              </div>
                              <span>Host: {room.hostName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isMyRoom ? (
                                <>
                                  {room.password && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-md" title="Room password (sirf host ko dikhta hai)">
                                      🔑 PW: {room.password}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDestroyRoom(room.id);
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 hover:text-white bg-rose-950/50 hover:bg-rose-600 border border-rose-500/40 px-2 py-0.5 rounded-full transition cursor-pointer"
                                    title="Aap host hain: is room ko destroy / delete karein"
                                  >
                                    <Trash2 size={10} /> Delete Room
                                  </button>
                                </>
                              ) : (
                                room.password ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                    <Lock size={10} /> Password
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                    Open
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isMyRoom ? (
                            <button
                              type="button"
                              onClick={() => handleJoinRoom(room)}
                              disabled={isLoading}
                              className="flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white"
                            >
                              <Sparkles size={13} className="text-yellow-200" /> Enter Room (Aap Host Hain) <ChevronRight size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInitiateJoin(room)}
                              disabled={isLoading}
                              className="flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
                              style={{
                                background: brandColor,
                                color: '#ffffff',
                              }}
                            >
                              {room.password ? (
                                <>
                                  <Lock size={13} /> Join Room (Enter Password) <ChevronRight size={14} />
                                </>
                              ) : (
                                <>
                                  <Play size={13} /> Join Room <ChevronRight size={14} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center bg-slate-900/50">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                    <Trophy size={24} />
                  </div>
                  <h4 className="text-base font-black text-white mb-1">
                    {roomSearchQuery ? 'Search me koi room nahi mila' : 'Abhi koi Live MCQ Room nahi hai'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    {roomSearchQuery
                      ? 'Dusre keyword se search karein ya naya MCQ study room banayein.'
                      : 'Aap pehla Live MCQ room banakar password aur room code doston ke sath share karein!'}
                  </p>
                  {!isCreateRoomGloballyHidden && (
                    <button
                      onClick={handleOpenCreateModal}
                      className="px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-lg active:scale-95 transition inline-flex items-center gap-2 cursor-pointer"
                      style={{ background: brandColor }}
                    >
                      <Plus size={14} /> Pehla MCQ Room Banayein
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────────
             ACTIVE ROOM VIEW (Live MCQ Arena, Host Lesson Picker, Real-time XP & Podium)
          ─────────────────────────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Main Battle Stage */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-800">
              {/* Top Banner: Expiry Countdown & Host Controls */}
              <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Live Room Auto-Submit: {formatSeconds(roomSecondsLeft)}
                    </span>
                  </div>

                  {isHost && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">MCQ Mode:</span>
                      <button
                        onClick={() => handleSwitchMcqType('PROJECTOR_MODE')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                          currentRoom.mcqType === 'PROJECTOR_MODE' || currentRoom.mcqType === 'MCQ_PRACTICE'
                            ? 'bg-cyan-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title="Ek Lesson ke Pure MCQs (Notes, Lucent & Homework)"
                      >
                        🎯 MCQ
                      </button>
                      <button
                        onClick={() => handleSwitchMcqType('REVISION_HUB')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                          currentRoom.mcqType === 'REVISION_HUB'
                            ? 'bg-purple-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title="Revision Hub ke Subjects & Lessons"
                      >
                        ⚡ MCQ +
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">Rules:</span>
                    <span className="text-slate-300">
                      Sahi: <b className="text-emerald-400">+5 XP</b> | Galat: <b className="text-rose-400">-2 XP</b> |
                      Streak Bonus (3: <b className="text-amber-300">+10</b>, 5: <b className="text-amber-300">+15</b>, 7+: <b className="text-amber-300">+20</b>)
                    </span>
                  </div>

                  {isHost && (
                    <button
                      onClick={() => setShowChapterChooser(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                    >
                      <BookOpen size={13} /> Kisi Bhi Lesson Ka MCQ (Free - 0 Credits)
                    </button>
                  )}
                </div>
              </div>

              {/* Floating Dynamic XP Outcome Notification */}
              {showXpBanner && lastXpOutcome && (
                <div
                  className={`mb-3 p-3 rounded-2xl border flex items-center justify-between text-xs font-black animate-in slide-in-from-top duration-200 ${
                    lastXpOutcome.isCorrect
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : lastXpOutcome.streakBonusXp > 0
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{lastXpOutcome.isCorrect ? '🎉' : '⚠️'}</span>
                    <span>
                      {lastXpOutcome.isCorrect
                        ? `Sahi Uttar! +5 XP mila! 🔥 Current Streak: ${lastXpOutcome.currentStreak}`
                        : lastXpOutcome.streakBonusXp > 0
                        ? `Galat Answer (-2 XP) · 🏆 Streak Tooti (${lastXpOutcome.streakBrokenAt} streak) Bonus: +${lastXpOutcome.streakBonusXp} XP! (Net: +${lastXpOutcome.netXpChange} XP)`
                        : `Galat Answer (-2 XP). Agla sawal sahi karke naya streak banayein!`}
                    </span>
                  </div>
                  <span className="font-mono text-sm">
                    {lastXpOutcome.netXpChange >= 0 ? `+${lastXpOutcome.netXpChange}` : lastXpOutcome.netXpChange} XP
                  </span>
                </div>
              )}

              {/* Room Mode Tabs: MCQ vs LEADERBOARD vs MEMBERS */}
              <div className="flex items-center justify-between mb-4 bg-slate-950/60 p-2 rounded-2xl border border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('MCQ')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'MCQ'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy size={14} className="text-amber-400" />
                    <span>Live MCQ Battle</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('LEADERBOARD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'LEADERBOARD'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Award size={14} />
                    <span>Leaderboard & Scores</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('MEMBERS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'MEMBERS'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users size={14} />
                    <span>{Object.keys(currentRoom.members || {}).length} Online</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  Room: <b className="text-slate-200">{currentRoom.code}</b>
                </div>
              </div>

              {/* ── TAB 1: LIVE MCQ BATTLE ── */}
              {activeTab === 'MCQ' && (
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  {/* Battle State: WAITING (Host launches quiz) */}
                  {(!currentRoom.liveMcq?.isActive || currentRoom.liveMcq?.status === 'WAITING') && (
                    <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-6 text-center space-y-4 my-auto shadow-xl">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl">
                        🎯
                      </div>
                      <h3 className="text-xl font-black text-white">Live MCQ Battle Arena</h3>
                      <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                        Sabhi members ek hi samay par sawal hal karenge. Har sahi sawal par <b>+5 XP</b> aur speed points
                        milenge. Galat uttar par <b>-2 XP</b> aur streak tootne par bonus milega!
                      </p>

                      {isHost ? (
                        <div className="space-y-4 max-w-md mx-auto pt-2 text-left">
                          {/* Host Pre-Launch Timer and Auto-Advance Settings */}
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                <Clock size={14} className="text-amber-400" /> Har Sawal Ka Timer:
                              </span>
                              <span className="text-xs font-black text-amber-400">
                                {selectedTimerDuration} Sec
                              </span>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5">
                              {[10, 15, 20, 30, 45, 60].map((sec) => (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => setSelectedTimerDuration(sec)}
                                  className={`py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                    selectedTimerDuration === sec
                                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Zap size={14} className="text-emerald-400" /> Auto-Advance (Agla Sawal):
                              </span>
                              <button
                                type="button"
                                onClick={() => setAutoAdvanceEnabled(!autoAdvanceEnabled)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                                  autoAdvanceEnabled
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {autoAdvanceEnabled ? '⚡ ON (3s Auto)' : 'OFF (Manual)'}
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (currentRoom.mcqType === 'REVISION_HUB') {
                                setChooserSource('REVISION_HUB');
                              } else {
                                setChooserSource('ALL');
                              }
                              setShowChapterChooser(true);
                            }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                          >
                            {currentRoom.mcqType === 'REVISION_HUB' ? (
                              <>
                                <Zap size={16} /> ⚡ Choose Revision Hub Subject & Lesson (Free)
                              </>
                            ) : (
                              <>
                                <BookOpen size={16} /> 🎯 Ek Lesson Ka Pura MCQ (Notes, Lucent, Homework)
                              </>
                            )}
                          </button>

                          {availableBattleSets.length > 0 && (
                            <>
                              <div className="text-left text-xs font-bold text-slate-300 pt-1">
                                Ya uplabdh Battle Quiz chunein:
                              </div>
                              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {availableBattleSets.map((set) => (
                                  <label
                                    key={set.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-left ${
                                      selectedCuratedSet === set.id
                                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="mcqSet"
                                      checked={selectedCuratedSet === set.id}
                                      onChange={() => setSelectedCuratedSet(set.id)}
                                      className="sr-only"
                                    />
                                    <span className="text-xl">{set.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black truncate">{set.name}</p>
                                      <p className="text-[10px] text-slate-400">
                                        {set.questions.length} Questions • {selectedTimerDuration}s per question
                                      </p>
                                    </div>
                                  </label>
                                ))}
                              </div>

                              <button
                                onClick={handleLaunchCuratedMcq}
                                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Play size={16} /> 🚀 Launch MCQ Battle Now ({selectedTimerDuration}s)
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="py-6 space-y-2 text-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black animate-pulse">
                            <Clock size={16} /> Host live MCQ quiz start karne wala hai...
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Jaise hi host quiz shuru karega, aapke mobile par automatically sawal load ho jayega!
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Battle State: QUESTION or REVEAL */}
                  {currentRoom.liveMcq?.isActive &&
                    (currentRoom.liveMcq.status === 'QUESTION' || currentRoom.liveMcq.status === 'REVEAL') &&
                    (() => {
                      const qIdx = currentRoom.liveMcq!.currentQuestionIndex;
                      const q = currentRoom.liveMcq!.questions[qIdx];
                      if (!q) return null;

                      const isReveal = currentRoom.liveMcq!.status === 'REVEAL';
                      const isProjector = currentRoom.mcqType === 'PROJECTOR_MODE';
                      const isRevision = currentRoom.mcqType === 'REVISION_HUB';
                      const totalQuestions = currentRoom.liveMcq!.totalQuestions || currentRoom.liveMcq!.questions.length;
                      const duration = currentRoom.liveMcq!.durationPerQuestion || 20;

                      const currentQAnswers = currentRoom.liveMcq!.questionAnswers?.[qIdx] || {};
                      const roomMembers = Object.values(currentRoom.members || {});
                      const answeredCount = Object.keys(currentQAnswers).length;
                      const totalMembersCount = Math.max(roomMembers.length, 1);

                      return (
                        <div
                          className={`flex-1 flex flex-col justify-between space-y-4 ${
                            isProjector ? 'p-2 sm:p-4 rounded-3xl bg-slate-950 border-2 border-cyan-500/40' : ''
                          }`}
                        >
                          {/* Progress & Countdown Header */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                              <span className={isProjector ? 'text-sm font-black text-cyan-300' : ''}>
                                Question {qIdx + 1} of {totalQuestions}
                                {isRevision && (
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-300 border border-purple-500/50">
                                    ⚡ MCQ + Sprint
                                  </span>
                                )}
                              </span>

                              {/* Timer Badge */}
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                                  {answeredCount}/{totalMembersCount} Answered
                                </span>
                                {isReveal ? (
                                  <span className="font-mono font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 text-xs animate-pulse">
                                    <FastForward size={14} /> Agla Sawal: {revealSecondsLeft}s
                                  </span>
                                ) : (
                                  <span
                                    className={`font-mono font-black flex items-center gap-1 ${
                                      isProjector
                                        ? 'text-xl sm:text-2xl text-cyan-300'
                                        : mcqSecondsLeft <= 5
                                        ? 'text-rose-400 animate-pulse text-base'
                                        : 'text-amber-400 text-sm'
                                    }`}
                                  >
                                    <Timer size={14} /> {mcqSecondsLeft}s
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress Bars */}
                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                              {isReveal ? (
                                <div
                                  className="h-full bg-emerald-400 transition-all duration-1000"
                                  style={{
                                    width: `${Math.max(10, ((3 - revealSecondsLeft) / 3) * 100)}%`,
                                  }}
                                />
                              ) : (
                                <div
                                  className={`h-full transition-all duration-1000 ${
                                    isProjector
                                      ? 'bg-cyan-400'
                                      : isRevision
                                      ? 'bg-purple-500'
                                      : mcqSecondsLeft <= 5
                                      ? 'bg-rose-500 animate-pulse'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{
                                    width: `${Math.max(0, Math.min(100, (mcqSecondsLeft / duration) * 100))}%`,
                                  }}
                                />
                              )}
                            </div>

                            {/* Host Live In-Battle Controls Toolbar */}
                            {isHost && (
                              <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px]">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-slate-400 font-bold flex items-center gap-1 text-[10px]">
                                    <Clock size={11} className="text-amber-400" /> Timer:
                                  </span>
                                  {[10, 15, 20, 30, 45, 60].map((sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => handleSetDuration(sec)}
                                      className={`px-1.5 py-0.5 rounded font-black transition cursor-pointer text-[10px] ${
                                        duration === sec
                                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleToggleAutoAdvance}
                                    className={`px-2 py-0.5 rounded font-bold text-[10px] transition cursor-pointer ${
                                      autoAdvanceEnabled
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    ⚡ Auto-Next: {autoAdvanceEnabled ? 'ON (3s)' : 'OFF'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleForceEndBattle}
                                    className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px] hover:bg-rose-500/30 cursor-pointer"
                                  >
                                    🏁 Submit & End
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Question Card */}
                          <div
                            className={`rounded-2xl p-4 sm:p-5 shadow-xl transition-all ${
                              isProjector
                                ? 'bg-slate-900 border border-cyan-500/50'
                                : 'bg-slate-800/90 border border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isProjector
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                Live MCQ #{qIdx + 1}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                Sahi: <b className="text-emerald-400">+5 XP</b> | Galat: <b className="text-rose-400">-2 XP</b>
                              </span>
                            </div>

                            <h4
                              className={`font-black text-white leading-relaxed ${
                                isProjector
                                  ? 'text-lg sm:text-2xl tracking-wide text-cyan-50'
                                  : 'text-base sm:text-lg'
                              }`}
                            >
                              {q.question}
                            </h4>
                          </div>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options.map((opt, optIdx) => {
                              let btnStyle = isProjector
                                ? 'bg-slate-900/90 border-slate-700 text-white hover:border-cyan-400 text-base sm:text-lg'
                                : 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs md:text-sm';

                              if (selectedOption === optIdx) {
                                btnStyle = isProjector
                                  ? 'bg-cyan-600/50 border-cyan-400 text-white ring-2 ring-cyan-400'
                                  : 'bg-indigo-600/40 border-indigo-400 text-white ring-2 ring-indigo-400';
                              }

                              if (isReveal) {
                                if (optIdx === q.correctIndex) {
                                  btnStyle =
                                    'bg-emerald-600/40 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500';
                                } else if (selectedOption === optIdx && optIdx !== q.correctIndex) {
                                  btnStyle = 'bg-rose-600/40 border-rose-500 text-rose-200';
                                }
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectOption(optIdx)}
                                  disabled={hasAnsweredCurrentQ || isReveal}
                                  className={`p-3.5 sm:p-4 rounded-2xl border text-left font-bold flex items-center gap-3 transition active:scale-95 disabled:cursor-not-allowed cursor-pointer ${btnStyle}`}
                                >
                                  <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black shrink-0 ${
                                      isProjector
                                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-sm'
                                        : 'bg-slate-950/70 text-slate-300 text-xs'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className="flex-1 leading-snug">{opt}</span>
                                  {isReveal && optIdx === q.correctIndex && (
                                    <Check size={18} className="text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Answer Status or Explanation */}
                          {isReveal ? (
                            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-3 text-xs text-emerald-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-black text-sm text-emerald-300 flex items-center gap-1.5">
                                  <CheckCircle2 size={16} /> Sahi Uttar: Option {String.fromCharCode(65 + q.correctIndex)}
                                </p>
                                {autoAdvanceEnabled && (
                                  <span className="text-[11px] font-black text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">
                                    Agla Sawal {revealSecondsLeft}s me 🚀
                                  </span>
                                )}
                              </div>
                              {q.explanation && (
                                <p className="text-xs text-emerald-300/90 pt-0.5">{q.explanation}</p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-xs font-medium text-slate-400">
                              {hasAnsweredCurrentQ ? (
                                <span className="text-emerald-300 font-black flex items-center justify-center gap-1.5">
                                  <CheckCircle2 size={15} /> Aapka uttar lock ho gaya hai! Sabhi ke banate hi answer reveal ho jayega...
                                </span>
                              ) : (
                                'Jaldi sahi uttar chunein! Jitna jaldi uttar denge, utna score aur speed bonus milega.'
                              )}
                            </div>
                          )}

                          {/* ── REAL-TIME PARTICIPANT LEADERBOARD: Kon Banaya Kon Nahi, Kitna Der Me ── */}
                          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                                  <BarChart3 size={14} className="text-amber-400" /> Live Question Tracker (Q{qIdx + 1})
                                </h5>
                                <span className="text-[11px] font-bold text-slate-400">
                                  • {answeredCount}/{totalMembersCount} Banaye
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowLiveAnswersSheet(!showLiveAnswersSheet)}
                                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                              >
                                {showLiveAnswersSheet ? 'Hide' : 'Show All'}
                              </button>
                            </div>

                            {showLiveAnswersSheet && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                                {roomMembers.map((m) => {
                                  const ans = currentQAnswers[m.id];
                                  const userScore = currentRoom.liveMcq?.scores?.[m.id];
                                  const isCurrentUser = m.id === user?.id;

                                  return (
                                    <div
                                      key={m.id}
                                      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${
                                        isCurrentUser
                                          ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                                          : 'bg-slate-800/60 border-slate-700/60'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                                          {m.photoURL ? (
                                            <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                                          ) : (
                                            m.name.charAt(0).toUpperCase()
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-200 truncate text-[11px]">
                                            {m.name} {isCurrentUser && '(Aap)'}
                                          </p>
                                          <p className="text-[10px] text-amber-400 font-black">
                                            {userScore?.score || 0} pts • 🔥 {userScore?.currentStreak || 0}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Live Response Status */}
                                      <div className="text-right shrink-0">
                                        {ans ? (
                                          isReveal ? (
                                            <div className="flex flex-col items-end">
                                              <span
                                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                  ans.isCorrect
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                }`}
                                              >
                                                {ans.isCorrect ? '✅ Sahi' : '❌ Galat'} ({String.fromCharCode(65 + ans.selectedOption)})
                                              </span>
                                              <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                ⚡ {ans.timeTakenSec.toFixed(1)}s me
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-end">
                                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                ✅ Banaya
                                              </span>
                                              <span className="text-[9px] text-amber-300 font-mono font-bold mt-0.5">
                                                ⚡ {ans.timeTakenSec.toFixed(1)}s me
                                              </span>
                                            </div>
                                          )
                                        ) : (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 animate-pulse">
                                            ⏳ Soch raha hai...
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Host Controls */}
                          {isHost && (
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                              <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
                                Host Action Bar
                              </span>
                              <div className="flex items-center gap-2 ml-auto">
                                {!isReveal ? (
                                  <button
                                    onClick={() => revealMcqAnswer(currentRoom.id)}
                                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Eye size={15} /> Show Answer (Reveal)
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleNextMcqQuestion}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {qIdx + 1 >= totalQuestions ? (
                                      <>Final Results & XP 🏆</>
                                    ) : (
                                      <>Next Question ➡️ ({revealSecondsLeft}s)</>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  {/* Battle State: ENDED (Complete Results, Podium & Question-by-Question Review) */}
                  {(currentRoom.liveMcq?.status === 'ENDED' || currentRoom.isExpired) && (() => {
                    const scores = Object.entries(currentRoom.liveMcq?.scores || {}).sort(
                      (a, b) => (b[1].score || 0) - (a[1].score || 0)
                    );
                    const myScore = user?.id ? currentRoom.liveMcq?.scores?.[user.id] : null;
                    const myRank = user?.id ? scores.findIndex(([uid]) => uid === user.id) + 1 : 0;
                    const totalQ = currentRoom.liveMcq?.totalQuestions || currentRoom.liveMcq?.questions?.length || 0;
                    const questions = currentRoom.liveMcq?.questions || [];
                    const allAnswersMap = currentRoom.liveMcq?.questionAnswers || {};

                    const myAccuracy =
                      myScore && totalQ > 0
                        ? Math.round(((myScore.correctCount || 0) / totalQ) * 100)
                        : 0;

                    return (
                      <div className="rounded-2xl bg-slate-900/95 border border-slate-700 p-5 sm:p-6 text-center space-y-6 shadow-2xl overflow-y-auto max-h-[75vh]">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                          🏆
                        </div>

                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-white">
                            Live MCQ Battle Final Results & Report
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            {currentRoom.name} • {totalQ} Questions Completed • {scores.length} Participants
                            {currentRoom.isExpired && ' • Room Time Expired & Auto-Submitted'}
                          </p>
                        </div>

                        {/* Podium Top 3 */}
                        <div className="flex items-end justify-center gap-3 pt-2">
                          {scores[1] && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-300 truncate max-w-[85px]">
                                {scores[1][1].name}
                              </span>
                              <span className="text-[10px] text-amber-400 font-bold">{scores[1][1].score} pts</span>
                              <div className="w-20 sm:w-24 h-20 rounded-t-2xl bg-slate-700 flex flex-col items-center justify-center font-black text-slate-300 mt-1 shadow">
                                <span className="text-lg">🥈</span>
                                <span className="text-xs">2nd</span>
                              </div>
                            </div>
                          )}
                          {scores[0] && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black text-amber-300 truncate max-w-[95px]">
                                👑 {scores[0][1].name}
                              </span>
                              <span className="text-[11px] text-amber-400 font-black">{scores[0][1].score} pts</span>
                              <div className="w-24 sm:w-28 h-28 rounded-t-2xl bg-gradient-to-t from-amber-600/40 to-amber-500/40 border-2 border-amber-400 flex flex-col items-center justify-center font-black text-amber-300 mt-1 shadow-xl">
                                <span className="text-2xl">🥇</span>
                                <span className="text-sm">1st Place</span>
                              </div>
                            </div>
                          )}
                          {scores[2] && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-300 truncate max-w-[85px]">
                                {scores[2][1].name}
                              </span>
                              <span className="text-[10px] text-amber-400 font-bold">{scores[2][1].score} pts</span>
                              <div className="w-20 sm:w-24 h-16 rounded-t-2xl bg-amber-900/40 flex flex-col items-center justify-center font-black text-amber-500 mt-1 shadow">
                                <span className="text-lg">🥉</span>
                                <span className="text-xs">3rd</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Personal Performance Scorecard */}
                        {myScore && (
                          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 max-w-xl mx-auto text-left space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1.5">
                                <Medal size={14} className="text-amber-400" /> Aapka Performance Card
                              </h4>
                              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Rank #{myRank || 1} • {myScore.score || 0} Points
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                <span className="block text-[10px] text-slate-400 font-bold">Sahi (+5 XP)</span>
                                <span className="text-base font-black text-emerald-400">
                                  {myScore.correctCount || 0}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                <span className="block text-[10px] text-slate-400 font-bold">Galat (-2 XP)</span>
                                <span className="text-base font-black text-rose-400">
                                  {myScore.wrongCount || 0}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                                <span className="block text-[10px] text-slate-400 font-bold">Accuracy</span>
                                <span className="text-base font-black text-cyan-400">
                                  {myAccuracy}%
                                </span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40">
                                <span className="block text-[10px] text-indigo-300 font-bold">Room XP</span>
                                <span className="text-base font-black text-white">
                                  +{myScore.userXp || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Full Participants Leaderboard Table */}
                        <div className="max-w-xl mx-auto text-left space-y-2">
                          <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                            <Trophy size={14} className="text-amber-400" /> Sabhi Participants Ka Final Result
                          </h4>
                          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
                            <div className="grid grid-cols-12 gap-1 p-2 bg-slate-900 text-[10px] font-black text-slate-400 uppercase">
                              <div className="col-span-2">Rank</div>
                              <div className="col-span-5">Student</div>
                              <div className="col-span-2 text-center">Sahi</div>
                              <div className="col-span-3 text-right">Points / XP</div>
                            </div>
                            <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                              {scores.map(([uid, data], idx) => {
                                const isCurrentUser = uid === user?.id;
                                return (
                                  <div
                                    key={uid}
                                    className={`grid grid-cols-12 gap-1 p-2 text-xs items-center ${
                                      isCurrentUser ? 'bg-indigo-950/40 font-black text-white' : 'text-slate-300'
                                    }`}
                                  >
                                    <div className="col-span-2 font-black">
                                      {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                                    </div>
                                    <div className="col-span-5 truncate flex items-center gap-1.5">
                                      <span className="truncate">{data.name}</span>
                                      {isCurrentUser && <span className="text-[9px] text-indigo-400 font-bold">(Aap)</span>}
                                    </div>
                                    <div className="col-span-2 text-center font-bold text-emerald-400">
                                      {data.correctCount || 0}/{totalQ}
                                    </div>
                                    <div className="col-span-3 text-right font-black text-amber-400">
                                      {data.score} pts
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* ── QUESTION-BY-QUESTION DEEP REVIEW (Har Ek Sawal Ka Vishleshan) ── */}
                        {questions.length > 0 && (
                          <div className="max-w-xl mx-auto text-left space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                                <BookOpen size={14} className="text-emerald-400" /> Har Ek Sawal Ka Full Analysis & Answers
                              </h4>
                              <span className="text-[11px] font-bold text-slate-400">
                                {questions.length} Questions Review
                              </span>
                            </div>

                            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                              {questions.map((questionItem, qIndex) => {
                                const qAnswers = allAnswersMap[qIndex] || {};
                                const myAnswer = user?.id ? qAnswers[user.id] : null;
                                const isExpanded = selectedReviewQIdx === qIndex;

                                const correctCountInRoom = Object.values(qAnswers).filter((a) => a.isCorrect).length;
                                const totalAnsweredInRoom = Object.keys(qAnswers).length;

                                return (
                                  <div
                                    key={qIndex}
                                    className="p-3 rounded-xl border border-slate-800 bg-slate-800/60 space-y-2"
                                  >
                                    <div
                                      onClick={() => setSelectedReviewQIdx(isExpanded ? null : qIndex)}
                                      className="flex items-start justify-between gap-2 cursor-pointer"
                                    >
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                          {qIndex + 1}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-white line-clamp-2">
                                            {questionItem.question}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                                            {myAnswer ? (
                                              myAnswer.isCorrect ? (
                                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                                  <CheckCircle2 size={11} /> Aapka Sahi (⚡ {myAnswer.timeTakenSec.toFixed(1)}s)
                                                </span>
                                              ) : (
                                                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                                  <XCircle size={11} /> Aapka Galat (⚡ {myAnswer.timeTakenSec.toFixed(1)}s)
                                                </span>
                                              )
                                            ) : (
                                              <span className="text-slate-400">
                                                Aapne attempt nahi kiya
                                              </span>
                                            )}
                                            <span className="text-slate-500">•</span>
                                            <span className="text-slate-400">
                                              Room me {correctCountInRoom}/{Math.max(totalAnsweredInRoom, 1)} ne sahi kiya
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <span className="text-[10px] font-bold text-indigo-400 shrink-0 mt-1">
                                        {isExpanded ? 'Chhupayein' : 'Dekhein'}
                                      </span>
                                    </div>

                                    {/* Expanded Detail View of Question */}
                                    {isExpanded && (
                                      <div className="pt-2 border-t border-slate-700/60 space-y-2 text-xs">
                                        <div className="space-y-1">
                                          {questionItem.options.map((optText, optI) => {
                                            const isCorrectOpt = optI === questionItem.correctIndex;
                                            const wasSelectedByMe = myAnswer && myAnswer.selectedOption === optI;

                                            return (
                                              <div
                                                key={optI}
                                                className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                                                  isCorrectOpt
                                                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                                                    : wasSelectedByMe
                                                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                                                    : 'bg-slate-900/60 text-slate-400'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <span className="w-5 h-5 rounded bg-slate-950/60 text-[10px] flex items-center justify-center font-black">
                                                    {String.fromCharCode(65 + optI)}
                                                  </span>
                                                  <span>{optText}</span>
                                                </div>
                                                <div className="text-[10px] font-black flex items-center gap-1">
                                                  {isCorrectOpt && (
                                                    <span className="text-emerald-400 flex items-center gap-0.5">
                                                      <Check size={12} /> Sahi Uttar
                                                    </span>
                                                  )}
                                                  {wasSelectedByMe && !isCorrectOpt && (
                                                    <span className="text-rose-400 flex items-center gap-0.5">
                                                      <X size={12} /> Aapka Chuna Uttar
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {questionItem.explanation && (
                                          <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-[11px] leading-relaxed">
                                            <b>Vishleshan (Explanation):</b> {questionItem.explanation}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                          {isHost ? (
                            <>
                              <button
                                onClick={() => setShowChapterChooser(true)}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                              >
                                <BookOpen size={14} /> Agla MCQ Lesson Shuru Karein (Free)
                              </button>
                              <button
                                onClick={() => endLiveMcqBattle(currentRoom.id)}
                                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                              >
                                <RotateCcw size={14} /> Reset Arena (Naya Battle)
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setActiveTab('CHAT')}
                              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                            >
                              <MessageSquare size={14} /> Classroom Chat & Doubts Me Jayein
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── TAB 2: LEADERBOARD ── */}
              {activeTab === 'LEADERBOARD' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" /> Room Battle Leaderboard & XP
                  </h4>

                  {currentRoom.liveMcq?.scores && Object.keys(currentRoom.liveMcq.scores).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(currentRoom.liveMcq.scores)
                        .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
                        .map(([uid, data], idx) => (
                          <div
                            key={uid}
                            className={`flex items-center justify-between p-3 rounded-xl border ${
                              uid === user?.id
                                ? 'bg-indigo-950/50 border-indigo-500/50'
                                : 'bg-slate-800/70 border-slate-700/80'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 text-center font-black text-xs ${
                                  idx === 0
                                    ? 'text-amber-400'
                                    : idx === 1
                                    ? 'text-slate-300'
                                    : idx === 2
                                    ? 'text-amber-600'
                                    : 'text-slate-500'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="text-xs font-black text-white">
                                  {data.name} {uid === user?.id && '(Aap)'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {data.correctCount || 0} Sahi (+5 XP) • {data.wrongCount || 0} Galat (-2 XP) • Max Streak: 🔥{data.maxStreak || 0}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-amber-400 block">{data.score || 0} pts</span>
                              <span className="text-[10px] font-bold text-emerald-400">+{data.userXp || 0} XP</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Abhi koi MCQ Battle nahi hui hai. MCQ tab par jakar live battle shuru karein!
                    </p>
                  )}
                </div>
              )}

              {/* ── TAB 3: MEMBERS LIST ── */}
              {activeTab === 'MEMBERS' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Users size={16} /> Online Room Members ({Object.keys(currentRoom.members || {}).length})
                  </h4>

                  <div className="space-y-2">
                    {Object.values(currentRoom.members || {}).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white">
                            {m.name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white">{m.name}</span>
                              {m.isHost && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  Host
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">Level {m.level || 1}</span>
                          </div>
                        </div>

                        {m.handRaised && (
                          <span className="text-xs font-bold text-amber-400 animate-bounce">✋ Hand Raised</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Host Danger Zone / Room Destruction */}
                  {isHost && (
                    <div className="mt-6 p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2.5">
                      <div className="flex items-center gap-2 text-rose-400">
                        <Trash2 size={16} />
                        <h5 className="text-xs font-black text-white">Host Controls: Room Destroy Karein</h5>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Aap is room ke <b>Host</b> hain. Agar aapka study session poora ho gaya hai ya aap room ko band karna chahte hain, toh yahan se room ko poori tarah destroy/delete kar sakte hain. Sabhi participants auto-disconnect ho jayenge.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDestroyRoom()}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-2 active:scale-95 transition shadow-lg cursor-pointer"
                      >
                        <Trash2 size={14} /> Room Destroy Karein
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SIDE PANEL: ROOM CHAT & DOUBTS ── */}
            <div className="w-full md:w-80 flex flex-col bg-slate-950/60 shrink-0 h-64 md:h-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-indigo-400" />
                  <span className="text-xs font-black text-white">Live Discussion</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={() => setChatFilter('ALL')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      chatFilter === 'ALL' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setChatFilter('DOUBTS')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      chatFilter === 'DOUBTS'
                        ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    💡 Doubts
                  </button>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {currentRoom.chat &&
                  Object.values(currentRoom.chat)
                    .filter((msg) => (chatFilter === 'DOUBTS' ? msg.type === 'DOUBT' : true))
                    .map((msg) => {
                      const isMe = msg.userId === user?.id;
                      const isDoubt = msg.type === 'DOUBT';
                      const isSystem = msg.type === 'SYSTEM';

                      if (isSystem) {
                        return (
                          <p
                            key={msg.id}
                            className="text-[10px] text-center text-slate-400 py-1 font-medium bg-slate-900/40 rounded-lg"
                          >
                            {msg.text}
                          </p>
                        );
                      }

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-slate-400 mb-0.5 px-1">{isMe ? 'You' : msg.userName}</span>
                          <div
                            className={`p-2.5 rounded-2xl max-w-[85%] text-xs leading-snug break-words ${
                              isDoubt
                                ? 'bg-amber-950/50 border border-amber-500/40 text-amber-200'
                                : isMe
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            {isDoubt && (
                              <span className="block text-[9px] font-black text-amber-400 uppercase tracking-wide mb-0.5">
                                💡 Doubt
                              </span>
                            )}
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => handleSendChat(e, false)}
                className="p-2 border-t border-slate-800 bg-slate-900/80 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Type message or doubt..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => handleSendChat(e as any, true)}
                  className="px-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-black cursor-pointer"
                  title="Ask Doubt"
                >
                  💡
                </button>
                <button
                  type="submit"
                  disabled={!chatMessage.trim()}
                  className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-40 transition shrink-0 cursor-pointer"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE ROOM MODAL (Mandatory Password & MCQ Mode Selection) ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy size={18} className="text-indigo-400" /> Naya MCQ Study Room Banayein
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Room Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mission Bihar SSC & Lucent MCQ Battle"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mandatory Password Field */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>
                    Room Password <span className="text-rose-400">* (Zaroori)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Bina password room nahi banega</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    placeholder="Enter Secret Room Password (e.g. 1234)"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* 2 MCQ Modes: MCQ (Notes, Lucent, Homework) and MCQ + (Revision Hub) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>MCQ Battle Mode (2 Modes):</span>
                  <span className="text-[10px] text-cyan-400 font-bold">Bas 2 Modes uplabdh hain</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5 text-center text-xs font-bold">
                  {/* Mode 1: MCQ (Previously Projector Mode - Notes, Lucent, Competition Homework) */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewRoomMcqType('PROJECTOR_MODE');
                      setSelectedPreloadLesson(null);
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      newRoomMcqType === 'PROJECTOR_MODE' || newRoomMcqType === 'MCQ_PRACTICE'
                        ? 'bg-cyan-600/30 border-cyan-400 text-white shadow-lg ring-1 ring-cyan-500/50 scale-[1.01]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">🎯</span>
                      <span className="text-sm font-black">MCQ</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal leading-tight">
                      1 Lesson ke pure MCQs (Notes, Lucent & HW)
                    </span>
                  </button>

                  {/* Mode 2: MCQ + (Previously Revision Hub - Subjects & Lessons) */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewRoomMcqType('REVISION_HUB');
                      setSelectedPreloadLesson(null);
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      newRoomMcqType === 'REVISION_HUB'
                        ? 'bg-purple-600/30 border-purple-400 text-white shadow-lg ring-1 ring-purple-500/50 scale-[1.01]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">⚡</span>
                      <span className="text-sm font-black">MCQ +</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal leading-tight">
                      Revision Hub ke Subjects & Lessons
                    </span>
                  </button>
                </div>
              </div>

              {/* MODE 1: MCQ (Ek Lesson ke pure MCQs - Notes, Lucent & Homework) */}
              {(newRoomMcqType === 'PROJECTOR_MODE' || newRoomMcqType === 'MCQ_PRACTICE') && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                      <span>🎯 1 Lesson Ka Pura MCQ (Notes, Lucent, Homework):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {allRealLessons.filter(l => l.sourceType === 'NOTES' || l.sourceType === 'HOMEWORK' || l.classLevel === 'COMPETITION').length} Lessons Uplabdh
                    </span>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap gap-1">
                    {(['ALL', 'NOTES', 'HOMEWORK'] as const).map((source) => {
                      const label = source === 'ALL' ? 'Sabhi Lessons' : source === 'NOTES' ? '📖 Notes & Lucent' : '📝 Homework';
                      const count = source === 'ALL'
                        ? allRealLessons.length
                        : source === 'NOTES'
                        ? allRealLessons.filter(l => l.sourceType === 'NOTES' || (l.classLevel === 'COMPETITION' && l.sourceType !== 'HOMEWORK')).length
                        : allRealLessons.filter(l => l.sourceType === 'HOMEWORK').length;
                      return (
                        <button
                          key={source}
                          type="button"
                          onClick={() => setCreateModeSourceFilter(source)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                            createModeSourceFilter === source
                              ? 'bg-cyan-500 text-slate-950 shadow-md scale-105'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={createModeSearch}
                      onChange={(e) => setCreateModeSearch(e.target.value)}
                      placeholder="🔍 Lesson search karein (Lucent, Samanya Gyan, Science...)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
                    />
                    {createModeSearch && (
                      <button
                        type="button"
                        onClick={() => setCreateModeSearch('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Lesson Picker List */}
                  {(() => {
                    let list = allRealLessons;
                    if (createModeSourceFilter === 'NOTES') {
                      list = list.filter(l => l.sourceType === 'NOTES' || (l.classLevel === 'COMPETITION' && l.sourceType !== 'HOMEWORK'));
                    } else if (createModeSourceFilter === 'HOMEWORK') {
                      list = list.filter(l => l.sourceType === 'HOMEWORK');
                    }
                    if (createModeSearch.trim()) {
                      const q = createModeSearch.trim().toLowerCase();
                      list = list.filter(l =>
                        l.lessonTitle.toLowerCase().includes(q) ||
                        l.subject.toLowerCase().includes(q) ||
                        l.classLevel.toLowerCase().includes(q)
                      );
                    }

                    if (list.length === 0) {
                      return (
                        <p className="text-[11px] text-slate-400 italic py-1">
                          Koi lesson nahi mila. Dusra keyword search karein.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Tap karein (Is lesson ke pure MCQs room me direct load honge):
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {list.slice(0, 40).map((lesson) => {
                            const isSelected = selectedPreloadLesson?.id === lesson.id;
                            const sourceBadge = lesson.sourceType === 'HOMEWORK' ? '📝 Homework' : lesson.sourceType === 'NOTES' ? '📖 Notes' : '🏆 Lucent';
                            return (
                              <div
                                key={lesson.id}
                                onClick={() => {
                                  setSelectedPreloadLesson(lesson);
                                  setNewRoomName(`${lesson.lessonTitle} · Full Lesson MCQ`);
                                  setNewRoomSubject(lesson.subject);
                                }}
                                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-cyan-600/30 border-cyan-400 text-white ring-1 ring-cyan-400 shadow-md'
                                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-white'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold truncate text-[11px]">{lesson.lessonTitle}</p>
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">{sourceBadge}</span>
                                    <span>•</span>
                                    <span className="truncate">{lesson.subject}</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                                  isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/50'
                                }`}>
                                  🎯 {lesson.mcqCount} Pure MCQs
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MODE 2: MCQ + (Revision Hub ke subjects & lessons) */}
              {newRoomMcqType === 'REVISION_HUB' && (
                <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                      <span>⚡ Revision Hub: Subjects & Lessons Chunein</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {allRealLessons.filter(l => l.sourceType === 'REVISION_HUB').length} Revision Lessons
                    </span>
                  </div>

                  {/* Class Selection Pills */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">1. Class Chunein:</span>
                    <div className="flex flex-wrap gap-1">
                      {availableClasses.map((cls) => {
                        const revCount = allRealLessons.filter(l => l.sourceType === 'REVISION_HUB' && l.classLevel === cls).length;
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => {
                              setCreateModeClass(cls);
                              setCreateModeSubject('ALL');
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                              createModeClass === cls
                                ? 'bg-purple-500 text-slate-950 shadow-md scale-105'
                                : 'bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white'
                            }`}
                          >
                            {cls === 'COMPETITION' ? '🏆 Comp' : `Class ${cls}`} ({revCount})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject Selection Pills */}
                  {(() => {
                    const classLessons = allRealLessons.filter(l => l.sourceType === 'REVISION_HUB' && (createModeClass === 'ALL' || l.classLevel === createModeClass));
                    const subjects = Array.from(new Set(classLessons.map(l => l.subject))).filter(Boolean).sort();
                    return (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block">2. Subject Chunein:</span>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                          <button
                            type="button"
                            onClick={() => setCreateModeSubject('ALL')}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                              createModeSubject === 'ALL'
                                ? 'bg-purple-600 text-white font-black'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Sabhi ({classLessons.length})
                          </button>
                          {subjects.map((sub) => {
                            const subCount = classLessons.filter(l => l.subject === sub).length;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => {
                                  setCreateModeSubject(sub);
                                  setNewRoomSubject(sub);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                  createModeSubject === sub
                                    ? 'bg-purple-600 text-white font-black'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {sub} ({subCount})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Lesson Picker List */}
                  {(() => {
                    let lessons = allRealLessons.filter(l => l.sourceType === 'REVISION_HUB');
                    if (createModeClass !== 'ALL') lessons = lessons.filter(l => l.classLevel === createModeClass);
                    if (createModeSubject !== 'ALL') lessons = lessons.filter(l => l.subject === createModeSubject);

                    if (lessons.length === 0) {
                      return (
                        <p className="text-[11px] text-slate-400 italic py-1">
                          Is class/subject me koi Revision Hub lesson uplabdh nahi hai. Doosri class ya subject chunein.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block">3. Lesson Chunein (Tap to Select):</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {lessons.map((lesson) => {
                            const isSelected = selectedPreloadLesson?.id === lesson.id;
                            return (
                              <div
                                key={lesson.id}
                                onClick={() => {
                                  setSelectedPreloadLesson(lesson);
                                  setNewRoomName(`${lesson.lessonTitle} · MCQ + Battle`);
                                  setNewRoomSubject(lesson.subject);
                                }}
                                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-purple-600/30 border-purple-400 text-white ring-1 ring-purple-400 shadow-md'
                                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold truncate text-[11px]">{lesson.lessonTitle}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">
                                    {lesson.subject} • Class {lesson.classLevel}
                                  </p>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                                  isSelected ? 'bg-purple-500 text-slate-950' : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                                }`}>
                                  ⚡ {lesson.mcqCount} MCQs
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Preloaded Selected Lesson Card */}
              {selectedPreloadLesson && (
                <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between gap-2 shadow-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-emerald-300 truncate">
                      ✅ Chuna Hua Lesson: {selectedPreloadLesson.lessonTitle}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      {selectedPreloadLesson.subject} • 🎯 Is lesson ke pure <b className="text-amber-300">{selectedPreloadLesson.mcqCount} MCQs</b> room bante hi shuru honge!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPreloadLesson(null)}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/50 shrink-0 cursor-pointer"
                  >
                    Hatao
                  </button>
                </div>
              )}

              {/* Subject Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject / Topic:</label>
                <select
                  value={newRoomSubject}
                  onChange={(e) => setNewRoomSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="Lucent Samanya Gyan">Lucent Samanya Gyan (General Knowledge)</option>
                  <option value="General Science">General Science (Physics, Chemistry, Bio)</option>
                  <option value="Social Studies & History">Social Studies & Indian History</option>
                  <option value="Polity & Constitution">Polity & Constitution</option>
                  <option value="Geography & Environment">Geography & Environment</option>
                  <option value="Economics & Commerce">Economics & Commerce</option>
                  <option value="Mathematics & Reasoning">Mathematics & Reasoning</option>
                  <option value="Hindi & English Grammar">Hindi & English Grammar</option>
                  <option value="Current Affairs & Special Test">Current Affairs & Special Test</option>
                </select>
              </div>

              {/* Room Duration Selection based on Plan */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Room Duration (Time Limit):</span>
                  <span className="text-[10px] text-amber-300 font-bold">
                    {isAdmin
                      ? '👑 Unlimited / Up to 4 Hours (Admin)'
                      : userTier === 'FREE'
                      ? '30 Min Max (Free Plan)'
                      : userTier === 'BASIC'
                      ? '1 Hour Max (Basic Plan)'
                      : '2 Hours Max (Ultra Plan)'}
                  </span>
                </label>
                <select
                  value={newRoomDurationMinutes}
                  onChange={(e) => setNewRoomDurationMinutes(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  {durationOptions.map((m) => (
                    <option key={m} value={m}>
                      {m} Minutes {m === 60 ? '(1 Hour)' : m === 120 ? '(2 Hours)' : m === 180 ? '(3 Hours)' : m === 240 ? '(4 Hours)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px]">
                <span className="text-slate-400">Daily Room Limit:</span>
                <span className="font-bold">
                  {isAdmin ? (
                    <span className="text-emerald-400 font-black flex items-center gap-1">
                      <Crown size={12} className="text-yellow-400" /> Unlimited Rooms (Admin Access)
                    </span>
                  ) : (
                    <span className="text-indigo-300 font-bold">
                      {todayCreatedRoomsCount}/{maxRoomsPerDay} Used Today ({userTier} Plan)
                    </span>
                  )}
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-black text-xs text-white shadow-xl active:scale-95 transition cursor-pointer"
                style={{ background: brandColor }}
              >
                {isLoading ? 'Creating Room...' : '🚀 Room Create & Launch Karein'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── JOIN ROOM WITH PASSWORD MODAL ── */}
      {passwordModalRoom && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Enter Room Password</h3>
                  <p className="text-[10px] text-slate-400">{passwordModalRoom.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalRoom(null)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Yeh room password protected hai. Is room me entry karne ke liye Host dwara set kiya gaya password enter karein.
            </p>

            <form onSubmit={handleVerifyPasswordAndJoin} className="space-y-3">
              <div className="relative">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Room Password yahan likhein..."
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPasswordText ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {passwordError && (
                <p className="text-xs font-bold text-rose-400 flex items-center gap-1">
                  <AlertCircle size={12} /> {passwordError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!enteredPassword.trim()}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  Unlock & Join Room
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FREE LESSON MCQ CHOOSER FOR HOST (0 Credits) ── */}
      {showChapterChooser && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Kisi Bhi Lesson Ka MCQ Karwayein</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      0 Credits (100% Free)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Host ke liye study room me sabhi uploaded lessons ke MCQs 100% muft hain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChapterChooser(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition hover:bg-slate-700"
              >
                <X size={15} />
              </button>
            </div>

            {/* Source Category Tabs */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Source Filter:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setChooserSource('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    chooserSource === 'ALL'
                      ? 'bg-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>🌐</span>
                  <span>Sabhi ({allRealLessons.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChooserSource('REVISION_HUB')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    chooserSource === 'REVISION_HUB'
                      ? 'bg-purple-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>⚡</span>
                  <span>MCQ + Revision ({allRealLessons.filter(l => l.sourceType === 'REVISION_HUB').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChooserSource('NOTES')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    chooserSource === 'NOTES'
                      ? 'bg-cyan-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>📖</span>
                  <span>Notes & Lucent ({allRealLessons.filter(l => l.sourceType === 'NOTES' || (l.classLevel === 'COMPETITION' && l.sourceType !== 'HOMEWORK')).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChooserSource('HOMEWORK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    chooserSource === 'HOMEWORK'
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>📝</span>
                  <span>Homework ({allRealLessons.filter(l => l.sourceType === 'HOMEWORK').length})</span>
                </button>
              </div>
            </div>

            {/* 1. Class Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  1. Class Chunein (Select Class):
                </label>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {allRealLessons.length} Lessons Available in App
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => { setChooserClass('ALL'); setChooserSubject('ALL'); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    chooserClass === 'ALL'
                      ? 'bg-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <span>🌐</span>
                  <span>Sabhi Classes ({allRealLessons.length})</span>
                </button>
                {availableClasses.map((cls) => {
                  const count = allRealLessons.filter(l => l.classLevel === cls).length;
                  const label = cls === 'COMPETITION' ? 'Competition / Lucent' : `Class ${cls}`;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => { setChooserClass(cls); setChooserSubject('ALL'); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        chooserClass === cls
                          ? 'bg-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <span>{cls === 'COMPETITION' ? '🏆' : '🎓'}</span>
                      <span>{label}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                        chooserClass === cls ? 'bg-slate-950/30 text-slate-900' : 'bg-slate-700/60 text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Subject Filter & Search Bar */}
            <div className="space-y-2">
              {availableSubjectsForClass.length > 1 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">2. Subject Chunein (Optional):</label>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setChooserSubject('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        chooserSubject === 'ALL'
                          ? 'bg-teal-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      Sabhi Subjects ({lessonsForSelectedClass.length})
                    </button>
                    {availableSubjectsForClass.map((sub) => {
                      const count = lessonsForSelectedClass.filter(l => l.subject === sub).length;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setChooserSubject(sub)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            chooserSubject === sub
                              ? 'bg-teal-500 text-slate-950 font-black'
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {sub} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={chooserSearch}
                  onChange={(e) => setChooserSearch(e.target.value)}
                  placeholder="🔍 Lesson ka naam search karein..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                />
                {chooserSearch && (
                  <button
                    onClick={() => setChooserSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 3. Lessons List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-64">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block">
                  3. Lesson Chunein ({filteredRealLessons.length} Lessons Available):
                </label>
                <span className="text-[10px] text-slate-400">
                  Tap to Start Live MCQ Battle
                </span>
              </div>

              {filteredRealLessons.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <p className="text-sm font-bold text-slate-300">Is class/subject me koi MCQ lesson nahi mila</p>
                  <p className="text-xs text-slate-500 mt-1">
                    App me wahi lessons aayenge jinme MCQs add kiye gaye hain. Kripya doosri class ya subject chunein.
                  </p>
                </div>
              ) : (
                filteredRealLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/60 transition group"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-black text-white truncate group-hover:text-emerald-300 transition">
                        {lesson.lessonTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-700/80 text-emerald-300 font-bold">
                          {lesson.classLevel === 'COMPETITION' ? 'Competition' : `Class ${lesson.classLevel}`}
                        </span>
                        <span>•</span>
                        <span className="text-slate-300 font-medium truncate max-w-[120px]">
                          {lesson.subject}
                        </span>
                        <span>•</span>
                        <span className="text-amber-300 font-black">
                          🎯 {lesson.mcqCount} MCQs
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLaunchRealLessonMcq(lesson)}
                      disabled={isLoadingChapterMcq}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isLoadingChapterMcq ? (
                        <span>Loading...</span>
                      ) : (
                        <>
                          <span>Launch Free MCQ</span>
                          <span>🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DAILY ROOM LIMIT UPGRADE MODAL ── */}
      {upgradePromptReason && (
        <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                  ⭐
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Daily Room Creation Limit Reached</h3>
                  <p className="text-[11px] text-slate-400">Upgrade for more rooms & longer duration</p>
                </div>
              </div>
              <button
                onClick={() => setUpgradePromptReason(null)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 text-xs text-slate-200 leading-relaxed">
              <p>
                Aapke aaj ke <strong>{maxRoomsPerDay} Study Rooms</strong> create karne ki limit poori ho chuki hai.
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2 text-slate-300">
                  <span>🆓</span> <b>Free User:</b> 2 Rooms per day (Max 30 min duration)
                </div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <span>⭐</span> <b>Basic User:</b> 3 Rooms per day (Max 1 Hour duration)
                </div>
                <div className="flex items-center gap-2 text-purple-300">
                  <span>👑</span> <b>Ultra User:</b> 5 Rooms per day (Max 2 Hours duration)
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setUpgradePromptReason(null);
                  onClose();
                  onOpenStore?.();
                }}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-md active:scale-95 transition cursor-pointer"
              >
                ⚡ Store Me Upgrade Karein
              </button>
              <button
                onClick={() => setUpgradePromptReason(null)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition cursor-pointer"
              >
                Band Karein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
