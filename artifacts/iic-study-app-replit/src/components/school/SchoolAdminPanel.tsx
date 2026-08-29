// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  subscribeToSessions, subscribeToClasses, subscribeToSubjects, subscribeToTeachers,
  subscribeToAllStudents, saveSession, saveClass, saveSubject, saveTeacher, saveStudent,
  deleteClass, deleteSubject, deleteTeacher, deleteStudent, updateStudent,
  updateSchool, updateSession, updateClass, updateTeacher,
  generateId, getSchool, getSessions, setSchoolLockCode,
  assignSchoolSubAdminByEmail, getSchoolAdmins, removeSchoolUserByUid,
  getAllMonthlyFees, currentMonthStr, saveFee, markFeePaid
} from "../../school-firebase";
import type { SchoolUserProfile } from "../../school-types";
import type {
  School, SchoolSession, SchoolClass, SchoolSubject, SchoolTeacher, SchoolStudent
} from "../../school-types";
import { ContentManager } from "./ContentManager";
import { SmartClass } from "./SmartClass";
import { AttendanceManager } from "./AttendanceManager";
import { FeeManager } from "./FeeManager";
import { ReportCard } from "./ReportCard";
import { MarksManager } from "./MarksManager";
import { ExamResultsPanel } from "./ExamResultsPanel";
import type { MonthlyFee } from "../../school-types";
import {
  Users, BookOpen, Calendar, IndianRupee, Plus, Trash2, Settings,
  ChevronRight, ChevronLeft, X, Edit3, FileText, Award,
  MapPin, Phone, User, ChevronDown, ChevronUp, Save, Building2,
  Lock, Eye, EyeOff, Shield, ArrowLeft, ShoppingBag, AlertTriangle, Crown
} from "lucide-react";
import { SchoolStore } from "./SchoolStore";
import { SchoolPlanView } from "./SchoolPlanView";

interface Props {
  schoolId: string;
  adminUid: string;
  onBack?: () => void;
}

type AdminView =
  | "dashboard"
  | "sessions" | "classes" | "subjects" | "teachers" | "students"
  | "content" | "attendance" | "fees" | "fee_class" | "report_card" | "marks" | "results"
  | "store" | "subscription";

export const SchoolAdminPanel: React.FC<Props> = ({ schoolId, adminUid, onBack }) => {
  const [school, setSchool] = useState<School | null>(null);
  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [activeSession, setActiveSession] = useState<SchoolSession | null>(null);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [view, setView] = useState<AdminView>("dashboard");
  const [smartClassLesson, setSmartClassLesson] = useState<any>(null);
  const [smartClassMode, setSmartClassMode] = useState<"reading" | "writing" | "pdf" | "mcq">("reading");
  const [saving, setSaving] = useState(false);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [expiryPopupExpired, setExpiryPopupExpired] = useState(false);

  // School info card
  const [schoolCardExpanded, setSchoolCardExpanded] = useState(false);
  const [editingSchoolInfo, setEditingSchoolInfo] = useState(false);
  const [schoolInfoForm, setSchoolInfoForm] = useState({
    principalName: "", directorName: "", mobile: "", address: "",
    tagline: "", bannerColor: ""
  });
  const [savingSchoolInfo, setSavingSchoolInfo] = useState(false);

  // Lock code
  const [lockCodeInput, setLockCodeInput]     = useState('');
  const [lockCodeActive, setLockCodeActive]   = useState(false);
  const [showLockCode, setShowLockCode]       = useState(false);
  const [savingLockCode, setSavingLockCode]   = useState(false);
  const [lockCodeSaved, setLockCodeSaved]     = useState(false);

  // Sub-admin management
  const [subAdmins, setSubAdmins]             = useState<SchoolUserProfile[]>([]);
  const [subAdminEmail, setSubAdminEmail]     = useState('');
  const [assigningSubAdmin, setAssigningSubAdmin] = useState(false);
  const [subAdminResult, setSubAdminResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // Forms
  const [sessionForm, setSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [classForm, setClassForm] = useState({ name: "", section: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "" });
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", phone: "", employeeId: "" });
  const [studentForm, setStudentForm] = useState<any>({
    name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "",
    phone: "", dateOfBirth: "", monthlyFee: 0
  });
  const [showForm, setShowForm] = useState<string | null>(null);

  // Edit states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassForm, setEditClassForm] = useState({ name: "", section: "", defaultFee: 0 });
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherForm, setEditTeacherForm] = useState({ name: "", email: "", phone: "", employeeId: "" });
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<any>({ name: "", rollNo: "", fatherName: "", motherName: "", phone: "", monthlyFee: 0, photoUrl: "" });

  // Fee summary state
  const [feeMonth, setFeeMonth] = useState(currentMonthStr());
  const [allFees, setAllFees] = useState<MonthlyFee[]>([]);
  const [feeSummaryLoading, setFeeSummaryLoading] = useState(false);
  const [feeClassSelected, setFeeClassSelected] = useState<SchoolClass | null>(null);

  // Class preset names
  const CLASS_PRESETS = ["Play", "Nursery", "KG-1", "KG-2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];

  // 48-hour expiry warning — shown once per login session
  useEffect(() => {
    if (!school) return;
    const sessionKey = `iic_expiry_warned_${schoolId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    const expIso = school.subscription?.expiresAt || school.subscription?.paidUntil;
    if (!expIso) return;
    const msLeft = new Date(expIso).getTime() - Date.now();
    const hoursLeft = msLeft / 3600000;
    if (hoursLeft <= 48) {
      sessionStorage.setItem(sessionKey, '1');
      setExpiryPopupExpired(hoursLeft <= 0);
      setShowExpiryPopup(true);
    }
  }, [school]);

  useEffect(() => {
    getSchool(schoolId).then(s => {
      setSchool(s);
      if (s) {
        setLockCodeInput(s.lockCode || '');
        setLockCodeActive(s.lockCodeActive ?? false);
      }
    });
    loadSubAdmins();
    const unsubSessions = subscribeToSessions(schoolId, (sess) => {
      setSessions(sess);
      const active = sess.find(s => s.active) || sess[0] || null;
      setActiveSession(active);
    });
    const unsubTeachers = subscribeToTeachers(schoolId, setTeachers);
    const unsubStudents = subscribeToAllStudents(schoolId, setStudents);
    return () => { unsubSessions(); unsubTeachers(); unsubStudents(); };
  }, [schoolId]);

  useEffect(() => {
    if (!activeSession) return;
    const unsubClasses = subscribeToClasses(schoolId, activeSession.id, setClasses);
    return unsubClasses;
  }, [activeSession]);

  useEffect(() => {
    if (!selectedClass) return;
    const unsubSubjects = subscribeToSubjects(schoolId, selectedClass.id, setSubjects);
    return unsubSubjects;
  }, [selectedClass]);

  const addSession = async () => {
    if (!sessionForm.name.trim()) return;
    setSaving(true);
    const id = generateId();
    await saveSession({
      id, schoolId, name: sessionForm.name,
      startDate: sessionForm.startDate, endDate: sessionForm.endDate, active: true,
      createdAt: new Date().toISOString()
    });
    setSessionForm({ name: "", startDate: "", endDate: "" });
    setShowForm(null);
    setSaving(false);
  };

  const addClass = async () => {
    if (!classForm.name.trim() || !activeSession) return;
    setSaving(true);
    const id = generateId();
    await saveClass({
      id, schoolId, sessionId: activeSession.id,
      name: classForm.name, section: classForm.section,
      createdAt: new Date().toISOString()
    });
    setClassForm({ name: "", section: "" });
    setShowForm(null);
    setSaving(false);
  };

  const addSubject = async () => {
    if (!subjectForm.name.trim() || !selectedClass || !activeSession) return;
    setSaving(true);
    const id = generateId();
    await saveSubject({
      id, schoolId, sessionId: activeSession.id, classId: selectedClass.id,
      name: subjectForm.name, createdAt: new Date().toISOString()
    });
    setSubjectForm({ name: "" });
    setShowForm(null);
    setSaving(false);
  };

  const addTeacher = async () => {
    if (!teacherForm.name.trim()) return;
    setSaving(true);
    const id = generateId();
    await saveTeacher({
      id, schoolId, name: teacherForm.name, email: teacherForm.email,
      phone: teacherForm.phone, employeeId: teacherForm.employeeId,
      subjects: [], classes: [], active: true,
      joinDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    });
    setTeacherForm({ name: "", email: "", phone: "", employeeId: "" });
    setShowForm(null);
    setSaving(false);
  };

  const addStudent = async () => {
    if (!studentForm.name.trim() || !selectedClass || !activeSession) return;
    setSaving(true);
    const id = generateId();
    await saveStudent({
      id, schoolId, sessionId: activeSession.id, classId: selectedClass.id,
      name: studentForm.name, rollNo: studentForm.rollNo,
      admissionNo: studentForm.admissionNo, fatherName: studentForm.fatherName,
      motherName: studentForm.motherName, phone: studentForm.phone,
      dateOfBirth: studentForm.dateOfBirth,
      monthlyFee: Number(studentForm.monthlyFee) || 0,
      active: true, joinDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    });
    setStudentForm({ name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "", phone: "", dateOfBirth: "", monthlyFee: (selectedClass as any)?.defaultFee || 0 });
    setShowForm(null);
    setSaving(false);
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const saveEditSession = async () => {
    if (!editingSessionId || !editSessionForm.name.trim()) return;
    setSaving(true);
    await updateSession(schoolId, editingSessionId, {
      name: editSessionForm.name.trim(),
      startDate: editSessionForm.startDate,
      endDate: editSessionForm.endDate,
    });
    setEditingSessionId(null);
    setSaving(false);
  };

  const saveEditClass = async () => {
    if (!editingClassId || !editClassForm.name.trim()) return;
    setSaving(true);
    await updateClass(schoolId, editingClassId, {
      name: editClassForm.name.trim(),
      section: editClassForm.section,
      defaultFee: Number(editClassForm.defaultFee) || 0,
    });
    setEditingClassId(null);
    setSaving(false);
  };

  const saveEditTeacher = async () => {
    if (!editingTeacherId || !editTeacherForm.name.trim()) return;
    setSaving(true);
    await updateTeacher(schoolId, editingTeacherId, {
      name: editTeacherForm.name.trim(),
      email: editTeacherForm.email,
      phone: editTeacherForm.phone,
      employeeId: editTeacherForm.employeeId,
    });
    setEditingTeacherId(null);
    setSaving(false);
  };

  const saveEditStudent = async () => {
    if (!editingStudentId || !editStudentForm.name.trim()) return;
    setSaving(true);
    const student = students.find(s => s.id === editingStudentId);
    const oldPhoto = (student as any)?.photoUrl || "";
    const newPhoto = editStudentForm.photoUrl || "";
    const photoChanged = newPhoto !== oldPhoto;
    await updateStudent(schoolId, editingStudentId, {
      name: editStudentForm.name.trim(),
      rollNo: editStudentForm.rollNo,
      fatherName: editStudentForm.fatherName,
      motherName: editStudentForm.motherName,
      phone: editStudentForm.phone,
      monthlyFee: Number(editStudentForm.monthlyFee) || 0,
      photoUrl: newPhoto || undefined,
    });
    // If photo was updated and charge is enabled, add ₹50 fee
    if (photoChanged && newPhoto && editStudentForm.chargePhotoFee && activeSession) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const feeRecord: any = {
        schoolId, sessionId: activeSession.id,
        studentId: editingStudentId,
        studentName: student?.name || editStudentForm.name,
        rollNo: editStudentForm.rollNo,
        classId: student?.classId || "",
        month,
        amount: 50,
        paid: false,
        note: "Photo update charge"
      };
      await saveFee(feeRecord);
    }
    setEditingStudentId(null);
    setSaving(false);
  };

  const saveSchoolInfo = async () => {
    setSavingSchoolInfo(true);
    await updateSchool(schoolId, {
      principalName: schoolInfoForm.principalName,
      directorName: schoolInfoForm.directorName,
      mobile: schoolInfoForm.mobile,
      address: schoolInfoForm.address,
      tagline: schoolInfoForm.tagline,
      bannerColor: schoolInfoForm.bannerColor,
    });
    setSchool(prev => prev ? {
      ...prev,
      principalName: schoolInfoForm.principalName,
      directorName: schoolInfoForm.directorName,
      mobile: schoolInfoForm.mobile,
      address: schoolInfoForm.address,
      tagline: schoolInfoForm.tagline,
      bannerColor: schoolInfoForm.bannerColor,
    } : prev);
    setEditingSchoolInfo(false);
    setSavingSchoolInfo(false);
  };

  const saveLockCode = async () => {
    setSavingLockCode(true);
    await setSchoolLockCode(schoolId, lockCodeInput.trim(), lockCodeActive);
    setSchool(prev => prev ? { ...prev, lockCode: lockCodeInput.trim(), lockCodeActive } : prev);
    setSavingLockCode(false);
    setLockCodeSaved(true);
    setTimeout(() => setLockCodeSaved(false), 2000);
  };

  const loadSubAdmins = () => {
    getSchoolAdmins(schoolId).then(list => setSubAdmins(list)).catch(() => {});
  };

  const handleAssignSubAdmin = async () => {
    if (!subAdminEmail.trim()) return;
    setAssigningSubAdmin(true);
    setSubAdminResult(null);
    try {
      const profile = await assignSchoolSubAdminByEmail(schoolId, subAdminEmail.trim());
      setSubAdminResult({ ok: true, msg: `✅ ${profile.name} ab is school ka sub-admin hai!` });
      setSubAdminEmail('');
      loadSubAdmins();
    } catch (e: any) {
      setSubAdminResult({ ok: false, msg: `❌ ${e.message || 'Error aaya, dobara try karo.'}` });
    }
    setAssigningSubAdmin(false);
  };

  const handleRemoveSubAdmin = async (uid: string) => {
    await removeSchoolUserByUid(uid);
    loadSubAdmins();
  };

  const openEditSchoolInfo = () => {
    setSchoolInfoForm({
      principalName: school?.principalName || "",
      directorName: school?.directorName || "",
      mobile: school?.mobile || school?.phone || "",
      address: school?.address || "",
      tagline: school?.tagline || "",
      bannerColor: school?.bannerColor || "",
    });
    setEditingSchoolInfo(true);
    setSchoolCardExpanded(true);
  };

  // ── Subscription access helpers ─────────────────────────────────────────
  const subStatus  = school?.subscription?.status;
  const subTier    = school?.subscription?.tier;
  const _expiresAt = school?.subscription?.expiresAt || school?.subscription?.paidUntil;
  const planExpired = _expiresAt ? new Date(_expiresAt) < new Date() : false;
  const subscriptionActive = subStatus === "active" && !planExpired;
  // Full tier (or legacy schools with no tier set — backwards compat) can manage content
  const canManageContent  = subscriptionActive && (subTier === "full" || subTier === undefined);
  // Both lite and full need an active (non-expired) subscription for data management
  const canManageStudents = subscriptionActive;

  // ── Store view ─────────────────────────────────────────────────────────
  if (view === "store" && school) {
    return <SchoolStore school={school} onBack={() => setView("dashboard")} />;
  }

  // ── School Plan view ─────────────────────────────────────────────────────
  if (view === "subscription") {
    return (
      <SchoolPlanView
        school={school}
        schoolId={schoolId}
        adminUid={adminUid}
        onBack={() => setView("dashboard")}
      />
    );
  }

  // Smart class handler
  if (smartClassLesson) {
    return (
      <SmartClass
        lesson={smartClassLesson}
        initialMode={smartClassMode}
        schoolId={schoolId}
        isAdmin={true}
        onBack={() => setSmartClassLesson(null)}
      />
    );
  }

  // Sub-panels
  if (view === "content" && selectedClass && selectedSubject) {
    if (!canManageContent) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4 py-5">
            <button onClick={() => setView("subjects")} className="flex items-center gap-1 text-blue-300 text-sm mb-2 hover:text-white">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-xl font-bold text-white">Content Manager</h1>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Content Feature Locked</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                {!subscriptionActive
                  ? "Aapka subscription inactive hai. Content manage karne ke liye Pro Plan lo."
                  : "Content manage karne ke liye Pro Plan chahiye. Abhi Lite Plan active hai."}
              </p>
            </div>
            <button
              onClick={() => setView("store")}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm"
            >
              <Crown className="w-4 h-4" /> Pro Plan Lo
            </button>
          </div>
        </div>
      );
    }
    return (
      <ContentManager
        schoolId={schoolId}
        sessionId={activeSession?.id || ""}
        classId={selectedClass.id}
        subjectId={selectedSubject.id}
        subjectName={selectedSubject.name}
        className={selectedClass.name}
        authorId={adminUid}
        subscription={school?.subscription || { reading: true, writing: true, pdf: true, mcq: true }}
        onBack={() => { setView("subjects"); }}
        onOpenLesson={(lesson, mode) => { setSmartClassLesson(lesson); setSmartClassMode(mode); }}
      />
    );
  }

  if (view === "attendance" && selectedClass) {
    return (
      <AttendanceManager
        schoolId={schoolId}
        classId={selectedClass.id}
        className={selectedClass.name}
        teacherId={adminUid}
        onBack={() => setView("classes")}
      />
    );
  }

  if (view === "fee_class" && feeClassSelected) {
    return (
      <FeeManager
        schoolId={schoolId}
        classId={feeClassSelected.id}
        className={feeClassSelected.name}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        onBack={() => setView("fees")}
      />
    );
  }

  if (view === "results" && selectedClass) {
    return (
      <ExamResultsPanel
        schoolId={schoolId}
        classId={selectedClass.id}
        className={selectedClass.name}
        sessionId={activeSession?.id || ""}
        subjects={subjects.filter(s => s.classId === selectedClass.id)}
        adminId={adminUid}
        schoolName={school?.name}
        onBack={() => setView("classes")}
      />
    );
  }

  if (view === "report_card" && selectedClass) {
    return (
      <ReportCard
        schoolId={schoolId}
        classId={selectedClass.id}
        className={selectedClass.name}
        sessionId={activeSession?.id || ""}
        onBack={() => setView("classes")}
      />
    );
  }

  if (view === "marks" && selectedClass) {
    return (
      <MarksManager
        schoolId={schoolId}
        classId={selectedClass.id}
        className={selectedClass.name}
        sessionId={activeSession?.id || ""}
        teacherId={adminUid}
        subjectId={selectedSubject?.id}
        subjectName={selectedSubject?.name}
        onBack={() => setView("classes")}
      />
    );
  }

  const menuItems = [
    { label: "Sessions", icon: <Calendar className="w-5 h-5 text-blue-500" />, view: "sessions", count: sessions.length, locked: false },
    { label: "Classes", icon: <BookOpen className="w-5 h-5 text-purple-500" />, view: "classes", count: classes.length, locked: false },
    { label: "Teachers", icon: <Users className="w-5 h-5 text-green-500" />, view: "teachers", count: teachers.length, locked: false },
    { label: "Students", icon: <Users className="w-5 h-5 text-orange-500" />, view: "students", count: students.length, locked: false },
    { label: "Fee Collection", icon: <IndianRupee className="w-5 h-5 text-emerald-500" />, view: "fees", count: null, locked: false },
    {
      label: "Mera Plan",
      icon: <Crown className="w-5 h-5 text-amber-500" />,
      view: "subscription",
      count: null,
      locked: false,
    },
    {
      label: "Store / Plans",
      icon: <ShoppingBag className="w-5 h-5 text-violet-500" />,
      view: "store",
      count: null,
      locked: false,
    },
  ];

  // List views
  const renderListView = () => {
    if (view === "sessions") {
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <button onClick={() => { setShowForm("session"); setEditingSessionId(null); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Session
          </button>
          {showForm === "session" && !editingSessionId && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <input value={sessionForm.name} onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Session Name (e.g. 2026-27)"
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
              <div className="flex gap-2">
                <input type="date" value={sessionForm.startDate} onChange={e => setSessionForm(p => ({ ...p, startDate: e.target.value }))}
                  className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                <input type="date" value={sessionForm.endDate} onChange={e => setSessionForm(p => ({ ...p, endDate: e.target.value }))}
                  className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={addSession} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              {editingSessionId === s.id ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Edit Session</p>
                  <input value={editSessionForm.name} onChange={e => setEditSessionForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Session Name" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  <div className="flex gap-2">
                    <input type="date" value={editSessionForm.startDate} onChange={e => setEditSessionForm(p => ({ ...p, startDate: e.target.value }))}
                      className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                    <input type="date" value={editSessionForm.endDate} onChange={e => setEditSessionForm(p => ({ ...p, endDate: e.target.value }))}
                      className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditSession} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                      <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingSessionId(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 dark:text-white">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.startDate} → {s.endDate}</p>
                  </div>
                  {s.active && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>}
                  <button onClick={() => { setEditingSessionId(s.id); setEditSessionForm({ name: s.name, startDate: s.startDate || "", endDate: s.endDate || "" }); setShowForm(null); }}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (view === "classes") {
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {!activeSession && <div className="text-center py-6 text-slate-400 text-sm">Please create a session first</div>}
          {activeSession && (
            <>
              <button onClick={() => { setShowForm("class"); setEditingClassId(null); }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Class
              </button>
              {showForm === "class" && !editingClassId && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                  <p className="text-xs text-slate-500 font-medium">Quick Select:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLASS_PRESETS.map(preset => (
                      <button key={preset} onClick={() => setClassForm(p => ({ ...p, name: preset }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${classForm.name === preset ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}>
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input value={classForm.name} onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ya khud likhiye — Class Name" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  <input value={classForm.section} onChange={e => setClassForm(p => ({ ...p, section: e.target.value }))}
                    placeholder="Section (optional, e.g. A)" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Default Fee (₹/month):</label>
                    <input type="number" value={(classForm as any).defaultFee || ""} placeholder="0"
                      onChange={e => setClassForm(p => ({ ...p, defaultFee: Number(e.target.value) } as any))}
                      className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addClass} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                    <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {[...classes].sort((a, b) => {
                const na = parseInt(a.name.replace(/\D+/g, '')) || 0;
                const nb = parseInt(b.name.replace(/\D+/g, '')) || 0;
                return na !== nb ? na - nb : a.name.localeCompare(b.name);
              }).map(cls => (
                <div key={cls.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                  {editingClassId === cls.id ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Edit Class</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CLASS_PRESETS.map(preset => (
                          <button key={preset} onClick={() => setEditClassForm(p => ({ ...p, name: preset }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${editClassForm.name === preset ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                            {preset}
                          </button>
                        ))}
                      </div>
                      <input value={editClassForm.name} onChange={e => setEditClassForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Class Name" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                      <input value={editClassForm.section} onChange={e => setEditClassForm(p => ({ ...p, section: e.target.value }))}
                        placeholder="Section (optional)" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 whitespace-nowrap">Default Fee (₹/mo):</label>
                        <input type="number" value={editClassForm.defaultFee || ""}
                          onChange={e => setEditClassForm(p => ({ ...p, defaultFee: Number(e.target.value) }))}
                          className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEditClass} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setEditingClassId(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 dark:text-white">{cls.name} {cls.section ? `(${cls.section})` : ""}</p>
                          <p className="text-xs text-slate-400">
                            {students.filter(s => s.classId === cls.id).length} students
                            {(cls as any).defaultFee ? ` • Fee: ₹${(cls as any).defaultFee}/mo` : ""}
                          </p>
                        </div>
                        <button onClick={() => { setEditingClassId(cls.id); setEditClassForm({ name: cls.name, section: cls.section || "", defaultFee: (cls as any).defaultFee || 0 }); setShowForm(null); }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteClass(schoolId, cls.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => { setSelectedClass(cls); setView("students"); }}
                          className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-lg font-medium">👥 Students</button>
                        <button onClick={() => { setSelectedClass(cls); setView("subjects"); }}
                          className="px-2.5 py-1.5 text-xs bg-purple-50 text-purple-600 dark:bg-purple-900/30 rounded-lg font-medium">📚 Subjects</button>
                        <button onClick={() => { setSelectedClass(cls); setView("attendance"); }}
                          className="px-2.5 py-1.5 text-xs bg-green-50 text-green-600 dark:bg-green-900/30 rounded-lg font-medium">✅ Attendance</button>
                        <button onClick={() => { setSelectedClass(cls); setView("marks"); }}
                          className="px-2.5 py-1.5 text-xs bg-orange-50 text-orange-600 dark:bg-orange-900/30 rounded-lg font-medium">📝 Marks</button>
                        <button onClick={() => { setSelectedClass(cls); setView("report_card"); }}
                          className="px-2.5 py-1.5 text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 rounded-lg font-medium">📋 Report</button>
                        <button onClick={() => { setSelectedClass(cls); setView("results"); }}
                          className="px-2.5 py-1.5 text-xs bg-amber-50 text-amber-600 dark:bg-amber-900/30 rounded-lg font-medium">🏆 Results</button>
                        <button onClick={() => { setFeeClassSelected(cls); setView("fee_class"); }}
                          className="px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 rounded-lg font-medium">💰 Fees</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      );
    }

    if (view === "subjects") {
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {!selectedClass && <div className="text-slate-400 text-center py-8">Select a class first</div>}
          {selectedClass && (
            <>
              <p className="text-sm text-slate-500">Subjects for <strong className="text-slate-700 dark:text-slate-200">{selectedClass.name}</strong></p>
              <button onClick={() => setShowForm("subject")}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Subject
              </button>
              {showForm === "subject" && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                  <input value={subjectForm.name} onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Subject Name (e.g. Mathematics)" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white" />
                  <div className="flex gap-2">
                    <button onClick={addSubject} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                    <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              {subjects.map(sub => (
                <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 dark:text-white">{sub.name}</p>
                  </div>
                  <button onClick={() => { setSelectedSubject(sub); setView("content"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
                    <BookOpen className="w-3.5 h-3.5" /> Lessons
                  </button>
                  <button onClick={() => deleteSubject(schoolId, sub.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      );
    }

    if (view === "teachers") {
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <button onClick={() => { setShowForm("teacher"); setEditingTeacherId(null); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Teacher
          </button>
          {showForm === "teacher" && !editingTeacherId && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              {[
                ["name", "Full Name *", "text"], ["email", "Email", "email"],
                ["phone", "Phone", "tel"], ["employeeId", "Employee ID", "text"]
              ].map(([k, label, type]) => (
                <input key={k} type={type} value={(teacherForm as any)[k]}
                  onChange={e => setTeacherForm(p => ({ ...p, [k]: e.target.value }))}
                  placeholder={label}
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
              ))}
              <div className="flex gap-2">
                <button onClick={addTeacher} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {teachers.map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              {editingTeacherId === t.id ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Edit Teacher</p>
                  {[
                    ["name", "Full Name *", "text"], ["email", "Email", "email"],
                    ["phone", "Phone", "tel"], ["employeeId", "Employee ID", "text"]
                  ].map(([k, label, type]) => (
                    <input key={k} type={type} value={(editTeacherForm as any)[k]}
                      onChange={e => setEditTeacherForm(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={label}
                      className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  ))}
                  <div className="flex gap-2">
                    <button onClick={saveEditTeacher} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                      <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingTeacherId(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center font-bold text-green-700 flex-shrink-0">
                    {t.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-400 truncate">{t.email || "No email"} • {t.employeeId || "No ID"}</p>
                  </div>
                  <button onClick={() => { setEditingTeacherId(t.id); setEditTeacherForm({ name: t.name, email: t.email || "", phone: t.phone || "", employeeId: t.employeeId || "" }); setShowForm(null); }}
                    className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTeacher(schoolId, t.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (view === "students") {
      const classStudents = selectedClass ? students.filter(s => s.classId === selectedClass.id) : students;
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {selectedClass && <p className="text-sm text-slate-500">Students in <strong className="text-slate-700 dark:text-slate-200">{selectedClass.name}</strong></p>}
          {selectedClass && (
            <>
              <button onClick={() => {
                setShowForm("student");
                setEditingStudentId(null);
                setStudentForm({ name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "", phone: "", dateOfBirth: "", monthlyFee: (selectedClass as any)?.defaultFee || 0 });
              }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Student
              </button>
              {showForm === "student" && !editingStudentId && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
                  {[
                    ["name", "Full Name *", "text"], ["rollNo", "Roll Number *", "text"],
                    ["admissionNo", "Admission No", "text"], ["fatherName", "Father's Name", "text"],
                    ["motherName", "Mother's Name", "text"], ["phone", "Phone", "tel"],
                    ["dateOfBirth", "Date of Birth", "date"]
                  ].map(([k, label, type]) => (
                    <input key={k} type={type} value={(studentForm as any)[k]}
                      onChange={e => setStudentForm(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={label}
                      className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  ))}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Monthly Fee (₹):</label>
                      <input type="number" value={studentForm.monthlyFee}
                        onChange={e => setStudentForm(p => ({ ...p, monthlyFee: Number(e.target.value) }))}
                        className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                    </div>
                    {(selectedClass as any)?.defaultFee > 0 && (
                      <p className="text-[11px] text-blue-500 pl-1">
                        {selectedClass.name} ka default fee: ₹{(selectedClass as any).defaultFee}/mo
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addStudent} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                    <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
          {classStudents.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm">
              {editingStudentId === s.id ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Edit Student</p>
                  {[
                    ["name", "Full Name *", "text"], ["rollNo", "Roll Number", "text"],
                    ["fatherName", "Father's Name", "text"], ["motherName", "Mother's Name", "text"],
                    ["phone", "Phone", "tel"]
                  ].map(([k, label, type]) => (
                    <input key={k} type={type} value={(editStudentForm as any)[k]}
                      onChange={e => setEditStudentForm(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={label}
                      className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  ))}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Monthly Fee (₹):</label>
                    <input type="number" value={editStudentForm.monthlyFee}
                      onChange={e => setEditStudentForm(p => ({ ...p, monthlyFee: Number(e.target.value) }))}
                      className="flex-1 px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Student Photo (Google Drive Link)</label>
                    <input type="url" value={editStudentForm.photoUrl || ""}
                      onChange={e => setEditStudentForm(p => ({ ...p, photoUrl: e.target.value }))}
                      placeholder="https://drive.google.com/file/d/.../view"
                      className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                    <p className="text-[11px] text-slate-400 mt-0.5">Google Drive share link paste karo. Photo marksheet par dikhegi.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={editStudentForm.chargePhotoFee || false}
                      onChange={e => setEditStudentForm(p => ({ ...p, chargePhotoFee: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Photo update ke liye ₹50 charge karo student ko</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={saveEditStudent} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                      <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingStudentId(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0">
                    {s.rollNo || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.admissionNo || "No Adm No"} • Fee: ₹{s.monthlyFee}/mo</p>
                  </div>
                  <button onClick={() => { setEditingStudentId(s.id); setEditStudentForm({ name: s.name, rollNo: s.rollNo || "", fatherName: s.fatherName || "", motherName: s.motherName || "", phone: s.phone || "", monthlyFee: s.monthlyFee || 0, photoUrl: (s as any).photoUrl || "", chargePhotoFee: false }); setShowForm(null); }}
                    className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteStudent(schoolId, s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {classStudents.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No students yet</p>
            </div>
          )}
        </div>
      );
    }
    if (view === "fees") {
      const sortedClasses = [...classes].sort((a, b) => {
        const na = parseInt(a.name.replace(/\D+/g, '')) || 0;
        const nb = parseInt(b.name.replace(/\D+/g, '')) || 0;
        return na !== nb ? na - nb : a.name.localeCompare(b.name);
      });
      const changeMonth = (delta: number) => {
        const [y, m] = feeMonth.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setFeeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      };
      const loadFeeSummary = async () => {
        setFeeSummaryLoading(true);
        const fees = await getAllMonthlyFees(schoolId, feeMonth);
        setAllFees(fees);
        setFeeSummaryLoading(false);
      };
      if (allFees.length === 0 && !feeSummaryLoading) { loadFeeSummary(); }

      const schoolTotal = students.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
      const schoolCollected = allFees.filter(f => f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
      const schoolDue = allFees.filter(f => !f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);

      return (
        <div className="p-4 max-w-2xl mx-auto space-y-3">
          {/* Month selector */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <button onClick={() => { changeMonth(-1); setAllFees([]); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center font-bold text-slate-800 dark:text-white text-sm">
              {new Date(feeMonth + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => { changeMonth(1); setAllFees([]); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* School-wide totals */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-center">
              <p className="text-xs text-slate-400 mb-0.5">Expected</p>
              <p className="font-bold text-slate-800 dark:text-white text-sm">₹{schoolTotal.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 shadow-sm text-center">
              <p className="text-xs text-green-600 mb-0.5">Collected</p>
              <p className="font-bold text-green-700 text-sm">₹{schoolCollected.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 shadow-sm text-center">
              <p className="text-xs text-red-500 mb-0.5">Due</p>
              <p className="font-bold text-red-600 text-sm">₹{schoolDue.toLocaleString()}</p>
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Class-wise Summary</p>

          {feeSummaryLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Loading fees...</div>
          ) : sortedClasses.map(cls => {
            const classStudents = students.filter(s => s.classId === cls.id);
            const classFees = allFees.filter(f => f.classId === cls.id);
            const expected = classStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
            const collected = classFees.filter(f => f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
            const due = classFees.filter(f => !f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
            const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
            return (
              <button key={cls.id} onClick={() => { setFeeClassSelected(cls); setView("fee_class"); }}
                className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm text-left hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{cls.name}</p>
                  <p className="text-xs text-slate-400">{classStudents.length} students</p>
                </div>
                <div className="flex gap-3 text-xs mb-2">
                  <span className="text-slate-500">Expected: <strong>₹{expected.toLocaleString()}</strong></span>
                  <span className="text-green-600">Paid: <strong>₹{collected.toLocaleString()}</strong></span>
                  <span className="text-red-500">Due: <strong>₹{due.toLocaleString()}</strong></span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>{pct}% collected</span>
                  <span className="text-blue-500">Tap to manage →</span>
                </p>
              </button>
            );
          })}
          {sortedClasses.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Koi class nahi mili</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4 py-5">
        {view === "dashboard" && onBack ? (
          <button onClick={onBack} className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm font-medium mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Student Dashboard
          </button>
        ) : view !== "dashboard" ? (
          <button onClick={() => {
            if (view === "subjects" || view === "students" || view === "attendance" || view === "marks" || view === "report_card") setView("classes");
            else if (view === "content") { setView("subjects"); }
            else setView("dashboard");
          }} className="flex items-center gap-1 text-blue-300 text-sm mb-2 hover:text-white">
            <ChevronLeft className="w-4 h-4" /> {view === "store" ? "Dashboard" : "Back"}
          </button>
        ) : null}
        <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">School Admin</p>
        <h1 className="text-xl font-bold text-white">{school?.name || "Loading..."}</h1>
        {activeSession && <p className="text-slate-300 text-sm mt-0.5">Session: {activeSession.name}</p>}
      </div>

      {view === "dashboard" ? (
        <div className="p-4 max-w-2xl mx-auto">

          {/* ── SCHOOL INFO CARD ─────────────────────────────── */}
          {school && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm mb-4 overflow-hidden border border-slate-100 dark:border-slate-700">
              {/* Card header — always visible, tap to expand */}
              <button
                onClick={() => { setSchoolCardExpanded(p => !p); setEditingSchoolInfo(false); }}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate">{school.name}</p>
                  {activeSession && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2.5 py-0.5 rounded-full font-medium">
                      📅 Session: {activeSession.name}
                    </span>
                  )}
                </div>
                {schoolCardExpanded
                  ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
              </button>

              {/* Expanded details */}
              {schoolCardExpanded && !editingSchoolInfo && (
                <div className="border-t dark:border-slate-700 px-4 pb-4 pt-3 space-y-3">
                  {[
                    { icon: <User className="w-4 h-4 text-blue-500" />, label: "Principal", value: school.principalName },
                    { icon: <User className="w-4 h-4 text-purple-500" />, label: "Director", value: school.directorName },
                    { icon: <Phone className="w-4 h-4 text-green-500" />, label: "Mobile", value: school.mobile || school.phone },
                    { icon: <MapPin className="w-4 h-4 text-orange-500" />, label: "Address", value: school.address },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">{row.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400">{row.label}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                          {row.value || <span className="text-slate-300 dark:text-slate-500 font-normal italic">Not added</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={openEditSchoolInfo}
                    className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit School Info
                  </button>
                </div>
              )}

              {/* Edit form */}
              {schoolCardExpanded && editingSchoolInfo && (
                <div className="border-t dark:border-slate-700 px-4 pb-4 pt-3 space-y-3">
                  {[
                    ["principalName", "Principal Name", "text"],
                    ["directorName",  "Director / Manager Name", "text"],
                    ["mobile",        "Mobile Number", "tel"],
                    ["address",       "School Address", "text"],
                    ["tagline",       "School Tagline (card par dikhega)", "text"],
                    ["bannerColor",   "Banner Color (e.g. #3b82f6)", "text"],
                  ].map(([k, lbl, t]) => (
                    <div key={k}>
                      <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                      <input
                        type={t}
                        value={(schoolInfoForm as any)[k]}
                        onChange={e => setSchoolInfoForm(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                        placeholder={lbl}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveSchoolInfo}
                      disabled={savingSchoolInfo}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingSchoolInfo ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingSchoolInfo(false)}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LOCK CODE CARD ─────────────────────────────────────── */}
          {school && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm mb-4 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-slate-800 dark:text-white">School Lock Code</h3>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${lockCodeActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {lockCodeActive ? '🔒 Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Jab active hoga, students ko school join karne ke liye yeh code enter karna padega. Sirf aap aur super admin ko pata rahega.</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockCodeActive}
                  onChange={e => setLockCodeActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Lock Code Enable Karo</span>
              </label>

              <div className="relative">
                <label className="text-xs text-slate-500 mb-1 block">Lock Code</label>
                <input
                  type={showLockCode ? "text" : "password"}
                  placeholder="Apna secret code likhiye"
                  value={lockCodeInput}
                  onChange={e => setLockCodeInput(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLockCode(!showLockCode)}
                  className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
                >
                  {showLockCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={saveLockCode}
                disabled={savingLockCode}
                className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${lockCodeSaved ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} disabled:opacity-60`}
              >
                {savingLockCode ? 'Saving...' : lockCodeSaved ? '✓ Saved!' : 'Lock Code Save Karo'}
              </button>
            </div>
          )}

          {/* ── SUB-ADMIN MANAGEMENT ──────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm mb-4 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-slate-800 dark:text-white">Sub-Admin Manage Karo</h3>
            </div>
            <p className="text-xs text-slate-400">
              Apne school ke kisi trusted member ko sub-admin banao — woh bhi content, classes, students manage kar sakta hai.
            </p>

            {/* Existing sub-admins list */}
            {subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').length > 0 && (
              <div className="space-y-2">
                {subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').map(p => (
                  <div key={p.uid} className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-200 flex-shrink-0">
                      {(p.name || p.email).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveSubAdmin(p.uid)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Remove sub-admin"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Assign new sub-admin */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sub-Admin ka Email (IIC app wala)</label>
              <input
                type="email"
                placeholder="subadmin@example.com"
                value={subAdminEmail}
                onChange={e => { setSubAdminEmail(e.target.value); setSubAdminResult(null); }}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
              />
            </div>
            {subAdminResult && (
              <div className={`text-xs px-3 py-2 rounded-lg font-medium ${subAdminResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {subAdminResult.msg}
              </div>
            )}
            <button
              onClick={handleAssignSubAdmin}
              disabled={assigningSubAdmin || !subAdminEmail.trim()}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {assigningSubAdmin ? 'Searching...' : '👥 Sub-Admin Banao'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">Total Students</p>
              <p className="text-2xl font-bold text-blue-500">{students.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">Total Teachers</p>
              <p className="text-2xl font-bold text-green-500">{teachers.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">Classes</p>
              <p className="text-2xl font-bold text-purple-500">{classes.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">Sessions</p>
              <p className="text-2xl font-bold text-orange-500">{sessions.length}</p>
            </div>
          </div>

          {/* ── Plan timer card ─────────────────────────────── */}
          {school && (() => {
            const expIso = school.subscription.expiresAt || school.subscription.paidUntil;
            const daysLeft = expIso
              ? Math.ceil((new Date(expIso).getTime() - Date.now()) / 86400000)
              : null;
            const isExpired = daysLeft !== null && daysLeft <= 0;
            const warnSoon  = daysLeft !== null && !isExpired && daysLeft <= 7;
            const warnMid   = daysLeft !== null && !isExpired && daysLeft <= 30;
            const planLabel = subTier === "full" ? "Pro Plan" : subTier === "lite" ? "Lite Plan" : "School Plan";
            const tierColor = subTier === "full"
              ? { bg: "from-amber-500 to-orange-500", light: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
              : subTier === "lite"
              ? { bg: "from-blue-500 to-indigo-600", light: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
              : { bg: "from-slate-400 to-slate-500", light: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", badge: "bg-slate-100 text-slate-500" };
            const timerColor = isExpired || !subscriptionActive
              ? "text-red-600 dark:text-red-400"
              : warnSoon ? "text-red-500"
              : warnMid  ? "text-amber-600 dark:text-amber-400"
              : "text-green-600 dark:text-green-400";

            return (
              <div className={`rounded-2xl border p-4 mb-4 shadow-sm ${isExpired || !subscriptionActive ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : tierColor.light}`}>
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tierColor.bg} flex items-center justify-center shrink-0 shadow`}>
                    {subTier === "full" ? <Crown className="w-6 h-6 text-white" /> : subTier === "lite" ? <Shield className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-white" />}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-base text-slate-800 dark:text-white">{planLabel}</span>
                      {subscriptionActive && !isExpired
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">✅ Active</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{isExpired ? "❌ Expired" : "❌ Inactive"}</span>
                      }
                    </div>
                    {daysLeft !== null && (
                      <p className={`text-sm font-black mt-0.5 ${timerColor}`}>
                        {isExpired
                          ? `${Math.abs(daysLeft)} din pehle expire hua`
                          : warnSoon
                          ? `⚠️ Sirf ${daysLeft} din baaki!`
                          : `${daysLeft} din baaki`
                        }
                      </p>
                    )}
                    {expIso && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isExpired ? "Expired" : "Valid till"}: {new Date(expIso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  {/* View plan button */}
                  <button onClick={() => setView("subscription")} className={`shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-xl ${tierColor.badge} flex items-center gap-1`}>
                    <Crown className="w-3 h-3" /> Plan
                  </button>
                </div>

                {/* Day progress bar */}
                {daysLeft !== null && !isExpired && subscriptionActive && school.subscription.assignedAt && (() => {
                  const totalDays = Math.ceil((new Date(expIso!).getTime() - new Date(school.subscription.assignedAt!).getTime()) / 86400000);
                  const pct = totalDays > 0 ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100))) : 0;
                  return (
                    <div className="mt-3">
                      <div className="h-1.5 bg-white/60 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${warnSoon ? "bg-red-500" : warnMid ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{pct}% time remaining</p>
                    </div>
                  );
                })()}

                {/* Feature chips (Pro only) */}
                {subscriptionActive && subTier === "full" && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {school.subscription.reading && <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-700/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-bold">📖 Reading</span>}
                    {school.subscription.writing && <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-700/60 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-bold">✏️ Writing</span>}
                    {school.subscription.pdf     && <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-700/60 text-orange-700 dark:text-orange-300 rounded-full text-[10px] font-bold">📄 PDF</span>}
                    {school.subscription.mcq     && <span className="px-2 py-0.5 bg-white/60 dark:bg-slate-700/60 text-green-700 dark:text-green-300 rounded-full text-[10px] font-bold">❓ MCQ</span>}
                  </div>
                )}
                {/* Lite info */}
                {subscriptionActive && subTier === "lite" && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Student data management active. Content ke liye Pro Plan lo.</p>
                )}
                {/* Expired info */}
                {(!subscriptionActive || isExpired) && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">Plan expire ho gaya — data entry aur content editing band hai. Super Admin se renew karao.</p>
                )}
              </div>
            );
          })()}

          {/* Menu */}
          <div className="space-y-2">
            {menuItems.map(item => (
              <button key={item.view} onClick={() => setView(item.view as AdminView)}
                className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow text-left">
                {item.icon}
                <span className="flex-1 font-medium text-slate-800 dark:text-white">{item.label}</span>
                {item.count !== null && <span className="text-sm text-slate-400">{item.count}</span>}
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">{view.replace("_", " ")}</p>
          </div>
          {renderListView()}
        </div>
      )}

      {/* ── 48-HOUR EXPIRY WARNING POPUP ─────────────────────────── */}
      {showExpiryPopup && school && (() => {
        const expIso = school.subscription?.expiresAt || school.subscription?.paidUntil;
        const msLeft = expIso ? new Date(expIso).getTime() - Date.now() : 0;
        const hoursLeft = Math.ceil(msLeft / 3600000);
        const daysLeft  = Math.ceil(msLeft / 86400000);
        return (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4 pb-8" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${expiryPopupExpired ? 'bg-red-600' : 'bg-amber-500'}`}>
              {/* Top accent strip */}
              <div className="px-5 pt-6 pb-4 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-3xl">
                    {expiryPopupExpired ? '❌' : '⚠️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black leading-tight">
                      {expiryPopupExpired
                        ? 'Subscription Expire Ho Gaya!'
                        : hoursLeft <= 24
                        ? `Sirf ${hoursLeft} Ghante Baaki!`
                        : `Sirf ${daysLeft} Din Baaki!`}
                    </h2>
                    <p className="text-sm text-white/80 mt-1 leading-snug">
                      {expiryPopupExpired
                        ? 'Aapka school plan khatam ho gaya hai. Sabhi features band ho gaye hain. Super Admin se turant renew karao.'
                        : 'Aapka subscription jald hi khatam hone wala hai. Expire hone ke baad sab features band ho jayenge. Super Admin se abhi renew karao.'}
                    </p>
                  </div>
                </div>

                {expIso && (
                  <div className="mt-4 bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                        {expiryPopupExpired ? 'Expire Hua' : 'Expire Hoga'}
                      </p>
                      <p className="text-sm font-black">
                        {new Date(expIso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Plan</p>
                      <p className="text-sm font-black">
                        {school.subscription.tier === 'full' ? '⭐ Pro' : school.subscription.tier === 'lite' ? '📦 Lite' : '🏫 School'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="bg-white dark:bg-slate-900 px-5 py-4 flex flex-col gap-2.5">
                <button
                  onClick={() => { setShowExpiryPopup(false); setView("subscription"); }}
                  className={`w-full py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg ${expiryPopupExpired ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                >
                  <Crown className="w-4 h-4" />
                  {expiryPopupExpired ? 'Plan Renew Karo' : 'Plan Dekho / Renew Karo'}
                </button>
                <button
                  onClick={() => setShowExpiryPopup(false)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Baad Mein
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
