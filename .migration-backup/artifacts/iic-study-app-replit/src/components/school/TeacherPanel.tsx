// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  subscribeToClasses, subscribeToSubjects, subscribeToStudents,
  subscribeToLessons, getSchool, getSessions
} from "../../school-firebase";
import type { School, SchoolClass, SchoolSubject, SchoolLesson, SchoolStudent, SchoolSession } from "../../school-types";
import { AttendanceManager } from "./AttendanceManager";
import { MarksManager } from "./MarksManager";
import { SmartClass } from "./SmartClass";
import { ContentManager } from "./ContentManager";
import {
  BookOpen, Users, ClipboardList, LayoutDashboard,
  ChevronRight, ChevronLeft, Edit3, FileText, HelpCircle, Play
} from "lucide-react";

interface Props {
  schoolId: string;
  teacherId: string;
  teacherName: string;
}

export const TeacherPanel: React.FC<Props> = ({ schoolId, teacherId, teacherName }) => {
  const [school, setSchool] = useState<School | null>(null);
  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [activeSession, setActiveSession] = useState<SchoolSession | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [lessons, setLessons] = useState<SchoolLesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<SchoolLesson | null>(null);
  const [smartMode, setSmartMode] = useState<"reading" | "writing" | "pdf" | "mcq">("reading");
  const [view, setView] = useState<"dashboard" | "classes" | "subjects" | "lessons" | "attendance" | "marks" | "smart_class" | "content_manage">("dashboard");

  useEffect(() => {
    getSchool(schoolId).then(s => {
      setSchool(s);
    });
    getSessions(schoolId).then(sess => {
      setSessions(sess);
      const active = sess.find(s => s.active) || sess[0] || null;
      setActiveSession(active);
    });
  }, [schoolId]);

  useEffect(() => {
    if (!activeSession) return;
    const unsub = subscribeToClasses(schoolId, activeSession.id, setClasses);
    return unsub;
  }, [activeSession]);

  useEffect(() => {
    if (!selectedClass) return;
    const unsub = subscribeToSubjects(schoolId, selectedClass.id, setSubjects);
    return unsub;
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedSubject) return;
    const unsub = subscribeToLessons(schoolId, selectedSubject.id, setLessons);
    return unsub;
  }, [selectedSubject]);

  if (view === "smart_class" && selectedLesson) {
    return (
      <SmartClass
        lesson={selectedLesson}
        initialMode={smartMode}
        schoolId={schoolId}
        teacherId={teacherId}
        onBack={() => setView("lessons")}
      />
    );
  }

  if (view === "attendance" && selectedClass) {
    return (
      <AttendanceManager
        schoolId={schoolId}
        classId={selectedClass.id}
        className={selectedClass.name}
        teacherId={teacherId}
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
        teacherId={teacherId}
        subjectId={selectedSubject?.id}
        subjectName={selectedSubject?.name}
        onBack={() => setView("classes")}
      />
    );
  }

  if (view === "content_manage" && selectedClass && selectedSubject) {
    return (
      <ContentManager
        schoolId={schoolId}
        sessionId={activeSession?.id || ""}
        classId={selectedClass.id}
        subjectId={selectedSubject.id}
        subjectName={selectedSubject.name}
        className={selectedClass.name}
        authorId={teacherId}
        subscription={school?.subscription || { reading: true, writing: true, pdf: true, mcq: true }}
        onBack={() => setView("subjects")}
        onOpenLesson={(lesson, mode) => { setSelectedLesson(lesson); setSmartMode(mode); setView("smart_class"); }}
      />
    );
  }

  const goBack = () => {
    if (view === "lessons") setView("subjects");
    else if (view === "subjects") setView("classes");
    else setView("dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-teal-900 px-4 py-5">
        {view !== "dashboard" && (
          <button onClick={goBack} className="flex items-center gap-1 text-green-300 text-sm mb-2 hover:text-white">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <p className="text-green-300 text-xs font-medium uppercase tracking-wider mb-1">Teacher</p>
        <h1 className="text-xl font-bold text-white">{teacherName}</h1>
        {activeSession && <p className="text-slate-300 text-sm mt-0.5">{school?.name} • {activeSession.name}</p>}
      </div>

      {view === "dashboard" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">My Classes</p>
              <p className="text-2xl font-bold text-green-500">{classes.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">Subjects</p>
              <p className="text-2xl font-bold text-blue-500">{subjects.length}</p>
            </div>
          </div>

          {[
            { label: "My Classes", desc: "Manage lessons & students", icon: <BookOpen className="w-5 h-5 text-blue-500" />, action: () => setView("classes") },
            { label: "Smart Class", desc: "Start a classroom session", icon: <Play className="w-5 h-5 text-green-500" />, action: () => setView("classes") },
            { label: "Mark Attendance", desc: "Daily student attendance", icon: <ClipboardList className="w-5 h-5 text-orange-500" />, action: () => setView("classes") },
            { label: "Marks Entry", desc: "Enter exam marks", icon: <Edit3 className="w-5 h-5 text-purple-500" />, action: () => setView("classes") },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className="w-full bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow text-left">
              {item.icon}
              <div className="flex-1">
                <p className="font-medium text-slate-800 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      )}

      {view === "classes" && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <p className="text-sm text-slate-500 font-medium">Select a class:</p>
          {[...classes].sort((a, b) => {
            const na = parseInt(a.name.replace(/\D+/g, '')) || 0;
            const nb = parseInt(b.name.replace(/\D+/g, '')) || 0;
            return na !== nb ? na - nb : a.name.localeCompare(b.name);
          }).map(cls => (
            <div key={cls.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="font-bold text-slate-800 dark:text-white mb-2">{cls.name}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setSelectedClass(cls); setView("subjects"); }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-lg text-xs font-medium">
                  📚 Lessons
                </button>
                <button onClick={() => { setSelectedClass(cls); setView("attendance"); }}
                  className="px-3 py-1.5 bg-green-50 text-green-600 dark:bg-green-900/30 rounded-lg text-xs font-medium">
                  📋 Attendance
                </button>
                <button onClick={() => { setSelectedClass(cls); setView("marks"); }}
                  className="px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 rounded-lg text-xs font-medium">
                  ✏️ Marks
                </button>
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No classes assigned yet</p>
            </div>
          )}
        </div>
      )}

      {view === "subjects" && selectedClass && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <p className="text-sm text-slate-500 font-medium">Subjects in <strong className="text-slate-700 dark:text-slate-200">{selectedClass.name}</strong>:</p>
          {subjects.map(sub => (
            <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <p className="font-bold text-slate-800 dark:text-white mb-2">{sub.name}</p>
              <div className="flex gap-2">
                <button onClick={() => { setSelectedSubject(sub); setView("lessons"); }}
                  className="flex-1 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-lg text-xs font-medium">
                  📖 View Lessons
                </button>
                <button onClick={() => { setSelectedSubject(sub); setView("content_manage"); }}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium">
                  ✏️ Manage
                </button>
              </div>
            </div>
          ))}
          {subjects.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No subjects added yet</p>
            </div>
          )}
        </div>
      )}

      {view === "lessons" && selectedSubject && (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          <p className="text-sm text-slate-500 font-medium">Lessons — <strong className="text-slate-700 dark:text-slate-200">{selectedSubject.name}</strong></p>
          {lessons.map(lesson => (
            <div key={lesson.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-600">{lesson.order}</span>
                </div>
                <p className="flex-1 font-bold text-slate-800 dark:text-white">{lesson.title}</p>
              </div>

              <p className="text-xs text-slate-400 mb-2">Open as:</p>
              <div className="grid grid-cols-2 gap-2">
                {lesson.features.readingEnabled && (
                  <button onClick={() => { setSelectedLesson(lesson); setSmartMode("reading"); setView("smart_class"); }}
                    className="py-2 bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Reading Mode
                  </button>
                )}
                {lesson.features.writingEnabled && (
                  <button onClick={() => { setSelectedLesson(lesson); setSmartMode("writing"); setView("smart_class"); }}
                    className="py-2 bg-purple-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" /> Writing Mode
                  </button>
                )}
                {lesson.features.pdfEnabled && (
                  <button onClick={() => { setSelectedLesson(lesson); setSmartMode("pdf"); setView("smart_class"); }}
                    className="py-2 bg-orange-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                )}
                {lesson.features.mcqEnabled && (
                  <button onClick={() => { setSelectedLesson(lesson); setSmartMode("mcq"); setView("smart_class"); }}
                    className="py-2 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> MCQ
                  </button>
                )}
              </div>
            </div>
          ))}
          {lessons.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No lessons added for this subject yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
