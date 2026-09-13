// @ts-nocheck
import React, { useState, useEffect } from "react";
import { getCoachingUserProfile } from "../../coaching-firebase";
import type { CoachingUserProfile } from "../../coaching-types";
import { CoachingSuperAdminPanel } from "./CoachingSuperAdminPanel";
import { CoachingAdminPanel } from "./CoachingAdminPanel";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  uid: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
  onBack?: () => void;
}

export const CoachingEcosystem: React.FC<Props> = ({
  uid,
  email,
  displayName,
  isSuperAdmin,
  onBack,
}) => {
  const [profile, setProfile] = useState<CoachingUserProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (isSuperAdmin) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const p = await getCoachingUserProfile(uid);
      setProfile(p);
    } catch (e: any) {
      setError(e?.message || "Profile load nahi ho saka");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [uid, isSuperAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Coaching profile load ho raha hai...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-600 font-bold">{error}</p>
          <button onClick={onBack} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-bold text-sm">Back</button>
        </div>
      </div>
    );
  }

  // Super Admin
  if (isSuperAdmin) {
    return <CoachingSuperAdminPanel adminUid={uid} onBack={onBack} />;
  }

  // Coaching Admin or Sub-Admin
  if (profile?.role === "COACHING_ADMIN" || profile?.role === "COACHING_SUB_ADMIN") {
    return (
      <CoachingAdminPanel
        coachingId={profile.coachingId}
        adminUid={uid}
        adminName={displayName}
        role={profile.role}
        onBack={onBack}
      />
    );
  }

  // Not a coaching user
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 p-6">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🏫</div>
        <h2 className="text-xl font-black text-slate-800">Coaching Access Nahi Mila</h2>
        <p className="text-sm text-slate-500">
          Aapko kisi coaching ka admin nahi banaya gaya hai.<br />
          Super admin se contact karo.
        </p>
        <button
          onClick={onBack}
          className="w-full py-3 bg-violet-600 text-white font-bold rounded-2xl"
        >
          Wapas Jao
        </button>
      </div>
    </div>
  );
};
