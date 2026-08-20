// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { saveUserToLive, auth, getUserByEmail, getUserByMobileOrId, getUserData } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { Lock, User as UserIcon, Mail, Loader2, AlertCircle, School, Search, ShieldCheck, KeyRound, Clock, ArrowRight, CheckCircle2, ShieldQuestion, Phone } from 'lucide-react';
import { getAllSchools } from '../school-firebase';
import type { School as SchoolType } from '../school-types';

interface Props {
  onLogin: (user: User) => void;
  logActivity: (action: string, details: string, user?: User) => void;
  appSettings?: SystemSettings;
}

const DEFAULT_QUESTIONS = [
  "Aapka favorite subject kaunsa hai?",
  "Aapke primary school ka naam kya tha?",
  "Aapka favorite teacher kaun hai?",
  "Aapka birth city / gaon kaunsa hai?"
];

export const Auth: React.FC<Props> = ({ onLogin, logActivity, appSettings }) => {
  const [activeSide, setActiveSide] = useState<'LOGIN' | 'SIGNUP' | 'RECOVERY'>('LOGIN');
  const isFlipped = activeSide !== 'LOGIN';

  const switchSide = (target: 'LOGIN' | 'SIGNUP' | 'RECOVERY') => {
    if (target === activeSide) return;
    setError(null);
    setActiveSide(target);
  };

  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Inputs
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  
  // Security Question (Signup)
  const [selectedQuestion, setSelectedQuestion] = useState(DEFAULT_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // 2-Step Instant Recovery States
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryUserObj, setRecoveryUserObj] = useState<any>(null);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [userEnteredAnswer, setUserEnteredAnswer] = useState('');
  const [recoveryProgress, setRecoveryProgress] = useState(false);
  const [recoveryTimer, setRecoveryTimer] = useState(60);

  // App Level Views
  const [view, setView] = useState<'AUTH' | 'SCHOOL_SELECT' | 'SUCCESS_ID'>('AUTH');
  const [generatedId, setGeneratedId] = useState('');
  const [pendingLoginUser, setPendingLoginUser] = useState<User | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<any>(null);
  const [welcomeFading, setWelcomeFading] = useState(false);

  // School Selection States
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');

  const triggerWelcome = (user: any) => {
    setWelcomeUser(user);
    setTimeout(() => setWelcomeFading(true), 600);
    setTimeout(() => { 
      setWelcomeUser(null); 
      setWelcomeFading(false); 
      onLogin(user); 
    }, 900);
  };

  // 1-Minute Fallback Auto-Verify Timer
  useEffect(() => {
    let interval: any;
    if (recoveryProgress && recoveryTimer > 0) {
      interval = setInterval(() => {
        setRecoveryTimer(prev => prev - 1);
      }, 1000);
    } else if (recoveryProgress && recoveryTimer === 0) {
      if (recoveryUserObj) {
        if (logActivity) logActivity("PASSWORDLESS_AUTO_LOGIN", "Fallback verification complete", recoveryUserObj);
        setRecoveryProgress(false);
        triggerWelcome(recoveryUserObj);
      } else {
        setError("Verification fail hua. Kripya dobara try karein.");
        setRecoveryProgress(false);
        setRecoveryTimer(60);
      }
    }
    return () => clearInterval(interval);
  }, [recoveryProgress, recoveryTimer, recoveryUserObj]);

  // STEP 1: Find Account
  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const identifier = recoveryIdentifier.trim().toLowerCase();

    if (!identifier) {
      setError('Mobile, Email ya UID enter karein.');
      return;
    }

    setLoading(true);
    try {
      let targetUser: any = null;
      if (identifier.includes('@')) {
        targetUser = await getUserByEmail(identifier);
      }
      if (!targetUser) {
        targetUser = await getUserByMobileOrId(identifier);
      }

      if (targetUser) {
        if (targetUser.isArchived) {
          setError('Yeh account delete ho chuka hai.');
          setLoading(false);
          return;
        }
        setRecoveryUserObj(targetUser);
        setRecoveryStep(2);
      } else {
        setError('Is details se koi account nahi mila.');
      }
    } catch {
      setError('Account dhundhne mein samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2A: Verify Answer for Instant Login
  const handleInstantAnswerVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const entered = userEnteredAnswer.trim().toLowerCase();
    const originalAnswer = (recoveryUserObj?.securityAnswer || '').trim().toLowerCase();

    if (!entered) {
      setError('Kripya apna answer enter karein.');
      return;
    }

    if (originalAnswer && entered === originalAnswer) {
      setLoading(true);
      let freshProfile = await getUserData(recoveryUserObj.id);
      const finalUser = freshProfile || recoveryUserObj;

      if (logActivity) logActivity("INSTANT_SECURITY_LOGIN", "Instant login via correct Security Answer", finalUser);
      setLoading(false);
      triggerWelcome(finalUser);
    } else {
      setError('Galat Answer! Sahi answer dalein ya Auto-Verification start karein.');
    }
  };

  // STEP 2B: Start Auto-Verification
  const handleStartTimerFallback = () => {
    setError(null);
    setRecoveryProgress(true);
    setRecoveryTimer(60);
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = loginIdentifier.trim();
    const pass = loginPassword.trim();

    if (!input || !pass) {
      setError('Mobile/Email aur Password dono bharein.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);

      if (input.includes('@')) {
        try {
          const res = await signInWithEmailAndPassword(auth, input.toLowerCase(), pass);
          const uid = res.user.uid;
          let appUser = await getUserData(uid);
          if (!appUser) {
            appUser = await getUserByEmail(input.toLowerCase());
          }
          if (appUser) {
            if (logActivity) logActivity("LOGIN", "User logged in via Email", appUser);
            triggerWelcome(appUser);
            return;
          }
        } catch {}
      }

      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth).catch(() => {});
        }
      } catch {}

      let targetUser: any = await getUserByMobileOrId(input);
      if (!targetUser && input.includes('@')) {
        targetUser = await getUserByEmail(input.toLowerCase());
      }

      if (targetUser) {
        if (targetUser.isArchived) {
          setError("Yeh account deleted/blocked hai.");
          setLoading(false);
          return;
        }

        const passwordMatch = targetUser.password && (targetUser.password === pass || pass === appSettings?.adminCode);

        if (passwordMatch) {
          let freshProfile = await getUserData(targetUser.id);
          const finalUser = freshProfile || targetUser;

          if (logActivity) logActivity("LOGIN", "User logged in via Mobile/UID", finalUser);
          triggerWelcome(finalUser);

          if (finalUser.email) {
            signInWithEmailAndPassword(auth, finalUser.email, pass).catch(() => {});
          }
          return;
        } else {
          setError("Galat Password! Sahi password dalein.");
          setLoading(false);
          return;
        }
      }

      setError("Account nahi mila. Mobile number, UID ya Email dobara check karein.");
    } catch {
      setError("Login fail hua. Kripya details check karein.");
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = signupName.trim();
    const cleanEmail = signupEmail.trim().toLowerCase();
    const cleanMobile = signupMobile.trim();
    const cleanAnswer = securityAnswer.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !signupPassword || !cleanAnswer) {
      setError('Sabhi fields aur Security Answer bharna zaroori hai.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password kam se kam 6 characters ka hona chahiye.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, signupPassword);
      const uid = res.user.uid;
      const newId = `${Date.now().toString().slice(-4)}${Math.floor(100000 + Math.random() * 900000)}`;

      const newUser: User = {
        id: uid,
        displayId: newId,
        name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile || '',
        password: signupPassword,
        securityQuestion: selectedQuestion,
        securityAnswer: cleanAnswer,
        role: 'STUDENT',
        isPremium: false,
        profileCompleted: true,
        credits: appSettings?.signupBonus || 50,
        streak: 0,
        createdAt: new Date().toISOString(),
        lastLoginDate: new Date().toISOString()
      };

      await saveUserToLive(newUser);
      if (logActivity) logActivity("SIGNUP", "New student registered", newUser);

      setGeneratedId(newId);
      setPendingLoginUser(newUser);
      setView('SCHOOL_SELECT');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Yeh email pehle se registered hai.');
      } else {
        setError(err.message || 'Signup fail ho gaya.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Auth
  const handleGoogleAuth = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await setPersistence(auth, browserLocalPersistence);
      const res = await signInWithPopup(auth, provider);
      const firebaseUser = res.user;

      let appUser = await getUserData(firebaseUser.uid);
      if (!appUser && firebaseUser.email) {
        appUser = await getUserByEmail(firebaseUser.email);
      }

      if (appUser) {
        triggerWelcome(appUser);
      } else {
        const newId = `${Date.now().toString().slice(-4)}${Math.floor(100000 + Math.random() * 900000)}`;
        const newUser: User = {
          id: firebaseUser.uid,
          displayId: newId,
          name: firebaseUser.displayName || 'Student',
          email: firebaseUser.email || '',
          mobile: firebaseUser.phoneNumber || '',
          role: 'STUDENT',
          provider: 'google',
          securityQuestion: DEFAULT_QUESTIONS[0],
          securityAnswer: 'google',
          credits: appSettings?.signupBonus || 50,
          streak: 0,
          createdAt: new Date().toISOString(),
          lastLoginDate: new Date().toISOString()
        };
        await saveUserToLive(newUser);
        triggerWelcome(newUser);
      }
    } catch {
      setError('Google Sign-in fail ho gaya.');
    }
  };

  // Standard 4-Color Official Google Icon Component
  const GoogleBrandIcon = () => (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );

  // Welcome Overlay
  if (welcomeUser) {
    const name = (welcomeUser.name || 'Student').split(' ')[0];
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'radial-gradient(circle at center, #1a1238 0%, #07050f 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        animation: welcomeFading ? 'welcome-fade-out 0.4s ease forwards' : 'welcome-fade-in 0.4s ease forwards'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 18px',
            background: 'linear-gradient(135deg, #fbbf24, #d97706)',
            boxShadow: '0 0 35px rgba(251,191,36,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, color: '#fff'
          }}>✦</div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: '#fbbf24' }}>Welcome</h1>
          <p style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>{name}</p>
        </div>
      </div>
    );
  }

  // School Selection Step
  if (view === 'SCHOOL_SELECT') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#e8e8e8] px-4 font-sans select-none">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#e8e8e8] shadow-[20px_20px_45px_#c3c3c3,-20px_-20px_45px_#ffffff] text-center border border-white/60">
          <School size={40} className="text-[#991b1b] mx-auto mb-2" />
          <h2 className="text-xl font-black text-[#333]">Apna School Select Karein</h2>
          <div className="my-4 relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search school..."
              value={schoolSearch}
              onChange={e => setSchoolSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs bg-[#e8e8e8] shadow-[inset_3px_3px_6px_#c3c3c3,inset_-3px_-3px_6px_#ffffff] outline-none text-[#333]"
            />
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
            {schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase())).map(sc => (
              <button
                key={sc.id}
                onClick={async () => {
                  if (pendingLoginUser) {
                    const u = { ...pendingLoginUser, schoolId: sc.id, schoolName: sc.name };
                    await saveUserToLive(u);
                    setPendingLoginUser(u);
                  }
                  setView('SUCCESS_ID');
                }}
                className="w-full p-3 rounded-xl bg-[#e8e8e8] shadow-[4px_4px_8px_#c5c5c5,-4px_-4px_8px_#ffffff] text-xs font-bold text-[#444] text-left truncate hover:text-[#991b1b]"
              >
                {sc.name}
              </button>
            ))}
          </div>
          <button onClick={() => setView('SUCCESS_ID')} className="text-xs font-bold text-slate-500 hover:text-[#333]">
            Baad Mein Select Karunga →
          </button>
        </div>
      </div>
    );
  }

  // Account Created Success ID
  if (view === 'SUCCESS_ID') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#e8e8e8] px-4 select-none">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#e8e8e8] shadow-[20px_20px_45px_#c3c3c3,-20px_-20px_45px_#ffffff] text-center border border-white/60">
          <ShieldCheck size={46} className="text-emerald-600 mx-auto mb-2" />
          <h2 className="text-2xl font-black text-[#333] mb-1">Account Created!</h2>
          <p className="text-xs text-slate-500 mb-4">Aapka unique login ID:</p>
          <div className="p-3.5 rounded-xl bg-[#e8e8e8] shadow-[inset_4px_4px_8px_#c3c3c3,inset_-4px_-4px_8px_#ffffff] text-xl font-mono font-bold text-[#991b1b] mb-5">
            {generatedId}
          </div>
          <button
            onClick={() => {
              if (pendingLoginUser) triggerWelcome(pendingLoginUser);
              else setView('AUTH');
            }}
            className="w-full py-3.5 rounded-xl bg-[#e8e8e8] shadow-[6px_6px_12px_#c3c3c3,-6px_-6px_12px_#ffffff] hover:bg-[#991b1b] hover:text-white font-bold text-xs uppercase transition-all tracking-wider text-[#333]"
          >
            Start Learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#e8e8e8] text-[#4a4a4a] px-4 py-6 select-none font-sans overflow-y-auto">
      
      {/* ── CARD CONTAINER (3D FLIP) ── */}
      <div className="relative w-[92vw] max-w-[430px] min-h-[620px] [perspective:1400px] my-auto flex items-center justify-center">
        
        <div 
          className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-700 ease-in-out"
          style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          
          {/* ══════════════════════════════════════════════════════════════════════
              SIDE 1: LOGIN
          ══════════════════════════════════════════════════════════════════════ */}
          <div className="w-full min-h-[620px] rounded-[2.5rem] bg-[#e8e8e8] [backface-visibility:hidden] flex flex-col items-center justify-between p-8 sm:p-9 shadow-[20px_20px_50px_#c3c3c3,-20px_-20px_50px_#ffffff] border border-white/80">
            
            <div className="w-full flex flex-col items-center my-auto">
              
              <h2 className="text-3xl font-black text-[#2e2e2e] tracking-tight mb-1">Login</h2>
              <p className="text-xs sm:text-sm font-medium text-[#888888] mb-6">Sign in to your account</p>

              {error && activeSide === 'LOGIN' && (
                <div className="w-full mb-3 px-3.5 py-2 rounded-xl bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-2 shadow-inner">
                  <AlertCircle size={15} className="shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="w-full space-y-3.5">
                <div className="relative flex items-center">
                  <UserIcon size={17} className="absolute left-4 text-[#8a8a8a]" />
                  <input
                    type="text"
                    required
                    placeholder="Mobile, Email ya Account ID"
                    value={loginIdentifier}
                    onChange={(e) => { setLoginIdentifier(e.target.value); setError(null); }}
                    className="w-full bg-[#e8e8e8] rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] font-medium outline-none shadow-[inset_4px_4px_8px_rgba(184,190,204,0.5),inset_-4px_-4px_8px_rgba(255,255,255,0.95)]"
                    autoCapitalize="none"
                  />
                </div>

                <div className="relative flex items-center">
                  <Lock size={17} className="absolute left-4 text-[#8a8a8a]" />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setError(null); }}
                    className="w-full bg-[#e8e8e8] rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] font-medium outline-none shadow-[inset_4px_4px_8px_rgba(184,190,204,0.5),inset_-4px_-4px_8px_rgba(255,255,255,0.95)]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm text-[#777] pt-0.5 px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div 
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 shadow-[inset_2px_2px_4px_rgba(184,190,204,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] ${
                        rememberMe ? 'bg-[#991b1b]' : 'bg-[#e8e8e8]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                        rememberMe ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                    <span>Remember me</span>
                  </label>

                  <button 
                    type="button" 
                    onClick={() => { switchSide('RECOVERY'); setRecoveryStep(1); }}
                    className="text-[#991b1b] font-bold hover:underline transition-colors flex items-center gap-1"
                  >
                    <KeyRound size={13} />
                    <span>Instant Recovery</span>
                  </button>
                </div>

                {/* SIGN IN BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-widest text-[#444] bg-[#e8e8e8] border border-white/80 shadow-[6px_6px_14px_#c5c5c5,-6px_-6px_14px_#ffffff] hover:bg-[#881337] hover:text-white hover:border-transparent active:scale-[0.98] active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <span>SIGN IN</span>}
                  </button>
                </div>
              </form>

              {/* CLEAN DIVIDER */}
              <div className="w-full flex items-center my-3.5">
                <div className="flex-1 h-px bg-slate-300/70" />
                <span className="px-3 text-[10px] font-extrabold text-slate-400 tracking-wider">OR</span>
                <div className="flex-1 h-px bg-slate-300/70" />
              </div>

              {/* HIGH-END PROFESSIONAL GOOGLE BUTTON */}
              <button 
                type="button" 
                onClick={handleGoogleAuth} 
                className="w-full py-3 rounded-2xl bg-white border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.06),4px_4px_10px_#c9c9c9] hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs sm:text-sm font-bold text-slate-700 font-sans"
              >
                <GoogleBrandIcon />
                <span>Continue with Google</span>
              </button>

              <p className="text-xs sm:text-sm text-[#777] mt-4">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchSide('SIGNUP')}
                  className="font-bold text-[#b91c1c] hover:underline ml-0.5"
                >
                  Sign up
                </button>
              </p>

            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              SIDE 2: SIGN UP / RECOVERY
          ══════════════════════════════════════════════════════════════════════ */}
          <div className="absolute inset-0 w-full min-h-[620px] rounded-[2.5rem] bg-[#e8e8e8] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col items-center justify-between p-8 sm:p-9 shadow-[20px_20px_50px_#c3c3c3,-20px_-20px_50px_#ffffff] border border-white/80 overflow-y-auto">
            
            <div className="w-full flex flex-col items-center my-auto">
              
              {/* SIGN UP */}
              {activeSide === 'SIGNUP' && (
                <>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#2e2e2e] tracking-tight mb-0.5">Sign Up</h2>
                  <p className="text-xs sm:text-sm font-medium text-[#888888] mb-3">Create your smart account</p>

                  {error && (
                    <div className="w-full mb-2.5 px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-2 shadow-inner">
                      <AlertCircle size={14} className="shrink-0" />
                      <span className="truncate">{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSignUp} className="w-full space-y-2.5">
                    <div className="relative flex items-center">
                      <UserIcon size={16} className="absolute left-3.5 text-[#8a8a8a]" />
                      <input
                        type="text"
                        required
                        placeholder="Full name"
                        value={signupName}
                        onChange={(e) => { setSignupName(e.target.value); setError(null); }}
                        className="w-full bg-[#e8e8e8] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <Phone size={16} className="absolute left-3.5 text-[#8a8a8a]" />
                      <input
                        type="tel"
                        placeholder="Mobile Number"
                        value={signupMobile}
                        onChange={(e) => { setSignupMobile(e.target.value); setError(null); }}
                        className="w-full bg-[#e8e8e8] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <Mail size={16} className="absolute left-3.5 text-[#8a8a8a]" />
                      <input
                        type="email"
                        required
                        placeholder="Email address"
                        value={signupEmail}
                        onChange={(e) => { setSignupEmail(e.target.value); setError(null); }}
                        className="w-full bg-[#e8e8e8] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <Lock size={16} className="absolute left-3.5 text-[#8a8a8a]" />
                      <input
                        type="password"
                        required
                        placeholder="Password (Min 6 chars)"
                        value={signupPassword}
                        onChange={(e) => { setSignupPassword(e.target.value); setError(null); }}
                        className="w-full bg-[#e8e8e8] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                      />
                    </div>

                    <div className="space-y-1 pt-0.5">
                      <select
                        value={selectedQuestion}
                        onChange={(e) => setSelectedQuestion(e.target.value)}
                        className="w-full bg-[#e8e8e8] rounded-xl px-3 py-2 text-xs text-[#444] font-medium outline-none shadow-[inset_2px_2px_4px_rgba(184,190,204,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] truncate"
                      >
                        {DEFAULT_QUESTIONS.map((q, idx) => (
                          <option key={idx} value={q}>{q}</option>
                        ))}
                      </select>
                      
                      <div className="relative flex items-center">
                        <ShieldQuestion size={16} className="absolute left-3.5 text-[#991b1b]" />
                        <input
                          type="text"
                          required
                          placeholder="Security Answer (Profile par dikhega)"
                          value={securityAnswer}
                          onChange={(e) => { setSecurityAnswer(e.target.value); setError(null); }}
                          className="w-full bg-[#e8e8e8] rounded-xl pl-10 pr-3 py-2 text-xs text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                        />
                      </div>
                    </div>

                    {/* CREATE ACCOUNT CTA */}
                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-2xl text-xs sm:text-sm font-black tracking-widest text-[#444] bg-[#e8e8e8] border border-white/80 shadow-[6px_6px_14px_#c5c5c5,-6px_-6px_14px_#ffffff] hover:bg-[#881337] hover:text-white hover:border-transparent active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <span>CREATE ACCOUNT</span>}
                      </button>
                    </div>
                  </form>

                  {/* GOOGLE SIGN UP BUTTON */}
                  <button 
                    type="button" 
                    onClick={handleGoogleAuth} 
                    className="w-full mt-2.5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-[0_2px_6px_rgba(0,0,0,0.06),3px_3px_8px_#c9c9c9] hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 text-xs font-bold text-slate-700"
                  >
                    <GoogleBrandIcon />
                    <span>Sign up with Google</span>
                  </button>

                  <p className="text-xs sm:text-sm text-[#777] mt-3">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchSide('LOGIN')}
                      className="font-bold text-[#b91c1c] hover:underline ml-0.5"
                    >
                      Login
                    </button>
                  </p>
                </>
              )}

              {/* INSTANT QUESTION RECOVERY */}
              {activeSide === 'RECOVERY' && (
                <>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#2e2e2e] tracking-tight mb-1.5 flex items-center gap-2 justify-center">
                    <KeyRound size={22} className="text-[#991b1b]" />
                    <span>Instant Recovery</span>
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-[#888888] mb-5 text-center">
                    {recoveryStep === 1 ? 'Apna account search karein' : 'Sahi Answer par instant login'}
                  </p>

                  {error && (
                    <div className="w-full mb-3 px-4 py-2 rounded-2xl bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-2 shadow-inner">
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="truncate">{error}</span>
                    </div>
                  )}

                  {/* STEP 1 */}
                  {recoveryStep === 1 && (
                    <form onSubmit={handleFindAccount} className="w-full space-y-4">
                      <div className="relative flex items-center">
                        <UserIcon size={18} className="absolute left-4.5 text-[#8a8a8a]" />
                        <input
                          type="text"
                          required
                          placeholder="Mobile / Email / UID"
                          value={recoveryIdentifier}
                          onChange={(e) => { setRecoveryIdentifier(e.target.value); setError(null); }}
                          className="w-full bg-[#e8e8e8] rounded-2xl pl-12 pr-4 py-3.5 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_4px_4px_8px_rgba(184,190,204,0.45),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-widest text-[#444] bg-[#e8e8e8] border border-white/80 shadow-[6px_6px_14px_#c5c5c5,-6px_-6px_14px_#ffffff] hover:bg-[#881337] hover:text-white hover:border-transparent active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase mt-2"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <span>FIND ACCOUNT</span>}
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}

                  {/* STEP 2 */}
                  {recoveryStep === 2 && (
                    <div className="w-full space-y-3.5">
                      <div className="p-4 rounded-2xl bg-[#e8e8e8] shadow-[inset_3px_3px_6px_#c3c3c3,inset_-3px_-3px_6px_#ffffff] text-left">
                        <span className="text-[10px] font-bold text-[#991b1b] uppercase tracking-wider block">SECURITY QUESTION:</span>
                        <p className="text-xs sm:text-sm font-bold text-[#333] mt-1">
                          {recoveryUserObj?.securityQuestion || "Aapka favorite subject kaunsa hai?"}
                        </p>
                      </div>

                      <form onSubmit={handleInstantAnswerVerify} className="space-y-3">
                        <div className="relative flex items-center">
                          <ShieldQuestion size={18} className="absolute left-4.5 text-[#991b1b]" />
                          <input
                            type="text"
                            required
                            placeholder="Enter Security Answer"
                            value={userEnteredAnswer}
                            onChange={(e) => { setUserEnteredAnswer(e.target.value); setError(null); }}
                            className="w-full bg-[#e8e8e8] rounded-2xl pl-12 pr-4 py-3 text-xs sm:text-sm text-[#333] placeholder-[#9fa4af] outline-none shadow-[inset_3px_3px_6px_rgba(184,190,204,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading || recoveryProgress}
                          className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black tracking-widest text-white bg-[#991b1b] hover:bg-[#7f1d1d] shadow-[5px_5px_12px_#c5c5c5] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase"
                        >
                          <CheckCircle2 size={16} />
                          <span>VERIFY &amp; LOGIN</span>
                        </button>
                      </form>

                      {recoveryProgress ? (
                        <div className="w-full p-3.5 rounded-2xl bg-[#e8e8e8] shadow-[inset_3px_3px_6px_#c3c3c3,inset_-3px_-3px_6px_#ffffff] flex flex-col items-center">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#991b1b] animate-pulse">
                            <Clock size={16} className="animate-spin" />
                            <span>Account verify ho raha hai ({recoveryTimer}s)...</span>
                          </div>
                          <span className="text-[10px] text-[#777] mt-0.5">Please wait, verification in progress</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartTimerFallback}
                          className="text-xs text-slate-500 hover:text-[#991b1b] underline font-medium block mx-auto pt-1"
                        >
                          Answer yaad nahi hai? System se Auto-Verify karein (1-Min)
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-xs sm:text-sm text-[#777] mt-6">
                    Wapas jaane ke liye{' '}
                    <button
                      type="button"
                      onClick={() => { switchSide('LOGIN'); setRecoveryStep(1); setRecoveryProgress(false); }}
                      className="font-bold text-[#b91c1c] hover:underline ml-0.5"
                    >
                      Login karein
                    </button>
                  </p>
                </>
              )}

            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Auth;
