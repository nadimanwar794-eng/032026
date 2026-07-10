// @ts-nocheck
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  ClassLevel, Subject, Chapter, AppState, Board, Stream, User, ContentType, SystemSettings, ActivityLogEntry, WeeklyTest, LessonContent, ActiveSubscription, InboxMessage
} from './types';
import { getChapterData, saveChapterData, checkFirebaseConnection, saveTestResult, saveUserToLive, updateUserStatus, getUserData, subscribeToSettings, subscribeToUser, auth, savePublicActivity, saveUserHistory, getUserSavedNotes, rtdb, db } from './firebase';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { doc as fsDoc, setDoc as fsSetDoc } from 'firebase/firestore';
import { storage } from './utils/storage';
import { recalculateSubscriptionStatus, addSubscription } from './utils/subscriptionUtils';
import { getLevelInfo, getLevelLimitBonus } from './utils/levelSystem';
import { applyDeduction, getTotalCredits } from './utils/creditSystem';
import { signInAnonymously } from 'firebase/auth';
import { fetchChapters, fetchLessonContent } from './services/groq';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { Onboarding }
from './components/Onboarding';
import { BoardSelection } from './components/BoardSelection';
import { ClassSelection } from './components/ClassSelection';
import { SubjectSelection } from './components/SubjectSelection';
import { StreamSelection } from './components/StreamSelection';
const LessonView = lazy(() => import('./components/LessonView').then(m => ({ default: m.LessonView })));
import { Auth } from './components/Auth';
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
import { StudentDashboard } from './components/StudentDashboard';
const SchoolEcosystem = lazy(() => import('./components/school/SchoolEcosystem').then(m => ({ default: m.SchoolEcosystem })));
import { getSchoolUserProfile } from './school-firebase';
const CoachingEcosystem = lazy(() => import('./components/coaching/CoachingEcosystem').then(m => ({ default: m.CoachingEcosystem })));
import { getCoachingUserProfile } from './coaching-firebase';
import { AudioStudio } from './components/AudioStudio';
import { PremiumModal } from './components/PremiumModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { RulesPage } from './components/RulesPage';
import { IICPage } from './components/IICPage';
const WeeklyTestView = lazy(() => import('./components/WeeklyTestView').then(m => ({ default: m.WeeklyTestView })));
const UniversalChat = lazy(() => import('./components/UniversalChat').then(m => ({ default: m.UniversalChat })));
const MarksheetCard = lazy(() => import('./components/MarksheetCard').then(m => ({ default: m.MarksheetCard })));
import { CreditConfirmationModal } from './components/CreditConfirmationModal';
import { CustomAlert, CustomConfirm } from './components/CustomDialogs';
import { UpdatePopup } from './components/UpdatePopup';

import { StreakLoginPopup } from './components/StreakLoginPopup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logErrorToFirebase, setErrorLoggerUser } from './utils/errorLogger';
import { initPerfMode } from './utils/performanceMode';
import { CreditToast } from './components/CreditToast';
import { generateDailyChallengeQuestions } from './utils/challengeGenerator';
import { BrainCircuit, Globe, LogOut, LayoutDashboard, BookOpen, Headphones, HelpCircle, Newspaper, KeyRound, Lock, X, ShieldCheck, FileText, UserPlus, EyeOff, WifiOff, Cloud, ArrowLeft, ExternalLink } from 'lucide-react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { SUPPORT_EMAIL, APP_VERSION } from './constants';
import { StudentTab, PendingReward, MCQResult, SubscriptionHistoryEntry } from './types';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [appMcqCommunityDraft, setAppMcqCommunityDraft] = useState<{question: string; options: [string,string,string,string]; correctAnswer: number; explanation: string} | null>(null);

  const [isAppLoading, setIsAppLoading] = useState(() => sessionStorage.getItem('nst_has_loaded') !== 'true');

  useEffect(() => { initPerfMode(); }, []);

  useEffect(() => {
    if (!isAppLoading) {
      sessionStorage.setItem('nst_has_loaded', 'true');
    }
  }, [isAppLoading]);

  // TESTING OVERRIDE: Render component directly bypassing auth
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mock') === 'dashboard' || urlParams.get('mock') === 'dashboard_with_inbox') {
            setState(prev => ({
                ...prev,
                user: {
                   id: "mock-student",
                   name: "Student Name",
                   role: "STUDENT",
                   isPremium: false,
                   profileCompleted: true,
                   streak: 5,
                   credits: 100,
                   inbox: [{ id: 'msg1', text: 'Hello from Admin! Here is a gift.', type: 'GIFT', gift: { type: 'CREDITS', value: 50 }, date: new Date().toISOString(), read: false, isClaimed: false }, { id: 'msg2', text: 'Please complete your assignments.', type: 'TEXT', date: new Date().toISOString(), read: true }],
                   class: '10'
                } as any,
                settings: {
                   appName: "IIC",
                   appLogo: 'https://via.placeholder.com/150',
                   studentApp: { enabled: true }
                } as any,
                view: 'STUDENT_DASHBOARD'
            }));
        } else if (urlParams.get('mock') === 'pdf_view') {
          // Force view into PDF View mock
          setState(prev => ({
              ...prev,
              user: {
                 id: "mock-teacher",
                 role: "TEACHER",
                 name: "Prof. Smith",
                 isPremium: true,
                 profileCompleted: true
              } as any,
              view: 'LESSON',
              selectedBoard: 'CBSE',
              selectedClass: '10',
              selectedSubject: { id: "sub", name: "Science", icon: "Flask" } as any,
              selectedChapter: { id: "chap", title: "Photosynthesis", isLocked: false } as any,
              lessonContent: {
                 id: "lesson",
                 type: "NOTES_HTML_FREE",
                 title: "Photosynthesis",
                 subjectName: "Science",
                 dateCreated: new Date().toISOString(),
                 content: "Test notes"
              } as any
          }));
      } else if (urlParams.get('mock') === 'custom_page') {
          setState(prev => ({
              ...prev,
              user: {
                 id: "mock-student",
                 name: "Mock Student",
                 role: "STUDENT",
                 isPremium: true
              } as any,
              settings: {
                 appName: "IIC",
                 customBloggerVideoUrl: "https://drive.google.com/file/d/1BxdxX9y4jJzQhR_tF6yE5eN3lPz9sZqT/view"
              } as any,
              view: 'STUDENT_DASHBOARD'
          }));
      } else if (urlParams.get('mock') === 'revision') {
          setState(prev => ({
              ...prev,
              user: {
                 id: "mock-student",
                 name: "Mock Student",
                 role: "STUDENT",
                 isPremium: true,
                 profileCompleted: true
              } as any,
              view: 'REVISION_HUB'
          }));
      } else if (urlParams.get('mock') === 'marksheet') {
          // Dummy data to trigger the MarksheetCard
          setLastTestResult({
              id: "mock-result-123",
              userId: "mock-user",
              chapterId: "mock-chapter",
              chapterTitle: "Thermodynamics Theory & Numerical Application",
              subjectId: "Physics",
              score: 8,
              total: 10,
              totalQuestions: 10,
              correctCount: 8,
              wrongCount: 2,
              totalTimeSeconds: 150,
              timeTaken: 150,
              averageTimePerQuestion: 15,
              performanceTag: "EXCELLENT",
              date: new Date().toISOString(),
              userAnswers: { 0: 1, 1: 0, 2: 2, 3: 1 },
              wrongQuestions: [
                  { qIndex: 1, question: "What is the first law of thermodynamics?" },
                  { qIndex: 3, question: "Calculate the entropy change for the reversible process." }
              ],
              topicAnalysis: {
                  "First Law": { total: 4, correct: 3, percentage: 75 },
                  "Entropy": { total: 6, correct: 5, percentage: 83 }
              }
          });

          setState(prev => ({
              ...prev,
              user: {
                 id: "mock-user",
                 role: "STUDENT",
                 name: "Jules (Testing)",
                 isPremium: true,
                 profileCompleted: true
              } as any
          }));
      }
  }, []);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('nst_dark_mode');
    if (saved !== null) return saved === 'true';
    // No user preference saved — follow OS setting
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      // Default to blue theme when auto-detecting dark mode from OS
      if (!localStorage.getItem('nst_dark_theme_type')) {
        localStorage.setItem('nst_dark_theme_type', 'blue');
      }
    }
    return prefersDark;
  });

  // ABANDONMENT DISCOUNT STATE
  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);

  useEffect(() => {
      // Flash sale popup disabled — discount is now delivered via mailbox (inbox) when user visits store
      setIsFlashSaleActive(false);
  }, []);

  useEffect(() => {
      // Clean up any old mode classes before applying the new one.
      document.documentElement.classList.remove('dark-mode', 'dark-mode-blue', 'dark-mode-black');
      if (darkMode) {
         // Default to Black AMOLED if not set.
         const themeType = localStorage.getItem('nst_dark_theme_type') || 'black';
         document.documentElement.classList.add('dark-mode');
         document.documentElement.classList.add(themeType === 'blue' ? 'dark-mode-blue' : 'dark-mode-black');
      }
      localStorage.setItem('nst_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Listen for OS-level dark mode changes and sync automatically
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-follow OS if user hasn't explicitly set a preference
      if (localStorage.getItem('nst_dark_mode') === null) {
        if (e.matches && !localStorage.getItem('nst_dark_theme_type')) {
          localStorage.setItem('nst_dark_theme_type', 'blue');
        }
        setDarkMode(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [state, setState] = useState<AppState>({
    user: null,
    originalAdmin: null,
    view: 'BOARDS',
    selectedBoard: null,
    selectedClass: null,
    selectedStream: null,
    selectedSubject: null,
    selectedChapter: null,
    chapters: [],
    lessonContent: null,
    loading: false,
    error: null,
    language: 'English',
    globalMessage: null,
    settings: {
        appName: 'IIC',
        appShortName: 'IIC',
        aiName: 'IIC AI',
        themeColor: '#3b82f6',
        customCSS: '',
        apiKeys: [],
        welcomeTitle: 'Unlock Smart Learning', 
        welcomeMessage: 'Experience the power of AI-driven education. Our AI filters out the noise of traditional textbooks to deliver only the essential, high-yield topics you need for success. Study smarter, not harder.',
        marqueeLines: ["Welcome to Leon Classes", "Learn Smart", "Contact Admin for Credits"], 
        liveMessage1: 'Experience the power of AI-driven education.', 
        liveMessage2: 'Start learning today!', 
        bannerConfig: {
            top: { text: 'Experience the power of AI-driven education.', enabled: true, autoHideSeconds: 0, bgColor: '#dc2626', textColor: '#ffffff' },
            bottom: { text: 'Start learning today!', enabled: true, autoHideSeconds: 0, bgColor: '#2563eb', textColor: '#ffffff' }
        },
        wheelRewards: [
            { id: '1', type: 'COINS', amount: 0, label: '0 Coins', value: 0 },
            { id: '2', type: 'COINS', amount: 1, label: '1 Coin', value: 1 },
            { id: '3', type: 'COINS', amount: 2, label: '2 Coins', value: 2 },
            { id: '4', type: 'COINS', amount: 5, label: '5 Coins', value: 5 }
        ] as any,
        chatCost: 1,
        dailyReward: 3,
        signupBonus: 50,
        isChatEnabled: true,
        isGameEnabled: true, 
        allowSignup: true,
        loginMessage: '',
        allowedClasses: ['6','7','8','9','10','11','12'],
        storageCapacity: '100 GB',
        isPaymentEnabled: true, 
        upiId: '',
        upiName: '',
        qrCodeUrl: '',
        paymentInstructions: '',
        supportEmail: 'nadiman0636indo@gmail.com',
        footerText: '',
        showFooter: true,
        footerColor: '',
        packages: [
            { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
            { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
            { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
            { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
            { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
            { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
            { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
        ],
        subscriptionPlans: [
            { id: 'weekly', name: 'Weekly', duration: '7 days', basicPrice: 49, basicOriginalPrice: 99, ultraPrice: 79, ultraOriginalPrice: 149, features: ['Premium Content'], popular: false },
            { id: 'monthly', name: 'Monthly', duration: '30 days', basicPrice: 149, basicOriginalPrice: 299, ultraPrice: 199, ultraOriginalPrice: 399, features: ['Everything in Weekly', 'Live Chat'], popular: true },
            { id: 'quarterly', name: 'Quarterly', duration: '3 months', basicPrice: 399, basicOriginalPrice: 799, ultraPrice: 499, ultraOriginalPrice: 999, features: ['Everything in Monthly', 'Priority Support'], popular: false },
            { id: 'yearly', name: 'Yearly', duration: '365 days', basicPrice: 999, basicOriginalPrice: 1999, ultraPrice: 1499, ultraOriginalPrice: 2999, features: ['Everything in Quarterly', 'Priority Support'], popular: false },
            { id: 'lifetime', name: 'Lifetime', duration: 'Forever', basicPrice: 4999, basicOriginalPrice: 9999, ultraPrice: 7499, ultraOriginalPrice: 14999, features: ['VIP Status'], popular: true }
        ],
        startupAd: {
            enabled: false,
            duration: 2,
            title: "Premium Features",
            features: ["AI Notes Generator", "MCQ Practice", "Live Chat Support"],
            bgColor: "#1e293b",
            textColor: "#ffffff"
        },
        engagementRewards: [
            { id: 'def-1', seconds: 600, type: 'COINS', amount: 2, label: '10 Mins Study: 2 Coins', enabled: true },
            { id: 'def-2', seconds: 1800, type: 'COINS', amount: 4, label: '30 Mins Study: 4 Coins', enabled: true },
            { id: 'def-3', seconds: 3600, type: 'SUBSCRIPTION', subTier: 'WEEKLY', subLevel: 'BASIC', durationHours: 4, label: '1 Hour Study: Free Basic Sub (4h)', enabled: true },
            { id: 'def-4', seconds: 7200, type: 'SUBSCRIPTION', subTier: 'LIFETIME', subLevel: 'ULTRA', durationHours: 4, label: '2 Hours Study: Free Ultra Sub (4h)', enabled: true }
        ],
        prizeRules: [
            { id: 'def-daily', category: 'DAILY_CHALLENGE', minQuestions: 0, minPercentage: 90, rewardType: 'SUBSCRIPTION', rewardSubTier: 'MONTHLY', rewardSubLevel: 'ULTRA', rewardDurationHours: 720, label: 'Score 90% in Daily Challenge', enabled: true },
            { id: 'def-weekly', category: 'WEEKLY_TEST', minQuestions: 0, minPercentage: 0, rewardType: 'SUBSCRIPTION', rewardSubTier: 'WEEKLY', rewardSubLevel: 'BASIC', rewardDurationHours: 24, label: 'Participate in Weekly Test', enabled: true }
        ]
    }
  });

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [tempSelectedChapter, setTempSelectedChapter] = useState<Chapter | null>(null);
  const [generationDataReady, setGenerationDataReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // NEW
  const [loadingMessage, setLoadingMessage] = useState<string>(''); // NEW
  const [activeWeeklyTest, setActiveWeeklyTest] = useState<WeeklyTest | null>(null);
  const [studentTab, setStudentTab] = useState<StudentTab>('HOME');

  // BANNER STATE
  const [showTopBanner, setShowTopBanner] = useState(true);
  const [showBottomBanner, setShowBottomBanner] = useState(true);
  // IN-APP BROWSER (banner tap → iframe overlay instead of new tab)
  const [inAppBrowserUrl, setInAppBrowserUrl] = useState<string | null>(null);

  // Global 3D cards — toggle class on <html> when admin setting changes
  useEffect(() => {
      if (state.settings?.globalCards3D) {
          document.documentElement.classList.add('global-cards-3d');
      } else {
          document.documentElement.classList.remove('global-cards-3d');
      }
  }, [state.settings?.globalCards3D]);

  // BANNER AUTO-HIDE LOGIC
  useEffect(() => {
      const top = state.settings.bannerConfig?.top;
      setShowTopBanner(true);
      if (top?.enabled && top.autoHideSeconds > 0) {
          const timer = setTimeout(() => setShowTopBanner(false), top.autoHideSeconds * 1000);
          return () => clearTimeout(timer);
      }
  }, [state.settings.bannerConfig?.top?.autoHideSeconds, state.settings.bannerConfig?.top?.enabled, state.settings.bannerConfig?.top?.text, studentTab]);

  useEffect(() => {
      const bottom = state.settings.bannerConfig?.bottom;
      setShowBottomBanner(true);
      if (bottom?.enabled && bottom.autoHideSeconds > 0) {
          const timer = setTimeout(() => setShowBottomBanner(false), bottom.autoHideSeconds * 1000);
          return () => clearTimeout(timer);
      }
  }, [state.settings.bannerConfig?.bottom?.autoHideSeconds, state.settings.bannerConfig?.bottom?.enabled, state.settings.bannerConfig?.bottom?.text, studentTab]);

  useEffect(() => {
    storage.getItem<StudentTab>('nst_active_student_tab').then(saved => {
        // Always start from HOME — never restore a deep content view on app open
        if (saved && saved !== 'COURSES' && saved !== 'PDF' && saved !== 'MCQ' && saved !== 'VIDEO' && saved !== 'AUDIO') {
            setStudentTab(saved);
        }
    });
  }, []);

    // Active reward generated by study-timer (pushed to inbox when created)
    const [activeReward, setActiveReward] = useState<PendingReward | null>(null);

  useEffect(() => {
    if (studentTab === 'HOME' || studentTab === 'HOMEWORK' || studentTab === 'HISTORY' || studentTab === 'PROFILE' || studentTab === 'COMMUNITY_SUPPORT') {
      setShowTopBanner(true);
      setShowBottomBanner(true);
    }
  }, [studentTab]);

  useEffect(() => {
    storage.setItem('nst_active_student_tab', studentTab);
  }, [studentTab]);
  const [streakLoginPopup, setStreakLoginPopup] = useState<{newStreak: number; prevStreak: number; isNewRecord: boolean} | null>(null);
  const [levelUpNotif, setLevelUpNotif] = useState<{level: number; label: string; emoji: string; color: string} | null>(null);
  const [lastTestResult, setLastTestResult] = useState<MCQResult | null>(null);
  const [lastTestQuestions, setLastTestQuestions] = useState<MCQItem[] | null>(null); // NEW: For granular analysis
  
  // CUSTOM DIALOG STATE (GLOBAL)
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // CREDIT CONFIRMATION STATE
  const [creditModal, setCreditModal] = useState<{
      isOpen: boolean;
      cost: number;
      title: string;
      onConfirm: (autoEnabled: boolean) => void;
  } | null>(null);

  // GLOBAL STUDY TIMER
  const [dailyStudySeconds, setDailyStudySeconds] = useState(0);
  
  // FULL SCREEN MODE (Hides Header/Footer/Dock)
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLessonImmersive, setIsLessonImmersive] = useState(false);
  const [popupQueue, setPopupQueue] = useState<('TRACKER' | 'CHALLENGE' | 'WELCOME')[]>([]);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false); // NEW
  const [loadingContentType, setLoadingContentType] = useState<ContentType | undefined>(undefined); // NEW

  // --- VERSION CONTROL INIT ---
  useEffect(() => {
      const storedVersion = localStorage.getItem('nst_app_version');
      // If no version stored, OR if the Code Version (APP_VERSION) is newer/different than stored,
      // update the storage. This handles the case where user installs a new update.
      if (!storedVersion || storedVersion !== APP_VERSION) {
          localStorage.setItem('nst_app_version', APP_VERSION);
      }
  }, []);

  // --- AUTO CLEANUP GROQ KEYS ---
  useEffect(() => {
      const deletedKeys = state.settings.deletedGroqKeys || [];
      if (deletedKeys.length > 0) {
          const now = Date.now();
          const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
          const newDeletedKeys = deletedKeys.filter(k => (now - k.deletedAt) <= ninetyDaysMs);
          
          if (newDeletedKeys.length !== deletedKeys.length) {
              const updatedSettings = { ...state.settings, deletedGroqKeys: newDeletedKeys };
              setState(prev => ({ ...prev, settings: updatedSettings }));
              localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
          }
      }
  }, [state.settings.deletedGroqKeys]);

  // --- REWARD CHECKER (Login & Pending) ---
  const recordActivity = (type: UsageHistoryEntry['type'], itemTitle: string, amount?: number, extra?: any) => {
    if (!state.user) return;
    const entry: UsageHistoryEntry = {
        id: `act-${Date.now()}`,
        type,
        itemId: extra?.itemId || 'internal',
        itemTitle,
        subject: extra?.subject || 'General',
        amount: amount || 0,
        timestamp: new Date().toISOString(),
        ...extra
    };
    const updatedUser = { 
        ...state.user, 
        usageHistory: [entry, ...(state.user.usageHistory || [])].slice(0, 100)
    };
    setState(prev => ({ ...prev, user: updatedUser }));
    saveUserToLive(updatedUser);
  };

  useEffect(() => {
    (window as any).recordActivity = recordActivity;
  }, [state.user?.id]);

  // Level-up detection: fire notification when user crosses a level threshold
  const prevLevelRef = React.useRef<number>(0);
  useEffect(() => {
    if (!state.user) return;
    const info = getLevelInfo(state.user.totalScore || 0);
    const prev = prevLevelRef.current;
    if (prev > 0 && info.level > prev) {
      const key = `nst_levelup_notif_${info.level}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        setLevelUpNotif({ level: info.level, label: info.label, emoji: info.emoji, color: info.color });
      }
    }
    prevLevelRef.current = info.level;
  }, [state.user?.totalScore]);

  useEffect(() => {
      if (!state.user) return;
      const today = new Date().toDateString();
      const now = new Date();
      let updatedUser = { ...state.user };
      let hasUpdates = false;
      let newReward: PendingReward | null = null;

      // STREAK LOGIC (Strict Date Comparison)
      const lastLoginRaw = state.user.lastLoginDate ? new Date(state.user.lastLoginDate) : null;
      const lastLoginDateString = lastLoginRaw ? lastLoginRaw.toDateString() : '';

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Update Login Date if not today
      if (lastLoginDateString !== today) {
          updatedUser.lastLoginDate = new Date().toISOString();
          hasUpdates = true;

          if (lastLoginDateString === yesterday.toDateString()) {
              // Consecutive Login: Increment
              const prev = updatedUser.streak || 0;
              updatedUser.streak = prev + 1;
              // SCORE INCREMENT: +10 per consecutive day (+ score boost event %)
              const _sbeBoost = (state.settings?.scoreBoostEvent?.enabled)
                  ? ((state.settings.scoreBoostEvent as any).boostPercent / 100) : 0;
              updatedUser.totalScore = (updatedUser.totalScore || 0) + Math.round(10 * (1 + _sbeBoost));
              updatedUser.lastScoreDate = new Date().toISOString();
              // Track longest streak & award 100 credits for new record
              const prevLongest = updatedUser.longestStreak || 0;
              if (updatedUser.streak > prevLongest) {
                  updatedUser.longestStreak = updatedUser.streak;
                  if (prevLongest > 0) {
                      // New record bonus: 100 credits
                      updatedUser.credits = (updatedUser.credits || 0) + 100;
                  }
              }
              if (localStorage.getItem('nst_streak_popup_date') !== today) {
                  localStorage.setItem('nst_streak_popup_date', today);
                  setStreakLoginPopup({ newStreak: updatedUser.streak, prevStreak: prev, isNewRecord: updatedUser.streak > prevLongest && prevLongest > 0 });
              }
              
          } else {
              // Streak Broken or First Login: Reset
              const prev = updatedUser.streak || 0;
              updatedUser.streak = 1;
              // Update longestStreak if first time
              if (!updatedUser.longestStreak) updatedUser.longestStreak = 1;
              if (localStorage.getItem('nst_streak_popup_date') !== today) {
                  localStorage.setItem('nst_streak_popup_date', today);
                  setStreakLoginPopup({ newStreak: 1, prevStreak: prev > 1 ? prev : 0, isNewRecord: false });
              }
              // SCORE PENALTY: Streak break → drop 1 level (import-free inline logic)
              if (prev > 1) {
                  const thresholds = [0, 100, 300, 700, 2000, 5000, 10000, 20000];
                  const cs = updatedUser.totalScore || 0;
                  let lvl = 0;
                  for (let i = 0; i < thresholds.length; i++) { if (cs >= thresholds[i]) lvl = i; else break; }
                  if (lvl > 0) updatedUser.totalScore = thresholds[lvl - 1];
              }
          }

          // === WEEKLY LEVEL BONUS (L9–L15) — koi bhi Sunday login pe, ek baar per week ===
          if (now.getDay() === 0) { // Sunday
              const _wlvl = getLevelInfo(updatedUser.totalScore || 0).level;
              if (_wlvl >= 9) {
                  const _wKey  = now.toISOString().split('T')[0]; // Sunday YYYY-MM-DD
                  const _wLS   = `nst_weekly_lvl_bonus_${state.user.id}_${_wKey}`;
                  const _wId   = `wlvlbonus-${state.user.id}-${_wKey}`;
                  const _wDupe = (updatedUser.inbox || []).some((m: any) => m.id === _wId);
                  if (!localStorage.getItem(_wLS) && !_wDupe) {
                      localStorage.setItem(_wLS, '1');
                      const _wBonusMap: Record<number, number> = {
                          9: 100, 10: 150, 11: 200, 12: 300, 13: 500, 14: 700, 15: 1000,
                      };
                      const _wAmt  = _wBonusMap[Math.min(_wlvl, 15)] ?? 100;
                      const _wExp  = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 ghante
                      const _wMsg: any = {
                          id: _wId,
                          text: `🎁 Level ${_wlvl} Weekly Sunday Bonus!\n\nYour special reward for this week is here!\n\n💰 ${_wAmt} Bonus Credits — expires in 12 hours\n\nThese credits can be used in Store, MCQ unlock, Theme Studio and more!\n\nTap "Claim" below.`,
                          date: new Date().toISOString(),
                          read: false,
                          type: 'GIFT',
                          gift: { type: 'CREDITS', value: _wAmt },
                          expiresAt: _wExp,
                          isClaimed: false,
                      };
                      updatedUser.inbox = [_wMsg, ...(updatedUser.inbox || [])];
                      hasUpdates = true;
                  }
              }
          }
      }

      // 1. Weekly Sunday Login Bonus — sirf Sunday ke first login pe, aur sirf jab streak toot gayi ho
      const lastRewardDate = state.user.lastLoginRewardDate ? new Date(state.user.lastLoginRewardDate).toDateString() : '';
      const _isSunday = now.getDay() === 0; // 0 = Sunday
      // Streak toot gayi check — last login na aaj hai, na kal tha
      const _streakBrokenForBonus = !!(state.user.lastLoginDate &&
          lastLoginDateString !== yesterday.toDateString() &&
          lastLoginDateString !== today);

      // Layer-2 guard: localStorage per-device per-user key (survives tab close/reopen, shared across tabs)
      const _bonusLSKey = `nst_wkbonus_${state.user.id}_${today}`;
      // Layer-3 guard: inbox already has this reward? (catches cross-device race window)
      const _bonusInboxId = `login-bonus-${today}`;
      const _alreadyInInbox = (updatedUser.inbox || []).some((m: any) => m.id === _bonusInboxId);

      if (_isSunday && _streakBrokenForBonus
          && lastRewardDate !== today          // Layer-1: Firebase lastLoginRewardDate
          && !localStorage.getItem(_bonusLSKey) // Layer-2: localStorage same-device all-tabs
          && !_alreadyInInbox                  // Layer-3: inbox dedup
      ) {
          // Claim locks — set ALL guards immediately before any async work
          localStorage.setItem(_bonusLSKey, '1');
          updatedUser.lastLoginRewardDate = new Date().toISOString(); // written to Firebase immediately
          hasUpdates = true;

          // Grant Bonus based on Tier — push straight to inbox
          let bonusAmount = state.settings.loginBonusConfig?.freeBonus ?? 2;
          if (state.user.subscriptionTier !== 'FREE') {
              if (state.user.subscriptionLevel === 'BASIC') bonusAmount = state.settings.loginBonusConfig?.basicBonus ?? 5;
              if (state.user.subscriptionLevel === 'ULTRA') bonusAmount = state.settings.loginBonusConfig?.ultraBonus ?? 10;
          }
          // Add level-based bonus credits (L6: +2, L7: +3, L8: +5)
          const _loginUserLevel = getLevelInfo(state.user.totalScore || 0).level;
          const _loginLvlBonus  = getLevelLimitBonus(_loginUserLevel);
          bonusAmount += _loginLvlBonus.bonusLoginCredits;

          const loginExpiryHours = state.settings.rewardExpiryHours ?? 12;
          newReward = {
              id: _bonusInboxId,
              type: 'COINS',
              amount: bonusAmount,
              label: '🗓️ Sunday Streak Recovery Bonus',
              expiresAt: new Date(now.getTime() + loginExpiryHours * 60 * 60 * 1000).toISOString()
          };
      }

      // 2. Check Pending Unlocks (Prizes) → push to inbox
      if (!newReward && updatedUser.pendingRewards && updatedUser.pendingRewards.length > 0) {
          const unlockIndex = updatedUser.pendingRewards.findIndex(r => !r.unlockDate || new Date(r.unlockDate) <= now);
          if (unlockIndex !== -1) {
              const item = updatedUser.pendingRewards[unlockIndex];
              newReward = item;
              const newPending = [...updatedUser.pendingRewards];
              newPending.splice(unlockIndex, 1);
              updatedUser.pendingRewards = newPending;
              hasUpdates = true;
          }
      }

      // Push ALL rewards to inbox (no popup) and show a toast
      const pushRewardToInbox = (reward: PendingReward) => {
          const existingInbox = updatedUser.inbox || [];
          const alreadyInInbox = existingInbox.some(m => m.id === reward.id);
          if (alreadyInInbox) return;
          const rewardText = reward.type === 'COINS'
              ? `${reward.label}: +${reward.amount} Credits received!`
              : `${reward.label}: ${reward.subLevel || 'BASIC'} Access unlocked!`;
          const inboxMsg: any = {
              id: reward.id,
              text: rewardText,
              date: new Date().toISOString(),
              read: false,
              type: 'REWARD',
              isClaimed: false,
              expiresAt: reward.expiresAt,
          };
          if (reward.type === 'COINS') {
              inboxMsg.gift = { type: 'CREDITS', value: reward.amount || 0 };
          } else {
              inboxMsg.gift = {
                  type: 'SUBSCRIPTION',
                  value: `${reward.subTier || 'WEEKLY'}_${reward.subLevel || 'BASIC'}`,
                  durationHours: reward.durationHours || 4,
              };
          }
          updatedUser.inbox = [inboxMsg, ...existingInbox];
          hasUpdates = true;
          setTimeout(() => setAlertConfig({ isOpen: true, message: `🎁 ${reward.label} received! Go to Mail → Rewards to claim.` }), 1000);
      };

      if (hasUpdates || newReward) {
          if (newReward) {
              pushRewardToInbox(newReward);
              // ── Random Gift alongside login bonus (dice roll) ──
              const rgCfg = state.settings.loginBonusConfig;
              if (rgCfg?.randomGiftEnabled && (rgCfg.randomGiftOptions || []).length > 0) {
                  const chance = rgCfg.randomGiftChance ?? 20;
                  if (Math.random() * 100 < chance) {
                      const options = rgCfg.randomGiftOptions!;
                      const totalWeight = options.reduce((s, o) => s + (o.weight || 1), 0);
                      let rand = Math.random() * totalWeight;
                      let chosen = options[0];
                      for (const opt of options) { rand -= (opt.weight || 1); if (rand <= 0) { chosen = opt; break; } }
                      const rgId = `login-random-gift-${today}`;
                      const expiryHrs = state.settings.rewardExpiryHours ?? 12;
                      if (chosen.type === 'CREDITS') {
                          pushRewardToInbox({ id: rgId, type: 'COINS', amount: chosen.amount || 5, label: chosen.label || '🎲 Lucky Gift!', expiresAt: new Date(now.getTime() + expiryHrs * 60 * 60 * 1000).toISOString() });
                      } else if (chosen.type === 'SUBSCRIPTION') {
                          const hrs = chosen.subTier === 'DAILY' ? 24 : chosen.subTier === 'WEEKLY' ? 168 : 720;
                          pushRewardToInbox({ id: rgId, type: 'SUBSCRIPTION', label: chosen.label || '🎲 Lucky Subscription!', subTier: chosen.subTier || 'WEEKLY', subLevel: chosen.subLevel || 'BASIC', durationHours: hrs, expiresAt: new Date(now.getTime() + expiryHrs * 60 * 60 * 1000).toISOString() });
                      } else if (chosen.type === 'DISCOUNT') {
                          const rgIdD = rgId + '-disc';
                          if (!(updatedUser.inbox || []).some((m: any) => m.id === rgIdD)) {
                              const discMsg: any = { id: rgIdD, text: `🎲 Lucky Login Gift!\n\n${chosen.label || 'You received a special discount!'}\n\n🏷️ Today's login earned you a ${chosen.discountPercent || 10}% store discount!\n\nHead to the Store and enjoy!`, date: new Date().toISOString(), read: false, type: 'TEXT' };
                              updatedUser.inbox = [discMsg, ...(updatedUser.inbox || [])]; hasUpdates = true;
                          }
                      } else if (chosen.type === 'EFFECT') {
                          const rgIdE = rgId + '-eff';
                          if (!(updatedUser.inbox || []).some((m: any) => m.id === rgIdE)) {
                              const effMsg: any = { id: rgIdE, text: `🎲 Lucky Effect Gift!\n\n${chosen.label || 'You received a special animation effect!'}\n\n✨ Your animation: ${chosen.effectId || ''}\n\nEnter it in the Redeem section or contact admin!`, date: new Date().toISOString(), read: false, type: 'TEXT' };
                              updatedUser.inbox = [effMsg, ...(updatedUser.inbox || [])]; hasUpdates = true;
                          }
                      }
                  }
              }
          }
          // ── Streak Milestone Rewards (3, 7, 14, 30 days) ──
          const currentStreak = updatedUser.streak || 0;
          const STREAK_MILESTONES: Record<number, number> = { 3: 25, 7: 50, 14: 120, 30: 300 };
          if (STREAK_MILESTONES[currentStreak] !== undefined) {
              const milestoneCoins = STREAK_MILESTONES[currentStreak];
              const milestoneId = `streak-milestone-${currentStreak}-${today.replace(/\s/g, '-')}`;
              const milestoneLabel = `🔥 ${currentStreak}-Day Streak Reward!`;
              const expiryHrs = state.settings.rewardExpiryHours ?? 24;
              if (!(updatedUser.inbox || []).some((m: any) => m.id === milestoneId)) {
                  pushRewardToInbox({
                      id: milestoneId,
                      type: 'COINS',
                      amount: milestoneCoins,
                      label: milestoneLabel,
                      expiresAt: new Date(now.getTime() + expiryHrs * 60 * 60 * 1000).toISOString(),
                  });
              }
          }

          if (hasUpdates) {
              // SAFE IMPERSONATION: Only save if NOT impersonating
              if (!state.originalAdmin) {
                  localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                  saveUserToLive(updatedUser);
              }
              setState(prev => ({...prev, user: updatedUser}));
          }
      }
  }, [state.user?.id, state.user?.lastLoginRewardDate, state.originalAdmin]);

  // --- GLOBAL ERROR HANDLERS (app crash prevention) ---
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      logErrorToFirebase(event.error || new Error(event.message || 'Unknown runtime error'), {
        type: 'runtime',
      }).catch(() => {});
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? 'Unhandled Promise Rejection'));
      logErrorToFirebase(err, { type: 'promise' }).catch(() => {});
    };
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Sync current user into errorLogger so logs include who crashed
  useEffect(() => {
    if (state.user) {
      setErrorLoggerUser(state.user.id, state.user.name ?? null, state.user.role ?? null);
    } else {
      setErrorLoggerUser(null, null, null);
    }
  }, [state.user?.id, state.user?.name, state.user?.role]);

  // --- ONLINE/OFFLINE DETECTOR & SYNC ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial Sync Check
    if (navigator.onLine) handleOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background Sync Logic
  useEffect(() => {
      if (isOnline) {
          const pendingStr = localStorage.getItem('nst_pending_sync_results');
          if (pendingStr) {
              try {
                  const pending = JSON.parse(pendingStr);
                  if (Array.isArray(pending) && pending.length > 0) {
                      pending.forEach(async (item) => {
                          if (item.type === 'HISTORY') {
                              await saveUserHistory(item.userId, item.data);
                          }
                      });
                      localStorage.removeItem('nst_pending_sync_results');
                      setAlertConfig({isOpen: true, message: "Offline results synced successfully!"});
                  }
              } catch (e) {
                  console.error("Sync failed", e);
              }
          }
      }
  }, [isOnline]);

  // --- LIVE SETTINGS & USER SYNC (REALTIME) ---
  useEffect(() => {
      let unsubscribeUser: (() => void) | undefined;

      if (state.user && !state.originalAdmin) {
          unsubscribeUser = subscribeToUser(state.user.id, (cloudUser) => {
              // Account deleted by admin — force logout immediately
              if (!cloudUser) {
                  localStorage.removeItem('nst_current_user');
                  localStorage.removeItem('nst_users');
                  setState(prev => ({ ...prev, user: null, view: 'AUTH' }));
                  return;
              }
              if (cloudUser) {
                  setState(prev => {
                      if (!prev.user) return prev;

                      const mergedUser = { ...prev.user, ...cloudUser };

                      // CRITICAL FIX: The Firestore 'users/{uid}' document DOES NOT contain bulky data.
                      // We must preserve the bulky data from the current state so it doesn't get wiped by the core sync.
                      if (!cloudUser.hasOwnProperty('mcqHistory')) mergedUser.mcqHistory = prev.user.mcqHistory;
                      if (!cloudUser.hasOwnProperty('testResults')) mergedUser.testResults = prev.user.testResults;
                      if (!cloudUser.hasOwnProperty('progress')) mergedUser.progress = prev.user.progress;
                      if (!cloudUser.hasOwnProperty('usageHistory')) mergedUser.usageHistory = prev.user.usageHistory;
                      if (!cloudUser.hasOwnProperty('inbox')) mergedUser.inbox = prev.user.inbox;
                      if (!cloudUser.hasOwnProperty('topicStrength')) mergedUser.topicStrength = prev.user.topicStrength;
                      if (!cloudUser.hasOwnProperty('subscriptionHistory')) mergedUser.subscriptionHistory = prev.user.subscriptionHistory;
                      if (!cloudUser.hasOwnProperty('activeSubscriptions')) mergedUser.activeSubscriptions = prev.user.activeSubscriptions;
                      if (!cloudUser.hasOwnProperty('pendingRewards')) mergedUser.pendingRewards = prev.user.pendingRewards;
                      if (!cloudUser.hasOwnProperty('redeemedCodes')) mergedUser.redeemedCodes = prev.user.redeemedCodes;
                      if (!cloudUser.hasOwnProperty('unlockedContent')) mergedUser.unlockedContent = prev.user.unlockedContent;
                      if (!cloudUser.hasOwnProperty('dailyRoutine')) mergedUser.dailyRoutine = prev.user.dailyRoutine;

                      // PRESERVE ADMIN OVERRIDES (Fix for White Screen demotion)
                      if (prev.user.role === 'ADMIN' && cloudUser.role !== 'ADMIN') {
                          mergedUser.role = 'ADMIN';
                      }
                      if (prev.user.role === 'SUB_ADMIN' && cloudUser.role !== 'SUB_ADMIN' && cloudUser.role !== 'ADMIN') {
                          mergedUser.role = 'SUB_ADMIN';
                      }
                      // PRESERVE TEACHER ROLE (if code was applied during signup but slow sync)
                      if (prev.user.role === 'TEACHER' && cloudUser.role !== 'TEACHER') {
                          mergedUser.role = 'TEACHER';
                      }

                      if (JSON.stringify(prev.user) !== JSON.stringify(mergedUser)) {
                          localStorage.setItem('nst_current_user', JSON.stringify(mergedUser));
                          return { ...prev, user: mergedUser };
                      }
                      return prev;
                  });
              }
          });
      }

      // Subscribe to Firebase Settings Updates
      const unsubscribeSettings = subscribeToSettings((newSettings) => {
          if (newSettings) {
              setState(prev => {
                  const hasChanges = JSON.stringify(prev.settings) !== JSON.stringify({...prev.settings, ...newSettings});
                  if (hasChanges) {
                      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
                      return {...prev, settings: {...prev.settings, ...newSettings}};
                  }
                  return prev;
              });

              // FORCE REFRESH LOGIC
              // NOTE: localStorage.setItem always coerces to string, so we MUST
              // compare as strings — otherwise number vs string mismatch causes
              // an infinite reload loop on every settings snapshot.
              // Also rate-limit: never reload more than once every 60 seconds
              // (this is a hard safety net against any reload-loop bug).
              if (newSettings.forceRefreshTimestamp) {
                  const lastRefresh = localStorage.getItem('nst_last_refresh_ts');
                  const incoming = String(newSettings.forceRefreshTimestamp);
                  if (lastRefresh !== incoming) {
                      localStorage.setItem('nst_last_refresh_ts', incoming);
                      // Only actually reload if we had a previous value (i.e. admin
                      // pushed a new refresh). On very first load there's no prior
                      // value — just record it and skip the reload to avoid a loop.
                      if (lastRefresh !== null) {
                          const lastReloadAt = Number(localStorage.getItem('nst_last_reload_at') || '0');
                          const nowMs = Date.now();
                          if (nowMs - lastReloadAt > 60_000) {
                              localStorage.setItem('nst_last_reload_at', String(nowMs));
                              window.location.reload();
                          }
                      }
                  }
              }

              // VERSION CHECK LOGIC
              const currentVersion = localStorage.getItem('nst_app_version') || APP_VERSION;
              if (newSettings.latestVersion && newSettings.latestVersion !== currentVersion) {
                  if (newSettings.latestVersion > currentVersion) {
                      const now = Date.now();
                      let isUpdateAvailable = true;

                      // 1. Check Launch Date
                      if (newSettings.launchDate) {
                          const launchTime = new Date(newSettings.launchDate).getTime();
                          if (now < launchTime) isUpdateAvailable = false;
                      }

                      if (isUpdateAvailable) {
                          let shouldShow = false;

                          // A. Calculate Deadline for FORCE UPDATE
                          let deadline = 0;

                          // Use Launch Date if available, else First Seen
                          let referenceTime = newSettings.launchDate ? new Date(newSettings.launchDate).getTime() : 0;

                          if (!referenceTime) {
                              // If no launch date, use first seen logic
                              const key = `nst_update_first_seen_${newSettings.latestVersion}`;
                              const firstSeen = localStorage.getItem(key);
                              if (!firstSeen) {
                                  referenceTime = now;
                                  localStorage.setItem(key, now.toString());
                              } else {
                                  referenceTime = parseInt(firstSeen);
                              }
                          }

                          // Calculate Grace Duration
                          let graceDuration = 0;
                          if (newSettings.updateGracePeriod) {
                              graceDuration = (newSettings.updateGracePeriod.days * 24 * 60 * 60 * 1000) +
                                              (newSettings.updateGracePeriod.hours * 60 * 60 * 1000) +
                                              (newSettings.updateGracePeriod.minutes * 60 * 1000) +
                                              (newSettings.updateGracePeriod.seconds * 1000);
                          } else {
                              graceDuration = (newSettings.updateGracePeriodDays || 7) * 24 * 60 * 60 * 1000;
                          }

                          deadline = referenceTime + graceDuration;

                          // If Expired => FORCE SHOW (Always)
                          if (now >= deadline) {
                              shouldShow = true;
                          } else {
                              // If NOT Expired => Check Frequency (Recurrence)
                              const lastDismissedStr = localStorage.getItem(`nst_update_dismissed_${newSettings.latestVersion}`);
                              if (!lastDismissedStr) {
                                  shouldShow = true; // First time seeing it (since dismissal reset)
                              } else {
                                  const lastDismissed = parseInt(lastDismissedStr);
                                  let freqDuration = 0;

                                  if (newSettings.updatePopupFrequency) {
                                      const { value, unit } = newSettings.updatePopupFrequency;
                                      const multipliers: Record<string, number> = {
                                          seconds: 1000,
                                          minutes: 60 * 1000,
                                          hours: 60 * 60 * 1000,
                                          days: 24 * 60 * 60 * 1000,
                                          months: 30 * 24 * 60 * 60 * 1000,
                                          years: 365 * 24 * 60 * 60 * 1000
                                      };
                                      freqDuration = value * (multipliers[unit] || multipliers.hours);
                                  } else {
                                      // Default to every 6 hours if not configured
                                      freqDuration = 6 * 60 * 60 * 1000;
                                  }

                                  if (now - lastDismissed >= freqDuration) {
                                      shouldShow = true;
                                  }
                              }
                          }

                          if (shouldShow) setShowUpdatePopup(true);
                      }
                  }
              }
          }
      });
      return () => {
          if (unsubscribeSettings) unsubscribeSettings();
          if (unsubscribeUser) unsubscribeUser();
      };
  }, [state.user?.id, state.originalAdmin]);

  // --- SYNC USER PROFILE ON LOAD (ENSURE PREMIUM UPDATE VISIBLE) ---
  useEffect(() => {
      if (state.user && !state.originalAdmin) {
          // Sync Saved Notes History First
          getUserSavedNotes(state.user.id).then(async savedNotes => {
              if (savedNotes && savedNotes.length > 0) {
                  // Sort them chronologically and ensure they are populated
                  savedNotes.sort((a: any, b: any) => new Date(a.dateCreated || a.date || 0).getTime() - new Date(b.dateCreated || b.date || 0).getTime());
                  await storage.setItem('nst_user_history', savedNotes);
              }
          });

          getUserData(state.user.id).then(fetchedCloudUser => {
             if (fetchedCloudUser) {
                 // Check if cloud has more mcqHistory than local
                 const localHistoryLen = state.user?.mcqHistory?.length || 0;
                 const cloudHistoryLen = fetchedCloudUser.mcqHistory?.length || 0;

                 // If cloud has more data, store it for potential recovery but don't auto-merge
                 if (cloudHistoryLen > localHistoryLen) {
                     setCloudUser(fetchedCloudUser);
                     setShowCloudRecoveryModal(true);
                 } else {
                     // If safe to merge (just profile updates, no history loss)
                     const currentStr = JSON.stringify(state.user);
                     const cloudStr = JSON.stringify(fetchedCloudUser);
                     if (currentStr !== cloudStr) {
                         let mergedUser = { ...state.user, ...fetchedCloudUser };

                         // PRESERVE ADMIN OVERRIDES (Fix for White Screen demotion)
                         if (state.user?.role === 'ADMIN' && fetchedCloudUser.role !== 'ADMIN') {
                             mergedUser.role = 'ADMIN';
                         }
                         if (state.user?.role === 'SUB_ADMIN' && fetchedCloudUser.role !== 'SUB_ADMIN' && fetchedCloudUser.role !== 'ADMIN') {
                             mergedUser.role = 'SUB_ADMIN';
                         }

                         // SUBSCRIPTION EXPIRY FIX: Recalculate after cloud merge so stale
                         // cloud premium data never overrides a locally-expired subscription.
                         if (mergedUser.role !== 'ADMIN' && mergedUser.role !== 'SUB_ADMIN') {
                             mergedUser = recalculateSubscriptionStatus(mergedUser, state.settings);
                         }

                         localStorage.setItem('nst_current_user', JSON.stringify(mergedUser));
                         setState(prev => ({...prev, user: mergedUser}));
                     }
                 }
             }
          });
      }
  }, [state.user?.id, state.originalAdmin]);

  // --- REAL-TIME SUBSCRIPTION CHECK & NOTIFICATIONS ---
  useEffect(() => {
      if (!state.user?.isPremium && !state.user?.subscriptionEndDate) return; // Only check if supposedly premium or has date
      if (state.user?.role === 'ADMIN' || state.user?.role === 'SUB_ADMIN' || state.originalAdmin) return; // PROTECT ADMIN

      const checkExpiry = () => {
          // 1. Recalculate Status (Handles expirations and best tier logic)
          const updatedUser = recalculateSubscriptionStatus(state.user!, state.settings);
          const expiredNow = Boolean(
            state.user?.isPremium &&
            state.user?.subscriptionEndDate &&
            new Date(state.user.subscriptionEndDate).getTime() <= Date.now()
          );

          // Detect Change (Downgrade or Expiry)
          const wasPremium = state.user!.isPremium;
          const isNowPremium = updatedUser.isPremium;

          if (expiredNow || JSON.stringify(updatedUser) !== JSON.stringify(state.user)) {
               // bonusCredits are permanent — do NOT clear on expiry
               localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
               saveUserToLive(updatedUser);
               // Handle Expiry Event (Access Lock)
               if (wasPremium && !isNowPremium) {
                   const freeModes = state.settings.appMode?.allowedModesForFree || ['SCHOOL'];
                   let nextView = state.view;
                   let nextClass = state.selectedClass;

                   if (state.selectedClass === 'COMPETITION' && !freeModes.includes('COMPETITION')) {
                       nextView = 'CLASSES';
                       nextClass = null;
                   }

                   setState(prev => ({
                       ...prev,
                       user: updatedUser,
                       view: nextView as any,
                       selectedClass: nextClass
                   }));
                   const expiredTier = state.user?.subscriptionLevel === 'ULTRA' ? 'MAX (Ultra)' : 'PRO (Basic)';
                   setAlertConfig({isOpen: true, message: `⏳ Aapka ${expiredTier} plan khatam ho gaya. Ab aap Free tier pe hain — sari premium features lock ho gayi hain.`});
              } else {
                   // Just update state silently
                   setState(prev => ({...prev, user: updatedUser}));
               }
          }

          // Note: Expiry warning logic has been migrated and expanded in StudentDashboard.tsx
          // based on settings.popupConfigs. Removing it from App.tsx to prevent duplicate/competing popups.
      };

      checkExpiry(); // Run immediately on mount/user-change
      const interval = setInterval(checkExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
  }, [state.user, state.originalAdmin]);

  useEffect(() => {
      let loadedSettings = state.settings;
      const storedSettings = localStorage.getItem('nst_system_settings');
      if (storedSettings) {
          try {
              const parsed = JSON.parse(storedSettings);
              loadedSettings = { ...state.settings, ...parsed };

              // BACKFILL BANNER CONFIG IF MISSING
              if (!loadedSettings.bannerConfig) {
                  loadedSettings.bannerConfig = {
                      top: { text: loadedSettings.liveMessage1 || 'Experience the power of AI-driven education.', enabled: !!loadedSettings.liveMessage1, autoHideSeconds: 0, bgColor: '#dc2626', textColor: '#ffffff' },
                      bottom: { text: loadedSettings.liveMessage2 || 'Start learning today!', enabled: !!loadedSettings.liveMessage2, autoHideSeconds: 0, bgColor: '#2563eb', textColor: '#ffffff' }
                  };
              }

              setState(prev => ({ 
                  ...prev, 
                  settings: loadedSettings 
              }));

              // --- CACHE CLEANUP (DISABLED) ---
              // Auto cache-clear was causing blank content pages: it wiped localforage
              // so getChapterData had to fall back to RTDB/Firestore, but if the
              // Firebase Auth session was stale those reads failed silently.
              // Cache clearing is now a manual admin action only (Admin Dashboard → Reset Cache).
              // DO NOT re-enable automatic cache clearing here.

          } catch(e) {}
      }
      
      // POPUP QUEUE INITIALIZATION
      const queue: ('TRACKER' | 'CHALLENGE' | 'WELCOME' | 'THREE_TIER')[] = [];
      const loggedInUserStr = localStorage.getItem('nst_current_user');

      setPopupQueue(queue);

    if (loggedInUserStr) {
      try {
        let user: User = JSON.parse(loggedInUserStr);

        // STRICT VALIDATION: Ensure critical fields exist
        if (!user || !user.id || !user.role) {
            console.error("Invalid user object found in storage. Clearing session.");
            localStorage.removeItem('nst_current_user');
            return;
        }

        // RE-ESTABLISH FIREBASE AUTH SESSION on startup.
        // The custom session (nst_current_user) persists across reloads, but the
        // Firebase Auth SDK session may have expired or been cleared. Without an
        // active Firebase Auth user, ALL Firestore/RTDB reads fail with
        // permission-denied — causing blank content pages.
        // We call signInAnonymously here so Firebase Auth is always active when
        // the user is already "logged in" via our custom session.
        auth.currentUser === null && signInAnonymously(auth).catch(e =>
            console.warn('[IIC] Background Firebase Auth restore failed:', e)
        );

        // MIGRATION & RECALCULATION ON LOAD
        if (user.role !== 'ADMIN') {
             user = recalculateSubscriptionStatus(user, loadedSettings);
             // Save back any migration changes immediately
             if (JSON.stringify(user) !== loggedInUserStr) {
                 localStorage.setItem('nst_current_user', JSON.stringify(user));
                 saveUserToLive(user);
             }
        }

        if (!user.progress) user.progress = {};
        if (user.isLocked) { 
            localStorage.removeItem('nst_current_user'); 
            setAlertConfig({isOpen: true, message: "Account Locked. Please contact Admin."}); 
            return; 
        }

        let initialView = 'STUDENT_DASHBOARD';
        
        if ((user.role === 'STUDENT' || user.role === 'TEACHER') && !user.profileCompleted) {
             initialView = 'ONBOARDING';
        }

        // RESET CLASS IF LOCKED (e.g. Competition Mode)
        let safeClass = user.classLevel || null;
        const freeModes = loadedSettings.appMode?.allowedModesForFree || ['SCHOOL'];
        if (!user.isPremium && safeClass === 'COMPETITION' && !freeModes.includes('COMPETITION')) {
            safeClass = null; // Kick out of Competition
            initialView = 'STUDENT_DASHBOARD'; // Default view
        }

        setState(prev => ({ 
          ...prev, 
          user: user, 
          view: initialView as any, 
          selectedBoard: user.board || null, 
          selectedClass: safeClass, 
          selectedStream: user.stream || null, 
          language: user.board === 'BSEB' ? 'Hindi' : 'English'
        }));
      } catch(e) {
        console.error("Error parsing user from localStorage:", e);
        localStorage.removeItem('nst_current_user');
      }
    } else {
    }
  }, []);

  // --- TIMER LOGIC (UPDATED) ---
  useEffect(() => {
    if (!state.user) return;

    // Load initial seconds from storage
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('nst_timer_date');
    const storedSeconds = parseInt(localStorage.getItem('nst_daily_study_seconds') || '0');

    if (storedDate !== today) {
        localStorage.setItem('nst_timer_date', today);
        localStorage.setItem('nst_daily_study_seconds', '0');
        setDailyStudySeconds(0);
    } else {
        setDailyStudySeconds(storedSeconds);
    }

    // TIMER STARTS AUTOMATICALLY ON LOGIN (GLOBAL)
    let interval: any;
    if (state.user) {
        interval = setInterval(() => {
            setDailyStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('nst_daily_study_seconds', next.toString());
                
                // NEW: CHECK FOR DAILY REWARDS (DYNAMIC)
                if (state.user && state.settings.engagementRewards) {
                    const engExpiryHours = state.settings.rewardExpiryHours ?? 12;
                    state.settings.engagementRewards.forEach(reward => {
                        if (reward.enabled && next === reward.seconds) {
                             setActiveReward({
                                id: `rew-${Date.now()}`,
                                type: reward.type,
                                amount: reward.amount,
                                subTier: reward.subTier,
                                subLevel: reward.subLevel,
                                durationHours: reward.durationHours,
                                label: reward.label,
                                expiresAt: new Date(Date.now() + engExpiryHours * 60 * 60 * 1000).toISOString(),
                                // Carry redeem code config if set
                                generateRedeemCode: reward.generateRedeemCode,
                                redeemCodeType: reward.redeemCodeType,
                                redeemCodeAmount: reward.redeemCodeAmount,
                                redeemCodeDiscountPercent: reward.redeemCodeDiscountPercent,
                                redeemCodeSubTier: reward.redeemCodeSubTier,
                                redeemCodeSubLevel: reward.redeemCodeSubLevel,
                                redeemCodeExpiryHours: reward.redeemCodeExpiryHours,
                                redeemCodeContentId: reward.redeemCodeContentId,
                                redeemCodeEffectColor: reward.redeemCodeEffectColor,
                            } as any);
                        }
                    });
                }

                if (next % 10 === 0) updateUserStatus(state.user!.id, next); 
                return next;
            });
        }, 1000);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [state.user?.id, state.view]); 

    // When an `activeReward` is set (by the study timer), push it to the user's inbox
    useEffect(() => {
        if (!activeReward || !state.user) return;

        const updatedUser = { ...state.user } as any;
        const existingInbox = updatedUser.inbox || [];
        const alreadyInInbox = existingInbox.some((m: any) => m.id === activeReward.id);
        if (!alreadyInInbox) {
            const rewardText = activeReward.type === 'COINS'
                ? `${activeReward.label}: +${activeReward.amount} Credits received!`
                : `${activeReward.label}: ${activeReward.subLevel || 'BASIC'} Access unlocked!`;

            const inboxMsg: any = {
                id: activeReward.id,
                text: rewardText,
                date: new Date().toISOString(),
                read: false,
                type: 'REWARD',
                isClaimed: false,
                expiresAt: activeReward.expiresAt
            };

            if (activeReward.type === 'COINS') {
                inboxMsg.gift = { type: 'CREDITS', value: activeReward.amount || 0 };
            } else {
                inboxMsg.gift = {
                    type: 'SUBSCRIPTION',
                    value: `${activeReward.subTier || 'WEEKLY'}_${activeReward.subLevel || 'BASIC'}`,
                    durationHours: activeReward.durationHours || 4
                };
            }

            updatedUser.inbox = [inboxMsg, ...existingInbox];

            // Auto-generate Redeem Code if configured
            const ar = activeReward as any;
            if (ar.generateRedeemCode && ar.redeemCodeType && state.user.email) {
                try {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    const genCode = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    const codeExpiryHours = ar.redeemCodeExpiryHours ?? 24;
                    const codeExpiry = new Date(Date.now() + codeExpiryHours * 60 * 60 * 1000).toISOString();
                    const codeData: any = {
                        code: genCode,
                        type: ar.redeemCodeType,
                        amount: ar.redeemCodeAmount || 0,
                        discountPercent: ar.redeemCodeDiscountPercent || 0,
                        subTier: ar.redeemCodeSubTier || 'WEEKLY',
                        subLevel: ar.redeemCodeSubLevel || 'BASIC',
                        contentId: ar.redeemCodeContentId || '',
                        effectColor: ar.redeemCodeEffectColor || '',
                        maxUses: 1,
                        usedCount: 0,
                        isRedeemed: false,
                        redeemedBy: [],
                        createdAt: new Date().toISOString(),
                        expiresAt: codeExpiry,
                        generatedBy: 'ENGAGEMENT_REWARD',
                        forUserId: state.user.id,
                    };
                    if (rtdb) {
                        rtdbSet(rtdbRef(rtdb, `redeem_codes/${genCode}`), codeData).catch(() => {});
                    }
                    if (db) {
                        fsSetDoc(fsDoc(db, 'redeem_codes', genCode), codeData).catch(() => {});
                    }
                    // Add code to inbox as special message
                    const codeMsg: any = {
                        id: `code-${activeReward.id}`,
                        text: `🎁 Engagement Reward Code: You received a special redeem code! Code: ${genCode} | Valid ${codeExpiryHours} hours | ${ar.redeemCodeType === 'CREDITS' ? `+${ar.redeemCodeAmount} Credits` : ar.redeemCodeType === 'SUBSCRIPTION' ? `${ar.redeemCodeSubTier} ${ar.redeemCodeSubLevel} Plan` : ar.redeemCodeType === 'DISCOUNT' ? `${ar.redeemCodeDiscountPercent}% Discount` : 'Special Unlock'} | Go to the Store to redeem!`,
                        date: new Date().toISOString(),
                        read: false,
                        type: 'GIFT',
                        isClaimed: false,
                        expiresAt: codeExpiry,
                        gift: { type: 'CREDITS', value: 0 },
                    };
                    updatedUser.inbox = [codeMsg, ...updatedUser.inbox];
                } catch (_) {}
            }

            // Persist
            if (!state.originalAdmin) {
                localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                saveUserToLive(updatedUser);
            }
            setState(prev => ({ ...prev, user: updatedUser }));
            setAlertConfig({ isOpen: true, message: `🎁 ${activeReward.label} received! Go to Mail → Rewards to claim.` });
        }

        // Clear activeReward after processing
        setActiveReward(null);
    }, [activeReward]);

  useEffect(() => {
      document.title = `${state.settings.appName}`;

      // Dynamic Theme Logic
      let activeThemeColor = state.settings.themeColor || '#3b82f6';

      if (state.user) {
          // 1. Subscription Check
          if (state.user.isPremium) {
              if (state.user.subscriptionLevel === 'ULTRA') {
                  activeThemeColor = '#a855f7'; // Purple
              } else if (state.user.subscriptionLevel === 'BASIC') {
                  activeThemeColor = '#3b82f6'; // Blue (Standard Premium)
              }
          }

          // 2. Top 3 Logic (Overrides Subscription)
          try {
              const lbData = localStorage.getItem('nst_leaderboard');
              if (lbData) {
                  const entries: any[] = JSON.parse(lbData);
                  const top3 = entries
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 3)
                      .map(e => e.userId);

                  if (top3.includes(state.user.id)) {
                      activeThemeColor = '#eab308'; // Gold
                  }
              }
          } catch(e) {}
      }

      const styleId = 'nst-custom-styles';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
      }
      // Parse brand color RGB components for alpha-channel token variants
      const hex = activeThemeColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 59;
      const g = parseInt(hex.substring(2, 4), 16) || 130;
      const b = parseInt(hex.substring(4, 6), 16) || 246;
      styleTag.innerHTML = `:root { --primary: ${activeThemeColor}; --nst-color-brand: ${activeThemeColor}; --nst-color-brand-5: rgba(${r},${g},${b},0.05); --nst-color-brand-10: rgba(${r},${g},${b},0.10); } .text-primary { color: var(--primary); } .bg-primary { background-color: var(--primary); } .border-primary { border-color: var(--primary); } ${state.settings.customCSS || ''}`;
  }, [state.settings, state.user]);

  // --- LOGGING SYSTEM ---
  const logActivity = (action: string, details: string, overrideUser?: User) => {
      const u = overrideUser || state.user;
      if (!u && !overrideUser) return;
      
      const newLog: ActivityLogEntry = {
          id: Date.now().toString() + Math.random(),
          userId: u!.id,
          userName: u!.name,
          role: u!.role,
          action: action,
          details: details,
          timestamp: new Date().toISOString()
      };

      const storedLogs = localStorage.getItem('nst_activity_log');
      let logs: ActivityLogEntry[] = [];
      try { logs = storedLogs ? JSON.parse(storedLogs) : []; } catch { logs = []; }
      // Keep last 500 logs
      const updatedLogs = [...logs, newLog].slice(-500); 
      localStorage.setItem('nst_activity_log', JSON.stringify(updatedLogs));
  };

  const updateSettings = (newSettings: SystemSettings) => {
      setState(prev => ({...prev, settings: newSettings}));
      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
  };

  // Provide a global toggle handler for TTS
  const handleToggleAutoTts = (enabled: boolean) => {
      const newSettings = { ...state.settings, isAutoTtsEnabled: enabled };
      updateSettings(newSettings);
  };

  useEffect(() => {
    if (state.user && state.view === 'STUDENT_DASHBOARD') {
        const queue: PopupType[] = [];

        // 1. Daily Tracker (Always check)
        const lastTracker = localStorage.getItem('nst_last_daily_tracker_date');
        if (lastTracker !== new Date().toDateString()) {
            queue.push('TRACKER');
        }

        // 2. Welcome/Promo Popup - DISABLED

        if (queue.length > 0) setPopupQueue(queue);
    }
  }, [state.user?.id, state.view, state.settings]);

    // --- SCHOOL ECOSYSTEM: super-admin email list (configure here) ---
  const SCHOOL_SUPER_ADMIN_EMAILS: string[] = [
    'superadmin@iic.app',
    'nsta.superadmin@gmail.com',
  ];

  const handleLogin = async (user: User) => {
    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(user));
    }
    saveUserToLive(user);
    localStorage.setItem('nst_has_seen_welcome', 'true');

    // Check if this user is a School Ecosystem user
    const isSuperAdmin = SCHOOL_SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase());
    if (isSuperAdmin) {
      setState(prev => ({ ...prev, user, view: 'SCHOOL_ECOSYSTEM' as any }));
      return;
    }

    try {
      const schoolProfile = await getSchoolUserProfile(user.id);
      if (schoolProfile) {
        setState(prev => ({ ...prev, user, view: 'SCHOOL_ECOSYSTEM' as any }));
        return;
      }
    } catch (_) { /* not a school user, continue normal flow */ }

    // Check if this user is a Coaching Ecosystem user
    try {
      const coachingProfile = await getCoachingUserProfile(user.id);
      if (coachingProfile) {
        setState(prev => ({ ...prev, user, view: 'COACHING_ECOSYSTEM' as any }));
        return;
      }
    } catch (_) { /* not a coaching user, continue normal flow */ }

    // Check if onboarding is needed
    if ((user.role === 'STUDENT' || user.role === 'TEACHER') && !user.profileCompleted) {
        setState(prev => ({
          ...prev,
          user,
          view: 'ONBOARDING',
        }));
        return;
    }

    setState(prev => ({
      ...prev,
      user,
      view: 'STUDENT_DASHBOARD' as any,
      selectedBoard: user.board || null,
      selectedClass: user.classLevel || null,
      selectedStream: user.stream || null,
      language: user.board === 'BSEB' ? 'Hindi' : 'English',
    }));

    if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
      setTimeout(() => setAlertConfig({ isOpen: true, message: `👋 Welcome, ${user.name || 'Admin'}!\n\nAap Student Dashboard pe hain.\nAdmin Panel ke liye Profile → Admin Panel pe jayein.` }), 600);
    }
  };

  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutTimeLeft, setLogoutTimeLeft] = useState(10);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [showCloudRecoveryModal, setShowCloudRecoveryModal] = useState(false);

  const performLogout = () => {
    logActivity("LOGOUT", "User Logged Out");
    localStorage.removeItem('nst_current_user');
    localStorage.removeItem('nst_user_history'); // Clear Saved Notes on logout to prevent bleeding across accounts
    setState(prev => ({ ...prev, user: null, originalAdmin: null, view: 'BOARDS', selectedBoard: null, selectedClass: null, selectedStream: null, selectedSubject: null, lessonContent: null, language: 'English' }));
    setDailyStudySeconds(0);
  };

  useEffect(() => {
     let timer: NodeJS.Timeout;
     if (logoutPending && logoutTimeLeft > 0) {
        timer = setTimeout(() => {
            setLogoutTimeLeft(prev => prev - 1);
        }, 1000);
     } else if (logoutPending && logoutTimeLeft <= 0) {
        // Sync and logout
        if (state.user) {
            saveUserToLive(state.user).catch(err => console.error("Error syncing on logout", err));
        }
        performLogout();
        setLogoutPending(false);
     }
     return () => clearTimeout(timer);
  }, [logoutPending, logoutTimeLeft]);

  const handleLogout = () => {
    if (!state.user) {
       performLogout();
       return;
    }
    const isPremiumActive = state.user.isPremium && state.user.subscriptionEndDate && new Date(state.user.subscriptionEndDate) > new Date();
    const subLevel = state.user.subscriptionLevel;
    const logoutSecs = isPremiumActive ? (subLevel === 'ULTRA' ? 1 : 3) : 5;
    setLogoutPending(true);
    setLogoutTimeLeft(logoutSecs);
  };

  const handleMCQComplete = (score: number, answers: Record<number, number>, displayData: MCQItem[], timeTaken: number) => {
    if (!state.user || !state.selectedChapter) return;

    // Build Wrong Questions List (Strictly Incorrect Attempts)
    const wrongQuestions = displayData
      .map((q, idx) => {
          const selected = answers[idx] !== undefined ? answers[idx] : -1;
          // Filter: Must be attempted (not -1) AND wrong
          if (selected !== -1 && selected !== q.correctAnswer) {
              return {
                  question: q.question,
                  qIndex: idx
              };
          }
          return null;
      })
      .filter((item): item is { question: string; qIndex: number } => item !== null);

    // NEW: Calculate Granular Topic Analysis
    const topicAnalysis: Record<string, { correct: number, total: number, percentage: number }> = {};
    displayData.forEach((q, idx) => {
        const topic = q.topic || 'General';
        if (!topicAnalysis[topic]) topicAnalysis[topic] = { correct: 0, total: 0, percentage: 0 };
        topicAnalysis[topic].total++;
        if (answers[idx] === q.correctAnswer) topicAnalysis[topic].correct++;
    });
    // Calculate Percentages
    Object.keys(topicAnalysis).forEach(topic => {
        const t = topicAnalysis[topic];
        t.percentage = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    });

    const result: MCQResult = {
        id: `mcq_${state.selectedChapter.id}_${Date.now()}`,
        userId: state.user.id,
        date: new Date().toISOString(),
        score,
        totalQuestions: displayData.length, // Ensure required MCQResult field is populated
        correctCount: score,              // Ensure correctCount is set
        wrongCount: displayData.length - score, // Calculate and set wrongCount
        totalTimeSeconds: timeTaken,        // Ensure time is set
        timeTaken,
        chapterId: state.selectedChapter.id,
        chapterTitle: state.selectedChapter.title,
        subjectId: state.selectedSubject?.id || '',
        subjectName: state.selectedSubject?.title || '',
        classLevel: state.selectedClass || '',
        userAnswers: answers,
        wrongQuestions: wrongQuestions,
        topicAnalysis: topicAnalysis // Save for history comparison
    };

    setLastTestResult(result);
    setLastTestQuestions(displayData); // Pass for Marksheet Granular View
    
    // UPDATE USER HISTORY & PROGRESS
    let updatedUser = { ...state.user };
    if (!updatedUser.testResults) updatedUser.testResults = [];
    updatedUser.testResults.unshift(result);
    if (!updatedUser.mcqHistory) updatedUser.mcqHistory = [];
    updatedUser.mcqHistory.unshift(result);

    // AUTO-NOTIFICATION LOGIC (Low Score)
    const percentage = displayData.length > 0 ? (score / displayData.length) * 100 : 0;
    if (percentage < 40) {
        const failureMsg = {
            id: `fail-alert-${Date.now()}`,
            text: `⚠️ Alert: You scored only ${Math.round(percentage)}% in "${state.selectedChapter.title}". We recommend reviewing the notes immediately.`,
            date: new Date().toISOString(),
            read: false,
            type: 'TEXT'
        };
        updatedUser.inbox = [failureMsg, ...(updatedUser.inbox || [])];
        setAlertConfig({isOpen: true, message: "⚠️ Low Score Alert: Check your inbox for study recommendations."});
    }
    
    // Save to Firestore
    saveUserHistory(state.user.id, result);
    saveTestResult(state.user.id, result);
    
    if (!state.originalAdmin) {
        saveUserToLive(updatedUser);
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
    }
    setState(prev => ({ ...prev, user: updatedUser }));
  };

  const handleImpersonate = (targetUser: User) => {
      if (state.user?.role !== 'ADMIN') return;
      logActivity("IMPERSONATE", `Admin accessed as ${targetUser.name}`);
      // NOTE: We do NOT update localStorage 'nst_current_user' here, so refresh restores Admin
      setState(prev => ({ ...prev, originalAdmin: prev.user, user: targetUser, view: 'STUDENT_DASHBOARD', selectedBoard: targetUser.board || null, selectedClass: targetUser.classLevel || null, selectedStream: targetUser.stream || null, language: targetUser.board === 'BSEB' ? 'Hindi' : 'English' }));
  };

  const handleReturnToAdmin = () => {
      if (!state.originalAdmin) return;
      setState(prev => ({ ...prev, user: prev.originalAdmin, originalAdmin: null, view: 'ADMIN_DASHBOARD', selectedBoard: null, selectedClass: null }));
  };

  const updateUserProfile = (updates: Partial<User>) => {
      if (!state.user) return;
      const updatedUser = { ...state.user, ...updates };

      // Update State
      setState(prev => ({ ...prev, user: updatedUser }));

      // Persist (Only if not impersonating)
      if (!state.originalAdmin) {
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser);
      }
  };

  const handleBoardSelect = (board: Board) => {
      updateUserProfile({ board });
      setState(prev => ({ ...prev, selectedBoard: board, view: 'CLASSES', language: board === 'BSEB' ? 'Hindi' : 'English' }));
  };

  const handleClassSelect = (level: ClassLevel) => {
      // STRICT CLASS LOCKING (1 Account = 1 Class)
      // Allow change only if: Admin, Impersonating, or No Class Set yet.
      if (state.user?.classLevel && state.user.classLevel !== level) {
          if (state.user.role !== 'ADMIN' && state.user.role !== 'SUB_ADMIN' && !state.originalAdmin) {
              setAlertConfig({ isOpen: true, message: "🔒 Class is locked! You cannot change your class once selected.\n\nContact Admin for help." });
              return;
          }
      }

      // 1. Update Profile FIRST (Persist to Cloud/Local)
      updateUserProfile({ classLevel: level });

      // 2. Update Local State (Immediate UI Feedback without reload)
      // We must update 'user' in state to match the persistence, otherwise child components might get stale props
      setState(prev => {
          const updatedUser = prev.user ? { ...prev.user, classLevel: level } : null;

          if (level === '11' || level === '12') {
              return { ...prev, user: updatedUser, selectedClass: level, view: 'STREAMS' };
          }

          // For non-stream classes, we also clear stream
          const finalUser = updatedUser ? { ...updatedUser, stream: undefined } : null; // Use undefined instead of null to match type if optional

          if (level === 'COMPETITION') {
               updateUserProfile({ stream: null }); // Ensure DB is cleared too
               return { ...prev, user: finalUser as any, selectedClass: level, selectedStream: null, view: 'SUBJECTS' };
          } else {
               updateUserProfile({ stream: null });
               return { ...prev, user: finalUser as any, selectedClass: level, selectedStream: null, view: 'SUBJECTS' };
          }
      });
  };

  const handleStreamSelect = (stream: Stream) => {
      updateUserProfile({ stream });
      setState(prev => ({ ...prev, selectedStream: stream, view: 'SUBJECTS' }));
  };

  const handleSubjectSelect = async (subject: Subject) => {
    setState(prev => ({ ...prev, selectedSubject: subject, loading: true }));
    try {
      if (state.selectedClass && state.selectedBoard) {
        const chapters = await fetchChapters(state.selectedBoard, state.selectedClass, state.selectedStream, subject, state.language);
        setState(prev => ({ ...prev, chapters, view: 'CHAPTERS', loading: false }));
      }
    } catch (err) { setState(prev => ({ ...prev, chapters: [], view: 'CHAPTERS', loading: false })); }
  };

  const onChapterClick = (chapter: Chapter, contentType?: ContentType) => {
    setTempSelectedChapter(chapter);
    if (contentType) {
      handleContentGeneration(contentType);
    } else {
      setShowPremiumModal(true);
    }
  };

  const handleNavigateToChapterFromHistory = (chapterId: string, chapterTitle: string, subjectName: string, classLevel?: string) => {
      const tempChapter: Chapter = {
          id: chapterId,
          title: chapterTitle,
          subject: subjectName,
          board: state.selectedBoard || 'CBSE',
          classLevel: (classLevel || state.selectedClass || '10') as any,
          order: 0,
          isLocked: false
      };
      setTempSelectedChapter(tempChapter);
      setShowPremiumModal(true);
  };

  const handleContentGeneration = async (type: ContentType, count?: number, forcePay: boolean = false, specificContent?: any) => {
    setShowPremiumModal(false);
    setLoadingContentType(type);
    if (!tempSelectedChapter || !state.user) return;

    // --- SPECIFIC CONTENT LAUNCH (FROM NEW DASHBOARD) ---
    if (specificContent) {
        // 1. Determine Cost (Dynamic Check from Feature Config)
        let cost = 0;
        if (specificContent.isPremium) {
             // Fallback Defaults
             cost = 5;
             if (type === 'VIDEO_LECTURE') cost = state.settings.defaultVideoCost || 5;
             if (type === 'NOTES_PREMIUM' || type === 'NOTES_HTML_PREMIUM') cost = state.settings.defaultPdfCost || 5;

             // Override with Granular Feature Cost if exists
             if (state.settings.featureCosts) {
                 // Map ContentType to Feature ID (approximate mapping)
                 let featId = '';
                 if (type === 'VIDEO_LECTURE') featId = 'video_view';
                 else if (type.startsWith('NOTES') || type.startsWith('PDF')) featId = 'pdf_view';

                 if (featId) {
                     const costConfig = state.settings.featureCosts.find(f => f.featureId === featId);
                     if (costConfig) {
                         const tier = state.user.subscriptionTier === 'FREE' ? 'free' : state.user.subscriptionLevel === 'BASIC' ? 'basic' : 'ultra';
                         cost = costConfig[`${tier}Cost`];
                     }
                 }
             }
        }


        // OVERRIDE FOR CREDIT FREE EVENT
        if (state.settings.isCreditFreeEvent || state.settings.isGlobalFreeMode) cost = 0;

        // CHECK IF UNLOCKED VIA REDEEM CODE
        // We check against Chapter ID or specific Content ID (permanent or time-limited)
        const _timedUnlocks1 = (state.user as any).timedUnlocks || [];
        const _isTimedValid1 = (id: string | undefined) => id ? _timedUnlocks1.some((u: any) => u.contentId === id && new Date(u.expiresAt) > new Date()) : false;
        if (state.user.unlockedContent && (state.user.unlockedContent.includes(tempSelectedChapter.id) || state.user.unlockedContent.includes(specificContent?.id))) {
            cost = 0;
        } else if (_isTimedValid1(tempSelectedChapter.id) || _isTimedValid1(specificContent?.id)) {
            cost = 0;
        }


        // 2. Check & Deduct
        if (cost > 0 && state.user.role !== 'ADMIN' && !state.originalAdmin) {
             if (getTotalCredits(state.user) < cost) {
                 setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${cost} Credits.`});
                 return;
             }
             { const _td = new Date().toISOString().split('T')[0]; const _sk = `nst_credit_skip_${state.user!.id}_${_td}`; if (!localStorage.getItem(_sk) && !forcePay) {
                 setCreditModal({
                     isOpen: true, cost, title: "Unlock Content",
                     onConfirm: (auto) => {
                         if (auto) { localStorage.setItem(_sk, '1'); }
                         setCreditModal(null);
                         handleContentGeneration(type, count, true, specificContent);
                     }
                 });
                 return;
             }}
             const updatedUser = applyDeduction(state.user, cost) ?? state.user;
             if (!state.originalAdmin) {
                 localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                 saveUserToLive(updatedUser);
             }
             setState(prev => ({...prev, user: updatedUser}));
        }

        // 3. Launch
        const lessonContent: LessonContent = {
            id: specificContent.id || Date.now().toString(),
            title: specificContent.title || tempSelectedChapter.title,
            subtitle: specificContent.topic || 'Premium Content',
            content: specificContent.content || specificContent.url, // Handle both Note (content) and Video (url)
            type: type,
            dateCreated: new Date().toISOString(),
            subjectName: state.selectedSubject?.name || '',
            // Pass through other fields if video
            videoPlaylist: specificContent.videoPlaylist
        };

        setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON' }));
        setIsFullScreen(true);
        return;
    }
    
    // --- HTML NOTES & AI IMAGE HANDLING ---
    if (type === 'NOTES_HTML_FREE' || type === 'NOTES_HTML_PREMIUM' || type === 'NOTES_IMAGE_AI') {
        const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
        const mainKey = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}`;

        let contentData = await getChapterData(mainKey);
        if (!contentData) {
            const stored = localStorage.getItem(mainKey);
            if (stored) { try { contentData = JSON.parse(stored); } catch {} }
        }

        let actualContent = '';
        let cost = 0;
        let subtitle = '';

        if (type === 'NOTES_HTML_FREE') {
            actualContent = contentData?.freeNotesHtml;
            subtitle = 'Free Notes (Rich Text)';
            cost = 0;
        } else if (type === 'NOTES_HTML_PREMIUM') {
            actualContent = contentData?.premiumNotesHtml;
            subtitle = 'Premium Notes (Rich Text)';
            cost = 5;
        } else if (type === 'NOTES_IMAGE_AI') {
            actualContent = contentData?.aiImageLink;
            subtitle = 'AI Generated Visual Notes';
            cost = contentData?.aiImagePrice !== undefined ? contentData.aiImagePrice : 5;
        }

        if (!actualContent) {
            // Replaced Alert with Coming Soon View
            setState(prev => ({
                ...prev,
                selectedChapter: tempSelectedChapter,
                lessonContent: {
                    id: Date.now().toString(),
                    title: tempSelectedChapter.title,
                    subtitle: "Content Unavailable",
                    content: "",
                    type: type,
                    dateCreated: new Date().toISOString(),
                    subjectName: state.selectedSubject?.name || '',
                    isComingSoon: true
                },
                view: 'LESSON'
            }));
            setIsFullScreen(true);
            return;
        }

         if (state.user.role !== 'ADMIN' && !state.originalAdmin && cost > 0) {
             if (getTotalCredits(state.user) < cost) {
                 setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${cost} Credits.`});
                 return;
             }

             // CONFIRMATION CHECK
             { const _td = new Date().toISOString().split('T')[0]; const _sk = `nst_credit_skip_${state.user!.id}_${_td}`; if (!localStorage.getItem(_sk) && !forcePay) {
                 setCreditModal({
                     isOpen: true,
                     cost,
                     title: "Unlock AI Content",
                     onConfirm: (auto) => {
                         if (auto) { localStorage.setItem(_sk, '1'); }
                         setCreditModal(null);
                         handleContentGeneration(type, count, true);
                     }
                 });
                 return;
             }}

             const updatedUser = applyDeduction(state.user, cost) ?? state.user;
             if (!state.originalAdmin) {
                 localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                 saveUserToLive(updatedUser);
             }
             setState(prev => ({...prev, user: updatedUser}));
        }

        // --- SPECIFIC AI DELAY FOR IMAGE NOTES ---
        if (type === 'NOTES_IMAGE_AI') {
            setState(prev => ({ ...prev, loading: true }));
            setLoadingMessage("AI is analyzing and generating visual notes...");
            setGenerationDataReady(false);

            // Wait 5-8 seconds to simulate AI work
            setTimeout(() => {
                setGenerationDataReady(true);
                setLoadingMessage("Notes Ready!");

                const lessonContent: LessonContent = {
                    id: Date.now().toString(),
                    title: tempSelectedChapter.title,
                    subtitle: subtitle,
                    content: actualContent, // Image URL
                    aiHtmlContent: contentData?.aiHtmlContent, // Pass HTML Content if exists
                    type: type,
                    dateCreated: new Date().toISOString(),
                    subjectName: state.selectedSubject?.name || ''
                };

                // Allow a small delay for "Ready" message to be seen
                setTimeout(() => {
                    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON', loading: false }));
                    setIsFullScreen(true);
                    setLoadingMessage('');
                }, 1000);

            }, 6000); // 6 Seconds Delay
            return;
        }

        // For HTML Notes (Immediate)
        const lessonContent: LessonContent = {
            id: Date.now().toString(),
            title: tempSelectedChapter.title,
            subtitle: subtitle,
            content: actualContent,
            type: type,
            dateCreated: new Date().toISOString(),
            subjectName: state.selectedSubject?.name || ''
        };

        setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON' }));
        setIsFullScreen(true); // AI Lesson is Full Screen
        return;
    }

    // Check Cost Logic
    let cost = 0;
    const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
    
    // 1. Construct Keys
    const mainKey = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}`;
    const typeKey = `${mainKey}_${type}`;

    // 2. Try Fetching Admin Data (Main Key) - Consolidates all links
    let onlineContent: any = await getChapterData(mainKey);
    let foundAdminContent = false;

    // Filter Admin Data for the requested Type
    if (onlineContent) {
        if (type === 'PDF_FREE' && (onlineContent.freeLink || onlineContent.freeNotesHtml || onlineContent.schoolFreeNotesList?.length > 0 || onlineContent.competitionFreeNotesList?.length > 0)) {
            onlineContent = { ...onlineContent, content: onlineContent.freeLink || '', type, price: 0 };
            foundAdminContent = true;
        } else if (type === 'PDF_PREMIUM' && (onlineContent.premiumLink || onlineContent.premiumNotesHtml || onlineContent.schoolPremiumNotesList?.length > 0 || onlineContent.competitionPremiumNotesList?.length > 0)) {
            onlineContent = { ...onlineContent, content: onlineContent.premiumLink || '', type }; // Uses default price from object
            foundAdminContent = true;
        } else if (type === 'PDF_ULTRA' && onlineContent.ultraPdfLink) {
            onlineContent = { ...onlineContent, content: onlineContent.ultraPdfLink, type, price: 10 }; // Ultra defaults to 10
            foundAdminContent = true;
        } else if (type === 'VIDEO_LECTURE' && (onlineContent.videoPlaylist?.length > 0 || onlineContent.schoolVideoPlaylist?.length > 0 || onlineContent.competitionVideoPlaylist?.length > 0 || onlineContent.freeVideoLink || onlineContent.premiumVideoLink)) {
            // Prioritize Playlist -> Premium Link -> Free Link
            const videoUrl = onlineContent.premiumVideoLink || onlineContent.freeVideoLink || '';
            const vidPrice = onlineContent.videoCreditsCost !== undefined ? onlineContent.videoCreditsCost : 5;
            // Ensure playlists are passed through
            onlineContent = {
                ...onlineContent,
                content: videoUrl,
                videoPlaylist: onlineContent.videoPlaylist || onlineContent.schoolVideoPlaylist || onlineContent.competitionVideoPlaylist, // Fallback logic
                type,
                price: vidPrice
            };
            foundAdminContent = true;
        } else {
            // Not found in Admin Data for this specific type (might be AI content)
            onlineContent = null;
        }
    }

    // 3. If not in Admin Data, check Type-Specific Key (Legacy/AI Generated)
    if (!onlineContent) {
        onlineContent = await getChapterData(typeKey);
    }

    if (onlineContent) {
         if(onlineContent.price !== undefined) cost = onlineContent.price;
    }

    // --- EMPTY CONTENT GUARD ---
    // If online content is found but the URL/Content is empty string, force coming soon.
    if (onlineContent && !onlineContent.content && !onlineContent.videoPlaylist?.length && !onlineContent.aiHtmlContent) {
        setState(prev => ({
            ...prev,
            selectedChapter: tempSelectedChapter,
            lessonContent: {
                id: Date.now().toString(),
                title: tempSelectedChapter.title,
                subtitle: "Content Unavailable",
                content: "",
                type: type,
                dateCreated: new Date().toISOString(),
                subjectName: state.selectedSubject?.name || '',
                isComingSoon: true
            },
            view: 'LESSON'
        }));
        setIsFullScreen(true);
        return;
    }


    // OVERRIDE FOR CREDIT FREE EVENT
    if (state.settings.isCreditFreeEvent || state.settings.isGlobalFreeMode) cost = 0;

    // CHECK IF UNLOCKED VIA REDEEM CODE (permanent or time-limited)
    const _timedUnlocks2 = (state.user as any).timedUnlocks || [];
    const _isTimedValid2 = (id: string) => _timedUnlocks2.some((u: any) => u.contentId === id && new Date(u.expiresAt) > new Date());
    if (state.user.unlockedContent && state.user.unlockedContent.includes(tempSelectedChapter.id)) {
        cost = 0;
    } else if (_isTimedValid2(tempSelectedChapter.id)) {
        cost = 0;
    }


    // --- ACCESS CONTROL LOGIC (Unified) ---
    let hasAccess = false;

    // 1. Admin / System
    if (state.user.role === 'ADMIN' || state.originalAdmin) {
        hasAccess = true;
    }
    // 2. Global Free Mode
    else if (state.settings.isGlobalFreeMode) {
        hasAccess = true;
    }
    // 3. Cost is 0 (Free Content)
    else if (cost === 0) {
        hasAccess = true;
    }
    // 3. Tier/Subscription Permission Check
    else {
        // DOUBLE CHECK: Even if isPremium is true, validate date
        const isSubValid = state.user.isPremium && state.user.subscriptionEndDate && !isNaN(new Date(state.user.subscriptionEndDate).getTime()) && new Date(state.user.subscriptionEndDate) > new Date();

        // Auto-Downgrade in memory if invalid but flagged premium (Self-Healing)
        if (state.user.isPremium && !isSubValid) {
             console.warn("Detected Expired Premium during Access Check. Treating as FREE.");
        }

        const userLevel = isSubValid ? (state.user.subscriptionLevel || 'BASIC') : 'FREE';
        const perms = state.settings.tierPermissions?.[userLevel];

        if (perms && perms.length > 0) {
             if (perms.includes('ALL') || perms.includes(type)) {
                 hasAccess = true;
             }
             // MAP GROUP PERMISSIONS (From Admin Power Manager)
             if (type.startsWith('PDF') && perms.includes('NOTES_ACCESS')) hasAccess = true;
             if (type.startsWith('NOTES') && perms.includes('NOTES_ACCESS')) hasAccess = true;
             if (type === 'VIDEO_LECTURE' && perms.includes('VIDEO_ACCESS')) hasAccess = true;
             if (type.startsWith('AUDIO') && perms.includes('AUDIO_ACCESS')) hasAccess = true;
             if ((type === 'MCQ_SIMPLE' || type === 'MCQ_PRACTICE') && perms.includes('MCQ_PRACTICE')) hasAccess = true;
             if (type === 'MCQ_TEST' && perms.includes('MCQ_TEST')) hasAccess = true;
             if (type === 'AI_CHAT' && perms.includes('AI_CHAT')) hasAccess = true;
        } else if (isSubValid) {
            // Fallback Legacy Logic
            const legacyLevel = state.user.subscriptionLevel || 'BASIC';
            if (legacyLevel === 'ULTRA') {
                hasAccess = true;
            } else if (legacyLevel === 'BASIC') {
                if (['MCQ_ANALYSIS', 'MCQ_SIMPLE', 'NOTES_HTML_FREE', 'NOTES_HTML_PREMIUM', 'NOTES_PREMIUM', 'NOTES_SIMPLE'].includes(type)) {
                    hasAccess = true;
                }
            }
        }
    }

    // 4. Credit Deduction (Fallback)
    if (!hasAccess) {
        if (getTotalCredits(state.user) >= cost) {

            // NEW: CONFIRMATION CHECK
            { const _td = new Date().toISOString().split('T')[0]; const _sk = `nst_credit_skip_${state.user!.id}_${_td}`; if (!localStorage.getItem(_sk) && !forcePay) {
                 setCreditModal({
                     isOpen: true,
                     cost,
                     title: "Unlock AI Content",
                     onConfirm: (auto) => {
                         if (auto) { localStorage.setItem(_sk, '1'); }
                         setCreditModal(null);
                         handleContentGeneration(type, count, true);
                     }
                 });
                 return;
            }}

            // Deduct Credits
            const updatedUser = applyDeduction(state.user, cost) ?? state.user;

            if (!state.originalAdmin) {
                localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));

                // Sync to LocalStorage list
                const storedUsers = localStorage.getItem('nst_users');
                if (storedUsers) {
                    let allUsers: User[] = [];
                    try { allUsers = JSON.parse(storedUsers); } catch {}
                    const idx = allUsers.findIndex((u:User) => u.id === updatedUser.id);
                    if (idx !== -1) {
                        allUsers[idx] = updatedUser;
                        localStorage.setItem('nst_users', JSON.stringify(allUsers));
                    }
                }
                // Sync to Live
                saveUserToLive(updatedUser);
            }

            setState(prev => ({...prev, user: updatedUser}));
            hasAccess = true; // Access Granted via Credits
        } else {
            setAlertConfig({isOpen: true, message: `Insufficient Credits! This content costs ${cost} credits.\n\nTip: Upgrade to Subscription to access unlimited content.`});
            return;
        }
    }

    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, loading: true }));
    setGenerationDataReady(false);

    logActivity("CONTENT_GEN", `Opened ${type} for ${tempSelectedChapter.title}`);

    // LIVE ACTIVITY TRACKING
    if (state.user && !state.originalAdmin) {
        const activity = `Viewing ${type}: ${tempSelectedChapter.title}`;
        const updatedUser = { ...state.user, currentActivity: activity, lastActiveTime: new Date().toISOString() };
        saveUserToLive(updatedUser);
    }

    try {
        // RESTORE PROGRESS LOGIC
        let restoredAnswers = undefined;
        if ((type === 'MCQ_ANALYSIS' || type === 'MCQ_SIMPLE') && state.user.testResults) {
            // Find most recent result for this chapter
            const pastResult = state.user.testResults.find(r => r.chapterId === tempSelectedChapter.id);
            if (pastResult) {
                restoredAnswers = pastResult.userAnswers;
            }
        }

        // Try to use online content if available
        if (onlineContent) {
            const restoredContent = { ...onlineContent, userAnswers: restoredAnswers };
            // Double check for content existence before setting state
            if (!restoredContent.content && !restoredContent.videoPlaylist?.length && !restoredContent.aiHtmlContent && type !== 'MCQ_ANALYSIS' && type !== 'MCQ_SIMPLE') {
                 // Fallback to Coming Soon if somehow slipped through
                 restoredContent.isComingSoon = true;
            }
            setState(prev => ({ ...prev, lessonContent: restoredContent }));
            setGenerationDataReady(true);
            return;
        }

        // If no online content found and it's a generated type (e.g. NOTES_SIMPLE), we might generate it.
        // But if it's a strict type like PDF or VIDEO and not found in Admin, it's Coming Soon.
        if (['PDF_FREE', 'PDF_PREMIUM', 'PDF_ULTRA', 'VIDEO_LECTURE'].includes(type)) {
             setState(prev => ({
                ...prev,
                selectedChapter: tempSelectedChapter,
                lessonContent: {
                    id: Date.now().toString(),
                    title: tempSelectedChapter.title,
                    subtitle: "Coming Soon",
                    content: "",
                    type: type,
                    dateCreated: new Date().toISOString(),
                    subjectName: state.selectedSubject?.name || '',
                    isComingSoon: true
                },
                loading: false,
                view: 'LESSON'
            }));
            setIsFullScreen(true);
            return;
        }

        setIsStreaming(true);
        const handleStreamUpdate = (text: string) => {
             setState(prev => {
                 const currentContent = prev.lessonContent || {
                     id: Date.now().toString(),
                     title: tempSelectedChapter.title,
                     subtitle: subtitle || 'Generating...',
                     type: type,
                     dateCreated: new Date().toISOString(),
                     subjectName: state.selectedSubject?.name || '',
                     content: ''
                 };

                 return {
                     ...prev,
                     lessonContent: { ...currentContent, content: text } as LessonContent,
                     loading: false,
                     view: 'LESSON'
                 };
             });
        };

        const content = await fetchLessonContent(
          state.selectedBoard!, state.selectedClass!, state.selectedStream!, state.selectedSubject!, tempSelectedChapter, state.language, type, 
          0, false, 15, "", state.user?.role === 'ADMIN',
          handleStreamUpdate
        );

        setIsStreaming(false);

        // Save generated content to Firebase
        await saveChapterData(mainKey, content);

        const restoredContent = { ...content, userAnswers: restoredAnswers };
        setState(prev => ({ ...prev, lessonContent: restoredContent }));
        setGenerationDataReady(true); // Immediate ready for link mode
        setIsFullScreen(true); // Auto Full Screen for Lesson
    } catch (err) {
      setIsStreaming(false);
      setState(prev => ({ ...prev, loading: false }));
    }
  };
  
  const handleLoadingAnimationComplete = () => { 
      setState(prev => ({ ...prev, loading: false, view: 'LESSON' })); 
      setIsFullScreen(true);
  };


  const handleStartWeeklyTest = (test: WeeklyTest) => {
    setActiveWeeklyTest(test);
    // LIVE ACTIVITY TRACKING
    if (state.user && !state.originalAdmin) {
        const activity = `Taking Test: ${test.name}`;
        const updatedUser = { ...state.user, currentActivity: activity, lastActiveTime: new Date().toISOString() };
        saveUserToLive(updatedUser);
    }
  };

  const handleWeeklyTestComplete = async (score: number, total: number, answers: Record<number, number>) => {
    if (!activeWeeklyTest || !state.user) return;

    // Save Attempt
    const attempt = {
        testId: activeWeeklyTest.id,
        testName: activeWeeklyTest.name,
        userId: state.user.id,
        userName: state.user.name,
        startedAt: localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`) || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score: Math.round((score / total) * 100),
        totalQuestions: total,
        answers: answers
    };

    // 1. Local Backup
    const key = `nst_test_attempts_${state.user.id}`;
    let attempts: Record<string, unknown> = {};
    try { attempts = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    attempts[activeWeeklyTest.id] = attempt;
    localStorage.setItem(key, JSON.stringify(attempts));

    // 2. Firestore Sync (So Admin can see)
    await saveTestResult(state.user.id, attempt);

    logActivity("TEST_SUBMIT", `Completed ${activeWeeklyTest.name} with score ${score}/${total}`);

    // REWARD LOGIC
    let updatedUser = { ...state.user };
    let rewardMsg = "";

    // NEW RULE BASED LOGIC
    const percentage = (score / total) * 100;
    const isDaily = activeWeeklyTest.id.startsWith('daily-challenge-');
    const category = isDaily ? 'DAILY_CHALLENGE' : 'WEEKLY_TEST';

    // Fetch rules for this category
    const eligibleRules = (state.settings.prizeRules || [])
        .filter(r => r.enabled && r.category === category)
        .filter(r => percentage >= r.minPercentage)
        .sort((a, b) => b.minPercentage - a.minPercentage); // Highest difficulty first

    const bestRule = eligibleRules[0];

    if (bestRule) {
        if (bestRule.rewardType === 'COINS') {
            updatedUser.credits = (updatedUser.credits || 0) + (bestRule.rewardAmount || 0);
            rewardMsg = `🏆 Reward Unlocked: ${bestRule.label} (+${bestRule.rewardAmount} Coins)`;
        } else if (bestRule.rewardType === 'SUBSCRIPTION') {
            const duration = bestRule.rewardDurationHours || 24;
            const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();

            const newSub: ActiveSubscription = {
                id: `win-${Date.now()}`,
                tier: bestRule.rewardSubTier || 'WEEKLY',
                level: bestRule.rewardSubLevel || 'BASIC',
                startDate: new Date().toISOString(),
                endDate: endDate,
                source: 'REWARD'
            };

            updatedUser = addSubscription(updatedUser, newSub, state.settings);
            updatedUser.grantedByAdmin = true;
            rewardMsg = `🏆 Reward Unlocked: ${bestRule.label}`;
        }
    } else {
        if (isDaily) {
             rewardMsg = `Daily Challenge Complete. Score: ${Math.round(percentage)}%.`;
        } else {
             rewardMsg = "Test Submitted!";
        }
    }

    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        await saveUserToLive(updatedUser);
    }
    setState(prev => ({...prev, user: updatedUser}));
    if (rewardMsg) setAlertConfig({isOpen: true, message: rewardMsg});

    // Create Result Object for Marksheet
    const startTimeStr = localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`);
    const timeTaken = startTimeStr ? (Date.now() - parseInt(startTimeStr)) / 1000 : 0;

    // We should not pass the answers from the state object in the form of `Record<number, number>` since WeeklyTest is passing answers to us! Wait... we are looping over questions
    const omrData = activeWeeklyTest.questions.map((q, idx) => ({
        qIndex: idx,
        selected: answers[idx] !== undefined ? answers[idx] : -1,
        correct: q.correctAnswer
    }));

    // Create wrongQuestions array
    const wrongQuestions: any[] = [];
    activeWeeklyTest.questions.forEach((q, idx) => {
        if (answers[idx] !== q.correctAnswer) {
             wrongQuestions.push(q);
        }
    });

    const result: MCQResult = {
        id: `wt-${Date.now()}`,
        userId: state.user.id,
        chapterId: activeWeeklyTest.id,
        subjectId: 'WEEKLY',
        subjectName: 'Weekly Test',
        chapterTitle: activeWeeklyTest.name,
        date: new Date().toISOString(),
        totalQuestions: total,
        correctCount: score,
        wrongCount: total - score,
        score: score,
        totalTimeSeconds: timeTaken,
        averageTimePerQuestion: total > 0 ? timeTaken / total : 0,
        performanceTag: (score / total) >= 0.8 ? 'EXCELLENT' : (score / total) >= 0.5 ? 'GOOD' : 'BAD',
        classLevel: activeWeeklyTest.classLevel,
        omrData: omrData,
        wrongQuestions: wrongQuestions
    };


    // Calculate Granular Topic Analysis for Weekly Test
    const topicAnalysis: Record<string, { correct: number, total: number, percentage: number }> = {};
    activeWeeklyTest.questions.forEach((q, idx) => {
        const topic = q.topic || 'General';
        if (!topicAnalysis[topic]) topicAnalysis[topic] = { correct: 0, total: 0, percentage: 0 };
        topicAnalysis[topic].total++;
        if (answers[idx] === q.correctAnswer) topicAnalysis[topic].correct++;
    });
    // Calculate Percentages
    Object.keys(topicAnalysis).forEach(topic => {
        const t = topicAnalysis[topic];
        t.percentage = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    });
    result.topicAnalysis = topicAnalysis;

    // UPDATE USER HISTORY FOR ANALYTICS

    updatedUser.mcqHistory = [result, ...(updatedUser.mcqHistory || [])];

    // AUTO-NOTIFICATION LOGIC (Low Score for Weekly Test)
    if (percentage < 40) {
        const failureMsg = {
            id: `fail-alert-wt-${Date.now()}`,
            text: `⚠️ Alert: You scored only ${Math.round(percentage)}% in "${activeWeeklyTest.name}". Please focus on weak areas.`,
            date: new Date().toISOString(),
            read: false,
            type: 'TEXT'
        };
        updatedUser.inbox = [failureMsg, ...(updatedUser.inbox || [])];
    }

    // Save updated history
    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        saveUserToLive(updatedUser);
    }
    setState(prev => ({...prev, user: updatedUser}));

    setLastTestResult(result);
    setLastTestQuestions(activeWeeklyTest.questions); // Pass full questions for analysis
    // setAlertConfig({isOpen: true, message: `Test Submitted! You scored ${score}/${total}.\n\n🎁 REWARD UNLOCKED: 24 Hours Free Subscription granted for participating!`});

    // Cleanup Local Timer
    localStorage.removeItem(`weekly_test_start_${activeWeeklyTest.id}`);

    setActiveWeeklyTest(null);
  };

  // --- SAFE NAVIGATION LOGIC ---
  const goHome = () => {
     setState(prev => ({...prev, view: 'STUDENT_DASHBOARD'}));
  };

  const handlePopupClose = (type: string) => {
      setPopupQueue(prev => prev.slice(1));

      if (type === 'CHALLENGE') {
          localStorage.setItem('nst_last_daily_challenge_date', new Date().toDateString());
      }
  };

  const handleStartDailyChallenge = async () => {
      // 1. Generate Questions
      if (!state.user) return;

      const config = state.settings.dailyChallengeConfig || { rewardPercentage: 90, mode: 'AUTO', selectedChapterIds: [] };
      const questions = generateDailyChallengeQuestions(
          state.user.board || 'CBSE',
          state.user.classLevel || '10',
          state.user.stream,
          config.mode,
          config.selectedChapterIds || []
      );

      if (questions.length === 0) {
          setAlertConfig({isOpen: true, message: "Not enough content to generate a challenge yet. Try browsing some chapters first!"});
          handlePopupClose('CHALLENGE'); // Close popup anyway
          return;
      }

      // 2. Create Test Object
      const testId = `daily-challenge-${Date.now()}`;
      const test: WeeklyTest = {
          id: testId,
          name: `Daily Challenge (${new Date().toLocaleDateString()})`,
          description: "Win rewards by scoring high in this challenge!",
          isActive: true,
          classLevel: state.user.classLevel || '10',
          questions: questions,
          totalQuestions: questions.length,
          passingScore: Math.ceil((config.rewardPercentage / 100) * questions.length),
          createdAt: new Date().toISOString(),
          durationMinutes: 15,
          autoSubmitEnabled: true
      };

      // 3. Set Active Test (Starts the test view)
      setActiveWeeklyTest(test);

      // 4. Mark as Seen and Close Popup
      localStorage.setItem('nst_last_daily_challenge_date', new Date().toDateString());
      setPopupQueue(prev => prev.slice(1)); // Manually close popup without triggering handlePopupClose again (which sets storage too)
  };

  const goBack = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
    }

    // Exit Full Screen if active
    if (isFullScreen) {
        setIsFullScreen(false);
        // If viewing lesson, go back to chapters
        if (state.view === 'LESSON') {
             setState(prev => ({ ...prev, view: 'CHAPTERS', lessonContent: null }));
             return;
        }
        // If inside StudentDashboard (e.g. Video Player), we let StudentDashboard handle the back logic
        // But here we are in App level.
        // StudentDashboard calls goBack prop?
        // No, StudentDashboard has its own onBack for players.
        // Wait, FloatingDock calls goBack which calls this goBack.
        // If FloatingDock is hidden, user uses the Back button inside the Player (VideoPlaylistView).
        // That Back button in Player calls `onBack` prop of Player, which calls `setContentViewStep('CHAPTERS')` in StudentDashboard.
        // It does NOT call this global `goBack`.
        // So we just need to ensure `isFullScreen` is reset when StudentDashboard exits player.
    }

    if (activeWeeklyTest) {
        setConfirmConfig({
            isOpen: true,
            title: "Quit Test?",
            message: "Progress may be lost unless submitted. Are you sure?",
            onConfirm: () => {
                setActiveWeeklyTest(null);
                setConfirmConfig(prev => ({...prev, isOpen: false}));
            }
        });
        return;
    }

    setState(prev => {
      // 1. Content -> Chapters
      if (prev.view === 'LESSON') return { ...prev, view: 'CHAPTERS', lessonContent: null };

      // 2. Chapters -> Subjects (one level back for everyone)
      if (prev.view === 'CHAPTERS') {
          return { ...prev, view: 'SUBJECTS', selectedChapter: null };
      }

      // 3. Subjects -> Dashboard (for Students) OR Classes (Admin)
      if (prev.view === 'SUBJECTS') {
          // If Student, go DIRECTLY to Dashboard
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedSubject: null };
          }
          return { ...prev, view: ['11','12'].includes(prev.selectedClass||'') ? 'STREAMS' : 'CLASSES', selectedSubject: null };
      }

      if (prev.view === 'STREAMS') return { ...prev, view: 'CLASSES', selectedStream: null };
      if (prev.view === 'CLASSES') return { ...prev, view: 'BOARDS', selectedClass: null };

      // 4. Boards -> Dashboard
      if (prev.view === 'BOARDS') {
          return { ...prev, view: 'STUDENT_DASHBOARD' as any, selectedBoard: null };
      }

      return { ...prev, view: 'STUDENT_DASHBOARD' as any };
    });
  };

  // --- HARDWARE / BROWSER BACK BUTTON (App-level views) ---
  // StudentDashboard manages its own popstate trap internally (with its own
  // pushState + re-trap pattern). This handler mirrors that pattern for every
  // view OUTSIDE StudentDashboard (BOARDS, CLASSES, STREAMS, SUBJECTS, CHAPTERS,
  // LESSON) so the device/browser back button calls goBack() instead of exiting.
  //
  // KEY DESIGN:
  //  - Registered ONCE on mount ([] deps). Uses refs so the handler always reads
  //    current state without stale closures. This avoids Chrome's race condition
  //    where an async-effect-based trap (useEffect[view]) hasn't pushed yet before
  //    the user's second back press arrives.
  //  - Re-traps IMMEDIATELY inside the handler (same tick), guaranteeing a slot
  //    exists for the next press before React paints the next frame.
  //  - When view IS 'STUDENT_DASHBOARD', the handler bails out — StudentDashboard's
  //    own listener (registered on SD mount) takes full control. Both listeners
  //    co-exist safely: App handler returns early, SD handler acts normally.

  const _goBackRef = React.useRef(goBack);
  _goBackRef.current = goBack; // refresh every render — no stale closure

  const _viewRef = React.useRef(state.view);
  _viewRef.current = state.view; // always-fresh view without triggering effects

  useEffect(() => {
    // Push the initial trap so the very first back press is captured.
    try { window.history.pushState({ __appNavTrap: true }, ''); } catch {}

    const onPopState = () => {
      // STUDENT_DASHBOARD: SD's own handler takes over — don't interfere.
      if (_viewRef.current === 'STUDENT_DASHBOARD') return;

      // Re-trap FIRST — before any navigation logic — so Chrome Android registers
      // a new history entry immediately and never sees canGoBack() = false.
      try { window.history.pushState({ __appNavTrap: true }, ''); } catch {}

      _goBackRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []); // mount-once — refs keep everything fresh

  // --- OFFLINE INDICATOR (non-blocking) ---
  // Earlier the entire app was locked behind a full-screen "Internet Not Connected"
  // screen, which made cached content unusable. We now keep the app running on
  // cached Firebase data and show only a thin top banner so the user knows.
  // The banner is rendered alongside the rest of the app (see top-of-tree below).

  const getUserPlan = (): 'FREE' | 'BASIC' | 'ULTRA' => {
      if (!state.user?.isPremium) return 'FREE';
      if (state.user?.subscriptionLevel === 'ULTRA') return 'ULTRA';
      return 'BASIC';
  };

  if (isAppLoading) {
      return <AppLoadingScreen isPremium={state.user?.isPremium || false} subscriptionLevel={getUserPlan()} onComplete={() => setIsAppLoading(false)} />;
  }

  return (
    <ErrorBoundary>
    <div className="min-h-[100dvh] flex flex-col font-sans relative pt-[env(safe-area-inset-top,24px)] pb-[env(safe-area-inset-bottom,0px)]" style={{ background: state.settings?.appBackground || '#ffffff' }}>
      {/* SKIP TO CONTENT — keyboard/screen-reader accessibility */}
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {/* OFFLINE INDICATOR — scrolling marquee ticker, flows above the top bar without covering it */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Aap abhi offline hain. Saved content available hai."
          className="w-full shrink-0 bg-amber-500 text-white overflow-hidden"
          style={{ height: '22px', zIndex: 9998 }}
        >
          <div className="offline-marquee flex items-center h-full gap-20 whitespace-nowrap" style={{ animation: 'offlineMarquee 14s linear infinite' }}>
            {[0,1,2,3].map(i => (
              <span key={i} aria-hidden={i > 0} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
                Offline — Saved content available
              </span>
            ))}
          </div>
        </div>
      )}
      {/* LOGOUT OVERLAY */}
      {logoutPending && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 flex flex-col items-center w-full mx-4 shadow-2xl animate-in zoom-in duration-200">
                 <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6">
                     <Cloud size={32} className="animate-pulse" />
                 </div>
                 <h2 className="text-xl font-black mb-2 text-center">Saving Your Progress</h2>
                 <p className="text-slate-400 text-sm text-center mb-6">Please don't close the app. We are securely syncing your data to the cloud.</p>

                 <div className="text-5xl font-black font-mono mb-8 text-blue-400">
                     {logoutTimeLeft}s
                 </div>

                 <button
                     onClick={() => {
                         setLogoutPending(false);
                         setLogoutTimeLeft(0);
                     }}
                     className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                 >
                     Cancel Logout
                 </button>
              </div>
          </div>
      )}

      {/* CLOUD RECOVERY MODAL */}
      {showCloudRecoveryModal && cloudUser && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                   <div className="bg-blue-600 p-6 text-white text-center relative">
                       <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                           <Cloud size={32} className="text-white relative z-10" />
                           <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                       </div>
                       <h2 className="text-2xl font-black mb-1">Cloud Backup Found!</h2>
                       <p className="text-blue-100 text-sm">We found previously saved progress for your account.</p>
                   </div>
                   <div className="p-6 space-y-4">
                       <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
                           <strong>Cloud Account:</strong> {cloudUser.name} <br/>
                           <strong>Saved Tests:</strong> {cloudUser.mcqHistory?.length || 0}
                       </div>
                       <p className="text-sm font-medium text-slate-700 text-center">Would you like to recover your past data, or start fresh?</p>
                       <div className="flex flex-col gap-3 mt-6">
                           <button
                               onClick={() => {
                                   if (!state.user) return;
                                   const mergedUser = { ...state.user, ...cloudUser };
                                   localStorage.setItem('nst_current_user', JSON.stringify(mergedUser));
                                   saveUserToLive(mergedUser as User);
                                   setState(prev => ({...prev, user: mergedUser as User}));
                                   setCloudUser(null);
                                   setShowCloudRecoveryModal(false);
                                   setToastMessage('Data successfully recovered!');
                               }}
                               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                           >
                               <Cloud size={20} /> Recover My Past Data
                           </button>
                           <button
                               onClick={() => {
                                   // They want to start fresh, zero out cloud history to match local
                                   if (state.user) {
                                      const wipedUser = { ...state.user, mcqHistory: [], testResults: [] };
                                      saveUserToLive(wipedUser); // overwrite cloud with empty local
                                   }
                                   setCloudUser(null);
                                   setShowCloudRecoveryModal(false);
                               }}
                               className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-xl transition-all"
                           >
                               Start Fresh (Delete Past Data)
                           </button>
                       </div>
                   </div>
               </div>
          </div>
      )}

      {/* STATUS BAR BACKGROUND */}
      <div className="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top,24px)] z-[100]"></div>
      {/* BOTTOM SAFE AREA BACKGROUND */}
      <div className="fixed bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom,32px)] bg-slate-900 z-[100]"></div>

      {/* GLOBAL WATERMARK LAYER (FIXED: Single Logo, Configurable Position, Z-Index Low) */}
      {/* User Requirement: "app ka logo full screen pe dikhega nahi chhota sa... background me hi logo hoga" */}
      {/* Admin Toggle: state.settings.isWatermarkEnabled */}
      {state.settings.isWatermarkEnabled !== false && (
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden select-none">
          {state.settings.appLogo && (
              <img
                  src={state.settings.appLogo}
                  alt=""
                  style={{
                      width: `${state.settings.watermarkSize || 150}px`,
                      height: 'auto',
                      opacity: 0.05,
                      position: 'absolute',
                      top: state.settings.watermarkPosition?.top || '50%',
                      left: state.settings.watermarkPosition?.left || '50%',
                      transform: `translate(-50%, -50%) rotate(${state.settings.watermarkAngle || -10}deg)`,
                      filter: 'grayscale(100%)'
                  }}
              />
          )}

          {/* OPTION 2: FLOATING USER NAME (If Enabled) */}
          {(state.user && state.settings.showUserWatermark !== false) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="text-4xl font-black -rotate-45 whitespace-nowrap pointer-events-none"
                    style={{ color: state.settings.footerColor ? `${state.settings.footerColor}10` : 'rgba(15, 23, 42, 0.05)' }}
                  >
                      {state.user.name} • {state.user.displayId || state.user.id}
                  </div>
              </div>
          )}
      </div>
      )}
      
      {/* PLAN-SPECIFIC BANNER */}
      {(() => {
          const plan = getUserPlan();
          const pb = state.settings.planBanners;
          const planCfg = plan === 'ULTRA' ? pb?.ultra : plan === 'BASIC' ? pb?.basic : pb?.free;
          if (!planCfg?.enabled || !planCfg?.text) return null;
          return (
              <div
                  className="banner-premium-shimmer text-[11px] font-black tracking-widest uppercase py-1.5 overflow-hidden relative whitespace-nowrap z-[51] transition-all duration-500 ease-in-out"
                  style={{
                      background: planCfg.bgColor
                          ? `linear-gradient(90deg, ${planCfg.bgColor}ee, ${planCfg.bgColor}cc, ${planCfg.bgColor}ee)`
                          : 'linear-gradient(90deg, #64748b, #475569, #64748b)',
                      color: planCfg.textColor || '#ffffff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
              >
                  <div className="animate-marquee">
                      <span className="px-4">✦ &nbsp;{planCfg.text}&nbsp; ✦ &nbsp;{planCfg.text}&nbsp;</span>
                      <span className="px-4">✦ &nbsp;{planCfg.text}&nbsp; ✦ &nbsp;{planCfg.text}&nbsp;</span>
                  </div>
              </div>
          );
      })()}

      {/* GLOBAL LIVE DASHBOARD 1 (TOP) */}
      {state.settings.bannerConfig?.top?.enabled && showTopBanner && (
          <div
            className={`banner-premium-shimmer text-[11px] font-black tracking-widest uppercase py-1.5 overflow-hidden relative whitespace-nowrap z-50 transition-all duration-500 ease-in-out ${state.settings.bannerConfig.top.clickUrl ? 'cursor-pointer active:opacity-70' : ''}`}
            style={{
                background: state.settings.bannerConfig.top.bgColor
                    ? `linear-gradient(90deg, ${state.settings.bannerConfig.top.bgColor}ee, ${state.settings.bannerConfig.top.bgColor}cc, ${state.settings.bannerConfig.top.bgColor}ee)`
                    : 'linear-gradient(90deg, #7c3aed, #4f46e5, #7c3aed)',
                color: state.settings.bannerConfig.top.textColor || '#ffffff',
                height: showTopBanner ? 'auto' : '0',
                opacity: showTopBanner ? 1 : 0,
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
            onClick={() => {
                try { if (navigator.vibrate) navigator.vibrate(25); } catch {}
                const liveUrl = state.settings.bannerConfig?.top?.liveVideoUrl;
                if (liveUrl) {
                    setState(prev => ({ ...prev, lessonContent: { id: 'banner-live-top', title: state.settings.bannerConfig!.top.text || 'Live Class', subtitle: '🔴 Live', content: liveUrl, type: 'VIDEO_LECTURE', dateCreated: new Date().toISOString(), subjectName: 'Live' }, view: 'LESSON' }));
                    return;
                }
                const url = state.settings.bannerConfig?.top?.clickUrl;
                if (url) setInAppBrowserUrl(url);
            }}
          >
              <div className="animate-marquee">
                  <span className="px-4">✦ &nbsp;{state.settings.bannerConfig.top.text}&nbsp; ✦ &nbsp;{state.settings.bannerConfig.top.text}&nbsp;</span>
                  <span className="px-4">✦ &nbsp;{state.settings.bannerConfig.top.text}&nbsp; ✦ &nbsp;{state.settings.bannerConfig.top.text}&nbsp;</span>
              </div>
          </div>
      )}

      {/* IMPERSONATION RETURN BUTTON */}
      {state.originalAdmin && (
          <div className="fixed bottom-24 right-6 z-[90] animate-bounce">
              <button onClick={handleReturnToAdmin} className="bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 border-4 border-white">
                  <EyeOff size={20} /> Exit User View
              </button>
          </div>
      )}

      {!isFullScreen && state.view !== 'STUDENT_DASHBOARD' && !isLessonImmersive && (
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <div onClick={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' as any }))} className="flex items-center gap-2 cursor-pointer">
               <div className="flex items-center gap-3">
                 {state.settings.appLogo ? (
                   <img
                     src={state.settings.appLogo}
                     alt="Logo"
                     className="w-8 h-8 rounded-lg object-contain"
                     onError={(e) => {
                       (e.target as HTMLImageElement).style.display = 'none';
                     }}
                   />
                 ) : (
                   <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                     <BrainCircuit size={20} />
                   </div>
                 )}
                 <h1 className="text-xl font-black text-slate-800">{state.settings.appName}</h1>
               </div>
           </div>
           {state.user && (
               <div className="flex items-center gap-4">
                   {/* STREAK BADGE */}
                   {state.user.role !== 'ADMIN' && (
                       <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full cursor-help group relative">
                           <span className="text-lg">🔥</span>
                           <span className="text-sm font-black text-orange-600">{state.user.streak || 0}</span>
                           <div className="absolute top-full mt-2 right-0 w-48 bg-slate-900 text-white text-[10px] font-bold p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                               Login consecutive days to increase your streak! Current: {state.user.streak || 0} Days
                           </div>
                       </div>
                   )}
                   <div className="text-right hidden md:block">
                       <div className="text-xs font-bold text-slate-800">{state.user.name}</div>
                   </div>
               </div>
           )}
        </div>
      </header>
      )}

      <main id="main-content" className={`flex-1 w-full max-w-6xl mx-auto ${isFullScreen ? 'p-0' : 'p-4 mb-8'}`}>
        {!state.user ? (
            <ErrorBoundary fallbackLabel="Login" compact>
              <Auth onLogin={handleLogin} logActivity={logActivity} appSettings={state.settings} />
            </ErrorBoundary>
        ) : (
            <ErrorBoundary resetKey={state.view}>
            <>
                {state.view === 'ADMIN_DASHBOARD' && (state.user.role === 'ADMIN' || state.user.role === 'SUB_ADMIN') && (
                  <ErrorBoundary fallbackLabel="Admin Dashboard" resetKey={state.view}>
                    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" aria-label="Loading admin dashboard" aria-busy="true"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
                      <AdminDashboard user={state.user} onNavigate={(v) => setState(prev => ({...prev, view: v}))} settings={state.settings} onUpdateSettings={updateSettings} onImpersonate={handleImpersonate} logActivity={logActivity} isDarkMode={darkMode} onToggleDarkMode={setDarkMode} />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {(state.view as any) === 'SCHOOL_ECOSYSTEM' && state.user && (
                  <ErrorBoundary fallbackLabel="School Ecosystem" resetKey="school">
                    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
                      <SchoolEcosystem
                        uid={state.user.id}
                        email={state.user.email || ''}
                        displayName={state.user.name || ''}
                        isSuperAdmin={SCHOOL_SUPER_ADMIN_EMAILS.includes((state.user.email || '').toLowerCase()) || state.user.role === 'ADMIN' || state.user.role === 'SUB_ADMIN'}
                        onBack={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' as any }))}
                        onOpenPlatformContent={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' as any }))}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {(state.view as any) === 'COACHING_ECOSYSTEM' && state.user && (
                  <ErrorBoundary fallbackLabel="Coaching Ecosystem" resetKey="coaching">
                    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
                      <CoachingEcosystem
                        uid={state.user.id}
                        email={state.user.email || ''}
                        displayName={state.user.name || ''}
                        isSuperAdmin={state.user.role === 'ADMIN' || state.user.role === 'SUB_ADMIN'}
                        onBack={() => setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' as any }))}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}
                
                {/* ACTIVE WEEKLY TEST OVERRIDE */}
                {activeWeeklyTest ? (
                    <ErrorBoundary fallbackLabel="Weekly Test" resetKey={activeWeeklyTest.id}>
                      <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen" aria-label="Loading test" aria-busy="true"><div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>}>
                        <WeeklyTestView
                            test={activeWeeklyTest}
                            onComplete={handleWeeklyTestComplete}
                            onExit={() => {
                                setConfirmConfig({
                                    isOpen: true,
                                    title: "Quit Test?",
                                    message: "Are you sure you want to quit the ongoing test?",
                                    onConfirm: () => {
                                        setActiveWeeklyTest(null);
                                        setConfirmConfig(prev => ({...prev, isOpen: false}));
                                    }
                                });
                            }}
                        />
                      </Suspense>
                    </ErrorBoundary>
                ) : (
                    state.view === 'STUDENT_DASHBOARD' as any && (
                        <ErrorBoundary fallbackLabel="Student Dashboard" resetKey={studentTab}>
                          <StudentDashboard 
                              user={state.user} 
                              dailyStudySeconds={dailyStudySeconds} 
                              onSubjectSelect={handleSubjectSelect} 
                              onRedeemSuccess={u => setState(prev => ({...prev, user: u}))} 
                              settings={state.settings} 
                              onStartWeeklyTest={handleStartWeeklyTest} 
                              activeTab={studentTab} 
                              onTabChange={setStudentTab} 
                              setFullScreen={setIsFullScreen}
                              onNavigate={(v) => setState(prev => ({...prev, view: v}))}
                              isImpersonating={!!state.originalAdmin}
                              onNavigateToChapter={handleNavigateToChapterFromHistory}
                              isDarkMode={darkMode}
                              onToggleDarkMode={setDarkMode}
                              onLogout={handleLogout}
                              onUpdateSettings={updateSettings}
                              onRecoverData={() => {
                                  if (cloudUser) {
                                      setShowCloudRecoveryModal(true);
                                  } else {
                                      setToastMessage("Your data is already synced and up to date!");
                                  }
                              }}
                              onOpenSchool={() => setState(prev => ({...prev, view: 'SCHOOL_ECOSYSTEM' as any}))}
                              onOpenCoaching={() => setState(prev => ({...prev, view: 'COACHING_ECOSYSTEM' as any}))}
                          />
                        </ErrorBoundary>
                    )
                )}
                
                {(!activeWeeklyTest && state.view === 'BOARDS') && (
                  <ErrorBoundary fallbackLabel="Board Selection" compact>
                    <BoardSelection onSelect={handleBoardSelect} onBack={goBack} />
                  </ErrorBoundary>
                )}
                {state.view === 'ONBOARDING' && state.user && (
                  <ErrorBoundary fallbackLabel="Onboarding" compact>
                    <Onboarding user={state.user} onComplete={handleLogin} onLogout={handleLogout} />
                  </ErrorBoundary>
                )}
                {state.view === 'CLASSES' && (
                  <ErrorBoundary fallbackLabel="Class Selection" compact>
                    <ClassSelection selectedBoard={state.selectedBoard} allowedClasses={state.user?.role === 'ADMIN' ? undefined : state.settings.allowedClasses} settings={state.settings} user={state.user} onSelect={handleClassSelect} onBack={goBack} onBoardSwitch={(board) => setState(prev => ({ ...prev, selectedBoard: board, language: board === 'BSEB' ? 'Hindi' : 'English' }))} />
                  </ErrorBoundary>
                )}
                {state.view === 'STREAMS' && (
                  <ErrorBoundary fallbackLabel="Stream Selection" compact>
                    <StreamSelection onSelect={handleStreamSelect} onBack={goBack} />
                  </ErrorBoundary>
                )}
                {state.view === 'SUBJECTS' && state.selectedClass && (
                  <ErrorBoundary fallbackLabel="Subject Selection" compact>
                    <SubjectSelection classLevel={state.selectedClass} stream={state.selectedStream} board={state.selectedBoard || undefined} onSelect={handleSubjectSelect} onBack={goBack} settings={state.settings} />
                  </ErrorBoundary>
                )}
                {state.view === 'LESSON' && state.lessonContent && (
                    <ErrorBoundary fallbackLabel="Lesson" resetKey={state.selectedChapter?.id}>
                      <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen" aria-label="Loading lesson" aria-busy="true"><div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>}>
                      {(() => {
                        const _lcVal = state.lessonContent?.content || state.lessonContent?.pdfUrl || state.lessonContent?.videoUrl || '';
                        const _lcIsUrl = _lcVal && (_lcVal.startsWith('http://') || _lcVal.startsWith('https://'));
                        const _isPdfContent = state.lessonContent && (
                          ['PDF_FREE','PDF_PREMIUM','PDF_ULTRA','PDF_VIEWER'].includes(state.lessonContent.type) ||
                          (_lcIsUrl && !['VIDEO_LECTURE','MCQ_ANALYSIS','MCQ_SIMPLE','WEEKLY_TEST'].includes(state.lessonContent.type))
                        );
                        const _isVideoContent = state.lessonContent && (
                          state.lessonContent.type === 'VIDEO_LECTURE' ||
                          (_lcIsUrl && (
                            _lcVal.includes('youtube') || _lcVal.includes('youtu.be') ||
                            _lcVal.includes('drive.google.com') || _lcVal.includes('notebooklm')
                          ))
                        );
                        const _curIdx = state.chapters.findIndex(c => c.id === state.selectedChapter?.id);
                        const _nextChapter = _curIdx >= 0 && _curIdx < state.chapters.length - 1 ? state.chapters[_curIdx + 1] : null;
                        const _pdfContentType = (['PDF_FREE','PDF_PREMIUM','PDF_ULTRA','PDF_VIEWER'].includes(state.lessonContent?.type || ''))
                          ? state.lessonContent!.type as any
                          : 'PDF_FREE';
                        const _handleNextPdf = (_isPdfContent && _nextChapter) ? () => onChapterClick(_nextChapter, _pdfContentType) : undefined;
                        const _handleNextVideo = (_isVideoContent && _nextChapter) ? () => onChapterClick(_nextChapter, state.lessonContent!.type as any) : undefined;
                        const _handleNext = _handleNextVideo || _handleNextPdf;
                        const _isFirstChapter = state.selectedClass !== 'COMPETITION' && _curIdx === 0;
                        return (
                          <LessonView
                              content={state.lessonContent}
                              subject={state.selectedSubject!}
                              classLevel={state.selectedClass!}
                              chapter={state.selectedChapter!}
                              loading={state.loading && !isStreaming}
                              onBack={goBack}
                              onMCQComplete={handleMCQComplete}
                              user={state.user}
                              settings={state.settings}
                              isStreaming={isStreaming}
                              onLaunchContent={(c: any) => handleContentGeneration(c.isPremium ? 'NOTES_PREMIUM' : 'NOTES_HTML_FREE', undefined, false, c)}
                              onToggleAutoTts={handleToggleAutoTts}
                              onImmersiveChange={setIsLessonImmersive}
                              onNext={_handleNext}
                              nextTitle={_nextChapter?.title}
                              isFirstChapter={_isFirstChapter}
                              onAdminBoard={(state.user?.role === 'ADMIN' || state.user?.role === 'SUB_ADMIN') ? () => setState(prev => ({...prev, view: 'ADMIN'})) : undefined}
                              onSendToMcqCommunity={(draft) => setAppMcqCommunityDraft(draft)}
               onAdminEdit={(state.user?.role === 'ADMIN' || state.user?.role === 'SUB_ADMIN') ? () => {
                                try {
                                  const ch = state.selectedChapter;
                                  const sub = state.selectedSubject;
                                  const cls = state.selectedClass;
                                  if (ch && sub && cls) {
                                    localStorage.setItem('nst_admin_edit_pending', JSON.stringify({ chapterId: ch.id, chapterTitle: ch.title, subjectName: sub.name, classLevel: cls, board: state.selectedBoard }));
                                  }
                                } catch {}
                                setState(prev => ({...prev, view: 'ADMIN'}));
                              } : undefined}
                          />
                        );
                      })()}
                      </Suspense>
                    </ErrorBoundary>
                )}
            </>
            </ErrorBoundary>
        )}
      
      {/* MCQ Community popup — triggered from LessonView */}
      {appMcqCommunityDraft && state.user && (
        <div className="fixed inset-0 z-[400]" onClick={() => setAppMcqCommunityDraft(null)}>
          <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={null}>
              <UniversalChat
                user={state.user}
                onClose={() => setAppMcqCommunityDraft(null)}
                isAdmin={false}
                defaultTab="MCQ"
                initialMcqDraft={appMcqCommunityDraft}
              />
            </Suspense>
          </div>
        </div>
      )}
</main>
      
      {/* PERSISTENT FOOTER - Hide in Student Dashboard as it has its own Bottom Nav */}
      {!isFullScreen && state.view !== 'STUDENT_DASHBOARD' && state.settings.showFooter !== false && !isLessonImmersive && (
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-1 text-center z-[40]">
          <p
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: state.settings.footerColor || '#94a3b8' }}
          >
              {state.settings.footerText || ''}
          </p>
      </footer>
      )}

      {/* GLOBAL LIVE DASHBOARD 2 (BOTTOM) */}
      {state.settings.bannerConfig?.bottom?.enabled && showBottomBanner && (
          <div
            className={`banner-premium-shimmer fixed bottom-6 left-0 right-0 text-[11px] font-black tracking-widest uppercase py-1.5 overflow-hidden relative whitespace-nowrap z-[39] transition-all duration-500 ease-in-out ${state.settings.bannerConfig.bottom.clickUrl ? 'cursor-pointer active:opacity-70' : ''}`}
            style={{
                background: state.settings.bannerConfig.bottom.bgColor
                    ? `linear-gradient(90deg, ${state.settings.bannerConfig.bottom.bgColor}ee, ${state.settings.bannerConfig.bottom.bgColor}cc, ${state.settings.bannerConfig.bottom.bgColor}ee)`
                    : 'linear-gradient(90deg, #2563eb, #1d4ed8, #2563eb)',
                color: state.settings.bannerConfig.bottom.textColor || '#ffffff',
                height: showBottomBanner ? 'auto' : '0',
                opacity: showBottomBanner ? 1 : 0,
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
            onClick={() => {
                try { if (navigator.vibrate) navigator.vibrate(25); } catch {}
                const liveUrl = state.settings.bannerConfig?.bottom?.liveVideoUrl;
                if (liveUrl) {
                    setState(prev => ({ ...prev, lessonContent: { id: 'banner-live-bottom', title: state.settings.bannerConfig!.bottom.text || 'Live Class', subtitle: '🔴 Live', content: liveUrl, type: 'VIDEO_LECTURE', dateCreated: new Date().toISOString(), subjectName: 'Live' }, view: 'LESSON' }));
                    return;
                }
                const url = state.settings.bannerConfig?.bottom?.clickUrl;
                if (url) setInAppBrowserUrl(url);
            }}
          >
              <div className="animate-marquee-reverse">
                  <span className="px-4">✦ &nbsp;{state.settings.bannerConfig.bottom.text}&nbsp; ✦ &nbsp;{state.settings.bannerConfig.bottom.text}&nbsp;</span>
                  <span className="px-4">✦ &nbsp;{state.settings.bannerConfig.bottom.text}&nbsp; ✦ &nbsp;{state.settings.bannerConfig.bottom.text}&nbsp;</span>
              </div>
          </div>
      )}

      {state.loading && <LoadingOverlay dataReady={generationDataReady} customMessage={loadingMessage} type={loadingContentType} onComplete={handleLoadingAnimationComplete} />}
      {showPremiumModal && tempSelectedChapter && state.user && (
          <PremiumModal
              user={state.user}
              chapter={tempSelectedChapter}
              credits={state.user.credits || 0}
              isAdmin={state.user.role === 'ADMIN'}
              onSelect={handleContentGeneration}
              onClose={() => setShowPremiumModal(false)}
              board={state.selectedBoard!}
              classLevel={state.selectedClass!}
              stream={state.selectedStream}
              subject={state.selectedSubject!}
              settings={state.settings}
              isFlashSaleActive={isFlashSaleActive}
          />
      )}
      

      {/* LOGIN STREAK POPUP */}
      {streakLoginPopup && state.user && (
        <StreakLoginPopup
          newStreak={streakLoginPopup.newStreak}
          prevStreak={streakLoginPopup.prevStreak}
          isNewRecord={streakLoginPopup.isNewRecord}
          onClose={() => setStreakLoginPopup(null)}
          language={state.language}
        />
      )}

      {/* LEVEL-UP NOTIFICATION */}
      {levelUpNotif && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto mx-4 rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-500"
            style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)', border: `2px solid ${levelUpNotif.color}40`, boxShadow: `0 0 40px ${levelUpNotif.color}30` }}
          >
            <div className="text-5xl mb-3 animate-bounce">{levelUpNotif.emoji}</div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: levelUpNotif.color }}>LEVEL UP!</p>
            <p className="text-2xl font-black text-white mb-1">Level {levelUpNotif.level} — {levelUpNotif.label}</p>
            <p className="text-sm text-white/50 mb-5">Badhaai ho! Naya level unlock hua 🎉</p>
            <button
              onClick={() => setLevelUpNotif(null)}
              className="px-8 py-2.5 rounded-xl text-sm font-black text-white transition-all active:scale-95"
              style={{ background: levelUpNotif.color }}
            >
              Shukriya!
            </button>
          </div>
        </div>
      )}
      
      {/* POPUP QUEUE MANAGER */}
      {/* {popupQueue.length > 0 && !showPremiumModal && !activeWeeklyTest && (
          <>
            {popupQueue[0] === 'CHALLENGE' && (
                <DailyChallengePopup
                    onStart={handleStartDailyChallenge}
                    onClose={() => handlePopupClose('CHALLENGE')}
                    rewardPercentage={state.settings.dailyChallengeConfig?.rewardPercentage || 90}
                />
            )}
          </>
      )} */}

      {lastTestResult && state.user && (
        <Suspense fallback={null}>
          <MarksheetCard
              result={lastTestResult}
              user={state.user}
              settings={state.settings}
              questions={lastTestQuestions || undefined} // Pass full questions for analysis
              onClose={() => {
                  setLastTestResult(null);
                  setLastTestQuestions(null);
              }}
              onLaunchContent={(c: any) => {
                  setLastTestResult(null);
                  setLastTestQuestions(null);
                  handleContentGeneration(c.isPremium ? 'NOTES_PREMIUM' : 'NOTES_HTML_FREE', undefined, false, c);
              }}
              onPublish={() => {
                  const percentage = Math.round((lastTestResult.score / lastTestResult.totalQuestions) * 100);
                  const activity = {
                      id: lastTestResult.id,
                      userId: state.user!.id,
                      userName: state.user!.name,
                      testName: lastTestResult.chapterTitle,
                      score: lastTestResult.score,
                      total: lastTestResult.totalQuestions,
                      percentage: percentage,
                      timestamp: new Date().toISOString()
                  };
                  savePublicActivity(activity);
                  setAlertConfig({isOpen: true, message: "Result published!"});
              }}
          />
        </Suspense>
      )}

      {creditModal && state.user && (
          <CreditConfirmationModal
              title={creditModal.title}
              cost={creditModal.cost}
              userCredits={getTotalCredits(state.user)}
              isAutoEnabledInitial={!!localStorage.getItem(`nst_credit_skip_${state.user.id}_${new Date().toISOString().split('T')[0]}`)}
              onConfirm={creditModal.onConfirm}
              onCancel={() => setCreditModal(null)}
          />
      )}

      {/* GLOBAL DIALOGS */}
      <CustomAlert
          isOpen={alertConfig.isOpen}
          message={alertConfig.message}
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})}
      />
      <CustomConfirm
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
      />

      <PwaInstallPrompt />

      {showUpdatePopup && state.settings.latestVersion && state.settings.updateUrl && (
          <UpdatePopup
              latestVersion={state.settings.latestVersion}
              updateUrl={state.settings.updateUrl}
              launchDate={state.settings.launchDate}
              gracePeriodDays={state.settings.updateGracePeriodDays}
              gracePeriod={state.settings.updateGracePeriod}
              durationSeconds={state.settings.updatePopupDurationSeconds}
              onClose={() => {
                  setShowUpdatePopup(false);
                  localStorage.setItem(`nst_update_dismissed_${state.settings.latestVersion}`, Date.now().toString());
              }}
          />
      )}

      {/* ============================================================ */}
      {/* IN-APP BROWSER OVERLAY — banner tap se khulta hai            */}
      {/* ============================================================ */}
      {inAppBrowserUrl && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white" style={{paddingTop: 'env(safe-area-inset-top)'}}>
              {/* Top bar */}
              <div className="relative flex items-center gap-2 px-3 py-2 shrink-0 overflow-hidden" style={{
                minHeight: '52px',
                background: 'linear-gradient(135deg,#0d0d20 0%,#1a0a35 60%,#0a1020 100%)',
              }}>
                {/* Subtle shimmer */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'linear-gradient(105deg,transparent 30%,rgba(139,92,246,0.08) 50%,transparent 70%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 3s linear infinite',
                }} />
                {/* Back button — glow */}
                <button
                    onClick={() => setInAppBrowserUrl(null)}
                    className="relative p-2 rounded-full transition-all active:scale-90 shrink-0"
                    style={{
                      background: 'rgba(139,92,246,0.15)',
                      border: '1px solid rgba(139,92,246,0.4)',
                      boxShadow: '0 0 10px rgba(139,92,246,0.4), inset 0 0 6px rgba(139,92,246,0.1)',
                      color: '#c4b5fd',
                    }}
                    aria-label="Back"
                >
                    <ArrowLeft size={18} />
                </button>

                {/* EXCLUSIVE MCQ badge — center */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full overflow-hidden" style={{
                    background: 'linear-gradient(90deg,rgba(139,92,246,0.2),rgba(99,102,241,0.15),rgba(139,92,246,0.2))',
                    border: '1px solid rgba(139,92,246,0.45)',
                    boxShadow: '0 0 14px rgba(139,92,246,0.3)',
                  }}>
                    {/* Inner shimmer */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'linear-gradient(105deg,transparent 20%,rgba(196,181,253,0.15) 50%,transparent 80%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer-sweep 2.5s linear infinite',
                    }} />
                    <span className="text-sm relative z-10" style={{ animation: 'sparkle-blink 2s ease-in-out infinite' }}>⚡</span>
                    <span className="relative z-10 font-black tracking-[0.15em] text-xs uppercase" style={{
                      background: 'linear-gradient(90deg,#a78bfa,#e0d7ff,#c4b5fd,#818cf8,#e0d7ff,#a78bfa)',
                      backgroundSize: '300% 100%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'shimmer-sweep 2s linear infinite',
                    }}>Exclusive MCQ</span>
                    <span className="text-sm relative z-10" style={{ animation: 'sparkle-blink 2s ease-in-out infinite 0.5s' }}>⚡</span>
                  </div>
                </div>

                {/* Close button — glow */}
                <button
                    onClick={() => setInAppBrowserUrl(null)}
                    className="relative p-2 rounded-full transition-all active:scale-90 shrink-0"
                    style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      boxShadow: '0 0 10px rgba(239,68,68,0.3), inset 0 0 6px rgba(239,68,68,0.08)',
                      color: '#fca5a5',
                    }}
                    aria-label="Close"
                >
                    <X size={18} />
                </button>
              </div>

              {/* iframe */}
              <iframe
                  src={inAppBrowserUrl}
                  className="flex-1 w-full border-none"
                  title="In-App Browser"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
          </div>
      )}
    </div>
    <CreditToast />
    </ErrorBoundary>
  );
};
export default App;
