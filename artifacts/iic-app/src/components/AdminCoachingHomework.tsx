// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ref, set, onValue, off, push, remove, update } from 'firebase/database';
import { rtdb } from '../firebase';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Save,
  BookOpen, HelpCircle, FileText, Calendar, X, Edit3, Loader2, School
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CoachingNote { id: string; title: string; content?: string; pageNo?: string; }
interface CoachingMcq  {
  id: string;
  question: string;
  options: string[];
  /** Legacy single-answer field */
  correctAnswer?: number;
  /** New: multiple correct answers support */
  correctAnswers?: number[];
  explanation?: string;
}
interface CoachingPdf  { id: string; title: string; url: string; }
interface CategoryData {
  notes?: CoachingNote[];
  mcqs?:  CoachingMcq[];
  pdfs?:  CoachingPdf[];
}
interface CoachingEntry {
  id: string;
  date: string;
  speedyScience?:       CategoryData;
  speedySocialScience?: CategoryData;
  sarSangrah?:          CategoryData;
  lucent?:              CategoryData;
  mcq?:                 CategoryData;
  current_affairs?:     CategoryData;
  [customKey: string]:  CategoryData | string | undefined; // dynamic custom books
}
interface Coaching { id: string; name: string; emoji?: string; createdAt?: string; }
interface CustomBook { id: string; label: string; icon: string; color: string; }

// ─── Constants ───────────────────────────────────────────────────────────────
const EMOJIS = ['🏫','🏛️','📚','✏️','🎓','📝','🌟','⭐','🔥','💡'];
const CAT_META: Record<string, { label: string; icon: string; color: string; hasContent: string[] }> = {
  speedyScience:       { label: 'Speedy Science',                  icon: '🧪', color: '#10b981', hasContent: ['notes','mcqs','pdfs'] },
  speedySocialScience: { label: 'Speedy Social Science',           icon: '🌍', color: '#f59e0b', hasContent: ['notes','mcqs','pdfs'] },
  sarSangrah:          { label: 'Sar Sangrah',                     icon: '📕', color: '#ef4444', hasContent: ['notes','mcqs','pdfs'] },
  lucent:              { label: 'Lucent',                          icon: '🌟', color: '#8b5cf6', hasContent: ['notes','mcqs','pdfs'] },
  mcq:                 { label: 'MCQ Practice',                    icon: '🧠', color: '#3b82f6', hasContent: ['mcqs','pdfs'] },
  current_affairs:     { label: 'Current Affairs',                 icon: '📰', color: '#0ea5e9', hasContent: ['notes','mcqs','pdfs'] },
};
type CatKey = string;
const ALL_CATS: CatKey[] = ['speedyScience','speedySocialScience','sarSangrah','lucent','mcq','current_affairs'];

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

// ─── Small helpers ────────────────────────────────────────────────────────────
function Btn({ onClick, children, danger=false, small=false, ghost=false, disabled=false, style }:any) {
  const base = `inline-flex items-center gap-1.5 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 ${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`;
  const cls = ghost ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    : danger ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';
  return <button type="button" disabled={disabled} onClick={onClick} style={style} className={`${base} ${style ? '' : cls}`}>{children}</button>;
}

function Input({ label, value, onChange, placeholder='', multiline=false, small=false }:any) {
  const cls = `w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white ${small ? 'text-xs' : ''}`;
  return (
    <div>
      {label && <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls+' resize-none'} />
        : <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}

// ─── Unified Bulk Notes parser ─────────────────────────────────────────────────
// Blocks separated by blank line or ---. Each block:
//   Title: ...   (or T: ...)
//   Page: ...    (optional, or P: ...)
//   Content...   (remaining lines = content, optional)
// A block with no recognized "Title:"/"Page:" prefix on its first line falls
// back to treating the first line as the title and the rest as content.
function parseBulkNotes(text: string): CoachingNote[] {
  const blocks = text.split(/\n(?:\s*-{3,}\s*|\s*)\n/).map(b => b.trim()).filter(Boolean);
  const result: CoachingNote[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let title = '';
    let pageNo = '';
    const contentLines: string[] = [];

    for (const line of lines) {
      const titleMatch = line.match(/^(?:Title|T|शीर्षक)[:.]\s*(.+)/i);
      if (titleMatch) { title = titleMatch[1].trim(); continue; }
      const pageMatch = line.match(/^(?:Page|Page\s*No\.?|P|पेज)[:.]\s*(.+)/i);
      if (pageMatch) { pageNo = pageMatch[1].trim(); continue; }
      if (!title) { title = line; continue; }
      contentLines.push(line);
    }

    if (!title) continue;
    result.push({ id: uid(), title, pageNo, content: contentLines.join('\n') });
  }
  return result;
}

// ─── Note editor ──────────────────────────────────────────────────────────────
function NotesEditor({ notes, onChange, accent }:{ notes: CoachingNote[]; onChange:(n:CoachingNote[])=>void; accent:string }) {
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  const add = () => onChange([...notes, { id: uid(), title: '', content: '', pageNo: '' }]);
  const del = (id:string) => onChange(notes.filter(n=>n.id!==id));
  const upd = (id:string, k:string, v:string) => onChange(notes.map(n=>n.id===id?{...n,[k]:v}:n));

  const handleBulkImport = () => {
    setBulkError('');
    const parsed = parseBulkNotes(bulkText);
    if (parsed.length === 0) { setBulkError('Koi note parse nahi hua — format check karo'); return; }
    onChange([...notes, ...parsed]);
    setBulkText('');
    setShowBulk(false);
  };

  return (
    <div className="space-y-2">
      {notes.map((n,i)=>(
        <div key={n.id} className="border rounded-xl p-3 space-y-2" style={{borderColor:`${accent}30`}}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400">#{i+1}</span>
            <div className="flex-1 grid grid-cols-3 gap-2">
              <input value={n.pageNo||''} onChange={e=>upd(n.id,'pageNo',e.target.value)} placeholder="Page No."
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400" />
              <input value={n.title} onChange={e=>upd(n.id,'title',e.target.value)} placeholder="Title"
                className="col-span-2 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400" />
            </div>
            <button onClick={()=>del(n.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12}/></button>
          </div>
          <textarea value={n.content||''} onChange={e=>upd(n.id,'content',e.target.value)} placeholder="Content (optional)"
            rows={2} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 resize-none" />
        </div>
      ))}
      <div className="flex gap-2">
        <Btn small ghost onClick={add}><Plus size={11}/> Note Add Karo</Btn>
        <Btn small ghost onClick={() => { setShowBulk(s => !s); setBulkError(''); }}
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}08` }}>
          📋 Bulk Upload
        </Btn>
      </div>

      {/* Bulk paste panel */}
      {showBulk && (
        <div className="border rounded-xl p-3 space-y-2 bg-slate-50" style={{ borderColor: `${accent}30` }}>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📋 Bulk Notes — Format:</p>
          <pre className="text-[9px] text-slate-400 bg-white border border-slate-200 rounded-lg p-2 leading-relaxed whitespace-pre-wrap font-mono">{`Title: Note ka title
Page: 12
Content line 1
Content line 2 (optional)`}</pre>
          <p className="text-[9px] text-slate-400">💡 Har note ko blank line se alag karo • Page optional hai</p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="Yahan Notes paste karo..."
            rows={10}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 resize-y font-mono"
          />
          {bulkError && <p className="text-[10px] text-red-500 font-bold">{bulkError}</p>}
          <div className="flex gap-2">
            <Btn small onClick={handleBulkImport} style={{ background: accent, color: '#fff', borderColor: accent }}>
              ✅ Import Karo
            </Btn>
            <Btn small ghost onClick={() => { setShowBulk(false); setBulkText(''); setBulkError(''); }}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unified Bulk MCQ parser — accepts BOTH formats ───────────────────────────
// FORMAT 1 (star style):        FORMAT 2 (exam style):
//   Q: Question?                  Q1. Question?
//   A: Option A                   A) Option A
//   *B: Correct option ← star     *B) Correct option ← star
//   C: Option C                   C) Option C
//   Exp: Explanation              Ans: B) option   Explanation: text
// Blocks separated by blank line or ---
function parseBulkMcq(text: string): CoachingMcq[] {
  const blocks = text.split(/\n(?:\s*-{3,}\s*|\s*)\n/).map(b => b.trim()).filter(Boolean);
  const result: CoachingMcq[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let question = '';
    const options: string[] = [];
    const correctAnswers: number[] = [];
    let explanation = '';
    let ansLetter = ''; // from Ans: B) style
    let collectingExp = false;

    for (const line of lines) {
      // Question: Q: / Q1. / Q1) / प्रश्न 1:
      const qMatch = line.match(/^(?:\*?\s*)?(?:Q\s*\d*\s*[:.)\s]|प्रश्न\s*\d*\s*[:.])\s*(.+)/i);
      if (qMatch) { question = qMatch[1].trim(); collectingExp = false; continue; }

      // Explanation / Exp:
      const expMatch = line.match(/^(?:Exp|Explanation|व्याख्या)[:.]\s*(.*)/i);
      if (expMatch) { explanation = expMatch[1].trim(); collectingExp = true; continue; }
      if (collectingExp && !/^[*]?[A-Da-d][:.)]/.test(line) && !/^(?:Ans|Answer)/i.test(line)) {
        explanation += (explanation ? ' ' : '') + line; continue;
      }

      // Ans: / Answer: B or B) or B) text
      const ansMatch = line.match(/^(?:Ans|Answer|सही\s*उत्तर)[:.]\s*\*?\s*([A-Da-d])/i);
      if (ansMatch) { ansLetter = ansMatch[1].toUpperCase(); collectingExp = false; continue; }

      // Options: *A: text OR *A) text OR A: text OR A) text
      const optMatch = line.match(/^(\*?)\s*([A-Da-d])[:.)\s]\s*(.+)/);
      if (optMatch) {
        const isCorrect = optMatch[1] === '*';
        const idx = optMatch[2].toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < 4) {
          options[idx] = optMatch[3].trim();
          if (isCorrect) correctAnswers.push(idx);
        }
        collectingExp = false;
        continue;
      }

      // First unrecognized line = question fallback
      if (!question) { question = line; }
    }

    // Apply Ans: style if star style wasn't used
    if (ansLetter && correctAnswers.length === 0) {
      const idx = ansLetter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < 4) correctAnswers.push(idx);
    }

    if (!question || options.filter(Boolean).length < 2) continue;
    result.push({
      id: uid(),
      question,
      options: [options[0]||'', options[1]||'', options[2]||'', options[3]||''],
      correctAnswers: correctAnswers.length ? correctAnswers : [0],
      explanation,
    });
  }
  return result;
}

// ─── MCQ editor — supports multiple correct answers ────────────────────────────
function McqEditor({ mcqs, onChange, accent }:{ mcqs: CoachingMcq[]; onChange:(m:CoachingMcq[])=>void; accent:string }) {
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  const handleBulkImport = () => {
    setBulkError('');
    const parsed = parseBulkMcq(bulkText);
    if (parsed.length === 0) { setBulkError('Koi MCQ parse nahi hua — format check karo'); return; }
    onChange([...mcqs, ...parsed]);
    setBulkText('');
    setShowBulk(false);
  };

  const add = () => onChange([...mcqs, { id: uid(), question: '', options: ['','','',''], correctAnswers: [0], explanation: '' }]);
  const del = (id:string) => onChange(mcqs.filter(m=>m.id!==id));
  const upd = (id:string, k:string, v:any) => onChange(mcqs.map(m=>m.id===id?{...m,[k]:v}:m));
  const updOpt = (id:string, oi:number, v:string) => onChange(mcqs.map(m=>m.id===id?{...m,options:m.options.map((o,i)=>i===oi?v:o)}:m));

  /** Get the current correct set — handles both legacy (correctAnswer) and new (correctAnswers) formats */
  const getCorrectSet = (m: CoachingMcq): number[] => {
    if (m.correctAnswers && m.correctAnswers.length > 0) return m.correctAnswers;
    if (m.correctAnswer !== undefined && m.correctAnswer !== null) return [m.correctAnswer];
    return [0];
  };

  /** Toggle a correct answer index on/off */
  const toggleCorrect = (id:string, oi:number, currentSet:number[]) => {
    const has = currentSet.includes(oi);
    let next: number[];
    if (has) {
      // Don't allow deselecting last answer
      if (currentSet.length <= 1) return;
      next = currentSet.filter(x => x !== oi);
    } else {
      next = [...currentSet, oi].sort();
    }
    upd(id, 'correctAnswers', next);
    // Clear legacy field
    onChange(mcqs.map(m => m.id === id ? { ...m, correctAnswers: next, correctAnswer: undefined } : m));
  };

  return (
    <div className="space-y-3">
      {mcqs.map((m,i)=>{
        const correctSet = getCorrectSet(m);
        const isMultiple = correctSet.length > 1;
        return (
          <div key={m.id} className="border rounded-xl p-3 space-y-2" style={{borderColor:`${accent}30`}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400">MCQ #{i+1}</span>
                {isMultiple && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{background:`${accent}20`, color:accent}}>✦ Multiple</span>
                )}
              </div>
              <button onClick={()=>del(m.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
            </div>
            <textarea value={m.question} onChange={e=>upd(m.id,'question',e.target.value)} placeholder="Question"
              rows={2} className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 resize-none" />

            {/* Hint label */}
            <p className="text-[9px] text-slate-400 font-medium">
              ☑️ Checkbox pe click karo sahi answer(s) select karne ke liye (ek se zyada bhi ho sakte hain)
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {m.options.map((opt,oi)=>{
                const isCorrect = correctSet.includes(oi);
                return (
                  <div key={oi} className={`flex items-center gap-1.5 border rounded-lg px-2 py-1.5 transition-all ${isCorrect ? 'border-emerald-400 bg-emerald-50':'border-slate-200'}`}>
                    {/* Checkbox toggle for correct answer */}
                    <button
                      onClick={() => toggleCorrect(m.id, oi, correctSet)}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                        isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-emerald-300'
                      }`}
                    >
                      {isCorrect && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <input value={opt} onChange={e=>updOpt(m.id,oi,e.target.value)} placeholder={`Option ${String.fromCharCode(65+oi)}`}
                      className="flex-1 text-xs outline-none bg-transparent min-w-0" />
                  </div>
                );
              })}
            </div>
            <input value={m.explanation||''} onChange={e=>upd(m.id,'explanation',e.target.value)} placeholder="Explanation (optional)"
              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400" />
          </div>
        );
      })}
      <div className="flex gap-2">
        <Btn small ghost onClick={add}><Plus size={11}/> MCQ Add Karo</Btn>
        <Btn small ghost onClick={() => { setShowBulk(s => !s); setBulkError(''); }}
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}08` }}>
          📋 Bulk Upload
        </Btn>
      </div>

      {/* Bulk paste panel */}
      {showBulk && (
        <div className="border rounded-xl p-3 space-y-2 bg-slate-50" style={{ borderColor: `${accent}30` }}>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📋 Bulk MCQ — Dono Format Supported:</p>
          <pre className="text-[9px] text-slate-400 bg-white border border-slate-200 rounded-lg p-2 leading-relaxed whitespace-pre-wrap font-mono">{`Style 1 (star):          Style 2 (exam):
Q: Question text?        Q1. Question text?
A: Option 1              A) Option 1
*B: Sahi jawab ← star   *B) Sahi jawab ← star
C: Option 3              C) Option 3
Exp: Explanation         Ans: B) Option 2
                         Explanation: text`}</pre>
          <p className="text-[9px] text-slate-400">💡 Sahi option ke aage <b>*</b> lagao (ya Ans: B) likhein) • Blank line se alag karo</p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="Yahan MCQs paste karo..."
            rows={10}
            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 resize-y font-mono"
          />
          {bulkError && <p className="text-[10px] text-red-500 font-bold">{bulkError}</p>}
          <div className="flex gap-2">
            <Btn small onClick={handleBulkImport} style={{ background: accent, color: '#fff', borderColor: accent }}>
              ✅ Import Karo
            </Btn>
            <Btn small ghost onClick={() => { setShowBulk(false); setBulkText(''); setBulkError(''); }}>
              Rद्द
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PDF editor ───────────────────────────────────────────────────────────────
function PdfEditor({ pdfs, onChange, accent }:{ pdfs: CoachingPdf[]; onChange:(p:CoachingPdf[])=>void; accent:string }) {
  const add = () => onChange([...pdfs, { id: uid(), title: '', url: '' }]);
  const del = (id:string) => onChange(pdfs.filter(p=>p.id!==id));
  const upd = (id:string, k:string, v:string) => onChange(pdfs.map(p=>p.id===id?{...p,[k]:v}:p));
  return (
    <div className="space-y-2">
      {pdfs.map((p,i)=>(
        <div key={p.id} className="border rounded-xl p-3 space-y-2" style={{borderColor:`${accent}30`}}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400">PDF #{i+1}</span>
            <input value={p.title} onChange={e=>upd(p.id,'title',e.target.value)} placeholder="PDF Title"
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400" />
            <button onClick={()=>del(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
          </div>
          <input value={p.url} onChange={e=>upd(p.id,'url',e.target.value)} placeholder="PDF URL (https://...)"
            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400" />
        </div>
      ))}
      <Btn small ghost onClick={add}><Plus size={11}/> PDF Add Karo</Btn>
    </div>
  );
}

// ─── Entry form (add/edit entry) ──────────────────────────────────────────────
function EntryForm({ coachingId, existing, onDone, onCancel, customBooks }:{ coachingId:string; existing?:CoachingEntry; onDone:()=>void; onCancel:()=>void; customBooks?: CustomBook[] }) {
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0,10));
  const [openCat, setOpenCat] = useState<CatKey|null>('speedyScience');

  // Build effective category list: built-in + custom books
  const effectiveCats: CatKey[] = [
    ...ALL_CATS,
    ...((customBooks || []).map(b => b.id)),
  ];

  const [cats, setCats] = useState<Record<string,CategoryData>>(()=>{
    const base: Record<string,CategoryData> = {
      speedyScience:       { notes:[], mcqs:[], pdfs:[] },
      speedySocialScience: { notes:[], mcqs:[], pdfs:[] },
      sarSangrah:          { notes:[], mcqs:[], pdfs:[] },
      lucent:              { notes:[], mcqs:[], pdfs:[] },
      mcq:                 { notes:[], mcqs:[], pdfs:[] },
      current_affairs:     { notes:[], mcqs:[], pdfs:[] },
    };
    // Add custom book slots
    (customBooks || []).forEach(b => { base[b.id] = { notes:[], mcqs:[], pdfs:[] }; });
    if (!existing) return base;
    // Restore existing values
    const restored: Record<string,CategoryData> = {
      speedyScience:       { notes: existing.speedyScience?.notes||[], mcqs: existing.speedyScience?.mcqs||[], pdfs: existing.speedyScience?.pdfs||[] },
      speedySocialScience: { notes: existing.speedySocialScience?.notes||[], mcqs: existing.speedySocialScience?.mcqs||[], pdfs: existing.speedySocialScience?.pdfs||[] },
      sarSangrah:          { notes: existing.sarSangrah?.notes||[], mcqs: existing.sarSangrah?.mcqs||[], pdfs: existing.sarSangrah?.pdfs||[] },
      lucent:              { notes: existing.lucent?.notes||[], mcqs: existing.lucent?.mcqs||[], pdfs: existing.lucent?.pdfs||[] },
      mcq:                 { notes: [], mcqs: existing.mcq?.mcqs||[], pdfs: existing.mcq?.pdfs||[] },
      current_affairs:     { notes: (existing as any).current_affairs?.notes||[], mcqs: (existing as any).current_affairs?.mcqs||[], pdfs: (existing as any).current_affairs?.pdfs||[] },
    };
    (customBooks || []).forEach(b => {
      const d = (existing as any)[b.id];
      restored[b.id] = { notes: d?.notes||[], mcqs: d?.mcqs||[], pdfs: d?.pdfs||[] };
    });
    return restored;
  });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState('');

  const hasAny = () => effectiveCats.some(c=>{
    const d = cats[c];
    return (d?.notes?.length||0)+(d?.mcqs?.length||0)+(d?.pdfs?.length||0)>0;
  });

  const save = async () => {
    if (!date) { setAlert('Date select karo'); return; }
    if (!hasAny()) { setAlert('Kam se kam ek category me kuch to add karo'); return; }
    setSaving(true);
    try {
      const entryId = existing?.id || uid();
      const entryData: any = { id: entryId, date };
      effectiveCats.forEach(c => {
        const d = cats[c] || {};
        if (c === 'mcq') {
          // MCQ-only category — no notes
          const mcqs = (d.mcqs||[]).filter((m: any)=>m.question);
          const pdfs = (d.pdfs||[]).filter((p: any)=>p.url);
          if (mcqs.length||pdfs.length) entryData[c] = { mcqs, pdfs };
        } else {
          // All other categories (built-in book categories + custom books) support notes + MCQ + PDF
          const notes = (d.notes||[]).filter((n: any)=>n.title||n.pageNo||n.content);
          const mcqs  = (d.mcqs||[]).filter((m: any)=>m.question);
          const pdfs  = (d.pdfs||[]).filter((p: any)=>p.url);
          if (notes.length||mcqs.length||pdfs.length) entryData[c] = { notes, mcqs, pdfs };
        }
      });
      await set(ref(rtdb, `coaching_homework/${coachingId}/entries/${entryId}`), entryData);
      onDone();
    } catch(e:any) { setAlert(`Error: ${e?.message||'Failed'}`); }
    setSaving(false);
  };

  return (
    <div className="space-y-4 bg-white rounded-2xl p-4 border border-indigo-100">
      <div className="flex items-center justify-between">
        <h4 className="font-black text-slate-800 text-sm">{existing ? 'Entry Edit Karo' : 'Naya Entry Daalo'}</h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
      </div>

      {alert && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">{alert}</div>}

      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">📅 Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white" />
      </div>

      {/* Category accordion — built-in + custom books */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Categories</p>
        {effectiveCats.map(catKey => {
          // Resolve meta: built-in or custom book
          const customBook = (customBooks||[]).find(b => b.id === catKey);
          const meta = CAT_META[catKey] || (customBook
            ? { label: customBook.label, icon: customBook.icon, color: customBook.color, hasContent: ['notes','mcqs','pdfs'] }
            : { label: catKey, icon: '📖', color: '#64748b', hasContent: ['notes'] });
          const d = cats[catKey] || { notes:[], mcqs:[], pdfs:[] };
          const total = (d.notes?.length||0)+(d.mcqs?.length||0)+(d.pdfs?.length||0);
          const isOpen = openCat === catKey;
          // All categories support MCQ + PDF (only the dedicated "mcq" category skips Notes, handled below)
          const hasRich = true;
          return (
            <div key={catKey} className="border rounded-2xl overflow-hidden" style={{borderColor:`${meta.color}30`}}>
              <button onClick={()=>setOpenCat(isOpen?null:catKey)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                style={{background:`${meta.color}08`}}>
                <span>{meta.icon}</span>
                <span className="text-[12px] font-black flex-1" style={{color:meta.color}}>{meta.label}</span>
                {customBook && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Custom</span>}
                {total>0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:`${meta.color}20`,color:meta.color}}>{total} items</span>}
                {isOpen ? <ChevronUp size={13} style={{color:meta.color}}/> : <ChevronDown size={13} style={{color:meta.color}}/>}
              </button>
              {isOpen && (
                <div className="px-3 py-3 space-y-4 border-t" style={{borderColor:`${meta.color}15`}}>
                  {/* Notes — not shown for MCQ-only block */}
                  {catKey !== 'mcq' && (
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><BookOpen size={10}/> Notes</p>
                      <NotesEditor notes={d.notes||[]} accent={meta.color}
                        onChange={notes=>setCats(prev=>({...prev,[catKey]:{...prev[catKey],notes}}))} />
                    </div>
                  )}
                  {/* MCQ + PDF for rich categories */}
                  {hasRich && (
                    <>
                      <div className={catKey==='mcq' ? '' : 'border-t pt-3'}>
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><HelpCircle size={10}/> MCQ</p>
                        <McqEditor mcqs={d.mcqs||[]} accent={meta.color}
                          onChange={mcqs=>setCats(prev=>({...prev,[catKey]:{...prev[catKey],mcqs}}))} />
                      </div>
                      <div className="border-t pt-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><FileText size={10}/> PDF</p>
                        <PdfEditor pdfs={d.pdfs||[]} accent={meta.color}
                          onChange={pdfs=>setCats(prev=>({...prev,[catKey]:{...prev[catKey],pdfs}}))} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Btn ghost onClick={onCancel}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>
          {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
          {saving ? 'Saving...' : 'Save Entry'}
        </Btn>
      </div>
    </div>
  );
}

// ─── Coaching entries view ────────────────────────────────────────────────────
const BOOK_COLORS = ['#6366f1','#ec4899','#f97316','#14b8a6','#84cc16','#a855f7','#f59e0b','#06b6d4'];
const BOOK_ICONS  = ['📖','📗','📘','📙','📒','📓','📔','📚'];

function CoachingEntriesView({ coaching, onBack }:{ coaching:Coaching; onBack:()=>void }) {
  const [entries, setEntries]         = useState<CoachingEntry[]>([]);
  const [customBooks, setCustomBooks] = useState<CustomBook[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [editEntry, setEditEntry]     = useState<CoachingEntry|null>(null);
  const [deleting, setDeleting]       = useState<string|null>(null);
  const [alert, setAlert]             = useState('');
  // Custom book manager UI
  const [showBookMgr, setShowBookMgr] = useState(false);
  const [newBookLabel, setNewBookLabel] = useState('');
  const [newBookIcon, setNewBookIcon]   = useState('📖');
  const [newBookColor, setNewBookColor] = useState(BOOK_COLORS[0]);
  const [savingBook, setSavingBook]   = useState(false);

  useEffect(()=>{
    const r = ref(rtdb, `coaching_homework/${coaching.id}/entries`);
    const unsub = onValue(r, snap=>{
      if (!snap.exists()) { setEntries([]); return; }
      const list: CoachingEntry[] = Object.values(snap.val()||{}).sort((a:any,b:any)=>b.date.localeCompare(a.date));
      setEntries(list);
    });
    return ()=>off(r,'value',unsub);
  },[coaching.id]);

  useEffect(()=>{
    const r = ref(rtdb, `coaching_homework/${coaching.id}/customBooks`);
    const unsub = onValue(r, snap=>{
      if (!snap.exists()) { setCustomBooks([]); return; }
      const list: CustomBook[] = Object.values(snap.val()||{});
      setCustomBooks(list);
    });
    return ()=>off(r,'value',unsub);
  },[coaching.id]);

  const addCustomBook = async () => {
    if (!newBookLabel.trim()) { setAlert('Book ka naam likho'); return; }
    setSavingBook(true);
    try {
      const id = `cb_${Date.now().toString(36)}`;
      await set(ref(rtdb, `coaching_homework/${coaching.id}/customBooks/${id}`), {
        id, label: newBookLabel.trim(), icon: newBookIcon, color: newBookColor
      });
      setNewBookLabel(''); setNewBookIcon('📖'); setNewBookColor(BOOK_COLORS[0]);
      setShowBookMgr(false);
    } catch(e:any){ setAlert(`Error: ${e?.message}`); }
    setSavingBook(false);
  };

  const deleteCustomBook = async (bookId: string) => {
    if (!confirm('Is custom book ko hata dein?')) return;
    try { await remove(ref(rtdb, `coaching_homework/${coaching.id}/customBooks/${bookId}`)); }
    catch(e:any){ setAlert(`Delete failed: ${e?.message}`); }
  };

  const deleteEntry = async (id:string) => {
    if (!confirm('Is entry ko delete karo?')) return;
    setDeleting(id);
    try { await remove(ref(rtdb, `coaching_homework/${coaching.id}/entries/${id}`)); }
    catch(e:any){ setAlert(`Delete failed: ${e?.message}`); }
    setDeleting(null);
  };

  const formatDate = (d:string) => {
    try { return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
    catch{ return d; }
  };

  // All category keys for this coaching (built-in + custom)
  const allCatKeys = [...ALL_CATS, ...customBooks.map(b => b.id)];

  const entryTotal = (e:CoachingEntry) => allCatKeys.reduce((s,c)=>{
    const d = e[c] as CategoryData | undefined;
    return s+(d?.notes?.length||0)+(d?.mcqs?.length||0)+(d?.pdfs?.length||0);
  },0);

  // Resolve label for any category key (built-in or custom)
  const catLabel = (key: string) => {
    if (CAT_META[key]) return `${CAT_META[key].icon} ${CAT_META[key].label}`;
    const cb = customBooks.find(b => b.id === key);
    return cb ? `${cb.icon} ${cb.label}` : key;
  };
  const catColor = (key: string) => CAT_META[key]?.color || customBooks.find(b=>b.id===key)?.color || '#64748b';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={16}/></button>
        <span className="text-xl">{coaching.emoji||'🏫'}</span>
        <div className="flex-1">
          <h4 className="font-black text-slate-800">{coaching.name}</h4>
          <p className="text-[10px] text-slate-400">{entries.length} entries</p>
        </div>
        <Btn small ghost onClick={()=>setShowBookMgr(v=>!v)}>📚 Books</Btn>
        <Btn onClick={()=>{setShowForm(true);setEditEntry(null);}}><Plus size={12}/> Entry Daalo</Btn>
      </div>

      {alert && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-center justify-between"><span>{alert}</span><button onClick={()=>setAlert('')}><X size={12}/></button></div>}

      {/* ─── Custom Books Manager ─── */}
      {showBookMgr && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">📚 Extra Books / Subjects</p>

          {/* Existing custom books */}
          {customBooks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customBooks.map(b => (
                <span key={b.id} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                  style={{background:`${b.color}12`, borderColor:`${b.color}40`, color:b.color}}>
                  {b.icon} {b.label}
                  <button onClick={()=>deleteCustomBook(b.id)} className="text-red-400 hover:text-red-600 ml-0.5"><X size={9}/></button>
                </span>
              ))}
            </div>
          )}

          {/* Add new book form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={newBookLabel} onChange={e=>setNewBookLabel(e.target.value)}
                placeholder="Book ka naam (e.g. Sar Sangrah Hindi, Geography Notes...)"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-400 bg-white" />
            </div>
            {/* Icon picker */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 uppercase">Icon:</span>
              {BOOK_ICONS.map(ic=>(
                <button key={ic} onClick={()=>setNewBookIcon(ic)}
                  className={`text-base w-8 h-8 rounded-lg border-2 transition-all ${newBookIcon===ic?'border-indigo-500 bg-indigo-50 scale-110':'border-slate-200 bg-white'}`}>
                  {ic}
                </button>
              ))}
            </div>
            {/* Color picker */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-slate-400 uppercase">Color:</span>
              {BOOK_COLORS.map(cl=>(
                <button key={cl} onClick={()=>setNewBookColor(cl)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newBookColor===cl?'border-slate-800 scale-125':'border-white'}`}
                  style={{background:cl}}/>
              ))}
            </div>
            {/* Preview + save */}
            <div className="flex items-center gap-2">
              {newBookLabel && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{background:`${newBookColor}18`, color:newBookColor}}>
                  {newBookIcon} {newBookLabel}
                </span>
              )}
              <Btn small onClick={addCustomBook} disabled={savingBook}>
                {savingBook?<Loader2 size={10} className="animate-spin"/>:<Plus size={10}/>} Add Book
              </Btn>
              <Btn small ghost onClick={()=>{setShowBookMgr(false);setNewBookLabel('');}}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {(showForm || editEntry) && (
        <EntryForm
          coachingId={coaching.id}
          existing={editEntry||undefined}
          customBooks={customBooks}
          onDone={()=>{setShowForm(false);setEditEntry(null);}}
          onCancel={()=>{setShowForm(false);setEditEntry(null);}}
        />
      )}

      {/* Entry list */}
      {entries.length===0 && !showForm && (
        <div className="text-center py-10 text-slate-400">
          <Calendar size={32} className="mx-auto mb-2 opacity-30"/>
          <p className="text-sm font-bold">Koi entry nahi hai</p>
          <p className="text-xs mt-1">Upar "+ Entry Daalo" tap karke shuru karo</p>
        </div>
      )}
      {entries.map(entry=>(
        <div key={entry.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Calendar size={15} className="text-indigo-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-sm">{formatDate(entry.date)}</p>
              <p className="text-[10px] text-slate-400">
                {allCatKeys.filter(c=>{const d=entry[c] as CategoryData|undefined; return d&&((d.notes?.length||0)+(d.mcqs?.length||0)+(d.pdfs?.length||0))>0;})
                  .map(c=>catLabel(c)).join(' · ')} · {entryTotal(entry)} items
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={()=>{setEditEntry(entry);setShowForm(false);}}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={13}/></button>
              <button onClick={()=>deleteEntry(entry.id)} disabled={deleting===entry.id}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                {deleting===entry.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
              </button>
            </div>
          </div>
          {/* Mini preview per category */}
          <div className="flex gap-1.5 px-4 pb-3 flex-wrap">
            {allCatKeys.map(c=>{
              const d = entry[c] as CategoryData | undefined;
              if (!d) return null;
              const total = (d.notes?.length||0)+(d.mcqs?.length||0)+(d.pdfs?.length||0);
              if (!total) return null;
              const color = catColor(c);
              return (
                <span key={c} className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{background:`${color}15`, color}}>
                  {catLabel(c)}: {total}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export: Admin Coaching Homework Manager ─────────────────────────────
export function AdminCoachingHomework({ onBack }:{ onBack:()=>void }) {
  const [coachings, setCoachings] = useState<Coaching[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Coaching|null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [newEmoji, setNewEmoji]   = useState('🏫');
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string|null>(null);
  const [alert, setAlert]         = useState('');

  useEffect(()=>{
    const r = ref(rtdb, 'coaching_homework');
    const unsub = onValue(r, snap=>{
      setLoading(false);
      if (!snap.exists()) { setCoachings([]); return; }
      const val = snap.val();
      const list: Coaching[] = Object.values(val||{})
        .map((v:any)=>({ id:v.id, name:v.name, emoji:v.emoji, createdAt:v.createdAt }))
        .sort((a:any,b:any)=>(a.createdAt||'').localeCompare(b.createdAt||''));
      setCoachings(list);
    });
    return ()=>off(r,'value',unsub);
  },[]);

  const addCoaching = async () => {
    if (!newName.trim()) { setAlert('Coaching ka naam likho'); return; }
    setSaving(true);
    try {
      const id = uid();
      await set(ref(rtdb, `coaching_homework/${id}`), {
        id, name: newName.trim(), emoji: newEmoji, createdAt: new Date().toISOString()
      });
      setNewName(''); setNewEmoji('🏫'); setShowAdd(false);
    } catch(e:any) { setAlert(`Error: ${e?.message||'Failed'}`); }
    setSaving(false);
  };

  const deleteCoaching = async (coaching:Coaching) => {
    if (!confirm(`"${coaching.name}" aur iske saare entries permanently delete ho jayenge. Sure?`)) return;
    setDeleting(coaching.id);
    try { await remove(ref(rtdb, `coaching_homework/${coaching.id}`)); }
    catch(e:any){ setAlert(`Delete failed: ${e?.message}`); }
    setDeleting(null);
  };

  // If a coaching is selected, show its entries
  if (selected) {
    return (
      <div className="space-y-4">
        <CoachingEntriesView coaching={selected} onBack={()=>setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={18}/></button>
        <div className="flex-1">
          <h3 className="text-xl font-black text-slate-800">Coaching Homework</h3>
          <p className="text-xs text-slate-400">{coachings.length} coaching{coachings.length!==1?'s':''} registered</p>
        </div>
        <Btn onClick={()=>setShowAdd(v=>!v)}><Plus size={13}/> Coaching Jodo</Btn>
      </div>

      {/* How-to info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 space-y-1">
        <strong>📖 Kaise use karein:</strong>
        <ol className="list-decimal ml-4 space-y-0.5 mt-1">
          <li>Pehle coaching ka naam add karo (e.g. "XYZ Coaching")</li>
          <li>Coaching pe click karo → "Entry Daalo" se date-wise content daalo</li>
          <li>Har category (Speedy, Sar Sangrah, Lucent, etc.) mein notes + MCQ + PDF, dono ke liye Bulk Upload bhi available hai</li>
          <li>Students ke home screen pe coaching cards automatically dikhenge</li>
        </ol>
      </div>

      {alert && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl flex items-center justify-between"><span>{alert}</span><button onClick={()=>setAlert('')}><X size={12}/></button></div>}

      {/* Add coaching form */}
      {showAdd && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 space-y-3">
          <p className="text-xs font-black text-indigo-800 uppercase tracking-wider">Naya Coaching Add Karo</p>
          <div className="space-y-2">
            <Input label="Coaching Ka Naam" value={newName} onChange={setNewName} placeholder="e.g. Param Coaching, IIC Center..." />
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Emoji</label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e=>(
                  <button key={e} onClick={()=>setNewEmoji(e)}
                    className={`text-xl w-9 h-9 rounded-xl border-2 transition-all ${newEmoji===e?'border-indigo-500 bg-indigo-100 scale-110':'border-slate-200 bg-white'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn ghost onClick={()=>{setShowAdd(false);setNewName('');setNewEmoji('🏫');}}>Cancel</Btn>
            <Btn onClick={addCoaching} disabled={saving}>
              {saving?<Loader2 size={11} className="animate-spin"/>:<Plus size={11}/>}
              {saving?'Adding...':'Coaching Jodo'}
            </Btn>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-400"/></div>
      )}

      {/* Coaching list */}
      {!loading && coachings.length===0 && !showAdd && (
        <div className="text-center py-16 text-slate-400">
          <School size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="font-bold text-sm">Koi coaching nahi hai</p>
          <p className="text-xs mt-1">Upar "+ Coaching Jodo" tap karke shuru karo</p>
        </div>
      )}

      <div className="space-y-3">
        {coachings.map(coaching=>(
          <div key={coaching.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 px-4 py-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">
              {coaching.emoji||'🏫'}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>setSelected(coaching)}>
              <p className="font-black text-slate-800 text-sm truncate">{coaching.name}</p>
              <p className="text-[10px] text-slate-400">Entries manage karne ke liye tap karo</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Btn small onClick={()=>setSelected(coaching)}>Manage</Btn>
              <button onClick={()=>deleteCoaching(coaching)} disabled={deleting===coaching.id}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                {deleting===coaching.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
