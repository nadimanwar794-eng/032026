// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getSchoolUserProfile } from "../../school-firebase";
import type { SchoolUserProfile } from "../../school-types";
import { SuperAdminPanel } from "./SuperAdminPanel";
import { SchoolAdminPanel } from "./SchoolAdminPanel";
import { TeacherPanel } from "./TeacherPanel";
import { StudentSchoolPanel } from "./StudentSchoolPanel";
import { SchoolJoinScreen } from "./SchoolJoinScreen";
import { School, Loader2, AlertCircle } from "lucide-react";

interface Props {
  uid: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean; // true if uid matches global super admin
  onBack?: () => void;
  onOpenPlatformContent?: () => void;
}

export const SchoolEcosystem: React.FC<Props> = ({ uid, email, displayName, isSuperAdmin, onBack, onOpenPlatformContent }) => {
  const [profile, setProfile] = useState<SchoolUserProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchProfile = () => {
    if (isSuperAdmin) { setLoading(false); return; }
    setLoading(true);
    getSchoolUserProfile(uid).then(p => {
      setProfile(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchProfile();
  }, [uid, isSuperAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-slate-500">Loading school profile...</p>
        </div>
      </div>
    );
  }

  // Super Admin
  if (isSuperAdmin) {
    return <SuperAdminPanel adminUid={uid} onBack={onBack} />;
  }

  // No profile found — let the user pick & join a school
  if (!profile) {
    return (
      <SchoolJoinScreen
        uid={uid}
        displayName={displayName}
        email={email}
        onJoined={fetchProfile}
        onBack={onBack}
      />
    );
  }

  // School Admin or Sub-Admin (same panel, same access)
  if (profile.role === "SCHOOL_ADMIN" || profile.role === "SCHOOL_SUB_ADMIN") {
    return <SchoolAdminPanel schoolId={profile.schoolId} adminUid={uid} onBack={onBack} />;
  }

  // Teacher
  if (profile.role === "TEACHER") {
    return (
      <TeacherPanel
        schoolId={profile.schoolId}
        teacherId={uid}
        teacherName={profile.name || displayName}
      />
    );
  }

  // Student
  if (profile.role === "SCHOOL_STUDENT") {
    return (
      <StudentSchoolPanel
        schoolId={profile.schoolId}
        studentId={uid}
        studentName={profile.name || displayName}
        classId={profile.classId || ""}
        sessionId={profile.sessionId || ""}
        onOpenPlatformContent={onOpenPlatformContent}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <p className="text-slate-500">Unknown role: {profile.role}</p>
    </div>
  );
};
