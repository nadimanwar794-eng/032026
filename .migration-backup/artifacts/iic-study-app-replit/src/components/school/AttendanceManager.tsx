// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import {
  saveAttendance, getAttendance, getMonthlyAttendance, getStudents, todayStr, currentMonthStr
} from "../../school-firebase";
import type { SchoolStudent, AttendanceRecord } from "../../school-types";
import { CheckCircle, XCircle, Download, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  teacherId: string;
  onBack?: () => void;
}

export const AttendanceManager: React.FC<Props> = ({ schoolId, classId, className, teacherId, onBack }) => {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [attendance, setAttendance] = useState<{ [id: string]: boolean }>({});
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"mark" | "report">("mark");
  const [monthlyData, setMonthlyData] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudents(schoolId, classId).then(s => {
      setStudents(s);
      const init: { [id: string]: boolean } = {};
      s.forEach(st => (init[st.id] = true));
      setAttendance(init);
      setLoading(false);
    });
  }, [schoolId, classId]);

  useEffect(() => {
    getAttendance(schoolId, classId, selectedDate).then((rec: AttendanceRecord | null) => {
      setExistingRecord(rec);
      if (rec) {
        const m: { [id: string]: boolean } = {};
        Object.entries(rec.students).forEach(([id, v]: any) => (m[id] = v.present));
        setAttendance(m);
      } else {
        const init: { [id: string]: boolean } = {};
        students.forEach(s => (init[s.id] = true));
        setAttendance(init);
      }
    });
  }, [selectedDate, students]);

  useEffect(() => {
    if (viewMode === "report") {
      getMonthlyAttendance(schoolId, classId, selectedMonth).then(setMonthlyData);
    }
  }, [viewMode, selectedMonth]);

  const toggleStudent = (id: string) => {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  };

  const markAll = (present: boolean) => {
    const m: { [id: string]: boolean } = {};
    students.forEach(s => (m[s.id] = present));
    setAttendance(m);
    setSaved(false);
  };

  const saveRecord = async () => {
    setSaving(true);
    const studentsMap: AttendanceRecord["students"] = {};
    students.forEach(s => {
      studentsMap[s.id] = { present: attendance[s.id] ?? true, name: s.name, rollNo: s.rollNo };
    });
    const record: AttendanceRecord = {
      date: selectedDate,
      schoolId,
      classId,
      sessionId: students[0]?.sessionId || "",
      markedBy: teacherId,
      students: studentsMap,
      createdAt: new Date().toISOString()
    };
    await saveAttendance(record);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = students.length - presentCount;

  // Monthly Report: compute per-student attendance stats
  const studentStats = students.map(s => {
    const days = monthlyData.filter(r => r.students[s.id] !== undefined);
    const presentDays = days.filter(r => r.students[s.id]?.present).length;
    return { ...s, totalDays: days.length, presentDays, absentDays: days.length - presentDays, pct: days.length > 0 ? Math.round((presentDays / days.length) * 100) : 0 };
  });

  const downloadMHTMLReport = () => {
    const rows = studentStats.map(s =>
      `<tr><td>${s.rollNo}</td><td>${s.name}</td><td>${s.presentDays}</td><td>${s.absentDays}</td><td>${s.totalDays}</td><td style="color:${s.pct >= 75 ? "green" : "red"}">${s.pct}%</td></tr>`
    ).join("");

    const html = `<html><head><meta charset="UTF-8"><title>Attendance Report - ${className}</title>
<style>body{font-family:Arial,sans-serif;padding:24px}h1{color:#1e293b}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e293b;color:white;padding:10px;text-align:left}td{padding:8px 10px;border-bottom:1px solid #e2e8f0}tr:hover{background:#f8fafc}.summary{display:flex;gap:24px;margin:16px 0}.card{background:#f1f5f9;border-radius:8px;padding:12px 20px;text-align:center}.card h3{margin:0;font-size:24px}.card p{margin:4px 0;color:#64748b;font-size:13px}</style></head>
<body>
<h1>📋 Attendance Report</h1>
<p><strong>School:</strong> ${schoolId} &nbsp;|&nbsp; <strong>Class:</strong> ${className} &nbsp;|&nbsp; <strong>Month:</strong> ${selectedMonth}</p>
<div class="summary">
<div class="card"><h3>${monthlyData.length}</h3><p>Total Days</p></div>
<div class="card"><h3>${studentStats.length}</h3><p>Students</p></div>
<div class="card" style="background:#dcfce7"><h3>${studentStats.filter(s => s.pct >= 75).length}</h3><p>≥75% Attendance</p></div>
<div class="card" style="background:#fee2e2"><h3>${studentStats.filter(s => s.pct < 75).length}</h3><p>&lt;75% Attendance</p></div>
</div>
<table><thead><tr><th>Roll No</th><th>Student Name</th><th>Present</th><th>Absent</th><th>Total Days</th><th>Attendance %</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="margin-top:24px;color:#94a3b8;font-size:12px">Generated by IIC×NSTA Smart School System on ${new Date().toLocaleString()}</p>
</body></html>`;

    const blob = new Blob([html], { type: "multipart/related; type=\"text/html\"; boundary=\"boundary\"" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Attendance_${className}_${selectedMonth}.mhtml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400">Loading students...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-white">{className} — Attendance</h2>
          <p className="text-xs text-slate-500">{students.length} students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode("mark")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === "mark" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>Mark</button>
          <button onClick={() => setViewMode("report")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === "report" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>Report</button>
        </div>
      </div>

      {viewMode === "mark" ? (
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Date Picker */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <Calendar className="w-5 h-5 text-blue-500" />
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="flex-1 bg-transparent text-slate-800 dark:text-white font-medium outline-none" />
            {existingRecord && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Saved</span>}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{students.length}</p>
              <p className="text-xs text-blue-500">Total</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-green-500">Present</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{absentCount}</p>
              <p className="text-xs text-red-400">Absent</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button onClick={() => markAll(true)} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium">All Present</button>
            <button onClick={() => markAll(false)} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">All Absent</button>
          </div>

          {/* Student List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            {students.map((s, i) => (
              <div key={s.id} onClick={() => toggleStudent(s.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b dark:border-slate-700 last:border-0 ${attendance[s.id] ? "bg-white dark:bg-slate-800" : "bg-red-50 dark:bg-red-900/20"}`}>
                <span className="text-xs text-slate-400 w-6 text-right">{s.rollNo}</span>
                <span className="flex-1 text-slate-800 dark:text-white font-medium text-sm">{s.name}</span>
                {attendance[s.id]
                  ? <CheckCircle className="w-6 h-6 text-green-500" />
                  : <XCircle className="w-6 h-6 text-red-400" />}
              </div>
            ))}
          </div>

          {students.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No students in this class yet</p>
            </div>
          )}

          {students.length > 0 && (
            <button onClick={saveRecord} disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-md disabled:opacity-60 transition-colors">
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Attendance"}
            </button>
          )}
        </div>
      ) : (
        /* REPORT VIEW */
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {/* Month selector */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
            <span className="flex-1 text-center font-bold text-slate-800 dark:text-white">
              {new Date(selectedMonth + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-xl font-bold">{monthlyData.length}</p>
              <p className="text-xs text-slate-500">Working Days</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-xl font-bold">{studentStats.filter(s => s.pct >= 75).length}/{students.length}</p>
              <p className="text-xs text-slate-500">≥75% Attendance</p>
            </div>
          </div>

          {/* Student table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-slate-500 text-xs">
                  <th className="text-left px-3 py-2">Roll</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-center px-3 py-2">P</th>
                  <th className="text-center px-3 py-2">A</th>
                  <th className="text-center px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {studentStats.map(s => (
                  <tr key={s.id} className="border-t dark:border-slate-700">
                    <td className="px-3 py-2.5 text-slate-400">{s.rollNo}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-white">{s.name}</td>
                    <td className="px-3 py-2.5 text-center text-green-600 font-medium">{s.presentDays}</td>
                    <td className="px-3 py-2.5 text-center text-red-500 font-medium">{s.absentDays}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.pct >= 75 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{s.pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && <p className="text-center py-8 text-slate-400">No students found</p>}
          </div>

          <button onClick={downloadMHTMLReport}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md">
            <Download className="w-5 h-5" /> Download MHTML Report
          </button>
        </div>
      )}
    </div>
  );
};
