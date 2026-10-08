// @ts-nocheck
import React, { useState, useEffect } from 'react';
import type { User, SystemSettings } from '../types';
import { ADMIN_EMAIL } from '../constants';
import { saveUserToLive, auth, getUserByEmail, getUserByMobileOrId, getUserData, getFreshUserData, getUserByLinkedGoogleUid } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, signInAnonymously, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { Lock, User as UserIcon, Phone, Mail, ShieldCheck, KeyRound, Copy, Check, XCircle, HelpCircle, Eye, EyeOff, ShieldQuestion, Loader2, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { LoginGuide } from './LoginGuide';
import { CustomAlert } from './CustomDialogs';
import { PedroAuthGuide } from './PedroAuthGuide';

interface Props {
  onLogin: (user: User) => void;
  logActivity?: (action: string, details: string, user?: User) => void;
  appSettings?: SystemSettings;
}

type AuthView = 'LOGIN' | 'SIGNUP' | 'RECOVERY' | 'SUCCESS_ID';

const BLOCKED_DOMAINS = [
  'tempmail.com', 'throwawaymail.com', 'mailinator.com', 'yopmail.com', 
  '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'getairmail.com'
];

const DEFAULT_QUESTIONS = [
  "Aapka favorite subject kaunsa hai?",
  "Aapka favorite sport ya game kya hai?",
  "Aapka favorite teacher kaun hai?",
  "Aapka birth city / gaon kaunsa hai?"
];

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 8000, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getAuthErrorMessage = (error: any, fallback: string) => {
  switch (error?.code) {
    case 'auth/unauthorized-domain':
      return 'Is app domain ko Firebase Auth me authorize nahi kiya gaya. Firebase Console ke Authorized domains me current app domain add karein.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup browser ne block kiya. Redirect sign-in try karein.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window band kar di gayi.';
    case 'auth/network-request-failed':
      return 'Network problem hai. Internet check karke dobara try karein.';
    case 'auth/too-many-requests':
      return 'Bahut attempts ho gaye. Thodi der baad dobara try karein.';
    case 'auth/user-disabled':
      return 'Yeh account disabled hai. Admin se contact karein.';
    case 'auth/invalid-email':
      return 'Email address sahi format me enter karein.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email ya password galat hai.';
    default:
      return error?.message || fallback;
  }
};

// Start persistence setup while the auth screen is rendering instead of
// making the user wait for it after pressing Login or Create Account.
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[Auth] Could not enable persistent auth session:', error);
});

export const Auth: React.FC<Props> = ({ onLogin, logActivity, appSettings }) => {
  const [view, setView] = useState<AuthView>('LOGIN');
  const [generatedId, setGeneratedId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    id: '',
    password: '',
    name: '',
    mobile: '',
    email: '',
    securityQuestion: DEFAULT_QUESTIONS[0],
    securityAnswer: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({ isOpen: false, message: '' });
  const [pendingLoginUser, setPendingLoginUser] = useState<User | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const [recoveryUserObj, setRecoveryUserObj] = useState<any>(null);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [userEnteredAnswer, setUserEnteredAnswer] = useState('');
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedField) {
      const timer = setTimeout(() => setHighlightedField(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightedField]);

  useEffect(() => {
    const s = localStorage.getItem('nst_system_settings');
    if (s) { try { setSettings(JSON.parse(s)); } catch {} }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const generateUserId = () => {
    const prefix = (appSettings?.appShortName || settings?.appShortName || 'NSTA')?.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'NSTA';
    const randomPart = String(Math.floor(100000 + Math.random() * 900000));
    return `${prefix}-${randomPart}`;
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    const domain = email.split('@')[1].toLowerCase();
    return !BLOCKED_DOMAINS.includes(domain);
  };

  const triggerLoginSuccess = (user: User) => {
    const validId = user.id || user.uid;
    const isGuest = Boolean(user.isGuest || user.isAnonymous);
    let displayId = user.displayId;
    if (!isGuest && (!displayId || displayId.startsWith('IIC-') || /^\d{8,12}$/.test(displayId))) {
      const digits = displayId ? displayId.replace(/\D/g, '').slice(-6).padStart(6, '0') : String(Math.floor(100000 + Math.random() * 900000));
      displayId = `NSTA-${digits}`;
    }
    const safeUser = {
      ...user,
      id: validId,
      uid: validId,
      displayId: isGuest ? '' : displayId,
      profileCompleted: true
    };
    onLogin(safeUser);
  };

  const completeGoogleRedirectLogin = async (firebaseUser: any) => {
    const userEmail = (firebaseUser.email || '').trim().toLowerCase();
    const userDisplayName = firebaseUser.displayName || 'Student';
    const userPhoto = firebaseUser.photoURL || '';
    const uid = firebaseUser.uid;

    let appUser: any = await withTimeout(getFreshUserData(uid), 8000, null);
    if (!appUser && userEmail) appUser = await withTimeout(getUserByEmail(userEmail), 8000, null);
    if (!appUser) appUser = await withTimeout(getUserByLinkedGoogleUid(uid), 8000, null);

    const newUser: User = appUser ? {
      ...appUser,
      id: uid,
      uid,
      displayId: appUser.displayId || generateUserId(),
      email: appUser.email || userEmail,
      name: appUser.name || userDisplayName,
      provider: 'google',
      photoURL: userPhoto || appUser.photoURL,
      profileCompleted: true,
      securityQuestion: appUser.securityQuestion || DEFAULT_QUESTIONS[0],
      securityAnswer: appUser.securityAnswer || 'google',
      credits: typeof appUser.credits === 'number' ? appUser.credits : 50,
    } : {
      id: uid,
      uid,
      displayId: generateUserId(),
      name: userDisplayName,
      email: userEmail,
      password: '',
      mobile: '',
      role: 'STUDENT',
      createdAt: new Date().toISOString(),
      credits: (settings && typeof settings.signupBonus === 'number') ? settings.signupBonus : (appSettings?.signupBonus || 50),
      streak: 1,
      totalScore: 0,
      lastLoginDate: new Date().toISOString(),
      board: 'CBSE',
      classLevel: '10',
      provider: 'google',
      photoURL: userPhoto,
      avatarChoice: userPhoto ? 'gmail' : 'app',
      profileCompleted: true,
      securityQuestion: DEFAULT_QUESTIONS[0],
      securityAnswer: 'google',
      progress: {},
      subscriptionTier: 'FREE',
      isPremium: false,
      studyMode: 'CREDIT',
    };

    // Auth should succeed even when a Firestore/RTDB mirror is temporarily unavailable.
    void saveUserToLive(newUser, { immediate: true });
    localStorage.setItem('nst_current_user', JSON.stringify(newUser));
    localStorage.setItem('nst_last_user_id', uid);
    if (!appUser) {
      try {
        localStorage.removeItem('nsta_first_assembly_seen');
        sessionStorage.removeItem('nsta_home_assembly_seen');
      } catch {}
    }
    if (logActivity) logActivity(appUser ? "LOGIN" : "SIGNUP_GOOGLE", appUser ? "Logged In via Google Auth" : "New Student via Google", newUser);
    triggerLoginSuccess(newUser);
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user) return;
        setLoading(true);
        await completeGoogleRedirectLogin(result.user);
      })
      .catch((err) => {
        if (active && err?.code !== 'auth/no-auth-event') {
          setError(getAuthErrorMessage(err, 'Google Login fail hua.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Run persistence in background without blocking synchronous user click gesture:
      void setPersistence(auth, browserLocalPersistence).catch(() => {});

      // In-App Popup: Keeps user inside the application without navigating away
      const result = await signInWithPopup(auth, provider);
      await completeGoogleRedirectLogin(result.user);
    } catch (err: any) {
      console.warn('[Auth] Google in-app sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the account selector popup voluntarily
        setError(null);
      } else if (err.code === 'auth/popup-blocked') {
        setError('Google popup window block ho gayi. Kripya browser setting me popups allow karein ya button par dobara tap karein.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setError(getAuthErrorMessage(err, 'Google Login fail hua.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    setError(null);
    try {
      // Clean guest initialization: fresh unique ID, strictly Day 1 streak
      const uid = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const guestDisplayId = '';
      const nowIso = new Date().toISOString();
      const todayStr = new Date().toDateString();

      // Suppress any false streak popups on guest creation day (starts at Day 1)
      try {
        localStorage.setItem('nst_streak_popup_date', todayStr);
      } catch (_) {}

      const guestUser: User = {
        id: uid,
        uid: uid,
        displayId: guestDisplayId,
        name: 'Guest Student',
        email: '',
        mobile: '',
        role: 'STUDENT',
        isGuest: true,
        isAnonymous: true,
        board: 'CBSE',
        classLevel: '10',
        credits: 50,
        streak: 1,
        longestStreak: 1,
        totalScore: 0,
        createdAt: nowIso,
        lastLoginDate: nowIso,
        redeemedCodes: [],
        studyMode: 'CREDIT',
        profileCompleted: true,
      };

      // Instantly save to local storage
      localStorage.setItem('nst_current_user', JSON.stringify(guestUser));
      localStorage.setItem('nst_last_user_id', uid);
      localStorage.setItem('nst_is_guest', 'true');

      // 1-Second Direct Entrance: Immediately trigger success without waiting for network!
      if (logActivity) logActivity("LOGIN", "Entered as Guest", guestUser);
      triggerLoginSuccess(guestUser);

      // In background, ensure Firebase anonymous session is active for storage access, but do NOT register guest in users collection
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((err) => {
          console.warn('[Auth] Background signInAnonymously notice:', err);
        });
      }
    } catch (err: any) {
      console.error('[Auth] Guest login failed:', err);
      setError('Guest mode shuru nahi ho saka: ' + (err.message || 'Error'));
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = formData.id.trim();
    const pass = formData.password.trim();

    if (!input || !pass) {
      setError("Email/Mobile aur Password dono bharein.");
      return;
    }

    setLoading(true);
    try {
      await authPersistenceReady;

      if (input.includes('@')) {
        try {
          const res = await signInWithEmailAndPassword(auth, input.toLowerCase(), pass);
          const uid = res.user.uid;
           let appUser: any = await withTimeout(getFreshUserData(uid), 8000, null);
           if (!appUser) appUser = await withTimeout(getUserByEmail(input.toLowerCase()), 8000, null);

          const completeUser: User = {
            ...(appUser || {}),
            id: uid,
            uid: uid,
            displayId: appUser?.displayId || `NST-${uid.slice(0, 6).toUpperCase()}`,
            email: appUser?.email || input.toLowerCase(),
            name: appUser?.name || res.user.displayName || "Student",
            mobile: appUser?.mobile || "",
            role: appUser?.role || "STUDENT",
            isGuest: false,
            isAnonymous: false,
            provider: 'email',
            securityQuestion: appUser?.securityQuestion || DEFAULT_QUESTIONS[0],
            securityAnswer: appUser?.securityAnswer || "",
            board: appUser?.board || "CBSE",
            classLevel: appUser?.classLevel || "10",
            credits: appUser?.credits ?? 50,
            streak: appUser?.streak ?? 1,
            totalScore: appUser?.totalScore ?? 0,
            profileCompleted: true
          };

          void saveUserToLive(completeUser, { immediate: true });
          localStorage.setItem('nst_current_user', JSON.stringify(completeUser));
          localStorage.setItem('nst_last_user_id', uid);
          localStorage.removeItem('nst_is_guest');

          if (logActivity) logActivity("LOGIN", "Logged In via Email", completeUser);
          triggerLoginSuccess(completeUser);
          return;
         } catch (e: any) {
           setError(getAuthErrorMessage(e, 'Email Login fail hua.'));
           setLoading(false);
           return;
        }
      }

      try {
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch {}

      let targetUser: any = await getUserByMobileOrId(input);
      if (!targetUser && input.includes('@')) targetUser = await getUserByEmail(input.toLowerCase());

      if (targetUser) {
        if (targetUser.isArchived) {
          setError("Yeh account deleted/blocked hai.");
          setLoading(false);
          return;
        }

        // Try Firebase Auth with targetUser.email if present, OR check stored password
        let authSuccess = false;
        if (targetUser.email) {
          try {
            await signInWithEmailAndPassword(auth, targetUser.email, pass);
            authSuccess = true;
          } catch (_) {}
        }

        const passwordMatch = authSuccess || (targetUser.password && (targetUser.password === pass || pass === settings?.adminCode || pass === appSettings?.adminCode));

        if (passwordMatch) {
          // Restore the real Firebase account before reading user_data. This
          // is required for secure Firestore rules on a fresh device; the
          // anonymous session is only a lookup fallback for mobile/UID login.
          if (targetUser.email && !auth.currentUser?.email) {
            await signInWithEmailAndPassword(auth, targetUser.email, pass).catch(() => {});
          }
          let freshProfile = await getFreshUserData(targetUser.id);
          const raw = freshProfile || targetUser;
          const uid = raw.id || raw.uid;

          const finalUser: User = {
            ...raw,
            id: uid,
            uid: uid,
            displayId: raw.displayId || targetUser.displayId || `NST-${uid.slice(0, 6).toUpperCase()}`,
            email: raw.email || "",
            mobile: raw.mobile || "",
            isGuest: false,
            isAnonymous: false,
            provider: raw.provider || 'email',
            securityQuestion: raw.securityQuestion || DEFAULT_QUESTIONS[0],
            securityAnswer: raw.securityAnswer || "",
            profileCompleted: true
          };

           if (!await saveUserToLive(finalUser, { immediate: true })) throw new Error('Account could not be saved to the backend.');
           localStorage.setItem('nst_current_user', JSON.stringify(finalUser));
           localStorage.setItem('nst_last_user_id', uid);
           localStorage.removeItem('nst_is_guest');

          if (logActivity) logActivity("LOGIN", "Logged In via Student ID", finalUser);
          triggerLoginSuccess(finalUser);

          if (finalUser.email && !auth.currentUser?.email) signInWithEmailAndPassword(auth, finalUser.email, pass).catch(() => {});
          return;
        }

        if (targetUser.provider === 'google' || targetUser.provider === 'gmail') {
          setError("Yeh account Google se bana hai. 'Google Sign-in' button use karein.");
          setLoading(false);
          return;
        }

        setError("Galat Password! Sahi password enter karein.");
        setLoading(false);
        return;
      }

      setError("Account nahi mila. Details check karein.");
    } catch (err: any) {
      setError(err.message || "Login fail hua.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanMobile = formData.mobile.trim();
    const cleanPassword = formData.password.trim();
    const cleanAnswer = formData.securityAnswer.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !cleanPassword || !cleanAnswer) {
      setError("Sabhi fields aur Security Answer bharna zaroori hai.");
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError("Valid email address enter karein.");
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    try {
      await authPersistenceReady;
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const uid = res.user.uid;
      const newId = generateUserId();
      const signupCoins = (settings && typeof settings.signupBonus === 'number') ? settings.signupBonus : (appSettings?.signupBonus || 50);

      const newStudentUser: User = {
        id: uid,
        uid: uid,
        displayId: newId,
        name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        password: cleanPassword,
        securityQuestion: formData.securityQuestion,
        securityAnswer: cleanAnswer,
        role: 'STUDENT',
        isGuest: false,
        isAnonymous: false,
        createdAt: new Date().toISOString(),
        credits: signupCoins,
        streak: 1,
        totalScore: 0,
        lastLoginDate: new Date().toISOString(),
        board: 'CBSE',
        classLevel: '10',
        provider: 'email',
        profileCompleted: true,
        progress: {},
        redeemedCodes: [],
        studyMode: 'CREDIT',
        subscriptionTier: 'FREE',
        isPremium: false,
        inbox: [
          {
            id: `welcome-bonus-${Date.now()}`,
            text: `🎉 Welcome to NSTA! Aapko ${signupCoins} Welcome Credits mil gaye hain.`,
            date: new Date().toISOString(),
            read: false,
            type: 'GIFT',
            gift: { type: 'CREDITS', value: signupCoins },
            isClaimed: true
          }
        ]
      };

      void saveUserToLive(newStudentUser, { immediate: true });
      localStorage.setItem('nst_current_user', JSON.stringify(newStudentUser));
      localStorage.setItem('nst_last_user_id', uid);
      localStorage.removeItem('nst_is_guest');
      try {
        localStorage.removeItem('nsta_first_assembly_seen');
        sessionStorage.removeItem('nsta_home_assembly_seen');
      } catch {}
      if (logActivity) logActivity("SIGNUP_EMAIL", "New Student Registered", newStudentUser);

      setGeneratedId(newId);
      setPendingLoginUser(newStudentUser);
      setView('SUCCESS_ID');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Yeh email pehle se registered hai. Login karein.");
      } else {
        setError(err.message || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindRecoveryAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const identifier = formData.id.trim().toLowerCase();

    if (!identifier) {
      setError("Mobile, Email ya Student ID (NSTA-XXXXXX) enter karein.");
      return;
    }

    setLoading(true);
    try {
      if (!auth.currentUser) await signInAnonymously(auth).catch(() => {});

      let targetUser: any = null;
      if (identifier.includes('@')) targetUser = await getUserByEmail(identifier);
      if (!targetUser) targetUser = await getUserByMobileOrId(identifier);

      if (targetUser) {
        if (targetUser.isArchived) {
          setError("Yeh account deleted hai.");
          setLoading(false);
          return;
        }

        const uid = targetUser.id || targetUser.uid;
        const freshData = await getUserData(uid);
        const mergedRecoveryUser = {
          ...targetUser,
          ...(freshData || {}),
          id: uid,
          uid: uid,
          email: targetUser.email || freshData?.email || (identifier.includes('@') ? identifier : ""),
          mobile: targetUser.mobile || freshData?.mobile || (!identifier.includes('@') ? identifier : "")
        };

        setRecoveryUserObj(mergedRecoveryUser);
        setRecoveryStep(2);
      } else {
        setError("Is detail se koi account nahi mila.");
      }
    } catch {
      setError("Account search karte waqt samasya aayi.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const entered = userEnteredAnswer.trim().toLowerCase();
    const originalAnswer = (recoveryUserObj?.securityAnswer || '').trim().toLowerCase();

    if (!entered) {
      setError("Apna security answer enter karein.");
      return;
    }

    if (originalAnswer && entered === originalAnswer) {
      setLoading(true);
      try {
        const validId = recoveryUserObj.id || recoveryUserObj.uid;
        let freshProfile = await getFreshUserData(validId);
        const raw = freshProfile || recoveryUserObj;

        const completeUser: User = {
          ...raw,
          id: validId,
          uid: validId,
          displayId: raw.displayId || recoveryUserObj.displayId || validId.slice(0, 8)?.toUpperCase(),
          name: raw.name || recoveryUserObj.name || "Student",
          email: raw.email || recoveryUserObj.email || "",
          mobile: raw.mobile || recoveryUserObj.mobile || "",
          securityQuestion: raw.securityQuestion || recoveryUserObj.securityQuestion || DEFAULT_QUESTIONS[0],
          securityAnswer: originalAnswer,
          role: raw.role || "STUDENT",
          board: raw.board || "CBSE",
          classLevel: raw.classLevel || "10",
          credits: typeof raw.credits === 'number' ? raw.credits : 50,
          streak: raw.streak ?? 1,
          totalScore: raw.totalScore ?? 0,
          profileCompleted: true,
          provider: raw.provider || 'recovery'
        };

        if (!await saveUserToLive(completeUser, { immediate: true })) throw new Error('Account could not be saved to the backend.');
        localStorage.setItem('nst_current_user', JSON.stringify(completeUser));
        localStorage.setItem('nst_last_user_id', validId);

        if (logActivity) logActivity("INSTANT_SECURITY_LOGIN", "Login via Security Answer", completeUser);
        setLoading(false);
        triggerLoginSuccess(completeUser);
      } catch {
        setLoading(false);
        setError("Recovery session restore fail hua.");
      }
    } else {
      setError("Galat Answer! Sahi answer likhein.");
    }
  };

  const GoogleBrandIcon = () => (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );

  if (view === 'SUCCESS_ID') {
    return (
      <div className="h-full max-h-[100dvh] w-full flex flex-col items-center justify-between bg-gradient-to-b from-slate-50 via-white to-blue-50/20 px-3 sm:px-4 pt-2 pb-0 select-none relative overflow-hidden overscroll-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

        <header className="w-full max-w-md mx-auto flex items-center justify-between px-2 pt-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center shadow-lg shadow-indigo-950/20 p-1 border border-indigo-500/30 ring-2 ring-indigo-500/10">
              {settings?.appLogo ? (
                <img src={settings.appLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
              ) : (
                <span className="text-xs font-black text-amber-400">{settings?.appShortName || 'NSTA'}</span>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">{settings?.appName || 'NSTA'}</h1>
          </div>
        </header>

        <div className="w-full max-w-md p-6 sm:p-7 rounded-3xl bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200/90 text-center my-auto">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md border border-emerald-100">
            <ShieldCheck size={30} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">Account Created!</h2>
          <p className="text-xs text-slate-500 mb-4">Aapka unique student login ID:</p>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xl sm:text-2xl font-mono font-black text-emerald-600 mb-5 flex items-center justify-center gap-3 shadow-inner">
            <span>{generatedId}</span>
            <button type="button" onClick={handleCopyId} className="text-slate-400 hover:text-slate-700 p-1.5 transition-colors cursor-pointer" title="Copy ID">
              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (pendingLoginUser) triggerLoginSuccess(pendingLoginUser);
              else setView('LOGIN');
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            Start Learning
          </button>
        </div>
        <div className="h-1 shrink-0" />
      </div>
    );
  }

  const isFlipped = view === 'SIGNUP';

  return (
    <div className="h-full max-h-[100dvh] w-full flex flex-col justify-between items-center bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100/80 text-slate-800 px-3 sm:px-4 pt-1 sm:pt-2 pb-0 select-none font-sans overflow-hidden relative overscroll-none">
      {/* Premium Ambient Luminous Orbs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-slate-400/10 blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-indigo-500/8 blur-[90px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-slate-300/10 blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.035] pointer-events-none" />

      <CustomAlert 
        isOpen={alertConfig.isOpen} 
        message={alertConfig.message} 
        onClose={() => {
          setAlertConfig({ ...alertConfig, isOpen: false });
          if (pendingLoginUser) onLogin(pendingLoginUser);
        }} 
      />

      {showGuide && <LoginGuide onClose={() => setShowGuide(false)} />}

      {/* TOP HEADER */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between px-2 pt-0.5 pb-1 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center shadow-lg shadow-indigo-950/20 p-1 border border-indigo-500/30 ring-2 ring-indigo-500/10">
            {settings?.appLogo ? (
              <img src={settings.appLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            ) : (
              <span className="text-xs font-black text-amber-400">{settings?.appShortName || 'NSTA'}</span>
            )}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">{settings?.appName || 'NSTA'}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">Student Portal</span>
            </div>
          </div>
        </div>

        {/* ── PEDRO IN TOP RIGHT (Replaced the ? Button completely) ── */}
        <div className="flex items-center">
          <PedroAuthGuide
            mode={view === 'SUCCESS_ID' ? 'LOGIN' : view}
            onSwitchMode={(newMode) => {
              setView(newMode);
              setError(null);
            }}
            highlightedField={highlightedField}
            onSelectFieldHighlight={setHighlightedField}
            isPasswordFocused={isPasswordFocused}
            showPassword={showPassword}
            trackingLength={formData.password.length}
            onOpenHelpGuide={() => setShowGuide(true)}
          />
        </div>
      </header>

      {/* ── 3D FLIP CONTAINER WRAPPER ── */}
      <div className="flex-1 w-full flex items-center justify-center px-1 sm:px-2 py-1 min-h-0 overflow-y-auto sm:overflow-hidden no-scrollbar overscroll-contain z-10">
        <div className="w-full max-w-[405px] my-auto" style={{ perspective: '1000px' }}>
        {view === 'RECOVERY' ? (
          <div className="w-full rounded-3xl bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.04)] border border-slate-200/90 p-5 sm:p-6 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-[2.5px] bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-85" />
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 shadow-sm border border-rose-100">
              <KeyRound size={22} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-0.5 text-center">
              Instant Recovery
            </h2>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-3.5 text-center">
              {recoveryStep === 1 ? 'Apna account search karein' : 'Sahi answer se instant login'}
            </p>

            {error && (
              <div className="w-full mb-3 px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                <XCircle size={15} className="shrink-0 text-rose-500" />
                <span className="truncate">{error}</span>
              </div>
            )}

            {recoveryStep === 1 && (
              <form onSubmit={handleFindRecoveryAccount} className="w-full space-y-3">
                <div 
                  id="field-recovery_id"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'recovery_id' ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                  }`}
                >
                  {highlightedField === 'recovery_id' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 Mobile, Email ya ID yahan daalein</span>
                    </div>
                  )}
                  <UserIcon size={16} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="id"
                    type="text"
                    required
                    placeholder="Mobile / Email / Student ID"
                    value={formData.id}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'recovery_id') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all shadow-2xs font-medium"
                  />
                </div>

                <div 
                  id="field-find_btn"
                  className={`relative rounded-xl transition-all duration-300 ${
                    highlightedField === 'find_btn' ? 'ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                  }`}
                >
                  {highlightedField === 'find_btn' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 Find Account par click karein</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider text-white bg-slate-900 hover:bg-black shadow-md shadow-slate-900/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer border border-slate-800"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <span>FIND ACCOUNT</span>}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {recoveryStep === 2 && (
              <div className="w-full space-y-3.5">
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-left">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">SECURITY QUESTION:</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                    {recoveryUserObj?.securityQuestion || "Aapka favorite subject kaunsa hai?"}
                  </p>
                </div>

                <form onSubmit={handleVerifyAnswerSubmit} className="space-y-3">
                  <div 
                    id="field-recovery_answer"
                    className={`relative flex items-center rounded-xl transition-all duration-300 ${
                      highlightedField === 'recovery_answer' ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                    }`}
                  >
                    {highlightedField === 'recovery_answer' && (
                      <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                        <span>👉 Secret Answer yahan daalein</span>
                      </div>
                    )}
                    <ShieldQuestion size={16} className="absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Enter Security Answer"
                      value={userEnteredAnswer}
                      onChange={(e) => { setUserEnteredAnswer(e.target.value); setError(null); }}
                      onFocus={() => {
                        if (highlightedField === 'recovery_answer') setHighlightedField(null);
                      }}
                      className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all shadow-2xs font-medium"
                    />
                  </div>

                  <div 
                    id="field-verify_btn"
                    className={`relative rounded-xl transition-all duration-300 ${
                      highlightedField === 'verify_btn' ? 'ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                    }`}
                  >
                    {highlightedField === 'verify_btn' && (
                      <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                        <span>👉 Verify & Login dabayein</span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider text-white bg-slate-900 hover:bg-black shadow-md shadow-slate-900/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer border border-slate-800"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <span>VERIFY &amp; LOGIN</span>}
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-4 text-center">
              Wapas login screen par jaane ke liye:{' '}
              <button
                type="button"
                onClick={() => { setView('LOGIN'); setError(null); }}
                className="font-black text-slate-900 hover:underline cursor-pointer"
              >
                Login karein
              </button>
            </p>
          </div>
        ) : (
          <div
            className="w-full relative transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* ── FRONT: LOGIN ── */}
            <div
              className="w-full rounded-3xl bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200/90 p-5 sm:p-6 flex flex-col items-center relative overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            >
              {/* Premium Top Shimmer Line */}
              <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-slate-800/40 to-transparent" />

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider mb-2 shadow-xs border border-slate-800">
                <Sparkles size={11} className="text-amber-400" />
                <span>Student Login</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 text-center">Login</h2>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-3.5 text-center">Sign in to access your classes &amp; notes</p>

              {error && (
                <div className="w-full mb-3 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <XCircle size={15} className="shrink-0 text-rose-500" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="w-full space-y-2.5 sm:space-y-3">
                <div 
                  id="field-id"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'id' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'id' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 1. Mobile, Email ya ID yahan daalein</span>
                    </div>
                  )}
                  <UserIcon size={16} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="id"
                    type="text"
                    required
                    placeholder="Mobile, Email ya Student ID"
                    value={formData.id}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'id') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                    autoCapitalize="none"
                  />
                </div>

                {/* Password input with Focus reaction */}
                <div 
                  id="field-password"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'password' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'password' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 2. Password yahan likhein</span>
                    </div>
                  )}
                  <Lock size={16} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => {
                      setIsPasswordFocused(true);
                      if (highlightedField === 'password') setHighlightedField(null);
                    }}
                    onBlur={() => setIsPasswordFocused(false)}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword((prev) => !prev);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1.5 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 px-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-8 h-4.5 sm:w-9 sm:h-5 rounded-full p-0.5 transition-colors flex items-center ${rememberMe ? 'bg-slate-900 justify-end shadow-xs' : 'bg-slate-200 justify-start'}`}
                    >
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white shadow-sm" />
                    </button>
                    <span className="text-slate-700 font-semibold text-[11px] sm:text-xs">Remember me</span>
                  </label>

                  <div className="relative">
                    {highlightedField === 'recovery' && (
                      <div className="absolute -top-4 right-0 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider shadow-md animate-bounce whitespace-nowrap z-30 pointer-events-none">
                        <span>👉 Instant Recovery yahan hai</span>
                      </div>
                    )}
                    <button 
                      id="field-recovery"
                      type="button" 
                      onClick={() => { setView('RECOVERY'); setRecoveryStep(1); setError(null); }}
                      className={`text-rose-700 font-bold transition-all flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1 rounded-full cursor-pointer border ${
                        highlightedField === 'recovery' ? 'ring-4 ring-rose-400 bg-rose-100/90 border-rose-300 shadow-md scale-105 font-black' : 'bg-rose-50/80 border-rose-200/70 hover:bg-rose-100 hover:border-rose-300 shadow-2xs'
                      }`}
                    >
                      <KeyRound size={12} className="text-rose-600" />
                      <span>Instant Recovery</span>
                    </button>
                  </div>
                </div>

                <div 
                  id="field-login_btn"
                  className={`relative rounded-xl transition-all duration-300 mt-1 ${
                    highlightedField === 'login_btn' ? 'ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                  }`}
                >
                  {highlightedField === 'login_btn' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 3. SIGN IN button yahan dabayein</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 hover:from-black hover:to-slate-900 shadow-md shadow-slate-900/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer border border-slate-800"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <span>SIGN IN</span>}
                  </button>
                </div>
              </form>

              <div className="w-full flex items-center my-2 sm:my-2.5">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* 2. Google Sign-in (1-Click) */}
              <div id="field-google_btn" className="relative w-full">
                <button 
                  type="button" 
                  onClick={handleGoogleAuth} 
                  disabled={loading}
                  className={`w-full py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50/90 hover:border-slate-300 shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer ${
                    highlightedField === 'google_btn' ? 'ring-4 ring-emerald-500 bg-emerald-50/70 shadow-[0_0_25px_rgba(16,185,129,0.55)] scale-[1.02] border-emerald-400' : ''
                  }`}
                >
                  <GoogleBrandIcon />
                  <span>Sign in with Google</span>
                </button>
                {highlightedField === 'google_btn' && (
                  <div className="absolute -top-3.5 right-2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                    <span>👉 1-Click Google Sign-In</span>
                  </div>
                )}
              </div>

              {/* 3. Naye user ke liye [ Create Account ] */}
              <div 
                id="field-signup"
                className={`text-[11px] sm:text-xs text-slate-500 mt-2 sm:mt-2.5 text-center rounded-xl transition-all duration-300 relative w-full ${
                  highlightedField === 'signup' ? 'ring-4 ring-blue-400 bg-blue-50/70 p-2 scale-105 shadow-md' : ''
                }`}
              >
                {highlightedField === 'signup' && (
                  <div className="absolute -top-3.5 right-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                    <span>👉 Naya account banane ke liye yahan dabayein</span>
                  </div>
                )}
                Naye student hain?{' '}
                <button
                  type="button"
                  onClick={() => { setView('SIGNUP'); setError(null); }}
                  className="font-black text-indigo-600 hover:text-indigo-800 hover:underline ml-0.5 cursor-pointer px-1 py-0.5"
                >
                  Create Account (खाता बनाएं)
                </button>
              </div>

              {/* Separator before Guest */}
              <div className="w-full flex items-center my-2.5">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-[11px] font-semibold text-slate-400">or</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* 4. Professional & Clean "Continue as Guest" Button (matching Google sign-in style) */}
              <div className="w-full">
                <button 
                  type="button" 
                  onClick={handleContinueAsGuest} 
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50/90 hover:border-slate-300 shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer"
                >
                  <UserIcon size={16} className="text-slate-500 shrink-0" />
                  <span>Continue as Guest</span>
                </button>
              </div>

              {/* Trust Badge at bottom of card */}
              <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100/90 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
                <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                <span>256-bit Encrypted • Official Student Portal</span>
              </div>
            </div>

            {/* ── BACK: SIGN UP / CREATE ACCOUNT (180 DEGREE FLIPPED) ── */}
            <div
              className="w-full rounded-3xl bg-white/95 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12),0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200/90 p-5 sm:p-6 flex flex-col items-center absolute inset-0 overflow-y-auto no-scrollbar"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              {/* Premium Top Shimmer Line */}
              <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-slate-800/40 to-transparent" />

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-0.5 text-center">Sign Up</h2>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-3 text-center">Create account &amp; get 50 bonus credits</p>

              {error && (
                <div className="w-full mb-2.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <XCircle size={14} className="shrink-0 text-rose-500" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <form onSubmit={handleSignUpSubmit} className="w-full space-y-2">
                <div 
                  id="field-signup_name"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_name' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_name' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 1. Pura Naam yahan likhein</span>
                    </div>
                  )}
                  <UserIcon size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_name') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                </div>

                <div 
                  id="field-signup_mobile"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_mobile' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_mobile' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 2. 10-Digit Mobile number yahan daalein</span>
                    </div>
                  )}
                  <Phone size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="mobile"
                    type="tel"
                    placeholder="Mobile Number"
                    value={formData.mobile}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_mobile') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                </div>

                <div 
                  id="field-signup_email"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_email' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_email' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 3. Email ID yahan enter karein</span>
                    </div>
                  )}
                  <Mail size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_email') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                </div>

                <div 
                  id="field-signup_password"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_password' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_password' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 4. Secret Password yahan banayein</span>
                    </div>
                  )}
                  <Lock size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="Password (Min 6 chars)"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_password') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                </div>

                <div 
                  id="field-signup_question"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_question' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_question' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 5. Security Question select karein</span>
                    </div>
                  )}
                  <ShieldQuestion size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <select
                    name="securityQuestion"
                    value={formData.securityQuestion}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_question') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm text-slate-900 font-medium outline-none transition-all shadow-2xs appearance-none cursor-pointer"
                  >
                    {DEFAULT_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                </div>
                
                <div 
                  id="field-signup_answer"
                  className={`relative flex items-center rounded-xl transition-all duration-300 ${
                    highlightedField === 'signup_answer' 
                      ? 'ring-4 ring-amber-400 bg-amber-50/70 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' 
                      : ''
                  }`}
                >
                  {highlightedField === 'signup_answer' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 6. Secret Answer yahan likhein</span>
                    </div>
                  )}
                  <KeyRound size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="securityAnswer"
                    type="text"
                    required
                    placeholder="Secret Answer (Recovery ke liye)"
                    value={formData.securityAnswer}
                    onChange={handleChange}
                    onFocus={() => {
                      if (highlightedField === 'signup_answer') setHighlightedField(null);
                    }}
                    className="w-full bg-white hover:bg-slate-50/70 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium outline-none transition-all shadow-2xs"
                  />
                </div>

                <div 
                  id="field-signup_btn"
                  className={`relative rounded-xl transition-all duration-300 mt-1 ${
                    highlightedField === 'signup_btn' ? 'ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.55)] scale-[1.02]' : ''
                  }`}
                >
                  {highlightedField === 'signup_btn' && (
                    <div className="absolute -top-3.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 z-30 pointer-events-none">
                      <span>👉 7. CREATE ACCOUNT dabayein &amp; 50 credits paayein</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black tracking-wider text-white bg-slate-900 hover:bg-black shadow-md shadow-slate-900/15 active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer border border-slate-800"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <span>CREATE ACCOUNT</span>}
                  </button>
                </div>
              </form>

              <p className="text-xs text-slate-500 mt-2.5 pb-1 text-center">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setView('LOGIN'); setError(null); }}
                  className="font-black text-slate-900 hover:underline ml-0.5 cursor-pointer px-1 py-0.5"
                >
                  Login
                </button>
              </p>

              {/* Guest option on Sign-up too */}
              <div className="w-full mt-3 pt-2.5 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={handleContinueAsGuest} 
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs active:scale-[0.99]"
                >
                  <UserIcon size={15} className="text-slate-500 shrink-0" />
                  <span>Continue as Guest</span>
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="h-1 shrink-0" />
    </div>
  );
};

export default Auth;
