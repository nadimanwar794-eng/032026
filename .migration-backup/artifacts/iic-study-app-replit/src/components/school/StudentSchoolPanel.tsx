// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  getStudents, subscribeToSubjects, subscribeToLessons,
  getMonthlyAttendance, getStudentFees, getExams, getSchool, getSessions,
  updateStudent
} from "../../school-firebase";
import type { School, SchoolSubject, SchoolLesson, MonthlyFee, AttendanceRecord, ExamEntry, SchoolStudent, SchoolSession } from "../../school-types";
import { SmartClass } from "./SmartClass";
import {
  BookOpen, Calendar, IndianRupee, Award, ChevronRight, ChevronLeft,
  CheckCircle, XCircle, Edit3, FileText, HelpCircle, TrendingUp, User,
  Zap, ArrowRight, GraduationCap, BarChart2, AlertCircle, Camera, Printer,
  Download, Star, Lock
} from "lucide-react";
import { currentMonthStr } from "../../school-firebase";

interface Props {
  schoolId: string;
  studentId: string;
  studentName: string;
  classId: string;
  sessionId: string;
  onOpenPlatformContent?: () => void;
  onBack?: () => void;
}

// Compress + resize image to base64 (max ~60KB)
async function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getGrade(pct: number): string {
  if (pct >= 91) return "A+";
  if (pct >= 81) return "A";
  if (pct >= 71) return "B+";
  if (pct >= 61) return "B";
  if (pct >= 51) return "C+";
  if (pct >= 41) return "C";
  if (pct >= 33) return "D";
  return "F";
}

function getGradeColor(pct: number): string {
  if (pct >= 81) return "#16a34a";
  if (pct >= 61) return "#2563eb";
  if (pct >= 41) return "#d97706";
  return "#dc2626";
}

export const StudentSchoolPanel: React.FC<Props> = ({
  schoolId, studentId, studentName, classId, sessionId, onOpenPlatformContent, onBack
}) => {
  const [school, setSchool] = useState<School | null>(null);
  const [studentData, setStudentData] = useState<SchoolStudent | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [lessons, setLessons] = useState<SchoolLesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<SchoolLesson | null>(null);
  const [smartMode, setSmartMode] = useState<"reading" | "writing" | "pdf" | "mcq">("reading");
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [view, setView] = useState<"dashboard" | "subjects" | "lessons" | "attendance" | "fees" | "results" | "smart_class" | "marksheet">("dashboard");
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const marksheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getSchool(schoolId),
      getStudents(schoolId, classId),
      getMonthlyAttendance(schoolId, classId, currentMonthStr()),
      getStudentFees(schoolId, studentId),
      getExams(schoolId, classId)
    ]).then(([sc, sts, att, feeData, examData]) => {
      setSchool(sc);
      setStudentData(sts.find(s => s.id === studentId) || null);
      setAttendanceData(att);
      setFees(feeData);
      setExams(examData);
      setLoading(false);
    });

    const unsubSubjects = subscribeToSubjects(schoolId, classId, setSubjects);
    return unsubSubjects;
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    const unsub = subscribeToLessons(schoolId, selectedSubject.id, setLessons);
    return unsub;
  }, [selectedSubject]);

  // ── Subscription expiry check ─────────────────────────────────────────────
  const sub = school?.subscription;
  const subExpIso = sub?.expiresAt || sub?.paidUntil;
  const isSubExpired = !sub || sub.status !== 'active' || (subExpIso ? new Date(subExpIso) < new Date() : false);
  const subExpiredDate = subExpIso ? new Date(subExpIso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  // Attendance stats
  const myAttDays = attendanceData.filter(r => r.students[studentId] !== undefined);
  const myPresentDays = myAttDays.filter(r => r.students[studentId]?.present).length;
  const attPct = myAttDays.length > 0 ? Math.round((myPresentDays / myAttDays.length) * 100) : 0;

  // Fee stats
  const currentFee = fees.find(f => f.month === currentMonthStr());
  const pendingFees = fees.filter(f => !f.paid).length;

  // Marks stats
  const myExams = exams.filter(e => e.studentMarks[studentId]);
  const totalMarks = myExams.reduce((sum, e) => sum + (e.studentMarks[studentId]?.marks || 0), 0);
  const totalMax = myExams.reduce((sum, e) => sum + e.maxMarks, 0);
  const avgPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Photo 5MB se chhoti honi chahiye."); return; }
    setPhotoUploading(true);
    try {
      const base64 = await compressImageToBase64(file);
      await updateStudent(schoolId, studentId, { photoUrl: base64 });
      setStudentData(prev => prev ? { ...prev, photoUrl: base64 } : prev);
    } catch (err) {
      alert("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Print marksheet
  const handlePrint = () => {
    window.print();
  };

  if (view === "smart_class" && selectedLesson) {
    if (isSubExpired) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
          <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setView("lessons")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-slate-800 dark:text-white truncate flex-1">{selectedLesson.title}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">Subscription Khatam Ho Gayi</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
              {subExpiredDate
                ? `Aapke school ka subscription ${subExpiredDate} ko khatam ho gaya. Content access ke liye school admin se baat karein.`
                : "Aapke school ka subscription active nahi hai. Admin se contact karein."}
            </p>
            <button
              onClick={() => setView("lessons")}
              className="mt-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-transform"
            >
              Wapas Jaao
            </button>
          </div>
        </div>
      );
    }
    return (
      <SmartClass
        lesson={selectedLesson}
        initialMode={smartMode}
        schoolId={schoolId}
        studentId={studentId}
        studentName={studentName}
        onBack={() => setView("lessons")}
      />
    );
  }

  // ── MARKSHEET VIEW ────────────────────────────────────────────────────────
  if (view === "marksheet") {
    const passedExams = myExams.filter(e => {
      const sm = e.studentMarks[studentId];
      if (!sm || sm.absent) return false;
      return (sm.marks / e.maxMarks) * 100 >= 33;
    });
    const overallResult = myExams.length > 0 && passedExams.length === myExams.filter(e => !e.studentMarks[studentId]?.absent).length && avgPct >= 33
      ? "PASS" : myExams.length === 0 ? "—" : "FAIL";

    return (
      <div className="min-h-screen bg-slate-100">
        {/* Toolbar — hidden on print */}
        <div className="print:hidden bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setView("results")} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-medium">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="flex-1 text-sm font-bold text-slate-700 text-center">Official Marksheet</span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #marksheet-print, #marksheet-print * { visibility: visible; }
            #marksheet-print { position: fixed; left: 0; top: 0; width: 100%; }
            @page { margin: 10mm; }
          }
        `}</style>

        {/* Marksheet Card */}
        <div id="marksheet-print" ref={marksheetRef} className="max-w-2xl mx-auto my-4 bg-white shadow-lg rounded-2xl print:rounded-none print:shadow-none print:my-0 overflow-hidden">

          {/* Top colour bar */}
          <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #1e3a8a, #4f46e5, #7c3aed)" }} />

          {/* School Header */}
          <div className="px-6 pt-5 pb-4 border-b-2 border-indigo-100 flex items-center gap-4">
            {school?.logoUrl ? (
              <img src={school.logoUrl} alt={school.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-8 h-8 text-indigo-600" />
              </div>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-xl font-black text-slate-900 leading-tight">{school?.name || "School"}</h1>
              {school?.address && <p className="text-xs text-slate-500 mt-0.5">{school.address}</p>}
              {school?.phone && <p className="text-xs text-slate-500">{school.phone}</p>}
            </div>
            <div className="w-16 h-16 flex-shrink-0" /> {/* balance */}
          </div>

          {/* Title */}
          <div className="bg-indigo-900 text-white text-center py-2.5">
            <p className="text-sm font-black uppercase tracking-[0.2em]">Progress Report / Mark Sheet</p>
          </div>

          {/* Student Info + Photo */}
          <div className="px-6 py-4 flex gap-4 border-b border-slate-100">
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["Student Name", studentData?.name || studentName],
                ["Roll No.", studentData?.rollNo || "—"],
                ["Admission No.", studentData?.admissionNo || "—"],
                ["Father's Name", studentData?.fatherName || "—"],
                ["Mother's Name", studentData?.motherName || "—"],
                ["Date of Birth", studentData?.dateOfBirth ? new Date(studentData.dateOfBirth).toLocaleDateString("en-IN") : "—"],
                ["Session", sessionId || "—"],
                ["Class/Section", school?.name ? `—` : "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                  <p className="font-bold text-slate-800 text-sm leading-snug">{val}</p>
                </div>
              ))}
            </div>

            {/* Student Photo */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="w-24 h-28 rounded-xl border-2 border-indigo-300 overflow-hidden bg-slate-50 flex items-center justify-center">
                {studentData?.photoUrl ? (
                  <img src={studentData.photoUrl} alt="Student" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <User className="w-10 h-10" />
                    <span className="text-[9px]">No Photo</span>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-400 font-medium text-center">Student Photo</p>
            </div>
          </div>

          {/* Marks Table */}
          <div className="px-6 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-700 mb-3">Examination Results</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-indigo-900 text-white">
                  <th className="text-left px-3 py-2 text-xs font-bold rounded-tl-lg">Subject / Exam</th>
                  <th className="text-center px-3 py-2 text-xs font-bold">Date</th>
                  <th className="text-center px-3 py-2 text-xs font-bold">Max Marks</th>
                  <th className="text-center px-3 py-2 text-xs font-bold">Marks Obtained</th>
                  <th className="text-center px-3 py-2 text-xs font-bold">%</th>
                  <th className="text-center px-3 py-2 text-xs font-bold rounded-tr-lg">Grade</th>
                </tr>
              </thead>
              <tbody>
                {myExams.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 text-sm">No exam results available</td>
                  </tr>
                )}
                {myExams.map((exam, i) => {
                  const sm = exam.studentMarks[studentId];
                  const pct = sm && !sm.absent ? Math.round((sm.marks / exam.maxMarks) * 100) : null;
                  const grade = pct !== null ? getGrade(pct) : "—";
                  return (
                    <tr key={exam.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <p className="font-bold text-slate-800">{exam.subjectName}</p>
                        <p className="text-[11px] text-slate-400">{exam.examName}</p>
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center text-slate-600 text-xs">{exam.examDate || "—"}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold text-slate-700">{exam.maxMarks}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                        {sm?.absent
                          ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">Absent</span>
                          : <span className="font-black text-slate-900">{sm?.marks ?? "—"}</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                        {pct !== null ? (
                          <span className="font-bold" style={{ color: getGradeColor(pct) }}>{pct}%</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                        <span className="font-black text-base" style={{ color: pct !== null ? getGradeColor(pct) : "#94a3b8" }}>{grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {myExams.length > 0 && (
                <tfoot>
                  <tr className="bg-indigo-50">
                    <td className="px-3 py-2.5 font-black text-slate-800 text-sm" colSpan={2}>Total / Overall</td>
                    <td className="px-3 py-2.5 text-center font-black text-slate-800">{totalMax}</td>
                    <td className="px-3 py-2.5 text-center font-black text-slate-800">{totalMarks}</td>
                    <td className="px-3 py-2.5 text-center font-black" style={{ color: getGradeColor(avgPct) }}>{avgPct}%</td>
                    <td className="px-3 py-2.5 text-center font-black" style={{ color: getGradeColor(avgPct) }}>{getGrade(avgPct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Result Banner */}
          {myExams.length > 0 && (
            <div className={`mx-6 mb-4 rounded-xl px-4 py-3 flex items-center gap-3 ${overallResult === "PASS" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${overallResult === "PASS" ? "bg-green-500" : "bg-red-500"}`}>
                {overallResult === "PASS" ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className={`font-black text-lg ${overallResult === "PASS" ? "text-green-700" : "text-red-700"}`}>
                  Result: {overallResult}
                </p>
                <p className="text-xs text-slate-500">
                  {totalMarks}/{totalMax} Marks — {avgPct}% — Grade: {getGrade(avgPct)}
                </p>
              </div>
            </div>
          )}

          {/* Grade Scale */}
          <div className="px-6 pb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Grading Scale</p>
            <div className="flex flex-wrap gap-2">
              {[["A+","91-100"],["A","81-90"],["B+","71-80"],["B","61-70"],["C+","51-60"],["C","41-50"],["D","33-40"],["F","<33"]].map(([g,r]) => (
                <span key={g} className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                  <span className="font-black">{g}</span>: {r}%
                </span>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div className="px-6 pb-6 pt-2 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
            {["Class Teacher", "Principal", "Parent / Guardian"].map(label => (
              <div key={label}>
                <div className="h-10 border-b border-slate-300 mb-1" />
                <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-indigo-900 text-indigo-300 text-center text-[10px] py-2 px-4">
            Generated by IIC School Ecosystem • {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 px-4 py-5">
        {view === "dashboard" ? (
          onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-indigo-300 text-sm mb-2 hover:text-white active:opacity-70">
              <ChevronLeft className="w-4 h-4" /> Student Dashboard
            </button>
          )
        ) : (
          <button onClick={() => {
            if (view === "lessons") setView("subjects");
            else setView("dashboard");
          }} className="flex items-center gap-1 text-indigo-300 text-sm mb-2 hover:text-white">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <div className="flex items-center gap-3">
          {/* Photo Avatar — clickable to upload */}
          <div className="relative flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/30 flex items-center justify-center bg-white/20 active:opacity-70 transition-opacity"
              title="Tap to upload photo"
            >
              {photoUploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : studentData?.photoUrl ? (
                <img src={studentData.photoUrl} alt={studentName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-white" />
              )}
            </button>
            {/* Camera badge */}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
              <Camera className="w-3 h-3 text-indigo-700" />
            </div>
          </div>
          <div>
            <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider">Student</p>
            <h1 className="text-xl font-bold text-white">{studentName}</h1>
            <p className="text-slate-300 text-sm mt-0.5">{school?.name}</p>
          </div>
        </div>
        {!studentData?.photoUrl && !photoUploading && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white font-medium"
          >
            <Camera className="w-3.5 h-3.5" /> Apni photo upload karein
          </button>
        )}
      </div>

      {view === "dashboard" && (
        <div className="max-w-2xl mx-auto pb-8">

          {/* ── SCHOOL SUBJECTS ── */}
          <div className="px-4 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">School Lessons</h2>
              <button onClick={() => setView("subjects")}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm text-center text-slate-400">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No subjects available yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {subjects.slice(0, 4).map((sub, i) => {
                  const colors = [
                    { bg: "bg-blue-50 dark:bg-blue-900/20", icon: "bg-blue-100 dark:bg-blue-800/40", text: "text-blue-700 dark:text-blue-300" },
                    { bg: "bg-purple-50 dark:bg-purple-900/20", icon: "bg-purple-100 dark:bg-purple-800/40", text: "text-purple-700 dark:text-purple-300" },
                    { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "bg-emerald-100 dark:bg-emerald-800/40", text: "text-emerald-700 dark:text-emerald-300" },
                    { bg: "bg-orange-50 dark:bg-orange-900/20", icon: "bg-orange-100 dark:bg-orange-800/40", text: "text-orange-700 dark:text-orange-300" },
                  ][i % 4];
                  return (
                    <button key={sub.id}
                      onClick={() => { setSelectedSubject(sub); setView("lessons"); }}
                      className={`${colors.bg} rounded-2xl p-4 text-left active:scale-[0.97] transition-transform shadow-sm`}>
                      <div className={`${colors.icon} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                        <BookOpen className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <p className={`font-bold text-sm leading-snug ${colors.text}`}>{sub.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tap to study</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── IIC PLATFORM CONTENT ── */}
          {onOpenPlatformContent && (
            <div className="px-4 mt-4">
              <button
                onClick={onOpenPlatformContent}
                className="w-full text-left rounded-2xl overflow-hidden shadow-md bg-gradient-to-r from-indigo-600 to-violet-600 active:scale-[0.99] transition-transform"
              >
                <div className="px-4 py-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm leading-tight">IIC Platform Content</p>
                    <p className="text-indigo-200 text-xs mt-0.5">Lucent • NCERT • Competition Prep</p>
                    <div className="flex gap-1.5 mt-2">
                      {["Reading", "PDF", "MCQ"].map(f => (
                        <span key={f} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">{f}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/60 flex-shrink-0" />
                </div>
              </button>
            </div>
          )}

          {/* ── PERFORMANCE SNAPSHOT ── */}
          <div className="px-4 mt-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-white mb-3">My Progress</h2>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden divide-y dark:divide-slate-700">

              {/* Attendance row */}
              <button onClick={() => setView("attendance")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${attPct >= 75 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                  <Calendar className={`w-4 h-4 ${attPct >= 75 ? "text-green-600" : "text-red-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Attendance</p>
                  <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-full">
                    <div className={`h-full rounded-full ${attPct >= 75 ? "bg-green-500" : "bg-red-400"}`} style={{ width: `${attPct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className={`text-base font-bold ${attPct >= 75 ? "text-green-500" : "text-red-400"}`}>{attPct}%</p>
                  <p className="text-[10px] text-slate-400">{myPresentDays}/{myAttDays.length} days</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
              </button>

              {/* Results row */}
              <button onClick={() => setView("results")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Exam Results</p>
                  <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${avgPct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-base font-bold text-blue-500">{avgPct}%</p>
                  <p className="text-[10px] text-slate-400">{myExams.length} exams</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
              </button>

              {/* Fee row */}
              <button onClick={() => setView("fees")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${currentFee?.paid ? "bg-green-100 dark:bg-green-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                  {currentFee?.paid
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <AlertCircle className="w-4 h-4 text-orange-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fee Status</p>
                  <p className={`text-xs mt-0.5 ${currentFee?.paid ? "text-green-600 dark:text-green-400" : "text-orange-500"}`}>
                    {currentFee?.paid
                      ? `Paid — ${new Date(currentMonthStr() + "-01").toLocaleString("default", { month: "long" })}`
                      : `Pending ₹${currentFee?.amount || studentData?.monthlyFee || 0}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* SUBJECTS */}
      {view === "subjects" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-slate-500">Choose a subject to study:</p>
          {subjects.map(sub => (
            <button key={sub.id} onClick={() => { setSelectedSubject(sub); setView("lessons"); }}
              className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 dark:text-white">{sub.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
          {subjects.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No subjects available yet</p>
            </div>
          )}
        </div>
      )}

      {/* LESSONS */}
      {view === "lessons" && selectedSubject && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {/* Subscription expired banner */}
          {isSubExpired && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <Lock className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-red-700 dark:text-red-400">Subscription Khatam</p>
                <p className="text-xs text-red-500 dark:text-red-400">
                  {subExpiredDate ? `${subExpiredDate} ko expire hua` : "Subscription active nahi hai"} — Admin se renew karwaein
                </p>
              </div>
            </div>
          )}
          <p className="text-sm font-medium text-slate-500">{selectedSubject.name} — Lessons:</p>
          {lessons.map(lesson => (
            <div key={lesson.id} className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm ${isSubExpired ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  {isSubExpired ? <Lock className="w-3.5 h-3.5 text-red-400" /> : <span className="text-xs font-bold text-blue-600">{lesson.order}</span>}
                </div>
                <p className="flex-1 font-bold text-slate-800 dark:text-white leading-snug">{lesson.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {lesson.features?.readingEnabled && (
                  <button
                    disabled={isSubExpired}
                    onClick={() => { if (!isSubExpired) { setSelectedLesson(lesson); setSmartMode("reading"); setView("smart_class"); } }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${isSubExpired ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 active:scale-95"}`}>
                    <BookOpen className="w-3.5 h-3.5" /> Reading
                  </button>
                )}
                {lesson.features?.writingEnabled && (
                  <button
                    disabled={isSubExpired}
                    onClick={() => { if (!isSubExpired) { setSelectedLesson(lesson); setSmartMode("writing"); setView("smart_class"); } }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${isSubExpired ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 active:scale-95"}`}>
                    <Edit3 className="w-3.5 h-3.5" /> Writing
                  </button>
                )}
                {lesson.features?.pdfEnabled && lesson.pdfUrl && (
                  <button
                    disabled={isSubExpired}
                    onClick={() => { if (!isSubExpired) { setSelectedLesson(lesson); setSmartMode("pdf"); setView("smart_class"); } }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${isSubExpired ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 active:scale-95"}`}>
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                )}
                {lesson.features?.mcqEnabled && lesson.mcqs?.length ? (
                  <button
                    disabled={isSubExpired}
                    onClick={() => { if (!isSubExpired) { setSelectedLesson(lesson); setSmartMode("mcq"); setView("smart_class"); } }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${isSubExpired ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 active:scale-95"}`}>
                    <HelpCircle className="w-3.5 h-3.5" /> MCQ
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {lessons.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No lessons added yet</p>
            </div>
          )}
        </div>
      )}

      {/* ATTENDANCE */}
      {view === "attendance" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">Attendance Rate</span>
              <span className={`font-bold ${attPct >= 75 ? "text-green-500" : "text-red-500"}`}>{attPct}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${attPct >= 75 ? "bg-green-500" : "bg-red-400"}`} style={{ width: `${attPct}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{myPresentDays} present / {myAttDays.length} total school days</p>
          </div>
          <div className="space-y-2">
            {myAttDays.sort((a, b) => b.date.localeCompare(a.date)).map(rec => {
              const myRec = rec.students[studentId];
              return (
                <div key={rec.date} className={`rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm ${myRec?.present ? "bg-white dark:bg-slate-800" : "bg-red-50 dark:bg-red-900/20"}`}>
                  {myRec?.present
                    ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{new Date(rec.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                    {myRec?.note && <p className="text-xs text-slate-400">{myRec.note}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${myRec?.present ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {myRec?.present ? "Present" : "Absent"}
                  </span>
                </div>
              );
            })}
            {myAttDays.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">No attendance records yet</div>
            )}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {view === "results" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">Overall Performance</span>
              <span className="font-bold text-blue-500">{avgPct}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${avgPct}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{totalMarks}/{totalMax} total marks across {myExams.length} exams</p>
          </div>

          {/* Marksheet Button */}
          {myExams.length > 0 && (
            <button
              onClick={() => setView("marksheet")}
              className="w-full flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl px-4 py-3.5 shadow-md active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-sm">Official Marksheet Dekhein</p>
                <p className="text-indigo-200 text-xs mt-0.5">Print / Download karne ke liye</p>
              </div>
              <Printer className="w-5 h-5 text-white/70 flex-shrink-0" />
            </button>
          )}

          {myExams.map(exam => {
            const sm = exam.studentMarks[studentId];
            const pct = sm && !sm.absent ? Math.round((sm.marks / exam.maxMarks) * 100) : null;
            return (
              <div key={exam.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 dark:text-white">{exam.examName}</p>
                    <p className="text-xs text-slate-400">{exam.subjectName} • {exam.examDate}</p>
                  </div>
                  {sm?.absent
                    ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Absent</span>
                    : <div className="text-right">
                        <p className="font-bold text-lg" style={{ color: pct! >= 75 ? "#16a34a" : pct! >= 40 ? "#2563eb" : "#dc2626" }}>
                          {sm?.marks}/{exam.maxMarks}
                        </p>
                        <p className="text-xs text-slate-400">{pct}% — {pct !== null ? getGrade(pct) : "—"}</p>
                      </div>
                  }
                </div>
                {pct !== null && (
                  <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct >= 75 ? "#16a34a" : pct >= 40 ? "#3b82f6" : "#ef4444" }} />
                  </div>
                )}
              </div>
            );
          })}
          {myExams.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Award className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No exam results yet</p>
            </div>
          )}
        </div>
      )}

      {/* FEES */}
      {view === "fees" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-slate-500">Fee History</p>
          {fees.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No fee records yet</p>
            </div>
          )}
          {fees.map(fee => (
            <div key={fee.month} className={`rounded-xl p-4 shadow-sm ${fee.paid ? "bg-white dark:bg-slate-800" : "bg-orange-50 dark:bg-orange-900/20"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fee.paid ? "bg-green-100 dark:bg-green-900/40" : "bg-orange-100 dark:bg-orange-900/40"}`}>
                  {fee.paid ? <CheckCircle className="w-5 h-5 text-green-500" /> : <IndianRupee className="w-5 h-5 text-orange-500" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-white">
                    {new Date(fee.month + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-slate-400">
                    ₹{fee.amount} • {fee.paid ? `Paid ${fee.paidDate ? new Date(fee.paidDate).toLocaleDateString() : ""}` : "Unpaid"}
                  </p>
                  {fee.receiptNo && <p className="text-xs text-green-500">Receipt: {fee.receiptNo}</p>}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${fee.paid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {fee.paid ? "PAID" : "DUE"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
