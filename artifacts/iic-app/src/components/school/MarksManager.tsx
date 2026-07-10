// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getStudents, saveExam, getExams, deleteExam, generateId } from "../../school-firebase";
import type { SchoolStudent, ExamEntry } from "../../school-types";
import { Plus, Trash2, Save, ChevronLeft, BookOpen, Download, BarChart2 } from "lucide-react";

function getTotalGrade(pct: number) {
  if (pct >= 91) return "A+";
  if (pct >= 81) return "A";
  if (pct >= 71) return "B+";
  if (pct >= 61) return "B";
  if (pct >= 51) return "C+";
  if (pct >= 41) return "C";
  if (pct >= 33) return "D";
  return "F";
}
function getTotalGradeColor(pct: number) {
  if (pct >= 81) return "text-green-600";
  if (pct >= 61) return "text-blue-600";
  if (pct >= 41) return "text-yellow-600";
  return "text-red-600";
}

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  sessionId: string;
  teacherId: string;
  subjectId?: string;
  subjectName?: string;
  onBack?: () => void;
}

export const MarksManager: React.FC<Props> = ({
  schoolId, classId, className, sessionId, teacherId, subjectId = "", subjectName = "All Subjects", onBack
}) => {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [view, setView] = useState<"list" | "new" | "entry" | "totals">("list");
  const [selectedExam, setSelectedExam] = useState<ExamEntry | null>(null);
  const [saving, setSaving] = useState(false);

  // New exam form
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [maxMarks, setMaxMarks] = useState(100);
  const [examSubjectName, setExamSubjectName] = useState(subjectName);
  const [marksInput, setMarksInput] = useState<{ [id: string]: string }>({});
  const [absentMap, setAbsentMap] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    Promise.all([
      getStudents(schoolId, classId),
      getExams(schoolId, classId)
    ]).then(([sts, exs]) => {
      setStudents(sts);
      setExams(exs);
    });
  }, []);

  const startNewExam = () => {
    setExamName("");
    setExamDate(new Date().toISOString().split("T")[0]);
    setMaxMarks(100);
    setExamSubjectName(subjectName);
    const init: { [id: string]: string } = {};
    students.forEach(s => (init[s.id] = ""));
    setMarksInput(init);
    setAbsentMap({});
    setView("new");
  };

  const openExam = (exam: ExamEntry) => {
    setSelectedExam(exam);
    const m: { [id: string]: string } = {};
    const ab: { [id: string]: boolean } = {};
    students.forEach(s => {
      const sm = exam.studentMarks[s.id];
      m[s.id] = sm ? String(sm.marks) : "";
      ab[s.id] = sm?.absent || false;
    });
    setMarksInput(m);
    setAbsentMap(ab);
    setView("entry");
  };

  const saveNewExam = async () => {
    if (!examName.trim()) return;
    setSaving(true);
    const studentMarks: ExamEntry["studentMarks"] = {};
    students.forEach(s => {
      const m = parseFloat(marksInput[s.id]);
      studentMarks[s.id] = {
        marks: isNaN(m) ? 0 : Math.min(m, maxMarks),
        absent: absentMap[s.id] || false,
        studentName: s.name,
        rollNo: s.rollNo
      };
    });
    const exam: ExamEntry = {
      id: generateId(),
      schoolId, sessionId, classId,
      subjectId: subjectId || "",
      subjectName: examSubjectName,
      examName,
      examDate,
      maxMarks,
      markedBy: teacherId,
      studentMarks,
      createdAt: new Date().toISOString()
    };
    await saveExam(exam);
    const updated = await getExams(schoolId, classId);
    setExams(updated);
    setView("list");
    setSaving(false);
  };

  const updateExamMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);
    const studentMarks: ExamEntry["studentMarks"] = {};
    students.forEach(s => {
      const m = parseFloat(marksInput[s.id]);
      studentMarks[s.id] = {
        marks: isNaN(m) ? 0 : Math.min(m, selectedExam.maxMarks),
        absent: absentMap[s.id] || false,
        studentName: s.name,
        rollNo: s.rollNo
      };
    });
    await saveExam({ ...selectedExam, studentMarks });
    const updated = await getExams(schoolId, classId);
    setExams(updated);
    setView("list");
    setSaving(false);
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Delete this exam record?")) return;
    await deleteExam(schoolId, examId);
    setExams(prev => prev.filter(e => e.id !== examId));
  };

  const downloadExamReport = (exam: ExamEntry) => {
    const rows = students.map(s => {
      const sm = exam.studentMarks[s.id];
      const pct = sm && !sm.absent ? Math.round((sm.marks / exam.maxMarks) * 100) : null;
      return `<tr>
        <td>${s.rollNo}</td><td>${s.name}</td>
        <td style="text-align:center">${sm?.absent ? "<b>AB</b>" : (sm?.marks ?? "-")}</td>
        <td style="text-align:center">${exam.maxMarks}</td>
        <td style="text-align:center;color:${pct !== null ? (pct >= 60 ? "green" : "red") : "gray"}">${pct !== null ? pct + "%" : "-"}</td>
      </tr>`;
    }).join("");
    const html = `<html><head><meta charset="UTF-8"><title>${exam.examName} Marks</title>
<style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:white;padding:10px}td{padding:8px;border-bottom:1px solid #e2e8f0}</style></head>
<body><h2>${exam.examName} — ${exam.subjectName}</h2>
<p>Class: ${className} &nbsp;|&nbsp; Date: ${exam.examDate} &nbsp;|&nbsp; Max Marks: ${exam.maxMarks}</p>
<table><thead><tr><th>Roll</th><th>Name</th><th>Marks</th><th>Max</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:16px;color:#94a3b8;font-size:12px">Generated by IIC×NSTA Smart School System</p></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exam.examName}_${exam.subjectName}_${className}.mhtml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderEntryForm = (exam: ExamEntry | null, isNew: boolean) => {
    const mx = isNew ? maxMarks : exam?.maxMarks || 100;
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {isNew && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="Exam Name (e.g. Unit Test 1)"
              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
            <input value={examSubjectName} onChange={e => setExamSubjectName(e.target.value)} placeholder="Subject Name"
              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
            <div className="flex gap-3">
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
              <div className="flex-1 flex items-center gap-2">
                <label className="text-sm text-slate-500">Max:</label>
                <input type="number" value={maxMarks} onChange={e => setMaxMarks(Number(e.target.value))} min={1} max={1000}
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 font-medium border-b dark:border-slate-600 flex">
            <span className="w-8">Roll</span><span className="flex-1">Name</span>
            <span className="w-20 text-center">Marks/{mx}</span>
            <span className="w-14 text-center">Absent</span>
          </div>
          {students.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-4 py-2.5 border-b dark:border-slate-700 last:border-0">
              <span className="w-8 text-xs text-slate-400">{s.rollNo}</span>
              <span className="flex-1 text-sm text-slate-800 dark:text-white">{s.name}</span>
              <input
                type="number" min={0} max={mx}
                value={absentMap[s.id] ? "" : (marksInput[s.id] || "")}
                disabled={absentMap[s.id]}
                onChange={e => setMarksInput(prev => ({ ...prev, [s.id]: e.target.value }))}
                placeholder={absentMap[s.id] ? "AB" : "0"}
                className="w-20 px-2 py-1.5 border dark:border-slate-600 rounded-lg text-center text-sm bg-transparent text-slate-800 dark:text-white disabled:opacity-40"
              />
              <label className="w-14 flex items-center justify-center gap-1 cursor-pointer">
                <input type="checkbox" checked={absentMap[s.id] || false}
                  onChange={e => setAbsentMap(prev => ({ ...prev, [s.id]: e.target.checked }))} />
                <span className="text-xs text-red-400">AB</span>
              </label>
            </div>
          ))}
        </div>

        <button onClick={isNew ? saveNewExam : updateExamMarks} disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md disabled:opacity-60">
          <Save className="w-5 h-5" /> {saving ? "Saving..." : "Save Marks"}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <button onClick={view !== "list" ? () => setView("list") : onBack}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-white">
            {view === "list" ? `${className} — Marks` : view === "new" ? "New Exam Entry" : view === "totals" ? `${className} — Total Score` : `Edit: ${selectedExam?.examName}`}
          </h2>
          <p className="text-xs text-slate-500">{subjectName}</p>
        </div>
        {view === "list" && (
          <div className="flex gap-2">
            <button onClick={() => setView("totals")} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
              <BarChart2 className="w-4 h-4" /> Total Score
            </button>
            <button onClick={startNewExam} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> New Exam
            </button>
          </div>
        )}
      </div>

      {view === "list" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {exams.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No exams recorded yet</p>
              <p className="text-sm mt-1">Tap "New Exam" to add marks</p>
            </div>
          )}
          {exams.map(exam => {
            const appeared = Object.values(exam.studentMarks).filter(m => !m.absent).length;
            const avg = appeared > 0
              ? Math.round(Object.values(exam.studentMarks).filter(m => !m.absent).reduce((s, m) => s + m.marks, 0) / appeared)
              : 0;
            const pass = Object.values(exam.studentMarks).filter(m => !m.absent && m.marks / exam.maxMarks >= 0.33).length;
            return (
              <div key={exam.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 dark:text-white">{exam.examName}</p>
                    <p className="text-sm text-slate-500">{exam.subjectName} • {exam.examDate} • Max: {exam.maxMarks}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-slate-400">Appeared: <b className="text-slate-700 dark:text-slate-200">{appeared}</b></span>
                      <span className="text-slate-400">Avg: <b className="text-blue-500">{avg}/{exam.maxMarks}</b></span>
                      <span className="text-slate-400">Pass: <b className="text-green-500">{pass}</b></span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => downloadExamReport(exam)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                      <Download className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={() => openExam(exam)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleDeleteExam(exam.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "new" && renderEntryForm(null, true)}
      {view === "entry" && selectedExam && renderEntryForm(selectedExam, false)}

      {view === "totals" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {students.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Koi student nahi mila</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 font-semibold border-b dark:border-slate-600 grid grid-cols-12">
                <span className="col-span-1">#</span>
                <span className="col-span-5">Name</span>
                <span className="col-span-3 text-center">Marks</span>
                <span className="col-span-2 text-center">%</span>
                <span className="col-span-1 text-center">Grade</span>
              </div>
              {students.map((s, idx) => {
                const studentExams = exams.filter(e => e.studentMarks?.[s.id]);
                const totalObt = studentExams.reduce((sum, e) => {
                  const sm = e.studentMarks[s.id];
                  return sum + (sm?.absent ? 0 : sm?.marks || 0);
                }, 0);
                const totalMax = studentExams.reduce((sum, e) => sum + e.maxMarks, 0);
                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : null;
                const gr = pct !== null ? getTotalGrade(pct) : "—";
                return (
                  <div key={s.id} className={`grid grid-cols-12 items-center px-4 py-3 border-b dark:border-slate-700 last:border-0 ${idx % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-700/30"}`}>
                    <span className="col-span-1 text-xs text-slate-400">{s.rollNo}</span>
                    <span className="col-span-5 text-sm text-slate-800 dark:text-white truncate pr-2">{s.name}</span>
                    <span className="col-span-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200">
                      {totalMax > 0 ? `${totalObt}/${totalMax}` : "—"}
                    </span>
                    <span className={`col-span-2 text-center text-sm font-black ${pct !== null ? getTotalGradeColor(pct) : "text-slate-400"}`}>
                      {pct !== null ? `${pct}%` : "—"}
                    </span>
                    <span className={`col-span-1 text-center text-xs font-black ${pct !== null ? getTotalGradeColor(pct) : "text-slate-400"}`}>
                      {gr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {exams.length === 0 && (
            <p className="text-center text-xs text-slate-400 mt-2">Koi exam record nahi hai abhi</p>
          )}
        </div>
      )}
    </div>
  );
};
