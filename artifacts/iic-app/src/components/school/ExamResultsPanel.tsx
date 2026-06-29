// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getStudents, getExams, saveExam, deleteExam, generateId, todayStr } from "../../school-firebase";
import type { SchoolStudent, SchoolSubject, ExamEntry } from "../../school-types";
import {
  Plus, ChevronLeft, Save, Trash2, Award, FileText, Printer,
  BookOpen, Check, X, BarChart2, Users, AlertCircle
} from "lucide-react";

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  sessionId: string;
  subjects: SchoolSubject[];
  adminId: string;
  schoolName?: string;
  onBack?: () => void;
}

function getGrade(pct: number) {
  if (pct >= 91) return "A+";
  if (pct >= 81) return "A";
  if (pct >= 71) return "B+";
  if (pct >= 61) return "B";
  if (pct >= 51) return "C+";
  if (pct >= 41) return "C";
  if (pct >= 33) return "D";
  return "F";
}

function getGradeColor(pct: number) {
  if (pct >= 81) return "#16a34a";
  if (pct >= 61) return "#2563eb";
  if (pct >= 41) return "#d97706";
  return "#dc2626";
}

function gdriveLinkToImg(url: string) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
}

export const ExamResultsPanel: React.FC<Props> = ({
  schoolId, classId, className, sessionId, subjects, adminId, schoolName, onBack
}) => {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [view, setView] = useState<"list" | "entry" | "add" | "class_result">("list");
  const [selectedExam, setSelectedExam] = useState<ExamEntry | null>(null);
  const [marksInput, setMarksInput] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [addForm, setAddForm] = useState({ examName: "", subjectId: "", examDate: todayStr(), maxMarks: "100" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadData = async () => {
    const [sts, exs] = await Promise.all([
      getStudents(schoolId, classId),
      getExams(schoolId, classId)
    ]);
    setStudents(sts.sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0)));
    setExams(exs.sort((a, b) => b.examDate.localeCompare(a.examDate)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [classId]);

  const openExam = (exam: ExamEntry) => {
    setSelectedExam(exam);
    const input: Record<string, { marks: string; absent: boolean }> = {};
    students.forEach(s => {
      const ex = exam.studentMarks[s.id];
      input[s.id] = { marks: ex && !ex.absent ? String(ex.marks) : "", absent: ex?.absent || false };
    });
    setMarksInput(input);
    setView("entry");
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);
    const studentMarks: ExamEntry["studentMarks"] = {};
    students.forEach(s => {
      const inp = marksInput[s.id];
      if (inp.absent || inp.marks !== "") {
        studentMarks[s.id] = {
          marks: inp.absent ? 0 : Math.min(Number(inp.marks) || 0, selectedExam.maxMarks),
          absent: inp.absent,
          studentName: s.name,
          rollNo: s.rollNo
        };
      }
    });
    await saveExam({ ...selectedExam, studentMarks });
    await loadData();
    setSelectedExam(prev => ({ ...prev!, studentMarks }));
    setSaving(false);
    alert("Marks save ho gaye!");
  };

  const handleAddExam = async () => {
    if (!addForm.examName.trim()) return alert("Exam ka naam daalo");
    if (!addForm.subjectId) return alert("Subject select karo");
    setSaving(true);
    const sub = subjects.find(s => s.id === addForm.subjectId);
    const exam: ExamEntry = {
      id: generateId(),
      schoolId, sessionId, classId,
      subjectId: addForm.subjectId,
      subjectName: sub?.name || "",
      examName: addForm.examName.trim(),
      examDate: addForm.examDate,
      maxMarks: Math.max(1, Number(addForm.maxMarks) || 100),
      markedBy: adminId,
      studentMarks: {},
      createdAt: new Date().toISOString()
    };
    await saveExam(exam);
    await loadData();
    setAddForm({ examName: "", subjectId: "", examDate: todayStr(), maxMarks: "100" });
    setView("list");
    setSaving(false);
  };

  const handleDeleteExam = async (examId: string) => {
    await deleteExam(schoolId, examId);
    await loadData();
    setConfirmDelete(null);
  };

  const generateMarksheet = (student: SchoolStudent) => {
    const studentExams = exams.filter(e => e.studentMarks[student.id]);
    const bySubject: Record<string, ExamEntry[]> = {};
    studentExams.forEach(e => {
      if (!bySubject[e.subjectName]) bySubject[e.subjectName] = [];
      bySubject[e.subjectName].push(e);
    });

    const totalObtained = studentExams.reduce((sum, e) => {
      const sm = e.studentMarks[student.id];
      return sum + (sm?.absent ? 0 : (sm?.marks || 0));
    }, 0);
    const totalMax = studentExams.reduce((sum, e) => sum + e.maxMarks, 0);
    const pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    const grade = getGrade(pct);

    const photoUrl = (student as any).photoUrl ? gdriveLinkToImg((student as any).photoUrl) : null;

    const subjectRows = Object.entries(bySubject).map(([subName, subExams]) => {
      const subObt = subExams.reduce((sum, e) => sum + (e.studentMarks[student.id]?.absent ? 0 : (e.studentMarks[student.id]?.marks || 0)), 0);
      const subMax = subExams.reduce((sum, e) => sum + e.maxMarks, 0);
      const subPct = subMax > 0 ? Math.round((subObt / subMax) * 100) : 0;
      const examCells = subExams.map(e => {
        const sm = e.studentMarks[student.id];
        return `<td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${sm?.absent ? "Ab" : (sm?.marks ?? "-")}<br><small style="color:#94a3b8">/${e.maxMarks}</small></td>`;
      }).join("");
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:600;">${subName}</td>
        ${examCells}
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-weight:bold;">${subObt}/${subMax}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:${getGradeColor(subPct)};font-weight:bold;">${subPct}%</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-weight:bold;color:${getGradeColor(subPct)};">${getGrade(subPct)}</td>
      </tr>`;
    }).join("");

    const allExamNames = [...new Set(studentExams.map(e => e.examName))];
    const examHeaders = allExamNames.map(n => `<th style="border:1px solid #cbd5e1;padding:8px;background:#f1f5f9;text-align:center;font-size:12px;">${n}</th>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Marksheet — ${student.name}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; padding: 24px; background: #fff; color: #1e293b; }
  .header { text-align: center; border-bottom: 3px double #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
  .school-name { font-size: 22px; font-weight: bold; color: #1e40af; }
  .sub-title { font-size: 14px; color: #475569; margin: 4px 0; }
  .marksheet-title { font-size: 16px; font-weight: bold; background: #1e40af; color: white; padding: 6px 20px; display: inline-block; border-radius: 4px; margin: 10px 0; }
  .info-grid { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-start; }
  .info-box { flex: 1; }
  .info-row { display: flex; margin-bottom: 8px; font-size: 14px; }
  .info-label { width: 130px; color: #64748b; font-weight: 600; }
  .info-value { flex: 1; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
  .photo-box { width: 110px; height: 130px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 4px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { border: 1px solid #cbd5e1; padding: 8px; background: #1e40af; color: white; text-align: left; }
  .result-bar { display: flex; justify-content: space-between; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 16px 0; font-weight: bold; }
  .result-highlight { font-size: 20px; color: ${getGradeColor(pct)}; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 48px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px solid #1e293b; width: 160px; margin-bottom: 4px; }
  .sign-label { font-size: 12px; color: #64748b; }
  .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="no-print" style="margin-bottom:16px;">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">🖨️ Print Marksheet</button>
</div>

<div class="header">
  <div class="school-name">${schoolName || "School Name"}</div>
  <div class="sub-title">${className} — Academic Result</div>
  <div class="marksheet-title">PROGRESS REPORT / MARKSHEET</div>
</div>

<div class="info-grid">
  <div class="info-box">
    <div class="info-row"><span class="info-label">Student Name:</span><span class="info-value">${student.name}</span></div>
    <div class="info-row"><span class="info-label">Father's Name:</span><span class="info-value">${(student as any).fatherName || ""}</span></div>
    <div class="info-row"><span class="info-label">Roll No:</span><span class="info-value">${student.rollNo}</span></div>
    <div class="info-row"><span class="info-label">Adm. No:</span><span class="info-value">${(student as any).admissionNo || ""}</span></div>
    <div class="info-row"><span class="info-label">Class:</span><span class="info-value">${className}</span></div>
    <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${new Date().toLocaleDateString("en-IN")}</span></div>
  </div>
  <div class="photo-box">
    ${photoUrl
      ? `<img src="${photoUrl}" alt="Photo" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span style="font-size:11px;color:#94a3b8;text-align:center;">Student<br>Photo</span>`}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:left;">Subject</th>
      ${examHeaders}
      <th style="text-align:center;">Total</th>
      <th style="text-align:center;">%</th>
      <th style="text-align:center;">Grade</th>
    </tr>
  </thead>
  <tbody>
    ${subjectRows}
  </tbody>
  <tfoot>
    <tr style="font-weight:bold;background:#f1f5f9;">
      <td colspan="${allExamNames.length + 1}" style="border:1px solid #cbd5e1;padding:8px;text-align:right;">Grand Total →</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${totalObtained}/${totalMax}</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:${getGradeColor(pct)};">${pct}%</td>
      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:${getGradeColor(pct)};">${grade}</td>
    </tr>
  </tfoot>
</table>

<div class="result-bar">
  <div>Total Obtained: <span class="result-highlight">${totalObtained} / ${totalMax}</span></div>
  <div>Percentage: <span class="result-highlight">${pct}%</span></div>
  <div>Grade: <span class="result-highlight">${grade}</span></div>
  <div>Result: <span class="result-highlight">${pct >= 33 ? "✓ PASS" : "✗ FAIL"}</span></div>
</div>

<div class="sign-row">
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Class Teacher</div></div>
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Principal</div></div>
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Parent / Guardian</div></div>
</div>

<div class="footer">Generated by IIC×NSTA Smart School System — ${new Date().toLocaleString("en-IN")}</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (view === "add") {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-blue-500 text-sm mb-2">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-white">Naya Exam Add Karo</p>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Exam Ka Naam *</label>
            <input value={addForm.examName} onChange={e => setAddForm(p => ({ ...p, examName: e.target.value }))}
              placeholder="e.g. Unit Test 1, Half Yearly, Final"
              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Subject *</label>
            <select value={addForm.subjectId} onChange={e => setAddForm(p => ({ ...p, subjectId: e.target.value }))}
              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm">
              <option value="">— Subject chuniye —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Exam Date</label>
              <input type="date" value={addForm.examDate} onChange={e => setAddForm(p => ({ ...p, examDate: e.target.value }))}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Total Marks (Max)</label>
              <input type="number" value={addForm.maxMarks} onChange={e => setAddForm(p => ({ ...p, maxMarks: e.target.value }))}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
          </div>
          <button onClick={handleAddExam} disabled={saving}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Exam Save Karo"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "entry" && selectedExam) {
    const markedCount = Object.keys(selectedExam.studentMarks).length;
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-blue-500 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3">
          <p className="font-bold text-blue-800 dark:text-blue-200">{selectedExam.examName} — {selectedExam.subjectName}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Date: {new Date(selectedExam.examDate).toLocaleDateString("en-IN")} • Max Marks: {selectedExam.maxMarks}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">{markedCount}/{students.length} students marked</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-0 px-3 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            <span className="col-span-1 text-xs text-slate-500 font-semibold">#</span>
            <span className="col-span-5 text-xs text-slate-500 font-semibold">Student</span>
            <span className="col-span-3 text-xs text-slate-500 font-semibold text-center">Marks /{selectedExam.maxMarks}</span>
            <span className="col-span-2 text-xs text-slate-500 font-semibold text-center">Absent</span>
            <span className="col-span-1 text-xs text-slate-500 font-semibold text-right">%</span>
          </div>
          {students.map(s => {
            const inp = marksInput[s.id] || { marks: "", absent: false };
            const m = Number(inp.marks) || 0;
            const pct = !inp.absent && inp.marks !== "" ? Math.round((m / selectedExam.maxMarks) * 100) : null;
            return (
              <div key={s.id} className={`grid grid-cols-12 gap-0 px-3 py-2 border-b dark:border-slate-700 last:border-0 items-center ${inp.absent ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                <span className="col-span-1 text-xs text-slate-400">{s.rollNo}</span>
                <span className="col-span-5 text-sm text-slate-700 dark:text-slate-200 truncate pr-1">{s.name}</span>
                <div className="col-span-3 flex justify-center">
                  <input
                    type="number" min="0" max={selectedExam.maxMarks}
                    value={inp.absent ? "" : inp.marks}
                    disabled={inp.absent}
                    onChange={e => setMarksInput(p => ({ ...p, [s.id]: { ...p[s.id], marks: e.target.value } }))}
                    placeholder={inp.absent ? "Ab" : "—"}
                    className="w-16 text-center px-2 py-1 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-700"
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <button onClick={() => setMarksInput(p => ({ ...p, [s.id]: { marks: "", absent: !p[s.id]?.absent } }))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${inp.absent ? "bg-red-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
                    {inp.absent ? "Ab" : "—"}
                  </button>
                </div>
                <span className="col-span-1 text-right text-xs font-bold" style={{ color: pct !== null ? getGradeColor(pct) : "#94a3b8" }}>
                  {pct !== null ? `${pct}%` : ""}
                </span>
              </div>
            );
          })}
        </div>

        <button onClick={saveMarks} disabled={saving}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          <Save className="w-5 h-5" /> {saving ? "Saving..." : "Marks Save Karo"}
        </button>
      </div>
    );
  }

  if (view === "class_result") {
    const uniqueExamNames = [...new Set(exams.map(e => e.examName))];
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-blue-500 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <p className="font-bold text-slate-800 dark:text-white">Class Result — {className}</p>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-800">Roll / Name</th>
                {uniqueExamNames.map(n => (
                  <th key={n} className="px-2 py-2 text-center whitespace-nowrap">{n}</th>
                ))}
                <th className="px-3 py-2 text-center">Total %</th>
                <th className="px-3 py-2 text-center">Grade</th>
                <th className="px-3 py-2 text-center">Marksheet</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const studentExams = exams.filter(e => e.studentMarks[s.id]);
                const totalObt = studentExams.reduce((sum, e) => sum + (e.studentMarks[s.id]?.absent ? 0 : e.studentMarks[s.id]?.marks || 0), 0);
                const totalMax = studentExams.reduce((sum, e) => sum + e.maxMarks, 0);
                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : null;
                return (
                  <tr key={s.id} className={idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-700/30"}>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-white sticky left-0 bg-inherit">
                      <div className="text-[10px] text-slate-400">{s.rollNo}</div>
                      <div className="truncate max-w-[100px]">{s.name}</div>
                    </td>
                    {uniqueExamNames.map(examName => {
                      const matchedExams = exams.filter(e => e.examName === examName && e.studentMarks[s.id]);
                      if (matchedExams.length === 0) return <td key={examName} className="px-2 py-2 text-center text-slate-300">—</td>;
                      const obt = matchedExams.reduce((sum, e) => sum + (e.studentMarks[s.id]?.absent ? 0 : e.studentMarks[s.id]?.marks || 0), 0);
                      const mx = matchedExams.reduce((sum, e) => sum + e.maxMarks, 0);
                      const ep = mx > 0 ? Math.round((obt / mx) * 100) : 0;
                      return (
                        <td key={examName} className="px-2 py-2 text-center">
                          <span style={{ color: getGradeColor(ep) }} className="font-bold">{obt}/{mx}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold" style={{ color: pct !== null ? getGradeColor(pct) : "#94a3b8" }}>
                      {pct !== null ? `${pct}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center font-bold" style={{ color: pct !== null ? getGradeColor(pct) : "#94a3b8" }}>
                      {pct !== null ? getGrade(pct) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => generateMarksheet(s)}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {students.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Koi student nahi mila</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setView("add")}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Naya Exam
        </button>
        <button onClick={() => setView("class_result")}
          className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          <BarChart2 className="w-4 h-4" /> Class Result
        </button>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Koi exam nahi mila</p>
          <p className="text-xs mt-1">Oopar "+ Naya Exam" dabao</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map(exam => {
            const markedCount = Object.keys(exam.studentMarks).length;
            const allMarked = markedCount === students.length && students.length > 0;
            return (
              <div key={exam.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${allMarked ? "bg-green-100 dark:bg-green-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                    {allMarked ? <Check className="w-5 h-5 text-green-600" /> : <BookOpen className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{exam.examName}</p>
                    <p className="text-xs text-slate-500">{exam.subjectName} • {new Date(exam.examDate).toLocaleDateString("en-IN")} • Max: {exam.maxMarks}</p>
                    <p className={`text-xs font-medium mt-0.5 ${allMarked ? "text-green-600" : "text-orange-500"}`}>
                      {markedCount}/{students.length} students marked
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openExam(exam)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
                      Marks Enter
                    </button>
                    {confirmDelete === exam.id ? (
                      <>
                        <button onClick={() => handleDeleteExam(exam.id)} className="px-2 py-1.5 bg-red-500 text-white rounded-lg text-xs">✓</button>
                        <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs"><X className="w-3 h-3" /></button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(exam.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
