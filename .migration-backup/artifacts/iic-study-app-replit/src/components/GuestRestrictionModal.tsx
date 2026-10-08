import React, { useState } from 'react';
import { Shield, Sparkles, X, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';
import { auth, saveUserToLive, getUserData } from '../firebase';
import { User } from '../types';

export interface GuestRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdated: (updatedUser: User) => void;
  featureName?: string;
  customMessage?: string;
}

export const bindGuestWithGoogle = async (currentUser: User): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let googleUser: any = null;
  const currentAuthUser = auth.currentUser;

  if (currentAuthUser && currentAuthUser.isAnonymous) {
    try {
      const linkResult = await linkWithPopup(currentAuthUser, provider);
      googleUser = linkResult.user;
    } catch (err: any) {
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        // The Google account is already registered; sign in directly and merge
        const signInResult = await signInWithPopup(auth, provider);
        googleUser = signInResult.user;
      } else {
        throw err;
      }
    }
  } else {
    // If not anonymous or auth user not present, sign in with popup
    const signInResult = await signInWithPopup(auth, provider);
    googleUser = signInResult.user;
  }

  const existingProfile = await getUserData(googleUser.uid).catch(() => null);

  const updatedUser: User = {
    ...(existingProfile || {}),
    id: googleUser.uid,
    uid: googleUser.uid,
    displayId: existingProfile?.displayId || currentUser.displayId || `NST-${googleUser.uid.slice(0, 6).toUpperCase()}`,
    name: googleUser.displayName || existingProfile?.name || (currentUser.name !== 'Guest Student' ? currentUser.name : 'Student'),
    email: googleUser.email || existingProfile?.email || currentUser.email || '',
    profilePhoto: googleUser.photoURL || existingProfile?.profilePhoto || currentUser.profilePhoto,
    isGuest: false,
    isAnonymous: false,
    provider: 'google',
    board: existingProfile?.board || currentUser.board || 'CBSE',
    classLevel: existingProfile?.classLevel || currentUser.classLevel || '10',
    credits: Math.max(existingProfile?.credits ?? 0, currentUser.credits ?? 50),
    streak: Math.max(existingProfile?.streak ?? 1, currentUser.streak ?? 1),
    totalScore: Math.max(existingProfile?.totalScore ?? 0, currentUser.totalScore ?? 0),
    studyMode: existingProfile?.studyMode || currentUser.studyMode || 'WITHOUT_CREDIT',
    profileCompleted: true,
    lastLoginDate: new Date().toISOString().split('T')[0],
  };

  await saveUserToLive(updatedUser, { immediate: true });
  localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
  localStorage.setItem('nst_last_user_id', googleUser.uid);
  localStorage.removeItem('nst_is_guest');

  return updatedUser;
};

export const GuestRestrictionModal: React.FC<GuestRestrictionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  featureName,
  customMessage,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleBind = async () => {
    setLoading(true);
    setError(null);
    try {
      const boundUser = await bindGuestWithGoogle(currentUser);
      setSuccess(true);
      setTimeout(() => {
        onUserUpdated(boundUser);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('[GuestRestrictionModal] Google binding failed:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup band kar diya gaya. Dobara try karein.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup browser ne block kar diya. Please popups allow karein.');
      } else {
        setError(err.message || 'Google account bind karne me samasya aayi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-7 flex flex-col items-center text-center relative z-10">
          {/* Shield Badge */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-amber-500/10 border border-amber-500/40 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
            <Shield size={32} className="text-amber-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles size={12} />
            <span>Guest Account Limitation</span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white leading-tight mb-2">
            {customMessage ? (
              <span>Guest Account Limitation</span>
            ) : (
              <span>Guest Account me Subscription aur Paid features available nahi hain.</span>
            )}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
            {customMessage || "Apne account ko Google se bind karein taaki aapka progress, streak aur payment safe rahein."}
          </p>

          {/* Perks list */}
          <div className="w-full bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 mb-5 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Aapka Streak, XP aur Coins hamesha cloud me save rahenge</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>VIP / PRO Membership aur Paid locked notes unlock honge</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Community me questions poochna, post likhna aur likes dena allow hoga</span>
            </div>
          </div>

          {error && (
            <div className="w-full mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertTriangle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="w-full py-3.5 px-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>Google Account Bind Ho Gaya! 🎉</span>
            </div>
          ) : (
            <div className="w-full space-y-2.5">
              {/* Google Bind Button */}
              <button
                type="button"
                onClick={handleBind}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-black text-sm rounded-2xl shadow-xl shadow-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-slate-900" />
                    <span>Connecting with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Google se Bind Karein (1-Click)</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Abhi Nahi (Continue as Guest)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
