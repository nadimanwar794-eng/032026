// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getStudents, getExams, getMonthlyAttendance, currentMonthStr } from "../../school-firebase";
import type { SchoolStudent, ExamEntry } from "../../school-types";
import { Download, User, Award, Calendar, ChevronLeft } from "lucide-react";

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  sessionId: string;
  onBack?: () => void;
}

export const ReportCard: React.FC<Props> = ({ schoolId, classId, className, sessionId, onBack }) => {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [selectedStudent, setSelectedStudent] = useState<SchoolStudent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getStudents(schoolId, classId),
      getExams(schoolId, classId),
      getMonthlyAttendance(schoolId, classId, selectedMonth)
    ]).then(([sts, exs, att]) => {
      setStudents(sts);
      setExams(exs);
      setAttendanceData(att);
      setLoading(false);
    });
  }, [schoolId, classId, selectedMonth]);

  const getStudentAttendance = (studentId: string) => {
    const days = attendanceData.filter(r => r.students[studentId] !== undefined);
    const present = days.filter(r => r.students[studentId]?.present).length;
    return { present, total: days.length, pct: days.length > 0 ? Math.round((present / days.length) * 100) : 0 };
  };

  const getStudentMarks = (studentId: string) => {
    return exams.map(exam => ({
      subject: exam.subjectName,
      examName: exam.examName,
      marks: exam.studentMarks[studentId]?.marks ?? null,
      maxMarks: exam.maxMarks,
      absent: exam.studentMarks[studentId]?.absent
    })).filter(e => e.marks !== null || e.absent);
  };

  const getPerformanceTag = (pct: number) => {
    if (pct >= 90) return { label: "Excellent", color: "#16a34a" };
    if (pct >= 75) return { label: "Very Good", color: "#2563eb" };
    if (pct >= 60) return { label: "Good", color: "#9333ea" };
    if (pct >= 40) return { label: "Average", color: "#d97706" };
    return { label: "Needs Improvement", color: "#dc2626" };
  };

  const generateStudentHTML = (student: SchoolStudent) => {
    const att = getStudentAttendance(student.id);
    const marks = getStudentMarks(student.id);
    const totalMarks = marks.reduce((sum, m) => sum + (m.marks || 0), 0);
    const totalMax = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const overallPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
    const perf = getPerformanceTag(overallPct);

    const examRows = marks.map(m =>
      `<tr><td>${m.subject}</td><td>${m.examName}</td><td style="text-align:center">${m.absent ? "AB" : m.marks}</td><td style="text-align:center">${m.maxMarks}</td><td style="text-align:center">${m.absent ? "-" : Math.round((m.marks! / m.maxMarks) * 100) + "%"}</td></tr>`
    ).join("");

    return `<html><head><meta charset="UTF-8"><title>Report Card - ${student.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;padding:32px;color:#1e293b;max-width:750px;margin:0 auto}
.header{text-align:center;border-bottom:3px solid #1e293b;padding-bottom:16px;margin-bottom:24px}
.header h1{font-size:28px;color:#1e293b;letter-spacing:1px}
.header p{color:#64748b;font-size:13px;margin-top:4px}
.student-info{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px}
.info-item p{font-size:12px;color:#64748b}
.info-item h4{font-size:15px;font-weight:600;color:#1e293b}
.section{margin-bottom:24px}
.section h3{font-size:14px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.stats{display:flex;gap:16px;margin-bottom:20px}
.stat-card{flex:1;background:#f1f5f9;border-radius:10px;padding:12px 16px;text-align:center}
.stat-card h3{font-size:22px;font-weight:700;margin:0}
.stat-card p{font-size:11px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#1e293b;color:white;padding:10px 12px;text-align:left;font-size:12px}
td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
tr:last-child td{border:none}
.badge{display:inline-block;padding:4px 12px;border-radius:99px;font-weight:700;font-size:13px}
.footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;color:#94a3b8;font-size:11px}
.signature{margin-top:40px;display:flex;justify-content:space-between}
.sig-line{border-top:1px solid #94a3b8;width:160px;padding-top:4px;font-size:11px;color:#64748b;text-align:center}
</style></head>
<body>
<div class="header">
  <h1>🏫 IIC×NSTA Smart School</h1>
  <p>Student Progress Report Card &nbsp;|&nbsp; Session: ${sessionId} &nbsp;|&nbsp; Month: ${selectedMonth}</p>
</div>
<div class="student-info">
  <div class="info-item"><p>Student Name</p><h4>${student.name}</h4></div>
  <div class="info-item"><p>Roll Number</p><h4>${student.rollNo}</h4></div>
  <div class="info-item"><p>Class</p><h4>${className}</h4></div>
  <div class="info-item"><p>Admission No</p><h4>${student.admissionNo || "-"}</h4></div>
  <div class="info-item"><p>Father's Name</p><h4>${student.fatherName || "-"}</h4></div>
  <div class="info-item"><p>Date of Birth</p><h4>${student.dateOfBirth || "-"}</h4></div>
</div>

<div class="stats">
  <div class="stat-card"><h3 style="color:${perf.color}">${overallPct}%</h3><p>Overall Score</p></div>
  <div class="stat-card"><h3 style="color:${att.pct >= 75 ? "#16a34a" : "#dc2626"}">${att.pct}%</h3><p>Attendance</p></div>
  <div class="stat-card"><h3>${totalMarks}/${totalMax}</h3><p>Total Marks</p></div>
  <div class="stat-card"><h3 style="color:${perf.color}">${marks.length}</h3><p>Exams Appeared</p></div>
</div>

<div class="section">
  <h3>📝 Marks Details</h3>
  ${marks.length > 0 ? `<table><thead><tr><th>Subject</th><th>Exam</th><th style="text-align:center">Marks</th><th style="text-align:center">Max</th><th style="text-align:center">%</th></tr></thead><tbody>${examRows}</tbody></table>` : '<p style="color:#94a3b8;font-style:italic">No exam records found</p>'}
</div>

<div class="section">
  <h3>📅 Attendance Summary</h3>
  <table><thead><tr><th>Present Days</th><th>Absent Days</th><th>Total Days</th><th>Percentage</th></tr></thead>
  <tbody><tr><td>${att.present}</td><td>${att.total - att.present}</td><td>${att.total}</td><td><span class="badge" style="background:${att.pct >= 75 ? "#dcfce7" : "#fee2e2"};color:${att.pct >= 75 ? "#16a34a" : "#dc2626"}">${att.pct}%</span></td></tr></tbody></table>
</div>

<div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:16px">
  <strong>Overall Performance:</strong> <span class="badge" style="background:#f1f5f9;color:${perf.color}">${perf.label}</span>
  ${overallPct >= 75 && att.pct >= 75 ? '<p style="margin-top:8px;color:#16a34a;font-size:13px">✓ Student is promoted to next class (pending final decision)</p>' : '<p style="margin-top:8px;color:#dc2626;font-size:13px">⚠ Student needs improvement in academics/attendance</p>'}
</div>

<div class="signature">
  <div class="sig-line">Class Teacher</div>
  <div class="sig-line">School Admin</div>
  <div class="sig-line">Principal</div>
</div>
<div class="footer">
  <span>IIC×NSTA Smart School System</span>
  <span>Generated: ${new Date().toLocaleString()}</span>
</div>
</body></html>`;
  };

  const downloadReportCard = (student: SchoolStudent) => {
    const html = generateStudentHTML(student);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ReportCard_${student.name.replace(/\s+/g, "_")}_${selectedMonth}.mhtml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllReportCards = () => {
    students.forEach(s => downloadReportCard(s));
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 dark:text-white">{className} — Report Cards</h2>
          <p className="text-xs text-slate-500">{students.length} students • {exams.length} exams recorded</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <Calendar className="w-5 h-5 text-blue-500" />
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="flex-1 bg-transparent text-slate-800 dark:text-white outline-none font-medium" />
        </div>

        <button onClick={downloadAllReportCards}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md">
          <Download className="w-5 h-5" /> Download All Report Cards
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
          {students.map(student => {
            const att = getStudentAttendance(student.id);
            const marks = getStudentMarks(student.id);
            const totalMarks = marks.reduce((sum, m) => sum + (m.marks || 0), 0);
            const totalMax = marks.reduce((sum, m) => sum + m.maxMarks, 0);
            const pct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
            const perf = getPerformanceTag(pct);

            return (
              <div key={student.id} className="flex items-center gap-3 px-4 py-3 border-b dark:border-slate-700 last:border-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 dark:text-white text-sm">{student.name}</p>
                  <p className="text-xs text-slate-400">Roll {student.rollNo} • Attendance: <span className={att.pct >= 75 ? "text-green-500" : "text-red-400"}>{att.pct}%</span> • Score: <span style={{ color: perf.color }}>{pct}%</span></p>
                </div>
                <button onClick={() => downloadReportCard(student)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            );
          })}
          {students.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No students found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
