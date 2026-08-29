// IIC×NSTA Smart School Ecosystem — Core Types

export type SchoolRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'SCHOOL_SUB_ADMIN' | 'TEACHER' | 'SCHOOL_STUDENT';

export type SubscriptionFeature = 'reading' | 'writing' | 'pdf' | 'mcq';

export type PlanDuration = 'weekly' | 'monthly' | '3months' | 'yearly';

export interface SchoolSubscription {
  reading: boolean;
  writing: boolean;
  pdf: boolean;
  mcq: boolean;
  expiresAt?: string; // ISO date — plan hard expiry (set on assign)
  monthlyAmount: number;
  paidUntil?: string; // ISO date — subscription paid up to this date
  lastPaidDate?: string; // ISO date — when last payment was received
  lastPaidAmount?: number; // amount received in last payment
  paymentNotes?: string; // admin notes on payment
  status: 'active' | 'inactive' | 'suspended';
  tier?: 'lite' | 'full'; // lite = student data only, full = content + student data
  planDuration?: PlanDuration; // duration of last assigned plan
  assignedAt?: string; // ISO date — when plan was last assigned by super admin
}

export interface School {
  id: string;
  name: string;
  code: string; // short code e.g. "DPS_DEL"
  address?: string;
  phone?: string;
  email: string;
  adminEmail: string;
  logoUrl?: string;
  principalName?: string;
  directorName?: string;
  mobile?: string;
  tagline?: string; // Short tagline shown on school card
  bannerColor?: string; // Hex color for card banner
  subscription: SchoolSubscription;
  active: boolean;
  createdAt: string;
  createdBy: string; // super admin uid
  totalStudents?: number;
  totalTeachers?: number;
  // Lock code — only SUPER_ADMIN and SCHOOL_ADMIN know this
  lockCode?: string;
  lockCodeActive?: boolean;
  // School-level lock — set by super admin, blocks all students from logging in
  locked?: boolean;
}

export interface SchoolSession {
  id: string;
  schoolId: string;
  name: string; // e.g. "2026-27"
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  sessionId: string;
  name: string; // e.g. "Class 10-A"
  section?: string;
  classTeacherId?: string;
  createdAt: string;
}

export interface SchoolSubject {
  id: string;
  schoolId: string;
  sessionId: string;
  classId: string;
  name: string; // e.g. "Mathematics"
  teacherId?: string;
  createdAt: string;
}

export interface LessonMCQ {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface SchoolLesson {
  id: string;
  schoolId: string;
  sessionId: string;
  classId: string;
  subjectId: string;
  title: string;
  order: number;
  readingContent?: string; // HTML/rich text for reading mode
  writingContent?: string; // Board-style content
  pdfUrl?: string;
  mcqs?: LessonMCQ[];
  impNotes?: string; // Important points
  features: {
    readingEnabled: boolean;
    writingEnabled: boolean;
    pdfEnabled: boolean;
    mcqEnabled: boolean;
  };
  createdAt: string;
  createdBy: string;
}

export interface SchoolTeacher {
  id: string; // Firebase Auth UID
  schoolId: string;
  name: string;
  email: string;
  phone?: string;
  subjects: string[]; // subject IDs
  classes: string[]; // class IDs
  employeeId?: string;
  joinDate: string;
  active: boolean;
  createdAt: string;
}

export interface SchoolStudent {
  id: string; // Firebase Auth UID
  schoolId: string;
  sessionId: string;
  classId: string;
  name: string;
  email?: string;
  phone?: string;
  rollNo: string;
  admissionNo?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  address?: string;
  monthlyFee: number;
  joinDate: string;
  active: boolean;
  createdAt: string;
  photoUrl?: string; // base64 or Google Drive URL of student photo
  iicUid?: string; // linked IIC account UID
}

// ATTENDANCE
export interface AttendanceRecord {
  date: string; // "YYYY-MM-DD"
  schoolId: string;
  classId: string;
  sessionId: string;
  markedBy: string; // teacher UID
  students: {
    [studentId: string]: {
      present: boolean;
      name: string;
      rollNo: string;
      note?: string;
    };
  };
  createdAt: string;
}

// MARKS
export interface ExamEntry {
  id: string;
  schoolId: string;
  sessionId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  examName: string; // e.g. "Unit Test 1", "Half Yearly"
  examDate: string;
  maxMarks: number;
  markedBy: string;
  studentMarks: {
    [studentId: string]: {
      marks: number;
      absent?: boolean;
      studentName: string;
      rollNo: string;
    };
  };
  createdAt: string;
}

// FEE
export interface MonthlyFee {
  schoolId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  classId: string;
  month: string; // "YYYY-MM"
  amount: number;
  paid: boolean;
  paidDate?: string;
  paidBy?: string; // admin UID
  receiptNo?: string;
  note?: string;
}

// HOMEWORK
export interface SchoolHomework {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  dueDate: string;
  assignedBy: string; // teacher UID
  createdAt: string;
}

// LESSON COMPLETION (per teacher class session)
export interface LessonCompletion {
  id: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  lessonTitle: string;
  teacherId: string;
  completedAt: string;
  note?: string;
}

// MCQ RESULT (school context)
export interface SchoolMCQResult {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
  subjectId: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
}

// ANALYTICS
export interface SchoolAnalytics {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  averageAttendance: number; // percentage
  feePending: number; // amount
  feeCollected: number;
}

// SUPER ADMIN DASHBOARD
export interface SuperAdminStats {
  totalSchools: number;
  activeSchools: number;
  inactiveSchools: number;
  totalStudents: number;
  totalTeachers: number;
  monthlyRevenue: number;
  pendingRevenue: number;
}

// School User Profile (stored in users/{uid} for school roles)
export interface SchoolUserProfile {
  uid: string;
  schoolId: string;
  role: SchoolRole;
  name: string;
  email: string;
  // For teachers
  teacherRef?: string;
  // For students
  studentRef?: string;
  classId?: string;
  sessionId?: string;
}
