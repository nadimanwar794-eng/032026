// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Save, Trash2, ChevronRight, ArrowLeft, Plus, BookOpen, Edit2, X, ArrowRight, Copy } from 'lucide-react';
import { parseMCQText } from '../utils/mcqParser';
import { saveTopicNotes } from '../utils/revisionTrackerV2';
import { saveMcqLesson, deleteMcqLesson, subscribeMcqLessons } from '../firebase';

const CLASSES = ['6', '7', '8', '9', '10', '11', '12', 'COMPETITION'];

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  '6':  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
  '7':  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
  '8':  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
  '9':  ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Social Science', 'English', 'Hindi'],
  '10': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Social Science', 'English', 'Hindi'],
  '11': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Economics', 'History', 'Political Science'],
  '12': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Economics', 'History', 'Political Science'],
  'COMPETITION': ['Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Political Science', 'Economics'],
};

function normalizeMcqPaste(raw: string): string {
  let txt = raw;
  txt = txt.replace(/\r\n/g, '\n');
  txt = txt.replace(/^---+\s*$/gm, '');
  txt = txt.replace(/^###\s+.+$/gm, '');
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

interface Props {
  settings: any;
  onSave: (key: string, mcqs: any[]) => void;
}

type Screen = 'CLASS' | 'SUBJECT' | 'LESSON_LIST' | 'ADD_LESSON';

const BOARD_OPTIONS = [
  { id: '' as const,         label: '🌐 All',       desc: 'All Boards' },
  { id: 'NCERT_EN' as const, label: '📘 NCERT EN',  desc: 'English medium' },
  { id: 'NCERT_HI' as const, label: '📙 NCERT HI',  desc: 'Hindi medium' },
  { id: 'BSEB' as const,     label: '🟠 BSEB',      desc: 'Bihar board' },
];

export const AdminClassMcqManager: React.FC<Props> = ({ settings, onSave }) => {
  const [screen, setScreen]               = useState<Screen>('CLASS');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [allLessons, setAllLessons]       = useState<any[]>([]);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [boardFilter, setBoardFilter]     = useState<'' | 'NCERT_EN' | 'NCERT_HI' | 'BSEB'>('');

  // Add lesson form state
  const [lessonTitle, setLessonTitle] = useState('');
  const [pasteText, setPasteText]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [alert, setAlert]             = useState('');

  // Move/Copy modal state
  const [moveCopyModal, setMoveCopyModal] = useState<{ lesson: any; mode: 'move' | 'copy' } | null>(null);
  const [mcTargetClass, setMcTargetClass] = useState<string>('6');
  const [mcTargetSubject, setMcTargetSubject] = useState<string>('');
  const [mcTargetBoard, setMcTargetBoard] = useState<'' | 'NCERT_EN' | 'NCERT_HI' | 'BSEB'>('');
  const [mcWorking, setMcWorking] = useState(false);

  const showAlert = (msg: string) => { setAlert(msg); setTimeout(() => setAlert(''), 4000); };

  // Subscribe to mcq_lessons from Firebase
  useEffect(() => {
    const unsub = subscribeMcqLessons((lessons) => setAllLessons(lessons));
    return unsub;
  }, []);

  // Lessons filtered for current class+subject+board
  const filteredLessons = allLessons.filter(
    l => l.classLevel === selectedClass && l.subject === selectedSubject && (boardFilter === '' || l.board === boardFilter)
  );

  // Count lessons per subject for subject screen
  const lessonCountForSubject = (cls: string, sub: string) =>
    allLessons.filter(l => l.classLevel === cls && l.subject === sub && (boardFilter === '' || l.board === boardFilter)).length;

  // Count total lessons per class for class screen
  const lessonCountForClass = (cls: string) =>
    allLessons.filter(l => l.classLevel === cls && (boardFilter === '' || l.board === boardFilter)).length;

  // Reusable board switcher bar
  const BoardBar = (
    <div className="flex gap-1.5 mb-3">
      {BOARD_OPTIONS.map(b => (
        <button key={b.id} type="button"
          onClick={() => setBoardFilter(b.id)}
          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
            boardFilter === b.id
              ? 'bg-indigo-600 text-white border-indigo-600 shadow'
              : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );

  const handleSaveLesson = async () => {
    if (!lessonTitle.trim()) { showAlert('❌ Lesson title daalein'); return; }
    if (!pasteText.trim())   { showAlert('❌ MCQ paste karein'); return; }
    setSaving(true);
    try {
      const raw = pasteText.trim();
      const normalized = normalizeMcqPaste(raw);
      const result = parseMCQText(normalized);
      const ts = Date.now();
      const parsed = (result?.questions || []).map((q: any, i: number) => ({
        id: `mcq_${ts}_${i}_${Math.random().toString(36).slice(2)}`,
        question: (q.question || '').replace(/<br\/?>/g, '\n').replace(/^Q?\s*\d+[.)]\s*/i, '').trim(),
        options: (q.options || ['', '', '', '']).slice(0, 4),
        correctAnswer: q.correctAnswer ?? 0,
        topic: (q.topic || '').trim() || undefined,
        explanation: (q.explanation || '').trim() || undefined,
        concept: (q.concept || '').trim() || undefined,
        examTip: (q.examTip || '').trim() || undefined,
        difficultyLevel: q.difficultyLevel || undefined,
      }));
      if (!parsed.length) {
        showAlert('❌ Parse nahi hua. Format: <TOPIC: naam>\nQ1. sawaal?\nA) opt\nAnswer: B) text');
        setSaving(false); return;
      }

      // Save <NOTE: ...> blocks
      const notesToSave: { title: string; content: string }[] = [];
      const noteRegex = /<NOTE:\s*([^>]+)>([\s\S]*?)<\/NOTE[^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = noteRegex.exec(raw)) !== null) {
        const title = m[1].trim(); const content = m[2].trim();
        if (title && content) notesToSave.push({ title, content });
      }
      if (notesToSave.length) saveTopicNotes(notesToSave);

      const topics = [...new Set(parsed.map((q: any) => q.topic).filter(Boolean))] as string[];
      const lessonId = editingLesson ? editingLesson.id : `lesson_${ts}_${Math.random().toString(36).slice(2)}`;

      // Merge topicNotes: keep existing + add new ones (dedup by title)
      const existingNotes: { title: string; content: string }[] = editingLesson?.topicNotes || [];
      const mergedNotes = [...existingNotes];
      for (const n of notesToSave) {
        const idx = mergedNotes.findIndex(e => e.title.trim().toLowerCase() === n.title.trim().toLowerCase());
        if (idx >= 0) mergedNotes[idx] = n;
        else mergedNotes.push(n);
      }

      const lesson = {
        id: lessonId,
        classLevel: selectedClass,
        subject: selectedSubject,
        board: boardFilter || null,
        lessonTitle: lessonTitle.trim(),
        mcqs: editingLesson ? [...(editingLesson.mcqs || []), ...parsed] : parsed,
        mcqCount: (editingLesson ? (editingLesson.mcqs || []).length : 0) + parsed.length,
        topics,
        topicCount: topics.length,
        topicNotes: mergedNotes,
        createdAt: editingLesson ? editingLesson.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveMcqLesson(lesson);
      const noteMsg = notesToSave.length ? ` + ${notesToSave.length} note(s)` : '';
      showAlert(`✅ ${parsed.length} MCQ save ho gaye! Lesson: "${lessonTitle.trim()}"${noteMsg}`);
      setPasteText('');
      if (!editingLesson) { setLessonTitle(''); }
      setScreen('LESSON_LIST');
      setEditingLesson(null);
    } catch (err: any) {
      showAlert(`❌ Error: ${err?.message || 'Save nahi hua'}`);
    }
    setSaving(false);
  };

  const handleDeleteLesson = async (lesson: any) => {
    if (!confirm(`"${lesson.lessonTitle}" permanently delete karein?\n${lesson.mcqCount} MCQs hamesha ke liye chale jayenge.`)) return;
    try {
      await deleteMcqLesson(lesson.id);
      showAlert(`🗑️ "${lesson.lessonTitle}" delete ho gaya`);
    } catch (err: any) {
      showAlert(`❌ Delete failed: ${err?.message || ''}`);
    }
  };

  const handleDeleteSingleMcq = async (lesson: any, mcqIdx: number) => {
    if (!confirm(`Q${mcqIdx + 1} delete karein?`)) return;
    const newMcqs = lesson.mcqs.filter((_: any, i: number) => i !== mcqIdx);
    const topics = [...new Set(newMcqs.map((q: any) => q.topic).filter(Boolean))] as string[];
    const updated = { ...lesson, mcqs: newMcqs, mcqCount: newMcqs.length, topics, topicCount: topics.length, updatedAt: new Date().toISOString() };
    await saveMcqLesson(updated);
    showAlert(`✅ Q${mcqIdx + 1} delete ho gaya. Remaining: ${newMcqs.length}`);
  };

  const openMoveCopy = (lesson: any, mode: 'move' | 'copy') => {
    const defaultClass = CLASSES.filter(c => c !== lesson.classLevel)[0] || '6';
    setMcTargetClass(defaultClass);
    setMcTargetSubject((SUBJECTS_BY_CLASS[defaultClass] || [])[0] || '');
    setMcTargetBoard(lesson.board || '');
    setMoveCopyModal({ lesson, mode });
  };

  const handleConfirmMoveCopy = async () => {
    if (!moveCopyModal || !mcTargetClass || !mcTargetSubject) return;
    const { lesson, mode } = moveCopyModal;
    setMcWorking(true);
    try {
      const ts = Date.now();
      const newId = `lesson_${ts}_${Math.random().toString(36).slice(2)}`;
      const newLesson = {
        ...lesson,
        id: newId,
        classLevel: mcTargetClass,
        subject: mcTargetSubject,
        board: mcTargetBoard || null,
        updatedAt: new Date().toISOString(),
      };
      await saveMcqLesson(newLesson);
      const boardLabel = mcTargetBoard ? ` / ${BOARD_OPTIONS.find(b => b.id === mcTargetBoard)?.label ?? mcTargetBoard}` : '';
      if (mode === 'move') {
        await deleteMcqLesson(lesson.id);
        showAlert(`✅ "${lesson.lessonTitle}" move ho gaya → Class ${mcTargetClass} / ${mcTargetSubject}${boardLabel}`);
      } else {
        showAlert(`✅ "${lesson.lessonTitle}" copy ho gaya → Class ${mcTargetClass} / ${mcTargetSubject}${boardLabel}`);
      }
      setMoveCopyModal(null);
    } catch (err: any) {
      showAlert(`❌ Error: ${err?.message || 'Failed'}`);
    }
    setMcWorking(false);
  };

  const goBack = () => {
    if (screen === 'ADD_LESSON')  { setScreen('LESSON_LIST'); setLessonTitle(''); setPasteText(''); setEditingLesson(null); return; }
    if (screen === 'LESSON_LIST') { setScreen('SUBJECT'); setSelectedSubject(null); return; }
    if (screen === 'SUBJECT')     { setScreen('CLASS'); setSelectedClass(null); return; }
  };

  // ── Screen: CLASS ────────────────────────────────────────────────────────────
  if (screen === 'CLASS') return (
    <div className="space-y-3 p-4">
      {BoardBar}
      <p className="text-xs font-bold text-slate-500 uppercase mb-3">Class Choose Karein</p>
      <div className="grid grid-cols-4 gap-2">
        {CLASSES.filter(c => c !== 'COMPETITION').map(c => {
          const cnt = lessonCountForClass(c);
          return (
            <button key={c} onClick={() => { setSelectedClass(c); setScreen('SUBJECT'); }}
              className="flex flex-col items-center p-3 rounded-2xl border-2 border-indigo-100 bg-indigo-50 active:scale-95 transition-all"
            >
              <span className="text-xl mb-1">📚</span>
              <span className="text-[9px] text-slate-400 font-bold">CLASS</span>
              <span className="text-lg font-black text-indigo-700">{c}</span>
              {cnt > 0 && (
                <span className="text-[7px] mt-0.5 bg-indigo-200 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full">
                  {cnt} lessons
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button onClick={() => { setSelectedClass('COMPETITION'); setScreen('SUBJECT'); }}
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-amber-200 bg-amber-50 active:scale-95 transition-all"
      >
        <span className="text-2xl">🏆</span>
        <div className="flex-1 text-left">
          <p className="font-black text-slate-800">Competition / Govt. Exams</p>
          <p className="text-[10px] text-slate-500">SSC · UPSC · Railway · Police</p>
        </div>
        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full mr-2">
          {lessonCountForClass('COMPETITION')} lessons
        </span>
        <ChevronRight size={16} className="text-amber-500" />
      </button>
    </div>
  );

  // ── Screen: SUBJECT ───────────────────────────────────────────────────────────
  if (screen === 'SUBJECT') return (
    <div className="space-y-2 p-4">
      {BoardBar}
      <button onClick={goBack} className="flex items-center gap-1 text-xs text-indigo-600 font-bold mb-3">
        <ArrowLeft size={14} /> Back to Classes
      </button>
      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Class {selectedClass} — Subject Choose Karein</p>
      {(SUBJECTS_BY_CLASS[selectedClass!] || []).map(sub => {
        const cnt = lessonCountForSubject(selectedClass!, sub);
        return (
          <button key={sub} onClick={() => { setSelectedSubject(sub); setScreen('LESSON_LIST'); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white active:scale-[0.99] transition-all shadow-sm"
          >
            <span className="font-bold text-slate-800">{sub}</span>
            <div className="flex items-center gap-2">
              {cnt > 0 && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                  {cnt} lessons
                </span>
              )}
              <ChevronRight size={14} className="text-slate-400" />
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Screen: LESSON LIST ───────────────────────────────────────────────────────
  if (screen === 'LESSON_LIST') return (
    <div className="p-4 space-y-4">
      {BoardBar}
      <div className="flex items-center gap-2">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-indigo-600 font-bold">
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-xs text-slate-400 flex-1">Class {selectedClass} → {selectedSubject}</span>
        <button onClick={() => { setEditingLesson(null); setLessonTitle(''); setPasteText(''); setScreen('ADD_LESSON'); }}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
        >
          <Plus size={13} /> New Lesson
        </button>
      </div>

      {alert && (
        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">{alert}</div>
      )}

      {filteredLessons.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-600 font-bold">Koi lesson nahi abhi</p>
          <p className="text-slate-400 text-sm mt-1">+ New Lesson button se pehla lesson add karein</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLessons.map((lesson: any) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onEdit={() => { setEditingLesson(lesson); setLessonTitle(lesson.lessonTitle); setPasteText(''); setScreen('ADD_LESSON'); }}
              onDelete={() => handleDeleteLesson(lesson)}
              onDeleteMcq={(idx) => handleDeleteSingleMcq(lesson, idx)}
              onMove={() => openMoveCopy(lesson, 'move')}
              onCopy={() => openMoveCopy(lesson, 'copy')}
            />
          ))}
        </div>
      )}

      {/* ── Move / Copy Modal ───────────────────────────────────────────── */}
      {moveCopyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">
                {moveCopyModal.mode === 'move' ? '➡️ Lesson Move Karein' : '📋 Lesson Copy Karein'}
              </h3>
              <button onClick={() => setMoveCopyModal(null)} className="p-1 rounded-lg bg-slate-100 text-slate-500 active:scale-95">
                <X size={15} />
              </button>
            </div>

            <div className="px-3 py-2 bg-indigo-50 rounded-xl text-xs text-indigo-700 font-bold truncate">
              "{moveCopyModal.lesson.lessonTitle}" ({moveCopyModal.lesson.mcqCount} MCQs)
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Class</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CLASSES.filter(c => c !== 'COMPETITION').map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setMcTargetClass(c);
                      setMcTargetSubject((SUBJECTS_BY_CLASS[c] || [])[0] || '');
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                      mcTargetClass === c
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setMcTargetClass('COMPETITION');
                    setMcTargetSubject((SUBJECTS_BY_CLASS['COMPETITION'] || [])[0] || '');
                  }}
                  className={`col-span-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                    mcTargetClass === 'COMPETITION'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}
                >
                  🏆 Competition
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Subject</label>
              <select
                value={mcTargetSubject}
                onChange={e => setMcTargetSubject(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 bg-white"
              >
                {(SUBJECTS_BY_CLASS[mcTargetClass] || []).map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Board</label>
              <div className="grid grid-cols-2 gap-1.5">
                {BOARD_OPTIONS.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setMcTargetBoard(b.id as '' | 'NCERT_EN' | 'NCERT_HI' | 'BSEB')}
                    className={`py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${
                      mcTargetBoard === b.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {moveCopyModal.mode === 'move' && (
              <p className="text-[10px] text-rose-500 font-bold bg-rose-50 px-3 py-2 rounded-xl">
                ⚠️ Move karne ke baad yeh lesson current class se hat jayega.
              </p>
            )}

            <button
              onClick={handleConfirmMoveCopy}
              disabled={mcWorking || !mcTargetSubject}
              className={`w-full py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${
                moveCopyModal.mode === 'move' ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}
            >
              {moveCopyModal.mode === 'move' ? <ArrowRight size={15} /> : <Copy size={15} />}
              {mcWorking
                ? (moveCopyModal.mode === 'move' ? 'Moving...' : 'Copying...')
                : (moveCopyModal.mode === 'move'
                    ? `Move → Class ${mcTargetClass}`
                    : `Copy → Class ${mcTargetClass}`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Screen: ADD / EDIT LESSON ─────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-indigo-600 font-bold">
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-xs text-slate-400">{selectedClass} → {selectedSubject}</span>
        {boardFilter && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            {BOARD_OPTIONS.find(b => b.id === boardFilter)?.label}
          </span>
        )}
        <span className="ml-auto text-xs font-black text-indigo-600">
          {editingLesson ? `Edit: ${editingLesson.lessonTitle}` : 'New Lesson'}
        </span>
      </div>

      {alert && (
        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">{alert}</div>
      )}

      {/* Lesson Title */}
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
          Lesson / Chapter Title <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={lessonTitle}
          onChange={e => setLessonTitle(e.target.value)}
          placeholder="e.g. Chapter 6 — पोषण (Nutrition)"
          className="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400"
        />
      </div>

      {/* Editing: show existing MCQ count */}
      {editingLesson && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700 font-bold">
          <BookOpen size={14} />
          <span>Already saved: {editingLesson.mcqCount} MCQs · Niche paste karke aur add karein</span>
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Format Example</p>
        <pre className="text-[9.5px] text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{`<TOPIC: पोषण (Nutrition)>

Q1. Bharat ki rajdhani kya hai?
A) Mumbai
B) New Delhi
C) Chennai
D) Kolkata
Answer: B) New Delhi
Explanation: New Delhi Bharat ki rajdhani hai.

<TOPIC: Digestive System>

Q2. Paani ka formula?
A) CO2
B) H2O
C) NaCl
D) O2
Answer: B) H2O`}</pre>
      </div>

      {/* MCQ Paste */}
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
          MCQ Paste Karein <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder="Yahan MCQ paste karein... ChatGPT/Gemini output ya simple format — dono chalega&#10;&#10;Ek lesson mein multiple topics ho sakte hain: <TOPIC: naam> use karein"
          className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none h-48 focus:border-indigo-400 font-mono resize-none"
        />
      </div>

      <button
        onClick={handleSaveLesson}
        disabled={saving || !pasteText.trim() || !lessonTitle.trim()}
        className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        <Save size={16} />
        {saving ? 'Saving...' : editingLesson ? 'MCQs Add Karo Is Lesson Mein' : 'Lesson Save Karo'}
      </button>
    </div>
  );
};

// ── Lesson Card component ─────────────────────────────────────────────────────
function LessonCard({ lesson, onEdit, onDelete, onDeleteMcq, onMove, onCopy }: {
  lesson: any;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteMcq: (idx: number) => void;
  onMove: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-sm truncate">{lesson.lessonTitle}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              {lesson.mcqCount} MCQs
            </span>
            {(lesson.topics || []).slice(0, 3).map((t: string) => (
              <span key={t} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
                {t}
              </span>
            ))}
            {(lesson.topics || []).length > 3 && (
              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                +{lesson.topics.length - 3} more
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-violet-50 text-violet-600 active:scale-95 transition-all" title="MCQs add karein">
            <Edit2 size={13} />
          </button>
          <button onClick={onMove} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 active:scale-95 transition-all" title="Dusri class mein move karein">
            <ArrowRight size={13} />
          </button>
          <button onClick={onCopy} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 active:scale-95 transition-all" title="Dusri class mein copy karein">
            <Copy size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 active:scale-95 transition-all" title="Delete lesson">
            <Trash2 size={13} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-all active:scale-95 ${expanded ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}
          >
            <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded MCQ list */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 max-h-72 overflow-y-auto">
          {(lesson.mcqs || []).map((q: any, qi: number) => (
            <div key={qi} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
              <span className="text-[9px] font-black text-slate-400 shrink-0 mt-0.5">Q{qi + 1}</span>
              <div className="flex-1 min-w-0">
                {q.topic && (
                  <span className="text-[8px] font-bold bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded mr-1">{q.topic}</span>
                )}
                <p className="text-[10px] text-slate-700 font-medium leading-relaxed line-clamp-2">
                  {(q.question || '').replace(/<br\/?>/g, ' ')}
                </p>
                <p className="text-[9px] text-emerald-700 font-bold mt-0.5">
                  ✓ {String.fromCharCode(65 + q.correctAnswer)}. {q.options?.[q.correctAnswer] || ''}
                </p>
              </div>
              <button onClick={() => onDeleteMcq(qi)} className="text-rose-300 hover:text-rose-500 shrink-0 active:scale-95 transition-all p-0.5">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
