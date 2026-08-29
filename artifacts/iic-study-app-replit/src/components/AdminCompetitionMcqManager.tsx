// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Save, Trash2, ArrowLeft, BookOpen, CheckSquare, Calendar, FileText, Hash, ChevronRight } from 'lucide-react';
import { parseMCQText } from '../utils/mcqParser';
import { saveMcqLesson, deleteMcqLesson, subscribeMcqLessons } from '../firebase';

// ── MCQ text normalizer (same as AdminClassMcqManager) ───────────────────────
function normalizeMcqPaste(raw: string): string {
  let txt = raw;
  txt = txt.replace(/\r\n/g, '\n');
  txt = txt.replace(/^---+\s*$/gm, '');
  txt = txt.replace(/^###\s+.+$/gm, '');
  txt = txt.replace(/^[ \t]*(?:\*{1,2})?\s*सही\s*उत्तर\s*:\s*(?:\*{1,2})?\s*$/gm, '');
  txt = txt.replace(/\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]\s*\n+\s*(?=\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?))/gi, '');
  txt = txt.replace(/^\s*\[(?:[⚡🔥💡🎯⭐✨🏆⚠️🌟][^\]]*?|[^\]]{1,10})\]\s*/gm, '');
  txt = txt.replace(/^\*\*\s*कूट\s*:?\s*\*?\*?\s*$/gm, '');
  txt = txt.replace(/\*\*Q\s*(\d+)\s*[:.]\s*([\s\S]*?)\*\*/gi, (_m, n, q) =>
    `**Question ${n}**\n❓ Question: ${q.trim()}`
  );
  txt = txt.replace(/\*\*\s*(?:प्रश्न|Question)\s*(\d+)\s*[:.\-]\s*([\s\S]*?)\*\*([^\n]*)/gi, (_m, n, q, rest) => {
    const combined = (String(q).trim() + ' ' + String(rest).trim()).trim()
      .replace(/\*\*$/, '').replace(/\s*\((?:Easy|Medium|Hard|आसान|मध्यम|कठिन)[^)]*\)\s*$/i, '').replace(/^\[.*?\]\s*/g, '').trim();
    return `\n**Question ${n}**\n❓ Question: ${combined}`;
  });
  txt = txt.replace(/(?:^|\n)[ \t]*(?:\*\*\s*)?(?:प्रश्न|Question)\s*(\d+)\s*[:.\-]\s*/gi, (_m, n) => `\n**Question ${n}**\n❓ Question: `);
  txt = txt.replace(/\*\*प्रश्न\s*[:：]?\*\*/gi, '__PRASHNA__');
  txt = txt.replace(/\*\*Question\s*[:：]?\*\*/gi, '__PRASHNA__');
  txt = txt.replace(/\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]\s*([^*]+?)\s*\*\*/gi,
    (_m, val) => `\n✅ Correct Answer: ${String(val).trim()}`);
  txt = txt.replace(/\*\*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]?\*\*\s*/gi, '✅ Correct Answer: ');
  txt = txt.replace(/(?:^|\n)\s*(?:Ans(?:wer)?|सही\s*उत्तर)\s*[:：]\s*/gi, '\n✅ Correct Answer: ');
  txt = txt.replace(/\*\*/g, '');
  let qNum = 0;
  txt = txt.replace(/__PRASHNA__\s*/g, () => { qNum += 1; return `\n**Question ${qNum}**\n❓ Question: `; });
  const alreadySimpleFormat = /<TOPIC:/i.test(txt) || /^\s*Q\s*\d+[\.\)]/im.test(txt);
  if (qNum === 0 && !txt.includes('**Question') && !txt.includes('❓') && !alreadySimpleFormat) {
    const lines = txt.split('\n'); const out: string[] = []; let counter = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; const next = (lines[i + 1] || '').trim();
      const looksLikeOptStart = /^\s*[A-Da-d1-4][\)\.]/i.test(next);
      const isQLine = looksLikeOptStart && l.trim().length > 0 && !/✅|Correct Answer/i.test(l) && !/^\s*[A-D][\)\.]/i.test(l);
      if (isQLine) { counter += 1; out.push(`**Question ${counter}**`); out.push(`❓ Question: ${l.trim().replace(/^Q?\d+[.)]\s*/i, '')}`); }
      else { out.push(l); }
    }
    txt = out.join('\n');
  }
  return txt;
}

const BOARD_OPTIONS = [
  { id: '' as const,         label: '🌐 All Boards',  desc: 'Sabhi boards' },
  { id: 'NCERT_EN' as const, label: '📘 NCERT EN',    desc: 'English medium' },
  { id: 'NCERT_HI' as const, label: '📙 NCERT HI',    desc: 'Hindi medium' },
  { id: 'BSEB' as const,     label: '🟠 BSEB',        desc: 'Bihar board' },
];

interface Props {
  onBack: () => void;
}

export const AdminCompetitionMcqManager: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<'ADD' | 'HISTORY'>('ADD');
  const [allLessons, setAllLessons] = useState<any[]>([]);

  // Form state
  const [title, setTitle]   = useState('');
  const [date, setDate]     = useState('');
  const [pageNo, setPageNo] = useState('');
  const [board, setBoard]   = useState<'' | 'NCERT_EN' | 'NCERT_HI' | 'BSEB'>('');
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving]       = useState(false);
  const [alert, setAlert]         = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showAlert = (msg: string) => { setAlert(msg); setTimeout(() => setAlert(''), 5000); };

  // Subscribe to mcq_lessons — show only COMPETITION / MCQ_PRACTICE
  useEffect(() => {
    const unsub = subscribeMcqLessons((lessons) => {
      setAllLessons(
        lessons.filter(l => l.classLevel === 'COMPETITION' && l.subject === 'MCQ_PRACTICE')
      );
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!title.trim() && !date && !pageNo.trim()) {
      showAlert('❌ Title, Date, ya Page No — koi ek zaroor daalein.');
      return;
    }
    if (!pasteText.trim()) {
      showAlert('❌ MCQ text paste karein.');
      return;
    }
    setSaving(true);
    try {
      const normalized = normalizeMcqPaste(pasteText.trim());
      const result = parseMCQText(normalized);
      const ts = Date.now();
      const parsed = (result?.questions || []).map((q: any, i: number) => ({
        id: `mcq_${ts}_${i}_${Math.random().toString(36).slice(2)}`,
        question: (q.question || '').replace(/<br\/?>/g, '\n').replace(/^Q?\s*\d+[.)]\s*/i, '').trim(),
        options: (q.options || ['', '', '', '']).slice(0, 4),
        correctAnswer: q.correctAnswer ?? 0,
        ...(q.statements?.length ? { statements: q.statements } : {}),
        ...(q.topic?.trim()       ? { topic: q.topic.trim() }         : {}),
        ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
      }));

      if (!parsed.length) {
        showAlert('❌ MCQ parse nahi hua. Format check karein:\nQ1. Sawaal?\nA) Opt A\nB) Opt B\nAnswer: A');
        setSaving(false);
        return;
      }

      // Build a human-readable title from whichever fields are filled
      const lessonTitle =
        title.trim() ||
        (pageNo.trim() ? `Page ${pageNo.trim()}` : '') ||
        (date ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

      const lesson = {
        id:           `lesson_${ts}_${Math.random().toString(36).slice(2)}`,
        classLevel:   'COMPETITION',
        subject:      'MCQ_PRACTICE',
        board:        board || null,
        lessonTitle,
        pageNo:       pageNo.trim() || null,
        date:         date         || null,
        mcqs:         parsed,
        mcqCount:     parsed.length,
        topics:       [...new Set(parsed.map((q: any) => q.topic).filter(Boolean))],
        createdAt:    new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      };

      await saveMcqLesson(lesson);
      showAlert(`✅ ${parsed.length} MCQs save ho gaye! Lesson: "${lessonTitle}"`);
      setTitle(''); setDate(''); setPageNo(''); setPasteText('');
      setTab('HISTORY');
    } catch (err: any) {
      showAlert(`❌ Error: ${err?.message || 'Save nahi hua'}`);
    }
    setSaving(false);
  };

  const handleDelete = async (lesson: any) => {
    if (!confirm(`"${lesson.lessonTitle}" delete karein?\n${lesson.mcqCount} MCQs permanently jayenge.`)) return;
    setDeletingId(lesson.id);
    try {
      await deleteMcqLesson(lesson.id);
      showAlert('🗑️ Deleted!');
    } catch (err: any) {
      showAlert(`❌ Delete failed: ${err?.message || ''}`);
    }
    setDeletingId(null);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <button onClick={onBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-800">📝 MCQ Practice Manager</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Competition Books → MCQ Practice ke liye MCQ sets add karein
          </p>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold px-4 py-2.5 rounded-xl whitespace-pre-line">
          {alert}
        </div>
      )}

      {/* Add/History Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab('ADD')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'ADD' ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          + Add New
        </button>
        <button
          onClick={() => setTab('HISTORY')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'HISTORY' ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          History ({allLessons.length})
        </button>
      </div>

      {/* ── ADD TAB ── */}
      {tab === 'ADD' && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 space-y-4">

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-800 flex items-start gap-2">
            <span className="text-base leading-none shrink-0">ℹ️</span>
            <span>
              <strong>Title, Date, ya Page No</strong> — teeno mein se <strong>koi ek zaroor</strong> daalein.
              Baaki do optional hain.
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-black text-violet-700 uppercase tracking-wide block mb-1">
              📌 Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2.5 border border-violet-200 rounded-lg text-sm outline-none focus:border-violet-500 bg-white"
              placeholder="e.g. Polity Important MCQs, Indian History Set 1…"
            />
          </div>

          {/* Date + Page No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-violet-700 uppercase tracking-wide block mb-1">
                📅 Date (optional)
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-2.5 border border-violet-200 rounded-lg text-sm outline-none focus:border-violet-500 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-violet-700 uppercase tracking-wide block mb-1">
                📄 Page No (optional)
              </label>
              <input
                type="text"
                value={pageNo}
                onChange={e => setPageNo(e.target.value)}
                className="w-full p-2.5 border border-violet-200 rounded-lg text-sm outline-none focus:border-violet-500 bg-white"
                placeholder="e.g. 45, 101-103"
              />
            </div>
          </div>

          {/* Board */}
          <div>
            <label className="text-[10px] font-black text-violet-700 uppercase tracking-wide block mb-2">
              🌐 Board (optional)
            </label>
            <div className="flex gap-2">
              {BOARD_OPTIONS.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoard(b.id)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                    board === b.id
                      ? 'bg-violet-600 text-white border-violet-600 shadow'
                      : 'bg-white text-violet-700 border-violet-200 hover:border-violet-400'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* MCQ Paste Area */}
          <div>
            <label className="text-[10px] font-black text-violet-700 uppercase tracking-wide block mb-1">
              📝 MCQ Text *
            </label>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              className="w-full p-3 border border-violet-200 rounded-lg text-sm outline-none h-52 focus:border-violet-500 bg-white font-mono resize-y"
              placeholder={
                'Q1. Sawaal kya hai?\n' +
                'A) Option A\n' +
                'B) Option B\n' +
                'C) Option C\n' +
                'D) Option D\n' +
                'Answer: B\n\n' +
                'Q2. Doosra sawaal?\n...'
              }
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Same format jaise Class MCQ Manager — Q1./A)/B)/Answer: B format. Multiple questions ek saath paste karein.
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 transition-all ${
              saving
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 shadow-lg active:scale-[0.98]'
            }`}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={16} />
                Parse &amp; Save MCQs
              </>
            )}
          </button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'HISTORY' && (
        <div className="space-y-3">
          {allLessons.length === 0 && (
            <div className="text-center py-14 text-slate-400">
              <CheckSquare size={44} className="mx-auto mb-3 opacity-25" />
              <p className="font-bold text-slate-500">Koi MCQ set nahi</p>
              <p className="text-sm mt-1">Add New tab se MCQs add karein.</p>
            </div>
          )}

          {allLessons.map(lesson => (
            <div key={lesson.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-violet-200 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm leading-snug truncate">
                    {lesson.lessonTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[9px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {lesson.mcqCount} MCQs
                    </span>
                    {lesson.pageNo && (
                      <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Hash size={8} /> Page {lesson.pageNo}
                      </span>
                    )}
                    {lesson.date && (
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Calendar size={8} /> {lesson.date}
                      </span>
                    )}
                    {lesson.board && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {lesson.board}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Added: {new Date(lesson.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(lesson)}
                  disabled={deletingId === lesson.id}
                  className="p-1.5 text-rose-400 hover:text-rose-600 disabled:opacity-40 transition-colors shrink-0 mt-0.5"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* MCQ preview: first 2 questions */}
              {(lesson.mcqs || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                  {lesson.mcqs.slice(0, 2).map((q: any, qi: number) => (
                    <p key={qi} className="text-[11px] text-slate-600 truncate">
                      <span className="font-black text-slate-500">Q{qi + 1}.</span> {q.question}
                    </p>
                  ))}
                  {lesson.mcqs.length > 2 && (
                    <p className="text-[10px] text-violet-500 font-bold">
                      + {lesson.mcqs.length - 2} more questions…
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
