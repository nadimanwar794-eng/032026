import React, { useState, useEffect, useRef } from 'react';
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
  Compass
} from 'lucide-react';
import {
  type GroupStudyRoom,
  type GroupStudyMember,
  type GroupStudyMessage,
  type GroupStudyMcqQuestion,
  CURATED_MCQ_SETS,
  subscribeToActiveRooms,
  subscribeToRoom,
  createGroupRoom,
  joinGroupRoom,
  leaveGroupRoom,
  sendRoomMessage,
  toggleHandRaise,
  updateRoomTimer,
  updateLiveClass,
  setRoomMode,
  startLiveMcqBattle,
  revealMcqAnswer,
  advanceMcqQuestion,
  submitMcqAnswer,
  endLiveMcqBattle,
  syncHostActivity,
  cleanRtdbPayload,
} from '../services/groupStudyService';
import { auth } from '../firebase';

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
}) => {
  // ── Plan & Tier Permissions ───────────────────────────────────────────────
  const userTier = (user?.subscriptionLevel || 'FREE').toUpperCase();
  const isAdmin = user?.role === 'ADMIN' || user?.isAdmin;
  const config = settings?.groupStudyConfig || {};

  const dailyLimit = isAdmin ? 9999 : (
    userTier === 'ULTRA' ? (config.dailySessionsUltra ?? 9999) :
    userTier === 'BASIC' ? (config.dailySessionsBasic ?? 10) :
    (config.dailySessionsFree ?? 2)
  );

  const canCreateRoom = isAdmin || (
    userTier === 'ULTRA' ? (config.canCreateRoomsUltra !== false) :
    userTier === 'BASIC' ? (config.canCreateRoomsBasic !== false) :
    (config.canCreateRoomsFree !== false)
  );

  const canHostMcqBattle = isAdmin || (
    userTier === 'ULTRA' ? (config.canHostMcqBattleUltra !== false) :
    userTier === 'BASIC' ? (config.canHostMcqBattleBasic !== false) :
    (config.canHostMcqBattleFree !== false)
  );

  const maxRoomCapacityAllowed = isAdmin ? 200 : (
    userTier === 'ULTRA' ? (config.maxMembersUltra ?? 100) :
    userTier === 'BASIC' ? (config.maxMembersBasic ?? 25) :
    (config.maxMembersFree ?? 5)
  );

  // ── Daily Sessions Tracking & Upgrade Interception ────────────────────────
  const [todaySessionCount, setTodaySessionCount] = useState<number>(0);
  const [upgradePromptReason, setUpgradePromptReason] = useState<'DAILY_LIMIT' | 'CREATE_ROOM' | 'HOST_BATTLE' | null>(null);

  const getTodayDateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const getRecordedSessionsToday = () => {
    try {
      const key = `group_study_sessions_${user?.id || 'guest'}_${getTodayDateKey()}`;
      return parseInt(localStorage.getItem(key) || '0', 10);
    } catch {
      return 0;
    }
  };

  const recordSession = () => {
    if (isAdmin) return;
    try {
      const key = `group_study_sessions_${user?.id || 'guest'}_${getTodayDateKey()}`;
      const updated = getRecordedSessionsToday() + 1;
      localStorage.setItem(key, String(updated));
      setTodaySessionCount(updated);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setTodaySessionCount(getRecordedSessionsToday());
    }
  }, [isOpen, user?.id]);

  // ── Navigation & Rooms State ───────────────────────────────────────────────
  const [activeRooms, setActiveRooms] = useState<GroupStudyRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<GroupStudyRoom | null>(() => activeRoom || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinCodeError, setJoinCodeError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'MAIN' | 'CHAT' | 'MEMBERS' | 'LEADERBOARD'>('MAIN');

  // Keep ref to onActiveRoomChange so changing reference never triggers effect loop
  const onActiveRoomChangeRef = useRef(onActiveRoomChange);
  useEffect(() => {
    onActiveRoomChangeRef.current = onActiveRoomChange;
  });

  // Sync currentRoom if activeRoom was changed externally
  useEffect(() => {
    if (activeRoom && (!currentRoom || currentRoom.id !== activeRoom.id)) {
      setCurrentRoom(activeRoom);
    } else if (!activeRoom && currentRoom) {
      setCurrentRoom(null);
    }
  }, [activeRoom?.id]);

  // ── Create Room Form ───────────────────────────────────────────────────────
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomSubject, setNewRoomSubject] = useState<string>('Lucent Samanya Gyan');
  const [newRoomMode, setNewRoomMode] = useState<'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS'>('STUDY');
  const [newRoomMaxMembers, setNewRoomMaxMembers] = useState<number>(30);
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState<boolean>(false);

  // ── Chat & Doubts ──────────────────────────────────────────────────────────
  const [chatMessage, setChatMessage] = useState<string>('');
  const [chatFilter, setChatFilter] = useState<'ALL' | 'DOUBTS'>('ALL');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Focus Timer Local State ────────────────────────────────────────────────
  const [localSecondsRemaining, setLocalSecondsRemaining] = useState<number>(25 * 60);

  // ── Live MCQ State ─────────────────────────────────────────────────────────
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState<boolean>(false);
  const [mcqSecondsLeft, setMcqSecondsLeft] = useState<number>(20);
  const [selectedCuratedSet, setSelectedCuratedSet] = useState<string>(CURATED_MCQ_SETS[0].id);

  // ── Live Class Host Notes Input ────────────────────────────────────────────
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [notesInput, setNotesInput] = useState<string>('');
  const [classUrlInput, setClassUrlInput] = useState<string>('');

  // ── Auto-populate create room form from prefilledContext ──
  useEffect(() => {
    if (isOpen && prefilledContext) {
      const isMcq = prefilledContext.contentType === 'MCQ' || prefilledContext.contentType === 'PREMIUM_MCQ';
      const isWriting = prefilledContext.contentType === 'WRITING_NOTES';
      const isReading = prefilledContext.contentType === 'READING_NOTES';
      const isFlashcard = prefilledContext.contentType === 'FLASHCARD';

      const mode = isMcq ? 'LIVE_MCQ' : (isReading || isWriting ? 'LIVE_CLASS' : 'STUDY');
      const label = isReading ? 'Reading Notes'
        : isWriting ? 'Writing Notes'
        : isMcq ? (prefilledContext.contentType === 'PREMIUM_MCQ' ? 'MCQ Battle' : 'MCQ Practice')
        : isFlashcard ? 'Flashcards'
        : 'PDF Study';

      const titleText = (prefilledContext.chapterTitle || prefilledContext.title || '').trim();
      const generatedName = titleText 
        ? `${titleText.slice(0, 32)} · ${label}`
        : `${prefilledContext.subject || 'Live'} · ${label}`;

      setNewRoomName(generatedName);
      if (prefilledContext.subject) {
        setNewRoomSubject(prefilledContext.subject);
      }
      setNewRoomMode(mode);

      // If user isn't in an active room yet, auto-open the create room dialog for immediate action!
      if (!currentRoom) {
        setShowCreateModal(true);
      }
    }
  }, [isOpen, prefilledContext]);

  const isHost = currentRoom ? currentRoom.hostId === user?.id : false;
  const currentMember = currentRoom?.members?.[user?.id];

  // ── 1. Subscribe to Active Rooms in Lobby ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToActiveRooms((rooms) => {
      setActiveRooms(rooms);
    });
    return () => unsub();
  }, [isOpen]);

  // ── 2. Subscribe to Currently Joined Room ──────────────────────────────────
  useEffect(() => {
    const roomId = currentRoom?.id;
    if (!roomId) return;
    const unsub = subscribeToRoom(roomId, (room) => {
      if (!room) {
        // Room was deleted or closed
        setCurrentRoom(null);
        onActiveRoomChangeRef.current?.(null);
        return;
      }
      setCurrentRoom((prev) => {
        if (
          prev?.id === room.id &&
          prev.lastActive === room.lastActive &&
          prev.hostSync?.timestamp === room.hostSync?.timestamp &&
          prev.hostSync?.activeMcq?.startTime === room.hostSync?.activeMcq?.startTime &&
          prev.hostSync?.activeMcq?.status === room.hostSync?.activeMcq?.status
        ) {
          return prev;
        }
        return room;
      });
      onActiveRoomChangeRef.current?.(room);
    });

    return () => unsub();
  }, [currentRoom?.id]);

  // ── 3. Synchronized Local Focus Timer (Pure client tick: ₹0 Firebase reads) ─
  useEffect(() => {
    if (!currentRoom || currentRoom.mode !== 'STUDY') return;
    const { timer } = currentRoom;

    if (timer.isPaused || !timer.startTime) {
      setLocalSecondsRemaining(timer.remainingSeconds ?? timer.durationMinutes * 60);
      return;
    }

    const updateTick = () => {
      const elapsedSec = Math.floor((Date.now() - timer.startTime!) / 1000);
      const remaining = Math.max(0, timer.remainingSeconds - elapsedSec);
      setLocalSecondsRemaining(remaining);
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [currentRoom?.mode, currentRoom?.timer]);

  // ── 4. Synchronized Live MCQ Question Countdown ────────────────────────────
  useEffect(() => {
    if (!currentRoom || currentRoom.mode !== 'LIVE_MCQ' || !currentRoom.liveMcq?.isActive) return;
    const { liveMcq } = currentRoom;

    let interval: any = null;
    if (liveMcq.status === 'QUESTION' && liveMcq.questionStartTime) {
      const updateMcqTick = () => {
        const elapsedSec = Math.floor((Date.now() - liveMcq.questionStartTime) / 1000);
        const remaining = Math.max(0, liveMcq.durationPerQuestion - elapsedSec);
        setMcqSecondsLeft(remaining);

        // Auto-reveal if host hasn't revealed yet and timer expires
        if (remaining <= 0 && isHost && liveMcq.status === 'QUESTION') {
          revealMcqAnswer(currentRoom.id);
        }
      };

      updateMcqTick();
      interval = setInterval(updateMcqTick, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentRoom?.mode, currentRoom?.liveMcq?.status, currentRoom?.liveMcq?.questionStartTime, isHost]);

  // Reset local answer selection on new question
  useEffect(() => {
    setSelectedOption(null);
    setHasAnsweredCurrentQ(false);
  }, [currentRoom?.liveMcq?.currentQuestionIndex]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'CHAT' || activeTab === 'MAIN') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentRoom?.chat, activeTab]);

  // ── Action Handlers ────────────────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    if (!canCreateRoom) {
      setUpgradePromptReason('CREATE_ROOM');
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRoomName = newRoomName.trim() || `${user?.name || 'Live'} Study Session`;
    if (!canCreateRoom) {
      setShowCreateModal(false);
      setUpgradePromptReason('CREATE_ROOM');
      return;
    }

    setIsLoading(true);
    try {
      const effectiveUid = auth.currentUser?.uid || user?.id || 'guest';
      const effectiveName = user?.name || auth.currentUser?.displayName || 'Student';
      const roomId = await createGroupRoom(
        {
          name: effectiveRoomName,
          subject: newRoomSubject || 'General Knowledge',
          mode: newRoomMode || 'STUDY',
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

      recordSession();
      setShowCreateModal(false);
      setNewRoomName('');
      // Subscribe to created room
      const unsub = subscribeToRoom(roomId, async (room) => {
        if (room) {
          setCurrentRoom(room);
          if (onActiveRoomChange) onActiveRoomChange(room);

          // If prefilledContext was provided, immediately sync this context to hostSync in RTDB!
          if (prefilledContext) {
            const isMcq = prefilledContext.contentType === 'MCQ' || prefilledContext.contentType === 'PREMIUM_MCQ';
            try {
              await syncHostActivity(roomId, cleanRtdbPayload({
                view: 'STUDENT_DASHBOARD',
                selectedBoard: prefilledContext.board || 'BSEB',
                selectedClass: prefilledContext.classLevel || '10',
                selectedSubject: prefilledContext.subject ? { id: prefilledContext.subject, name: prefilledContext.subject } : undefined,
                selectedChapter: prefilledContext.chapterTitle ? {
                  id: prefilledContext.chapterId || '',
                  title: prefilledContext.chapterTitle,
                  subject: prefilledContext.subject || '',
                  chapterNumber: 1,
                } : undefined,
                contentType: isMcq ? 'MCQ' : (prefilledContext.contentType === 'PDF' ? 'OTHER' : 'NOTES'),
                notesState: {
                  isOpen: true,
                  title: prefilledContext.chapterTitle || prefilledContext.title || '',
                  chapterId: prefilledContext.chapterId || '',
                },
                timestamp: Date.now(),
              }));
            } catch (syncErr) {
              console.warn('Initial host sync error on room create:', syncErr);
            }
          }
        }
        unsub();
      });
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('Could not create room: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (room: GroupStudyRoom) => {
    // Check Daily Session Limit for Free Tier
    if (!isAdmin && userTier === 'FREE' && todaySessionCount >= dailyLimit) {
      setUpgradePromptReason('DAILY_LIMIT');
      return;
    }

    setIsLoading(true);
    try {
      const success = await joinGroupRoom(room.id, {
        id: user?.id || 'guest',
        name: user?.name || 'Student',
        photoURL: user?.photoURL || '',
        level: user?.level || 1,
      });

      if (success) {
        recordSession();
        setCurrentRoom(room);
        if (onActiveRoomChange) onActiveRoomChange(room);
      }
    } catch (err: any) {
      alert(err.message || 'Could not join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
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

      await handleJoinRoom(found);
      setJoinCodeInput('');
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

  // ── MCQ Battle Handlers ────────────────────────────────────────────────────
  const handleLaunchCuratedMcq = async () => {
    if (!currentRoom || !isHost) return;
    if (!canHostMcqBattle) {
      setUpgradePromptReason('HOST_BATTLE');
      return;
    }
    const selectedSet = CURATED_MCQ_SETS.find((s) => s.id === selectedCuratedSet);
    if (!selectedSet) return;

    await startLiveMcqBattle(currentRoom.id, selectedSet.name, selectedSet.questions, 20);
  };

  const handleSelectOption = async (optIdx: number) => {
    if (!currentRoom || hasAnsweredCurrentQ || !currentRoom.liveMcq) return;
    setSelectedOption(optIdx);
    setHasAnsweredCurrentQ(true);

    const q = currentRoom.liveMcq.questions[currentRoom.liveMcq.currentQuestionIndex];
    const isCorrect = optIdx === q.correctIndex;
    const timeTaken = currentRoom.liveMcq.durationPerQuestion - mcqSecondsLeft;

    await submitMcqAnswer(
      currentRoom.id,
      user?.id || 'guest',
      user?.name || 'Student',
      isCorrect,
      timeTaken,
      optIdx
    );
  };

  const handleNextMcqQuestion = async () => {
    if (!currentRoom || !isHost || !currentRoom.liveMcq) return;
    const nextIdx = currentRoom.liveMcq.currentQuestionIndex + 1;
    if (nextIdx >= currentRoom.liveMcq.totalQuestions) {
      await advanceMcqQuestion(currentRoom.id, nextIdx, true);
    } else {
      await advanceMcqQuestion(currentRoom.id, nextIdx, false);
    }
  };

  // ── Timer Handlers (Host Only) ─────────────────────────────────────────────
  const handleSetTimerDuration = async (mins: number) => {
    if (!currentRoom || !isHost) return;
    await updateRoomTimer(currentRoom.id, mins, true, null, mins * 60);
  };

  const handleStartTimer = async () => {
    if (!currentRoom || !isHost) return;
    await updateRoomTimer(
      currentRoom.id,
      currentRoom.timer.durationMinutes,
      false,
      Date.now(),
      currentRoom.timer.remainingSeconds
    );
  };

  const handlePauseTimer = async () => {
    if (!currentRoom || !isHost) return;
    await updateRoomTimer(
      currentRoom.id,
      currentRoom.timer.durationMinutes,
      true,
      null,
      localSecondsRemaining
    );
  };

  const handleResetTimer = async () => {
    if (!currentRoom || !isHost) return;
    await updateRoomTimer(
      currentRoom.id,
      currentRoom.timer.durationMinutes,
      true,
      null,
      currentRoom.timer.durationMinutes * 60
    );
  };

  if (!isOpen) return null;

  const brandColor = tierTheme?.primary || '#3b82f6';

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      id="group-study-modal-overlay"
    >
      <div
        className="w-full h-full md:h-[90vh] md:max-w-4xl bg-slate-900 border border-slate-700/60 md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        style={{
          boxShadow: `0 25px 50px -12px ${brandColor}33`,
        }}
      >
        {/* ── TOP NAV BAR ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-md text-white"
              style={{ background: brandColor }}
            >
              <Users size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm md:text-base tracking-wide text-white">
                  {currentRoom ? currentRoom.name : 'Group Study & Live Classroom'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  ₹0 Cost RTDB
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {currentRoom
                  ? `${currentRoom.subject} • ${Object.keys(currentRoom.members || {}).length} Online`
                  : 'Live peer study, synchronized Pomodoro timer & live MCQ battles'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentRoom && (
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 active:scale-95 transition"
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
                <span className="hidden sm:inline">App Par Jayein (Live)</span>
                <span className="sm:hidden">App</span>
              </button>
            )}

            {currentRoom && (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold active:scale-95 transition"
              >
                Leave
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition shrink-0"
              title={currentRoom ? 'Minimize Room' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── CONDITIONAL CONTENT: LOBBY vs ACTIVE ROOM ── */}
        {!currentRoom ? (
          /* ─────────────────────────────────────────────────────────────────
             LOBBY VIEW (Explore active rooms, create room, join via code)
          ─────────────────────────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Banner */}
            <div
              className="rounded-2xl p-5 relative overflow-hidden border border-indigo-500/30"
              style={{
                background: `linear-gradient(135deg, ${brandColor}25, #0f172a)`,
              }}
            >
              <div className="relative z-10 max-w-xl">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                    isAdmin
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : userTier === 'ULTRA'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                      : userTier === 'BASIC'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                      : 'bg-white/10 text-indigo-300 border-white/20'
                  }`}>
                    {isAdmin ? '👑 Admin: Full Unrestricted Access' :
                     userTier === 'ULTRA' ? '👑 Ultra VIP: Unlimited Sessions & Hosting' :
                     userTier === 'BASIC' ? `⭐ Basic Plan: ${dailyLimit} Sessions & Room Hosting` :
                     `🆓 Free Plan: ${todaySessionCount}/${dailyLimit} Daily Sessions Used`}
                  </span>
                  {!isAdmin && userTier === 'FREE' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStore?.();
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <span>⚡</span> Upgrade Plan
                    </button>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-2">
                  Doston ke saath milkar Live Study karein aur MCQ Battle khelein!
                </h2>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-4">
                  Synchronized Study Timer, Live MCQ quiz jisme sabhi log ek sath answer de sakte hain, aur Live Class whiteboard!
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95 transition cursor-pointer"
                    style={{ background: brandColor }}
                  >
                    <Plus size={16} /> Apna Study Room Banayein
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-700 rounded-xl px-2 py-1">
                    <input
                      type="text"
                      placeholder="Enter 6-digit Code"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs font-mono uppercase text-white px-2 py-1 w-32 placeholder:text-slate-500"
                      maxLength={6}
                    />
                    <button
                      onClick={handleJoinByCode}
                      disabled={!joinCodeInput.trim() || isLoading}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white active:scale-95 disabled:opacity-50"
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

            {/* Active Live Rooms Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-emerald-400 animate-pulse" />
                <h3 className="font-black text-base text-white">Active Live Study Rooms</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300">
                  {activeRooms.length}
                </span>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                + New Room
              </button>
            </div>

            {/* Rooms Grid */}
            {activeRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {activeRooms.map((room) => {
                  const memberCount = Object.keys(room.members || {}).length;
                  const modeBadge =
                    room.mode === 'LIVE_MCQ'
                      ? { label: '🎯 Live MCQ Battle', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                      : room.mode === 'LIVE_CLASS'
                      ? { label: '🎙️ Live Class', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
                      : { label: '⏱️ Focus Study', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };

                  return (
                    <div
                      key={room.id}
                      className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-4 hover:border-slate-600 transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${modeBadge.bg}`}
                          >
                            {modeBadge.label}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                            <Users size={12} />
                            <span className="text-white font-bold">{memberCount}</span> / {room.maxMembers}
                          </span>
                        </div>

                        <h4 className="font-black text-sm text-white group-hover:text-indigo-300 transition line-clamp-1">
                          {room.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mb-3">
                          Subject: <span className="text-slate-200 font-semibold">{room.subject}</span>
                        </p>

                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {room.hostName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-400">Host: {room.hostName}</span>
                          {room.isPrivate && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
                              <Lock size={10} /> Private
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinRoom(room)}
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                        style={{
                          background: brandColor,
                          color: '#ffffff',
                        }}
                      >
                        Join Room <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center bg-slate-900/50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                  <Users size={24} />
                </div>
                <h4 className="text-base font-black text-white mb-1">Abhi koi Live Room nahi hai</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Aap pehla Study Room banakar apne doston ko room code bhej sakte hain aur sath me study shuru kar sakte hain!
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg active:scale-95 transition inline-flex items-center gap-2 cursor-pointer"
                  style={{ background: brandColor }}
                >
                  <Plus size={14} /> Pehla Study Room Banayein
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────────
             ACTIVE ROOM VIEW (Focus Timer, Live MCQ Battle, Live Class, Chat)
          ─────────────────────────────────────────────────────────────────── */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Main Stage */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-800">
              {/* Live App Navigation Sync Card */}
              <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/30 text-white">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Live App Classroom Sync
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1 active:scale-95 transition"
                  >
                    <Minimize2 size={12} />
                    <span>App Par Jayein</span>
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {isHost
                    ? 'Admin/Host: Aap pure app ko fully use kar sakte hain! App me jakar Notes ya MCQ open karein — students ko live dikhega, MCQ solve karne ka option aayega aur notes me full host control rahega.'
                    : 'Students: Host app me jahan bhi jayenge, aapko live screen pe dikhega aur MCQ solve karne ka option aayega!'}
                </p>

                <div className="flex flex-wrap gap-2">
                  {isHost ? (
                    <>
                      <button
                        onClick={() => {
                          if (onNavigateToContent) onNavigateToContent({ tab: 'COURSES', mode: 'NOTES' });
                          onClose();
                        }}
                        className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                      >
                        <BookOpen size={14} />
                        <span>App Ke Notes Kholein</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onNavigateToContent) onNavigateToContent({ tab: 'MCQ', mode: 'MCQ' });
                          onClose();
                        }}
                        className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                      >
                        <Zap size={14} />
                        <span>App Ke MCQ Karwayein</span>
                      </button>
                    </>
                  ) : (
                    currentRoom.hostSync ? (
                      <button
                        onClick={() => {
                          if (onNavigateToContent) {
                            onNavigateToContent({
                              tab: currentRoom.hostSync?.activeTab || 'COURSES',
                              chapterId: currentRoom.hostSync?.selectedChapter?.id,
                              chapterTitle: currentRoom.hostSync?.selectedChapter?.title,
                              subjectId: currentRoom.hostSync?.selectedSubject?.id,
                              subjectName: currentRoom.hostSync?.selectedSubject?.name,
                            });
                          }
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                      >
                        <Compass size={14} />
                        <span>
                          Host Ke Saath Padhein (
                          {currentRoom.hostSync?.selectedChapter?.title ||
                            currentRoom.hostSync?.selectedSubject?.name ||
                            currentRoom.hostSync?.activeTab ||
                            'App'}
                          )
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={onClose}
                        className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                      >
                        <span>App Par Jayein (Live Dot On Screen)</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Room Mode Tabs & Host Switcher */}
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4 bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('MAIN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'MAIN'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {currentRoom.mode === 'STUDY' && <Clock size={14} />}
                    {currentRoom.mode === 'LIVE_MCQ' && <Trophy size={14} />}
                    {currentRoom.mode === 'LIVE_CLASS' && <Video size={14} />}
                    <span>
                      {currentRoom.mode === 'STUDY'
                        ? '⏱️ Study Timer'
                        : currentRoom.mode === 'LIVE_MCQ'
                        ? '🎯 MCQ Battle'
                        : '🎙️ Live Class'}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('LEADERBOARD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'LEADERBOARD'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy size={14} className="text-amber-400" />
                    <span>Leaderboard</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('MEMBERS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'MEMBERS'
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users size={14} />
                    <span>{Object.keys(currentRoom.members || {}).length}</span>
                  </button>
                </div>

                {/* Host Mode Selector */}
                {isHost && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mr-1">
                      Host Mode:
                    </span>
                    <button
                      onClick={() => setRoomMode(currentRoom.id, 'STUDY')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                        currentRoom.mode === 'STUDY'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Timer
                    </button>
                    <button
                      onClick={() => setRoomMode(currentRoom.id, 'LIVE_MCQ')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                        currentRoom.mode === 'LIVE_MCQ'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      MCQ
                    </button>
                    <button
                      onClick={() => setRoomMode(currentRoom.id, 'LIVE_CLASS')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                        currentRoom.mode === 'LIVE_CLASS'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Class
                    </button>
                  </div>
                )}
              </div>

              {/* ── TAB 1: MAIN ROOM MODE CONTENT ── */}
              {activeTab === 'MAIN' && (
                <>
                  {/* ─────────────────────────────────────────────────────────
                      MODE A: ⏱️ GROUP STUDY POMODORO TIMER
                  ─────────────────────────────────────────────────────────── */}
                  {currentRoom.mode === 'STUDY' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6">
                      <div className="relative">
                        {/* Outer Glow Ring */}
                        <div
                          className="w-56 h-56 rounded-full flex items-center justify-center p-2 border-4 shadow-2xl relative"
                          style={{
                            borderColor: `${brandColor}40`,
                            background: `radial-gradient(circle, ${brandColor}15 0%, #0f172a 70%)`,
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-4xl md:text-5xl font-black tracking-tight text-white font-mono">
                              {formatTime(localSecondsRemaining)}
                            </span>
                            <span className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                              {currentRoom.timer.isPaused ? 'Paused' : 'Deep Focus'}
                            </span>
                            <span className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Synced for all {Object.keys(currentRoom.members || {}).length} members
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Host Timer Controls */}
                      {isHost ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            {currentRoom.timer.isPaused ? (
                              <button
                                onClick={handleStartTimer}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-lg active:scale-95 transition"
                              >
                                <Play size={18} fill="currentColor" /> Start Focus
                              </button>
                            ) : (
                              <button
                                onClick={handlePauseTimer}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-lg active:scale-95 transition"
                              >
                                <Pause size={18} fill="currentColor" /> Pause
                              </button>
                            )}

                            <button
                              onClick={handleResetTimer}
                              className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700 active:scale-95 transition"
                              title="Reset Timer"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-xs font-bold">
                            <button
                              onClick={() => handleSetTimerDuration(25)}
                              className={`px-3 py-1.5 rounded-xl border ${
                                currentRoom.timer.durationMinutes === 25
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              25m Focus
                            </button>
                            <button
                              onClick={() => handleSetTimerDuration(50)}
                              className={`px-3 py-1.5 rounded-xl border ${
                                currentRoom.timer.durationMinutes === 50
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              50m Deep
                            </button>
                            <button
                              onClick={() => handleSetTimerDuration(5)}
                              className={`px-3 py-1.5 rounded-xl border ${
                                currentRoom.timer.durationMinutes === 5
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              5m Break
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-medium">
                          {currentRoom.timer.isPaused
                            ? 'Host timer start karega, tab sabka timer ek sath chalega.'
                            : 'Group Focus chal raha hai! Focus banaye rakhein.'}
                        </p>
                      )}

                      {/* Quick cheer buttons */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() =>
                            sendRoomMessage(
                              currentRoom.id,
                              { id: user.id, name: user.name, photoURL: user.photoURL },
                              '🔥 Deep study mode on!',
                              'MESSAGE'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-bold active:scale-95 transition"
                        >
                          🔥 Focusing
                        </button>
                        <button
                          onClick={() =>
                            sendRoomMessage(
                              currentRoom.id,
                              { id: user.id, name: user.name, photoURL: user.photoURL },
                              '✍️ Notes bana raha hu',
                              'MESSAGE'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-bold active:scale-95 transition"
                        >
                          ✍️ Taking Notes
                        </button>
                        <button
                          onClick={() =>
                            toggleHandRaise(
                              currentRoom.id,
                              user.id,
                              !currentMember?.handRaised
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold active:scale-95 transition flex items-center gap-1 ${
                            currentMember?.handRaised
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          ✋ {currentMember?.handRaised ? 'Hand Raised' : 'Raise Hand'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────
                      MODE B: 🎯 LIVE MCQ BATTLE (30+ people simultaneous quiz)
                  ─────────────────────────────────────────────────────────── */}
                  {currentRoom.mode === 'LIVE_MCQ' && (
                    <div className="flex-1 flex flex-col space-y-4">
                      {/* Battle State: WAITING (Host picks set and starts) */}
                      {(!currentRoom.liveMcq?.isActive || currentRoom.liveMcq?.status === 'WAITING') && (
                        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-6 text-center space-y-4 my-auto">
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-2xl">
                            🎯
                          </div>
                          <h3 className="text-lg font-black text-white">Live MCQ Battle Arena</h3>
                          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                            Ek sath 30+ students live quiz khelenge. Sabko ek hi samay par sawal aayenge aur jo sabse pehle sahi uttar dega use zyada points milenge!
                          </p>

                          {isHost ? (
                            <div className="space-y-4 max-w-md mx-auto pt-2">
                              <label className="block text-left text-xs font-bold text-slate-300">
                                Select Quiz Question Set:
                              </label>
                              <div className="space-y-2">
                                {CURATED_MCQ_SETS.map((set) => (
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
                                      <p className="text-xs font-black">{set.name}</p>
                                      <p className="text-[10px] text-slate-400">
                                        {set.questions.length} Questions • 20s per question
                                      </p>
                                    </div>
                                  </label>
                                ))}
                              </div>

                              <button
                                onClick={handleLaunchCuratedMcq}
                                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition"
                              >
                                🚀 Launch Live MCQ Battle Now!
                              </button>
                            </div>
                          ) : (
                            <div className="py-4 text-xs font-bold text-amber-400 animate-pulse">
                              ⏳ Host live MCQ quiz select kar raha hai. Tayar rahein!
                            </div>
                          )}
                        </div>
                      )}

                      {/* Battle State: QUESTION or REVEAL */}
                      {currentRoom.liveMcq?.isActive &&
                        (currentRoom.liveMcq.status === 'QUESTION' ||
                          currentRoom.liveMcq.status === 'REVEAL') && (() => {
                          const qIdx = currentRoom.liveMcq!.currentQuestionIndex;
                          const q = currentRoom.liveMcq!.questions[qIdx];
                          if (!q) return null;

                          const isReveal = currentRoom.liveMcq!.status === 'REVEAL';

                          return (
                            <div className="space-y-4 flex-1 flex flex-col justify-between">
                              {/* Header & Live Progress Bar */}
                              <div>
                                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5">
                                  <span>
                                    Question {qIdx + 1} of {currentRoom.liveMcq!.totalQuestions}
                                  </span>
                                  <span
                                    className={`font-mono font-black ${
                                      mcqSecondsLeft <= 5 ? 'text-rose-400 animate-ping' : 'text-amber-400'
                                    }`}
                                  >
                                    ⏱️ {mcqSecondsLeft}s
                                  </span>
                                </div>

                                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 transition-all duration-1000"
                                    style={{
                                      width: `${(mcqSecondsLeft / currentRoom.liveMcq!.durationPerQuestion) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Question Card */}
                              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2 inline-block">
                                  Live Battle Q{qIdx + 1}
                                </span>
                                <h4 className="text-base md:text-lg font-black text-white leading-snug">
                                  {q.question}
                                </h4>
                              </div>

                              {/* Options List */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {q.options.map((opt, optIdx) => {
                                  let btnStyle = 'bg-slate-800/70 border-slate-700 text-slate-200 hover:bg-slate-700';

                                  if (selectedOption === optIdx) {
                                    btnStyle = 'bg-indigo-600/40 border-indigo-400 text-white ring-2 ring-indigo-400';
                                  }

                                  if (isReveal) {
                                    if (optIdx === q.correctIndex) {
                                      btnStyle = 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500';
                                    } else if (selectedOption === optIdx && optIdx !== q.correctIndex) {
                                      btnStyle = 'bg-rose-600/30 border-rose-500 text-rose-300';
                                    }
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      onClick={() => handleSelectOption(optIdx)}
                                      disabled={hasAnsweredCurrentQ || isReveal}
                                      className={`p-4 rounded-2xl border text-left font-bold text-xs md:text-sm flex items-center gap-3 transition active:scale-95 disabled:cursor-not-allowed ${btnStyle}`}
                                    >
                                      <span className="w-6 h-6 rounded-lg bg-slate-950/60 flex items-center justify-center text-[11px] font-black text-slate-300 shrink-0">
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span className="flex-1 leading-snug">{opt}</span>
                                      {isReveal && optIdx === q.correctIndex && (
                                        <Check size={16} className="text-emerald-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Answer Status / Explanation */}
                              {isReveal ? (
                                <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-3 text-xs text-emerald-200">
                                  <p className="font-bold">
                                    ✅ Sahi Uttar: Option {String.fromCharCode(65 + q.correctIndex)}
                                  </p>
                                  {q.explanation && (
                                    <p className="text-[11px] text-emerald-300/80 mt-1">{q.explanation}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center text-xs font-medium text-slate-400">
                                  {hasAnsweredCurrentQ ? (
                                    <span className="text-indigo-300 font-bold">
                                      🔒 Aapka answer lock ho gaya hai! Baaki doston ka wait karein...
                                    </span>
                                  ) : (
                                    'Jaldi se sahi option chuniye (Speed par bonus points milenge!)'
                                  )}
                                </div>
                              )}

                              {/* Host Controls for MCQ */}
                              {isHost && (
                                <div className="flex items-center justify-end gap-2 pt-2">
                                  {!isReveal ? (
                                    <button
                                      onClick={() => revealMcqAnswer(currentRoom.id)}
                                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow active:scale-95 transition"
                                    >
                                      Show Correct Answer
                                    </button>
                                  ) : (
                                    <button
                                      onClick={handleNextMcqQuestion}
                                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg active:scale-95 transition flex items-center gap-1.5"
                                    >
                                      {qIdx + 1 >= currentRoom.liveMcq!.totalQuestions
                                        ? 'View Final Results 🏆'
                                        : 'Next Question ➡️'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {/* Battle State: ENDED (Podium & Final Scores) */}
                      {currentRoom.liveMcq?.status === 'ENDED' && (() => {
                        const scores = Object.entries(currentRoom.liveMcq!.scores || {}).sort(
                          (a, b) => (b[1].score || 0) - (a[1].score || 0)
                        );

                        return (
                          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-6 text-center space-y-6">
                            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                              🏆
                            </div>

                            <div>
                              <h3 className="text-xl font-black text-white">Live Battle Results!</h3>
                              <p className="text-xs text-slate-400 mt-1">
                                {currentRoom.liveMcq!.title} • {currentRoom.liveMcq!.totalQuestions} Questions Complete
                              </p>
                            </div>

                            {/* Podium Top 3 */}
                            <div className="flex items-end justify-center gap-3 pt-2">
                              {scores[1] && (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-bold text-slate-300">{scores[1][1].name}</span>
                                  <span className="text-[10px] text-amber-400 font-bold">{scores[1][1].score} pts</span>
                                  <div className="w-20 h-20 rounded-t-2xl bg-slate-700 flex items-center justify-center font-black text-xl text-slate-300 mt-1">
                                    🥈 2nd
                                  </div>
                                </div>
                              )}
                              {scores[0] && (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-black text-amber-300">{scores[0][1].name}</span>
                                  <span className="text-[11px] text-amber-400 font-black">{scores[0][1].score} pts</span>
                                  <div className="w-24 h-28 rounded-t-2xl bg-amber-500/30 border border-amber-500/50 flex items-center justify-center font-black text-2xl text-amber-400 mt-1">
                                    🥇 1st
                                  </div>
                                </div>
                              )}
                              {scores[2] && (
                                <div className="flex flex-col items-center">
                                  <span className="text-xs font-bold text-slate-300">{scores[2][1].name}</span>
                                  <span className="text-[10px] text-amber-400 font-bold">{scores[2][1].score} pts</span>
                                  <div className="w-20 h-16 rounded-t-2xl bg-amber-900/40 flex items-center justify-center font-black text-xl text-amber-600 mt-1">
                                    🥉 3rd
                                  </div>
                                </div>
                              )}
                            </div>

                            {isHost && (
                              <button
                                onClick={() => endLiveMcqBattle(currentRoom.id)}
                                className="px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs active:scale-95 transition"
                              >
                                End Battle & Return to Study Mode
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────
                      MODE C: 🎙️ LIVE CLASS & WHITEBOARD
                  ─────────────────────────────────────────────────────────── */}
                  {currentRoom.mode === 'LIVE_CLASS' && (
                    <div className="flex-1 flex flex-col space-y-4">
                      <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            🎙️ Live Classroom
                          </span>
                          {currentRoom.liveClass?.classUrl && (
                            <a
                              href={currentRoom.liveClass.classUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:underline"
                            >
                              <ExternalLink size={12} /> Open Class Stream
                            </a>
                          )}
                        </div>

                        <h4 className="font-black text-base text-white">
                          {currentRoom.liveClass?.title || 'Live Lecture Session'}
                        </h4>
                      </div>

                      {/* Whiteboard / Pinned Notes */}
                      <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                            📌 Pinned Lecture Notes & Discussion
                          </span>
                          {isHost && (
                            <button
                              onClick={() => {
                                if (isEditingNotes) {
                                  updateLiveClass(currentRoom.id, {
                                    isActive: true,
                                    title: currentRoom.liveClass?.title || 'Live Class',
                                    lectureNotes: notesInput,
                                    classUrl: classUrlInput,
                                  });
                                } else {
                                  setNotesInput(currentRoom.liveClass?.lectureNotes || '');
                                  setClassUrlInput(currentRoom.liveClass?.classUrl || '');
                                }
                                setIsEditingNotes(!isEditingNotes);
                              }}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                            >
                              {isEditingNotes ? 'Save Notes' : 'Edit Notes'}
                            </button>
                          )}
                        </div>

                        {isEditingNotes ? (
                          <div className="space-y-2 flex-1 flex flex-col">
                            <input
                              type="text"
                              placeholder="Stream URL (YouTube Live or Google Meet link, optional)"
                              value={classUrlInput}
                              onChange={(e) => setClassUrlInput(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                            />
                            <textarea
                              rows={8}
                              value={notesInput}
                              onChange={(e) => setNotesInput(e.target.value)}
                              placeholder="Type lecture points, formulas, or questions here..."
                              className="w-full flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white resize-none font-mono"
                            />
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                            {currentRoom.liveClass?.lectureNotes ||
                              'Host ne abhi tak koi notes pin nahi kiye hain.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── TAB 2: LEADERBOARD ── */}
              {activeTab === 'LEADERBOARD' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" /> Room Battle Leaderboard
                  </h4>

                  {currentRoom.liveMcq?.scores &&
                  Object.keys(currentRoom.liveMcq.scores).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(currentRoom.liveMcq.scores)
                        .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
                        .map(([uid, data], idx) => (
                          <div
                            key={uid}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/80"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 text-center font-black text-xs text-amber-400">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="text-xs font-black text-white">{data.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {data.correctCount} correct • {data.totalAnswered} attempted
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-amber-400">{data.score} pts</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">
                      Abhi koi MCQ Battle nahi hui hai. MCQ tab par jakar live quiz shuru karein!
                    </p>
                  )}
                </div>
              )}

              {/* ── TAB 3: MEMBERS LIST ── */}
              {activeTab === 'MEMBERS' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Users size={16} /> Online Members ({Object.keys(currentRoom.members || {}).length})
                  </h4>

                  <div className="space-y-2">
                    {Object.values(currentRoom.members || {}).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white">
                            {m.name.charAt(0).toUpperCase()}
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
                </div>
              )}
            </div>

            {/* ── SIDE PANEL: ROOM CHAT & DOUBTS (Lightweight RTDB) ── */}
            <div className="w-full md:w-80 flex flex-col bg-slate-950/60 shrink-0 h-64 md:h-auto">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-indigo-400" />
                  <span className="text-xs font-black text-white">Live Discussion</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={() => setChatFilter('ALL')}
                    className={`px-2 py-0.5 rounded ${
                      chatFilter === 'ALL'
                        ? 'bg-slate-700 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setChatFilter('DOUBTS')}
                    className={`px-2 py-0.5 rounded ${
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
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <span className="text-[9px] text-slate-400 mb-0.5 px-1">
                            {isMe ? 'You' : msg.userName}
                          </span>
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
                  className="px-2 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-black"
                  title="Ask Doubt"
                >
                  💡
                </button>
                <button
                  type="submit"
                  disabled={!chatMessage.trim()}
                  className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center disabled:opacity-40 transition shrink-0"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE ROOM MODAL (Nested) ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users size={18} className="text-indigo-400" /> Naya Study Room Banayein
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {prefilledContext && (
              <div className="p-2.5 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-2.5">
                <span className="text-xl shrink-0">
                  {prefilledContext.contentType === 'READING_NOTES' ? '📖' :
                   prefilledContext.contentType === 'WRITING_NOTES' ? '✍️' :
                   prefilledContext.contentType === 'MCQ' ? '🧠' :
                   prefilledContext.contentType === 'PREMIUM_MCQ' ? '🏆' :
                   prefilledContext.contentType === 'FLASHCARD' ? '🃏' : '📄'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                      {prefilledContext.contentType === 'READING_NOTES' ? 'Reading Notes Room' :
                       prefilledContext.contentType === 'WRITING_NOTES' ? 'Writing Notes Room' :
                       prefilledContext.contentType === 'MCQ' ? 'MCQ Practice Room' :
                       prefilledContext.contentType === 'PREMIUM_MCQ' ? 'Premium MCQ Battle' :
                       prefilledContext.contentType === 'FLASHCARD' ? 'Flashcard Study Room' : 'PDF Study Room'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate mt-0.5">
                    {prefilledContext.chapterTitle || prefilledContext.title || prefilledContext.subject}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Room Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mission UPSC 2026 - Lucent GK Study"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

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
                  <option value="Mathematics & Reasoning">Mathematics & Reasoning</option>
                  <option value="English & Hindi Grammar">English & Hindi Grammar</option>
                  <option value="Special Exam Revision">Special Exam Revision</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Default Mode:</label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setNewRoomMode('STUDY')}
                    className={`p-2 rounded-xl border ${
                      newRoomMode === 'STUDY'
                        ? 'bg-indigo-600/30 border-indigo-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⏱️ Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomMode('LIVE_MCQ')}
                    className={`p-2 rounded-xl border ${
                      newRoomMode === 'LIVE_MCQ'
                        ? 'bg-amber-600/30 border-amber-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🎯 Live MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomMode('LIVE_CLASS')}
                    className={`p-2 rounded-xl border ${
                      newRoomMode === 'LIVE_CLASS'
                        ? 'bg-purple-600/30 border-purple-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🎙️ Live Class
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="block text-xs font-bold text-white">Private Room</span>
                  <span className="text-[10px] text-slate-400">Kewal Code wale join kar sakenge</span>
                </div>
                <input
                  type="checkbox"
                  checked={newRoomIsPrivate}
                  onChange={(e) => setNewRoomIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700"
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px]">
                <span className="text-slate-400">Allowed Room Capacity:</span>
                <span className="font-bold text-indigo-300">
                  Max {maxRoomCapacityAllowed} Members ({userTier} Plan)
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

      {/* ── UPGRADE / ACCESS LIMIT PROMPT DIALOG ── */}
      {upgradePromptReason && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg font-black">
                  ⭐
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {upgradePromptReason === 'DAILY_LIMIT' && 'Free Daily Limit Poori Ho Gayi'}
                    {upgradePromptReason === 'CREATE_ROOM' && 'Host & Create Room Power'}
                    {upgradePromptReason === 'HOST_BATTLE' && 'Live MCQ Battle Host Power'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Basic ya Ultra Plan Features</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUpgradePromptReason(null)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
              <p className="text-xs text-slate-200 leading-relaxed">
                {upgradePromptReason === 'DAILY_LIMIT' && (
                  <>
                    Aaj ke aapke <strong>{dailyLimit} Free Group Study sessions</strong> use ho chuke hain.
                    Unlimited live classrooms aur doston ke sath non-stop padhai ke liye <strong>Basic ya Ultra Plan</strong> me upgrade karein!
                  </>
                )}
                {upgradePromptReason === 'CREATE_ROOM' && (
                  <>
                    Apna khud ka live study room create karne, whiteboard par padhane aur students ko invite karne ke liye <strong>Basic ya Ultra plan</strong> zaroori hai. Free students sabhi open rooms join kar sakte hain.
                  </>
                )}
                {upgradePromptReason === 'HOST_BATTLE' && (
                  <>
                    Live MCQ Battle host karne aur timer chalane ke liye <strong>Basic ya Ultra plan</strong> unlock karein!
                  </>
                )}
              </p>

              <div className="pt-2 border-t border-white/10 space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <span>✓</span> <strong>Basic Plan:</strong> 10 Daily Sessions, Create Study Rooms (25 Members), Join MCQ Battles
                </div>
                <div className="flex items-center gap-2 text-purple-300 font-bold">
                  <span>👑</span> <strong>Ultra Plan:</strong> Unlimited Live Classrooms (100 Members), Host Live MCQ Battles, Real-time Whiteboard
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setUpgradePromptReason(null);
                  onClose();
                  onOpenStore?.();
                }}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-200 hover:to-amber-300 shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span> Store Me Upgrade Karein
              </button>
              <button
                type="button"
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
