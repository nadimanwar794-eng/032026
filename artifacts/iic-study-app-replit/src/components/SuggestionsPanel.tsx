// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb, ThumbsUp, Send, X, Trash2, MessageSquare, CheckCircle, Clock, RefreshCw, ShieldCheck, Tag, FilePen, AlertCircle, Trophy, Coins, Star, Award, Camera, Download, Maximize2, Lock } from 'lucide-react';
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
  updateSuggestionLeaderboard,
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
  tierTheme?: any;
}

const ADMIN_TAGS = [
  'Thanks, fixed in next update',
  'Will be addressed soon',
  'Already noted',
  'Not a bug — working as intended',
  'Needs more info',
];

const statusConfig = {
  open:     { label: '⏳ Open',     bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d' },
  replied:  { label: '✅ Replied',  bg: 'rgba(16,185,129,0.2)',   color: '#6ee7b7' },
  resolved: { label: '🎯 Resolved', bg: 'rgba(139,92,246,0.2)',   color: '#c4b5fd' },
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const reasonLabel = (reason: string) => {
  if (reason === 'galti_resolved') return '🎯 Galti fix hui';
  if (reason === 'admin_replied') return '✅ Admin reply mila';
  return reason;
};

export function SuggestionsPanel({ user, isAdmin, onClose, tierTheme }: Props) {
  const brandPrimary = tierTheme?.primary || '#f59e0b';
  const brandMid = tierTheme?.mid || brandPrimary;
  const brandBorder = (tierTheme as any)?.cardBorderColor || tierTheme?.primary || brandPrimary;
  const brandGrad = tierTheme?.btnGrad || `linear-gradient(135deg, ${brandPrimary}, ${brandMid})`;

  const [tab, setTab] = useState<'feed' | 'submit' | 'history' | 'rank'>('feed');
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'replied' | 'open' | 'resolved'>('all');
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
    try {
      let uploadedImageUrl = '';
      if (selectedImageFile) {
        setIsUploadingImage(true);
        uploadedImageUrl = await uploadImageToImgBB(
          selectedImageFile,
          `sug_${uid}_${Date.now()}`
        );
        setIsUploadingImage(false);
      }

      const id = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const userName = user?.name || user?.email?.split('@')[0] || 'Student';
      await saveSuggestion({
        id,
        text: newText.trim(),
        imageUrl: uploadedImageUrl || undefined,
        uid: uid || 'anonymous',
        userName,
        userBoard: user?.board || '',
        createdAt: new Date().toISOString(),
        tier: isPaidUser ? 'VIP' : 'FREE',
        isVip: isPaidUser,
        priority: isPaidUser ? 'HIGH' : 'NORMAL',
      });
      updateSuggestionLeaderboard(uid, userName, 'reported').catch(() => {});
      setNewText('');
      handleClearImage();
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setTab('feed'); }, 2000);
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
    open: suggestions.filter(s => !s.adminReply && s.status === 'open').length,
    replied: suggestions.filter(s => s.status === 'replied').length,
    resolved: suggestions.filter(s => s.status === 'resolved').length,
  };

  const filtered = suggestions.filter(s => {
    if (activeFilter === 'replied') return s.status === 'replied';
    if (activeFilter === 'open') return s.status === 'open' && !s.adminReply;
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

  // Leaderboard rank of current user
  const myRank = leaderboard.findIndex(e => e.uid === uid) + 1;

  const userTier = (user?.subscriptionLevel || 'FREE')?.toUpperCase();
  const isPaidUser = isAdmin || (
    (userTier === 'ULTRA' || userTier === 'BASIC' || user?.isPremium) &&
    (!user?.subscriptionEndDate || new Date(user.subscriptionEndDate).getTime() > Date.now())
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUserSubmissions = suggestions.filter(s => s.uid === uid && s.createdAt?.slice(0, 10) === todayStr);
  const freeDailyLimit = 3;
  const freeRemainingToday = Math.max(0, freeDailyLimit - todayUserSubmissions.length);
  const canSubmit = isPaidUser || freeRemainingToday > 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[99999] flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0f0c29 0%, #1a1440 50%, #0d1b2a 100%)',
          border: `1px solid ${brandBorder}40`,
          height: '78dvh',
          maxHeight: '78dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
          style={{ borderBottom: `1px solid ${brandBorder}26` }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${brandBorder}26`, color: brandPrimary }}>
              <Lightbulb size={18} />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-tight">Suggestions & Corrections</p>
              <p className="text-[9px] text-slate-400 leading-tight">{suggestions.length} total • Community feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* User coin balance pill */}
            {uid && (
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{ background: `${brandBorder}20`, border: `1px solid ${brandBorder}40` }}
              >
                <span style={{ fontSize: 13 }}>🪙</span>
                <span className="text-[11px] font-black text-amber-300">{userCoins}</span>
                {myRank > 0 && (
                  <span className="text-[9px] text-amber-500/70 ml-0.5">#{myRank}</span>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <X size={15} className="text-white" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          {(['feed', 'submit', 'history', 'rank'] as const).map(t => {
            const labels = { feed: '📋 Feed', submit: '✍️ Submit', history: '📜 History', rank: '🏆 Rank' };
            return (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'submit') setTimeout(() => textareaRef.current?.focus(), 150); }}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all ${tab === t ? 'text-white shadow' : 'text-slate-400'}`}
                style={tab === t ? { background: brandGrad } : { background: 'rgba(255,255,255,0.06)' }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Free vs VIP Tier Difference Status Bar */}
        <div className="px-4 pb-2 shrink-0">
          <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
            style={{
              background: isPaidUser ? 'linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.08) 100%)' : 'rgba(255,255,255,0.04)',
              border: isPaidUser ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.08)'
            }}>
            <div className="flex items-center gap-2">
              <span className="text-xs">{isPaidUser ? '👑' : '🆓'}</span>
              <div>
                <p className="text-[10px] font-black leading-tight" style={{ color: isPaidUser ? '#fbbf24' : '#cbd5e1' }}>
                  {isPaidUser ? 'VIP Fast-Track Priority Member' : 'Free Member Tier'}
                </p>
                <p className="text-[8px] text-slate-400 leading-tight">
                  {isPaidUser
                    ? 'Unlimited Reports • ⚡ 24h Review • 3x Rewards (15🪙 Reply / 50🪙 Resolve)'
                    : `Daily Quota: ${freeRemainingToday}/${freeDailyLimit} Left • Standard Review • 5🪙 Reward`}
                </p>
              </div>
            </div>
            {isPaidUser ? (
              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                VIP ACTIVE
              </span>
            ) : (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                {freeRemainingToday} Left Today
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">

          {/* ── FEED TAB ── */}
          {tab === 'feed' && (
            <div>
              {/* Filter chips */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {(['all', 'open', 'replied', 'resolved'] as const).map(f => {
                  const labels = {
                    all: `All (${counts.all})`,
                    open: `⏳ Open (${counts.open})`,
                    replied: `✅ Replied (${counts.replied})`,
                    resolved: `🎯 Resolved (${counts.resolved})`,
                  };
                  return (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${activeFilter === f ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                      style={activeFilter !== f ? { background: 'rgba(255,255,255,0.06)' } : {}}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-10">
                  <Lightbulb size={36} className="text-amber-500/30 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-black">Koi suggestion nahi</p>
                  <p className="text-slate-600 text-[10px] mt-1">Pehle suggestion submit karo!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((s) => {
                    const isUpvoted = !!(s.likedBy || {})[uid];
                    const isOwner = s.uid === uid;
                    const hasReply = !!s.adminReply;
                    const st = statusConfig[s.status] ?? statusConfig.open;

                    return (
                      <div
                        key={s.id}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: s.status === 'resolved'
                            ? 'rgba(139,92,246,0.06)'
                            : hasReply ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
                          border: s.status === 'resolved'
                            ? '1px solid rgba(139,92,246,0.25)'
                            : hasReply ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        {/* Suggestion body */}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}
                              >
                                {s.userName?.charAt(0)?.toUpperCase() || 'S'}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-white leading-tight">{s.userName}</p>
                                <div className="flex items-center gap-1.5">
                                  {s.userBoard && (
                                    <span
                                      className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                      style={{ background: s.userBoard === 'NCERT_EN' ? 'rgba(59,130,246,0.2)' : s.userBoard === 'NCERT_HI' ? 'rgba(139,92,246,0.2)' : 'rgba(249,115,22,0.2)', color: s.userBoard === 'NCERT_EN' ? '#93c5fd' : s.userBoard === 'NCERT_HI' ? '#c4b5fd' : '#fdba74' }}
                                    >
                                      {s.userBoard}
                                    </span>
                                  )}
                                  <span className="text-[8px] text-slate-600">{timeAgo(s.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* VIP or Free Badge */}
                              {(s.isVip || s.tier === 'VIP') ? (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-0.5">
                                  👑 VIP
                                </span>
                              ) : (
                                <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
                                  Free
                                </span>
                              )}
                              {/* Status badge */}
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                                {st.label}
                              </span>
                              {(isAdmin || isOwner) && (
                                <button
                                  onClick={() => handleDelete(s.id)}
                                  className="p-1 rounded-lg active:scale-90"
                                  style={{ color: '#f87171' }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {(s.mode || s.lessonTitle || s.subject) && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-2 bg-white/5 rounded-xl px-2 py-1.5">
                              {s.mode && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                  style={{ background: s.mode === 'reading' ? 'rgba(59,130,246,0.2)' : s.mode === 'writing' ? 'rgba(16,185,129,0.2)' : 'rgba(168,85,247,0.2)', color: s.mode === 'reading' ? '#93c5fd' : s.mode === 'writing' ? '#6ee7b7' : '#d8b4fe' }}>
                                  {s.mode === 'reading' ? '📖 Reading' : s.mode === 'writing' ? '✍️ Writing' : '📝 MCQ'}
                                </span>
                              )}
                              {s.lessonTitle && <span className="text-[8px] font-black text-slate-300 truncate max-w-[140px]">📚 {s.lessonTitle}</span>}
                              {s.pageNo && <span className="text-[8px] text-slate-500 shrink-0">Pg {s.pageNo}</span>}
                              {s.subject && <span className="text-[8px] text-slate-500 shrink-0 capitalize">{s.subject}</span>}
                              {s.classLevel && s.classLevel !== 'COMPETITION' && <span className="text-[8px] text-slate-500 shrink-0">Class {s.classLevel}</span>}
                            </div>
                          )}
                          <p className="text-[12px] text-slate-200 leading-relaxed mb-2.5">{s.text}</p>

                          {/* Attached Photo / Screenshot */}
                          {s.imageUrl && (
                            <div className="mb-2.5 relative overflow-hidden rounded-xl border border-amber-500/20 bg-black/40 group">
                              <img
                                src={s.imageUrl}
                                alt="Attached Screenshot"
                                className="w-full max-h-48 object-cover object-center cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                                onClick={() => setLightboxImage(s.imageUrl)}
                                loading="lazy"
                              />
                              <div
                                onClick={() => setLightboxImage(s.imageUrl)}
                                className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Maximize2 size={12} /> Full View
                              </div>
                            </div>
                          )}

                          {/* Actions row */}
                          <div className="flex items-center gap-2">
                            {/* Upvote */}
                            <button
                              onClick={() => handleUpvote(s.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-90 ${isUpvoted ? 'text-white' : 'text-slate-400'}`}
                              style={isUpvoted
                                ? { background: 'linear-gradient(135deg,#f59e0b,#d97706)' }
                                : { background: 'rgba(255,255,255,0.06)' }}
                            >
                              <ThumbsUp size={11} />
                              <span>{isUpvoted ? 'Same issue!' : 'Same issue'}</span>
                              {(s.likes || 0) > 0 && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[8px] font-black"
                                  style={{ background: isUpvoted ? 'rgba(255,255,255,0.25)' : 'rgba(245,158,11,0.2)', color: isUpvoted ? '#fff' : '#fbbf24' }}
                                >
                                  {s.likes}
                                </span>
                              )}
                            </button>

                            {/* Admin controls */}
                            {isAdmin && (
                              <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                                {s.chapterKey && s.pointsData?.length > 0 && (
                                  <button
                                    onClick={() => {
                                      if (editingContentId === s.id) {
                                        setEditingContentId(null); setEditCorrections({}); setEditResult(null);
                                      } else {
                                        setEditingContentId(s.id); setReplyingId(null);
                                        const init: Record<number, string> = {};
                                        s.pointsData.forEach((p: any) => { init[p.index] = p.originalText; });
                                        setEditCorrections(init); setEditResult(null);
                                      }
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black transition-all active:scale-90 ${editingContentId === s.id ? 'text-white' : 'text-emerald-300'}`}
                                    style={editingContentId === s.id ? { background: 'rgba(16,185,129,0.5)' } : { background: 'rgba(16,185,129,0.12)' }}
                                  >
                                    <FilePen size={11} />
                                    Edit Content
                                  </button>
                                )}
                                <button
                                  onClick={() => { setReplyingId(replyingId === s.id ? null : s.id); setEditingContentId(null); setReplyText(s.adminReply || ''); setReplyTag(s.adminTag || ''); setReplyStatus('replied'); }}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black transition-all active:scale-90 ${replyingId === s.id ? 'bg-amber-500 text-white' : 'text-amber-400'}`}
                                  style={replyingId !== s.id ? { background: 'rgba(245,158,11,0.12)' } : {}}
                                >
                                  <MessageSquare size={11} />
                                  {hasReply ? 'Edit' : 'Reply'}
                                </button>
                                {s.status !== 'resolved' && (
                                  <button
                                    onClick={() => handleResolve(s.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black active:scale-90"
                                    style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}
                                  >
                                    <ShieldCheck size={11} />
                                    Resolve
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Tag pill */}
                        {s.adminTag && !replyingId && (
                          <div className="px-3 pb-2">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                              <Tag size={9} className="text-violet-300" />
                              <span className="text-[9px] font-black text-violet-300">{s.adminTag}</span>
                            </div>
                          </div>
                        )}

                        {/* Admin Reply display */}
                        {hasReply && !replyingId && (
                          <div className="px-3 pb-3">
                            <div className="rounded-xl p-2.5"
                              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider">⚡ Admin Reply</span>
                                {s.adminReplyAt && <span className="text-[8px] text-slate-600">{timeAgo(s.adminReplyAt)}</span>}
                              </div>
                              <p className="text-[11px] text-amber-100 leading-relaxed">{s.adminReply}</p>
                            </div>
                          </div>
                        )}

                        {/* Admin Reply Form */}
                        {isAdmin && replyingId === s.id && (
                          <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider mt-2 mb-1.5">⚡ Admin Reply:</p>
                            <textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Is suggestion ka jawab do..."
                              className="w-full rounded-xl p-2.5 text-[11px] text-white outline-none resize-none min-h-[60px]"
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,158,11,0.3)', caretColor: '#fbbf24' }}
                              rows={3}
                            />
                            <div className="mt-2 mb-2">
                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Tag size={8} /> Admin Tag (optional):
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {ADMIN_TAGS.map(tag => (
                                  <button key={tag} onClick={() => setReplyTag(replyTag === tag ? '' : tag)}
                                    className={`px-2 py-1 rounded-full text-[8px] font-black transition-all active:scale-95 ${replyTag === tag ? 'text-white' : 'text-violet-300'}`}
                                    style={replyTag === tag
                                      ? { background: 'rgba(139,92,246,0.5)', border: '1px solid rgba(139,92,246,0.7)' }
                                      : { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1.5 mb-2">
                              {(['replied', 'resolved'] as const).map(st => (
                                <button key={st} onClick={() => setReplyStatus(st)}
                                  className={`flex-1 py-1.5 rounded-xl text-[9px] font-black transition-all active:scale-95 ${replyStatus === st ? 'text-white' : 'text-slate-400'}`}
                                  style={replyStatus === st
                                    ? { background: st === 'resolved' ? 'rgba(139,92,246,0.5)' : 'rgba(16,185,129,0.4)' }
                                    : { background: 'rgba(255,255,255,0.06)' }}>
                                  {st === 'replied' ? '✅ Mark as Replied (+5🪙)' : '🎯 Mark as Resolved (+20🪙)'}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-1.5">
                              <button onClick={() => { setReplyingId(null); setReplyText(''); setReplyTag(''); setReplyStatus('replied'); }}
                                className="flex-1 py-2 rounded-xl text-[10px] font-black text-slate-400 active:scale-95"
                                style={{ background: 'rgba(255,255,255,0.06)' }}>
                                Cancel
                              </button>
                              <button onClick={() => handleAdminReply(s.id)} disabled={!replyText.trim() || savingReply}
                                className="flex-1 py-2 rounded-xl text-[10px] font-black text-white flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                {savingReply ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                                {savingReply ? 'Saving…' : 'Save Reply'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Edit Content Panel */}
                        {isAdmin && editingContentId === s.id && s.chapterKey && s.pointsData?.length > 0 && (
                          <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>
                            <div className="flex items-center gap-1.5 mt-2.5 mb-3">
                              <FilePen size={12} className="text-emerald-400 shrink-0" />
                              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Edit Main Content</p>
                              <span className="text-[8px] text-slate-500 ml-auto">Chapter: {s.chapterKey}</span>
                            </div>
                            {editResult && (
                              <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
                                style={editResult.success
                                  ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }
                                  : { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                {editResult.success
                                  ? <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                                  : <AlertCircle size={13} className="text-red-400 shrink-0" />}
                                <p className="text-[10px] font-black" style={{ color: editResult.success ? '#6ee7b7' : '#fca5a5' }}>
                                  {editResult.success
                                    ? `✅ ${editResult.count} line${editResult.count !== 1 ? 's' : ''} updated in content!`
                                    : '❌ Koi line match nahi hui — text exactly match karo.'}
                                </p>
                              </div>
                            )}
                            <div className="space-y-3">
                              {s.pointsData.map((pt: any, pi: number) => (
                                <div key={pi} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Point {pt.index + 1} — Original:</p>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mb-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', wordBreak: 'break-word' }}>
                                    {pt.originalText}
                                  </p>
                                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-1">Corrected Text:</p>
                                  <textarea
                                    value={editCorrections[pt.index] ?? pt.originalText}
                                    onChange={e => setEditCorrections(prev => ({ ...prev, [pt.index]: e.target.value }))}
                                    className="w-full rounded-lg p-2 text-[11px] text-white outline-none resize-none"
                                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', caretColor: '#6ee7b7', minHeight: 52 }}
                                    rows={2}
                                    placeholder="Sahi text yahan likho..."
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => { setEditingContentId(null); setEditCorrections({}); setEditResult(null); }}
                                className="flex-1 py-2 rounded-xl text-[10px] font-black text-slate-400 active:scale-95"
                                style={{ background: 'rgba(255,255,255,0.06)' }}>
                                Cancel
                              </button>
                              <button disabled={applyingEdit}
                                onClick={async () => {
                                  setApplyingEdit(true); setEditResult(null);
                                  try {
                                    const corrections = s.pointsData.map((pt: any) => ({
                                      originalText: pt.originalText,
                                      correctedText: (editCorrections[pt.index] ?? pt.originalText).trim(),
                                    })).filter((c: any) => c.correctedText && c.correctedText !== c.originalText);
                                    if (corrections.length === 0) { setEditResult({ success: false, count: 0 }); setApplyingEdit(false); return; }
                                    const replaced = await applyNoteCorrection(s.chapterKey, corrections);
                                    setEditResult({ success: replaced > 0, count: replaced });
                                    if (replaced > 0) await resolvesuggestion(s.id);
                                  } catch (err) {
                                    console.error('[EditContent]', err);
                                    setEditResult({ success: false, count: 0 });
                                  } finally { setApplyingEdit(false); }
                                }}
                                className="flex-1 py-2 rounded-xl text-[10px] font-black text-white flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                {applyingEdit ? <RefreshCw size={11} className="animate-spin" /> : <FilePen size={11} />}
                                {applyingEdit ? 'Applying…' : 'Apply to Content'}
                              </button>
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

          {/* ── SUBMIT TAB ── */}
          {tab === 'submit' && (
            <div className="space-y-4">
              {submitted ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3" />
                  <p className="text-white font-black text-lg">Submitted! 🎉</p>
                  <p className="text-slate-400 text-sm mt-1">Tera suggestion save ho gaya</p>
                </div>
              ) : (
                <>
                  {/* Coin reward info */}
                  <div className="rounded-2xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider mb-2">🪙 Coin Rewards</p>
                    <div className="space-y-1">
                      {[
                        { label: 'Admin ne galti sudhara (Resolved)', coins: 20, icon: '🎯' },
                        { label: 'Admin ne reply diya', coins: 5, icon: '✅' },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400">{r.icon} {r.label}</span>
                          <span className="text-[10px] font-black text-amber-300">+{r.coins} 🪙</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl p-3.5"
                    style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-amber-400 shrink-0" />
                      <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider">Suggestion Guidelines</p>
                    </div>
                    <ul className="space-y-1">
                      {['Notes mein galat information dikhi? Batao.', 'MCQ answer galat laga? Flag karo.', 'Koi topic missing hai? Suggest karo.', 'App mein koi bug ya improvement?'].map((g, gi) => (
                        <li key={gi} className="flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0 mt-0.5 text-[10px]">•</span>
                          <span className="text-[10px] text-slate-400 leading-tight">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                      Teri Suggestion / Correction:
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={newText}
                      onChange={e => setNewText(e.target.value)}
                      placeholder="Yahan likho — kya suggestion hai ya kya galat laga..."
                      className="w-full rounded-2xl p-3.5 text-sm text-white outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#fbbf24', minHeight: 120 }}
                      maxLength={500}
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-[9px] text-slate-600">Board: {user?.board || 'N/A'} • Class: {user?.class || 'N/A'}</p>
                      <p className="text-[9px] text-slate-600">{newText.length}/500</p>
                    </div>

                    {/* Screenshot / Photo Attachment */}
                    <div className="mt-3">
                      <input
                        id="nsta-suggestion-photo-input"
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="sr-only"
                        tabIndex={-1}
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = '';
                        }}
                      />

                      {imagePreviewUrl ? (
                        <div className="relative inline-block mt-1">
                          <img
                            src={imagePreviewUrl}
                            alt="Screenshot preview"
                            className="w-36 h-24 object-cover rounded-xl border border-amber-400/50 shadow-md"
                          />
                          <button
                            type="button"
                            onClick={handleClearImage}
                            className="absolute -top-2 -right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer active:scale-95 transition-transform"
                            title="Photo hataayein"
                          >
                            <X size={12} />
                          </button>
                          {isUploadingImage && (
                            <div className="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center text-white text-[10px] font-bold">
                              <RefreshCw size={14} className="animate-spin text-amber-400 mb-1" />
                              <span>Uploading...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label
                          htmlFor="nsta-suggestion-photo-input"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 active:scale-95 transition-all cursor-pointer select-none"
                          style={{ background: 'rgba(245,158,11,0.12)', border: '1px dashed rgba(245,158,11,0.4)' }}
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                        >
                          <Camera size={14} />
                          <span>Screenshot / Photo Attach Karein (Optional)</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {!canSubmit ? (
                    <div className="w-full p-3.5 rounded-2xl text-center bg-amber-500/10 border border-amber-500/30">
                      <p className="text-xs font-bold text-amber-300 mb-1">⚠️ Aaj ka Free Quota (3/3) Poora Ho Chuka Hai</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Aap kal naye suggestions submit kar sakte hain. VIP members ko unlimited reports aur 24h fast-track review milta hai.
                      </p>
                    </div>
                  ) : (
                    <button onClick={handleSubmit} disabled={(!newText.trim() && !selectedImageFile) || submitting}
                      className="w-full py-3.5 rounded-2xl text-[13px] font-black text-white flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-40 cursor-pointer"
                      style={{ background: brandGrad, boxShadow: `0 4px 20px ${brandPrimary}55` }}>
                      {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      {submitting ? (isUploadingImage ? 'Photo upload ho rahi hai…' : 'Submit ho raha hai…') : (isPaidUser ? 'Submit VIP Priority Suggestion 👑' : `Submit Suggestion (${freeRemainingToday} left today)`)}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div>
              {/* User's own coin history */}
              {uid && userCoinHistory.length > 0 && (
                <div className="mb-5 rounded-2xl p-3" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider mb-2">🪙 Tera Coin History</p>
                  <div className="space-y-1.5">
                    {userCoinHistory.slice(0, 10).map((h, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300">{reasonLabel(h.reason)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black text-amber-300">+{h.amount} 🪙</span>
                          <span className="text-[8px] text-slate-600 ml-1">{timeAgo(h.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[9px] font-black uppercase tracking-wider mb-4" style={{ color: 'rgba(245,158,11,0.55)' }}>
                Pichle 7 din ki changes • Day-by-Day
              </p>

              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().slice(0, 10);
                const dayItems = suggestions.filter(s => {
                  const replyDate = s.adminReplyAt?.slice(0, 10);
                  const createDate = s.createdAt?.slice(0, 10);
                  return replyDate === dateStr || createDate === dateStr;
                });
                const dayLabel = i === 0 ? 'Aaj' : i === 1 ? 'Kal' : `${i} din pehle`;
                const dayFull = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });

                return (
                  <div key={dateStr} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                        {dayLabel}
                      </span>
                      <span className="text-[9px] text-slate-600">{dayFull}</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: dayItems.length > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: dayItems.length > 0 ? '#fbbf24' : '#475569' }}>
                        {dayItems.length} changes
                      </span>
                    </div>
                    {dayItems.length === 0 ? (
                      <div className="text-center py-2.5 rounded-xl text-slate-700 text-[10px]"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        Koi activity nahi
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map(s => {
                          const wasRepliedToday = s.adminReplyAt?.slice(0, 10) === dateStr;
                          const wasCreatedToday = s.createdAt?.slice(0, 10) === dateStr;
                          let actionLabel: string, actionColor: string, actionBg: string;
                          if (s.status === 'resolved' && wasRepliedToday) { actionLabel = '🎯 Resolved'; actionColor = '#c4b5fd'; actionBg = 'rgba(139,92,246,0.18)'; }
                          else if (wasRepliedToday && s.adminReply) { actionLabel = '✅ Admin ne Reply diya'; actionColor = '#6ee7b7'; actionBg = 'rgba(16,185,129,0.15)'; }
                          else if (wasCreatedToday) { actionLabel = '📝 New Suggestion'; actionColor = '#93c5fd'; actionBg = 'rgba(96,165,250,0.12)'; }
                          else { actionLabel = '🔄 Updated'; actionColor = '#fbbf24'; actionBg = 'rgba(245,158,11,0.12)'; }
                          return (
                            <div key={s.id} className="rounded-xl p-2.5"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                              <div className="flex items-start gap-2">
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full shrink-0 mt-0.5 whitespace-nowrap"
                                  style={{ background: actionBg, color: actionColor }}>
                                  {actionLabel}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{s.text}</p>
                                  {wasRepliedToday && s.adminReply && (
                                    <p className="text-[10px] mt-1 line-clamp-1" style={{ color: 'rgba(245,158,11,0.7)' }}>↳ {s.adminReply}</p>
                                  )}
                                  <p className="text-[8px] text-slate-600 mt-0.5">{s.userName}{s.userBoard ? ` • ${s.userBoard}` : ''}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RANK TAB — Leaderboard ── */}
          {tab === 'rank' && (
            <div>
              {/* Hero banner */}
              <div className="rounded-2xl p-4 mb-4 text-center"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(139,92,246,0.15) 100%)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🏆</div>
                <p className="text-white font-black text-sm">Galti Pakadne Ka Leaderboard</p>
                <p className="text-[10px] text-slate-400 mt-1">Jo jitni galtiyan pakdega, utne zyada coins aur rank milega</p>
                <div className="flex justify-center gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-lg font-black text-amber-300">🎯 20</p>
                    <p className="text-[8px] text-slate-500">Coins / Galti Fixed</p>
                  </div>
                  <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-300">✅ 5</p>
                    <p className="text-[8px] text-slate-500">Coins / Admin Reply</p>
                  </div>
                  <div className="w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="text-center">
                    <p className="text-lg font-black text-amber-300">🪙 {userCoins}</p>
                    <p className="text-[8px] text-slate-500">Tere Coins</p>
                  </div>
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="text-center py-10">
                  <Trophy size={36} className="text-amber-500/30 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-black">Abhi koi rank nahi</p>
                  <p className="text-slate-600 text-[10px] mt-1">Galtiyan pakdo, coins kamao!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.uid === uid;
                    const medal = i < 3 ? MEDAL_COLORS[i] : null;
                    return (
                      <div key={entry.uid}
                        className="rounded-2xl p-3 flex items-center gap-3"
                        style={{
                          background: isMe
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(139,92,246,0.12))'
                            : 'rgba(255,255,255,0.04)',
                          border: isMe
                            ? '1px solid rgba(245,158,11,0.4)'
                            : medal ? `1px solid ${medal}30` : '1px solid rgba(255,255,255,0.07)',
                        }}>
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
                          style={{
                            background: medal ? `${medal}25` : 'rgba(255,255,255,0.08)',
                            color: medal || '#94a3b8',
                          }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </div>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                          style={{ background: isMe ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.25)', color: isMe ? '#fbbf24' : '#a5b4fc' }}>
                          {entry.userName?.charAt(0)?.toUpperCase() || 'S'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-black text-white leading-tight truncate">
                              {entry.userName}
                              {isMe && <span className="text-amber-400 text-[9px] ml-1">(Tum)</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[8px] text-slate-500">📝 {entry.totalReported ?? 0} pakdi</span>
                            <span className="text-[8px] text-slate-500">🎯 {entry.totalResolved ?? 0} fix</span>
                            <span className="text-[8px] text-slate-500">✅ {entry.totalReplied ?? 0} replied</span>
                          </div>
                        </div>

                        {/* Coins */}
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[13px] font-black text-amber-300">{entry.totalCoins ?? 0}</span>
                          <span className="text-[8px] text-amber-500/60">🪙 coins</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* My position if not in top 20 */}
              {uid && myRank === 0 && (
                <div className="mt-4 rounded-2xl p-3"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px dashed rgba(245,158,11,0.3)' }}>
                  <p className="text-[10px] text-slate-400 text-center">
                    Galtiyan pakdo aur leaderboard mein aao! 🚀
                  </p>
                </div>
              )}
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
}
