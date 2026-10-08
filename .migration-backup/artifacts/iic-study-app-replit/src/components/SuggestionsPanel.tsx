// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Lightbulb,
  ThumbsUp,
  Send,
  X,
  Trash2,
  MessageSquare,
  Clock,
  RefreshCw,
  ShieldCheck,
  Tag,
  FilePen,
  AlertCircle,
  Trophy,
  Coins,
  Camera,
  Download,
  Eye,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { uploadImageToImgBB } from '../services/imgbbService';
import {
  saveSuggestion,
  subscribeSuggestions,
  reactToSuggestion,
  adminReplySuggestion,
  deleteSuggestion,
  resolvesuggestion,
  applyNoteCorrection,
  subscribeLeaderboard,
  subscribeUserCoins,
  markSuggestionOpenedByAdmin,
  SuggLeaderboardEntry,
} from '../firebase';

interface SuggestionItem {
  id: string;
  text: string;
  imageUrl?: string;
  uid: string;
  userName: string;
  userBoard?: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  likedBy: Record<string, boolean>;
  dislikedBy: Record<string, boolean>;
  adminReply?: string;
  adminReplyAt?: string;
  adminTag?: string;
  adminOpened?: boolean;
  adminOpenedAt?: string;
  status: 'open' | 'replied' | 'resolved';
  lessonTitle?: string;
  pageNo?: string;
  mode?: 'reading' | 'writing' | 'mcq';
  subject?: string;
  classLevel?: string;
}

interface Props {
  user: any;
  isAdmin: boolean;
  onClose: () => void;
  context?: {
    lessonTitle?: string;
    pageNo?: string | number;
    mode?: 'reading' | 'writing' | 'mcq';
    subject?: string;
    classLevel?: string;
    noteChunks?: string[];
  };
  currentNoteChunks?: string[];
  onNoteChunksUpdated?: (updatedChunks: string[]) => void;
}

const TAG_OPTIONS = [
  { id: 'typo', label: '🔤 Spelling / Typo', color: '#60a5fa' },
  { id: 'concept', label: '🧠 Wrong Concept', color: '#f87171' },
  { id: 'hindi_mistake', label: '🇮🇳 Hindi Anuvaad Galti', color: '#fb923c' },
  { id: 'missing_info', label: '➕ Missing Info', color: '#a78bfa' },
  { id: 'fixed', label: '✅ Note mein Fix Kar Diya', color: '#4ade80' },
  { id: 'rejected', label: '❌ Sahi hai (No issue)', color: '#94a3b8' },
  { id: 'duplicate', label: '🔁 Duplicate Report', color: '#e879f9' },
];

export const SuggestionsPanel: React.FC<Props> = ({
  user,
  isAdmin,
  onClose,
  context,
  currentNoteChunks,
  onNoteChunksUpdated,
}) => {
  const [tab, setTab] = useState<'feed' | 'submit' | 'history'>('feed');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyTag, setReplyTag] = useState('');
  const [replyStatus, setReplyStatus] = useState<'replied' | 'resolved'>('replied');
  const [savingReply, setSavingReply] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [editCorrections, setEditCorrections] = useState<Record<number, string>>({});
  const [applyingEdit, setApplyingEdit] = useState(false);
  const [editResult, setEditResult] = useState<{ success: boolean; count: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [leaderboard, setLeaderboard] = useState<SuggLeaderboardEntry[]>([]);
  const [userCoins, setUserCoins] = useState(0);
  const [userCoinHistory, setUserCoinHistory] = useState<any[]>([]);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uid = user?.uid || user?.id || '';

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Photo size 15MB se kam honi chahiye.');
      return;
    }
    setSelectedImageFile(file);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const unsub = subscribeSuggestions((items) => setSuggestions(items));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeLeaderboard((entries) => setLeaderboard(entries));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeUserCoins(uid, (coins, history) => {
      setUserCoins(coins);
      setUserCoinHistory(history);
    });
    return () => unsub();
  }, [uid]);

  const handleSubmit = async () => {
    if ((!newText.trim() && !selectedImageFile) || submitting) return;
    setSubmitting(true);

    let finalImageUrl: string | undefined = undefined;

    try {
      if (selectedImageFile) {
        setIsUploadingImage(true);
        const uploaded = await uploadImageToImgBB(selectedImageFile);
        if (uploaded) {
          finalImageUrl = uploaded;
        }
      }

      await saveSuggestion({
        text: newText.trim() || 'Photo ke sath report submit ki gayi hai',
        imageUrl: finalImageUrl,
        uid: uid || 'anonymous',
        userName: user?.displayName || user?.name || 'A student',
        userBoard: user?.board || '',
        createdAt: new Date().toISOString(),
        lessonTitle: context?.lessonTitle,
        pageNo: context?.pageNo ? String(context.pageNo) : undefined,
        mode: context?.mode,
        subject: context?.subject,
        classLevel: context?.classLevel,
        adminOpened: false,
      });

      setNewText('');
      handleClearImage();
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setTab('feed');
      }, 1500);
    } catch (e) {
      console.error('[SuggestionsPanel] submit error:', e);
    } finally {
      setSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  const handleUpvote = async (id: string) => {
    if (!uid) return;
    await reactToSuggestion(id, uid, 'like');
  };

  const handleMarkOpened = async (id: string) => {
    try {
      await markSuggestionOpenedByAdmin(id);
    } catch (e) {
      console.error('[SuggestionsPanel] mark opened error:', e);
    }
  };

  const handleAdminReply = async (id: string) => {
    if (!replyText.trim() || savingReply) return;
    setSavingReply(true);
    await adminReplySuggestion(id, replyText.trim(), replyTag || undefined, replyStatus);
    setSavingReply(false);
    setReplyingId(null);
    setReplyText('');
    setReplyTag('');
    setReplyStatus('replied');
  };

  const handleResolve = async (id: string) => {
    await resolvesuggestion(id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Is suggestion ko delete karein?')) return;
    await deleteSuggestion(id);
  };

  const counts = {
    all: suggestions.length,
    open: suggestions.filter((s) => s.status === 'open').length,
    resolved: suggestions.filter((s) => s.status === 'resolved').length,
  };

  const filtered = suggestions.filter((s) => {
    if (activeFilter === 'open') return s.status === 'open';
    if (activeFilter === 'resolved') return s.status === 'resolved';
    return true;
  });

  const timeAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(ms / 86400000);
    if (d > 0) return `${d}d pehle`;
    if (h > 0) return `${h}h pehle`;
    if (m > 0) return `${m}m pehle`;
    return 'abhi';
  };

  const reasonLabel = (reason: string) => {
    if (reason === 'SUGG_FIXED') return '🎯 Teri pakdi galti fix ho gayi';
    if (reason === 'SUGG_REPLY') return '✅ Admin ne reply diya';
    return '🪙 Reward coins';
  };

  const userTier = (user?.subscriptionLevel || 'FREE')?.toUpperCase();
  const isPaidUser =
    isAdmin ||
    ((userTier === 'ULTRA' || userTier === 'BASIC' || user?.isPremium) &&
      (!user?.subscriptionEndDate || new Date(user.subscriptionEndDate).getTime() > Date.now()));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUserSubmissions = suggestions.filter(
    (s) => s.uid === uid && s.createdAt?.slice(0, 10) === todayStr
  );
  const freeDailyLimit = 3;
  const freeRemainingToday = Math.max(0, freeDailyLimit - todayUserSubmissions.length);
  const canSubmit = isPaidUser || freeRemainingToday > 0;

  return createPortal(
    <>
      {/* Fullscreen View with Community Theme Background */}
      <div
        id="suggestions-panel-fullscreen"
        className="fixed inset-0 z-[99999] flex flex-col w-full h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top App Header */}
        <div className="flex items-center justify-between px-3.5 py-3 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
            title="Wapas Community Par Jaayein"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs font-black">
              <Lightbulb size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-slate-900 dark:text-white text-sm leading-tight truncate">
                Notes Fix Hub
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                {suggestions.length} total • Community notes mistakes & corrections
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-90 transition cursor-pointer"
            title="Band Karein"
          >
            <X size={16} />
          </button>
        </div>

        {/* 3 Main Tabs Bar (Feed, Notes Fix, History) */}
        <div className="w-full px-3.5 py-2.5 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-2.5 max-w-xl mx-auto">
            {(['feed', 'submit', 'history'] as const).map((t) => {
              const labels = {
                feed: '📋 Feed',
                submit: '✍️ Notes Fix',
                history: '📜 History',
              };
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    if (t === 'submit') {
                      setTimeout(() => textareaRef.current?.focus(), 150);
                    }
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none text-center flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400 scale-[1.01]'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 max-w-2xl mx-auto w-full">
          {/* ── FEED TAB ── */}
          {tab === 'feed' && (
            <div>
              {/* Filter Chips: All, Open, Resolved */}
              <div className="flex gap-2 mb-3.5 flex-wrap">
                {(['all', 'open', 'resolved'] as const).map((f) => {
                  const labels = {
                    all: `All (${counts.all})`,
                    open: `⏳ Open (${counts.open})`,
                    resolved: `🎯 Resolved (${counts.resolved})`,
                  };
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveFilter(f)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer select-none shadow-xs active:scale-95 ${
                        activeFilter === f
                          ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400/50'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>

              {/* Suggestions List */}
              {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Lightbulb size={24} />
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                    {activeFilter === 'resolved'
                      ? 'Koi resolved galti nahi hai'
                      : activeFilter === 'open'
                      ? 'Sabhi galtiyan review ho chuki hain!'
                      : 'Abhi koi suggestion ya note mistake report nahi hai'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    Notes padhte waqt galti dikhe toh "✍️ Notes Fix" se report karein!
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filtered.map((s) => {
                    const hasLiked = !!s.likedBy?.[uid];
                    const hasReply = !!s.adminReply;

                    return (
                      <div
                        key={s.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all"
                      >
                        {/* Status bar directly on top of report */}
                        <div
                          className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-xs font-black ${
                            s.status === 'resolved'
                              ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300'
                              : hasReply || s.status === 'replied'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                              : s.adminOpened
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300'
                              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {s.status === 'resolved' ? (
                              <>
                                <ShieldCheck
                                  size={14}
                                  className="shrink-0 text-purple-600 dark:text-purple-400"
                                />
                                <span className="truncate">
                                  🎯 Admin ne Galti Resolve / Sudhar Diya Hai
                                </span>
                              </>
                            ) : hasReply || s.status === 'replied' ? (
                              <>
                                <MessageSquare
                                  size={14}
                                  className="shrink-0 text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="truncate">
                                  ✅ Admin ne Dekh Kar Reply Diya Hai
                                </span>
                              </>
                            ) : s.adminOpened ? (
                              <>
                                <Eye
                                  size={14}
                                  className="shrink-0 text-blue-600 dark:text-blue-400"
                                />
                                <span className="truncate">
                                  👁️ Admin ne Open Kar Liya Hai (Review Chalu Hai)
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock
                                  size={14}
                                  className="shrink-0 text-amber-600 dark:text-amber-400"
                                />
                                <span className="truncate">
                                  ⏳ Admin ne Abhi Open Nahi Kiya (Pending Review)
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 bg-white/90 dark:bg-slate-900/90 shadow-2xs">
                            {s.status === 'resolved'
                              ? 'RESOLVED'
                              : hasReply
                              ? 'REPLIED'
                              : s.adminOpened
                              ? 'OPENED'
                              : 'NOT OPENED'}
                          </span>
                        </div>

                        {/* Report Header (User & Context Info) */}
                        <div className="p-3.5 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                                {s.userName?.charAt(0)?.toUpperCase() || 'S'}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                                  {s.userName}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {timeAgo(s.createdAt)}
                                  {s.userBoard ? ` • ${s.userBoard}` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Tags or Lesson Metadata */}
                            <div className="flex flex-wrap items-center gap-1 justify-end">
                              {s.lessonTitle && (
                                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  📖 {s.lessonTitle}
                                </span>
                              )}
                              {s.pageNo && (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                  Page {s.pageNo}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Report Text */}
                          <p className="mt-2.5 text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                            {s.text}
                          </p>

                          {/* Screenshot Image Attachment */}
                          {s.imageUrl && (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() => setLightboxImage(s.imageUrl || null)}
                                className="group relative block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 cursor-zoom-in"
                              >
                                <img
                                  src={s.imageUrl}
                                  alt="Report Screenshot"
                                  className="w-full max-h-56 object-cover object-top group-hover:scale-[1.01] transition-transform"
                                />
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs">
                                  <Eye size={12} />
                                  <span>Tap to View</span>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Bar (Upvote & Admin Controls) */}
                        <div className="px-3.5 py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                          <button
                            type="button"
                            onClick={() => handleUpvote(s.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                              hasLiked
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800'
                            }`}
                          >
                            <ThumbsUp size={13} />
                            <span>{s.likes || 0} Agree</span>
                          </button>

                          {isAdmin && (
                            <div className="flex items-center gap-1.5">
                              {/* Quick Mark Opened button if not opened yet */}
                              {!s.adminOpened && !hasReply && s.status === 'open' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkOpened(s.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer"
                                  title="Mark Under Review"
                                >
                                  <Eye size={12} />
                                  <span>Mark Open</span>
                                </button>
                              )}

                              {/* Reply Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingId(replyingId === s.id ? null : s.id);
                                  setReplyText(s.adminReply || '');
                                  setReplyTag(s.adminTag || '');
                                  setReplyStatus(s.status === 'resolved' ? 'resolved' : 'replied');
                                  if (!s.adminOpened) {
                                    handleMarkOpened(s.id);
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                              >
                                <MessageSquare size={12} />
                                <span>{hasReply ? 'Edit Reply' : 'Reply'}</span>
                              </button>

                              {/* Resolve Button */}
                              {s.status !== 'resolved' && (
                                <button
                                  type="button"
                                  onClick={() => handleResolve(s.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
                                >
                                  <ShieldCheck size={12} />
                                  <span>Resolve</span>
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDelete(s.id)}
                                className="p-1 rounded-xl text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ── ADMIN REPLY DISPLAY (Directly under each report) ── */}
                        {hasReply && (
                          <div className="px-3.5 pb-3.5 pt-1">
                            <div className="rounded-xl p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                                    ✓
                                  </div>
                                  <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                                    Admin Reply
                                  </span>
                                  {s.adminTag && (
                                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                      {s.adminTag}
                                    </span>
                                  )}
                                </div>
                                {s.adminReplyAt && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {timeAgo(s.adminReplyAt)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
                                {s.adminReply}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* ── INLINE ADMIN REPLY COMPOSER ── */}
                        {isAdmin && replyingId === s.id && (
                          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60">
                            <p className="text-xs font-black text-slate-900 dark:text-white mb-2">
                              ✍️ Admin Reply Dein:
                            </p>
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Apna reply likhein..."
                              className="w-full rounded-xl p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none resize-none focus:ring-1 focus:ring-amber-500"
                              rows={3}
                            />

                            {/* Tag Selection */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {TAG_OPTIONS.map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => setReplyTag(replyTag === tag.label ? '' : tag.label)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    replyTag === tag.label
                                      ? 'bg-amber-500 text-slate-950 font-black'
                                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              ))}
                            </div>

                            {/* Status & Save Buttons */}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={replyStatus === 'resolved'}
                                    onChange={(e) =>
                                      setReplyStatus(e.target.checked ? 'resolved' : 'replied')
                                    }
                                    className="rounded"
                                  />
                                  <span>Mark Resolved as well</span>
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingId(null)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdminReply(s.id)}
                                  disabled={!replyText.trim() || savingReply}
                                  className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                  {savingReply ? 'Saving...' : 'Send Reply'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── NOTES FIX (SUBMIT) TAB ── */}
          {tab === 'submit' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
              {submitted ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} />
                  </div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Dhanyawaad! Report Submit Ho Gayi
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Admin jald hi review karega aur points update honge.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lightbulb size={16} className="text-amber-500" />
                      <span>Notes Mein Galti Report Karein</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Spelling mistake, galat anuvaad, missing point ya concept error batayein.
                    </p>
                  </div>

                  {/* Lesson Context preview if launched from reader */}
                  {context?.lessonTitle && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-black">📖 Current Lesson Context:</p>
                      <p className="text-[11px] mt-0.5">
                        {context.lessonTitle} • Page {context.pageNo || 1} • {context.mode || 'notes'}
                      </p>
                    </div>
                  )}

                  {/* Textarea */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Kahan galti hai aur sahi kya hona chahiye?
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Udaharan: Page 2 par paragraph 3 mein formula galat likha hai..."
                      rows={5}
                      maxLength={500}
                      className="w-full rounded-xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 outline-none resize-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                      <span>Board: {user?.board || 'All'}</span>
                      <span>{newText.length}/500</span>
                    </div>
                  </div>

                  {/* Screenshot / Photo Attachment */}
                  <div>
                    <input
                      id="nsta-suggestion-photo-input"
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="sr-only"
                    />

                    {imagePreviewUrl ? (
                      <div className="relative inline-block mt-1">
                        <img
                          src={imagePreviewUrl}
                          alt="Screenshot preview"
                          className="w-40 h-28 object-cover rounded-xl border border-amber-400 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={handleClearImage}
                          className="absolute -top-2 -right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer active:scale-95"
                          title="Hataayein"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="nsta-suggestion-photo-input"
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs font-bold cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-all select-none"
                      >
                        <Camera size={16} />
                        <span>Screenshot / Photo Attach Karein (Optional)</span>
                      </label>
                    )}
                  </div>

                  {/* Quota & Submit */}
                  {!canSubmit ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        ⚠️ Aaj ka Free Quota (3/3) poora ho gaya hai
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Aap kal naye suggestions submit kar sakte hain ya VIP access lein.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={(!newText.trim() && !selectedImageFile) || submitting}
                      className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Submit ho raha hai...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>
                            Submit Suggestion{' '}
                            {!isPaidUser && `(${freeRemainingToday} left today)`}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="space-y-4">
              {/* User Coins summary */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-purple-500/15 border border-amber-300/40 dark:border-amber-700/40 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Aapke Total Coins
                  </p>
                  <p className="text-xl font-black text-amber-500 dark:text-amber-400 flex items-center gap-1.5 mt-0.5">
                    <Coins size={20} />
                    <span>{userCoins} Coins</span>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                  <p>🎯 Fix = 20 Coins</p>
                  <p>✅ Reply = 5 Coins</p>
                </div>
              </div>

              {/* Coin History */}
              {uid && userCoinHistory.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                  <p className="text-xs font-black text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                    <Coins size={14} className="text-amber-500" />
                    <span>Coin Earning History</span>
                  </p>
                  <div className="space-y-2">
                    {userCoinHistory.slice(0, 10).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <span className="text-slate-700 dark:text-slate-300">
                          {reasonLabel(h.reason)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-amber-500">+{h.amount} 🪙</span>
                          <span className="text-[10px] text-slate-400">{timeAgo(h.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-by-Day Activity */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-black text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-500" />
                  <span>Pichle 7 Dino Ki Activity</span>
                </p>

                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().slice(0, 10);
                  const dayItems = suggestions.filter((s) => {
                    const replyDate = s.adminReplyAt?.slice(0, 10);
                    const createDate = s.createdAt?.slice(0, 10);
                    return replyDate === dateStr || createDate === dateStr;
                  });
                  const dayLabel = i === 0 ? 'Aaj' : i === 1 ? 'Kal' : `${i} din pehle`;
                  const dayFull = d.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short',
                  });

                  return (
                    <div key={dateStr} className="mb-3.5 last:mb-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                          {dayLabel} • <span className="text-slate-400 font-normal">{dayFull}</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {dayItems.length} changes
                        </span>
                      </div>
                      {dayItems.length === 0 ? (
                        <p className="text-[11px] text-slate-400 pl-2">Koi activity nahi</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayItems.map((s) => (
                            <div
                              key={s.id}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs"
                            >
                              <p className="text-slate-800 dark:text-slate-200 line-clamp-1">
                                {s.text}
                              </p>
                              {s.adminReply && (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 line-clamp-1">
                                  ↳ {s.adminReply}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for enlarged screenshot view */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in select-none"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              target="_blank"
              rel="noopener noreferrer"
              download="suggestion_screenshot.jpg"
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-lg active:scale-95"
              title="Screenshot Download Karein"
            >
              <Download size={20} />
            </a>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer shadow-lg active:scale-95"
              title="Band Karein"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="max-w-4xl max-h-[85vh] relative flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage}
              alt="Enlarged Screenshot"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
export default SuggestionsPanel;
