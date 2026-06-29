// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import type { SchoolLesson } from "../../school-types";
import { LessonView } from "../LessonView";
import { AdminWhiteBoard } from "../AdminWhiteBoard";
import type { LessonContent, Subject, Chapter, MCQItem } from "../../types";
import {
  BookOpen, Edit3, FileText, HelpCircle, X,
  Download, WifiOff, ExternalLink, LayoutGrid, ChevronDown,
  RotateCcw, Maximize2, Minimize2, BrainCircuit, Sparkles,
  ChevronRight, CheckCircle, RefreshCw, Trash2, Save, Plus, Check,
} from "lucide-react";
import { saveLesson, deleteLesson } from "../../school-firebase";
import type { LessonMCQ } from "../../school-types";

type Mode = "reading" | "writing" | "pdf" | "mcq";
type NightMode = "normal" | "night" | "sepia";
type McqViewMode = "reveal" | "interactive";

interface Props {
  lesson: SchoolLesson;
  initialMode: Mode;
  studentId?: string;
  studentName?: string;
  schoolId?: string;
  isAdmin?: boolean;
  onBack: () => void;
  onMCQComplete?: (score: number, total: number) => void;
}

function makeLessonContent(lesson: SchoolLesson, mode: Mode): LessonContent | null {
  const base = {
    id: `school_${lesson.id}_${mode}`,
    title: lesson.title,
    subtitle: "",
    dateCreated: lesson.createdAt || new Date().toISOString(),
    subjectName: "",
    content: "",
  };

  if (mode === "reading") {
    if (!lesson.readingContent && !lesson.impNotes) return null;
    const html = [
      lesson.impNotes
        ? `<div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:12px 16px;margin-bottom:16px;">
            <strong style="color:#a16207;">⭐ Important Notes</strong>
            <p style="margin-top:6px;color:#92400e;">${lesson.impNotes}</p>
           </div>`
        : "",
      lesson.readingContent || "",
    ].join("");
    return { ...base, type: "NOTES_HTML_FREE", content: html };
  }

  if (mode === "writing") {
    if (!lesson.writingContent) return null;
    return { ...base, type: "NOTES_HTML_FREE", content: lesson.writingContent };
  }

  return null;
}

const STUB_SUBJECT: Subject = { id: "school", name: "School", icon: "📚", color: "#3b82f6" };
const STUB_CLASS = "COMPETITION" as const;

const MODE_META: Record<Mode, { icon: React.ReactNode; emoji: string; label: string; color: string; desc: string }> = {
  reading: { icon: <BookOpen className="w-5 h-5" />, emoji: "📖", label: "Reading",  color: "#2563eb", desc: "Notes padhein" },
  writing: { icon: <Edit3    className="w-5 h-5" />, emoji: "✏️", label: "Writing",  color: "#7c3aed", desc: "Board-style content" },
  pdf:     { icon: <FileText className="w-5 h-5" />, emoji: "📄", label: "PDF",      color: "#ea580c", desc: "PDF dekhein" },
  mcq:     { icon: <HelpCircle className="w-5 h-5"/>, emoji: "❓", label: "MCQ",      color: "#16a34a", desc: "Practice karein" },
};

function downloadHtml(html: string, title: string) {
  const safeTitle = title.replace(/[^a-z0-9_\- ]/gi, "_").slice(0, 60);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1e293b;}h1,h2,h3{color:#1e293b;}img{max-width:100%;}</style>
</head><body><h2>${safeTitle}</h2>${html}</body></html>`;
  const blob = new Blob([fullHtml], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${safeTitle}.html`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

function getPdfIframeUrl(pdfUrl: string): string {
  const driveMatch = pdfUrl.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview?rm=minimal`;
  }
  return pdfUrl;
}

export const SmartClass: React.FC<Props> = ({
  lesson, initialMode, onBack, onMCQComplete, isAdmin,
}) => {
  const schoolControlsRef = useRef<(() => void) | null>(null);

  const enabledModes: Mode[] = (["reading", "writing", "pdf", "mcq"] as Mode[]).filter((m) => {
    if (m === "reading") return lesson.features.readingEnabled;
    if (m === "writing") return lesson.features.writingEnabled;
    if (m === "pdf")     return lesson.features.pdfEnabled;
    if (m === "mcq")     return lesson.features.mcqEnabled;
    return false;
  });

  const [mode, setMode]                   = useState<Mode>(() =>
    enabledModes.includes(initialMode) ? initialMode : (enabledModes[0] || "reading")
  );
  const [showModePopup, setShowModePopup]         = useState(false);
  const [showContextSheet, setShowContextSheet]   = useState(false);
  const [showAdminBoard, setShowAdminBoard]        = useState(false);
  const [savedMsg, setSavedMsg]                   = useState<string | null>(null);

  // ── Quick Edit (admin only) ─────────────────────────────────────────────────
  const [showEditSheet, setShowEditSheet]         = useState(false);
  const [editDraft, setEditDraft]                 = useState<import("../../school-types").SchoolLesson | null>(null);
  const [editSheetTab, setEditSheetTab]           = useState<"general" | "reading" | "writing" | "pdf" | "mcq">("general");
  const [editSaving, setEditSaving]               = useState(false);
  const [editDeleting, setEditDeleting]           = useState(false);
  const [selectedMcqIds, setSelectedMcqIds]       = useState<Set<string>>(new Set());
  const [editMcqExpanded, setEditMcqExpanded]     = useState<string | null>(null); // stores MCQ id, not index

  // PDF state
  const [pdfRotated, setPdfRotated]   = useState(false);
  const [pdfNight, setPdfNight]       = useState<NightMode>("normal");
  const [pdfImmersive, setPdfImmersive] = useState(false);

  // MCQ state
  const [mcqViewMode, setMcqViewMode]     = useState<McqViewMode>("reveal");
  const [mcqRevealed, setMcqRevealed]     = useState(0);
  const [mcqAnswers, setMcqAnswers]       = useState<Record<number, number>>({});
  const [mcqSubmitted, setMcqSubmitted]   = useState<Record<number, boolean>>({});
  const [mcqCurrentIdx, setMcqCurrentIdx] = useState(0);
  const [mcqShowReview, setMcqShowReview] = useState(false);
  const mcqAutoNextRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    schoolControlsRef.current = () => setShowContextSheet(v => !v);
  }, []);

  // Reset MCQ state when mode changes
  useEffect(() => {
    if (mode === "mcq") {
      setMcqRevealed(0);
      setMcqAnswers({});
      setMcqSubmitted({});
      setMcqCurrentIdx(0);
      setMcqShowReview(false);
      setMcqViewMode("reveal");
    }
  }, [mode]);

  const handleModeSwitch = (m: Mode) => {
    setMode(m);
    setShowModePopup(false);
  };

  const handleSaveOffline = () => {
    const title = lesson.title || "Lesson";
    if (mode === "writing" && lesson.writingContent) {
      downloadHtml(lesson.writingContent, `${title} · Write Mode`);
      showSavedMsg("📥 Write mode saved!");
    } else if (mode === "reading" && (lesson.readingContent || lesson.impNotes)) {
      const html = [
        lesson.impNotes ? `<p><strong>⭐ Important:</strong> ${lesson.impNotes}</p>` : "",
        lesson.readingContent || "",
      ].join("");
      downloadHtml(html, `${title} · Reading`);
      showSavedMsg("📥 Reading notes saved!");
    } else if (mode === "pdf" && lesson.pdfUrl) {
      window.open(lesson.pdfUrl, "_blank");
      showSavedMsg("📄 PDF opened in browser");
    } else {
      showSavedMsg("⚠️ Is mode mein koi content nahi hai");
    }
    setShowContextSheet(false);
  };

  const showSavedMsg = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2800);
  };

  // ── Quick-edit handlers ─────────────────────────────────────────────────────
  const openEditSheet = () => {
    setEditDraft({ ...lesson, mcqs: lesson.mcqs ? lesson.mcqs.map(q => ({ ...q, options: [...q.options] })) : [] });
    setSelectedMcqIds(new Set());
    setEditMcqExpanded(null);
    const tabMap: Record<Mode, "general" | "reading" | "writing" | "pdf" | "mcq"> =
      { reading: "reading", writing: "writing", pdf: "pdf", mcq: "mcq" };
    setEditSheetTab(tabMap[mode] ?? "general");
    setShowEditSheet(true);
  };

  const handleQuickSave = async () => {
    if (!editDraft) return;
    setEditSaving(true);
    try {
      await saveLesson(editDraft);
      setShowEditSheet(false);
      showSavedMsg("✅ Lesson save ho gaya!");
    } catch {
      showSavedMsg("❌ Save fail — dobara try karo");
    } finally {
      setEditSaving(false);
    }
  };

  const handleQuickDeleteLesson = async () => {
    if (!window.confirm(`"${lesson.title}" permanently delete karo? Yeh wapas nahi aayega.`)) return;
    setEditDeleting(true);
    try {
      await deleteLesson(lesson.schoolId, lesson.id);
      onBack();
    } catch {
      showSavedMsg("❌ Delete fail — dobara try karo");
      setEditDeleting(false);
    }
  };

  const toggleMcqSelect = (id: string) =>
    setSelectedMcqIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleDeleteSelectedMcqs = () => {
    if (!editDraft || selectedMcqIds.size === 0) return;
    setEditDraft(prev => prev ? { ...prev, mcqs: (prev.mcqs || []).filter(q => !selectedMcqIds.has(q.id)) } : prev);
    setSelectedMcqIds(new Set());
  };

  const addEmptyMcq = () => {
    const newQ: LessonMCQ = {
      id: `mcq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "",
    };
    setEditDraft(prev => prev ? { ...prev, mcqs: [...(prev.mcqs || []), newQ] } : prev);
    setEditMcqExpanded(newQ.id);
  };

  // ── Admin UI: FAB + full-screen edit sheet ──────────────────────────────────
  const adminEditUI = isAdmin ? (
    <>
      {/* Floating Edit button — z-[320] stays above PDF focus FAB (z-300); placed at bottom-20 so it doesn't overlap */}
      <button
        onClick={openEditSheet}
        className="fixed bottom-20 right-4 z-[320] w-12 h-12 rounded-full shadow-xl flex flex-col items-center justify-center active:scale-90 transition-all border-2 border-white/40"
        style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
        title="Edit Lesson"
      >
        <Edit3 size={16} className="text-white" />
        <span style={{ fontSize: 7, fontWeight: 900, color: "#fff", lineHeight: 1, marginTop: 2 }}>EDIT</span>
      </button>

      {/* Full-screen Quick Edit Sheet */}
      {showEditSheet && editDraft && (
        <div className="fixed inset-0 z-[700] flex flex-col bg-white dark:bg-slate-900">
          {/* ── Header bar ── */}
          <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", padding: "12px 14px" }}
            className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowEditSheet(false)}
              className="bg-white/20 hover:bg-white/30 p-1.5 rounded-xl active:scale-90 transition shrink-0">
              <X size={16} className="text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Admin Quick Edit</p>
              <p className="font-black text-sm text-white truncate">{editDraft.title || "Lesson"}</p>
            </div>
            <button onClick={handleQuickSave} disabled={editSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 rounded-xl text-xs font-black active:scale-95 transition disabled:opacity-60 shrink-0">
              <Save size={12} /> {editSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={handleQuickDeleteLesson} disabled={editDeleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/25 text-white border border-red-400/40 rounded-xl text-xs font-black active:scale-95 transition disabled:opacity-60 shrink-0">
              <Trash2 size={12} /> {editDeleting ? "…" : "Del"}
            </button>
          </div>

          {/* ── Tab bar ── */}
          <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
            {(["general", "reading", "writing", "pdf", "mcq"] as const).map(t => (
              <button key={t} onClick={() => setEditSheetTab(t)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0 ${editSheetTab === t ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                {t === "general" ? "⚙️ General" : t === "reading" ? "📖 Reading" : t === "writing" ? "✏️ Writing" : t === "pdf" ? "📄 PDF" : "❓ MCQ"}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* GENERAL */}
            {editSheetTab === "general" && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Lesson Title</label>
                  <input value={editDraft.title}
                    onChange={e => setEditDraft(prev => prev ? { ...prev, title: e.target.value } : prev)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    placeholder="Lesson title…" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Order</label>
                  <input type="number" value={editDraft.order} min={1}
                    onChange={e => setEditDraft(prev => prev ? { ...prev, order: Number(e.target.value) } : prev)}
                    className="w-24 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mt-6">
                  <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wide mb-3">⚠️ Danger Zone</p>
                  <button onClick={handleQuickDeleteLesson} disabled={editDeleting}
                    className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
                    <Trash2 size={14} /> {editDeleting ? "Deleting…" : "Yeh Lesson Delete Karo"}
                  </button>
                </div>
              </div>
            )}

            {/* READING */}
            {editSheetTab === "reading" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Reading Content (HTML / Plain Text)</label>
                  <textarea value={editDraft.readingContent || ""}
                    onChange={e => setEditDraft(prev => prev ? { ...prev, readingContent: e.target.value } : prev)}
                    rows={14} placeholder="Reading content yahan likhein…"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 font-mono resize-none focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-600 uppercase tracking-wide block mb-1.5">⭐ Important Notes</label>
                  <textarea value={editDraft.impNotes || ""}
                    onChange={e => setEditDraft(prev => prev ? { ...prev, impNotes: e.target.value } : prev)}
                    rows={4} placeholder="Important points…"
                    className="w-full px-3 py-2 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-slate-800 dark:text-white bg-amber-50/50 dark:bg-amber-900/10 resize-none focus:ring-2 focus:ring-amber-400 focus:outline-none" />
                </div>
              </div>
            )}

            {/* WRITING */}
            {editSheetTab === "writing" && (
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Writing Content (HTML / Plain Text)</label>
                <textarea value={editDraft.writingContent || ""}
                  onChange={e => setEditDraft(prev => prev ? { ...prev, writingContent: e.target.value } : prev)}
                  rows={22} placeholder="Writing / board content yahan likhein…"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 font-mono resize-none focus:ring-2 focus:ring-purple-400 focus:outline-none" />
              </div>
            )}

            {/* PDF */}
            {editSheetTab === "pdf" && (
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">PDF URL</label>
                <input value={editDraft.pdfUrl || ""}
                  onChange={e => setEditDraft(prev => prev ? { ...prev, pdfUrl: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                  placeholder="https://drive.google.com/file/d/…" />
              </div>
            )}

            {/* MCQ */}
            {editSheetTab === "mcq" && (
              <div className="space-y-3">

                {/* Multi-select action bar */}
                {selectedMcqIds.size > 0 && (
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                    <span className="text-xs font-black text-red-700 dark:text-red-400 flex-1">{selectedMcqIds.size} selected</span>
                    <button onClick={handleDeleteSelectedMcqs}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-black active:scale-95 transition">
                      <Trash2 size={11} /> Delete Selected
                    </button>
                    <button onClick={() => setSelectedMcqIds(new Set())}
                      className="text-xs font-bold text-red-400 px-1">✕</button>
                  </div>
                )}

                {/* MCQ list */}
                {(editDraft.mcqs || []).length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Koi MCQ nahi hai</p>
                    <p className="text-xs mt-1">Neeche "Question Add Karo" tap karo</p>
                  </div>
                )}

                {(editDraft.mcqs || []).map((q, qi) => {
                  const isSel = selectedMcqIds.has(q.id);
                  const isExp = editMcqExpanded === q.id;
                  return (
                    <div key={q.id}
                      className={`border-2 rounded-xl overflow-hidden transition-all ${isSel ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
                      {/* Header row */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Checkbox */}
                        <button onClick={() => toggleMcqSelect(q.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSel ? "bg-red-500 border-red-500 text-white" : "border-slate-300 dark:border-slate-500"}`}>
                          {isSel && <Check size={11} />}
                        </button>
                        {/* Number */}
                        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center shrink-0">{qi + 1}</span>
                        {/* Question preview */}
                        <button className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 text-left truncate"
                          onClick={() => setEditMcqExpanded(isExp ? null : q.id)}>
                          {q.question.trim() || "Question likhein…"}
                        </button>
                        {/* Delete this MCQ — also deselects and collapses */}
                        <button
                          onClick={() => {
                            setEditDraft(prev => prev ? { ...prev, mcqs: (prev.mcqs || []).filter(mq => mq.id !== q.id) } : prev);
                            if (editMcqExpanded === q.id) setEditMcqExpanded(null);
                            setSelectedMcqIds(prev => { const s = new Set(prev); s.delete(q.id); return s; });
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 shrink-0 active:scale-90 transition">
                          <Trash2 size={13} />
                        </button>
                        {/* Expand */}
                        <button onClick={() => setEditMcqExpanded(isExp ? null : q.id)}
                          className="p-1 text-slate-400 shrink-0">
                          <ChevronDown size={14} className={`transition-transform ${isExp ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {/* Expanded inline editor */}
                      {isExp && (
                        <div className="border-t border-slate-100 dark:border-slate-700 p-3 space-y-3 bg-slate-50 dark:bg-slate-800/60">
                          <textarea value={q.question}
                            onChange={e => setEditDraft(prev => {
                              if (!prev) return prev;
                              return { ...prev, mcqs: (prev.mcqs || []).map((mq, i) => i === qi ? { ...mq, question: e.target.value } : mq) };
                            })}
                            rows={2} placeholder="Question…"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                          {/* Options */}
                          <div className="space-y-1.5">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditDraft(prev => prev ? {
                                    ...prev,
                                    mcqs: (prev.mcqs || []).map((mq, i) => i === qi ? { ...mq, correctIndex: oi } : mq)
                                  } : prev)}
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${q.correctIndex === oi ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-slate-500"}`}>
                                  {q.correctIndex === oi && <Check size={10} />}
                                </button>
                                <span className="text-[10px] font-black text-slate-400 shrink-0">{String.fromCharCode(65 + oi)}</span>
                                <input value={opt}
                                  onChange={e => setEditDraft(prev => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      mcqs: (prev.mcqs || []).map((mq, i) => {
                                        if (i !== qi) return mq;
                                        const options = [...mq.options]; options[oi] = e.target.value; return { ...mq, options };
                                      })
                                    };
                                  })}
                                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                  className={`flex-1 px-2 py-1.5 border rounded-lg text-xs text-slate-800 dark:text-white bg-white dark:bg-slate-800 focus:outline-none ${q.correctIndex === oi ? "border-green-400" : "border-slate-200 dark:border-slate-600"}`} />
                              </div>
                            ))}
                          </div>
                          {/* Explanation */}
                          <input value={q.explanation || ""}
                            onChange={e => setEditDraft(prev => prev ? {
                              ...prev,
                              mcqs: (prev.mcqs || []).map((mq, i) => i === qi ? { ...mq, explanation: e.target.value } : mq)
                            } : prev)}
                            placeholder="Explanation (optional)"
                            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-white bg-white dark:bg-slate-800 focus:outline-none" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Question */}
                <button onClick={addEmptyMcq}
                  className="w-full py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-98 transition-all">
                  <Plus size={14} /> Question Add Karo
                </button>

                <div className="pb-8" />
              </div>
            )}

          </div>
        </div>
      )}
    </>
  ) : null;

  const mcqs = lesson.mcqs || [];

  // ── PDF VIEW ───────────────────────────────────────────────────────────────
  if (mode === "pdf") {
    const pdfUrl = lesson.pdfUrl;
    const isDrive = pdfUrl?.includes("drive.google.com");

    const pdfFilter = pdfNight === "night"
      ? "invert(0.9) hue-rotate(180deg) brightness(0.85)"
      : pdfNight === "sepia"
      ? "sepia(0.8) brightness(0.9) contrast(0.9)"
      : "none";

    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900">
        {/* Top bar */}
        {!pdfImmersive && (
          <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ background: "linear-gradient(135deg,#ea580c,#dc2626)" }}>
            <button onClick={onBack} className="bg-white/20 hover:bg-white/30 p-2 rounded-full shrink-0 transition-colors">
              <ChevronRight size={18} className="rotate-180 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">PDF Mode</p>
              <p className="font-black text-sm text-white leading-tight truncate">{lesson.title}</p>
            </div>
            {/* Rotate */}
            <button
              onClick={() => setPdfRotated(r => !r)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all active:scale-90 shrink-0 ${pdfRotated ? "bg-emerald-500/30 border-emerald-400/50 text-emerald-300" : "bg-white/15 border-white/25 text-white"}`}
              title="Rotate PDF"
            >
              <RotateCcw size={14} />
            </button>
            {/* Immersive */}
            <button
              onClick={() => setPdfImmersive(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-xl border bg-white/15 border-white/25 text-white active:scale-90 transition-all shrink-0"
              title="Focus Mode"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        )}

        {/* iframe area */}
        <div className="flex-1 overflow-hidden relative bg-white">
          {pdfUrl ? (
            <div
              style={{
                filter: pdfFilter,
                ...(pdfRotated
                  ? {
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: "100vh",
                      height: "100vw",
                      transform: "translate(-50%, -50%) rotate(90deg)",
                      transformOrigin: "center center",
                    }
                  : { position: "absolute", inset: 0, width: "100%", height: "100%" }),
              }}
            >
              <iframe
                src={getPdfIframeUrl(pdfUrl)}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                allow="autoplay"
                title="Lesson PDF"
              />
              {isDrive && (
                <div
                  className="absolute top-0 right-0 bg-orange-800/80 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg z-10 select-none"
                  style={{ pointerEvents: "all", cursor: "default" }}
                  title="Stay in the App"
                >
                  🔒 App
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <FileText size={48} className="opacity-30" />
              <p className="text-sm font-bold">PDF not added yet</p>
            </div>
          )}
        </div>

        {/* Immersive FAB */}
        {pdfImmersive && (
          <button
            onClick={() => setPdfImmersive(false)}
            className="fixed bottom-4 right-4 z-[300] w-12 h-12 rounded-full bg-indigo-700 border-2 border-indigo-400 shadow-xl flex flex-col items-center justify-center text-white active:scale-90 transition-all"
            title="Exit Focus Mode"
          >
            <Minimize2 size={16} />
            <span style={{ fontSize: "7px", fontWeight: 900, lineHeight: 1, marginTop: "2px" }}>EXIT</span>
          </button>
        )}
        {!pdfImmersive && (
          <button
            onClick={() => setPdfImmersive(true)}
            className="fixed bottom-4 right-4 z-[300] w-12 h-12 rounded-full shadow-xl flex flex-col items-center justify-center text-white active:scale-90 transition-all overflow-hidden border-2 border-white/40"
            style={{ background: "rgba(15,23,42,0.88)", backdropFilter: "blur(10px)" }}
            title="Focus Mode"
          >
            <span style={{ fontSize: "15px", lineHeight: 1 }}>🎯</span>
            <span style={{ fontSize: "7px", fontWeight: 900, lineHeight: 1, marginTop: "2px" }}>FOCUS</span>
          </button>
        )}

        {/* Admin board */}
        {isAdmin && showAdminBoard && <AdminWhiteBoard onClose={() => setShowAdminBoard(false)} />}

        {/* Mode popup */}
        {showModePopup && (
          <ModePopup modes={enabledModes} active={mode} onSelect={handleModeSwitch} onClose={() => setShowModePopup(false)} />
        )}

        {/* Admin Edit FAB + Sheet */}
        {adminEditUI}
      </div>
    );
  }

  // ── MCQ VIEW ───────────────────────────────────────────────────────────────
  if (mode === "mcq") {
    const totalQ = mcqs.length;

    // Stats
    const attempted = mcqs.reduce((acc, _, i) => mcqSubmitted[i] ? acc + 1 : acc, 0);
    const right = mcqs.reduce((acc, q, i) => {
      if (!mcqSubmitted[i]) return acc;
      return mcqAnswers[i] === q.correctIndex ? acc + 1 : acc;
    }, 0);
    const wrong = attempted - right;

    const doRestart = () => {
      if (mcqAutoNextRef.current) clearTimeout(mcqAutoNextRef.current);
      setMcqAnswers({});
      setMcqSubmitted({});
      setMcqCurrentIdx(0);
      setMcqShowReview(false);
      setMcqRevealed(0);
    };

    const handleOptionClick = (qi: number, oi: number) => {
      if (mcqSubmitted[qi]) return;
      setMcqAnswers(prev => ({ ...prev, [qi]: oi }));
      setMcqSubmitted(prev => ({ ...prev, [qi]: true }));
      if (qi < totalQ - 1) {
        if (mcqAutoNextRef.current) clearTimeout(mcqAutoNextRef.current);
        mcqAutoNextRef.current = setTimeout(() => {
          setMcqCurrentIdx(qi + 1);
        }, 400);
      }
    };

    // Grade for review
    const pct = attempted > 0 ? Math.round((right / attempted) * 100) : 0;
    const grade = pct >= 80
      ? { label: "🏆 Excellent!", color: "text-emerald-700", bg: "from-emerald-400 to-teal-500" }
      : pct >= 60
      ? { label: "👍 Good Job!", color: "text-indigo-700", bg: "from-indigo-400 to-blue-500" }
      : pct >= 40
      ? { label: "💪 Keep Trying!", color: "text-amber-700", bg: "from-amber-400 to-orange-500" }
      : { label: "📚 Study More", color: "text-rose-700", bg: "from-rose-400 to-pink-500" };

    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
          <button onClick={onBack} className="bg-white/20 hover:bg-white/30 p-2 rounded-full shrink-0 transition-colors">
            <ChevronRight size={18} className="rotate-180 text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">MCQ Practice</p>
            <p className="font-black text-sm text-white leading-tight truncate">{lesson.title}</p>
          </div>
          <span className="bg-white/20 px-2.5 py-1 rounded-full text-[11px] font-black text-white whitespace-nowrap">
            {totalQ} Qs
          </span>
          {enabledModes.length > 1 && (
            <button
              onClick={() => setShowModePopup(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 border border-white/25 text-white active:scale-90 transition-all shrink-0"
              title="Switch Mode"
            >
              <LayoutGrid size={14} />
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-3 pb-8">
            {/* Header card */}
            <div className="bg-white border border-green-100 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <BrainCircuit size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  Lesson MCQs
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">Admin</span>
                </p>
                <p className="text-[10px] font-bold text-slate-500">{totalQ} admin-curated questions</p>
              </div>
              <button
                onClick={doRestart}
                className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition flex items-center gap-1"
                title="Restart"
              >
                <RefreshCw size={11} /> Restart
              </button>
            </div>

            {/* Mode selector */}
            {totalQ > 0 && (
              <div className="bg-white border border-green-100 rounded-2xl p-1.5 grid grid-cols-2 gap-1 shadow-sm">
                <button
                  onClick={() => setMcqViewMode("reveal")}
                  className={`text-[11px] font-black uppercase tracking-wider py-2 rounded-xl transition-all ${
                    mcqViewMode === "reveal" ? "bg-purple-600 text-white shadow-sm" : "bg-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  💬 Q&amp;A
                </button>
                <button
                  onClick={() => setMcqViewMode("interactive")}
                  className={`text-[11px] font-black uppercase tracking-wider py-2 rounded-xl transition-all ${
                    mcqViewMode === "interactive" ? "bg-indigo-600 text-white shadow-sm" : "bg-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  📝 MCQ
                </button>
              </div>
            )}

            {totalQ === 0 && (
              <div className="bg-white border border-green-100 rounded-2xl p-6 text-center">
                <BrainCircuit size={42} className="text-green-300 mx-auto mb-3" />
                <p className="font-black text-sm text-slate-700">No MCQs added yet</p>
                <p className="text-[11px] text-slate-500 mt-1">Admin ne abhi MCQs nahi add kiye hain</p>
              </div>
            )}

            {/* ── REVEAL (Q&A) MODE ── */}
            {totalQ > 0 && mcqViewMode === "reveal" && (() => {
              return (
                <>
                  {mcqRevealed < totalQ && (
                    <button
                      onClick={() => setMcqRevealed(totalQ)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs active:scale-95 transition shadow-md flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} /> Show All Answers
                    </button>
                  )}
                  {mcqs.map((q, qi) => {
                    const isRevealed = qi < mcqRevealed;
                    const answerText = (q.options || [])[q.correctIndex] || "—";
                    const answerLetter = String.fromCharCode(65 + q.correctIndex);
                    return (
                      <div key={qi} className="bg-white border border-purple-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">Q {qi + 1}</span>
                        </div>
                        <p className="text-sm font-black text-slate-800 leading-snug mb-2">{q.question}</p>
                        {!isRevealed ? (
                          <button
                            onClick={() => setMcqRevealed(prev => Math.max(prev, qi + 1))}
                            className="w-full py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 font-black text-xs active:scale-95 transition flex items-center justify-center gap-2"
                          >
                            👁 Answer dekhein
                          </button>
                        ) : (
                          <>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 mb-2">
                              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">{answerLetter}</span>
                              <p className="text-sm font-black text-emerald-900 flex-1">{answerText}</p>
                            </div>
                            {q.explanation && (
                              <div className="text-[11px] leading-relaxed">
                                <p className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-slate-700">
                                  <span className="font-black text-slate-700">🔎</span> {q.explanation}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {/* ── INTERACTIVE (MCQ) MODE ── */}
            {totalQ > 0 && mcqViewMode === "interactive" && (() => {
              const ci = mcqCurrentIdx;
              const cq = mcqs[ci];
              if (!cq) return null;
              const isAnswered = mcqSubmitted[ci] === true;
              const selected = mcqAnswers[ci];
              const isCorrect = isAnswered && selected === cq.correctIndex;
              const canShowReview = attempted >= Math.min(totalQ, totalQ);

              // Review screen
              if (mcqShowReview) {
                return (
                  <div>
                    <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm text-center mb-3">
                      <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${grade.bg} flex items-center justify-center text-2xl mb-2 shadow-md`}>
                        {pct >= 80 ? "🏆" : pct >= 60 ? "⭐" : pct >= 40 ? "💪" : "📚"}
                      </div>
                      <p className={`text-base font-black ${grade.color} mb-0.5`}>{grade.label}</p>
                      <p className="text-3xl font-black text-slate-800 mb-0.5">{pct}%</p>
                      <p className="text-[11px] text-slate-500 mb-3">You got {right} correct out of {attempted}</p>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-xl py-2">
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Tried</div>
                          <div className="text-lg font-black text-slate-800">{attempted}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-xl py-2">
                          <div className="text-[9px] font-bold text-emerald-600 uppercase">✅ Correct</div>
                          <div className="text-lg font-black text-emerald-700">{right}</div>
                        </div>
                        <div className="bg-rose-50 rounded-xl py-2">
                          <div className="text-[9px] font-bold text-rose-600 uppercase">❌ Wrong</div>
                          <div className="text-lg font-black text-rose-700">{wrong}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMcqShowReview(false)}
                          className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm active:scale-95 transition"
                        >
                          ▶ Continue
                        </button>
                        <button
                          onClick={doRestart}
                          className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 transition shadow-md"
                        >
                          <RefreshCw size={13} /> Restart
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2">📋 Answer Review ({attempted} questions)</p>
                    <div className="space-y-3">
                      {mcqs.map((q2, qi) => {
                        if (!mcqSubmitted[qi]) return null;
                        const userAns = mcqAnswers[qi];
                        const isQ2Correct = userAns === q2.correctIndex;
                        return (
                          <div key={qi} className={`bg-white rounded-2xl p-3 border-2 ${isQ2Correct ? "border-emerald-200" : "border-rose-200"}`}>
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${isQ2Correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                Q{qi + 1} {isQ2Correct ? "✅" : "❌"}
                              </span>
                              <p className="text-xs font-bold text-slate-800 leading-snug flex-1">{q2.question}</p>
                            </div>
                            <div className="space-y-1 ml-1">
                              {(q2.options || []).map((opt, oi) => {
                                const isOpt = oi === q2.correctIndex;
                                const isSel = userAns === oi;
                                let cls = "text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 ";
                                if (isOpt) cls += "bg-emerald-50 text-emerald-800";
                                else if (isSel && !isOpt) cls += "bg-rose-50 text-rose-800 line-through";
                                else cls += "text-slate-400";
                                return (
                                  <div key={oi} className={cls}>
                                    <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black shrink-0">{String.fromCharCode(65 + oi)}</span>
                                    {opt}
                                    {isOpt && <span className="ml-auto text-emerald-600">✅</span>}
                                    {isSel && !isOpt && <span className="ml-auto text-rose-600">❌</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {q2.explanation && (
                              <p className="mt-1.5 text-[10px] bg-slate-50 rounded-lg px-2 py-1 text-slate-600">
                                <span className="font-black">💡</span> {q2.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div>
                  {/* Stats bar */}
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    <div className="bg-slate-100 rounded-xl py-2 text-center">
                      <div className="text-[9px] font-bold text-slate-500 uppercase">Tried</div>
                      <div className="text-sm font-black text-slate-800">{attempted}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-xl py-2 text-center">
                      <div className="text-[9px] font-bold text-emerald-600 uppercase">✅ Correct</div>
                      <div className="text-sm font-black text-emerald-700">{attempted > 0 ? right : "?"}</div>
                    </div>
                    <div className="bg-rose-50 rounded-xl py-2 text-center">
                      <div className="text-[9px] font-bold text-rose-600 uppercase">❌ Wrong</div>
                      <div className="text-sm font-black text-rose-700">{attempted > 0 ? wrong : "?"}</div>
                    </div>
                    <div className="bg-indigo-50 rounded-xl py-2 text-center">
                      <div className="text-[9px] font-bold text-indigo-600 uppercase">🏆 Score</div>
                      <div className="text-sm font-black text-indigo-700">{attempted > 0 ? `${right}/${attempted}` : "?"}</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-black text-slate-600 shrink-0">
                      <span className="text-indigo-600">{ci + 1}</span>/{totalQ}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all rounded-full" style={{ width: `${((ci + 1) / Math.max(1, totalQ)) * 100}%` }} />
                    </div>
                    {attempted > 0 && <span className="text-[10px] font-bold text-slate-500 shrink-0">{attempted} done</span>}
                  </div>

                  {/* Submit & Review */}
                  {attempted >= totalQ && totalQ > 0 && (
                    <button
                      onClick={() => {
                        setMcqShowReview(true);
                        if (onMCQComplete) onMCQComplete(right, totalQ);
                      }}
                      className="w-full mb-3 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-md"
                    >
                      <CheckCircle size={15} /> Submit &amp; Review ({attempted}/{totalQ})
                    </button>
                  )}

                  {/* Single question card */}
                  <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">Q {ci + 1}</span>
                    </div>
                    <p className="text-sm font-black text-slate-800 leading-snug mb-3">{cq.question}</p>
                    <div className="space-y-2">
                      {(cq.options || []).map((opt, oi) => {
                        const isCorrectOpt = oi === cq.correctIndex;
                        const isSelected = selected === oi;
                        let cls = "w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] font-bold text-sm ";
                        if (!isAnswered) {
                          cls += "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-slate-700";
                        } else if (isCorrectOpt) {
                          cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                        } else if (isSelected) {
                          cls += "border-rose-400 bg-rose-50 text-rose-800";
                        } else {
                          cls += "border-slate-100 bg-slate-50 text-slate-400";
                        }
                        return (
                          <button
                            key={oi}
                            onClick={() => handleOptionClick(ci, oi)}
                            disabled={isAnswered}
                            className={cls}
                          >
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              !isAnswered ? "bg-slate-100 text-slate-600"
                              : isCorrectOpt ? "bg-emerald-500 text-white"
                              : isSelected ? "bg-rose-500 text-white"
                              : "bg-slate-200 text-slate-400"
                            }`}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isAnswered && isCorrectOpt && <span className="text-emerald-600 shrink-0">✅</span>}
                            {isAnswered && isSelected && !isCorrectOpt && <span className="text-rose-600 shrink-0">❌</span>}
                          </button>
                        );
                      })}
                    </div>
                    {isAnswered && cq.explanation && (
                      <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[12px] text-slate-700">
                        <span className="font-black text-blue-700">💡 </span>{cq.explanation}
                      </div>
                    )}
                    {isAnswered && (
                      <div className="flex gap-2 mt-3">
                        {ci > 0 && (
                          <button
                            onClick={() => setMcqCurrentIdx(ci - 1)}
                            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                          >
                            <ChevronRight size={14} className="rotate-180" /> Prev
                          </button>
                        )}
                        {ci < totalQ - 1 && (
                          <button
                            onClick={() => setMcqCurrentIdx(ci + 1)}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-md"
                          >
                            Next <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Jump to question */}
                  {totalQ > 1 && (
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {mcqs.map((_, qi) => {
                        const isDone = mcqSubmitted[qi];
                        const isRight = isDone && mcqAnswers[qi] === mcqs[qi].correctIndex;
                        return (
                          <button
                            key={qi}
                            onClick={() => setMcqCurrentIdx(qi)}
                            className={`w-8 h-8 rounded-lg text-[11px] font-black transition-all active:scale-90 ${
                              qi === ci
                                ? "bg-indigo-600 text-white shadow-md"
                                : isDone
                                ? isRight ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                : "bg-white border border-slate-200 text-slate-500"
                            }`}
                          >
                            {qi + 1}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Admin board */}
        {isAdmin && showAdminBoard && <AdminWhiteBoard onClose={() => setShowAdminBoard(false)} />}

        {/* Mode popup */}
        {showModePopup && (
          <ModePopup modes={enabledModes} active={mode} onSelect={handleModeSwitch} onClose={() => setShowModePopup(false)} />
        )}

        {/* Toast */}
        {savedMsg && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/90 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 whitespace-nowrap">
            {savedMsg}
          </div>
        )}

        {/* Admin Edit FAB + Sheet */}
        {adminEditUI}
      </div>
    );
  }

  // ── READING / WRITING — use LessonView ────────────────────────────────────
  const content = makeLessonContent(lesson, mode);
  const stubChapter: Chapter = { id: lesson.id, title: lesson.title };

  if (!content) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">←</button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white truncate">{lesson.title}</h2>
          {enabledModes.length > 1 && (
            <button onClick={() => setShowModePopup(v => !v)} className="p-2 rounded-lg bg-indigo-600 text-white">
              <LayoutGrid className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
          <span className="text-5xl opacity-30">{MODE_META[mode]?.icon}</span>
          <p className="text-sm">No {mode} content added yet</p>
        </div>
        {showModePopup && enabledModes.length > 1 && (
          <ModePopup modes={enabledModes} active={mode} onSelect={handleModeSwitch} onClose={() => setShowModePopup(false)} />
        )}
        {/* Admin Edit FAB + Sheet */}
        {adminEditUI}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <LessonView
        key={`${lesson.id}-${mode}`}
        content={content}
        subject={STUB_SUBJECT}
        classLevel={STUB_CLASS}
        chapter={stubChapter}
        loading={false}
        onBack={onBack}
        schoolMode={true}
        schoolControlsRef={schoolControlsRef}
        onSchoolModeSwitch={enabledModes.length > 1 ? () => setShowModePopup(v => !v) : undefined}
        schoolModeSwitchDots={mode === "writing" || mode === "reading"}
        schoolSaveOffline={handleSaveOffline}
        onMCQComplete={(_count, answers, usedData) => {
          if (onMCQComplete && usedData) {
            const correct = Object.entries(answers).filter(
              ([i, ans]) => usedData[Number(i)]?.correctAnswer === ans
            ).length;
            onMCQComplete(correct, usedData.length);
          }
        }}
      />

      {/* ── CONTEXT BOTTOM SHEET (3-dot) ──────────────────────────── */}
      {showContextSheet && (
        <div
          className="fixed inset-0 z-[300] bg-black/30 backdrop-blur-[2px] flex items-end"
          onClick={() => setShowContextSheet(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-base" style={{ background: MODE_META[mode].color }}>
                {MODE_META[mode].emoji}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{lesson.title}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white">{MODE_META[mode].label} Mode — Options</p>
              </div>
              <button onClick={() => setShowContextSheet(false)} className="ml-auto p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {(mode === "writing" || mode === "reading") && (
                <button
                  onClick={handleSaveOffline}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <WifiOff className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-white">Save Offline</p>
                    <p className="text-xs text-slate-400">HTML file ke roop mein download karo</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 ml-auto" />
                </button>
              )}
              {enabledModes.length > 1 && (
                <button
                  onClick={() => { setShowContextSheet(false); setShowModePopup(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-white">Mode Switch Karo</p>
                    <p className="text-xs text-slate-400">Reading · Writing · PDF · MCQ</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto -rotate-90" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE PICKER POPUP ── */}
      {showModePopup && (
        <ModePopup modes={enabledModes} active={mode} onSelect={handleModeSwitch} onClose={() => setShowModePopup(false)} />
      )}

      {/* ── ADMIN BOARD ── */}
      {isAdmin && showAdminBoard && <AdminWhiteBoard onClose={() => setShowAdminBoard(false)} />}

      {/* ── SAVED TOAST ── */}
      {savedMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/90 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 whitespace-nowrap">
          {savedMsg}
        </div>
      )}

      {/* ── ADMIN EDIT FAB + SHEET ── */}
      {adminEditUI}
    </div>
  );
};

function ModePopup({ modes, active, onSelect, onClose }: {
  modes: Mode[];
  active: Mode;
  onSelect: (m: Mode) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[350] bg-black/30 backdrop-blur-[2px] flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-auto bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-800 dark:text-white text-base">Mode Switch Karo</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(["reading", "writing", "pdf", "mcq"] as Mode[]).map((m) => {
            const meta     = MODE_META[m];
            const isActive  = m === active;
            const isEnabled = modes.includes(m);
            return (
              <button
                key={m}
                onClick={() => isEnabled && onSelect(m)}
                disabled={!isEnabled}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-95 text-left ${
                  isActive
                    ? "border-transparent text-white shadow-lg"
                    : isEnabled
                    ? "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                    : "border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                }`}
                style={isActive ? { background: meta.color, borderColor: meta.color } : {}}
              >
                <span className="text-xl">{meta.emoji}</span>
                <div>
                  <p className={`font-black text-sm ${isActive ? "text-white" : isEnabled ? "" : "text-slate-300 dark:text-slate-600"}`}>{meta.label}</p>
                  <p className={`text-[10px] ${isActive ? "text-white/75" : "text-slate-400"}`}>{isEnabled ? meta.desc : "Available nahi"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
