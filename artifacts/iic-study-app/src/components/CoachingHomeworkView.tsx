// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../firebase';
import { getCoaching } from '../coaching-firebase';
import { ChevronRight, X, BookOpen, FileText, HelpCircle, ChevronDown, ChevronUp, ArrowLeft, Calendar, Loader2, BookOpenCheck, Send, Plus } from 'lucide-react';
import { hapticMedium, hapticStrong } from '../utils/haptic';
import { ChunkedNotesReader } from './ChunkedNotesReader';
import { tryEarnScore, getActiveBoost } from '../utils/scoreSystem';

interface CoachingNote {
  id: string;
  title: string;
  content?: string;
  pageNo?: string;
}
interface CoachingMcq {
  id: string;
  question: string;
  options: string[];
  /** Single correct answer (legacy) */
  correctAnswer?: number;
  /** Multiple correct answers (new) */
  correctAnswers?: number[];
  explanation?: string;
}
interface CoachingPdf {
  id: string;
  title: string;
  url: string;
}
interface CategoryData {
  notes?: CoachingNote[];
  mcqs?: CoachingMcq[];
  pdfs?: CoachingPdf[];
}
interface CoachingEntry {
  id: string;
  date: string;
  speedyScience?: CategoryData;
  speedySocialScience?: CategoryData;
  sarSangrah?: CategoryData;
  lucent?: CategoryData;
  mcq?: CategoryData;
}
interface Coaching {
  id: string;
  name: string;
  emoji?: string;
  createdAt?: string;
  entries?: Record<string, CoachingEntry>;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  speedyScience:       { label: 'Speedy Science',       icon: '🧪', color: '#10b981' },
  speedySocialScience: { label: 'Speedy Social Science', icon: '🌍', color: '#f59e0b' },
  sarSangrah:          { label: 'Sar Sangrah',           icon: '📕', color: '#ef4444' },
  lucent:              { label: 'Lucent',                icon: '🌟', color: '#8b5cf6' },
  mcq:                 { label: 'MCQ Practice',          icon: '🧠', color: '#3b82f6' },
  current_affairs:     { label: 'Current Affairs',       icon: '📰', color: '#0ea5e9' },
};

type CatKey = string;

/** Fallback meta for custom book categories not in CATEGORY_META */
function resolveCatMeta(key: string, customBooks?: Record<string, { label: string; icon: string; color: string }>) {
  return CATEGORY_META[key] || (customBooks?.[key]
    ? { label: customBooks[key].label, icon: customBooks[key].icon, color: customBooks[key].color }
    : { label: key, icon: '📖', color: '#64748b' });
}

/** Known built-in category keys, in display order — custom book keys are appended dynamically */
const BUILTIN_CAT_ORDER: CatKey[] = ['speedyScience', 'speedySocialScience', 'sarSangrah', 'lucent', 'current_affairs', 'mcq'];

/** All category keys present on an entry, built-ins first (in order) then any custom/unknown keys */
function entryCatKeys(entry: Record<string, any>): CatKey[] {
  const keys = Object.keys(entry).filter(k => k !== 'id' && k !== 'date');
  const known = BUILTIN_CAT_ORDER.filter(k => keys.includes(k));
  const extra = keys.filter(k => !BUILTIN_CAT_ORDER.includes(k));
  return [...known, ...extra];
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

/** Get the set of correct indices for an MCQ — supports both old (number) and new (number[]) formats */
function getCorrectSet(mcq: CoachingMcq): Set<number> {
  if (mcq.correctAnswers && mcq.correctAnswers.length > 0) {
    return new Set(mcq.correctAnswers);
  }
  if (mcq.correctAnswer !== undefined && mcq.correctAnswer !== null) {
    return new Set([mcq.correctAnswer]);
  }
  return new Set([0]);
}

// ──────────────────────────────────────────────────────────────────────────────
// NoteCard — with ChunkedNotesReader support
// directOpen=true → tap karo toh seedha reader khule (Speedy/Sar Sangrah)
// directOpen=false → expand → preview → button (Lucent)
// ──────────────────────────────────────────────────────────────────────────────
// localStorage key for starred topics per note
const starKey = (noteId: string) => `chw_stars_${noteId}`;
const loadStars = (noteId: string): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(starKey(noteId)) || '[]')); }
  catch { return new Set(); }
};
const saveStars = (noteId: string, stars: Set<string>) => {
  try { localStorage.setItem(starKey(noteId), JSON.stringify([...stars])); } catch {}
};

function NoteCard({ note, accent, directOpen = false, user, onReaderOpenChange }: { note: CoachingNote; accent: string; directOpen?: boolean; user?: any; onReaderOpenChange?: (open: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);

  useEffect(() => { onReaderOpenChange?.(readerOpen); }, [readerOpen]);
  const [focusMode, setFocusMode] = useState(false);
  const [stars, setStars] = useState<Set<string>>(() => loadStars(note.id));

  // Award XP every 30 s while the notes reader is open.
  // Capture entitlements at open time via a ref so the interval always uses fresh values.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => {
    if (!readerOpen || !user?.id) return;
    const iv = setInterval(() => {
      const u = userRef.current;
      if (!u?.id) return;
      tryEarnScore(u.id, 2, u.subscriptionLevel, u.isPremium, getActiveBoost(u), 'COACHING_HW_NOTES');
    }, 30000);
    return () => clearInterval(iv);
  }, [readerOpen, user?.id]);

  const hasContent = !!note.content;

  const handleTap = () => {
    hapticMedium();
    if (directOpen && hasContent) { setReaderOpen(true); return; }
    setExpanded(e => !e);
  };

  const isStarred = (text: string) => stars.has(text);
  const onStarToggle = (text: string) => {
    setStars(prev => {
      const next = new Set(prev);
      next.has(text) ? next.delete(text) : next.add(text);
      saveStars(note.id, next);
      return next;
    });
  };

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}30` }}>
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:scale-[0.99] transition-all"
          style={{ background: `${accent}08` }}
          onClick={handleTap}
        >
          <BookOpen size={13} style={{ color: accent }} className="shrink-0" />
          <span className="flex-1 text-[12px] font-bold text-slate-800 leading-snug">
            {note.title || (note.pageNo ? `Page ${note.pageNo}` : 'Note')}
          </span>
          {note.pageNo && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: `${accent}20`, color: accent }}>
              P.{note.pageNo}
            </span>
          )}
          {stars.size > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706' }}>
              ⭐{stars.size}
            </span>
          )}
          {!directOpen && hasContent && (expanded ? <ChevronUp size={13} style={{ color: accent }} /> : <ChevronDown size={13} style={{ color: accent }} />)}
          {directOpen && hasContent && <ChevronRight size={13} style={{ color: accent }} />}
        </button>

        {!directOpen && expanded && hasContent && (
          <div className="px-3 py-2 bg-white border-t" style={{ borderColor: `${accent}20` }}>
            <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
              {note.content}
            </p>
            <button
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-all"
              style={{ background: `${accent}15`, color: accent }}
              onClick={() => { hapticMedium(); setReaderOpen(true); }}
            >
              <BookOpenCheck size={12} />
              Chunk Reader mein Padhein
            </button>
          </div>
        )}
      </div>

      {/* Full-screen ChunkedNotesReader overlay */}
      {readerOpen && hasContent && (
        <div className="fixed inset-0 z-[500] bg-white overflow-y-auto">
          <ChunkedNotesReader
            content={note.content!}
            topBarLabel={note.title || (note.pageNo ? `Page ${note.pageNo}` : 'Note')}
            onBack={() => { setReaderOpen(false); setFocusMode(false); }}
            preferChunkMode={true}
            noteKey={`chw_${note.id}`}
            isStarred={isStarred}
            onStarToggle={onStarToggle}
            hideTopBar={focusMode}
          />
          {/* Focus Mode FAB — inside the notes reader */}
          <button
            onPointerDown={(e) => { e.stopPropagation(); hapticMedium(); setFocusMode(v => !v); }}
            className="active:scale-95 transition-transform"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 16,
              width: 48,
              height: 48,
              borderRadius: '50%',
              zIndex: 600,
              background: focusMode ? accent : 'rgba(15,23,42,0.88)',
              border: `2px solid ${focusMode ? accent : 'rgba(255,255,255,0.4)'}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
            title={focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
          >
            {focusMode
              ? <span style={{ fontSize: 18, lineHeight: 1 }}>↩</span>
              : <span style={{ fontSize: 16, lineHeight: 1 }}>🎯</span>
            }
          </button>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// McqCard — supports multiple correct answers
// ──────────────────────────────────────────────────────────────────────────────
type McqCommunityDraft = { question: string; options: [string,string,string,string]; correctAnswer: number; explanation: string };

function McqCard({ mcq, accent, onSendToMcqCommunity, user }: { mcq: CoachingMcq; accent: string; onSendToMcqCommunity?: (draft: McqCommunityDraft) => void; user?: any }) {
  const correctSet = getCorrectSet(mcq);
  const isMultiple = correctSet.size > 1;

  // For single-answer mode: track one selected index
  const [selected, setSelected] = useState<number | null>(null);
  // For multiple-answer mode: track a set of selected indices
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const awardMcqXp = (isCorrect: boolean) => {
    if (!user?.id) return;
    if (isCorrect) {
      tryEarnScore(user.id, 2, user.subscriptionLevel, user.isPremium, getActiveBoost(user), 'COACHING_HW_MCQ_CORRECT');
    }
  };

  const handleSingleSelect = (i: number) => {
    if (selected !== null) return;
    hapticMedium();
    setSelected(i);
    awardMcqXp(correctSet.has(i));
  };

  const handleMultiToggle = (i: number) => {
    if (submitted) return;
    hapticMedium();
    setMultiSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleSubmit = () => {
    if (multiSelected.size === 0) return;
    hapticMedium();
    setSubmitted(true);
    // Award XP only when the selection is fully correct (all correct picked, none wrong)
    if (user?.id) {
      const allCorrectPicked = [...correctSet].every(i => multiSelected.has(i));
      const noWrongPicked    = [...multiSelected].every(i => correctSet.has(i));
      awardMcqXp(allCorrectPicked && noWrongPicked);
    }
  };

  const isAnswered = isMultiple ? submitted : selected !== null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}30` }}>
      <div className="px-3 py-2.5" style={{ background: `${accent}08` }}>
        <div className="flex items-start gap-2 mb-2">
          <HelpCircle size={13} style={{ color: accent }} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[12px] font-bold text-slate-800 leading-snug">{mcq.question}</p>
            {isMultiple && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                style={{ background: `${accent}20`, color: accent }}>
                ✦ Multiple Correct
              </span>
            )}
          </div>
          {onSendToMcqCommunity && (
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                hapticMedium();
                const opts = mcq.options.length === 4
                  ? mcq.options as [string,string,string,string]
                  : ([...mcq.options, '', '', '', ''].slice(0, 4) as [string,string,string,string]);
                const firstCorrect = correctSet.size > 0 ? [...correctSet][0] : 0;
                onSendToMcqCommunity({ question: mcq.question, options: opts, correctAnswer: firstCorrect, explanation: mcq.explanation || '' });
              }}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{ background: `${accent}18`, color: accent }}
              title="MCQ Community mein bhejo"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {mcq.options.map((opt, i) => {
            const isCorrect = correctSet.has(i);

            if (isMultiple) {
              const isTicked = multiSelected.has(i);
              let bg = 'bg-white border-slate-200';
              if (submitted) {
                if (isCorrect) bg = 'bg-emerald-50 border-emerald-400';
                else if (isTicked && !isCorrect) bg = 'bg-red-50 border-red-400';
              } else if (isTicked) {
                bg = 'border-indigo-400 bg-indigo-50';
              }
              return (
                <button
                  key={i}
                  onClick={() => handleMultiToggle(i)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-2 ${bg}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                      submitted
                        ? isCorrect ? 'border-emerald-500 bg-emerald-500' : isTicked ? 'border-red-400 bg-red-100' : 'border-slate-300'
                        : isTicked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                    }`}
                  >
                    {(submitted ? isCorrect : isTicked) && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span><span className="font-black">{String.fromCharCode(65 + i)}.</span> {opt}</span>
                </button>
              );
            } else {
              // Single answer
              const isSelected = selected === i;
              let bg = 'bg-white border-slate-200';
              if (selected !== null) {
                if (isCorrect) bg = 'bg-emerald-50 border-emerald-400';
                else if (isSelected) bg = 'bg-red-50 border-red-400';
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSingleSelect(i)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${bg}`}
                >
                  <span className="font-black mr-1">{String.fromCharCode(65 + i)}.</span> {opt}
                </button>
              );
            }
          })}
        </div>

        {/* Submit button for multiple-answer MCQs */}
        {isMultiple && !submitted && (
          <button
            onClick={handleSubmit}
            disabled={multiSelected.size === 0}
            className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-black transition-all disabled:opacity-40"
            style={{ background: accent, color: '#fff' }}
          >
            Check Answer
          </button>
        )}

        {/* Explanation */}
        {isAnswered && mcq.explanation && (
          <p className="mt-2 text-[10px] text-slate-500 italic leading-relaxed">{mcq.explanation}</p>
        )}

        {/* Score feedback for multi-answer */}
        {isMultiple && submitted && (
          <p className="mt-1.5 text-[10px] font-bold" style={{ color: accent }}>
            {[...multiSelected].every(i => correctSet.has(i)) && multiSelected.size === correctSet.size
              ? '✅ Bilkul Sahi!'
              : `✦ Sahi jawab: ${[...correctSet].map(i => String.fromCharCode(65 + i)).join(', ')}`
            }
          </p>
        )}

      </div>
    </div>
  );
}

function McqFullPage({ mcqs, accent, label, onClose, onSendToMcqCommunity, user }: { mcqs: CoachingMcq[]; accent: string; label: string; onClose: () => void; onSendToMcqCommunity?: (draft: McqCommunityDraft) => void; user?: any }) {
  return createPortal(
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 9999, background: '#f8fafc' }}>
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 shadow-sm" style={{ background: accent }}>
        <button onPointerDown={() => { hapticMedium(); onClose(); }} className="p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <span className="text-white font-black text-base flex-1">🧠 {label}</span>
        <span className="text-white/70 text-[11px] font-bold">{mcqs.length} MCQ</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 100 }}>
        {mcqs.map(m => <McqCard key={m.id} mcq={m} accent={accent} onSendToMcqCommunity={onSendToMcqCommunity} user={user} />)}
      </div>
    </div>,
    document.body
  );
}

function CategorySection({ catKey, data, accent, onSendToMcqCommunity, user, onReaderOpenChange, customBooks }: { catKey: CatKey; data: CategoryData; accent: string; onSendToMcqCommunity?: (draft: McqCommunityDraft) => void; user?: any; onReaderOpenChange?: (open: boolean) => void; customBooks?: Record<string, { label: string; icon: string; color: string }> }) {
  const meta = resolveCatMeta(catKey, customBooks);
  const [open, setOpen] = useState(true);
  const [mcqPageOpen, setMcqPageOpen] = useState(false);
  const notes = data.notes || [];
  const mcqs = data.mcqs || [];
  const pdfs = data.pdfs || [];
  const total = notes.length + mcqs.length + pdfs.length;
  if (total === 0) return null;

  // MCQ category — tap opens full-page overlay
  if (catKey === 'mcq' && mcqs.length > 0) {
    return (
      <div className="mb-3">
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl active:scale-[0.99] transition-all"
          style={{ background: `${meta.color}10`, border: `1.5px solid ${meta.color}30` }}
          onClick={() => { hapticMedium(); setMcqPageOpen(true); }}
        >
          <span className="text-base">{meta.icon}</span>
          <span className="text-[11px] font-black uppercase tracking-wider flex-1 text-left" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${meta.color}20`, color: meta.color }}>{mcqs.length}</span>
          <ChevronRight size={14} style={{ color: meta.color }} />
        </button>
        {mcqPageOpen && (
          <McqFullPage mcqs={mcqs} accent={meta.color} label={meta.label} onClose={() => setMcqPageOpen(false)} onSendToMcqCommunity={onSendToMcqCommunity} user={user} />
        )}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        className="w-full flex items-center gap-2 mb-2"
        onClick={() => { hapticMedium(); setOpen(o => !o); }}
      >
        <span className="text-base">{meta.icon}</span>
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ background: `${meta.color}18`, color: meta.color }}>{total}</span>
        <span className="flex-1" />
        {open ? <ChevronUp size={12} style={{ color: meta.color }} /> : <ChevronDown size={12} style={{ color: meta.color }} />}
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {notes.map(n => <NoteCard key={n.id} note={n} accent={meta.color} directOpen={catKey !== 'lucent'} user={user} onReaderOpenChange={onReaderOpenChange} />)}
          {mcqs.map(m => <McqCard key={m.id} mcq={m} accent={meta.color} onSendToMcqCommunity={onSendToMcqCommunity} user={user} />)}
          {pdfs.map(p => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border active:scale-[0.99] transition-all"
              style={{ borderColor: `${meta.color}30`, background: `${meta.color}08` }}
              onClick={() => hapticMedium()}
            >
              <FileText size={13} style={{ color: meta.color }} />
              <span className="text-[12px] font-bold text-slate-800 flex-1">{p.title || 'PDF'}</span>
              <span className="text-[10px] font-bold" style={{ color: meta.color }}>Open →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Detail view for a single coaching
function CoachingDetailView({
  coaching, onClose, tierTheme, isDarkMode, settings, onSendToMcqCommunity, user, onReaderOpenChange
}: {
  coaching: Coaching;
  onClose: () => void;
  tierTheme: any;
  isDarkMode?: boolean;
  settings?: any;
  onSendToMcqCommunity?: (draft: McqCommunityDraft) => void;
  user?: any;
  onReaderOpenChange?: (open: boolean) => void;
}) {
  const accent = tierTheme?.primary || '#6366f1';
  const entries = Object.values(coaching.entries || {})
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const [expandedDate, setExpandedDate] = useState<string | null>(entries[0]?.id || null);
  const [customBooks, setCustomBooks] = useState<Record<string, { label: string; icon: string; color: string }>>({});

  // Custom book labels/colors are admin-defined per coaching — fetch so their categories render correctly
  useEffect(() => {
    const r = ref(rtdb, `coaching_homework/${coaching.id}/customBooks`);
    const unsub = onValue(r, snap => setCustomBooks(snap.exists() ? snap.val() : {}));
    return () => off(r, 'value', unsub);
  }, [coaching.id]);

  // Bottom nav is hidden via React state in StudentDashboard (onDetailOpen/onDetailClose props)

  const hasContent = (entry: CoachingEntry) => {
    return entryCatKeys(entry).some(c => {
      const d = (entry as any)[c];
      if (!d) return false;
      return (d.notes?.length || 0) + (d.mcqs?.length || 0) + (d.pdfs?.length || 0) > 0;
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 350, background: isDarkMode ? '#0f172a' : '#f8fafc' }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 shadow-sm" style={{ background: accent }}>
        <button onPointerDown={() => { hapticMedium(); onClose(); }} className="p-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{coaching.emoji || '🏫'}</span>
          <div>
            <p className="text-white font-black text-base leading-tight truncate">{coaching.name}</p>
            <p className="text-white/70 text-[10px] font-medium">{entries.length} entries</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ paddingBottom: '100px' }}>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-slate-500 font-bold text-sm">Abhi koi homework nahi hai</p>
          </div>
        ) : entries.map(entry => {
          if (!hasContent(entry)) return null;
          const isOpen = expandedDate === entry.id;
          const cats: CatKey[] = entryCatKeys(entry);
          return (
            <div key={entry.id} className="rounded-2xl overflow-hidden border" style={{ borderColor: `${accent}30`, background: isDarkMode ? '#1e293b' : '#fff' }}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3"
                onClick={() => { hapticMedium(); setExpandedDate(isOpen ? null : entry.id); }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
                  <Calendar size={16} style={{ color: accent }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-black text-[13px] text-slate-800">{formatDate(entry.date)}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {cats.filter(c => (entry as any)[c] && (((entry as any)[c]?.notes?.length || 0) + ((entry as any)[c]?.mcqs?.length || 0) + ((entry as any)[c]?.pdfs?.length || 0)) > 0)
                      .map(c => resolveCatMeta(c, customBooks).label).join(' · ')}
                  </p>
                </div>
                {isOpen
                  ? <ChevronUp size={16} style={{ color: accent }} />
                  : <ChevronRight size={16} style={{ color: accent }} />
                }
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: `${accent}15` }}>
                  {cats.map(catKey => {
                    const data = entry[catKey];
                    if (!data) return null;
                    return <CategorySection key={catKey} catKey={catKey} data={data} accent={accent} onSendToMcqCommunity={onSendToMcqCommunity} user={user} onReaderOpenChange={onReaderOpenChange} customBooks={customBooks} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// Main export: home page coaching cards
export function CoachingHomeworkSection({
  tierTheme,
  isDarkMode,
  card3D: card3DProp,
  settings,
  onSendToMcqCommunity,
  user,
  onNotesReaderOpen,
  onNotesReaderClose,
}: {
  tierTheme: any;
  isDarkMode?: boolean;
  card3D?: boolean;
  settings?: any;
  onSendToMcqCommunity?: (draft: McqCommunityDraft) => void;
  user?: any;
  onNotesReaderOpen?: () => void;
  onNotesReaderClose?: () => void;
}) {
  const [coachings, setCoachings] = useState<Coaching[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Coaching | null>(null);
  const [firestoreCoaching, setFirestoreCoaching] = useState<{ id: string; name: string; emoji?: string } | null>(null);

  const userCoachingId: string | undefined = user?.coachingId;

  // Cleanup: reset nav state when section unmounts with a reader open
  useEffect(() => {
    return () => { onNotesReaderClose?.(); };
  }, [onNotesReaderClose]);

  useEffect(() => {
    const r = ref(rtdb, 'coaching_homework');
    const unsub = onValue(r, snap => {
      setLoading(false);
      if (!snap.exists()) { setCoachings([]); return; }
      const val = snap.val();
      // Object.entries se key (coachingId) bhi milta hai — id field nahi hoti RTDB mein
      const list: Coaching[] = Object.entries(val || {})
        .map(([key, c]: [string, any]) => ({
          ...c,
          id: c.id || key,          // RTDB key hi coachingId hai
          name: c.name || key,      // naam na ho toh key dikhao, Firestore se replace hoga
        }))
        .sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      setCoachings(list);
    });
    return () => off(r, 'value', unsub);
  }, []);

  // Coaching name RTDB mein nahi hoti (CoachingAdminPanel sirf entries likhta hai)
  // Firestore se naam + emoji fetch karo jab zaroorat ho
  useEffect(() => {
    if (!userCoachingId || loading) return;
    const found = coachings.find(c => c.id === userCoachingId);
    if (!found) {
      // RTDB mein bilkul nahi — pure Firestore card dikhao
      getCoaching(userCoachingId).then(c => {
        if (c) setFirestoreCoaching({ id: c.id, name: c.name, emoji: c.emoji });
      }).catch(() => {});
    } else if (!found.name || found.name === found.id) {
      // RTDB mein entries hain par naam nahi — Firestore se naam lo aur update karo
      getCoaching(userCoachingId).then(c => {
        if (c) {
          setCoachings(prev => prev.map(co =>
            co.id === userCoachingId ? { ...co, name: c.name, emoji: c.emoji } : co
          ));
        }
        setFirestoreCoaching(null);
      }).catch(() => {});
    } else {
      setFirestoreCoaching(null);
    }
  }, [userCoachingId, coachings, loading]);

  const accent = tierTheme?.primary || tierTheme?.border || '#6366f1';
  const card3D = card3DProp ?? false;

  // Only show the coaching the user has joined.
  const visibleCoachings = userCoachingId
    ? coachings.filter(c => c.id === userCoachingId)
    : [];

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={18} style={{ color: accent }} className="animate-spin" />
      </div>
    );
  }

  // Agar RTDB mein nahi hai par Firestore mein hai — empty card dikhao
  if (visibleCoachings.length === 0 && firestoreCoaching) {
    const bg = tierTheme?.profileCardBg || tierTheme?.cardBg || '#ffffff';
    return (
      <>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex-1 h-px" style={{ background: `${accent}30` }} />
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>Coaching Homework</span>
          <span className="flex-1 h-px" style={{ background: `${accent}30` }} />
        </div>
        <div className="rounded-2xl overflow-hidden text-left"
          style={card3D
            ? { background: bg, border: `2px solid ${accent}`, boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${accent}bb, 0 7px 18px ${accent}28`, transform: 'translateY(-1px)' }
            : { background: bg, border: `2px solid ${accent}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
          }>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${accent}15` }}>
              {firestoreCoaching.emoji || '🏫'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: accent }}>Coaching Homework</p>
              <p className="font-black text-slate-800 text-sm leading-tight truncate">{firestoreCoaching.name}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Abhi koi homework nahi hai</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (visibleCoachings.length === 0) return null;

  const getLatestDate = (coaching: Coaching) => {
    const entries = Object.values(coaching.entries || {});
    if (entries.length === 0) return null;
    return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date;
  };

  const countEntries = (coaching: Coaching) =>
    Object.keys(coaching.entries || {}).length;

  return (
    <>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-1 h-px" style={{ background: `${accent}30` }} />
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>Coaching Homework</span>
        <span className="flex-1 h-px" style={{ background: `${accent}30` }} />
      </div>

      {/* Coaching cards */}
      <div className="space-y-2">
        {visibleCoachings.map(coaching => {
          const latestDate = getLatestDate(coaching);
          const entryCount = countEntries(coaching);
          const borderColor = accent;
          const bg = tierTheme?.profileCardBg || tierTheme?.cardBg || '#ffffff';

          return (
            <button
              key={coaching.id}
              onClick={() => { hapticStrong(); setSelected(coaching); }}
              className="w-full rounded-2xl overflow-hidden active:scale-[0.99] transition-all text-left"
              style={card3D
                ? { background: bg, border: `2px solid ${borderColor}`, boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${borderColor}bb, 0 7px 18px ${borderColor}28`, transform: 'translateY(-1px)' }
                : { background: bg, border: `2px solid ${borderColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
              }
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${borderColor}15` }}>
                  {coaching.emoji || '🏫'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: borderColor }}>
                    Coaching Homework
                  </p>
                  <p className="font-black text-slate-800 text-sm leading-tight truncate">{coaching.name}</p>
                  {latestDate && (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Latest: {formatDate(latestDate)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {entryCount > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: `${borderColor}18`, color: borderColor }}>
                      {entryCount} entries
                    </span>
                  )}
                  <ChevronRight size={16} style={{ color: borderColor }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail view */}
      {selected && (
        <CoachingDetailView
          coaching={selected}
          onClose={() => setSelected(null)}
          tierTheme={tierTheme}
          isDarkMode={isDarkMode}
          settings={settings}
          onSendToMcqCommunity={onSendToMcqCommunity}
          user={user}
          onReaderOpenChange={(open) => open ? onNotesReaderOpen?.() : onNotesReaderClose?.()}
        />
      )}
    </>
  );
}
