// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { ADMIN_EMAIL } from '../constants';
import { saveUserToLive, auth, getUserByEmail, getUserByMobileOrId, getUserData, getUserByLinkedGoogleUid } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Lock, User as UserIcon, Phone, Mail, ShieldCheck, KeyRound, Copy, Check, XCircle, HelpCircle, Eye, EyeOff, ShieldQuestion, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { LoginGuide } from './LoginGuide';
import { CustomAlert } from './CustomDialogs';

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
  "Aapke primary school ka naam kya tha?",
  "Aapka favorite teacher kaun hai?",
  "Aapka birth city / gaon kaunsa hai?"
];

// ── FULLY SYNCHRONIZED HUSKY AVATAR ──
const HuskyAvatar: React.FC<{
  trackingLength: number;
  isPasswordFocused: boolean;
  showPassword: boolean;
}> = ({ trackingLength, isPasswordFocused, showPassword }) => {
  const eyeOffset = Math.min(Math.max((trackingLength - 10) * 0.5, -6), 6);
  const isCovering = isPasswordFocused && !showPassword;

  return (
    <div className="relative w-28 h-28 mx-auto mb-1 select-none pointer-events-none flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-md">
        {/* Ears */}
        <polygon points="45,85 25,25 75,55" fill="#334155" />
        <polygon points="50,75 35,38 70,58" fill="#fda4af" />
        <polygon points="155,85 175,25 125,55" fill="#334155" />
        <polygon points="150,75 165,38 130,58" fill="#fda4af" />

        {/* Head Base */}
        <ellipse cx="100" cy="115" rx="65" ry="58" fill="#334155" />

        {/* White Face Mask */}
        <path
          d="M 60,85 C 75,90 90,80 100,100 C 110,80 125,90 140,85 C 160,110 160,150 100,165 C 40,150 40,110 60,85 Z"
          fill="#ffffff"
        />

        {/* Snout & Nose */}
        <ellipse cx="100" cy="132" rx="22" ry="16" fill="#f1f5f9" />
        <path d="M 92,124 Q 100,120 108,124 Q 100,135 92,124 Z" fill="#0f172a" />
        
        {/* Mouth */}
        <path
          d="M 94,136 Q 100,142 106,136"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* White Eye Sockets */}
        <circle cx="75" cy="102" r="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="125" cy="102" r="13" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />

        {/* ── BOTH OPEN EYES (TRACKING) ── */}
        <g
          style={{
            transform: `translate(${eyeOffset}px, 0px)`,
            opacity: isCovering ? 0 : 1,
            transition: 'opacity 0.15s ease-in-out, transform 0.1s ease-out'
          }}
        >
          <circle cx="75" cy="102" r="7.5" fill="#0284c7" />
          <circle cx="75" cy="102" r="4.5" fill="#0f172a" />
          <circle cx="72.5" cy="99.5" r="2.5" fill="#ffffff" />

          <circle cx="125" cy="102" r="7.5" fill="#0284c7" />
          <circle cx="125" cy="102" r="4.5" fill="#0f172a" />
          <circle cx="122.5" cy="99.5" r="2.5" fill="#ffffff" />
        </g>

        {/* ── BOTH CLOSED EYE LINES ── */}
        <g
          style={{
            opacity: isCovering ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out'
          }}
          stroke="#334155"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M 68,102 Q 75,108 82,102" fill="none" />
          <path d="M 118,102 Q 125,108 132,102" fill="none" />
        </g>

        {/* ── PAWS / HANDS ── */}
        {/* Left Paw */}
        <g
          style={{
            transform: isCovering ? 'translate(54px, 86px)' : 'translate(48px, 148px)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)'
          }}
        >
          <ellipse cx="20" cy="20" rx="16" ry="14" fill="#334155" />
          <ellipse cx="20" cy="22" rx="12" ry="9" fill="#ffffff" />
          <circle cx="14" cy="14" r="3" fill="#cbd5e1" />
          <circle cx="20" cy="12" r="3" fill="#cbd5e1" />
          <circle cx="26" cy="14" r="3" fill="#cbd5e1" />
        </g>

        {/* Right Paw */}
        <g
          style={{
            transform: isCovering ? 'translate(106px, 86px)' : 'translate(112px, 148px)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)'
          }}
        >
          <ellipse cx="20" cy="20" rx="16" ry="14" fill="#334155" />
          <ellipse cx="20" cy="22" rx="12" ry="9" fill="#ffffff" />
          <circle cx="14" cy="14" r="3" fill="#cbd5e1" />
          <circle cx="20" cy="12" r="3" fill="#cbd5e1" />
          <circle cx="26" cy="14" r="3" fill="#cbd5e1" />
        </g>
      </svg>
    </div>
  );
};

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

  useEffect(() => {
    const s = localStorage.getItem('nst_system_settings');
    if (s) { try { setSettings(JSON.parse(s)); } catch {} }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const generateUserId = () => {
    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    return `${timestampPart}${randomPart}`;
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
    const safeUser = {
      ...user,
      id: validId,
      uid: validId,
      profileCompleted: true
    };
    onLogin(safeUser);
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const userEmail = (firebaseUser.email || '').trim().toLowerCase();
      const userDisplayName = firebaseUser.displayName || 'Student';
      const userPhoto = firebaseUser.photoURL || '';
      const uid = firebaseUser.uid;

      let appUser: any = await getUserData(uid);
      if (!appUser && userEmail) appUser = await getUserByEmail(userEmail);
      if (!appUser) appUser = await getUserByLinkedGoogleUid(uid);

      if (appUser) {
        appUser = {
          ...appUser,
          id: uid,
          uid: uid,
          email: appUser.email || userEmail,
          name: appUser.name || userDisplayName,
          provider: 'google',
          photoURL: userPhoto || appUser.photoURL,
          profileCompleted: true,
          securityQuestion: appUser.securityQuestion || DEFAULT_QUESTIONS[0],
          securityAnswer: appUser.securityAnswer || 'google',
          credits: typeof appUser.credits === 'number' && appUser.credits > 0 ? appUser.credits : 50
        };

        localStorage.setItem('nst_current_user', JSON.stringify(appUser));
        localStorage.setItem('nst_last_user_id', uid);
        await saveUserToLive(appUser);

        if (logActivity) logActivity("LOGIN", "Logged In via Google Auth", appUser);
        triggerLoginSuccess(appUser);
      } else {
        const newId = generateUserId();
        const signupCoins = (settings && typeof settings.signupBonus === 'number') ? settings.signupBonus : (appSettings?.signupBonus || 50);

        const newUser: User = {
          id: uid,
          uid: uid,
          displayId: newId,
          name: userDisplayName,
          email: userEmail,
          password: '',
          mobile: '',
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
          credits: signupCoins,
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
          redeemedCodes: [],
          subscriptionTier: 'FREE',
          isPremium: false,
          inbox: [
            {
              id: `welcome-bonus-${Date.now()}`,
              text: `🎉 Welcome to IIC! Aapko ${signupCoins} Welcome Credits mil gaye hain.`,
              date: new Date().toISOString(),
              read: false,
              type: 'GIFT',
              gift: { type: 'CREDITS', value: signupCoins },
              isClaimed: true
            }
          ]
        };

        localStorage.setItem('nst_current_user', JSON.stringify(newUser));
        localStorage.setItem('nst_last_user_id', uid);
        await saveUserToLive(newUser);

        if (logActivity) logActivity("SIGNUP_GOOGLE", "New Student via Google", newUser);
        triggerLoginSuccess(newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in window band kar di gayi.");
      } else {
        setError(err.message || "Google Login fail hua.");
      }
    } finally {
      setLoading(false);
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
      await setPersistence(auth, browserLocalPersistence);

      if (input.includes('@')) {
        try {
          const res = await signInWithEmailAndPassword(auth, input.toLowerCase(), pass);
          const uid = res.user.uid;
          let appUser: any = await getUserData(uid);
          if (!appUser) appUser = await getUserByEmail(input.toLowerCase());

          const completeUser: User = {
            ...(appUser || {}),
            id: uid,
            uid: uid,
            email: appUser?.email || input.toLowerCase(),
            name: appUser?.name || res.user.displayName || "Student",
            mobile: appUser?.mobile || "",
            role: appUser?.role || "STUDENT",
            securityQuestion: appUser?.securityQuestion || DEFAULT_QUESTIONS[0],
            securityAnswer: appUser?.securityAnswer || "",
            board: appUser?.board || "CBSE",
            classLevel: appUser?.classLevel || "10",
            credits: appUser?.credits ?? 50,
            streak: appUser?.streak ?? 1,
            totalScore: appUser?.totalScore ?? 0,
            profileCompleted: true
          };

          localStorage.setItem('nst_current_user', JSON.stringify(completeUser));
          localStorage.setItem('nst_last_user_id', uid);
          await saveUserToLive(completeUser);

          if (logActivity) logActivity("LOGIN", "Logged In via Email", completeUser);
          triggerLoginSuccess(completeUser);
          return;
        } catch (e: any) {
          if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            setError("Galat password. Dobara check karein.");
            setLoading(false);
            return;
          }
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

        const isGoogleUser = targetUser.provider === 'google' || (!targetUser.password && targetUser.email);
        const passwordMatch = targetUser.password && (targetUser.password === pass || pass === settings?.adminCode || pass === appSettings?.adminCode);

        if (passwordMatch) {
          let freshProfile = await getUserData(targetUser.id);
          const raw = freshProfile || targetUser;
          const uid = raw.id || raw.uid;

          const finalUser: User = {
            ...raw,
            id: uid,
            uid: uid,
            email: raw.email || "",
            mobile: raw.mobile || "",
            securityQuestion: raw.securityQuestion || DEFAULT_QUESTIONS[0],
            securityAnswer: raw.securityAnswer || "",
            profileCompleted: true
          };

          localStorage.setItem('nst_current_user', JSON.stringify(finalUser));
          localStorage.setItem('nst_last_user_id', uid);
          await saveUserToLive(finalUser);

          if (logActivity) logActivity("LOGIN", "Logged In via Mobile/UID", finalUser);
          triggerLoginSuccess(finalUser);

          if (finalUser.email) signInWithEmailAndPassword(auth, finalUser.email, pass).catch(() => {});
          return;
        }

        if (isGoogleUser) {
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
      await setPersistence(auth, browserLocalPersistence);
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
        subscriptionTier: 'FREE',
        isPremium: false,
        inbox: [
          {
            id: `welcome-bonus-${Date.now()}`,
            text: `🎉 Welcome to IIC! Aapko ${signupCoins} Welcome Credits mil gaye hain.`,
            date: new Date().toISOString(),
            read: false,
            type: 'GIFT',
            gift: { type: 'CREDITS', value: signupCoins },
            isClaimed: true
          }
        ]
      };

      localStorage.setItem('nst_current_user', JSON.stringify(newStudentUser));
      localStorage.setItem('nst_last_user_id', uid);
      await saveUserToLive(newStudentUser);
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
      setError("Mobile, Email ya Account UID enter karein.");
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
        let freshProfile = await getUserData(validId);
        const raw = freshProfile || recoveryUserObj;

        const completeUser: User = {
          ...raw,
          id: validId,
          uid: validId,
          displayId: raw.displayId || recoveryUserObj.displayId || validId.slice(0, 8).toUpperCase(),
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

        localStorage.setItem('nst_current_user', JSON.stringify(completeUser));
        localStorage.setItem('nst_last_user_id', validId);
        await saveUserToLive(completeUser);

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
      <div className="min-h-screen w-full flex items-center justify-center bg-[#eef1f5] px-4 select-none">
        <div className="w-full max-w-md p-8 rounded-[2.5rem] bg-[#eef1f5] shadow-[20px_20px_60px_#caced5,-20px_-20px_60px_#ffffff] border border-white/60 text-center">
          <div className="w-16 h-16 bg-[#eef1f5] text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff]">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-1">Account Created!</h2>
          <p className="text-xs text-slate-500 mb-5">Aapka unique student login ID:</p>
          <div className="p-4 rounded-2xl bg-[#eef1f5] shadow-[inset_4px_4px_8px_#caced5,inset_-4px_-4px_8px_#ffffff] text-2xl font-mono font-black text-emerald-600 mb-6 flex items-center justify-center gap-3">
            <span>{generatedId}</span>
            <button type="button" onClick={handleCopyId} className="text-slate-400 hover:text-slate-700 p-1">
              {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (pendingLoginUser) triggerLoginSuccess(pendingLoginUser);
              else setView('LOGIN');
            }}
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[6px_6px_14px_#caced5,-6px_-6px_14px_#ffffff] active:scale-[0.98] transition-all"
          >
            Start Learning
          </button>
        </div>
      </div>
    );
  }

  const isFlipped = view === 'SIGNUP';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-[#eef1f5] text-slate-800 px-4 py-6 select-none font-sans overflow-x-hidden relative">
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
      <header className="w-full max-w-md flex items-center justify-between px-2 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-md p-1 border border-amber-400/40">
            {settings?.appLogo ? (
              <img src={settings.appLogo} alt="Logo" className="w-full h-full object-contain rounded-lg" />
            ) : (
              <span className="text-xs font-black text-amber-400">{settings?.appShortName || 'IIC'}</span>
            )}
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">{settings?.appName || 'IIC'}</h1>
        </div>

        <button 
          type="button"
          onClick={() => setShowGuide(true)} 
          className="w-8 h-8 rounded-full bg-[#eef1f5] shadow-[3px_3px_6px_#caced5,-3px_-3px_6px_#ffffff] flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          <HelpCircle size={17} />
        </button>
      </header>

      {/* ── 3D FLIP CONTAINER ── */}
      <div className="w-full max-w-[390px] my-auto" style={{ perspective: '1000px' }}>
        {view === 'RECOVERY' ? (
          <div className="w-full rounded-[2.5rem] bg-[#eef1f5] shadow-[20px_20px_50px_#caced5,-20px_-20px_50px_#ffffff] border border-white/60 p-7 sm:p-8 flex flex-col items-center">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-1 flex items-center gap-2 justify-center">
              <KeyRound size={22} className="text-red-500" />
              <span>Instant Recovery</span>
            </h2>
            <p className="text-xs font-medium text-slate-400 mb-5 text-center">
              {recoveryStep === 1 ? 'Apna account search karein' : 'Sahi answer se instant login'}
            </p>

            {error && (
              <div className="w-full mb-3 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                <XCircle size={15} className="shrink-0 text-rose-500" />
                <span className="truncate">{error}</span>
              </div>
            )}

            {recoveryStep === 1 && (
              <form onSubmit={handleFindRecoveryAccount} className="w-full space-y-4">
                <div className="relative flex items-center">
                  <UserIcon size={16} className="absolute left-4 text-slate-400" />
                  <input
                    name="id"
                    type="text"
                    required
                    placeholder="Mobile / Email / UID"
                    value={formData.id}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_4px_4px_8px_#caced5,inset_-4px_-4px_8px_#ffffff]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-wider text-slate-800 bg-[#eef1f5] shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer"
                >
                  {loading ? <Loader2 size={16} className="animate-spin text-slate-600" /> : <span>FIND ACCOUNT</span>}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}

            {recoveryStep === 2 && (
              <div className="w-full space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#eef1f5] shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] text-left">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">SECURITY QUESTION:</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">
                    {recoveryUserObj?.securityQuestion || "Aapka favorite subject kaunsa hai?"}
                  </p>
                </div>

                <form onSubmit={handleVerifyAnswerSubmit} className="space-y-3.5">
                  <div className="relative flex items-center">
                    <ShieldQuestion size={16} className="absolute left-4 text-amber-600" />
                    <input
                      type="text"
                      required
                      placeholder="Enter Security Answer"
                      value={userEnteredAnswer}
                      onChange={(e) => { setUserEnteredAnswer(e.target.value); setError(null); }}
                      className="w-full bg-[#eef1f5] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_4px_4px_8px_#caced5,inset_-4px_-4px_8px_#ffffff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-wider text-emerald-700 bg-[#eef1f5] shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>VERIFY &amp; LOGIN</span>
                  </button>
                </form>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-5">
              Wapas jaane ke liye{' '}
              <button
                type="button"
                onClick={() => { setView('LOGIN'); setRecoveryStep(1); setError(null); }}
                className="font-bold text-red-500 hover:underline ml-0.5"
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
              className="w-full rounded-[2.5rem] bg-[#eef1f5] shadow-[20px_20px_50px_#caced5,-20px_-20px_50px_#ffffff] border border-white/60 p-7 sm:p-8 flex flex-col items-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
              }}
            >
              <HuskyAvatar
                trackingLength={formData.id.length}
                isPasswordFocused={isPasswordFocused}
                showPassword={showPassword}
              />

              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-1 text-center">Login</h2>
              <p className="text-xs font-medium text-slate-400 mb-5 text-center">Sign in to your account</p>

              {error && (
                <div className="w-full mb-4 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <XCircle size={15} className="shrink-0 text-rose-500" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
                <div className="relative flex items-center">
                  <UserIcon size={16} className="absolute left-4 text-slate-400" />
                  <input
                    name="id"
                    type="text"
                    required
                    placeholder="Mobile, Email ya Account ID"
                    value={formData.id}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-medium outline-none shadow-[inset_4px_4px_8px_#caced5,inset_-4px_-4px_8px_#ffffff]"
                    autoCapitalize="none"
                  />
                </div>

                {/* Password input with Focus Lock */}
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-4 text-slate-400" />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-11 pr-11 py-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-medium outline-none shadow-[inset_4px_4px_8px_#caced5,inset_-4px_-4px_8px_#ffffff]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword((prev) => !prev);
                    }}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 p-1.5 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors shadow-inner flex items-center ${rememberMe ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                    <span className="text-slate-500 font-medium">Remember me</span>
                  </label>

                  <button 
                    type="button" 
                    onClick={() => { setView('RECOVERY'); setRecoveryStep(1); setError(null); }}
                    className="text-red-500 font-bold hover:underline transition-colors flex items-center gap-1.5"
                  >
                    <KeyRound size={13} className="text-red-500" />
                    <span>Instant Recovery</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-wider text-slate-700 bg-[#eef1f5] shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] active:scale-[0.99] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer mt-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin text-slate-600" /> : <span>SIGN IN</span>}
                </button>
              </form>

              <button 
                type="button" 
                onClick={handleGoogleAuth} 
                disabled={loading}
                className="w-full mt-3.5 py-3 rounded-2xl bg-[#eef1f5] shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700"
              >
                <GoogleBrandIcon />
                <span>Google Sign-in</span>
              </button>

              <p className="text-xs text-slate-500 mt-5">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setView('SIGNUP'); setError(null); }}
                  className="font-bold text-red-500 hover:underline ml-0.5 cursor-pointer"
                >
                  Sign up
                </button>
              </p>
            </div>

            {/* ── BACK: SIGN UP (180 DEGREE FLIPPED) ── */}
            <div
              className="w-full rounded-[2.5rem] bg-[#eef1f5] shadow-[20px_20px_50px_#caced5,-20px_-20px_50px_#ffffff] border border-white/60 p-7 sm:p-8 flex flex-col items-center absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-1 text-center">Sign Up</h2>
              <p className="text-xs font-medium text-slate-400 mb-4 text-center">Create account & get 50 bonus credits</p>

              {error && (
                <div className="w-full mb-3 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <XCircle size={14} className="shrink-0 text-rose-500" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <form onSubmit={handleSignUpSubmit} className="w-full space-y-3">
                <div className="relative flex items-center">
                  <UserIcon size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff]"
                  />
                </div>

                <div className="relative flex items-center">
                  <Phone size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="mobile"
                    type="tel"
                    placeholder="Mobile Number"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff]"
                  />
                </div>

                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff]"
                  />
                </div>

                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="Password (Min 6 chars)"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff]"
                  />
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <select
                    name="securityQuestion"
                    value={formData.securityQuestion}
                    onChange={handleChange}
                    className="w-full bg-[#eef1f5] rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium outline-none shadow-[inset_2px_2px_5px_#caced5,inset_-2px_-2px_5px_#ffffff]"
                  >
                    {DEFAULT_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                  
                  <div className="relative flex items-center">
                    <ShieldQuestion size={15} className="absolute left-3.5 text-amber-600" />
                    <input
                      name="securityAnswer"
                      type="text"
                      required
                      placeholder="Secret Answer (Recovery ke liye)"
                      value={formData.securityAnswer}
                      onChange={handleChange}
                      className="w-full bg-[#eef1f5] rounded-xl pl-10 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none shadow-[inset_2px_2px_5px_#caced5,inset_-2px_-2px_5px_#ffffff]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl text-xs sm:text-sm font-black tracking-wider text-slate-800 bg-[#eef1f5] shadow-[6px_6px_12px_#caced5,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#caced5,inset_-3px_-3px_6px_#ffffff] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer mt-1"
                >
                  {loading ? <Loader2 size={16} className="animate-spin text-slate-600" /> : <span>CREATE ACCOUNT</span>}
                </button>
              </form>

              <p className="text-xs text-slate-500 mt-4">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setView('LOGIN'); setError(null); }}
                  className="font-bold text-red-500 hover:underline ml-0.5 cursor-pointer"
                >
                  Login
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
};

export default Auth;
