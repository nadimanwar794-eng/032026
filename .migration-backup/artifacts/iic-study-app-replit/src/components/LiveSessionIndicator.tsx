import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Users,
  Compass,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  LogOut,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Award,
  Zap,
  BookOpen,
  Send,
  Volume2,
  Clock,
  Play,
  Hand
} from 'lucide-react';
import {
  type GroupStudyRoom,
  type GroupStudyHostSync,
  submitStudentLiveAnswer,
  revealHostMcqAnswer,
  closeHostMcq,
  sendRoomMessage,
  toggleHandRaise
} from '../services/groupStudyService';

interface LiveSessionIndicatorProps {
  room: GroupStudyRoom;
  currentUser: any;
  settings?: any;
  onOpenRoomModal: () => void;
  onLeaveRoom: () => void;
  onFollowHost: (sync: GroupStudyHostSync) => void;
  autoFollowHost: boolean;
  onToggleAutoFollow: (val: boolean) => void;
  onBroadcastCurrentMcq?: () => void;
  isCurrentPageMcq?: boolean;
  isMinimized?: boolean;
  onMinimizeChange?: (val: boolean) => void;
}

export const LiveSessionIndicator: React.FC<LiveSessionIndicatorProps> = ({
  room,
  currentUser,
  settings,
  onOpenRoomModal,
  onLeaveRoom,
  onFollowHost,
  autoFollowHost,
  onToggleAutoFollow,
  onBroadcastCurrentMcq,
  isCurrentPageMcq = false,
  isMinimized: controlledMinimized,
  onMinimizeChange,
}) => {
  const [internalMinimized, setInternalMinimized] = useState<boolean>(false);
  const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized;

  const handleSetMinimized = (val: boolean) => {
    setInternalMinimized(val);
    onMinimizeChange?.(val);
  };
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25);
  const [handRaised, setHandRaised] = useState<boolean>(false);
  const [showQuickChat, setShowQuickChat] = useState<boolean>(false);
  const [quickMsg, setQuickMsg] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isHost = room.hostId === currentUser?.id || currentUser?.role === 'ADMIN';
  const hostSync = room.hostSync;
  const activeMcq = hostSync?.activeMcq;
  const isMcqOpen = !!activeMcq?.isOpen && activeMcq.status !== 'ENDED';

  // Check if current student has already answered this question
  const currentStudentAnswer = activeMcq?.studentAnswers?.[currentUser?.id];

  // Auto-follow host if enabled and host navigates
  const lastSyncTimeRef = useRef<number>(0);
  const onFollowHostRef = useRef(onFollowHost);
  useEffect(() => {
    onFollowHostRef.current = onFollowHost;
  });

  useEffect(() => {
    if (!autoFollowHost || isHost || !hostSync || !hostSync.timestamp) return;
    if (hostSync.timestamp > lastSyncTimeRef.current) {
      lastSyncTimeRef.current = hostSync.timestamp;
      onFollowHostRef.current(hostSync);
    }
  }, [hostSync?.timestamp, autoFollowHost, isHost]);

  // Reset student MCQ answer state on new question
  useEffect(() => {
    if (currentStudentAnswer) {
      setSelectedOption((prev) => (prev !== currentStudentAnswer.selectedOption ? currentStudentAnswer.selectedOption : prev));
      setHasAnswered((prev) => (prev !== true ? true : prev));
    } else {
      setSelectedOption((prev) => (prev !== null ? null : prev));
      setHasAnswered((prev) => (prev !== false ? false : prev));
    }
  }, [activeMcq?.questionIndex, activeMcq?.startTime, currentStudentAnswer?.selectedOption]);

  // Live MCQ countdown timer
  useEffect(() => {
    if (!isMcqOpen || activeMcq.status !== 'QUESTION' || !activeMcq.startTime) return;

    const updateTimer = () => {
      const elapsedSec = Math.floor((Date.now() - activeMcq.startTime) / 1000);
      const remaining = Math.max(0, activeMcq.durationSeconds - elapsedSec);
      setSecondsRemaining(remaining);

      // If host and timer expires, auto-reveal
      if (remaining <= 0 && isHost && activeMcq.status === 'QUESTION') {
        revealHostMcqAnswer(room.id);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isMcqOpen, activeMcq?.status, activeMcq?.startTime, isHost, room.id]);

  // Handle student answering question
  const handleSelectOption = async (optIdx: number) => {
    if (isHost || hasAnswered || !activeMcq || activeMcq.status !== 'QUESTION') return;

    setSelectedOption(optIdx);
    setHasAnswered(true);
    const timeTaken = Math.max(1, activeMcq.durationSeconds - secondsRemaining);
    const isCorrect = optIdx === activeMcq.correctIndex;

    await submitStudentLiveAnswer(
      room.id,
      {
        id: currentUser?.id || 'guest',
        name: currentUser?.name || 'Student',
        photoURL: currentUser?.photoURL || '',
      },
      optIdx,
      isCorrect,
      timeTaken
    );

    setToastMessage(isCorrect ? '✨ Answer Submitted! Great job!' : '✨ Answer Submitted!');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Student toggle hand raise
  const handleToggleHand = async () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    await toggleHandRaise(room.id, currentUser?.id || 'guest', nextState);
    if (nextState) {
      await sendRoomMessage(
        room.id,
        {
          id: currentUser?.id || 'guest',
          name: currentUser?.name || 'Student',
          photoURL: currentUser?.photoURL || '',
        },
        '🖐️ Doubts / Sawal Poochna Hai!',
        'HAND_RAISE'
      );
      setToastMessage('🖐️ Host ko alert bhej diya gaya hai!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Quick Chat submit
  const handleSendQuickChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMsg.trim()) return;
    await sendRoomMessage(
      room.id,
      {
        id: currentUser?.id || 'guest',
        name: currentUser?.name || 'Student',
        photoURL: currentUser?.photoURL || '',
      },
      quickMsg.trim(),
      'MESSAGE'
    );
    setQuickMsg('');
    setShowQuickChat(false);
    setToastMessage('Message sent to room!');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const memberCount = Object.keys(room.members || {}).length;

  // Derive readable location text from hostSync
  const getLocationLabel = () => {
    if (!hostSync) return 'Classroom Lobby';
    if (hostSync.notesState?.isOpen && hostSync.notesState.title) {
      return `📖 Notes: ${hostSync.notesState.title}`;
    }
    if (hostSync.selectedChapter?.title) {
      return `📚 ${hostSync.selectedChapter.title}`;
    }
    if (hostSync.selectedSubject?.name) {
      return `📁 ${hostSync.selectedSubject.name}`;
    }
    if (hostSync.activeTab === 'MCQ') return '🎯 MCQ Practice Hub';
    if (hostSync.activeTab === 'COURSES') return '📖 Syllabus & Subjects';
    if (hostSync.activeTab === 'REVISION') return '⚡ Revision Hub';
    return hostSync.activeTab || 'App Home';
  };

  return (
    <>
      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-2xl bg-slate-900/95 text-white font-bold text-xs shadow-2xl border border-indigo-500/40 backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in duration-200">
          <Sparkles size={14} className="text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. FLOATING LIVE SYMBOL / HUD WIDGET (Hidden when minimized, moved to top-bar) ── */}
      {!isMinimized && (
        <aside
          aria-label="Live Session Floating Bar"
          className="fixed bottom-18 right-3 md:bottom-6 md:right-6 z-[9400] flex flex-col items-end transition-all select-none"
        >
          {/* EXPANDED LIVE HUD BAR */}
          <div className="w-[320px] sm:w-[360px] rounded-3xl bg-slate-950/95 border-2 border-indigo-500/40 text-white shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Header row with Glowing Live Pill & Minimize */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800/80">
              <div className="flex items-center gap-2 min-w-0">
                {/* Pulsing Red Dot */}
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 uppercase tracking-wider border border-rose-500/30">
                      LIVE
                    </span>
                    <span className="text-xs font-black text-white truncate max-w-[150px]">
                      {room.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Code: <span className="font-mono text-indigo-300 font-bold">{room.code}</span> • 👥 {memberCount} Online
                  </p>
                </div>
              </div>

              {/* Top Action Icons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onOpenRoomModal}
                  aria-label="Open classroom window"
                  title="Open full classroom window"
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={() => handleSetMinimized(true)}
                  aria-label="Minimize into Top Bar Red Dot"
                  title="Minimize into Top Bar Red Dot"
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            {/* Content / Status Body */}
            <div className="p-3 space-y-2.5">
              {/* Real-time Location / Synchronized view */}
              <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
                    <Compass size={12} className="animate-spin text-indigo-400 duration-3000" />
                    <span>{isHost ? 'Your App Navigation (Broadcasting)' : `${room.hostName || 'Host'} is viewing:`}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {getLocationLabel()}
                  </p>
                  {hostSync?.notesState?.isOpen && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      📖 Host Controlled Notes
                    </span>
                  )}
                </div>

                {/* Follow Host Action Button (For Students) */}
                {!isHost && hostSync && (
                  <button
                    onClick={() => onFollowHost(hostSync)}
                    className="shrink-0 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-[11px] shadow-md active:scale-95 transition flex items-center gap-1"
                    title="Jump to where host is studying"
                  >
                    <span>Follow</span>
                  </button>
                )}
              </div>

              {/* Host Specific Quick Broadcast Trigger (When Host is on MCQ page) */}
              {isHost && isCurrentPageMcq && onBroadcastCurrentMcq && !isMcqOpen && (
                <button
                  onClick={onBroadcastCurrentMcq}
                  className="w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5"
                >
                  <Zap size={14} className="fill-current" />
                  <span>Broadcast This App MCQ to Students</span>
                </button>
              )}

              {/* Student Auto-Follow Toggle & Raise Hand */}
              {!isHost && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={autoFollowHost}
                      onChange={(e) => onToggleAutoFollow(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-700 cursor-pointer"
                    />
                    <span>Auto-Follow Host</span>
                  </label>

                  <button
                    onClick={handleToggleHand}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 active:scale-95 transition border ${
                      handRaised
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    }`}
                  >
                    <Hand size={12} />
                    <span>{handRaised ? 'Hand Raised' : 'Ask Doubt'}</span>
                  </button>
                </div>
              )}

              {/* Bottom Quick Bar: Quick Chat, Open Lobby & Leave */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setShowQuickChat((prev) => !prev)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition border border-slate-700/60"
                >
                  <MessageSquare size={12} />
                  <span>Chat</span>
                </button>

                <button
                  onClick={onOpenRoomModal}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition border border-indigo-500/30"
                >
                  <Users size={12} />
                  <span>Room Room</span>
                </button>

                <button
                  onClick={onLeaveRoom}
                  className="py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition border border-rose-500/30"
                  title="Leave Room"
                >
                  <LogOut size={12} />
                </button>
              </div>

              {/* Quick Chat Input Box (Collapsible) */}
              {showQuickChat && (
                <form onSubmit={handleSendQuickChat} className="flex gap-1 pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={quickMsg}
                    onChange={(e) => setQuickMsg(e.target.value)}
                    placeholder="Send a quick doubt or message..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center active:scale-90 transition shrink-0"
                  >
                    <Send size={13} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ── 2. INTERACTIVE LIVE MCQ OVERLAY ("jab mcq me jayega user ko mcq banane ka option aayega") ── */}
      {isMcqOpen && activeMcq && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live MCQ Battle"
          className="fixed inset-x-3 bottom-20 md:bottom-8 md:right-8 md:left-auto md:w-[420px] z-[9600] rounded-3xl bg-slate-950 border-2 border-amber-500 shadow-2xl backdrop-blur-xl text-white overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        >
          {/* Top Bar with Question Count & Timer */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <div>
                <span className="text-xs font-black tracking-wider uppercase text-amber-300">
                  Live MCQ • Q{activeMcq.questionIndex + 1}/{activeMcq.totalQuestions}
                </span>
                {activeMcq.chapterTitle && (
                  <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                    {activeMcq.chapterTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Timer countdown badge */}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-black border ${
                  secondsRemaining <= 5
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-bounce'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                <Clock size={12} />
                <span>{secondsRemaining}s</span>
              </div>

              {isHost && (
                <button
                  onClick={() => closeHostMcq(room.id)}
                  className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                  title="Close Live MCQ"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
            <p className="text-sm md:text-base font-bold text-slate-100 leading-snug">
              {activeMcq.questionText}
            </p>

            {/* Options List (A, B, C, D) */}
            <div className="space-y-2 pt-1">
              {(activeMcq.options || []).map((optionText, oi) => {
                const isSelected = selectedOption === oi;
                const isRevealed = activeMcq.status === 'REVEAL';
                const isCorrectOption = oi === activeMcq.correctIndex;

                let optionClass = 'bg-slate-900/90 border-slate-700 hover:border-slate-600 text-slate-200';

                if (isRevealed) {
                  if (isCorrectOption) {
                    optionClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                  } else if (isSelected && !isCorrectOption) {
                    optionClass = 'bg-rose-500/20 border-rose-500 text-rose-300 line-through';
                  }
                } else if (isSelected) {
                  optionClass = 'bg-indigo-600 border-indigo-400 text-white font-bold shadow-lg shadow-indigo-500/30 scale-[1.01]';
                }

                return (
                  <button
                    key={oi}
                    onClick={() => handleSelectOption(oi)}
                    disabled={isHost || isRevealed || hasAnswered}
                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-start gap-3 active:scale-[0.99] ${optionClass} ${
                      isHost || isRevealed || hasAnswered ? 'cursor-default' : 'cursor-pointer hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        isSelected
                          ? 'bg-white text-indigo-900'
                          : isRevealed && isCorrectOption
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-xs md:text-sm flex-1 leading-relaxed">{optionText}</span>
                    {isRevealed && isCorrectOption && (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {isRevealed && isSelected && !isCorrectOption && (
                      <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation when Revealed */}
            {activeMcq.status === 'REVEAL' && activeMcq.explanation && (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                <span className="font-black text-amber-300">💡 Explanation: </span>
                <span>{activeMcq.explanation}</span>
              </div>
            )}

            {/* Submissions Count / Leaderboard summary */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span>
                Answers: <strong className="text-white">{Object.keys(activeMcq.studentAnswers || {}).length}</strong> submitted
              </span>
              {hasAnswered && !isHost && (
                <span className="text-emerald-400 font-bold">✓ Your answer recorded</span>
              )}
            </div>

            {/* Host Controls for MCQ */}
            {isHost && (
              <div className="flex gap-2 pt-2">
                {activeMcq.status === 'QUESTION' ? (
                  <button
                    onClick={() => revealHostMcqAnswer(room.id)}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition"
                  >
                    Reveal Answer Now
                  </button>
                ) : (
                  <button
                    onClick={() => closeHostMcq(room.id)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md active:scale-95 transition"
                  >
                    Finish Question
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
