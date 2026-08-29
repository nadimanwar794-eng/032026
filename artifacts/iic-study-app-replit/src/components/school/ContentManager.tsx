// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  saveLesson, subscribeToLessons, deleteLesson, generateId
} from "../../school-firebase";
import type { SchoolLesson, LessonMCQ } from "../../school-types";
import { Plus, Trash2, Save, ChevronLeft, BookOpen, Edit3, FileText, Layers, CheckSquare, Eye, EyeOff, HelpCircle, Check, X, ChevronDown, ChevronUp, Upload, AlignLeft, ListChecks, Settings2, Star } from "lucide-react";
import { parseMCQText } from "../../utils/mcqParser";
import { ChunkedNotesReader } from "../ChunkedNotesReader";

// ── MCQ paste normalizer (handles common Hindi/English formats) ────────────
function normalizeMcqPaste(raw: string): string {
  let txt = raw.replace(/\r\n/g, "\n");
  txt = txt.replace(/^---+\s*$/gm, "");
  txt = txt.replace(/^###\s+.+$/gm, "");
  txt = txt.replace(/\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]\s*([^*]+?)\s*\*\*/gi, (_m, v) => `\n✅ Correct Answer: ${v.trim()}`);
  txt = txt.replace(/\*\*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]?\*\*\s*/gi, "✅ Correct Answer: ");
  txt = txt.replace(/(?:^|\n)\s*(?:Ans(?:wer)?|सही\s*उत्तर)\s*[:：]\s*/gi, "\n✅ Correct Answer: ");
  txt = txt.replace(/\*\*\s*(?:प्रश्न|Question)\s*(\d+)\s*[:.\-]\s*([\s\S]*?)\*\*([^\n]*)/gi, (_m, n, q, rest) => {
    const combined = (String(q).trim() + " " + String(rest).trim()).trim();
    return `\n**Question ${n}**\n❓ Question: ${combined}`;
  });
  // Bare (non-bold) "प्रश्न 18:" / "Question 18:" markers — common when the AI
  // only bolds the label, not the number, or skips bold entirely. Without this,
  // numbered statement lines ("1. ...", "2. ...") that follow get mistaken for
  // new question boundaries by the fallback heuristic below, chopping the
  // statement-based question apart and dropping its statements.
  txt = txt.replace(/(?:^|\n)[ \t]*(?:\*\*\s*)?(?:प्रश्न|Question)\s*(\d+)\s*[:.\-]\s*/gi, (_m, n) => `\n**Question ${n}**\n❓ Question: `);
  txt = txt.replace(/\*\*(?:प्रश्न|Question)\s*[:：]?\*\*/gi, "__PRASHNA__");
  txt = txt.replace(/\*\*/g, "");
  let qNum = 0;
  txt = txt.replace(/__PRASHNA__\s*/g, () => { qNum += 1; return `\n**Question ${qNum}**\n❓ Question: `; });
  return txt;
}

interface Props {
  schoolId: string;
  sessionId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  authorId: string;
  subscription: { reading: boolean; writing: boolean; pdf: boolean; mcq: boolean };
  onBack?: () => void;
  onOpenLesson?: (lesson: SchoolLesson, mode: "reading" | "writing" | "pdf" | "mcq") => void;
}

const emptyMCQ = (): LessonMCQ => ({
  id: generateId(),
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
});

const MCQBuilder: React.FC<{
  mcqs: LessonMCQ[];
  onChange: (mcqs: LessonMCQ[]) => void;
}> = ({ mcqs, onChange }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(mcqs.length === 0 ? null : 0);
  const [tab, setTab]           = useState<"manual" | "bulk">("manual");
  const [bulkText, setBulkText] = useState("");
  const [bulkMsg,  setBulkMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [preview,  setPreview]  = useState<LessonMCQ[]>([]);

  const addQuestion = () => {
    const next = [...mcqs, emptyMCQ()];
    onChange(next);
    setExpandedIdx(next.length - 1);
  };

  const updateQ = (idx: number, patch: Partial<LessonMCQ>) => {
    const next = mcqs.map((q, i) => i === idx ? { ...q, ...patch } : q);
    onChange(next);
  };

  const updateOption = (qIdx: number, optIdx: number, val: string) => {
    const next = mcqs.map((q, i) => {
      if (i !== qIdx) return q;
      const options = [...q.options];
      options[optIdx] = val;
      return { ...q, options };
    });
    onChange(next);
  };

  const deleteQ = (idx: number) => {
    const next = mcqs.filter((_, i) => i !== idx);
    onChange(next);
    setExpandedIdx(null);
  };

  const handleBulkParse = () => {
    const raw = bulkText.trim();
    if (!raw) { setBulkMsg({ ok: false, text: "Text khaali hai — paste karo pehle." }); return; }
    try {
      const parsed = parseMCQText(normalizeMcqPaste(raw));
      if (!parsed.questions?.length) {
        setBulkMsg({ ok: false, text: "Koi question parse nahi hua. Format check karo." });
        return;
      }
      const mapped: LessonMCQ[] = parsed.questions.map(q => ({
        id: generateId(),
        question: (q.question || "").replace(/<br\/?>/g, "\n").trim(),
        options: (q.options || ["", "", "", ""]).slice(0, 4).map(o =>
          o.replace(/<br\/?>/g, " ").trim()
        ),
        correctIndex: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
        explanation: (q.explanation || "").replace(/<br\/?>/g, " ").trim(),
      }));
      setPreview(mapped);
      setBulkMsg({ ok: true, text: `✅ ${mapped.length} questions parse ho gaye — preview dekho neeche` });
    } catch {
      setBulkMsg({ ok: false, text: "Parse mein error aaya — format check karo." });
    }
  };

  const handleBulkAdd = () => {
    if (!preview.length) return;
    onChange([...mcqs, ...preview]);
    setBulkText("");
    setPreview([]);
    setBulkMsg({ ok: true, text: `✅ ${preview.length} questions add ho gaye!` });
    setTab("manual");
    setExpandedIdx(mcqs.length);
  };

  return (
    <div className="space-y-3">
      {/* ── Tab switcher ──────────────────────────────────────── */}
      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === "manual" ? "bg-white dark:bg-slate-800 shadow text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
        >
          <ListChecks className="w-3.5 h-3.5" /> Ek Ek Karo
        </button>
        <button
          type="button"
          onClick={() => setTab("bulk")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === "bulk" ? "bg-white dark:bg-slate-800 shadow text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
        >
          <Upload className="w-3.5 h-3.5" /> Bulk Upload
        </button>
      </div>

      {/* ── BULK UPLOAD TAB ───────────────────────────────────── */}
      {tab === "bulk" && (
        <div className="space-y-3">
          {/* Format hint */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs font-black text-amber-700 dark:text-amber-300 mb-1.5">📋 Dono Format Supported:</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="text-amber-600 dark:text-amber-400 space-y-0.5">
                <p className="font-black text-amber-700 dark:text-amber-300">Style 1 (exam):</p>
                <p>Q1. Question text?</p>
                <p>A) Option 1</p>
                <p className="text-green-700 dark:text-green-400">*B) Sahi jawab ← star</p>
                <p>Ans: B) Option 2</p>
              </div>
              <div className="text-amber-600 dark:text-amber-400 space-y-0.5">
                <p className="font-black text-amber-700 dark:text-amber-300">Style 2 (star):</p>
                <p>Q: Question text?</p>
                <p>A: Option 1</p>
                <p className="text-green-700 dark:text-green-400">*B: Sahi jawab ← star</p>
                <p>Exp: Explanation</p>
              </div>
            </div>
            <p className="text-[10px] text-amber-500 mt-1.5">💡 Dono style kaam karte hain • Blank line se alag karo • Hindi (प्रश्न/सही उत्तर) bhi ok</p>
          </div>

          {/* Paste area */}
          <textarea
            value={bulkText}
            onChange={e => { setBulkText(e.target.value); setPreview([]); setBulkMsg(null); }}
            placeholder={"Yahan MCQ text paste karo...\n\nQ1. India ki rajdhani kya hai?\nA) Mumbai\nB) New Delhi\nC) Kolkata\nD) Chennai\nAns: B) New Delhi"}
            rows={10}
            className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-mono resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />

          {/* Parse button */}
          <button
            type="button"
            onClick={handleBulkParse}
            disabled={!bulkText.trim()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <AlignLeft className="w-4 h-4" /> Parse Karo
          </button>

          {/* Message */}
          {bulkMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm font-bold ${bulkMsg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
              {bulkMsg.text}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Preview — {preview.length} Questions
              </p>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {preview.map((q, i) => (
                  <div key={q.id} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-sm">
                    <p className="font-bold text-slate-800 dark:text-white mb-1.5">
                      <span className="text-green-500 mr-1">Q{i + 1}.</span> {q.question}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`text-xs px-2 py-1 rounded-lg ${oi === q.correctIndex ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                          {String.fromCharCode(65 + oi)}) {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleBulkAdd}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" /> Sab Add Karo ({preview.length} Questions)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL TAB ────────────────────────────────────────── */}
      {tab === "manual" && mcqs.map((q, idx) => (
        <div key={q.id} className="border dark:border-slate-600 rounded-xl overflow-hidden">
          {/* Question header */}
          <button
            type="button"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-700 text-left"
          >
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
              {q.question.trim() || "Question likhein..."}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteQ(idx); }}
              className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {expandedIdx === idx
              ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          </button>

          {expandedIdx === idx && (
            <div className="p-3 space-y-3 bg-white dark:bg-slate-800">
              {/* Question text */}
              <textarea
                value={q.question}
                onChange={e => updateQ(idx, { question: e.target.value })}
                placeholder="Question likhein..."
                rows={2}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm resize-none"
              />

              {/* Options */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Options — sahi jawab pe ✓ click karo
                </p>
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQ(idx, { correctIndex: optIdx })}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        q.correctIndex === optIdx
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-slate-300 dark:border-slate-500 text-transparent hover:border-green-400"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-xs font-black text-slate-400 flex-shrink-0">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <input
                      value={opt}
                      onChange={e => updateOption(idx, optIdx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                      className={`flex-1 px-2.5 py-1.5 border rounded-lg text-sm bg-transparent text-slate-800 dark:text-white transition-all ${
                        q.correctIndex === optIdx
                          ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                          : "border-slate-200 dark:border-slate-600"
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Explanation (optional)
                </p>
                <input
                  value={q.explanation || ""}
                  onChange={e => updateQ(idx, { explanation: e.target.value })}
                  placeholder="Sahi jawab kyun hai — briefly explain"
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {tab === "manual" && (
        <button
          type="button"
          onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl text-green-600 dark:text-green-400 text-sm font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> Question Add Karo
        </button>
      )}
    </div>
  );
};

type EditTab = "general" | "reading" | "writing" | "pdf" | "mcq";

const EDIT_TABS: { id: EditTab; emoji: string; label: string; color: string; featureKey?: keyof SchoolLesson["features"] }[] = [
  { id: "general",  emoji: "⚙️",  label: "General",  color: "#64748b" },
  { id: "reading",  emoji: "📖",  label: "Reading",  color: "#2563eb", featureKey: "readingEnabled" },
  { id: "writing",  emoji: "✏️",  label: "Writing",  color: "#7c3aed", featureKey: "writingEnabled" },
  { id: "pdf",      emoji: "📄",  label: "PDF",      color: "#ea580c", featureKey: "pdfEnabled" },
  { id: "mcq",      emoji: "❓",  label: "MCQ",      color: "#16a34a", featureKey: "mcqEnabled" },
];

export const ContentManager: React.FC<Props> = ({
  schoolId, sessionId, classId, subjectId, subjectName, className, authorId,
  subscription, onBack, onOpenLesson
}) => {
  const [lessons, setLessons] = useState<SchoolLesson[]>([]);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editLesson, setEditLesson] = useState<SchoolLesson | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("general");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLessons(schoolId, subjectId, setLessons);
    return unsub;
  }, [schoolId, subjectId]);

  const newLesson = (): SchoolLesson => ({
    id: generateId(),
    schoolId, sessionId, classId, subjectId,
    title: "",
    order: lessons.length + 1,
    readingContent: "",
    writingContent: "",
    pdfUrl: "",
    mcqs: [],
    impNotes: "",
    features: { readingEnabled: true, writingEnabled: true, pdfEnabled: false, mcqEnabled: false },
    createdAt: new Date().toISOString(),
    createdBy: authorId
  });

  const startNew = () => { setEditLesson(newLesson()); setEditTab("general"); setView("edit"); };

  const startEdit = (lesson: SchoolLesson) => {
    setEditLesson({ ...lesson, mcqs: lesson.mcqs ? [...lesson.mcqs] : [] });
    setEditTab("general");
    setView("edit");
  };

  const handleSave = async () => {
    if (!editLesson || !editLesson.title.trim()) return;
    setSaving(true);
    await saveLesson(editLesson);
    setSaving(false);
    setView("list");
  };

  const handleDelete = async (lessonId: string) => {
    if (!window.confirm("Delete this lesson?")) return;
    await deleteLesson(schoolId, lessonId);
  };

  const toggleFeature = (key: keyof SchoolLesson["features"]) => {
    if (!editLesson) return;
    setEditLesson(prev => prev ? {
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] }
    } : prev);
  };

  // Build preview content for ChunkedNotesReader
  const getPreviewContent = (): string => {
    if (!editLesson) return "";
    if (editTab === "reading") {
      return [
        editLesson.impNotes
          ? `<div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:12px 16px;margin-bottom:16px;"><strong style="color:#a16207;">⭐ Important Notes</strong><p style="margin-top:6px;color:#92400e;">${editLesson.impNotes}</p></div>`
          : "",
        editLesson.readingContent || "",
      ].join("");
    }
    if (editTab === "writing") return editLesson.writingContent || "";
    return "";
  };

  if (view === "edit" && editLesson) {
    const previewContent = getPreviewContent();
    const canPreview = (editTab === "reading" && !!(editLesson.readingContent || editLesson.impNotes)) ||
                       (editTab === "writing" && !!editLesson.writingContent);

    // ── Lucent-style full-screen preview ──────────────────────────────────
    if (showPreview) {
      return (
        <div className="fixed inset-0 z-[500] bg-white dark:bg-slate-900 flex flex-col">
          <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Editor Par Wapas
            </button>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {editTab === "reading" ? "📖 Reading" : "✏️ Writing"} Preview
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChunkedNotesReader
              content={previewContent}
              topBarLabel={editLesson.title}
              preferChunkMode
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shrink-0">
          <button onClick={() => setView("list")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white truncate">{editLesson.title || "New Lesson"}</h2>
          {canPreview && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 active:scale-95 transition-all"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60 active:scale-95 transition-all">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-3 flex gap-0.5 overflow-x-auto shrink-0 no-scrollbar">
          {EDIT_TABS.map(tab => {
            const isEnabled = !tab.featureKey || editLesson.features[tab.featureKey];
            const isActive  = editTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setEditTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0 ${
                  isActive
                    ? "border-current text-current"
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                style={isActive ? { color: tab.color, borderColor: tab.color } : {}}
              >
                {tab.emoji} {tab.label}
                {tab.featureKey && (
                  <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${isEnabled ? "bg-green-400" : "bg-slate-300 dark:bg-slate-600"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">

          {/* GENERAL TAB */}
          {editTab === "general" && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lesson Info</p>
                <input value={editLesson.title}
                  onChange={e => setEditLesson(prev => prev ? { ...prev, title: e.target.value } : prev)}
                  placeholder="Lesson Title (e.g. Manufacturing Industries)"
                  className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-500 shrink-0">Order:</label>
                  <input type="number" value={editLesson.order} min={1}
                    onChange={e => setEditLesson(prev => prev ? { ...prev, order: Number(e.target.value) } : prev)}
                    className="w-20 px-3 py-2 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Modes Enable / Disable</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["readingEnabled", "📖 Reading", "#2563eb"],
                    ["writingEnabled", "✏️ Writing", "#7c3aed"],
                    ["pdfEnabled",     "📄 PDF",     "#ea580c"],
                    ["mcqEnabled",     "❓ MCQ",     "#16a34a"],
                  ] as const).map(([key, label, color]) => {
                    const on = editLesson.features[key as keyof typeof editLesson.features];
                    return (
                      <button key={key} onClick={() => toggleFeature(key as any)}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all text-sm font-bold active:scale-95 ${
                          on ? "border-current text-current" : "border-slate-200 dark:border-slate-600 text-slate-400"
                        }`}
                        style={on ? { color, borderColor: color, background: color + "12" } : {}}
                      >
                        {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* READING TAB */}
          {editTab === "reading" && (
            <>
              <div className={`rounded-2xl border-2 p-1 ${editLesson.features.readingEnabled ? "border-blue-200 dark:border-blue-800" : "border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">Reading Mode Content</span>
                  <button
                    onClick={() => toggleFeature("readingEnabled")}
                    className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${editLesson.features.readingEnabled ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                  >
                    {editLesson.features.readingEnabled ? "✓ Enabled" : "Disabled"}
                  </button>
                </div>
                <textarea value={editLesson.readingContent} rows={12}
                  onChange={e => setEditLesson(prev => prev ? { ...prev, readingContent: e.target.value } : prev)}
                  placeholder={"Notes yahan likhein. HTML bhi support hota hai.\n\nExample:\n<b>Heading</b>\n<ul><li>Point 1</li><li>Point 2</li></ul>"}
                  className="w-full px-3 py-2 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm resize-none focus:outline-none font-mono" />
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-black text-amber-700 dark:text-amber-400">Important Notes (⭐ IMP)</span>
                </div>
                <textarea value={editLesson.impNotes} rows={4}
                  onChange={e => setEditLesson(prev => prev ? { ...prev, impNotes: e.target.value } : prev)}
                  placeholder="Key points, formulas, definitions jo students ko yaad rakhne chahiye."
                  className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-amber-200 dark:border-amber-700 text-slate-800 dark:text-white text-sm resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none" />
              </div>
            </>
          )}

          {/* WRITING TAB */}
          {editTab === "writing" && (
            <div className={`rounded-2xl border-2 p-1 ${editLesson.features.writingEnabled ? "border-purple-200 dark:border-purple-800" : "border-slate-200 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <Edit3 className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-black text-purple-600 dark:text-purple-400">Writing Mode Content</span>
                <button
                  onClick={() => toggleFeature("writingEnabled")}
                  className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${editLesson.features.writingEnabled ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                >
                  {editLesson.features.writingEnabled ? "✓ Enabled" : "Disabled"}
                </button>
              </div>
              <textarea value={editLesson.writingContent} rows={14}
                onChange={e => setEditLesson(prev => prev ? { ...prev, writingContent: e.target.value } : prev)}
                placeholder={"Board-style content likhein. HTML supported.\n\nExample:\n<h2>Chapter: Manufacturing</h2>\n<p><b>Definition:</b> ...</p>"}
                className="w-full px-3 py-2 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm resize-none focus:outline-none font-mono" />
            </div>
          )}

          {/* PDF TAB */}
          {editTab === "pdf" && (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 p-4 shadow-sm space-y-3 ${editLesson.features.pdfEnabled ? "border-orange-200 dark:border-orange-800" : "border-slate-200 dark:border-slate-700"}`}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-black text-orange-600 dark:text-orange-400">PDF Mode</span>
                <button
                  onClick={() => toggleFeature("pdfEnabled")}
                  className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${editLesson.features.pdfEnabled ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                >
                  {editLesson.features.pdfEnabled ? "✓ Enabled" : "Disabled"}
                </button>
              </div>
              <p className="text-xs text-slate-400">Google Drive / Any public PDF URL paste karo</p>
              <input value={editLesson.pdfUrl}
                onChange={e => setEditLesson(prev => prev ? { ...prev, pdfUrl: e.target.value } : prev)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" />
              {editLesson.pdfUrl && (
                <a href={editLesson.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 underline">
                  <Eye className="w-3.5 h-3.5" /> PDF dekhein (new tab)
                </a>
              )}
            </div>
          )}

          {/* MCQ TAB */}
          {editTab === "mcq" && (
            <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 p-4 shadow-sm ${editLesson.features.mcqEnabled ? "border-green-200 dark:border-green-800" : "border-slate-200 dark:border-slate-700"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-black text-green-600 dark:text-green-400">MCQ Practice</span>
                  {(editLesson.mcqs?.length ?? 0) > 0 && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold">
                      {editLesson.mcqs?.length} questions
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleFeature("mcqEnabled")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${editLesson.features.mcqEnabled ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                >
                  {editLesson.features.mcqEnabled ? "✓ Enabled" : "Disabled"}
                </button>
              </div>
              <MCQBuilder
                mcqs={editLesson.mcqs || []}
                onChange={mcqs => setEditLesson(prev => prev ? { ...prev, mcqs } : prev)}
              />
            </div>
          )}

          <div className="pb-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-white">{subjectName}</h2>
          <p className="text-xs text-slate-500">{className} • {lessons.length} lessons</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> New Lesson
        </button>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {lessons.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No lessons yet</p>
            <p className="text-sm mt-1">Add your first lesson to get started</p>
          </div>
        )}

        {lessons.map(lesson => (
          <div key={lesson.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-blue-600">{lesson.order}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-white truncate">{lesson.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {lesson.features.readingEnabled && (
                    <button onClick={() => onOpenLesson?.(lesson, "reading")}
                      className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-xs font-medium">📖 Reading</button>
                  )}
                  {lesson.features.writingEnabled && (
                    <button onClick={() => onOpenLesson?.(lesson, "writing")}
                      className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded-full text-xs font-medium">✏️ Writing</button>
                  )}
                  {lesson.features.pdfEnabled && (
                    <button onClick={() => onOpenLesson?.(lesson, "pdf")}
                      className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full text-xs font-medium">📄 PDF</button>
                  )}
                  {lesson.features.mcqEnabled && (
                    <button onClick={() => onOpenLesson?.(lesson, "mcq")}
                      className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full text-xs font-medium">
                      ❓ MCQ {lesson.mcqs?.length ? `(${lesson.mcqs.length})` : ""}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(lesson)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Edit3 className="w-4 h-4 text-slate-500" />
                </button>
                <button onClick={() => handleDelete(lesson.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
