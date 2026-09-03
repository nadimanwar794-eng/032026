// IIC×NSTA Smart School Ecosystem — Firebase CRUD Helpers
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = sanitizeForFirestore(v);
  }
  return out;
};
import type {
  School, SchoolSession, SchoolClass, SchoolSubject, SchoolLesson,
  SchoolTeacher, SchoolStudent, AttendanceRecord, ExamEntry, MonthlyFee,
  SchoolHomework, SchoolMCQResult, SchoolUserProfile
} from "./school-types";

const col = (path: string) => collection(db, path);
const d = (path: string) => doc(db, path);

// ── SCHOOLS ──────────────────────────────────────────────────────────────────

export const saveSchool = async (school: School) => {
  await setDoc(d(`schools/${school.id}`), sanitizeForFirestore(school));
};

export const getSchool = async (schoolId: string): Promise<School | null> => {
  const snap = await getDoc(d(`schools/${schoolId}`));
  return snap.exists() ? (snap.data() as School) : null;
};

export const getAllSchools = async (): Promise<School[]> => {
  const snap = await getDocs(col("schools"));
  return snap.docs.map(d => d.data() as School);
};

export const subscribeToSchool = (schoolId: string, cb: (s: School | null) => void) =>
  onSnapshot(d(`schools/${schoolId}`), snap => cb(snap.exists() ? snap.data() as School : null));

export const subscribeToAllSchools = (cb: (schools: School[]) => void) =>
  onSnapshot(col("schools"), snap => cb(snap.docs.map(d => d.data() as School)));

export const updateSchool = async (schoolId: string, data: Partial<School>) => {
  await updateDoc(d(`schools/${schoolId}`), sanitizeForFirestore(data));
};

export const lockSchool = async (schoolId: string, locked: boolean) => {
  await updateDoc(d(`schools/${schoolId}`), { locked });
};

export const deleteSchool = async (schoolId: string) => {
  await deleteDoc(d(`schools/${schoolId}`));
};

// ── SESSIONS ─────────────────────────────────────────────────────────────────

export const saveSession = async (session: SchoolSession) => {
  await setDoc(d(`schools/${session.schoolId}/sessions/${session.id}`), sanitizeForFirestore(session));
};

export const getSessions = async (schoolId: string): Promise<SchoolSession[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/sessions`));
  return snap.docs.map(d => d.data() as SchoolSession);
};

export const subscribeToSessions = (schoolId: string, cb: (sessions: SchoolSession[]) => void) =>
  onSnapshot(col(`schools/${schoolId}/sessions`), snap =>
    cb(snap.docs.map(d => d.data() as SchoolSession))
  );

export const updateSession = async (schoolId: string, sessionId: string, data: Partial<SchoolSession>) => {
  await updateDoc(d(`schools/${schoolId}/sessions/${sessionId}`), sanitizeForFirestore(data));
};

export const deleteSession = async (schoolId: string, sessionId: string) => {
  await deleteDoc(d(`schools/${schoolId}/sessions/${sessionId}`));
};

// ── CLASSES ──────────────────────────────────────────────────────────────────

export const saveClass = async (cls: SchoolClass) => {
  await setDoc(d(`schools/${cls.schoolId}/classes/${cls.id}`), sanitizeForFirestore(cls));
};

export const getClasses = async (schoolId: string, sessionId?: string): Promise<SchoolClass[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/classes`));
  const all = snap.docs.map(d => d.data() as SchoolClass);
  return sessionId ? all.filter(c => c.sessionId === sessionId) : all;
};

export const subscribeToClasses = (schoolId: string, sessionId: string, cb: (classes: SchoolClass[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/classes`), where("sessionId", "==", sessionId)),
    snap => cb(snap.docs.map(d => d.data() as SchoolClass))
  );

export const updateClass = async (schoolId: string, classId: string, data: Partial<SchoolClass>) => {
  await updateDoc(d(`schools/${schoolId}/classes/${classId}`), sanitizeForFirestore(data));
};

export const deleteClass = async (schoolId: string, classId: string) => {
  await deleteDoc(d(`schools/${schoolId}/classes/${classId}`));
};

// ── SUBJECTS ─────────────────────────────────────────────────────────────────

export const saveSubject = async (subject: SchoolSubject) => {
  await setDoc(d(`schools/${subject.schoolId}/subjects/${subject.id}`), sanitizeForFirestore(subject));
};

export const getSubjects = async (schoolId: string, classId?: string): Promise<SchoolSubject[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/subjects`));
  const all = snap.docs.map(d => d.data() as SchoolSubject);
  return classId ? all.filter(s => s.classId === classId) : all;
};

export const subscribeToSubjects = (schoolId: string, classId: string, cb: (subjects: SchoolSubject[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/subjects`), where("classId", "==", classId)),
    snap => cb(snap.docs.map(d => d.data() as SchoolSubject))
  );

export const deleteSubject = async (schoolId: string, subjectId: string) => {
  await deleteDoc(d(`schools/${schoolId}/subjects/${subjectId}`));
};

// ── LESSONS ──────────────────────────────────────────────────────────────────

export const saveLesson = async (lesson: SchoolLesson) => {
  await setDoc(
    d(`schools/${lesson.schoolId}/lessons/${lesson.id}`),
    sanitizeForFirestore(lesson)
  );
};

export const getLessons = async (schoolId: string, subjectId?: string): Promise<SchoolLesson[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/lessons`));
  const all = snap.docs.map(d => d.data() as SchoolLesson);
  return subjectId ? all.filter(l => l.subjectId === subjectId) : all;
};

export const subscribeToLessons = (schoolId: string, subjectId: string, cb: (lessons: SchoolLesson[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/lessons`), where("subjectId", "==", subjectId)),
    snap => cb(snap.docs.map(d => d.data() as SchoolLesson).sort((a, b) => a.order - b.order))
  );

export const updateLesson = async (schoolId: string, lessonId: string, data: Partial<SchoolLesson>) => {
  await updateDoc(d(`schools/${schoolId}/lessons/${lessonId}`), sanitizeForFirestore(data));
};

export const deleteLesson = async (schoolId: string, lessonId: string) => {
  await deleteDoc(d(`schools/${schoolId}/lessons/${lessonId}`));
};

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export const saveTeacher = async (teacher: SchoolTeacher) => {
  await setDoc(d(`schools/${teacher.schoolId}/teachers/${teacher.id}`), sanitizeForFirestore(teacher));
};

export const getTeachers = async (schoolId: string): Promise<SchoolTeacher[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/teachers`));
  return snap.docs.map(d => d.data() as SchoolTeacher);
};

export const subscribeToTeachers = (schoolId: string, cb: (teachers: SchoolTeacher[]) => void) =>
  onSnapshot(col(`schools/${schoolId}/teachers`), snap =>
    cb(snap.docs.map(d => d.data() as SchoolTeacher))
  );

export const updateTeacher = async (schoolId: string, teacherId: string, data: Partial<SchoolTeacher>) => {
  await updateDoc(d(`schools/${schoolId}/teachers/${teacherId}`), sanitizeForFirestore(data));
};

export const deleteTeacher = async (schoolId: string, teacherId: string) => {
  await deleteDoc(d(`schools/${schoolId}/teachers/${teacherId}`));
};

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export const saveStudent = async (student: SchoolStudent) => {
  await setDoc(d(`schools/${student.schoolId}/students/${student.id}`), sanitizeForFirestore(student));
};

export const getStudents = async (schoolId: string, classId?: string): Promise<SchoolStudent[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/students`));
  const all = snap.docs.map(d => d.data() as SchoolStudent).filter(s => s.active);
  return classId ? all.filter(s => s.classId === classId) : all;
};

export const subscribeToStudents = (schoolId: string, classId: string, cb: (students: SchoolStudent[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/students`), where("classId", "==", classId), where("active", "==", true)),
    snap => cb(snap.docs.map(d => d.data() as SchoolStudent).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true })))
  );

export const subscribeToAllStudents = (schoolId: string, cb: (students: SchoolStudent[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/students`), where("active", "==", true)),
    snap => cb(snap.docs.map(d => d.data() as SchoolStudent))
  );

export const updateStudent = async (schoolId: string, studentId: string, data: Partial<SchoolStudent>) => {
  await updateDoc(d(`schools/${schoolId}/students/${studentId}`), sanitizeForFirestore(data));
};

export const deleteStudent = async (schoolId: string, studentId: string) => {
  await updateDoc(d(`schools/${schoolId}/students/${studentId}`), { active: false });
};

// ── ATTENDANCE ───────────────────────────────────────────────────────────────

export const saveAttendance = async (record: AttendanceRecord) => {
  const id = `${record.classId}_${record.date}`;
  await setDoc(
    d(`schools/${record.schoolId}/attendance/${id}`),
    sanitizeForFirestore(record)
  );
};

export const getAttendance = async (schoolId: string, classId: string, date: string): Promise<AttendanceRecord | null> => {
  const id = `${classId}_${date}`;
  const snap = await getDoc(d(`schools/${schoolId}/attendance/${id}`));
  return snap.exists() ? snap.data() as AttendanceRecord : null;
};

export const getMonthlyAttendance = async (schoolId: string, classId: string, month: string): Promise<AttendanceRecord[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/attendance`));
  return snap.docs
    .map(d => d.data() as AttendanceRecord)
    .filter(r => r.classId === classId && r.date.startsWith(month));
};

export const subscribeToAttendance = (
  schoolId: string, classId: string, date: string, cb: (r: AttendanceRecord | null) => void
) => {
  const id = `${classId}_${date}`;
  return onSnapshot(d(`schools/${schoolId}/attendance/${id}`), snap =>
    cb(snap.exists() ? snap.data() as AttendanceRecord : null)
  );
};

// ── MARKS / EXAMS ────────────────────────────────────────────────────────────

export const saveExam = async (exam: ExamEntry) => {
  await setDoc(d(`schools/${exam.schoolId}/exams/${exam.id}`), sanitizeForFirestore(exam));
};

export const getExams = async (schoolId: string, classId?: string): Promise<ExamEntry[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/exams`));
  const all = snap.docs.map(d => d.data() as ExamEntry);
  return classId ? all.filter(e => e.classId === classId) : all;
};

export const subscribeToExams = (schoolId: string, classId: string, cb: (exams: ExamEntry[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/exams`), where("classId", "==", classId)),
    snap => cb(snap.docs.map(d => d.data() as ExamEntry))
  );

export const deleteExam = async (schoolId: string, examId: string) => {
  await deleteDoc(d(`schools/${schoolId}/exams/${examId}`));
};

// ── FEE ─────────────────────────────────────────────────────────────────────

export const saveFee = async (fee: MonthlyFee) => {
  const id = `${fee.studentId}_${fee.month}`;
  await setDoc(d(`schools/${fee.schoolId}/fees/${id}`), sanitizeForFirestore(fee));
};

export const getStudentFees = async (schoolId: string, studentId: string): Promise<MonthlyFee[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/fees`));
  return snap.docs
    .map(d => d.data() as MonthlyFee)
    .filter(f => f.studentId === studentId)
    .sort((a, b) => b.month.localeCompare(a.month));
};

export const getMonthlyFees = async (schoolId: string, month: string, classId?: string): Promise<MonthlyFee[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/fees`));
  let all = snap.docs.map(d => d.data() as MonthlyFee).filter(f => f.month === month);
  if (classId) all = all.filter(f => f.classId === classId);
  return all.sort((a, b) => a.studentName.localeCompare(b.studentName));
};

export const subscribeToClassFees = (schoolId: string, month: string, classId: string, cb: (fees: MonthlyFee[]) => void) =>
  onSnapshot(
    query(col(`schools/${schoolId}/fees`), where("month", "==", month), where("classId", "==", classId)),
    snap => cb(snap.docs.map(d => d.data() as MonthlyFee))
  );

export const markFeePaid = async (schoolId: string, studentId: string, month: string, paidBy: string) => {
  const id = `${studentId}_${month}`;
  await updateDoc(d(`schools/${schoolId}/fees/${id}`), sanitizeForFirestore({
    paid: true,
    paidDate: new Date().toISOString(),
    paidBy,
    receiptNo: `RCP-${Date.now()}`
  }));
};

// ── HOMEWORK ─────────────────────────────────────────────────────────────────

export const saveHomework = async (hw: SchoolHomework) => {
  await setDoc(d(`schools/${hw.schoolId}/homework/${hw.id}`), sanitizeForFirestore(hw));
};

export const getHomework = async (schoolId: string, classId: string): Promise<SchoolHomework[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/homework`));
  return snap.docs
    .map(d => d.data() as SchoolHomework)
    .filter(h => h.classId === classId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// ── MCQ RESULTS (school) ─────────────────────────────────────────────────────

export const saveSchoolMCQResult = async (result: SchoolMCQResult) => {
  await setDoc(d(`schools/${result.schoolId}/mcq_results/${result.id}`), sanitizeForFirestore(result));
};

export const getClassMCQResults = async (schoolId: string, classId: string): Promise<SchoolMCQResult[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/mcq_results`));
  return snap.docs
    .map(d => d.data() as SchoolMCQResult)
    .filter(r => r.classId === classId)
    .sort((a, b) => b.date.localeCompare(a.date));
};

// ── SCHOOL USER PROFILE ──────────────────────────────────────────────────────

export const saveSchoolUserProfile = async (profile: SchoolUserProfile) => {
  await setDoc(d(`school_users/${profile.uid}`), sanitizeForFirestore(profile));
};

export const getSchoolUserProfile = async (uid: string): Promise<SchoolUserProfile | null> => {
  const snap = await getDoc(d(`school_users/${uid}`));
  return snap.exists() ? snap.data() as SchoolUserProfile : null;
};

export const subscribeToSchoolUserProfile = (uid: string, cb: (p: SchoolUserProfile | null) => void) =>
  onSnapshot(d(`school_users/${uid}`), snap =>
    cb(snap.exists() ? snap.data() as SchoolUserProfile : null)
  );

// ── LOCK CODE ────────────────────────────────────────────────────────────────

export const setSchoolLockCode = async (schoolId: string, lockCode: string, active: boolean) => {
  await updateDoc(d(`schools/${schoolId}`), sanitizeForFirestore({ lockCode, lockCodeActive: active }));
};

export const verifySchoolLockCode = async (schoolId: string, enteredCode: string): Promise<boolean> => {
  const snap = await getDoc(d(`schools/${schoolId}`));
  if (!snap.exists()) return false;
  const school = snap.data();
  if (!school.lockCodeActive || !school.lockCode) return true;
  return school.lockCode === enteredCode;
};

// ── ASSIGN SCHOOL ROLE BY EMAIL ───────────────────────────────────────────────
// Generic helper: looks up a user by email, creates/updates school_users/{uid}.
const assignSchoolRoleByEmail = async (
  schoolId: string,
  email: string,
  role: SchoolUserProfile['role'],
): Promise<SchoolUserProfile> => {
  const q = query(col('users'), where('email', '==', email.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error(`Koi user nahi mila email "${email}" se. Pehle woh IIC app mein register kare.`);
  }
  const userData = snap.docs[0].data();
  const uid: string = userData.id || snap.docs[0].id;
  if (!uid) throw new Error('User ka UID nahi mila. Support se contact karo.');

  const profile: SchoolUserProfile = {
    uid,
    schoolId,
    role,
    name: userData.name || userData.displayName || email,
    email: email.trim().toLowerCase(),
  };
  await setDoc(d(`school_users/${uid}`), sanitizeForFirestore(profile));
  return profile;
};

export const assignSchoolAdminByEmail = (schoolId: string, email: string) =>
  assignSchoolRoleByEmail(schoolId, email, 'SCHOOL_ADMIN');

export const assignSchoolSubAdminByEmail = (schoolId: string, email: string) =>
  assignSchoolRoleByEmail(schoolId, email, 'SCHOOL_SUB_ADMIN');

export const removeSchoolUserByUid = async (uid: string) => {
  await deleteDoc(d(`school_users/${uid}`));
};

export const getSchoolAdmins = async (schoolId: string): Promise<SchoolUserProfile[]> => {
  const q = query(col('school_users'), where('schoolId', '==', schoolId), where('role', 'in', ['SCHOOL_ADMIN', 'SCHOOL_SUB_ADMIN']));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as SchoolUserProfile);
};

// ── FEE ALL CLASSES ──────────────────────────────────────────────────────────

export const getAllMonthlyFees = async (schoolId: string, month: string): Promise<MonthlyFee[]> => {
  const snap = await getDocs(col(`schools/${schoolId}/fees`));
  return snap.docs.map(d => d.data() as MonthlyFee).filter(f => f.month === month);
};

// ── ACCOUNT LINKING ──────────────────────────────────────────────────────────
// Student fills their data → system matches against school students → links IIC UID

export const linkStudentAccount = async (
  schoolId: string,
  iicUid: string,
  iicName: string,
  rollNo: string,
  admissionNo: string,
  fatherName: string
): Promise<{ success: boolean; message: string; studentId?: string }> => {
  const snap = await getDocs(col(`schools/${schoolId}/students`));
  const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

  // Match: name must match + (roll OR admission) must match
  const match = allStudents.find(s => {
    const nameMatch = normalize(s.name) === normalize(iicName) || normalize(s.name).startsWith(normalize(iicName.split(" ")[0]));
    const rollMatch = rollNo.trim() && normalize(s.rollNo) === normalize(rollNo);
    const admMatch = admissionNo.trim() && s.admissionNo && normalize(s.admissionNo) === normalize(admissionNo);
    const fatherMatch = fatherName.trim() && s.fatherName && normalize(s.fatherName) === normalize(fatherName);
    return nameMatch && (rollMatch || admMatch || fatherMatch);
  });

  if (!match) return { success: false, message: "Aapka record nahi mila. Name, Roll Number aur Father's Name dobara check karein." };
  if (match.iicUid && match.iicUid !== iicUid) return { success: false, message: "Yeh student record pehle se kisi aur account se link hai." };
  if (match.iicUid === iicUid) return { success: true, message: "Aapka account pehle se link hai!", studentId: match.id };

  await updateDoc(d(`schools/${schoolId}/students/${match.id}`), sanitizeForFirestore({ iicUid }));

  // Also create a school_users profile
  const profile: import('./school-types').SchoolUserProfile = {
    uid: iicUid,
    schoolId,
    role: 'SCHOOL_STUDENT',
    name: match.name,
    email: match.email || '',
    studentRef: match.id,
    classId: match.classId,
    sessionId: match.sessionId,
  };
  await setDoc(d(`school_users/${iicUid}`), sanitizeForFirestore(profile));

  return { success: true, message: "Account successfully link ho gaya! Ab aap school dashboard dekh sakte hain.", studentId: match.id };
};

// ── UTILITY ──────────────────────────────────────────────────────────────────

export const generateId = () => doc(collection(db, "_")).id;

export const todayStr = () => new Date().toISOString().split("T")[0];

export const currentMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
