// @ts-nocheck
/**
 * CoachingManager — full school-like management panel for coaching centres.
 * Data stored in Firebase RTDB under coaching_manager/:
 *   batches/   → class / batch list
 *   students/  → student roster
 *   fees/      → monthly fee records
 *   tests/     → tests with per-student marks
 */
import React, { useState, useMemo, useEffect } from 'react';
import { ref, onValue, off, update } from 'firebase/database';
import { rtdb } from '../firebase';
import {
  ArrowLeft, Plus, Trash2, Save, Users, IndianRupee,
  ClipboardList, School, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Pencil, X, FileText, Download,
  BarChart2, Search, AlertCircle, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CoachingBatch {
  id: string;
  name: string;          // e.g. "Class 10 – A", "SSC Batch 2025"
  section?: string;
  monthlyFee: number;
  createdAt: string;
}

export interface CoachingStudent {
  id: string;
  name: string;
  batchId: string;
  rollNo: string;
  fatherName?: string;
  phone?: string;
  monthlyFee: number;   // can override batch default
  admissionDate?: string;
}

export interface CoachingFeeRecord {
  id: string;           // `${studentId}_${month}`
  studentId: string;
  month: string;        // YYYY-MM
  amount: number;
  paid: boolean;
  paidDate?: string;
  receiptNo?: string;
  note?: string;
}

export interface CoachingTestResult {
  studentId: string;
  marks: number | null;
  absent?: boolean;
}

export interface CoachingTest {
  id: string;
  testNo: string;       // e.g. "Test 1", "T-05"
  title: string;
  subject?: string;
  date: string;         // YYYY-MM-DD
  batchId: string;
  maxMarks: number;
  results: CoachingTestResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const todayStr = () => new Date().toISOString().slice(0, 10);

const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmtMonth = (m: string) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mo) - 1]} ${y}`;
};

const grade = (marks: number | null, max: number) => {
  if (marks === null || marks === undefined) return '—';
  const pct = (marks / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
};

const gradeColor = (g: string) => {
  if (g === 'A+') return 'text-emerald-700 bg-emerald-50';
  if (g === 'A')  return 'text-green-700 bg-green-50';
  if (g === 'B+'||g === 'B') return 'text-blue-700 bg-blue-50';
  if (g === 'C')  return 'text-yellow-700 bg-yellow-50';
  if (g === 'D')  return 'text-orange-700 bg-orange-50';
  if (g === 'F')  return 'text-red-700 bg-red-50';
  return 'text-slate-500 bg-slate-50';
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void;
}

type Tab = 'BATCHES' | 'STUDENTS' | 'FEES' | 'TESTS';

// Firebase base path
const FB = 'coaching_manager';

// ─── Main Component ───────────────────────────────────────────────────────────
export const CoachingManager: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('BATCHES');

  // Live data from Firebase RTDB
  const [batches,  setBatches]  = useState<CoachingBatch[]>([]);
  const [students, setStudents] = useState<CoachingStudent[]>([]);
  const [fees,     setFees]     = useState<CoachingFeeRecord[]>([]);
  const [tests,    setTests]    = useState<CoachingTest[]>([]);

  useEffect(() => {
    const listeners: Array<() => void> = [];
    const sub = (path: string, setter: (v: any[]) => void) => {
      const r = ref(rtdb, `${FB}/${path}`);
      const unsub = onValue(r, snap => {
        setter(snap.exists() ? Object.values(snap.val() || {}) : []);
      });
      listeners.push(() => off(r, 'value', unsub));
    };
    sub('batches',  setBatches);
    sub('students', setStudents);
    sub('fees',     setFees);
    sub('tests',    setTests);
    return () => listeners.forEach(fn => fn());
  }, []);

  /**
   * save(patch) — accepts an object with any subset of the 4 collection keys.
   * Diffs against current Firebase state and writes only the changes (add/update/delete).
   * All changes go through a single atomic RTDB multi-path update.
   */
  const save = (patch: {
    coachingBatches?:  CoachingBatch[];
    coachingStudents?: CoachingStudent[];
    coachingFees?:     CoachingFeeRecord[];
    coachingTests?:    CoachingTest[];
  }) => {
    const updates: Record<string, any> = {};

    const diff = <T extends { id: string }>(
      collection: string,
      current: T[],
      next: T[] | undefined,
    ) => {
      if (next === undefined) return;
      const nextIds = new Set(next.map(x => x.id));
      // Delete removed items
      current.filter(x => !nextIds.has(x.id)).forEach(x => {
        updates[`${FB}/${collection}/${x.id}`] = null;
      });
      // Upsert new / changed items
      next.forEach(x => {
        updates[`${FB}/${collection}/${x.id}`] = x;
      });
    };

    diff('batches',  batches,  patch.coachingBatches);
    diff('students', students, patch.coachingStudents);
    diff('fees',     fees,     patch.coachingFees);
    diff('tests',    tests,    patch.coachingTests);

    if (Object.keys(updates).length > 0) {
      update(ref(rtdb), updates).catch(e => console.error('[CoachingManager] Firebase save error', e));
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'BATCHES',  label: 'Classes',  icon: <School size={16} /> },
    { id: 'STUDENTS', label: 'Students', icon: <Users size={16} /> },
    { id: 'FEES',     label: 'Fees',     icon: <IndianRupee size={16} /> },
    { id: 'TESTS',    label: 'Tests',    icon: <ClipboardList size={16} /> },
  ];

  return (
    <div className="space-y-4 animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        {onBack && (
          <button onClick={onBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h3 className="text-xl font-black text-slate-800">🏫 Coaching Manager</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Students, fee collection, test results — sab ek jagah
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-[11px] font-bold text-slate-500">
          <span className="bg-slate-100 px-2 py-1 rounded-lg">{batches.length} Classes</span>
          <span className="bg-slate-100 px-2 py-1 rounded-lg">{students.length} Students</span>
          <span className="bg-slate-100 px-2 py-1 rounded-lg">{tests.length} Tests</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-black transition-all
              ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'BATCHES'  && <BatchesTab  batches={batches} students={students} fees={fees} tests={tests} save={save} />}
      {tab === 'STUDENTS' && <StudentsTab batches={batches} students={students} save={save} />}
      {tab === 'FEES'     && <FeesTab     batches={batches} students={students} fees={fees} save={save} />}
      {tab === 'TESTS'    && <TestsTab    batches={batches} students={students} tests={tests} save={save} />}
    </div>
  );
};

// ─── Batches Tab ──────────────────────────────────────────────────────────────
const BatchesTab: React.FC<{
  batches: CoachingBatch[];
  students: CoachingStudent[];
  fees: CoachingFeeRecord[];
  tests: CoachingTest[];
  save: (p: any) => void;
}> = ({ batches, students, fees, tests, save }) => {
  const blank = { name: '', section: '', monthlyFee: 500 };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const countStudents = (bId: string) => students.filter(s => s.batchId === bId).length;

  const handleSave = () => {
    if (!form.name.trim()) return alert('Class/Batch naam zaroor daalein.');
    if (editId) {
      save({ coachingBatches: batches.map(b => b.id === editId ? { ...b, ...form } : b) });
      setEditId(null);
    } else {
      const entry: CoachingBatch = {
        id: uid(), name: form.name.trim(), section: form.section?.trim() || undefined,
        monthlyFee: Number(form.monthlyFee) || 0, createdAt: todayStr(),
      };
      save({ coachingBatches: [...batches, entry] });
    }
    setForm(blank);
  };

  const startEdit = (b: CoachingBatch) => {
    setEditId(b.id);
    setForm({ name: b.name, section: b.section || '', monthlyFee: b.monthlyFee });
  };

  const handleDelete = (id: string) => {
    const cnt = countStudents(id);
    if (cnt > 0 && !confirm(`Is class mein ${cnt} students hain. Delete karne par students, fees aur tests bhi hata diye jayenge. Pakka?`)) return;
    // Collect student IDs belonging to this batch so we can cascade
    const orphanStudentIds = new Set(students.filter(s => s.batchId === id).map(s => s.id));
    // Single atomic Firebase save — removes batch + all dependent records
    save({
      coachingBatches:  batches.filter(b => b.id !== id),
      coachingStudents: students.filter(s => s.batchId !== id),
      coachingFees:     fees.filter(f => !orphanStudentIds.has(f.studentId)),
      coachingTests:    tests
        .filter(t => t.batchId !== id)
        .map(t => ({ ...t, results: t.results.filter(r => !orphanStudentIds.has(r.studentId)) })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Add / Edit form */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-black text-indigo-800">
          {editId ? '✏️ Class Edit karo' : '➕ Naya Class / Batch Add karo'}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Class / Batch Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Class 10, SSC Batch A"
              className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Section (optional)</label>
            <input
              value={form.section}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
              placeholder="e.g. A, Morning, Evening"
              className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Default Monthly Fee (₹)</label>
          <input
            type="number" min={0}
            value={form.monthlyFee}
            onChange={e => setForm(f => ({ ...f, monthlyFee: Number(e.target.value) }))}
            className="w-40 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-sm hover:bg-indigo-700 flex items-center gap-1.5">
            <Save size={14} /> {editId ? 'Update' : 'Save Class'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm(blank); }}
              className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {batches.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <School size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold">Koi class/batch nahi hai abhi</p>
          <p className="text-xs mt-1">Upar form se pehla batch add karein</p>
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map(b => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <School size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm truncate">
                  {b.name} {b.section ? `— ${b.section}` : ''}
                </p>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                  {countStudents(b.id)} students · ₹{b.monthlyFee.toLocaleString('en-IN')}/month
                </p>
              </div>
              <button onClick={() => startEdit(b)}
                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(b.id)}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Students Tab ─────────────────────────────────────────────────────────────
const StudentsTab: React.FC<{
  batches: CoachingBatch[];
  students: CoachingStudent[];
  save: (p: any) => void;
}> = ({ batches, students, save }) => {
  const blankForm = () => ({
    name: '', batchId: batches[0]?.id || '', rollNo: '', fatherName: '', phone: '',
    monthlyFee: batches[0]?.monthlyFee || 500, admissionDate: todayStr(),
  });
  const [form, setForm] = useState(blankForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    let list = students;
    if (filterBatch !== 'ALL') list = list.filter(s => s.batchId === filterBatch);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || (s.phone || '').includes(q));
    }
    return list;
  }, [students, filterBatch, search]);

  const batchName = (id: string) => batches.find(b => b.id === id)?.name || id;

  const handleSave = () => {
    if (!form.name.trim()) return alert('Student ka naam daalein.');
    if (!form.batchId) return alert('Class/Batch select karein.');
    if (editId) {
      save({ coachingStudents: students.map(s => s.id === editId ? { ...s, ...form } : s) });
      setEditId(null);
    } else {
      const entry: CoachingStudent = {
        id: uid(), name: form.name.trim(), batchId: form.batchId,
        rollNo: form.rollNo.trim(), fatherName: form.fatherName?.trim() || undefined,
        phone: form.phone?.trim() || undefined, monthlyFee: Number(form.monthlyFee) || 0,
        admissionDate: form.admissionDate || todayStr(),
      };
      save({ coachingStudents: [...students, entry] });
    }
    setForm(blankForm());
    setShowForm(false);
  };

  const startEdit = (s: CoachingStudent) => {
    setEditId(s.id);
    setForm({ name: s.name, batchId: s.batchId, rollNo: s.rollNo, fatherName: s.fatherName || '',
      phone: s.phone || '', monthlyFee: s.monthlyFee, admissionDate: s.admissionDate || todayStr() });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Is student ko hata dein?')) return;
    save({ coachingStudents: students.filter(s => s.id !== id) });
  };

  const handleBatchChange = (batchId: string) => {
    const b = batches.find(x => x.id === batchId);
    setForm(f => ({ ...f, batchId, monthlyFee: b?.monthlyFee || f.monthlyFee }));
  };

  if (batches.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <AlertCircle size={32} className="mx-auto mb-2 text-amber-400" />
        <p className="text-sm font-black text-amber-700">Pehle ek Class/Batch banao</p>
        <p className="text-xs text-amber-600 mt-1">Classes tab mein jaake batch add karein</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Add button */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[160px] relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Naam / roll no / phone search..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
        </div>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
          className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white font-bold">
          <option value="ALL">All Classes</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.section ? ` — ${b.section}` : ''}</option>)}
        </select>
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(blankForm()); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-sm transition-all
            ${showForm ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add Student'}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-black text-indigo-800">{editId ? '✏️ Student Edit' : '➕ Naya Student'}</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Student Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Poora naam" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Class / Batch *</label>
              <select value={form.batchId} onChange={e => handleBatchChange(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white">
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.section ? ` — ${b.section}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Roll No</label>
              <input value={form.rollNo} onChange={e => setForm(f => ({ ...f, rollNo: e.target.value }))}
                placeholder="e.g. 01, A-01" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monthly Fee (₹)</label>
              <input type="number" min={0} value={form.monthlyFee} onChange={e => setForm(f => ({ ...f, monthlyFee: Number(e.target.value) }))}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Father's Name</label>
              <input value={form.fatherName} onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))}
                placeholder="Father ka naam" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Phone / WhatsApp</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="10-digit number" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Admission Date</label>
              <input type="date" value={form.admissionDate} onChange={e => setForm(f => ({ ...f, admissionDate: e.target.value }))}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
          <button onClick={handleSave}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-sm hover:bg-indigo-700 flex items-center gap-1.5">
            <Save size={14} /> {editId ? 'Update Student' : 'Save Student'}
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex gap-2 text-[11px] font-bold">
        <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600">{filtered.length} students shown</span>
        {filterBatch !== 'ALL' && (
          <span className="bg-indigo-100 px-3 py-1 rounded-full text-indigo-700">
            {batchName(filterBatch)}
          </span>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold">Koi student nahi mila</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Roll</th>
                <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Name</th>
                <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Class</th>
                <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Father</th>
                <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Phone</th>
                <th className="text-right px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Fee/mo</th>
                <th className="text-right px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <td className="px-3 py-2 font-bold text-slate-600 text-xs">{s.rollNo || '—'}</td>
                  <td className="px-3 py-2 font-black text-slate-800">{s.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 font-bold">{batchName(s.batchId)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.fatherName || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.phone || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-700">₹{s.monthlyFee.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => startEdit(s)} className="p-1 rounded text-indigo-500 hover:bg-indigo-50"><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1 rounded text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Fees Tab ─────────────────────────────────────────────────────────────────
const FeesTab: React.FC<{
  batches: CoachingBatch[];
  students: CoachingStudent[];
  fees: CoachingFeeRecord[];
  save: (p: any) => void;
}> = ({ batches, students, fees, save }) => {
  const [month, setMonth] = useState(currentMonthStr());
  const [filterBatch, setFilterBatch] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Filtered students
  const visibleStudents = useMemo(() => {
    let list = students;
    if (filterBatch !== 'ALL') list = list.filter(s => s.batchId === filterBatch);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q));
    }
    return list;
  }, [students, filterBatch, search]);

  // Fee record for a student/month
  const getFee = (studentId: string): CoachingFeeRecord | undefined =>
    fees.find(f => f.studentId === studentId && f.month === month);

  const updateFee = (studentId: string, patch: Partial<CoachingFeeRecord>) => {
    const student = students.find(s => s.id === studentId)!;
    const existing = getFee(studentId);
    const id = `${studentId}_${month}`;
    const updated: CoachingFeeRecord = {
      id, studentId, month, amount: student.monthlyFee,
      paid: false, ...existing, ...patch,
    };
    const newFees = fees.filter(f => !(f.studentId === studentId && f.month === month));
    save({ coachingFees: [...newFees, updated] });
  };

  const togglePaid = (studentId: string) => {
    const existing = getFee(studentId);
    const paid = !existing?.paid;
    updateFee(studentId, {
      paid,
      paidDate: paid ? todayStr() : undefined,
      receiptNo: paid && !existing?.receiptNo ? `RCP-${Date.now().toString().slice(-6)}` : existing?.receiptNo,
    });
  };

  const markAllPaid = () => {
    if (!confirm(`${visibleStudents.length} students ke liye ${fmtMonth(month)} fees paid mark karein?`)) return;
    const today = todayStr();
    const newFees = [...fees];
    for (const s of visibleStudents) {
      const id = `${s.id}_${month}`;
      const idx = newFees.findIndex(f => f.studentId === s.id && f.month === month);
      const rec: CoachingFeeRecord = {
        id, studentId: s.id, month, amount: s.monthlyFee,
        paid: true, paidDate: today,
        receiptNo: idx >= 0 && newFees[idx].receiptNo ? newFees[idx].receiptNo : `RCP-${Date.now().toString().slice(-6)}-${s.id.slice(-4)}`,
      };
      if (idx >= 0) newFees[idx] = rec;
      else newFees.push(rec);
    }
    save({ coachingFees: newFees });
  };

  const paidCount = visibleStudents.filter(s => getFee(s.id)?.paid).length;
  const unpaidCount = visibleStudents.length - paidCount;
  const totalCollected = visibleStudents.filter(s => getFee(s.id)?.paid).reduce((sum, s) => sum + s.monthlyFee, 0);
  const totalPending = visibleStudents.filter(s => !getFee(s.id)?.paid).reduce((sum, s) => sum + s.monthlyFee, 0);

  if (students.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <AlertCircle size={32} className="mx-auto mb-2 text-amber-400" />
        <p className="text-sm font-black text-amber-700">Pehle Students add karo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-black">◀</button>
        <span className="font-black text-slate-800 text-base min-w-[120px] text-center">{fmtMonth(month)}</span>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-black">▶</button>
        <div className="flex-1 min-w-[140px] relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Student search..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
        </div>
        <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
          className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white font-bold">
          <option value="ALL">All Classes</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.section ? ` — ${b.section}` : ''}</option>)}
        </select>
        <button onClick={markAllPaid}
          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-black text-xs hover:bg-emerald-700">
          ✅ Mark All Paid
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total Students', val: visibleStudents.length, color: 'bg-slate-100 text-slate-800' },
          { label: 'Paid', val: paidCount, color: 'bg-emerald-100 text-emerald-800' },
          { label: 'Pending', val: unpaidCount, color: 'bg-red-100 text-red-800' },
          { label: 'Collected', val: `₹${totalCollected.toLocaleString('en-IN')}`, color: 'bg-blue-100 text-blue-800' },
        ].map(c => (
          <div key={c.label} className={`${c.color} rounded-xl p-3 text-center`}>
            <p className="text-lg font-black">{c.val}</p>
            <p className="text-[11px] font-bold opacity-70">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all"
          style={{ width: visibleStudents.length ? `${(paidCount / visibleStudents.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Fee list */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Roll</th>
              <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Student</th>
              <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Class</th>
              <th className="text-right px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Amount</th>
              <th className="text-center px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Status</th>
              <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Paid Date</th>
              <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Receipt</th>
              <th className="text-center px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((s, i) => {
              const fee = getFee(s.id);
              const paid = fee?.paid || false;
              const batchLabel = batches.find(b => b.id === s.batchId)?.name || '';
              return (
                <tr key={s.id} className={`border-b border-slate-100 ${paid ? 'bg-emerald-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-3 py-2 text-xs font-bold text-slate-500">{s.rollNo || '—'}</td>
                  <td className="px-3 py-2 font-black text-slate-800">{s.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 font-bold">{batchLabel}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-700">₹{s.monthlyFee.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center">
                    {paid
                      ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-black px-2 py-0.5 rounded-full"><CheckCircle size={11} /> Paid</span>
                      : <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[11px] font-black px-2 py-0.5 rounded-full"><XCircle size={11} /> Due</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fee?.paidDate || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 font-mono">{fee?.receiptNo || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => togglePaid(s.id)}
                      className={`px-3 py-1 rounded-lg font-black text-[11px] transition-all
                        ${paid ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {paid ? 'Undo' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {visibleStudents.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-black text-slate-600 text-xs">Total</td>
                <td className="px-3 py-2 text-right font-black text-slate-800">
                  ₹{visibleStudents.reduce((sum, s) => sum + s.monthlyFee, 0).toLocaleString('en-IN')}
                </td>
                <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-slate-500">
                  Pending: ₹{totalPending.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ─── Tests Tab ────────────────────────────────────────────────────────────────
const TestsTab: React.FC<{
  batches: CoachingBatch[];
  students: CoachingStudent[];
  tests: CoachingTest[];
  save: (p: any) => void;
}> = ({ batches, students, tests, save }) => {
  const blankTest = () => ({
    testNo: `Test ${tests.length + 1}`,
    title: '', subject: '', date: todayStr(), batchId: batches[0]?.id || '', maxMarks: 100,
  });
  const [form, setForm] = useState(blankTest);
  const [showForm, setShowForm] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});
  const [filterBatch, setFilterBatch] = useState<string>('ALL');

  const filteredTests = useMemo(() =>
    filterBatch === 'ALL' ? tests : tests.filter(t => t.batchId === filterBatch),
    [tests, filterBatch]);

  const batchStudents = (batchId: string) => students.filter(s => s.batchId === batchId);
  const batchName = (id: string) => {
    const b = batches.find(x => x.id === id);
    return b ? `${b.name}${b.section ? ` — ${b.section}` : ''}` : id;
  };

  const handleCreateTest = () => {
    if (!form.testNo.trim()) return alert('Test number daalein.');
    if (!form.batchId) return alert('Class/Batch select karein.');
    const bStudents = batchStudents(form.batchId);
    const entry: CoachingTest = {
      id: uid(), testNo: form.testNo.trim(), title: form.title.trim(),
      subject: form.subject.trim() || undefined, date: form.date, batchId: form.batchId,
      maxMarks: Number(form.maxMarks) || 100,
      results: bStudents.map(s => ({ studentId: s.id, marks: null })),
    };
    save({ coachingTests: [...tests, entry] });
    setShowForm(false);
    setSelectedTest(entry.id);
    const draft: Record<string, string> = {};
    bStudents.forEach(s => { draft[s.id] = ''; });
    setMarksDraft(draft);
    setForm(blankTest());
  };

  const handleDeleteTest = (id: string) => {
    if (!confirm('Is test ko permanently delete karein?')) return;
    save({ coachingTests: tests.filter(t => t.id !== id) });
    if (selectedTest === id) setSelectedTest(null);
  };

  const openTest = (t: CoachingTest) => {
    setSelectedTest(t.id);
    const draft: Record<string, string> = {};
    batchStudents(t.batchId).forEach(s => {
      const r = t.results.find(r => r.studentId === s.id);
      draft[s.id] = r?.absent ? 'A' : (r?.marks !== null && r?.marks !== undefined ? String(r.marks) : '');
    });
    setMarksDraft(draft);
  };

  const saveMarks = (testId: string) => {
    const test = tests.find(t => t.id === testId)!;
    const bStudents = batchStudents(test.batchId);
    const results: CoachingTestResult[] = bStudents.map(s => {
      const val = (marksDraft[s.id] || '').trim().toUpperCase();
      if (val === 'A' || val === 'AB' || val === 'ABSENT') return { studentId: s.id, marks: null, absent: true };
      const marks = val === '' ? null : Number(val);
      return { studentId: s.id, marks: isNaN(marks as any) ? null : marks };
    });
    save({ coachingTests: tests.map(t => t.id === testId ? { ...t, results } : t) });
    alert('✅ Marks saved!');
  };

  // Stats for a test
  const testStats = (t: CoachingTest) => {
    const valid = t.results.filter(r => !r.absent && r.marks !== null);
    if (!valid.length) return null;
    const marks = valid.map(r => r.marks as number);
    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
    const max = Math.max(...marks);
    const min = Math.min(...marks);
    return { avg: avg.toFixed(1), max, min, appeared: valid.length, absent: t.results.filter(r => r.absent).length };
  };

  const activeTest = tests.find(t => t.id === selectedTest);

  if (batches.length === 0) {
    return (
      <div className="text-center py-10 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <AlertCircle size={32} className="mx-auto mb-2 text-amber-400" />
        <p className="text-sm font-black text-amber-700">Pehle Class/Batch banao</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active test — marks entry panel */}
      {activeTest && (
        <div className="bg-white border-2 border-indigo-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedTest(null)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1">
              <p className="font-black text-slate-800 text-base">
                {activeTest.testNo} {activeTest.title ? `— ${activeTest.title}` : ''}
              </p>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {batchName(activeTest.batchId)} · {activeTest.date} · Max: {activeTest.maxMarks} marks
                {activeTest.subject ? ` · ${activeTest.subject}` : ''}
              </p>
            </div>
            <button onClick={() => saveMarks(activeTest.id)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-indigo-700 flex items-center gap-1.5">
              <Save size={14} /> Save Marks
            </button>
          </div>

          {/* Stats */}
          {(() => { const st = testStats(activeTest); return st ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { l: 'Appeared', v: st.appeared, c: 'bg-blue-50 text-blue-800' },
                { l: 'Average', v: `${st.avg}/${activeTest.maxMarks}`, c: 'bg-indigo-50 text-indigo-800' },
                { l: 'Highest', v: `${st.max}/${activeTest.maxMarks}`, c: 'bg-emerald-50 text-emerald-800' },
                { l: 'Absent', v: st.absent, c: 'bg-amber-50 text-amber-800' },
              ].map(x => (
                <div key={x.l} className={`${x.c} rounded-xl p-2`}>
                  <p className="font-black text-sm">{x.v}</p>
                  <p className="text-[10px] font-bold opacity-70">{x.l}</p>
                </div>
              ))}
            </div>
          ) : null; })()}

          {/* Marks entry table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Roll</th>
                  <th className="text-left px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Student</th>
                  <th className="text-center px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Marks /{activeTest.maxMarks}</th>
                  <th className="text-center px-3 py-2 text-[11px] font-black text-slate-500 uppercase">Grade</th>
                  <th className="text-center px-3 py-2 text-[11px] font-black text-slate-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents(activeTest.batchId).map((s, i) => {
                  const raw = marksDraft[s.id] || '';
                  const isAbsent = raw.trim().toUpperCase() === 'A' || raw.trim().toUpperCase() === 'AB' || raw.trim().toUpperCase() === 'ABSENT';
                  const marks = raw.trim() === '' ? null : (isAbsent ? null : Number(raw));
                  const g = isAbsent ? 'AB' : grade(marks, activeTest.maxMarks);
                  const pct = (!isAbsent && marks !== null) ? ((marks / activeTest.maxMarks) * 100).toFixed(1) : '—';
                  return (
                    <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} ${isAbsent ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-1.5 text-xs font-bold text-slate-500">{s.rollNo || '—'}</td>
                      <td className="px-3 py-1.5 font-black text-slate-800">{s.name}</td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          value={raw}
                          onChange={e => setMarksDraft(d => ({ ...d, [s.id]: e.target.value }))}
                          placeholder="Marks / A=Absent"
                          className="w-28 text-center p-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 font-bold"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${gradeColor(g)}`}>{g}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs font-bold text-slate-600">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 font-bold">💡 Absent ke liye marks field mein "A" likhein</p>
        </div>
      )}

      {/* Tests list header */}
      {!activeTest && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
              className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white font-bold flex-1">
              <option value="ALL">All Classes</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.section ? ` — ${b.section}` : ''}</option>)}
            </select>
            <button onClick={() => { setShowForm(v => !v); setForm(blankTest()); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-sm transition-all
                ${showForm ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancel' : 'New Test'}
            </button>
          </div>

          {/* Create test form */}
          {showForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-black text-indigo-800">📝 Naya Test Create karo</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Test Number *</label>
                  <input value={form.testNo} onChange={e => setForm(f => ({ ...f, testNo: e.target.value }))}
                    placeholder="e.g. Test 1, T-05" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Title (optional)</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Chapter 1 Test" className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Math, Science..." className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Class / Batch *</label>
                  <select value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white">
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}{b.section ? ` — ${b.section}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Max Marks</label>
                  <input type="number" min={1} value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
              <button onClick={handleCreateTest}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-sm hover:bg-indigo-700 flex items-center gap-1.5">
                <Plus size={14} /> Create Test
              </button>
            </div>
          )}

          {/* Tests list */}
          {filteredTests.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">Koi test nahi mila</p>
              <p className="text-xs mt-1">Upar "New Test" se create karein</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...filteredTests].reverse().map(t => {
                const st = testStats(t);
                const bStuds = batchStudents(t.batchId);
                const enteredCount = t.results.filter(r => r.marks !== null || r.absent).length;
                return (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700 font-black text-xs">
                        {t.testNo.replace(/[^0-9]/g, '') || '#'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-sm truncate">
                          {t.testNo} {t.title ? `— ${t.title}` : ''}
                          {t.subject ? <span className="ml-1.5 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t.subject}</span> : null}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                          {batchName(t.batchId)} · {t.date} · Max: {t.maxMarks}
                          {st ? ` · Avg: ${st.avg}` : ''}
                          {bStuds.length > 0 ? ` · ${enteredCount}/${bStuds.length} entered` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openTest(t)}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-black text-xs hover:bg-indigo-700 flex items-center gap-1">
                          <Pencil size={12} /> Marks
                        </button>
                        <button onClick={() => handleDeleteTest(t.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Mini result bar */}
                    {st && bStuds.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {batchStudents(t.batchId).map(s => {
                          const r = t.results.find(r => r.studentId === s.id);
                          const g = r?.absent ? 'AB' : grade(r?.marks ?? null, t.maxMarks);
                          return (
                            <span key={s.id} title={`${s.name}: ${r?.absent ? 'Absent' : (r?.marks ?? '—')}/${t.maxMarks}`}
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded cursor-default ${gradeColor(g)}`}>
                              {g}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
