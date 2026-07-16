// @ts-nocheck
/**
 * TodayAllNotesModal — Aaj ke saare due-notes topics ek page pe dikhata hai.
 * Har topic ke liye:
 *   • TTS (Suno) button
 *   • Suggestion (Fix) button — admin ko galti batane ke liye
 *
 * Back press pe popup: "Kya aapne revision kar liya?"
 *   → User jo topics padha usse check karta hai
 *   → Check kiye topics markNotesReviewed ho jaate hain (MCQ schedule)
 */
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Volume2, Square, Lightbulb, Send,
  BookOpen, RefreshCw, AlertCircle, CheckCircle2, Circle,
  Maximize2, Minimize2, CheckCheck,
} from 'lucide-react';
import type { User } from '../types';
import type { WeakBucket } from '../utils/revisionTrackerV2';
import { getTopicNote, keywordsForBucket } from '../utils/revisionTrackerV2';
import { searchNotesByWords } from '../utils/noteSearcher';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import { saveSuggestion, fetchMcqLesson, fetchTopicNoteFromChapters } from '../firebase';
import { saveTopicNotes } from '../utils/revisionTrackerV2';

interface TopicEntry {
  bucket: WeakBucket;
  content: string;
  title: string;
  loading: boolean;
  error: boolean;
}

interface Props {
  dueNotes: WeakBucket[];
  user: User;
  onClose: () => void;
  onTopicsMarked?: (markedBuckets: WeakBucket[]) => void;
}

export const TodayAllNotesModal: React.FC<Props> = ({ dueNotes, user, onClose, onTopicsMarked }) => {
  const [entries, setEntries] = useState<TopicEntry[]>(
    dueNotes.map(b => ({ bucket: b, content: '', title: b.topic, loading: true, error: false }))
  );
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState<number | null>(null);
  const [suggestionTexts, setSuggestionTexts] = useState<Record<number, string>>({});
  const [suggestionSent, setSuggestionSent] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Exit popup state
  const [showExitPopup, setShowExitPopup] = useState(false);
  // All topics checked by default — user unchecks ones they didn't read
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(
    () => new Set(dueNotes.map((_, i) => i))
  );

  useEffect(() => {
    if (focusMode) {
      document.body.setAttribute('data-iic-notes-focus', '1');
    } else {
      document.body.removeAttribute('data-iic-notes-focus');
    }
    return () => { document.body.removeAttribute('data-iic-notes-focus'); };
  }, [focusMode]);

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      for (let i = 0; i < dueNotes.length; i++) {
        if (cancelled) break;
        const b = dueNotes[i];
        try {
          const directNote = b.topic ? getTopicNote(b.topic) : null;
          if (directNote) {
            const content = directNote.content
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (!cancelled) {
              setEntries(prev => {
                const updated = [...prev];
                updated[i] = { ...updated[i], content, title: directNote.title, loading: false };
                return updated;
              });
            }
          } else {
            const words = keywordsForBucket(b);
            const results = await searchNotesByWords(words, 1);
            const r = results[0];
            if (cancelled) break;
            if (r) {
              setEntries(prev => {
                const updated = [...prev];
                updated[i] = {
                  ...updated[i],
                  content: r.noteFullContent || r.noteContent || '',
                  title: r.noteTitle || b.topic,
                  loading: false,
                };
                return updated;
              });
            } else {
              // Fallback 1 — Firebase MCQ lesson's topicNotes
              let fetched = false;
              try {
                const lesson = await fetchMcqLesson(b.chapterId);
                if (lesson?.topicNotes?.length) {
                  const topicLower = (b.topic || '').trim().toLowerCase();
                  const note = lesson.topicNotes.find((n: any) =>
                    n?.title && n.title.trim().toLowerCase() === topicLower
                  ) || lesson.topicNotes.find((n: any) =>
                    n?.title && (
                      n.title.trim().toLowerCase().includes(topicLower) ||
                      topicLower.includes(n.title.trim().toLowerCase())
                    )
                  );
                  if (note?.content && !cancelled) {
                    fetched = true;
                    saveTopicNotes([{ title: note.title || b.topic, content: note.content }]);
                    setEntries(prev => {
                      const updated = [...prev];
                      updated[i] = {
                        ...updated[i],
                        content: note.content,
                        title: note.title || b.topic,
                        loading: false,
                      };
                      return updated;
                    });
                  }
                }
              } catch (_) {}

              // Fallback 2 — search chapter content_data in Firebase by board/class/subject
              if (!fetched && !cancelled) {
                try {
                  const note = await fetchTopicNoteFromChapters(
                    (user as any)?.board || '',
                    (user as any)?.classLevel || '',
                    b.subjectName || b.subjectId || '',
                    b.topic || ''
                  );
                  if (note?.content && !cancelled) {
                    fetched = true;
                    saveTopicNotes([{ title: note.title || b.topic, content: note.content }]);
                    setEntries(prev => {
                      const updated = [...prev];
                      updated[i] = {
                        ...updated[i],
                        content: note.content,
                        title: note.title || b.topic,
                        loading: false,
                      };
                      return updated;
                    });
                  }
                } catch (_) {}
              }

              if (!fetched && !cancelled) {
                setEntries(prev => {
                  const updated = [...prev];
                  updated[i] = { ...updated[i], loading: false, error: true };
                  return updated;
                });
              }
            }
          }
        } catch {
          if (!cancelled) {
            setEntries(prev => {
              const updated = [...prev];
              updated[i] = { ...updated[i], loading: false, error: true };
              return updated;
            });
          }
        }
      }
    };

    loadAll();
    return () => {
      cancelled = true;
      stopSpeech();
    };
  }, []);

  const handleSpeak = (idx: number, text: string) => {
    if (speakingIdx === idx) {
      stopSpeech();
      setSpeakingIdx(null);
    } else {
      if (speakingIdx !== null) stopSpeech();
      setSpeakingIdx(idx);
      speakText(
        text,
        null,
        1.0,
        'hi-IN',
        undefined,
        () => setSpeakingIdx(null),
      );
    }
  };

  const handleSendSuggestion = async (idx: number) => {
    const text = (suggestionTexts[idx] || '').trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await saveSuggestion({
        id: `notes_rev_${Date.now()}`,
        text: `Notes Revision: [${entries[idx].title}] | Subject: ${entries[idx].bucket.subjectName} | Correction: ${text}`,
        uid: user?.id || 'anonymous',
        userName: user?.name || user?.email?.split('@')[0] || 'Student',
        userBoard: (user as any)?.board || '',
        createdAt: new Date().toISOString(),
        mode: 'reading',
        lessonTitle: entries[idx].title,
        subject: entries[idx].bucket.subjectName,
      });
      setSuggestionSent(prev => new Set(prev).add(idx));
      setSuggestionOpen(null);
    } catch (err) {
      console.error('Suggestion save failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCheck = (idx: number) => {
    setCheckedIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleBackPress = () => {
    stopSpeech();
    setSpeakingIdx(null);
    if (onTopicsMarked && dueNotes.length > 0) {
      setShowExitPopup(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    const markedBuckets = dueNotes.filter((_, i) => checkedIdxs.has(i));
    if (onTopicsMarked && markedBuckets.length > 0) {
      onTopicsMarked(markedBuckets);
    }
    setShowExitPopup(false);
    onClose();
  };

  const handleSkipExit = () => {
    setShowExitPopup(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Revision Check Popup ── */}
      {showExitPopup && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0">
          <div className="w-full bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Popup header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center gap-2 mb-1">
                <CheckCheck size={20} className="text-indigo-600 shrink-0" />
                <h3 className="text-base font-black text-slate-800">Kya aapne revision kar liya?</h3>
              </div>
              <p className="text-xs text-slate-500 ml-7">
                Jo topics aapne padhe hain unhe tick karo — wo MCQ ke liye schedule ho jayenge.
              </p>
            </div>

            {/* Topic checklist */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {checkedIdxs.size} / {dueNotes.length} topics selected
                </span>
                <button
                  onClick={() => {
                    if (checkedIdxs.size === dueNotes.length) {
                      setCheckedIdxs(new Set());
                    } else {
                      setCheckedIdxs(new Set(dueNotes.map((_, i) => i)));
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-600 underline"
                >
                  {checkedIdxs.size === dueNotes.length ? 'Sab hatao' : 'Sab chunao'}
                </button>
              </div>

              {dueNotes.map((b, idx) => {
                const isChecked = checkedIdxs.has(idx);
                return (
                  <button
                    key={`${b.chapterId}::${b.pageKey}::${b.topic}`}
                    onClick={() => toggleCheck(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                      isChecked
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {isChecked
                      ? <CheckCircle2 size={20} className="text-indigo-600 shrink-0" />
                      : <Circle size={20} className="text-slate-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isChecked ? 'text-indigo-800' : 'text-slate-700'}`}>
                        {b.topic}
                      </p>
                      {b.subjectName && (
                        <p className="text-[10px] text-slate-400 truncate">{b.subjectName}</p>
                      )}
                    </div>
                    {isChecked && (
                      <span className="shrink-0 text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                        MCQ tayaar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+76px)] border-t border-slate-100 space-y-2.5 shrink-0">
              <button
                onClick={handleConfirmExit}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl text-sm shadow-lg shadow-indigo-200 transition-all"
              >
                <CheckCircle2 size={18} />
                {checkedIdxs.size > 0
                  ? `${checkedIdxs.size} topic mark karo aur band karo`
                  : 'Bina mark kiye band karo'}
              </button>
              <button
                onClick={handleSkipExit}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl text-sm transition-all"
              >
                Baad mein mark karunga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <button
          onClick={handleBackPress}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-slate-800 truncate flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-600 shrink-0" />
            Aaj Ke Saare Notes
          </h2>
          <p className="text-[11px] text-slate-500">
            {dueNotes.length} topics · TTS aur suggestion available hai
          </p>
        </div>
        {speakingIdx !== null && (
          <button
            onClick={() => { stopSpeech(); setSpeakingIdx(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
          >
            <Square size={12} /> Sab Roko
          </button>
        )}
        <button
          onClick={() => setFocusMode(f => !f)}
          title={focusMode ? 'Focus Mode band karo' : 'Focus Mode on karo'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shrink-0 ${
            focusMode
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
          }`}
        >
          {focusMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          {focusMode ? 'Exit' : 'Focus'}
        </button>
      </div>

      {/* ── Scrollable topics ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">

        {dueNotes.length === 0 && (
          <div className="text-center py-16">
            <BookOpen size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-bold">Aaj padhne ke liye koi notes nahi hain</p>
          </div>
        )}

        {entries.map((entry, idx) => {
          const key = `${entry.bucket.chapterId}::${entry.bucket.pageKey}::${entry.bucket.topic}`;
          const isSpeaking = speakingIdx === idx;
          const isOpen = suggestionOpen === idx;
          const isSent = suggestionSent.has(idx);

          return (
            <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Topic header */}
              <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-center gap-2">
                <BookOpen size={14} className="text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-indigo-800 leading-snug">{entry.title}</p>
                  <p className="text-[10px] text-indigo-500 truncate">
                    {entry.bucket.subjectName}{entry.bucket.chapterTitle ? ` · ${entry.bucket.chapterTitle}` : ''}
                  </p>
                </div>

                {/* Suggestion (Fix) button */}
                <button
                  onClick={() => setSuggestionOpen(isOpen ? null : idx)}
                  title="Notes mein galti batao"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors shrink-0 ${
                    isOpen
                      ? 'bg-amber-100 text-amber-700 border-amber-300'
                      : isSent
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                  }`}
                >
                  <Lightbulb size={12} />
                  {isSent ? '✓ Sent' : 'Fix'}
                </button>

                {/* TTS (Suno) button */}
                <button
                  onClick={() => !entry.loading && !entry.error && entry.content && handleSpeak(idx, entry.content)}
                  disabled={entry.loading || entry.error || !entry.content}
                  title={isSpeaking ? 'Padhna roko' : 'Yeh topic suno'}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                    isSpeaking
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isSpeaking ? <Square size={12} /> : <Volume2 size={12} />}
                  {isSpeaking ? 'Roko' : 'Suno'}
                </button>
              </div>

              {/* Suggestion panel */}
              {isOpen && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                  {isSent ? (
                    <p className="text-xs text-emerald-700 font-bold text-center py-1">
                      ✅ Suggestion bhej diya! Admin fix karega.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-amber-800">
                        <Lightbulb size={11} className="inline mr-1 text-amber-600" />
                        Notes mein kya galti hai? Admin ko batao:
                      </p>
                      <textarea
                        value={suggestionTexts[idx] || ''}
                        onChange={e => setSuggestionTexts(p => ({ ...p, [idx]: e.target.value }))}
                        placeholder="Yahan likho ki kya galat hai ya kya missing hai..."
                        className="w-full text-xs border border-amber-200 rounded-xl p-2.5 bg-white resize-none h-16 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSuggestionOpen(null)}
                          className="flex-1 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSendSuggestion(idx)}
                          disabled={submitting || !(suggestionTexts[idx] || '').trim()}
                          className="flex-1 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Send size={11} />
                          {submitting ? 'Bhej raha...' : 'Admin ko Bhejo'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes content */}
              <div className="px-4 py-4">
                {entry.loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <RefreshCw size={13} className="animate-spin text-indigo-400" />
                    Notes dhoondh raha hai...
                  </div>
                )}

                {!entry.loading && entry.error && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      Is topic ke notes abhi available nahi hain. Admin lesson mein notes add karein — phir yahan dikhenge.
                    </span>
                  </div>
                )}

                {!entry.loading && !entry.error && !entry.content && (
                  <p className="text-xs text-slate-400 italic">Content load nahi ho saka.</p>
                )}

                {!entry.loading && !entry.error && entry.content && (
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap text-slate-700 ${isSpeaking ? 'bg-indigo-50 rounded-xl p-3 border border-indigo-100' : ''}`}
                  >
                    {entry.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
