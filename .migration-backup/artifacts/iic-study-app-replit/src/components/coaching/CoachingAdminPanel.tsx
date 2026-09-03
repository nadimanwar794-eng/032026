// @ts-nocheck
/**
 * CoachingAdminPanel — Panel for coaching centre admins.
 * Integrates both CoachingManager (batches/students/fees/tests)
 * and CoachingHomework (daily homework entries) under one roof.
 * Data is scoped to the coaching centre's ID so multi-tenancy is maintained.
 */
import React, { useState, useEffect } from "react";
import { ref, onValue, off, update, set, push, remove } from "firebase/database";
import { rtdb } from "../../firebase";
import { subscribeToCoaching } from "../../coaching-firebase";
import type { CoachingCentre } from "../../coaching-types";
import {
  ArrowLeft, Users, IndianRupee, ClipboardList, BookOpen,
  Plus, Trash2, Save, ChevronDown, ChevronUp, CheckCircle,
  XCircle, Pencil, X, FileText, Download, BarChart2, Search,
  AlertCircle, HelpCircle, Calendar, Loader2, Edit3, School,
  Settings, RefreshCw, CalendarDays
} from "lucide-react";
import type {
  CoachingBatch, CoachingStudent, CoachingFeeRecord, CoachingTest
} from "../CoachingManager";
import type { CoachingSession } from "../../coaching-types";

// ─── Types for Homework ───────────────────────────────────────────────────────
interface CoachingNote { id: string; title: string; content?: string; pageNo?: string; }
interface CoachingMcq {
  id: string; question: string; options: string[];
  correctAnswer?: number; correctAnswers?: number[]; explanation?: string;
}
interface CoachingPdf { id: string; title: string; url: string; }
interface CategoryData { notes?: CoachingNote[]; mcqs?: CoachingMcq[]; pdfs?: CoachingPdf[]; }
interface CoachingEntry {
  id: string; date: string;
  speedyScience?: CategoryData; speedySocialScience?: CategoryData;
  sarSangrah?: CategoryData; lucent?: CategoryData; mcq?: CategoryData;
  current_affairs?: CategoryData;
  [key: string]: CategoryData | string | undefined;
}
interface CustomBook { id: string; label: string; icon: string; color: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; icon: string; color: string }> = {
  speedyScience:       { label: "Speedy Science",       icon: "🧪", color: "#10b981" },
  speedySocialScience: { label: "Speedy Social Science", icon: "🌍", color: "#f59e0b" },
  sarSangrah:          { label: "Sar Sangrah",           icon: "📕", color: "#ef4444" },
  lucent:              { label: "Lucent",                icon: "🌟", color: "#8b5cf6" },
  mcq:                 { label: "MCQ Practice",          icon: "🧠", color: "#3b82f6" },
  current_affairs:     { label: "Current Affairs",       icon: "📰", color: "#0ea5e9" },
};
const ALL_CATS = Object.keys(CAT_META);

/** Parse bulk-pasted MCQs. Supports THREE styles:
 *  Style 1 (star):     Q: ...  A: ...  *B: ...(correct)  C: ...  Exp: ...
 *  Style 2 (exam):      Q1. ... A) ... *B) ...(correct)  Ans: B) ...  Explanation: ...
 *  Style 3 (WhatsApp/Telegram bold, Hindi — auto-strips ** markdown):
 *    **प्रश्न 1:** [⚡] Question text?
 *    A) Option 1
 *    B) Option 2
 *    **सही उत्तर:** B) Option 2
 *  Multi-line/statement-based questions ("consider the following statements")
 *  are supported — continuation lines before the options are appended to the question.
 *  Blocks separated by blank lines or a `---` divider. */
function parseBulkMcq(text: string): CoachingMcq[] {
  const blocks = text.split(/\n(?:\s*-{3,}\s*|\s*)\n/).map(b => b.trim()).filter(Boolean);
  const out: CoachingMcq[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    let question = "";
    const options: string[] = ["", "", "", ""];
    let optionCount = 0;
    let explanation = "";
    let ansLetter = "";
    let collectingExp = false;
    let optionsStarted = false;

    for (const rawLine of lines) {
      // Strip markdown bold (**) — handles WhatsApp/Telegram/AI-formatted MCQs
      const line = rawLine.replace(/\*\*/g, "").trim();
      if (!line) continue;

      // Question: Q: / Q1. / Q1) / प्रश्न 1:
      const qMatch = line.match(/^(?:\*?\s*)?(?:Q\s*\d*\s*[:.)\s]|प्रश्न\s*\d*\s*[:.]\s*)\s*(.+)/i);
      if (qMatch) {
        question = qMatch[1].trim().replace(/^\[[^\]]*\]\s*/, "");
        collectingExp = false;
        continue;
      }

      // Explanation / Exp: / व्याख्या:
      const expMatch = line.match(/^(?:Exp|Explanation|व्याख्या)[:.]\s*(.*)/i);
      if (expMatch) { explanation = expMatch[1].trim(); collectingExp = true; continue; }
      if (collectingExp && !/^[*]?[A-Da-d][:.)]/.test(line) && !/^(?:Ans|Answer|सही)/i.test(line)) {
        explanation += (explanation ? " " : "") + line;
        continue;
      }

      // Ans: / Answer: / सही उत्तर: B or B) or B) text
      const ansMatch = line.match(/^(?:Ans|Answer|सही\s*उत्तर)\s*[:.]\s*\*?\s*([A-Da-d])/i);
      if (ansMatch) { ansLetter = ansMatch[1].toUpperCase(); collectingExp = false; continue; }

      // Options: *A: text OR *A) text OR A: text OR A) text
      const optMatch = line.match(/^(\*?)\s*([A-Da-d])[:.)\s]\s*(.+)/);
      if (optMatch) {
        const letterIdx = "ABCD".indexOf(optMatch[2].toUpperCase());
        if (letterIdx >= 0) {
          options[letterIdx] = optMatch[3].trim();
          optionCount++;
          if (optMatch[1] === "*") ansLetter = optMatch[2].toUpperCase();
        }
        optionsStarted = true;
        collectingExp = false;
        continue;
      }

      // First unrecognized line = question fallback.
      if (!question) { question = line; continue; }

      // Continuation lines of a multi-line/statement-based question — append
      // them to the question as long as options haven't started yet.
      if (!optionsStarted && !collectingExp) {
        question += (/[:?]$/.test(question) ? "\n" : " ") + line;
      }
    }
    const correctAnswer = ansLetter ? Math.max(0, "ABCD".indexOf(ansLetter)) : 0;
    if (question && optionCount >= 2) {
      // NOTE: never write `explanation: undefined` — Firebase RTDB's set() throws
      // on any undefined property, which silently breaks "Save Entry" once MCQs
      // (parsed without an explanation) are added to the entry.
      const mcq: CoachingMcq = { id: uidGen(), question, options, correctAnswer };
      if (explanation) mcq.explanation = explanation;
      out.push(mcq);
    }
  }
  return out;
}

/** Recursively strip `undefined` values — Firebase RTDB's set()/update() throw
 * if any nested property is undefined, which otherwise fails silently (the
 * save promise rejects and the UI just looks like nothing happened). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return (value.map(stripUndefined) as unknown) as T;
  }
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

const uidGen = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmtMonth = (m: string) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
};
const grade = (marks: number | null, max: number) => {
  if (marks == null) return "—";
  const p = (marks / max) * 100;
  if (p >= 90) return "A+"; if (p >= 80) return "A"; if (p >= 70) return "B+";
  if (p >= 60) return "B";  if (p >= 50) return "C"; if (p >= 33) return "D";
  return "F";
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Btn({ onClick, children, danger = false, small = false, ghost = false, disabled = false, style }: any) {
  const base = `inline-flex items-center gap-1.5 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 ${small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`;
  const cls = ghost
    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
    : danger
    ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
    : "bg-indigo-600 text-white hover:bg-indigo-700";
  return <button type="button" disabled={disabled} onClick={onClick} style={style} className={`${base} ${style ? "" : cls}`}>{children}</button>;
}

function Inp({ label, value, onChange, placeholder = "", multiline = false, small = false }: any) {
  const cls = `w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white ${small ? "text-xs" : ""}`;
  return (
    <div>
      {label && <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls + " resize-none"} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
type MainTab = "DASHBOARD" | "HOMEWORK" | "BATCHES" | "STUDENTS" | "FEES" | "TESTS" | "SESSIONS";

interface Props {
  coachingId: string;
  adminUid: string;
  adminName: string;
  role: "COACHING_ADMIN" | "COACHING_SUB_ADMIN";
  onBack?: () => void;
}

export const CoachingAdminPanel: React.FC<Props> = ({
  coachingId, adminUid, adminName, role, onBack,
}) => {
  const [coaching, setCoaching] = useState<CoachingCentre | null>(null);
  const [tab, setTab] = useState<MainTab>("DASHBOARD");

  // Sessions
  const [sessions, setSessions]             = useState<CoachingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Manager data
  const [batches, setBatches]   = useState<CoachingBatch[]>([]);
  const [students, setStudents] = useState<CoachingStudent[]>([]);
  const [fees, setFees]         = useState<CoachingFeeRecord[]>([]);
  const [tests, setTests]       = useState<CoachingTest[]>([]);

  // Homework data
  const [entries, setEntries]       = useState<CoachingEntry[]>([]);
  const [customBooks, setCustomBooks] = useState<CustomBook[]>([]);
  const [hwLoading, setHwLoading]   = useState(true);

  // Access check: null = still loading, false = blocked, true = allowed
  const [accessOk, setAccessOk] = useState<boolean | null>(null);
  const [blockReason, setBlockReason] = useState<"subscription" | "locked" | null>(null);

  useEffect(() => {
    const unsub = subscribeToCoaching(coachingId, c => {
      setCoaching(c);
      if (c) {
        if (c.locked) {
          setAccessOk(false);
          setBlockReason("locked");
        } else {
          const sub = c.subscription;
          const isOk = sub.status === "active" &&
            (!sub.paidUntil || new Date(sub.paidUntil) >= new Date());
          setAccessOk(isOk);
          setBlockReason(isOk ? null : "subscription");
        }
      }
    });
    return unsub;
  }, [coachingId]);

  // Manager RTDB — only mount listeners when access is confirmed
  const FB = `coaching_manager/${coachingId}`;
  useEffect(() => {
    if (accessOk !== true) return;
    const listeners: Array<() => void> = [];
    const sub = (path: string, setter: (v: any[]) => void) => {
      const r = ref(rtdb, `${FB}/${path}`);
      const unsub = onValue(r, snap => {
        setter(snap.exists() ? Object.values(snap.val() || {}) : []);
      });
      listeners.push(() => off(r, "value", unsub));
    };
    sub("batches",  setBatches);
    sub("students", setStudents);
    sub("fees",     setFees);
    sub("tests",    setTests);

    // Sessions listener
    const rSessions = ref(rtdb, `${FB}/sessions`);
    const uSessions = onValue(rSessions, snap => {
      const list: CoachingSession[] = snap.exists() ? Object.values(snap.val() || {}) : [];
      setSessions(list.sort((a: CoachingSession, b: CoachingSession) => b.name.localeCompare(a.name)));
      // Auto-select active session if none selected
      setSelectedSessionId(prev => {
        if (prev) return prev;
        const active = list.find((s: CoachingSession) => s.active);
        return active ? active.id : (list[0]?.id || "");
      });
    });
    listeners.push(() => off(rSessions, "value", uSessions));

    return () => listeners.forEach(fn => fn());
  }, [coachingId, accessOk]);

  // Homework RTDB — only mount listeners when access is confirmed
  const [disabledCats, setDisabledCats] = useState<string[]>([]);
  useEffect(() => {
    if (accessOk !== true) return; // block data access when not authorized
    setHwLoading(true);
    const rEntries  = ref(rtdb, `coaching_homework/${coachingId}/entries`);
    const rBooks    = ref(rtdb, `coaching_homework/${coachingId}/customBooks`);
    const rSettings = ref(rtdb, `coaching_homework/${coachingId}/settings`);
    const u1 = onValue(rEntries, snap => {
      setEntries(snap.exists() ? Object.values(snap.val() || {}) : []);
      setHwLoading(false);
    });
    const u2 = onValue(rBooks, snap => {
      setCustomBooks(snap.exists() ? Object.values(snap.val() || {}) : []);
    });
    const u3 = onValue(rSettings, snap => {
      const data = snap.val() || {};
      // disabledCats stored as object { catKey: true }
      setDisabledCats(Object.keys(data.disabledCats || {}));
    });
    return () => {
      off(rEntries,  "value", u1);
      off(rBooks,    "value", u2);
      off(rSettings, "value", u3);
    };
  }, [coachingId, accessOk]);

  // Still loading coaching metadata
  if (!coaching || accessOk === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Access blocked (subscription expired or coaching locked)
  if (accessOk === false) {
    const isLocked = blockReason === "locked";
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isLocked ? "bg-slate-50" : "bg-red-50"}`}>
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">{isLocked ? "🔐" : "🔒"}</div>
          <h2 className="text-xl font-black text-slate-800">
            {isLocked ? "Coaching Locked Hai" : "Subscription Expire Ho Gayi"}
          </h2>
          <p className="text-sm text-slate-500">
            {isLocked
              ? "Is coaching ko super admin ne lock kar diya hai. Unse contact karo."
              : "Aapki coaching ka subscription expire ho gaya hai. Super admin se renew karwao (Weekly ₹200 / Monthly ₹500 / 3-Monthly ₹1400 / Yearly ₹5000)."}
          </p>
          {onBack && (
            <button onClick={onBack} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl">
              Wapas Jao
            </button>
          )}
        </div>
      </div>
    );
  }

  const tabConfig: { id: MainTab; label: string; icon: any; }[] = [
    { id: "DASHBOARD",  label: "Home",     icon: School },
    { id: "HOMEWORK",   label: "Homework", icon: BookOpen },
    { id: "BATCHES",    label: "Batches",  icon: Users },
    { id: "STUDENTS",   label: "Students", icon: Users },
    { id: "FEES",       label: "Fees",     icon: IndianRupee },
    { id: "TESTS",      label: "Tests",    icon: ClipboardList },
    { id: "SESSIONS",   label: "Sessions", icon: CalendarDays },
  ];

  // Filtered data by selected session
  const filteredBatches  = batches.filter(b  => !selectedSessionId || (b as any).sessionId === selectedSessionId);
  const filteredStudents = students.filter(s => !selectedSessionId || (s as any).sessionId === selectedSessionId);
  const filteredFees     = fees.filter(f    => !selectedSessionId || (f as any).sessionId === selectedSessionId);
  const filteredTests    = tests.filter(t   => !selectedSessionId || (t as any).sessionId === selectedSessionId);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200">
              <ArrowLeft size={18} className="text-slate-600" />
            </button>
          )}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: (coaching.bannerColor || "#6366f1") + "20" }}
          >
            {coaching.emoji || "🏫"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-slate-800 text-base leading-tight truncate">{coaching.name}</h1>
            <p className="text-[10px] text-slate-400">{role === "COACHING_ADMIN" ? "Admin" : "Sub Admin"} • {adminName}</p>
          </div>
          {/* Session selector */}
          {sessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:border-indigo-400 bg-white text-slate-700 max-w-[120px]"
            >
              <option value="">All Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tab scroll */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {tabConfig.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                tab === t.id
                  ? "text-white shadow-sm"
                  : "bg-slate-100 text-slate-500"
              }`}
              style={tab === t.id ? { background: coaching.bannerColor || "#6366f1" } : {}}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {tab === "DASHBOARD"  && <Dashboard coaching={coaching} batches={filteredBatches} students={filteredStudents} fees={filteredFees} entries={entries} />}
        {tab === "HOMEWORK"   && <HomeworkTab coachingId={coachingId} entries={entries} customBooks={customBooks} disabledCats={disabledCats} hwLoading={hwLoading} />}
        {tab === "BATCHES"    && <BatchesTab  coachingId={coachingId} batches={filteredBatches} FB={FB} sessionId={selectedSessionId} />}
        {tab === "STUDENTS"   && <StudentsTab coachingId={coachingId} students={filteredStudents} batches={filteredBatches} FB={FB} sessionId={selectedSessionId} />}
        {tab === "FEES"       && <FeesTab     coachingId={coachingId} fees={filteredFees} students={filteredStudents} batches={filteredBatches} FB={FB} sessionId={selectedSessionId} />}
        {tab === "TESTS"      && <TestsTab    coachingId={coachingId} tests={filteredTests} students={filteredStudents} batches={filteredBatches} FB={FB} sessionId={selectedSessionId} />}
        {tab === "SESSIONS"   && <SessionsTab coachingId={coachingId} sessions={sessions} FB={FB} selectedSessionId={selectedSessionId} onSelectSession={setSelectedSessionId} />}
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ coaching, batches, students, fees, entries }: any) {
  const thisMonth = currentMonthStr();
  const collected = fees.filter((f: any) => f.paid && f.month === thisMonth).reduce((a: number, f: any) => a + (f.amount || 0), 0);
  const pending   = fees.filter((f: any) => !f.paid && f.month === thisMonth).length;
  const recentEntries = [...entries].sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Batches",   value: batches.length,  icon: "🏫" },
          { label: "Students",  value: students.length, icon: "👨‍🎓" },
          { label: "Collected", value: `₹${collected.toLocaleString()}`, icon: "💰" },
          { label: "Fee Pending", value: pending, icon: "⚠️" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-black text-slate-800 text-lg leading-tight">{s.value}</p>
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent homework */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <h3 className="font-black text-slate-700 text-sm mb-3">📚 Recent Homework Entries</h3>
        {recentEntries.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Abhi koi entry nahi hai</p>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((e: any) => {
              const cats = ALL_CATS.filter(k => e[k] && (e[k].notes?.length || e[k].mcqs?.length));
              return (
                <div key={e.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <Calendar size={14} className="text-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">{e.date}</p>
                    <p className="text-[10px] text-slate-400 truncate">{cats.map(k => CAT_META[k]?.label || k).join(" · ")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Homework Tab ─────────────────────────────────────────────────────────────
function HomeworkTab({ coachingId, entries, customBooks, disabledCats, hwLoading }: any) {
  const [showForm, setShowForm]         = useState(false);
  const [showSubjectMgr, setShowSubjectMgr] = useState(false);
  const [editEntry, setEditEntry]       = useState<CoachingEntry | null>(null);
  const [date, setDate]                 = useState(todayStr);
  const [catData, setCatData]           = useState<Record<string, CategoryData>>({});
  const [openCats, setOpenCats]         = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen]         = useState<Record<string, boolean>>({});
  const [bulkText, setBulkText]         = useState<Record<string, string>>({});
  const [bulkError, setBulkError]       = useState<Record<string, string>>({});

  // Custom book management
  const [showBookForm, setShowBookForm] = useState(false);
  const [newBookLabel, setNewBookLabel] = useState("");
  const [newBookIcon,  setNewBookIcon]  = useState("📖");
  const [bookSaving,   setBookSaving]   = useState(false);

  const disabled = new Set<string>(disabledCats || []);
  const allCats  = [
    ...ALL_CATS.filter(k => !disabled.has(k)),
    ...customBooks.map((b: CustomBook) => b.id),
  ];
  const getCatMeta = (k: string) => {
    if (CAT_META[k]) return CAT_META[k];
    const cb = customBooks.find((b: CustomBook) => b.id === k);
    return cb ? { label: cb.label, icon: cb.icon, color: cb.color } : { label: k, icon: "📖", color: "#6366f1" };
  };

  const openForm = (existing?: CoachingEntry) => {
    if (existing) {
      setEditEntry(existing);
      setDate(existing.date);
      const cd: Record<string, CategoryData> = {};
      allCats.forEach(k => { if (existing[k]) cd[k] = existing[k] as CategoryData; });
      setCatData(cd);
    } else {
      setEditEntry(null);
      setDate(todayStr());
      setCatData({});
    }
    setOpenCats(new Set());
    setShowForm(true);
  };

  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      const entryId = editEntry?.id || uidGen();
      const data: any = { id: entryId, date };
      allCats.forEach(k => { if (catData[k]) data[k] = catData[k]; });
      await set(ref(rtdb, `coaching_homework/${coachingId}/entries/${entryId}`), stripUndefined(data));
      setShowForm(false);
    } catch (err: any) {
      setSaveError(err?.message || "Save fail hua — dobara try karein");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Entry delete karein?")) return;
    await remove(ref(rtdb, `coaching_homework/${coachingId}/entries/${id}`));
  };

  const addCustomBook = async () => {
    if (!newBookLabel.trim()) return;
    setBookSaving(true);
    try {
      const id = "custom_" + uidGen();
      await set(ref(rtdb, `coaching_homework/${coachingId}/customBooks/${id}`), {
        id, label: newBookLabel.trim(), icon: newBookIcon, color: "#6366f1",
      });
      setNewBookLabel(""); setNewBookIcon("📖"); setShowBookForm(false);
    } finally { setBookSaving(false); }
  };

  const removeCustomBook = async (id: string) => {
    await remove(ref(rtdb, `coaching_homework/${coachingId}/customBooks/${id}`));
  };

  const toggleCat = (k: string) =>
    setOpenCats(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const updateCatNotes = (k: string, notes: CoachingNote[]) =>
    setCatData(p => ({ ...p, [k]: { ...(p[k] || {}), notes } }));
  const updateCatMcqs = (k: string, mcqs: CoachingMcq[]) =>
    setCatData(p => ({ ...p, [k]: { ...(p[k] || {}), mcqs } }));

  const sortedEntries = [...entries].sort((a: any, b: any) => b.date.localeCompare(a.date));

  // ── Entry Form ──
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowForm(false)} className="p-2 bg-slate-100 rounded-xl">
            <ArrowLeft size={16} className="text-slate-600" />
          </button>
          <h2 className="font-black text-slate-800">{editEntry ? "Entry Edit" : "Nayi Entry"}</h2>
        </div>

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">DATE</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        {/* Categories */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">CATEGORIES</p>
          {allCats.map(k => {
            const meta = getCatMeta(k);
            const open = openCats.has(k);
            const noteCount = catData[k]?.notes?.length || 0;
            const mcqCount  = catData[k]?.mcqs?.length  || 0;
            const total = noteCount + mcqCount;
            return (
              <div key={k} className="border rounded-xl overflow-hidden" style={{ borderColor: `${meta.color}30` }}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                  style={{ background: `${meta.color}08` }}
                  onClick={() => toggleCat(k)}
                >
                  <span>{meta.icon}</span>
                  <span className="flex-1 text-xs font-bold text-slate-700">{meta.label}</span>
                  {total > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: meta.color }}>
                      {total} items
                    </span>
                  )}
                  {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-2 space-y-3" style={{ background: `${meta.color}04` }}>
                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Notes</span>
                        <Btn small onClick={() => updateCatNotes(k, [...(catData[k]?.notes || []), { id: uidGen(), title: "", content: "", pageNo: "" }])}>
                          <Plus size={10} /> Add Note
                        </Btn>
                      </div>
                      {(catData[k]?.notes || []).map((n: CoachingNote, i: number) => (
                        <div key={n.id} className="grid grid-cols-3 gap-1.5 mb-1.5">
                          <input value={n.pageNo || ""} onChange={e => {
                            const notes = [...(catData[k]?.notes || [])];
                            notes[i] = { ...n, pageNo: e.target.value };
                            updateCatNotes(k, notes);
                          }} placeholder="Page" className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-300" />
                          <input value={n.title} onChange={e => {
                            const notes = [...(catData[k]?.notes || [])];
                            notes[i] = { ...n, title: e.target.value };
                            updateCatNotes(k, notes);
                          }} placeholder="Title" className="col-span-2 border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-300" />
                          <textarea value={n.content || ""} onChange={e => {
                            const notes = [...(catData[k]?.notes || [])];
                            notes[i] = { ...n, content: e.target.value };
                            updateCatNotes(k, notes);
                          }} placeholder="Content (optional)" rows={2}
                            className="col-span-2 border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-300 resize-none" />
                          <button onClick={() => updateCatNotes(k, (catData[k]?.notes || []).filter(x => x.id !== n.id))}
                            className="text-red-400 hover:text-red-600 flex items-center justify-center">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* MCQs */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5 gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase">MCQs</span>
                        <div className="flex gap-1.5">
                          <Btn small ghost onClick={() => {
                            setBulkOpen(p => ({ ...p, [k]: !p[k] }));
                            setBulkError(p => ({ ...p, [k]: "" }));
                          }} style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}08` }}>
                            📋 Bulk Upload
                          </Btn>
                          <Btn small onClick={() => updateCatMcqs(k, [...(catData[k]?.mcqs || []), {
                            id: uidGen(), question: "", options: ["", "", "", ""], correctAnswer: 0,
                          }])}>
                            <Plus size={10} /> Add MCQ
                          </Btn>
                        </div>
                      </div>
                      {bulkOpen[k] && (
                        <div className="border rounded-xl p-3 space-y-2 bg-slate-50 mb-2" style={{ borderColor: `${meta.color}30` }}>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📋 Bulk MCQ — Teen Format Supported:</p>
                          <pre className="text-[9px] text-slate-400 bg-white border border-slate-200 rounded-lg p-2 leading-relaxed whitespace-pre-wrap font-mono">{`Style 1 (star):          Style 2 (exam):
Q: Question text?        Q1. Question text?
A: Option 1              A) Option 1
*B: Sahi jawab ← star   *B) Sahi jawab ← star
C: Option 3              C) Option 3
Exp: Explanation         Ans: B) Option 2
                         Explanation: text

Style 3 (WhatsApp/AI bold — ** auto strip):
**प्रश्न 1:** [⚡] Question text?
A) Option 1
B) Sahi jawab
C) Option 3
D) Option 4
**सही उत्तर:** B) Sahi jawab`}</pre>
                          <p className="text-[9px] text-slate-400">💡 Style 3 mein <b>**</b> aur <b>[⚡]</b> tags automatically hata diye jaate hain • "Consider the following statements" jaise multi-line questions bhi supported hain • Sahi option ke aage <b>*</b> lagao (ya Ans: B) likhein) • Blank line se alag karo</p>
                          <textarea
                            value={bulkText[k] || ""}
                            onChange={e => setBulkText(p => ({ ...p, [k]: e.target.value }))}
                            placeholder="Yahan MCQs paste karo..."
                            rows={8}
                            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-indigo-400 resize-y font-mono"
                          />
                          {bulkError[k] && <p className="text-[10px] text-red-500 font-bold">{bulkError[k]}</p>}
                          <div className="flex gap-2">
                            <Btn small onClick={() => {
                              const parsed = parseBulkMcq(bulkText[k] || "");
                              if (parsed.length === 0) {
                                setBulkError(p => ({ ...p, [k]: "Koi MCQ parse nahi hua — format check karo" }));
                                return;
                              }
                              setCatData(prev => ({ ...prev, [k]: { ...(prev[k] || {}), mcqs: [...(prev[k]?.mcqs || []), ...parsed] } }));
                              setBulkText(p => ({ ...p, [k]: "" }));
                              setBulkOpen(p => ({ ...p, [k]: false }));
                              setBulkError(p => ({ ...p, [k]: "" }));
                            }} style={{ background: meta.color, color: "#fff", borderColor: meta.color }}>
                              ✅ Import Karo
                            </Btn>
                            <Btn small ghost onClick={() => {
                              setBulkOpen(p => ({ ...p, [k]: false }));
                              setBulkText(p => ({ ...p, [k]: "" }));
                              setBulkError(p => ({ ...p, [k]: "" }));
                            }}>
                              Cancel
                            </Btn>
                          </div>
                        </div>
                      )}
                      {(catData[k]?.mcqs || []).map((m: CoachingMcq, i: number) => (
                        <div key={m.id} className="border border-slate-200 rounded-xl p-2.5 space-y-1.5 mb-1.5">
                          <div className="flex items-start gap-1.5">
                            <textarea value={m.question} onChange={e => {
                              const mcqs = [...(catData[k]?.mcqs || [])];
                              mcqs[i] = { ...m, question: e.target.value };
                              updateCatMcqs(k, mcqs);
                            }} placeholder="Question" rows={2}
                              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-300 resize-none" />
                            <button onClick={() => updateCatMcqs(k, (catData[k]?.mcqs || []).filter(x => x.id !== m.id))}
                              className="text-red-400 hover:text-red-600 p-1"><Trash2 size={11} /></button>
                          </div>
                          {m.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <button onClick={() => {
                                const mcqs = [...(catData[k]?.mcqs || [])];
                                mcqs[i] = { ...m, correctAnswer: oi };
                                updateCatMcqs(k, mcqs);
                              }} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-colors ${
                                m.correctAnswer === oi ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"
                              }`}>{oi + 1}</button>
                              <input value={opt} onChange={e => {
                                const mcqs = [...(catData[k]?.mcqs || [])];
                                const opts = [...m.options]; opts[oi] = e.target.value;
                                mcqs[i] = { ...m, options: opts };
                                updateCatMcqs(k, mcqs);
                              }} placeholder={`Option ${oi + 1}`}
                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-300" />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {saveError && (
          <p className="text-[11px] text-red-500 font-bold text-center -mt-1">⚠️ {saveError}</p>
        )}
        <div className="flex gap-3">
          <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving..." : "Save Entry"}
          </button>
        </div>
      </div>
    );
  }

  // ── Subject Manager view ──
  const toggleBuiltinCat = async (catKey: string) => {
    const isDisabled = disabled.has(catKey);
    const path = `coaching_homework/${coachingId}/settings/disabledCats/${catKey}`;
    if (isDisabled) {
      await remove(ref(rtdb, path));
    } else {
      await set(ref(rtdb, path), true);
    }
  };

  if (showSubjectMgr) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSubjectMgr(false)} className="p-2 bg-slate-100 rounded-xl">
            <ArrowLeft size={16} className="text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-black text-slate-800">📚 Subjects / Categories</h2>
            <p className="text-[11px] text-slate-400">Enable/disable karo aur custom books manage karo</p>
          </div>
        </div>

        {/* Built-in categories */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Default Categories</p>
          {ALL_CATS.map(k => {
            const meta = CAT_META[k];
            const isOn = !disabled.has(k);
            return (
              <div key={k} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isOn ? "border-indigo-200 bg-indigo-50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                <span className="text-xl">{meta.icon}</span>
                <span className="flex-1 text-sm font-bold text-slate-700">{meta.label}</span>
                <button
                  onClick={() => toggleBuiltinCat(k)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all ${isOn ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}
                >
                  {isOn ? "ON" : "OFF"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom books */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Custom Books</p>
          {customBooks.length > 0 && (
            <div className="space-y-1">
              {customBooks.map((b: CustomBook) => (
                <div key={b.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xl">{b.icon}</span>
                  <span className="flex-1 text-sm font-bold text-slate-700">{b.label}</span>
                  <button onClick={() => removeCustomBook(b.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {showBookForm ? (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex gap-2">
                <input value={newBookIcon} onChange={e => setNewBookIcon(e.target.value)}
                  className="w-12 border border-slate-200 rounded-xl px-2 py-2 text-center text-lg outline-none" />
                <input value={newBookLabel} onChange={e => setNewBookLabel(e.target.value)}
                  placeholder="Book name (e.g. Ghatna Chakra)" className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowBookForm(false)} className="flex-1 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl font-bold">Cancel</button>
                <Btn onClick={addCustomBook} disabled={!newBookLabel.trim() || bookSaving}>
                  {bookSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                </Btn>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowBookForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-bold text-sm hover:bg-indigo-50">
              <Plus size={14} /> Naya Custom Book Add Karo
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Entry List ──
  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => openForm()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold rounded-2xl text-sm"
        >
          <Plus size={15} /> New Entry
        </button>
        <button
          onClick={() => setShowSubjectMgr(true)}
          className="px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl text-sm"
        >
          <Settings size={15} />
        </button>
      </div>

      {/* Entries */}
      {hwLoading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" /></div>
      ) : sortedEntries.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <BookOpen size={32} className="mx-auto text-slate-300" />
          <p className="text-slate-400 text-sm">Koi entry nahi mili</p>
        </div>
      ) : (
        sortedEntries.map((e: any) => {
          const cats = allCats.filter(k => {
            const d = e[k];
            return d && ((d.notes?.length || 0) + (d.mcqs?.length || 0)) > 0;
          });
          return (
            <div key={e.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-indigo-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm">{e.date}</p>
                  <p className="text-[11px] text-slate-400">{cats.length} categories • {cats.reduce((a: number, k: string) => a + (e[k]?.notes?.length || 0) + (e[k]?.mcqs?.length || 0), 0)} items</p>
                </div>
                <button onClick={() => openForm(e)} className="p-1.5 bg-slate-50 rounded-lg hover:bg-indigo-50">
                  <Pencil size={13} className="text-slate-400" />
                </button>
                <button onClick={() => handleDelete(e.id)} className="p-1.5 bg-red-50 rounded-lg hover:bg-red-100">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
              {cats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {cats.map(k => {
                    const meta = getCatMeta(k);
                    const cnt = (e[k]?.notes?.length || 0) + (e[k]?.mcqs?.length || 0);
                    return (
                      <span key={k} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: meta.color }}>
                        {meta.icon} {meta.label}: {cnt}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────
function SessionsTab({ coachingId, sessions, FB, selectedSessionId, onSelectSession }: any) {
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const defaultName = `${currentYear}-${String(currentYear + 1).slice(2)}`;

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = uidGen();
      const session: any = {
        id, coachingId, name: form.name.trim(),
        startDate: form.startDate || `${currentYear}-04-01`,
        endDate: form.endDate || `${currentYear + 1}-03-31`,
        active: sessions.length === 0,
        createdAt: new Date().toISOString(),
      };
      await set(ref(rtdb, `${FB}/sessions/${id}`), session);
      setForm({ name: "", startDate: "", endDate: "" });
      if (sessions.length === 0) onSelectSession(id);
    } finally { setSaving(false); }
  };

  const handleSetActive = async (s: CoachingSession) => {
    const batch: Record<string, any> = {};
    sessions.forEach((sess: CoachingSession) => {
      batch[`${FB}/sessions/${sess.id}/active`] = sess.id === s.id;
    });
    await update(ref(rtdb), batch);
    onSelectSession(s.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Is session ko delete karein?")) return;
    await remove(ref(rtdb, `${FB}/sessions/${id}`));
    if (selectedSessionId === id) onSelectSession("");
  };

  return (
    <div className="space-y-4">
      {/* Add Session */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-black text-slate-700 text-sm">📅 Nayi Session Add Karo</h3>
        <Inp
          label="Session Name (e.g. 2025-26)"
          value={form.name}
          onChange={(v: string) => setForm(p => ({ ...p, name: v }))}
          placeholder={defaultName}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Start Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">End Date</label>
            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
        <Btn onClick={handleAdd} disabled={!form.name.trim() || saving}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Session
        </Btn>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Koi session nahi hai abhi</p>
          <p className="text-xs mt-1">Oopar session add karein</p>
        </div>
      ) : (
        sessions.map((s: CoachingSession) => (
          <div key={s.id} className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 border-2 ${selectedSessionId === s.id ? "border-indigo-400" : "border-slate-100"}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.active ? "bg-emerald-50" : "bg-slate-100"}`}>
              <CalendarDays size={16} className={s.active ? "text-emerald-600" : "text-slate-400"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 text-sm">{s.name}</p>
              <p className="text-[10px] text-slate-400">{s.startDate} → {s.endDate}</p>
              {s.active && <span className="text-[10px] font-black text-emerald-600">● Active</span>}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onSelectSession(selectedSessionId === s.id ? "" : s.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors ${selectedSessionId === s.id ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}
              >
                {selectedSessionId === s.id ? "Selected" : "Select"}
              </button>
              {!s.active && (
                <Btn small ghost onClick={() => handleSetActive(s)}>Set Active</Btn>
              )}
              <Btn small danger onClick={() => handleDelete(s.id)}><Trash2 size={11} /></Btn>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Batches Tab ──────────────────────────────────────────────────────────────
function BatchesTab({ coachingId, batches, FB, sessionId }: any) {
  const [form, setForm] = useState({ name: "", section: "", monthlyFee: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = editing || uidGen();
      // Preserve original sessionId on edits; use current selector for new records
      const resolvedSessionId = editing ? editingSessionId : (sessionId || "");
      await set(ref(rtdb, `${FB}/batches/${id}`), {
        id, name: form.name.trim(), section: form.section.trim(),
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        sessionId: resolvedSessionId,
        createdAt: new Date().toISOString(),
      });
      setForm({ name: "", section: "", monthlyFee: "" });
      setEditing(null); setEditingSessionId("");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Batch delete karein?")) return;
    await remove(ref(rtdb, `${FB}/batches/${id}`));
  };

  const handleEdit = (b: CoachingBatch) => {
    setForm({ name: b.name, section: b.section || "", monthlyFee: String(b.monthlyFee) });
    setEditing(b.id);
    setEditingSessionId((b as any).sessionId || "");
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-black text-slate-700 text-sm">{editing ? "Batch Edit" : "Batch Add Karo"}</h3>
        <Inp label="Batch Name" value={form.name} onChange={(v: string) => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Class 10-A, SSC Batch" />
        <div className="grid grid-cols-2 gap-2">
          <Inp label="Section" value={form.section} onChange={(v: string) => setForm(p => ({ ...p, section: v }))} placeholder="Optional" />
          <Inp label="Monthly Fee (₹)" value={form.monthlyFee} onChange={(v: string) => setForm(p => ({ ...p, monthlyFee: v }))} placeholder="500" />
        </div>
        <div className="flex gap-2">
          {editing && <Btn ghost onClick={() => { setEditing(null); setForm({ name: "", section: "", monthlyFee: "" }); }}>Cancel</Btn>}
          <Btn onClick={handleSave} disabled={!form.name.trim() || saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {editing ? "Update" : "Add Batch"}
          </Btn>
        </div>
      </div>

      {batches.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Koi batch nahi hai</p>
      ) : (
        batches.map((b: CoachingBatch) => (
          <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">{b.name}{b.section ? ` (${b.section})` : ""}</p>
              <p className="text-xs text-slate-400">₹{b.monthlyFee}/month</p>
            </div>
            <Btn small ghost onClick={() => handleEdit(b)}><Pencil size={11} /></Btn>
            <Btn small danger onClick={() => handleDelete(b.id)}><Trash2 size={11} /></Btn>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────
function StudentsTab({ coachingId, students, batches, FB, sessionId }: any) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", rollNo: "", batchId: "", monthlyFee: "", fatherName: "", phone: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const filtered = students.filter((s: CoachingStudent) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = editing || uidGen();
      const resolvedSessionId = editing ? editingSessionId : (sessionId || "");
      await set(ref(rtdb, `${FB}/students/${id}`), {
        id, name: form.name.trim(), rollNo: form.rollNo.trim(),
        batchId: form.batchId, monthlyFee: parseFloat(form.monthlyFee) || 0,
        fatherName: form.fatherName.trim(), phone: form.phone.trim(),
        sessionId: resolvedSessionId,
        admissionDate: new Date().toISOString().slice(0, 10),
      });
      setForm({ name: "", rollNo: "", batchId: "", monthlyFee: "", fatherName: "", phone: "" });
      setEditing(null); setEditingSessionId(""); setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleEdit = (s: CoachingStudent) => {
    setForm({ name: s.name, rollNo: s.rollNo, batchId: s.batchId, monthlyFee: String(s.monthlyFee), fatherName: s.fatherName || "", phone: s.phone || "" });
    setEditing(s.id); setEditingSessionId((s as any).sessionId || ""); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Student delete karein?")) return;
    await remove(ref(rtdb, `${FB}/students/${id}`));
  };

  const getBatch = (id: string) => batches.find((b: CoachingBatch) => b.id === id);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white" />
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ name: "", rollNo: "", batchId: "", monthlyFee: "", fatherName: "", phone: "" }); }}
          className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm flex items-center gap-1.5">
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <h3 className="font-black text-slate-700 text-sm">{editing ? "Student Edit" : "Student Add"}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Inp label="Name" value={form.name} onChange={(v: string) => setForm(p => ({ ...p, name: v }))} placeholder="Student name" />
            <Inp label="Roll No" value={form.rollNo} onChange={(v: string) => setForm(p => ({ ...p, rollNo: v }))} placeholder="01" />
          </div>
          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Batch</span>
            <select value={form.batchId} onChange={e => setForm(p => ({ ...p, batchId: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400">
              <option value="">Select batch</option>
              {batches.map((b: CoachingBatch) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Inp label="Monthly Fee (₹)" value={form.monthlyFee} onChange={(v: string) => setForm(p => ({ ...p, monthlyFee: v }))} placeholder="500" />
            <Inp label="Father's Name" value={form.fatherName} onChange={(v: string) => setForm(p => ({ ...p, fatherName: v }))} placeholder="Optional" />
          </div>
          <Inp label="Phone" value={form.phone} onChange={(v: string) => setForm(p => ({ ...p, phone: v }))} placeholder="Optional" />
          <div className="flex gap-2">
            <Btn ghost onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editing ? "Update" : "Add"}
            </Btn>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Koi student nahi mila</p>
      ) : (
        filtered.map((s: CoachingStudent) => {
          const batch = getBatch(s.batchId);
          return (
            <div key={s.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-black text-indigo-600">
                {s.rollNo || s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                <p className="text-[11px] text-slate-400">{batch?.name || "No batch"} • ₹{s.monthlyFee}/mo</p>
              </div>
              <Btn small ghost onClick={() => handleEdit(s)}><Pencil size={11} /></Btn>
              <Btn small danger onClick={() => handleDelete(s.id)}><Trash2 size={11} /></Btn>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Fees Tab ─────────────────────────────────────────────────────────────────
function FeesTab({ coachingId, fees, students, batches, FB, sessionId }: any) {
  const [month, setMonth] = useState(currentMonthStr());

  const monthFees = fees.filter((f: CoachingFeeRecord) => f.month === month);
  const collected = monthFees.filter((f: CoachingFeeRecord) => f.paid).reduce((a: number, f: CoachingFeeRecord) => a + (f.amount || 0), 0);
  const pending   = monthFees.filter((f: CoachingFeeRecord) => !f.paid).length;

  const togglePaid = async (fee: CoachingFeeRecord) => {
    const id = fee.id;
    const path = `${FB}/fees/${id}`;
    await set(ref(rtdb, path), {
      ...fee, paid: !fee.paid,
      paidDate: !fee.paid ? new Date().toISOString().slice(0, 10) : undefined,
    });
  };

  const generateFees = async () => {
    const batch: Record<string, any> = {};
    for (const s of students) {
      const id = `${s.id}_${month}`;
      if (!fees.find((f: CoachingFeeRecord) => f.id === id)) {
        batch[`${FB}/fees/${id}`] = {
          id, studentId: s.id, month, amount: s.monthlyFee, paid: false,
          sessionId: sessionId || "",
        };
      }
    }
    if (Object.keys(batch).length > 0) await update(ref(rtdb), batch);
  };

  const getStudent = (id: string) => students.find((s: CoachingStudent) => s.id === id);
  const getBatch = (batchId: string) => batches.find((b: CoachingBatch) => b.id === batchId);

  return (
    <div className="space-y-4">
      {/* Month selector + generate */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <label className="block">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Month</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        </label>
        <button onClick={generateFees}
          className="w-full py-2.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl flex items-center justify-center gap-2">
          <RefreshCw size={13} /> Generate {fmtMonth(month)} Fees
        </button>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-emerald-50 rounded-xl p-2.5">
            <p className="font-black text-emerald-700 text-sm">₹{collected.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-600">Collected</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-2.5">
            <p className="font-black text-orange-600 text-sm">{pending}</p>
            <p className="text-[10px] text-orange-500">Pending</p>
          </div>
        </div>
      </div>

      {monthFees.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Koi fee record nahi. Generate karo.</p>
      ) : (
        monthFees.map((f: CoachingFeeRecord) => {
          const s = getStudent(f.studentId);
          if (!s) return null;
          const batch = getBatch(s.batchId);
          return (
            <div key={f.id} className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-center gap-3 ${f.paid ? "border-emerald-100" : "border-orange-100"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.paid ? "bg-emerald-50" : "bg-orange-50"}`}>
                {f.paid ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-orange-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                <p className="text-[11px] text-slate-400">{batch?.name || "—"} • ₹{f.amount}</p>
              </div>
              <button onClick={() => togglePaid(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${f.paid ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-700"}`}>
                {f.paid ? "Unpaid" : "Mark Paid"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Result Sheet — extracted component to keep hooks unconditional ────────────
function ResultSheet({ tests, students, batches, onBack }: any) {
  const [batchId, setBatchId] = useState("");

  const batchTests = batchId
    ? tests.filter((t: CoachingTest) => t.batchId === batchId)
    : tests;

  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(
    () => new Set(tests.map((t: CoachingTest) => t.id))
  );

  // When batch filter changes, reset selection to all tests of that batch
  useEffect(() => {
    const ids = (batchId
      ? tests.filter((t: CoachingTest) => t.batchId === batchId)
      : tests).map((t: CoachingTest) => t.id);
    setSelectedTestIds(new Set(ids));
  }, [batchId, tests]);

  const chosenTests = [...batchTests]
    .filter((t: CoachingTest) => selectedTestIds.has(t.id))
    .sort((a: CoachingTest, b: CoachingTest) => a.date.localeCompare(b.date));

  const filterStudents = batchId
    ? students.filter((s: CoachingStudent) => s.batchId === batchId)
    : students;

  const gradeOf = (obt: number, max: number) => {
    if (max === 0) return "—";
    const p = (obt / max) * 100;
    if (p >= 90) return "A+"; if (p >= 80) return "A"; if (p >= 70) return "B+";
    if (p >= 60) return "B"; if (p >= 50) return "C"; if (p >= 33) return "D";
    return "F";
  };

  // Build ranked rows
  const rows = filterStudents.map((s: CoachingStudent) => {
    const testMarks = chosenTests.map((t: CoachingTest) => {
      const r = t.results?.find((x: any) => x.studentId === s.id);
      if (!r || r.absent) return { marks: null as number | null, max: t.maxMarks, absent: true };
      return { marks: r.marks as number | null, max: t.maxMarks, absent: false };
    });
    const totalObt = testMarks.reduce((sum, m) => sum + (m.absent || m.marks == null ? 0 : m.marks), 0);
    const totalMax = chosenTests.reduce((sum: number, t: CoachingTest) => sum + t.maxMarks, 0);
    const pct = totalMax > 0 ? (totalObt / totalMax) * 100 : null;
    return { student: s, testMarks, totalObt, totalMax, pct };
  });

  const ranked = [...rows].sort((a, b) => b.totalObt - a.totalObt || a.student.name.localeCompare(b.student.name));

  const toggleTest = (id: string) => {
    setSelectedTestIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 bg-slate-100 rounded-xl">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-black text-slate-800 text-base">🏆 Result Sheet</h2>
          <p className="text-[11px] text-slate-400">Sab students ka total score, rank aur winner</p>
        </div>
      </div>

      {/* Batch filter */}
      {batches.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Class / Batch</label>
          <select
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">Sabhi Classes</option>
            {batches.map((b: CoachingBatch) => (
              <option key={b.id} value={b.id}>{b.name}{(b as any).section ? ` (${(b as any).section})` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* Test selection checkboxes */}
      {batchTests.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tests Select Karo</p>
            <div className="flex gap-3">
              <button onClick={() => setSelectedTestIds(new Set(batchTests.map((t: CoachingTest) => t.id)))}
                className="text-[10px] font-bold text-indigo-600 hover:underline">Sab</button>
              <button onClick={() => setSelectedTestIds(new Set())}
                className="text-[10px] font-bold text-slate-400 hover:underline">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...batchTests].sort((a: CoachingTest, b: CoachingTest) => a.date.localeCompare(b.date)).map((t: CoachingTest) => {
              const sel = selectedTestIds.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTest(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all ${
                    sel ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {sel ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {t.testNo || t.title || "Test"}
                  {t.subject ? ` · ${t.subject}` : ""}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {selectedTestIds.size} selected · Total Max = {chosenTests.reduce((s: number, t: CoachingTest) => s + t.maxMarks, 0)} marks
          </p>
        </div>
      )}

      {/* Winner card */}
      {ranked.length > 0 && chosenTests.length > 0 && ranked[0].totalMax > 0 && (
        <div className="bg-gradient-to-r from-amber-400 to-yellow-300 rounded-2xl p-4 flex items-center gap-4 shadow-md">
          <div className="text-4xl">🏆</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">🥇 Winner</p>
            <p className="font-black text-amber-900 text-lg leading-tight truncate">{ranked[0].student.name}</p>
            <p className="text-[11px] text-amber-800 font-bold">
              {ranked[0].totalObt}/{ranked[0].totalMax} marks
              {ranked[0].pct !== null ? ` · ${ranked[0].pct.toFixed(1)}%` : ""}
              {" · "}{gradeOf(ranked[0].totalObt, ranked[0].totalMax)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-amber-900">
              {ranked[0].pct !== null ? `${Math.round(ranked[0].pct)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Result table */}
      {filterStudents.length === 0 ? (
        <div className="text-center py-12">
          <BarChart2 size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-400 text-sm">Koi student nahi mila</p>
        </div>
      ) : chosenTests.length === 0 ? (
        <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-700 font-bold text-sm">Kam se kam ek test select karo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">Rank</th>
                <th className="px-3 py-2.5 text-left">Student</th>
                {chosenTests.map((t: CoachingTest) => (
                  <th key={t.id} className="px-2 py-2.5 text-center whitespace-nowrap">
                    <div>{t.testNo || "T"}</div>
                    <div className="text-[8px] opacity-70 font-bold normal-case">{t.subject || t.title || t.date}</div>
                    <div className="text-[8px] opacity-60 font-normal">/{t.maxMarks}</div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center whitespace-nowrap">
                  Total<br/>
                  <span className="text-[8px] font-normal opacity-70">
                    /{chosenTests.reduce((s: number, t: CoachingTest) => s + t.maxMarks, 0)}
                  </span>
                </th>
                <th className="px-3 py-2.5 text-center">%</th>
                <th className="px-3 py-2.5 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, rankIdx) => {
                const isWinner = rankIdx === 0 && row.totalMax > 0;
                const rank = rankIdx + 1;
                const pctNum = row.pct;
                const g = row.totalMax > 0 ? gradeOf(row.totalObt, row.totalMax) : "—";
                const rowBg = isWinner ? "bg-amber-50" : rankIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                return (
                  <tr key={row.student.id} className={`${rowBg} border-b border-slate-100 last:border-0`}>
                    <td className="px-3 py-2.5 text-center font-black text-sm">
                      {isWinner ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-slate-800 text-xs whitespace-nowrap">{row.student.name}</p>
                      <p className="text-[10px] text-slate-400">{row.student.rollNo}</p>
                    </td>
                    {row.testMarks.map((m, ti) => (
                      <td key={ti} className="px-2 py-2.5 text-center">
                        {m.absent ? (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">AB</span>
                        ) : m.marks === null ? (
                          <span className="text-[10px] text-slate-300">—</span>
                        ) : (
                          <span className={`text-xs font-bold ${
                            m.marks / m.max >= 0.6 ? "text-emerald-700" :
                            m.marks / m.max >= 0.33 ? "text-orange-600" : "text-red-600"
                          }`}>
                            {m.marks}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-black text-slate-800">{row.totalObt}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-black ${
                        pctNum !== null
                          ? pctNum >= 60 ? "text-emerald-600" : pctNum >= 33 ? "text-orange-500" : "text-red-500"
                          : "text-slate-400"
                      }`}>
                        {pctNum !== null ? `${pctNum.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        g === "A+" || g === "A" ? "bg-emerald-100 text-emerald-700" :
                        g === "B+" || g === "B" ? "bg-blue-100 text-blue-700" :
                        g === "C" ? "bg-yellow-100 text-yellow-700" :
                        g === "D" ? "bg-orange-100 text-orange-700" :
                        g === "F" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                      }`}>{g}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary stats */}
      {ranked.length > 0 && chosenTests.length > 0 && (() => {
        const validRows = ranked.filter(r => r.totalMax > 0);
        if (!validRows.length) return null;
        const avg = validRows.reduce((s, r) => s + (r.pct || 0), 0) / validRows.length;
        const highest = validRows[0].pct || 0;
        const passed = validRows.filter(r => (r.pct || 0) >= 33).length;
        return (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Class Avg", val: `${avg.toFixed(1)}%`, color: "bg-blue-50 text-blue-800" },
              { label: "Highest", val: `${highest.toFixed(1)}%`, color: "bg-amber-50 text-amber-800" },
              { label: `Pass (≥33%)`, val: `${passed}/${validRows.length}`, color: "bg-emerald-50 text-emerald-800" },
            ].map(c => (
              <div key={c.label} className={`${c.color} rounded-xl p-3 text-center`}>
                <p className="font-black text-base">{c.val}</p>
                <p className="text-[10px] font-bold opacity-70">{c.label}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tests Tab ────────────────────────────────────────────────────────────────
function TestsTab({ coachingId, tests, students, batches, FB, sessionId }: any) {
  const [showForm, setShowForm]     = useState(false);
  const [showTotalScore, setShowTotalScore] = useState(false);
  const [form, setForm]             = useState({ testNo: "", title: "", subject: "", date: todayStr(), batchId: "", maxMarks: "100" });
  const [results, setResults]       = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [editId, setEditId]               = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string>("");
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  const batchStudents = (batchId: string) => students.filter((s: CoachingStudent) => s.batchId === batchId);

  const openForm = (test?: CoachingTest) => {
    if (test) {
      setForm({ testNo: test.testNo, title: test.title, subject: test.subject || "", date: test.date, batchId: test.batchId, maxMarks: String(test.maxMarks) });
      const res: Record<string, { marks: string; absent: boolean }> = {};
      test.results?.forEach(r => { res[r.studentId] = { marks: r.marks !== null && r.marks !== undefined ? String(r.marks) : "", absent: r.absent || false }; });
      setResults(res);
      setEditId(test.id);
      setEditingSessionId((test as any).sessionId || "");
    } else {
      setForm({ testNo: "", title: "", subject: "", date: todayStr(), batchId: batches[0]?.id || "", maxMarks: "100" });
      setResults({});
      setEditId(null);
      setEditingSessionId("");
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = editId || uidGen();
      const resolvedSessionId = editId ? editingSessionId : (sessionId || "");
      const bStudents = batchStudents(form.batchId);
      const testResults = bStudents.map((s: CoachingStudent) => {
        const r = results[s.id];
        return { studentId: s.id, marks: r?.absent ? null : (parseFloat(r?.marks || "") || null), absent: r?.absent || false };
      });
      await set(ref(rtdb, `${FB}/tests/${id}`), {
        id, testNo: form.testNo.trim(), title: form.title.trim(),
        subject: form.subject.trim(), date: form.date, batchId: form.batchId,
        maxMarks: parseFloat(form.maxMarks) || 100, results: testResults,
        sessionId: resolvedSessionId,
      });
      setShowForm(false);
    } finally { setSaving(false); }
  };

  // ── Delegate to ResultSheet child component ─────────────────────────────────
  if (showTotalScore) {
    return <ResultSheet tests={tests} students={students} batches={batches} onBack={() => setShowTotalScore(false)} />;
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Test delete karein?")) return;
    await remove(ref(rtdb, `${FB}/tests/${id}`));
  };

  const getBatch = (id: string) => batches.find((b: CoachingBatch) => b.id === id);

  const gradeColor = (g: string) => {
    if (g === "A+" || g === "A") return "text-emerald-600 bg-emerald-50";
    if (g === "B+" || g === "B") return "text-blue-600 bg-blue-50";
    if (g === "C") return "text-yellow-600 bg-yellow-50";
    if (g === "D") return "text-orange-600 bg-orange-50";
    if (g === "F") return "text-red-600 bg-red-50";
    return "text-slate-500 bg-slate-50";
  };

  if (showForm) {
    const bStudents = batchStudents(form.batchId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowForm(false)} className="p-2 bg-slate-100 rounded-xl"><ArrowLeft size={16} className="text-slate-600" /></button>
          <h2 className="font-black text-slate-800">{editId ? "Test Edit" : "New Test"}</h2>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Inp label="Test No." value={form.testNo} onChange={(v: string) => setForm(p => ({ ...p, testNo: v }))} placeholder="T-01" />
            <Inp label="Title" value={form.title} onChange={(v: string) => setForm(p => ({ ...p, title: v }))} placeholder="Chapter Test" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Inp label="Subject" value={form.subject} onChange={(v: string) => setForm(p => ({ ...p, subject: v }))} placeholder="Math, Science..." />
            <Inp label="Max Marks" value={form.maxMarks} onChange={(v: string) => setForm(p => ({ ...p, maxMarks: v }))} placeholder="100" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Batch</span>
              <select value={form.batchId} onChange={e => { setForm(p => ({ ...p, batchId: e.target.value })); setResults({}); }}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400">
                {batches.map((b: CoachingBatch) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</span>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </label>
          </div>
        </div>

        {/* Student results */}
        {bStudents.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Student Results</p>
            {bStudents.map((s: CoachingStudent) => {
              const r = results[s.id] || { marks: "", absent: false };
              return (
                <div key={s.id} className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-600 w-6 shrink-0">{s.rollNo || "–"}</span>
                  <span className="flex-1 text-sm text-slate-700">{s.name}</span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    <input type="checkbox" checked={r.absent} onChange={e => setResults(prev => ({ ...prev, [s.id]: { ...r, absent: e.target.checked, marks: "" } }))} />
                    Absent
                  </label>
                  <input type="number" value={r.marks} disabled={r.absent}
                    onChange={e => setResults(prev => ({ ...prev, [s.id]: { ...r, marks: e.target.value } }))}
                    placeholder="Marks"
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-center outline-none focus:border-indigo-400 disabled:opacity-40" />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>
    );
  }

  const sortedTests = [...tests].sort((a: CoachingTest, b: CoachingTest) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => openForm()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold rounded-2xl text-sm">
          <Plus size={15} /> New Test
        </button>
        <button onClick={() => setShowTotalScore(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-2xl text-sm">
          <BarChart2 size={15} /> Total Score
        </button>
      </div>

      {sortedTests.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Koi test nahi hai</p>
      ) : (
        sortedTests.map((t: CoachingTest) => {
          const batch = getBatch(t.batchId);
          const isExpanded = expandedId === t.id;
          const bStudents = batchStudents(t.batchId);
          const appeared = t.results?.filter(r => !r.absent).length || 0;
          const avg = appeared > 0
            ? (t.results?.filter(r => !r.absent && r.marks !== null).reduce((a, r) => a + (r.marks || 0), 0) || 0) / appeared
            : 0;

          return (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0">
                    {t.testNo || "T"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm">{t.title}</p>
                    <p className="text-[11px] text-slate-400">{batch?.name || "—"} • {t.date} • Max: {t.maxMarks}</p>
                    {t.subject && <p className="text-[11px] text-indigo-500 font-bold">{t.subject}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <Btn small ghost onClick={() => openForm(t)}><Pencil size={11} /></Btn>
                    <Btn small danger onClick={() => handleDelete(t.id)}><Trash2 size={11} /></Btn>
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="p-1.5 bg-slate-50 rounded-lg text-slate-400">
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-3">
                  <span className="text-[11px] text-slate-500">Appeared: <strong>{appeared}/{bStudents.length}</strong></span>
                  {appeared > 0 && <span className="text-[11px] text-slate-500">Avg: <strong>{avg.toFixed(1)}</strong></span>}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">
                  {bStudents.map((s: CoachingStudent) => {
                    const r = t.results?.find(x => x.studentId === s.id);
                    const g = r?.absent ? "A" : grade(r?.marks ?? null, t.maxMarks);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 w-6">{s.rollNo}</span>
                        <span className="flex-1 text-xs text-slate-700">{s.name}</span>
                        {r?.absent ? (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">AB</span>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-slate-700">{r?.marks ?? "—"}/{t.maxMarks}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${gradeColor(g)}`}>{g}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

