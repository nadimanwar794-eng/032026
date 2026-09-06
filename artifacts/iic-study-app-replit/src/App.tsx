// @ts-nocheck
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { 
  ClassLevel, Subject, Chapter, AppState, Board, Stream, User, ContentType, SystemSettings, ActivityLogEntry, WeeklyTest, LessonContent, ActiveSubscription, InboxMessage
} from './types';
import { getChapterData, saveChapterData, checkFirebaseConnection, saveTestResult, saveUserToLive, updateUserStatus, getUserData, subscribeToSettings, subscribeToUser, auth, savePublicActivity, saveUserHistory, getUserSavedNotes, rtdb, db, saveDailyChallengeScore } from './firebase';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { doc as fsDoc, setDoc as fsSetDoc } from 'firebase/firestore';
import { storage } from './utils/storage';
import { recalculateSubscriptionStatus, addSubscription } from './utils/subscriptionUtils';
import { getLevelInfo, getLevelLimitBonus, getEffectiveDailyLimit, UNLIMITED } from './utils/levelSystem';
import { fireCreditNotify, setHomeTabActive } from './utils/creditNotify';
import { onSessionComplete, queueSession, consumeSessionQueue, SessionCompletePayload } from './utils/sessionNotify';
import { HomeToastNotification, type HomeToastData } from './components/HomeToastNotification';
import { recordActivityEntry } from './utils/loginHistory';
import { loadRoutineData } from './utils/routineStorage';
import { hydrateRevisionTracker } from './utils/revisionFirebase';
import { setRevisionTrackerUser } from './utils/revisionTrackerV2';
import { hydrateRoutineData } from './utils/routineFirebaseSync';
import { applyDeduction, getTotalCredits } from './utils/creditSystem';
import { consumeDeferredStudyCoins } from './utils/studyRewards';
import { signInAnonymously } from 'firebase/auth';
import { fetchChapters, fetchLessonContent } from './services/groq';
import { AppLoadingScreen } from './components/AppLoadingScreen';
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
import { FreeSubjectLessonPopup } from './components/FreeSubjectLessonPopup';
import { McqLimitLockedPopup } from './components/McqLimitLockedPopup';

import { StreakLoginPopup } from './components/StreakLoginPopup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logErrorToFirebase, setErrorLoggerUser } from './utils/errorLogger';
import { MaintenanceBanner, AdminCrashPopup } from './components/MaintenanceScreen';
import { subscribeToMaintenance, markCrashFixed, reportCrash as reportMaintenanceCrash } from './utils/maintenanceManager';
import { initPerfMode } from './utils/performanceMode';
import { CreditToast } from './components/CreditToast';
import { HomeStatsToast } from './components/HomeStatsToast';
import { DailyChallengeRankCard } from './components/DailyChallengeRankCard';
import { DailyChallengePopup } from './components/DailyChallengePopup';
import { recordCreditTx } from './utils/creditHistory';
import { generateDailyChallengeQuestions, getChallengeDateKey, getChallengeWeekKey, isDailyChallenge20 } from './utils/challengeGenerator';
import { BrainCircuit, Globe, LogOut, LayoutDashboard, BookOpen, Headphones, HelpCircle, Newspaper, KeyRound, Lock, X, ShieldCheck, FileText, UserPlus, EyeOff, WifiOff, Cloud, ArrowLeft, ExternalLink } from 'lucide-react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { SUPPORT_EMAIL, APP_VERSION } from './constants';
import { StudentTab, PendingReward, MCQResult, SubscriptionHistoryEntry } from './types';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [maintenanceState, setMaintenanceState] = useState<any>(null);
  const [adminDashCrashed, setAdminDashCrashed] = useState(false);
  const [showAdminCrashPopup, setShowAdminCrashPopup] = useState(false);

  const [appMcqCommunityDraft, setAppMcqCommunityDraft] = useState<{question: string; options: [string,string,string,string]; correctAnswer: number; explanation: string} | null>(null);

  const [isAppLoading, setIsAppLoading] = useState(() => sessionStorage.getItem('nst_has_loaded') !== 'true');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => { initPerfMode(); }, []);

  // ── Immortal Storage: 30-din purani history cleanup (app open hone par) ──
  useEffect(() => {
    import('./utils/lessonStorage').then(({ runHistoryCleanup }) => {
      runHistoryCleanup();
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAppLoading) {
      sessionStorage.setItem('nst_has_loaded', 'true');
    }
  }, [isAppLoading]);

  // Profile se loading-screen preview request aaye to sirf animation dikhayein,
  // phir user ko usi page par wapas laayein.
  useEffect(() => {
    const previewLoadingScreen = (event: Event) => {
      const previewEvent = event as CustomEvent<{ styleId?: number }>;
      if (previewEvent.detail?.styleId) {
        sessionStorage.setItem('nst_splash_preview_style', String(previewEvent.detail.styleId));
      }
      setIsLoadingPreview(true);
      setIsAppLoading(true);
    };
    window.addEventListener('iic-preview-loading-screen', previewLoadingScreen);
    return () => window.removeEventListener('iic-preview-loading-screen', previewLoadingScreen);
  }, []);

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
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      if (!localStorage.getItem('nst_dark_theme_type')) {
        localStorage.setItem('nst_dark_theme_type', 'blue');
      }
    }
    return prefersDark;
  });
  const [darkThemeRevision, setDarkThemeRevision] = useState(0);

  useEffect(() => {
    const refreshDarkTheme = () => setDarkThemeRevision(value => value + 1);
    window.addEventListener('nst-dark-theme-change', refreshDarkTheme);
    return () => window.removeEventListener('nst-dark-theme-change', refreshDarkTheme);
  }, []);

  const [isFlashSaleActive, setIsFlashSaleActive] = useState(false);

  useEffect(() => {
      setIsFlashSaleActive(false);
  }, []);

  useEffect(() => {
      document.documentElement.classList.remove('dark-mode', 'dark-mode-blue', 'dark-mode-black');
      if (darkMode) {
         const themeType = localStorage.getItem('nst_dark_theme_type') || 'black';
         document.documentElement.classList.add('dark-mode');
         document.documentElement.classList.add(themeType === 'blue' ? 'dark-mode-blue' : 'dark-mode-black');
      }
      localStorage.setItem('nst_dark_mode', darkMode.toString());
   }, [darkMode, darkThemeRevision]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
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
        appName: 'NSTA',
        appShortName: 'NSTA',
        aiName: 'NSTA AI',
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [activeWeeklyTest, setActiveWeeklyTest] = useState<WeeklyTest | null>(null);
  const [studentTab, setStudentTab] = useState<StudentTab>('HOME');

  const [showTopBanner, setShowTopBanner] = useState(true);
  const [showBottomBanner, setShowBottomBanner] = useState(true);
  const [inAppBrowserUrl, setInAppBrowserUrl] = useState<string | null>(null);

  useEffect(() => {
      if (state.settings?.globalCards3D) {
          document.documentElement.classList.add('global-cards-3d');
      } else {
          document.documentElement.classList.remove('global-cards-3d');
      }
  }, [state.settings?.globalCards3D]);

  // Card Rotating Border Animation Handler (Global Admin toggle + Student Profile preference + Theme color awareness)
  useEffect(() => {
      const updateBorderAnim = () => {
          const adminEnabled = state.settings?.cardBorderAnimation !== false; // Active by default
          const studentOff = localStorage.getItem('nst_card_border_anim_off') === '1';
          if (adminEnabled && !studentOff) {
              document.documentElement.classList.add('global-rotating-border-cards');
          } else {
              document.documentElement.classList.remove('global-rotating-border-cards');
          }

          const isBlue = document.documentElement.classList.contains('dark-mode-blue');
          const isDark = document.documentElement.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode-black');
          const color = isBlue
            ? (state.settings?.blueThemeColor || '#38bdf8')
            : isDark
            ? (state.settings?.darkThemeColor || '#00e5ff')
            : (state.settings?.lightThemeColor || '#3b82f6');
          document.documentElement.style.setProperty('--nst-rotating-border-color', color);
          document.documentElement.style.setProperty('--nst-card-inner-bg', isBlue ? (state.settings?.blueThemeCardBg || '#071224') : isDark ? (state.settings?.darkThemeCardBg || '#0b0f17') : (state.settings?.lightThemeCardBg || '#ffffff'));
      };

      updateBorderAnim();
      window.addEventListener('nst-card-border-anim-change', updateBorderAnim);
      window.addEventListener('nst-dark-theme-change', updateBorderAnim);
      return () => {
          window.removeEventListener('nst-card-border-anim-change', updateBorderAnim);
          window.removeEventListener('nst-dark-theme-change', updateBorderAnim);
      };
  }, [state.settings?.cardBorderAnimation, state.settings?.lightThemeColor, state.settings?.darkThemeColor, state.settings?.blueThemeColor, state.settings?.lightThemeCardBg, state.settings?.darkThemeCardBg, state.settings?.blueThemeCardBg]);

  // Card Rotating Border Animation Handler (Global Admin toggle + Student Profile preference + Theme color awareness)
  useEffect(() => {
      const updateBorderAnim = () => {
          const adminEnabled = state.settings?.cardBorderAnimation !== false; // Active by default
          const studentOff = localStorage.getItem('nst_card_border_anim_off') === '1';
          if (adminEnabled && !studentOff) {
              document.documentElement.classList.add('global-rotating-border-cards');
          } else {
              document.documentElement.classList.remove('global-rotating-border-cards');
          }

          const isBlue = document.documentElement.classList.contains('dark-mode-blue');
          const isDark = document.documentElement.classList.contains('dark-mode') || document.documentElement.classList.contains('dark-mode-black');
          const color = isBlue
            ? (state.settings?.blueThemeColor || '#38bdf8')
            : isDark
            ? (state.settings?.darkThemeColor || '#00e5ff')
            : (state.settings?.lightThemeColor || '#3b82f6');
          document.documentElement.style.setProperty('--nst-rotating-border-color', color);
          document.documentElement.style.setProperty('--nst-card-inner-bg', isBlue ? (state.settings?.blueThemeCardBg || '#071224') : isDark ? (state.settings?.darkThemeCardBg || '#0b0f17') : (state.settings?.lightThemeCardBg || '#ffffff'));
      };

      updateBorderAnim();
      window.addEventListener('nst-card-border-anim-change', updateBorderAnim);
      window.addEventListener('nst-dark-theme-change', updateBorderAnim);
      return () => {
          window.removeEventListener('nst-card-border-anim-change', updateBorderAnim);
          window.removeEventListener('nst-dark-theme-change', updateBorderAnim);
      };
  }, [state.settings?.cardBorderAnimation, state.settings?.lightThemeColor, state.settings?.darkThemeColor, state.settings?.blueThemeColor, state.settings?.lightThemeCardBg, state.settings?.darkThemeCardBg, state.settings?.blueThemeCardBg]);

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
        if (saved && saved !== 'COURSES' && saved !== 'PDF' && saved !== 'MCQ' && saved !== 'VIDEO' && saved !== 'AUDIO') {
            setStudentTab(saved);
        }
    });
  }, []);

  const [activeReward, setActiveReward] = useState<PendingReward | null>(null);

  useEffect(() => {
    if (studentTab === 'HOME' || studentTab === 'HOMEWORK' || studentTab === 'HISTORY' || studentTab === 'PROFILE' || studentTab === 'COMMUNITY_SUPPORT') {
      setShowTopBanner(true);
      setShowBottomBanner(true);
    }
  }, [studentTab]);

  useEffect(() => {
    if (studentTab !== 'HOME') return;
    const user = state.user;
    if (!user?.id) return;

    const deferredStudyCoins = consumeDeferredStudyCoins(user.id);
    if (deferredStudyCoins > 0) {
      const updatedUser = { ...user, credits: (user.credits || 0) + deferredStudyCoins };
      setState(prev => ({ ...prev, user: updatedUser }));
      saveUserToLive(updatedUser);
    }

    const syncKey = `nst_credit_sync_score_${user.id}`;
    const raw = localStorage.getItem(syncKey);
    const currentScore = user.totalScore || 0;
    let xpDeltaFromSync = 0;

    if (raw === null) {
      localStorage.setItem(syncKey, String(currentScore));
    } else {
      const lastSynced = parseInt(raw, 10);
      const delta = currentScore - lastSynced;
      if (delta > 0) {
        xpDeltaFromSync = delta;
        localStorage.setItem(syncKey, String(currentScore));
      }
    }

    let queue = consumeSessionQueue();
    if (queue.length === 0) {
      if (deferredStudyCoins <= 0) return;
      queue = [{
        type: 'LESSON',
        subject: '',
        chapter: 'Study Rewards',
        timeSecs: 0,
        activityType: 'Study',
        coinsEarned: deferredStudyCoins,
        sessionScore: xpDeltaFromSync > 0 ? xpDeltaFromSync : undefined,
      }];
    } else if (deferredStudyCoins > 0) {
      const reportedCoins = queue.reduce((sum, session) => sum + (session.coinsEarned || 0), 0);
      const missingCoins = Math.max(0, deferredStudyCoins - reportedCoins);
      if (missingCoins > 0) {
        const last = queue.length - 1;
        queue[last] = {
          ...queue[last],
          coinsEarned: (queue[last].coinsEarned || 0) + missingCoins,
        };
      }
    }

    const discount = getLevelInfo(user.totalScore || 0).discount;
    const augmentedQueue = queue.map(sess => {
      const bonusPts = sess.sessionScore != null && sess.sessionScore > 0
        ? Math.round(sess.sessionScore * discount / 100)
        : 0;
      if (sess.sessionScore != null && user.id) {
        const actLabel = (sess.activityType === 'MCQ' || sess.type === 'MCQ') ? 'MCQ'
          : sess.activityType === 'Writing' ? 'Writing Notes' : 'Reading Notes';
        recordCreditTx(
          user.id,
          sess.coinsEarned || 0,
          `EARN_SESSION_${(sess.activityType || sess.type || 'MCQ').toUpperCase()}`,
          [actLabel, sess.chapter].filter(Boolean).join(' · ') || 'Study Session',
          user.credits,
          sess.sessionScore,
          bonusPts,
          sess.timeSecs,
          sess.activityType || sess.type,
          sess.chapter,
        );
      }
      return { ...sess, bonusPts };
    });

    const totalPtsEarned   = augmentedQueue.reduce((a, s) => a + (s.sessionScore  ?? 0), 0);
    const totalBonusEarned = augmentedQueue.reduce((a, s) => a + (s.bonusPts      ?? 0), 0);
    const totalCredEarned  = deferredStudyCoins > 0
      ? deferredStudyCoins
      : augmentedQueue.reduce((a, s) => a + (s.coinsEarned ?? 0) + (s.creditsEarned ?? 0), 0);
    const xpAfter          = user.totalScore || 0;
    const xpBefore         = Math.max(0, xpAfter - totalPtsEarned - totalBonusEarned);
    const creditsBefore    = user.credits || 0;
    const creditsAfter     = creditsBefore + totalCredEarned;

    if ((totalPtsEarned + totalBonusEarned > 0 || totalCredEarned > 0) && user.id) {
      recordActivityEntry(user.id, {
        activities: [...new Set(augmentedQueue.map(s => s.activityType || s.type || 'Study'))],
        chapter:   augmentedQueue.length === 1 ? augmentedQueue[0].chapter : undefined,
        subject:   augmentedQueue.length === 1 ? augmentedQueue[0].subject : undefined,
        ptsEarned:     totalPtsEarned,
        bonusPts:      totalBonusEarned,
        creditsEarned: totalCredEarned,
        xpBefore, xpAfter,
        creditsBefore, creditsAfter,
        timeSecs: augmentedQueue.reduce((a, s) => a + (s.timeSecs ?? 0), 0),
      });

      setHomeToastData({
        xpBefore, xpEarned: totalPtsEarned + totalBonusEarned, xpAfter,
        creditsBefore, creditsEarned: totalCredEarned, creditsAfter,
      });
    }

    applySessionQueue(augmentedQueue);
  }, [studentTab, state.user?.id]);

  useEffect(() => {
    storage.setItem('nst_active_student_tab', studentTab);
  }, [studentTab]);
  
  const [streakLoginPopup, setStreakLoginPopup] = useState<{newStreak: number; prevStreak: number; isNewRecord: boolean} | null>(null);
  const [levelUpNotif, setLevelUpNotif] = useState<{level: number; label: string; emoji: string; color: string} | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const homeTabActiveRef = useRef(false);
  useEffect(() => { homeTabActiveRef.current = studentTab === 'HOME'; }, [studentTab]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const enqueueMcqAndShow = (earned: number, earnedC: number, secs: number) => {
    let finalCoins = earnedC;
    const _sessUser = state.user;
    if (earned > 0 && _sessUser?.id) {
      const routineOn = loadRoutineData(_sessUser.id).enabled;
      const ratio = routineOn ? (1 / 6) : 0.125;
      const expectedCoins = Math.floor(earned * ratio);
      finalCoins = Math.max(earnedC, expectedCoins);
      localStorage.setItem(`nst_credit_sync_score_${_sessUser.id}`, String(_sessUser.totalScore || 0));
    }
    queueSession({
      type: 'MCQ',
      subject: '',
      chapter: mcqChapterNameRef.current,
      timeSecs: secs,
      coinsEarned: finalCoins,
      sessionScore: earned,
      activityType: mcqActivityTypeRef.current,
    });
    if (homeTabActiveRef.current) {
      const queue = consumeSessionQueue();
      applySessionQueue(queue);
      const _u = state.user;
      if (_u) {
        const _discount = getLevelInfo(_u.totalScore || 0).discount;
        const _bonusPts = earned > 0 ? Math.round(earned * _discount / 100) : 0;
        const _xpEarned = earned + _bonusPts;
        if (_xpEarned > 0 || finalCoins > 0) {
          const _xpAfter = _u.totalScore || 0;
          const _xpBefore = Math.max(0, _xpAfter - _xpEarned);
          const _creditsAfter = _u.credits || 0;
          const _creditsBefore = Math.max(0, _creditsAfter - finalCoins);
          setHomeToastData({
            xpBefore: _xpBefore, xpEarned: _xpEarned, xpAfter: _xpAfter,
            creditsBefore: _creditsBefore, creditsEarned: finalCoins, creditsAfter: _creditsAfter,
          });
        }
      }
    }
  };

  const mcqSessionSecondsRef = useRef(0);
  const scoreAtSessionStartRef = useRef(0);
  const creditsAtSessionStartRef = useRef(0);
  const sessionStartTimeRef = useRef(0);
  const userTotalScoreRef = useRef(0);
  const userCreditsRef = useRef(0);
  const awaitingPostMcqDataRef = useRef(false);
  const sessionEndProcessedRef = useRef(false);
  const revisionHubOpenRef = useRef(false);
  const pendingHomeStatsRef = useRef(false);

  const [mcqJustEnded, setMcqJustEnded] = useState(false);
  const mcqFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mcqJustEnded) return;
    const snapScore = userTotalScoreRef.current;
    const snapCredits = userCreditsRef.current;
    const snapStart = scoreAtSessionStartRef.current;
    const snapStartC = creditsAtSessionStartRef.current;
    const snapSecs = mcqSessionSecondsRef.current;
    mcqFallbackTimerRef.current = setTimeout(() => {
      if (!awaitingPostMcqDataRef.current) return;
      awaitingPostMcqDataRef.current = false;
      const earned = Math.max(0, snapScore - snapStart);
      const earnedC = Math.max(0, snapCredits - snapStartC);
      setMcqSessionScore(earned);
      setMcqSessionCredits(earnedC);
      setMcqJustEnded(false);
      enqueueMcqAndShow(earned, earnedC, snapSecs);
    }, 1500);
    return () => { if (mcqFallbackTimerRef.current) clearTimeout(mcqFallbackTimerRef.current); };
  }, [mcqJustEnded]);

  const [inMcqSession, setInMcqSession] = useState(false);
  const [mcqSessionScore, setMcqSessionScore] = useState(0);
  const [mcqSessionCredits, setMcqSessionCredits] = useState(0);
  const [mcqSessionSeconds, setMcqSessionSeconds] = useState(0);
  const [mcqChapterName, setMcqChapterName] = useState('');
  const [mcqActivityType, setMcqActivityType] = useState('MCQ');
  const mcqChapterNameRef = useRef('');
  const mcqActivityTypeRef = useRef('MCQ');
  useEffect(() => { mcqChapterNameRef.current = mcqChapterName; }, [mcqChapterName]);
  useEffect(() => { mcqActivityTypeRef.current = mcqActivityType; }, [mcqActivityType]);
  useEffect(() => { mcqSessionSecondsRef.current = mcqSessionSeconds; }, [mcqSessionSeconds]);
  useEffect(() => { userTotalScoreRef.current = state.user?.totalScore || 0; }, [state.user?.totalScore]);
  useEffect(() => { userCreditsRef.current = state.user?.credits || 0; }, [state.user?.credits]);

  useEffect(() => {
    if (!awaitingPostMcqDataRef.current) return;
    awaitingPostMcqDataRef.current = false;
    if (mcqFallbackTimerRef.current) { clearTimeout(mcqFallbackTimerRef.current); mcqFallbackTimerRef.current = null; }
    const earned = Math.max(0, (state.user?.totalScore || 0) - scoreAtSessionStartRef.current);
    const earnedC = Math.max(0, (state.user?.credits || 0) - creditsAtSessionStartRef.current);
    setMcqSessionScore(earned);
    setMcqSessionCredits(earnedC);
    setMcqJustEnded(false);
    enqueueMcqAndShow(earned, earnedC, mcqSessionSecondsRef.current);
    if (revisionHubOpenRef.current) { pendingHomeStatsRef.current = true; }
  }, [state.user?.totalScore, state.user?.credits]);

  useEffect(() => {
    const openHandler = () => { revisionHubOpenRef.current = true; };
    const closeHandler = () => {
      revisionHubOpenRef.current = false;
      if (pendingHomeStatsRef.current) {
        pendingHomeStatsRef.current = false;
        if (homeTabActiveRef.current) {
          setTimeout(() => {
            const queue = consumeSessionQueue();
            applySessionQueue(queue);
          }, 300);
        }
      }
    };
    window.addEventListener('iic-revision-hub-opened', openHandler);
    window.addEventListener('iic-revision-hub-closed', closeHandler);
    return () => {
      window.removeEventListener('iic-revision-hub-opened', openHandler);
      window.removeEventListener('iic-revision-hub-closed', closeHandler);
    };
  }, []);

  const pendingLessonCreditsRef = useRef(0);
  const handleSessionCreditsEarned = useCallback((credits: number) => {
    if (credits <= 0) return;
    pendingLessonCreditsRef.current += credits;
  }, []);

  useEffect(() => {
    if (studentTab !== 'HOME') return;
    return undefined;
  }, [studentTab]);

  useEffect(() => { setHomeTabActive(studentTab === 'HOME'); }, [studentTab]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      const { active, chapterName, subjectName, activityType } = detail;
      setInMcqSession(active);
      if (active) {
        scoreAtSessionStartRef.current = userTotalScoreRef.current;
        creditsAtSessionStartRef.current = userCreditsRef.current;
        sessionStartTimeRef.current = Date.now();
        sessionEndProcessedRef.current = false;
        if (chapterName) setMcqChapterName([chapterName, subjectName].filter(Boolean).join(' · '));
        if (activityType) setMcqActivityType(activityType);
      } else {
        if (sessionStartTimeRef.current === 0) return;
        if (sessionEndProcessedRef.current) return;
        sessionEndProcessedRef.current = true;
        const elapsedSec = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        setMcqSessionSeconds(elapsedSec);
        sessionStartTimeRef.current = 0;
        awaitingPostMcqDataRef.current = true;
        setMcqJustEnded(true);
      }
    };
    window.addEventListener('iic-mcq-session', handler);
    return () => window.removeEventListener('iic-mcq-session', handler);
  }, []);

  const [lastTestResult, setLastTestResult] = useState<MCQResult | null>(null);
  const [lastTestQuestions, setLastTestQuestions] = useState<MCQItem[] | null>(null);
  const [showDailyRankCard, setShowDailyRankCard] = useState(false);
  const [pendingSessionSummary, setPendingSessionSummary] = useState<SessionCompletePayload | null>(null);
  const [groupedSessions, setGroupedSessions] = useState<SessionCompletePayload[]>([]);
  const [homeToastData, setHomeToastData] = useState<HomeToastData | null>(null);

  const displayedSessionsRef = useRef<SessionCompletePayload[]>([]);

  const applySessionQueue = useCallback((newQueue: SessionCompletePayload[]) => {
    if (newQueue.length === 0) return;
    const merged = [...displayedSessionsRef.current, ...newQueue];
    displayedSessionsRef.current = merged;
    setPendingSessionSummary(null);
    setGroupedSessions(merged);
  }, []);

  useEffect(() => {
    const unsub = onSessionComplete((payload) => {
      queueSession(payload);
      if (homeTabActiveRef.current) {
        const queue = consumeSessionQueue();
        applySessionQueue(queue);
        const _score = payload.sessionScore ?? 0;
        const _creds = (payload.coinsEarned ?? 0) + (payload.creditsEarned ?? 0);
        const _totalScore = userTotalScoreRef.current;
        const _credits = userCreditsRef.current;
        const _discount = getLevelInfo(_totalScore).discount;
        const _bonusPts = _score > 0 ? Math.round(_score * _discount / 100) : 0;
        const _xpEarned = _score + _bonusPts;
        if (_xpEarned > 0 || _creds > 0) {
          const _xpAfter = _totalScore;
          const _xpBefore = Math.max(0, _xpAfter - _xpEarned);
          const _creditsAfter = _credits;
          const _creditsBefore = Math.max(0, _creditsAfter - _creds);
          setHomeToastData({
            xpBefore: _xpBefore, xpEarned: _xpEarned, xpAfter: _xpAfter,
            creditsBefore: _creditsBefore, creditsEarned: _creds, creditsAfter: _creditsAfter,
          });
        }
      }
    });
    return unsub;
  }, [applySessionQueue]);
  
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  const [creditModal, setCreditModal] = useState<{
      isOpen: boolean;
      cost: number;
      title: string;
      onConfirm: (autoEnabled: boolean) => void;
  } | null>(null);

  const [dailyStudySeconds, setDailyStudySeconds] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLessonImmersive, setIsLessonImmersive] = useState(false);
  const [popupQueue, setPopupQueue] = useState<('TRACKER' | 'CHALLENGE' | 'WELCOME')[]>([]);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [loadingContentType, setLoadingContentType] = useState<ContentType | undefined>(undefined);
  const [showFreeSubjectPopup, setShowFreeSubjectPopup] = useState(false);
  const [mcqLimitPopup, setMcqLimitPopup] = useState<{ used: number; limit: number; creditCost: number } | null>(null);

  useEffect(() => {
      const storedVersion = localStorage.getItem('nst_app_version');
      if (!storedVersion || storedVersion !== APP_VERSION) {
          localStorage.setItem('nst_app_version', APP_VERSION);
      }
  }, []);

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

      const lastLoginRaw = state.user.lastLoginDate ? new Date(state.user.lastLoginDate) : null;
      const lastLoginDateString = lastLoginRaw ? lastLoginRaw.toDateString() : '';

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastLoginDateString !== today) {
          updatedUser.lastLoginDate = new Date().toISOString();
          hasUpdates = true;

          if (lastLoginDateString === yesterday.toDateString()) {
              const prev = updatedUser.streak || 0;
              updatedUser.streak = prev + 1;
              const _sbeBoost = (state.settings?.scoreBoostEvent?.enabled)
                  ? ((state.settings.scoreBoostEvent as any).boostPercent / 100) : 0;
              updatedUser.totalScore = (updatedUser.totalScore || 0) + Math.round(10 * (1 + _sbeBoost));
              updatedUser.lastScoreDate = new Date().toISOString();
              const prevLongest = updatedUser.longestStreak || 0;
              if (updatedUser.streak > prevLongest) {
                  updatedUser.longestStreak = updatedUser.streak;
                  if (prevLongest > 0) {
                      updatedUser.credits = (updatedUser.credits || 0) + 100;
                  }
              }
              if (localStorage.getItem('nst_streak_popup_date') !== today) {
                  localStorage.setItem('nst_streak_popup_date', today);
                  setStreakLoginPopup({ newStreak: updatedUser.streak, prevStreak: prev, isNewRecord: updatedUser.streak > prevLongest && prevLongest > 0 });
              }
              
          } else {
              const prev = updatedUser.streak || 0;
              updatedUser.streak = 1;
              if (!updatedUser.longestStreak) updatedUser.longestStreak = 1;
              if (localStorage.getItem('nst_streak_popup_date') !== today) {
                  localStorage.setItem('nst_streak_popup_date', today);
                  setStreakLoginPopup({ newStreak: 1, prevStreak: prev > 1 ? prev : 0, isNewRecord: false });
              }
              if (prev > 1) {
                  const thresholds = [0, 100, 300, 700, 2000, 5000, 10000, 20000];
                  const cs = updatedUser.totalScore || 0;
                  let lvl = 0;
                  for (let i = 0; i < thresholds.length; i++) { if (cs >= thresholds[i]) lvl = i; else break; }
                  if (lvl > 0) updatedUser.totalScore = thresholds[lvl - 1];
              }
          }

          if (now.getDay() === 0) {
              const _wlvl = getLevelInfo(updatedUser.totalScore || 0).level;
              if (_wlvl >= 9) {
                  const _wKey  = now.toISOString().split('T')[0];
                  const _wLS   = `nst_weekly_lvl_bonus_${state.user.id}_${_wKey}`;
                  const _wId   = `wlvlbonus-${state.user.id}-${_wKey}`;
                  const _wDupe = (updatedUser.inbox || []).some((m: any) => m.id === _wId);
                  if (!localStorage.getItem(_wLS) && !_wDupe) {
                      localStorage.setItem(_wLS, '1');
                      const _wBonusMap: Record<number, number> = {
                          9: 100, 10: 150, 11: 200, 12: 300, 13: 500, 14: 700, 15: 1000,
                      };
                      const _wAmt  = _wBonusMap[Math.min(_wlvl, 15)] ?? 100;
                      const _wExp  = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
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

      const lastRewardDate = state.user.lastLoginRewardDate ? new Date(state.user.lastLoginRewardDate).toDateString() : '';
      const _isSunday = now.getDay() === 0;
      const _streakBrokenForBonus = !!(state.user.lastLoginDate &&
          lastLoginDateString !== yesterday.toDateString() &&
          lastLoginDateString !== today);

      const _bonusLSKey = `nst_wkbonus_${state.user.id}_${today}`;
      const _bonusInboxId = `login-bonus-${today}`;
      const _alreadyInInbox = (updatedUser.inbox || []).some((m: any) => m.id === _bonusInboxId);

      if (_isSunday && _streakBrokenForBonus
          && lastRewardDate !== today
          && !localStorage.getItem(_bonusLSKey)
          && !_alreadyInInbox
      ) {
          localStorage.setItem(_bonusLSKey, '1');
          updatedUser.lastLoginRewardDate = new Date().toISOString();
          hasUpdates = true;

          let bonusAmount = state.settings.loginBonusConfig?.freeBonus ?? 2;
          if (state.user.subscriptionTier !== 'FREE') {
              if (state.user.subscriptionLevel === 'BASIC') bonusAmount = state.settings.loginBonusConfig?.basicBonus ?? 5;
              if (state.user.subscriptionLevel === 'ULTRA') bonusAmount = state.settings.loginBonusConfig?.ultraBonus ?? 10;
          }
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
          setTimeout(() => fireCreditNotify({ type: 'REWARD', message: `${reward.label} received! Mail → Rewards se claim karo.` }), 1000);
      };

      if (hasUpdates || newReward) {
          if (newReward) {
              pushRewardToInbox(newReward);
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
              if (!state.originalAdmin) {
                  localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                  saveUserToLive(updatedUser);
              }
              setState(prev => ({...prev, user: updatedUser}));
          }
      }
  }, [state.user?.id, state.user?.lastLoginRewardDate, state.originalAdmin]);

  useEffect(() => {
    return subscribeToMaintenance(setMaintenanceState);
  }, []);

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

  useEffect(() => {
    if (state.user) {
      setErrorLoggerUser(state.user.id, state.user.name ?? null, state.user.role ?? null);
    } else {
      setErrorLoggerUser(null, null, null);
    }
  }, [state.user?.id, state.user?.name, state.user?.role]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) handleOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  useEffect(() => {
      const userId = state.user?.id;
      if (!userId || state.originalAdmin) {
          setRevisionTrackerUser(null);
          return;
      }
      hydrateRevisionTracker(userId, state.user).catch(err => {
          console.warn('[IIC] Revision tracker restore skipped:', err);
      });
  }, [state.user?.id, state.originalAdmin]);

  useEffect(() => {
      const userId = state.user?.id;
      if (!userId || state.originalAdmin) return;
      hydrateRoutineData(userId).catch(err => {
          console.warn('[IIC] Routine hydration skipped:', err);
      });
  }, [state.user?.id, state.originalAdmin]);

  // ── FIX: REALTIME USER SYNC (NO ACCIDENTAL AUTO-LOGOUT) ──
  useEffect(() => {
      let unsubscribeUser: (() => void) | undefined;

      if (state.user && !state.originalAdmin) {
          unsubscribeUser = subscribeToUser(state.user.id, (cloudUser) => {
              if (cloudUser) {
                  setState(prev => {
                      if (!prev.user) return prev;

                      const validId = prev.user.id || cloudUser.id || cloudUser.uid;
                      const mergedUser = { 
                          ...prev.user, 
                          ...cloudUser,
                          id: validId,
                          uid: validId,
                          profileCompleted: true
                      };

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

                      if (prev.user.role === 'ADMIN' && cloudUser.role !== 'ADMIN') {
                          mergedUser.role = 'ADMIN';
                      }
                      if (prev.user.role === 'SUB_ADMIN' && cloudUser.role !== 'SUB_ADMIN' && cloudUser.role !== 'ADMIN') {
                          mergedUser.role = 'SUB_ADMIN';
                      }
                      if (prev.user.role === 'TEACHER' && cloudUser.role !== 'TEACHER') {
                          mergedUser.role = 'TEACHER';
                      }

                      const prevInbox = prev.user.inbox || [];
                      const nextInbox = mergedUser.inbox || [];
                      if (nextInbox.length > prevInbox.length) {
                          const prevIds = new Set(prevInbox.map((m: any) => m.id));
                          const newMsgs = nextInbox.filter((m: any) => !prevIds.has(m.id));
                          const newMailMsgs = newMsgs.filter((m: any) => m.type !== 'REWARD');
                          if (newMailMsgs.length > 0) {
                              const first = newMailMsgs[0];
                              const msgPreview = (first.text || 'Naya message aaya!').slice(0, 60);
                              setTimeout(() => fireCreditNotify({
                                  type: 'MAIL',
                                  message: newMailMsgs.length > 1 ? `${newMailMsgs.length} naye messages aaye! ${msgPreview}` : msgPreview,
                              }), 300);
                          }
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

              if (newSettings.forceRefreshTimestamp) {
                  const lastRefresh = localStorage.getItem('nst_last_refresh_ts');
                  const incoming = String(newSettings.forceRefreshTimestamp);
                  if (lastRefresh !== incoming) {
                      localStorage.setItem('nst_last_refresh_ts', incoming);
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

              const currentVersion = localStorage.getItem('nst_app_version') || APP_VERSION;
              if (newSettings.latestVersion && newSettings.latestVersion !== currentVersion) {
                  if (newSettings.latestVersion > currentVersion) {
                      const now = Date.now();
                      let isUpdateAvailable = true;

                      if (newSettings.launchDate) {
                          const launchTime = new Date(newSettings.launchDate).getTime();
                          if (now < launchTime) isUpdateAvailable = false;
                      }

                      if (isUpdateAvailable) {
                          let shouldShow = false;
                          let deadline = 0;
                          let referenceTime = newSettings.launchDate ? new Date(newSettings.launchDate).getTime() : 0;

                          if (!referenceTime) {
                              const key = `nst_update_first_seen_${newSettings.latestVersion}`;
                              const firstSeen = localStorage.getItem(key);
                              if (!firstSeen) {
                                  referenceTime = now;
                                  localStorage.setItem(key, now.toString());
                              } else {
                                  referenceTime = parseInt(firstSeen);
                              }
                          }

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

                          if (now >= deadline) {
                              shouldShow = true;
                          } else {
                              const lastDismissedStr = localStorage.getItem(`nst_update_dismissed_${newSettings.latestVersion}`);
                              if (!lastDismissedStr) {
                                  shouldShow = true;
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

  useEffect(() => {
      if (state.user && !state.originalAdmin) {
          getUserSavedNotes(state.user.id).then(async savedNotes => {
              if (savedNotes && savedNotes.length > 0) {
                  savedNotes.sort((a: any, b: any) => new Date(a.dateCreated || a.date || 0).getTime() - new Date(b.dateCreated || b.date || 0).getTime());
                  await storage.setItem('nst_user_history', savedNotes);
              }
          });

          getUserData(state.user.id).then(fetchedCloudUser => {
             if (fetchedCloudUser) {
                 const localHistoryLen = state.user?.mcqHistory?.length || 0;
                 const cloudHistoryLen = fetchedCloudUser.mcqHistory?.length || 0;

                 if (cloudHistoryLen > localHistoryLen) {
                     setCloudUser(fetchedCloudUser);
                     setShowCloudRecoveryModal(true);
                 } else {
                     const currentStr = JSON.stringify(state.user);
                     const cloudStr = JSON.stringify(fetchedCloudUser);
                     if (currentStr !== cloudStr) {
                         let mergedUser = { ...state.user, ...fetchedCloudUser };

                         if (state.user?.role === 'ADMIN' && fetchedCloudUser.role !== 'ADMIN') {
                             mergedUser.role = 'ADMIN';
                         }
                         if (state.user?.role === 'SUB_ADMIN' && fetchedCloudUser.role !== 'SUB_ADMIN' && fetchedCloudUser.role !== 'ADMIN') {
                             mergedUser.role = 'SUB_ADMIN';
                         }

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

  useEffect(() => {
      if (!state.user?.isPremium && !state.user?.subscriptionEndDate) return;
      if (state.user?.role === 'ADMIN' || state.user?.role === 'SUB_ADMIN' || state.originalAdmin) return;

      const checkExpiry = () => {
          const updatedUser = recalculateSubscriptionStatus(state.user!, state.settings);
          const expiredNow = Boolean(
            state.user?.isPremium &&
            state.user?.subscriptionEndDate &&
            new Date(state.user.subscriptionEndDate).getTime() <= Date.now()
          );

          const wasPremium = state.user!.isPremium;
          const isNowPremium = updatedUser.isPremium;

          if (expiredNow || JSON.stringify(updatedUser) !== JSON.stringify(state.user)) {
               localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
               saveUserToLive(updatedUser);
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
                   setState(prev => ({...prev, user: updatedUser}));
               }
          }
      };

      checkExpiry();
      const interval = setInterval(checkExpiry, 60000);
      return () => clearInterval(interval);
  }, [state.user, state.originalAdmin]);

  // ── FIX: DIRECT DASHBOARD ENTRY ON STARTUP (NO ONBOARDING REDIRECT) ──
  useEffect(() => {
      let loadedSettings = state.settings;
      const storedSettings = localStorage.getItem('nst_system_settings');
      if (storedSettings) {
          try {
              const parsed = JSON.parse(storedSettings);
              loadedSettings = { ...state.settings, ...parsed };

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

          } catch(e) {}
      }
      
      const queue: ('TRACKER' | 'CHALLENGE' | 'WELCOME' | 'THREE_TIER')[] = [];
      const loggedInUserStr = localStorage.getItem('nst_current_user');

      setPopupQueue(queue);

    if (loggedInUserStr) {
      try {
        let user: User = JSON.parse(loggedInUserStr);

        if (!user || (!user.id && !user.uid)) {
            console.error("Invalid user object found in storage. Clearing session.");
            localStorage.removeItem('nst_current_user');
            return;
        }

        const validId = user.id || user.uid;
        user.id = validId;
        user.uid = validId;
        user.profileCompleted = true;

        if (!user.displayId || user.displayId.startsWith('IIC-') || /^\d{8,12}$/.test(user.displayId)) {
            const digits = user.displayId ? user.displayId.replace(/\D/g, '').slice(-6).padStart(6, '0') : String(Math.floor(100000 + Math.random() * 900000));
            user.displayId = `NSTA-${digits}`;
            localStorage.setItem('nst_current_user', JSON.stringify(user));
            saveUserToLive(user);
        }

        if (auth.currentUser === null) {
            (async () => {
                if (typeof auth.authStateReady === 'function') {
                    await auth.authStateReady().catch(() => {});
                }
                if (auth.currentUser === null) {
                    signInAnonymously(auth).catch(e => {
                        console.warn('[IIC] Background Firebase Auth restore skipped:', e.code || e.message);
                    });
                }
            })();
        }

        if (user.role !== 'ADMIN') {
             user = recalculateSubscriptionStatus(user, loadedSettings);
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

        let initialView = (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD';

        let safeClass = user.classLevel || null;
        const freeModes = loadedSettings.appMode?.allowedModesForFree || ['SCHOOL'];
        if (!user.isPremium && safeClass === 'COMPETITION' && !freeModes.includes('COMPETITION')) {
            safeClass = null;
            initialView = 'STUDENT_DASHBOARD';
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
    }
  }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (!state.user) return;

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

    let interval: any;
    if (state.user) {
        interval = setInterval(() => {
            setDailyStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('nst_daily_study_seconds', next.toString());
                
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

            if (!state.originalAdmin) {
                localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                saveUserToLive(updatedUser);
            }
            setState(prev => ({ ...prev, user: updatedUser }));
            fireCreditNotify({ type: 'REWARD', message: `${activeReward.label} received! Mail → Rewards se claim karo.` });
        }

        setActiveReward(null);
    }, [activeReward]);

  useEffect(() => {
      document.title = `${state.settings.appName}`;

       const darkThemeType = localStorage.getItem('nst_dark_theme_type') || 'black';
       let activeThemeColor = darkMode
         ? (darkThemeType === 'blue'
             ? (state.settings.blueThemeColor || state.settings.darkThemeColor)
             : state.settings.darkThemeColor) || state.settings.themeColor || '#3b82f6'
         : state.settings.lightThemeColor || state.settings.themeColor || '#3b82f6';

       if (state.user) {
           const personalTheme = (state.user as any).personalTheme;
           const personalThemeExpiry = (state.user as any).personalThemeExpiry;
           const hasActivePersonalTheme = !!(
               personalTheme?.btnStart &&
               (!personalThemeExpiry || new Date(personalThemeExpiry) > new Date())
           );

           if (hasActivePersonalTheme) {
               activeThemeColor = personalTheme.btnStart;
            } else if (!darkMode && state.user.isPremium) {
              if (state.user.subscriptionLevel === 'ULTRA') {
                  activeThemeColor = '#a855f7';
              } else if (state.user.subscriptionLevel === 'BASIC') {
                  activeThemeColor = '#3b82f6';
              }
          }

          try {
              const lbData = localStorage.getItem('nst_leaderboard');
                if (lbData && !hasActivePersonalTheme && !darkMode) {
                  const entries: any[] = JSON.parse(lbData);
                  const top3 = entries
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 3)
                      .map(e => e.userId);

                  if (top3.includes(state.user.id)) {
                      activeThemeColor = '#eab308';
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
      const hex = activeThemeColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 59;
      const g = parseInt(hex.substring(2, 4), 16) || 130;
      const b = parseInt(hex.substring(4, 6), 16) || 246;
      styleTag.innerHTML = `:root { --primary: ${activeThemeColor}; --nst-color-brand: ${activeThemeColor}; --nst-color-brand-5: rgba(${r},${g},${b},0.05); --nst-color-brand-10: rgba(${r},${g},${b},0.10); } .text-primary { color: var(--primary); } .bg-primary { background-color: var(--primary); } .border-primary { border-color: var(--primary); } ${state.settings.customCSS || ''}`;
   }, [state.settings, state.user, darkMode, darkThemeRevision]);

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
      const updatedLogs = [...logs, newLog].slice(-500); 
      localStorage.setItem('nst_activity_log', JSON.stringify(updatedLogs));
  };

  const updateSettings = (newSettings: SystemSettings) => {
      setState(prev => ({...prev, settings: newSettings}));
      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
      window.dispatchEvent(new Event('nst-dark-theme-change'));
  };

  const handleToggleAutoTts = (enabled: boolean) => {
      const newSettings = { ...state.settings, isAutoTtsEnabled: enabled };
      updateSettings(newSettings);
  };

  useEffect(() => {
    if (state.user && state.view === 'STUDENT_DASHBOARD') {
        const queue: PopupType[] = [];

        const lastTracker = localStorage.getItem('nst_last_daily_tracker_date');
        if (lastTracker !== new Date().toDateString()) {
            queue.push('TRACKER');
        }

        const autoChallengeOn = state.settings.dailyChallengeConfig?.autoChallengeEnabled !== false;
        const lastChallengeDate = localStorage.getItem('nst_last_daily_challenge_date');
        if (autoChallengeOn && lastChallengeDate !== new Date().toDateString()) {
            queue.push('CHALLENGE');
        }

        if (queue.length > 0) setPopupQueue(queue);

        const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
        const lastCompleted = localStorage.getItem('nst_last_daily_challenge_completed');
        const rankShownKey = `nst_rank_shown_${yesterday}`;
        if (lastCompleted === yesterday && !localStorage.getItem(rankShownKey)) {
            localStorage.setItem(rankShownKey, '1');
            setTimeout(() => setShowDailyRankCard(true), 800);
        }

        // Weekly challenge is available once per local calendar week. It is
        // intentionally not tied to Sunday: a student opening the app later
        // in the week still gets this week's challenge.
        const weekKey = getChallengeWeekKey();
        const lastWeeklyAuto = localStorage.getItem('nst_last_weekly_auto_week');
        if (lastWeeklyAuto !== weekKey) {
            const classLevel = state.user.classLevel || '10';
            const board = state.user.board || 'CBSE';
            generateDailyChallengeQuestions(
                classLevel,
                board,
                state.user.stream || null,
                state.settings,
                state.user.id,
                'WEEKLY',
            ).then((result) => {
                if (!result || result.questions.length === 0) return;
                const weeklyTest: WeeklyTest = {
                    id: result.id,
                    name: result.name,
                    description: "Is hafte ka weekly challenge — syllabus ke sabhi chapters se!",
                    isActive: true,
                    classLevel,
                    questions: result.questions,
                    totalQuestions: result.questions.length,
                    passingScore: Math.ceil(0.6 * result.questions.length),
                    createdAt: new Date().toISOString(),
                    durationMinutes: result.durationMinutes,
                    autoSubmitEnabled: true,
                };
                localStorage.setItem('nst_last_weekly_auto_week', weekKey);
                // Keep the old key harmlessly readable for older sessions.
                localStorage.setItem('nst_last_weekly_auto_date', getChallengeDateKey());
                setTimeout(() => setActiveWeeklyTest(weeklyTest), 1500);
            }).catch((error) => {
                console.warn('[IIC] Weekly challenge generation skipped:', error);
            });
        }
    }
  }, [state.user?.id, state.view, state.settings]);

  const SCHOOL_SUPER_ADMIN_EMAILS: string[] = [
    'superadmin@iic.app',
    'nsta.superadmin@gmail.com',
  ];

  // ── FIX: DIRECT DASHBOARD ENTRY ON LOGIN ──
  const handleLogin = async (user: User) => {
    const validId = user.id || user.uid;
    const activeUser: User = { 
      ...user, 
      id: validId, 
      uid: validId, 
      profileCompleted: true 
    };

    const lastUserId = localStorage.getItem('nst_last_user_id');
    if (lastUserId && lastUserId !== activeUser.id) {
      clearUserCache();
    }
    localStorage.setItem('nst_last_user_id', activeUser.id);

    awaitingPostMcqDataRef.current = false;
    sessionStartTimeRef.current = 0;
    sessionEndProcessedRef.current = false;
    setMcqJustEnded(false);
    
    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(activeUser));
    }
    saveUserToLive(activeUser);
    localStorage.setItem('nst_has_seen_welcome', 'true');

    const isSuperAdmin = SCHOOL_SUPER_ADMIN_EMAILS.includes((activeUser.email || '').toLowerCase());
    if (isSuperAdmin) {
      setState(prev => ({ ...prev, user: activeUser, view: 'SCHOOL_ECOSYSTEM' as any }));
      return;
    }

    const [schoolProfile, coachingProfile] = await Promise.all([
      getSchoolUserProfile(activeUser.id).catch(() => null),
      getCoachingUserProfile(activeUser.id).catch(() => null),
    ]);

    if (schoolProfile) {
      setState(prev => ({ ...prev, user: activeUser, view: 'SCHOOL_ECOSYSTEM' as any }));
      return;
    }

    if (coachingProfile) {
      setState(prev => ({ ...prev, user: activeUser, view: 'COACHING_ECOSYSTEM' as any }));
      return;
    }

    if (activeUser.role === 'ADMIN' || activeUser.role === 'SUB_ADMIN') {
      setState(prev => ({ ...prev, user: activeUser, view: 'ADMIN_DASHBOARD' }));
      return;
    }

    setState(prev => ({
      ...prev,
      user: activeUser,
      view: 'STUDENT_DASHBOARD' as any,
      selectedBoard: activeUser.board || null,
      selectedClass: activeUser.classLevel || null,
      selectedStream: activeUser.stream || null,
      language: activeUser.board === 'BSEB' ? 'Hindi' : 'English',
    }));
  };

  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutTimeLeft, setLogoutTimeLeft] = useState(10);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [showCloudRecoveryModal, setShowCloudRecoveryModal] = useState(false);

  const USER_CACHE_KEYS = [
    'nst_current_user', 'nst_user_history', 'nst_users',
    'nst_activity_log', 'nst_board_notes', 'nst_claimed_notifs_v1',
    'nst_daily_study_seconds', 'nst_hidden_notifs', 'nst_display_level',
    'nst_last_daily_challenge_completed', 'nst_last_daily_challenge_date',
    'nst_last_daily_tracker_date', 'nst_last_read_update',
    'nst_last_refresh_ts', 'nst_last_reload_at', 'nst_last_weekly_auto_date', 'nst_last_weekly_auto_week',
    'nst_leaderboard', 'nst_morning_banner', 'nst_pending_sync_results',
    'nst_recycle_bin', 'nst_revision_tracker_v2', 'nst_seen_notif_ids',
    'nst_seen_notifs_v1', 'nst_starred_notes_v1', 'nst_store_last_visit',
    'nst_streak_popup_date', 'nst_timer_date', 'nst_universal_analysis_logs',
  ];
  const clearUserCache = () => {
    USER_CACHE_KEYS.forEach(k => localStorage.removeItem(k));
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(k => {
      if (
        k.startsWith('nst_deferred_study_coins_') ||
        k.startsWith('nst_routine_') ||
        k.startsWith('nst_score_log_') ||
        k.startsWith('nst_credit_history_') ||
        k.startsWith('nst_activity_history_') ||
        k.startsWith('nst_board_choice_')
      ) localStorage.removeItem(k);
    });
    storage.removeItem('nst_active_student_tab').catch(() => {});
    storage.removeItem('nst_user_history').catch(() => {});
  };

  const performLogout = () => {
    logActivity("LOGOUT", "User Logged Out");
    clearUserCache();
    localStorage.removeItem('nst_last_user_id');
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

    const wrongQuestions = displayData
      .map((q, idx) => {
          const selected = answers[idx] !== undefined ? answers[idx] : -1;
          if (selected !== -1 && selected !== q.correctAnswer) {
              return {
                  question: q.question,
                  qIndex: idx
              };
          }
          return null;
      })
      .filter((item): item is { question: string; qIndex: number } => item !== null);

    const topicAnalysis: Record<string, { correct: number, total: number, percentage: number }> = {};
    displayData.forEach((q, idx) => {
        const topic = q.topic || 'General';
        if (!topicAnalysis[topic]) topicAnalysis[topic] = { correct: 0, total: 0, percentage: 0 };
        topicAnalysis[topic].total++;
        if (answers[idx] === q.correctAnswer) topicAnalysis[topic].correct++;
    });
    Object.keys(topicAnalysis).forEach(topic => {
        const t = topicAnalysis[topic];
        t.percentage = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    });

    const result: MCQResult = {
        id: `mcq_${state.selectedChapter.id}_${Date.now()}`,
        userId: state.user.id,
        date: new Date().toISOString(),
        score,
        totalQuestions: displayData.length,
        correctCount: score,
        wrongCount: displayData.length - score,
        totalTimeSeconds: timeTaken,
        timeTaken,
        chapterId: state.selectedChapter.id,
        chapterTitle: state.selectedChapter.title,
        subjectId: state.selectedSubject?.id || '',
        subjectName: state.selectedSubject?.title || '',
        classLevel: state.selectedClass || '',
        userAnswers: answers,
         questions: displayData,
        wrongQuestions: wrongQuestions,
        topicAnalysis: topicAnalysis
    };

    setLastTestResult(result);
    setLastTestQuestions(displayData);

    setPendingSessionSummary({
      type: 'MCQ',
      subject: state.selectedSubject?.title || '',
      chapter: state.selectedChapter.title,
      score,
      total: displayData.length,
      timeSecs: timeTaken,
      coinsEarned: undefined,
    });
    
    let updatedUser = { ...state.user };
    if (!updatedUser.testResults) updatedUser.testResults = [];
    updatedUser.testResults.unshift(result);
    if (!updatedUser.mcqHistory) updatedUser.mcqHistory = [];
    updatedUser.mcqHistory.unshift(result);

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
      setState(prev => ({ ...prev, originalAdmin: prev.user, user: targetUser, view: 'STUDENT_DASHBOARD', selectedBoard: targetUser.board || null, selectedClass: targetUser.classLevel || null, selectedStream: targetUser.stream || null, language: targetUser.board === 'BSEB' ? 'Hindi' : 'English' }));
  };

  const handleReturnToAdmin = () => {
      if (!state.originalAdmin) return;
      setState(prev => ({ ...prev, user: prev.originalAdmin, originalAdmin: null, view: 'ADMIN_DASHBOARD', selectedBoard: null, selectedClass: null }));
  };

  const updateUserProfile = (updates: Partial<User>) => {
      if (!state.user) return;
      const updatedUser = { ...state.user, ...updates };

      setState(prev => ({ ...prev, user: updatedUser }));

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
      if (state.user?.classLevel && state.user.classLevel !== level) {
          if (state.user.role !== 'ADMIN' && state.user.role !== 'SUB_ADMIN' && !state.originalAdmin) {
              setAlertConfig({ isOpen: true, message: "🔒 Class is locked! You cannot change your class once selected.\n\nContact Admin for help." });
              return;
          }
      }

      updateUserProfile({ classLevel: level });

      setState(prev => {
          const updatedUser = prev.user ? { ...prev.user, classLevel: level } : null;

          if (level === '11' || level === '12') {
              return { ...prev, user: updatedUser, selectedClass: level, view: 'STREAMS' };
          }

          const finalUser = updatedUser ? { ...updatedUser, stream: undefined } : null;

          if (level === 'COMPETITION') {
               updateUserProfile({ stream: null });
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

        if (state.user) {
          const popupKey = `nst_subject_intro_${state.user.id}_${subject.id}`;
          if (!localStorage.getItem(popupKey)) {
            localStorage.setItem(popupKey, '1');
            setShowFreeSubjectPopup(true);
          }
        }
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

    if ((type === 'MCQ_SIMPLE' || type === 'MCQ_PRACTICE' || type === 'MCQ_TEST') &&
        state.user.role !== 'ADMIN' && !state.originalAdmin && !forcePay) {
        const _today = new Date().toISOString().split('T')[0];
        const _mcqKey = `nst_mcq_daily_total_${_today}_${state.user.id}`;
        const _mcqUsed = parseInt(localStorage.getItem(_mcqKey) || '0', 10);
        const _mcqSubValid = state.user.isPremium && state.user.subscriptionEndDate && new Date(state.user.subscriptionEndDate) > new Date();
        const _mcqTier: 'FREE' | 'BASIC' | 'ULTRA' =
            _mcqSubValid && state.user.subscriptionLevel === 'ULTRA' ? 'ULTRA' :
            _mcqSubValid && state.user.subscriptionLevel === 'BASIC' ? 'BASIC' : 'FREE';
        const _mcqLimit = getEffectiveDailyLimit('mcq', getLevelInfo(state.user.totalScore || 0).level, _mcqTier, state.settings);
        if (_mcqLimit < UNLIMITED && _mcqUsed >= _mcqLimit) {
            const _mcqCreditCost = (state.settings as any).mcqOverLimitCreditCost || 5;
            setMcqLimitPopup({ used: _mcqUsed, limit: _mcqLimit, creditCost: _mcqCreditCost });
            setLoadingContentType(undefined);
            return;
        }
    }

    const _fsSubjectId = state.selectedSubject?.id || '';
    const _fsFreeMap = state.user.subjectFreeLesson || {};
    const _fsIsFreeLessonChapter = _fsSubjectId && _fsFreeMap[_fsSubjectId] === tempSelectedChapter.id;
    const _fsIsFirstLesson = _fsSubjectId && !_fsFreeMap[_fsSubjectId] && state.user.role !== 'ADMIN' && !state.originalAdmin;
    const _fsGrantFree = _fsIsFreeLessonChapter || _fsIsFirstLesson;

    if (_fsIsFirstLesson) {
        const _fsUpdatedMap = { ..._fsFreeMap, [_fsSubjectId]: tempSelectedChapter.id };
        const _fsUpdatedUser = { ...state.user, subjectFreeLesson: _fsUpdatedMap };
        setState(prev => ({ ...prev, user: _fsUpdatedUser }));
        localStorage.setItem('nst_current_user', JSON.stringify(_fsUpdatedUser));
        saveUserToLive(_fsUpdatedUser);
    }

    if (specificContent) {
        let cost = 0;
        if (specificContent.isPremium) {
             cost = 5;
             if (type === 'VIDEO_LECTURE') cost = state.settings.defaultVideoCost || 5;
             if (type === 'NOTES_PREMIUM' || type === 'NOTES_HTML_PREMIUM') cost = state.settings.defaultPdfCost || 5;

             if (state.settings.featureCosts) {
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

        if (state.settings.isCreditFreeEvent || state.settings.isGlobalFreeMode) cost = 0;

        const _timedUnlocks1 = (state.user as any).timedUnlocks || [];
        const _isTimedValid1 = (id: string | undefined) => id ? _timedUnlocks1.some((u: any) => u.contentId === id && new Date(u.expiresAt) > new Date()) : false;
        if (state.user.unlockedContent && (state.user.unlockedContent.includes(tempSelectedChapter.id) || state.user.unlockedContent.includes(specificContent?.id))) {
            cost = 0;
        } else if (_isTimedValid1(tempSelectedChapter.id) || _isTimedValid1(specificContent?.id)) {
            cost = 0;
        }

        if (_fsGrantFree) cost = 0;

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

        const lessonContent: LessonContent = {
            id: specificContent.id || Date.now().toString(),
            title: specificContent.title || tempSelectedChapter.title,
            subtitle: specificContent.topic || 'Premium Content',
            content: specificContent.content || specificContent.url,
            type: type,
            dateCreated: new Date().toISOString(),
            subjectName: state.selectedSubject?.name || '',
            videoPlaylist: specificContent.videoPlaylist
        };

        setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON' }));
        setIsFullScreen(true);
        return;
    }
    
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
            cost = _fsGrantFree ? 0 : 5;
        } else if (type === 'NOTES_IMAGE_AI') {
            actualContent = contentData?.aiImageLink;
            subtitle = 'AI Generated Visual Notes';
            cost = _fsGrantFree ? 0 : (contentData?.aiImagePrice !== undefined ? contentData.aiImagePrice : 5);
        }

        if (!actualContent) {
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

        if (type === 'NOTES_IMAGE_AI') {
            setState(prev => ({ ...prev, loading: true }));
            setLoadingMessage("AI is analyzing and generating visual notes...");
            setGenerationDataReady(false);

            setTimeout(() => {
                setGenerationDataReady(true);
                setLoadingMessage("Notes Ready!");

                const lessonContent: LessonContent = {
                    id: Date.now().toString(),
                    title: tempSelectedChapter.title,
                    subtitle: subtitle,
                    content: actualContent,
                    aiHtmlContent: contentData?.aiHtmlContent,
                    type: type,
                    dateCreated: new Date().toISOString(),
                    subjectName: state.selectedSubject?.name || ''
                };

                setTimeout(() => {
                    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON', loading: false }));
                    setIsFullScreen(true);
                    setLoadingMessage('');
                }, 1000);

            }, 6000);
            return;
        }

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
        setIsFullScreen(true);
        return;
    }

    let cost = 0;
    const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
    const mainKey = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}`;
    const typeKey = `${mainKey}_${type}`;

    let onlineContent: any = await getChapterData(mainKey);
    let foundAdminContent = false;

    if (onlineContent) {
        if (type === 'PDF_FREE' && (onlineContent.freeLink || onlineContent.freeNotesHtml || onlineContent.schoolFreeNotesList?.length > 0 || onlineContent.competitionFreeNotesList?.length > 0)) {
            onlineContent = { ...onlineContent, content: onlineContent.freeLink || '', type, price: 0 };
            foundAdminContent = true;
        } else if (type === 'PDF_PREMIUM' && (onlineContent.premiumLink || onlineContent.premiumNotesHtml || onlineContent.schoolPremiumNotesList?.length > 0 || onlineContent.competitionPremiumNotesList?.length > 0)) {
            onlineContent = { ...onlineContent, content: onlineContent.premiumLink || '', type };
            foundAdminContent = true;
        } else if (type === 'PDF_ULTRA' && onlineContent.ultraPdfLink) {
            onlineContent = { ...onlineContent, content: onlineContent.ultraPdfLink, type, price: 10 };
            foundAdminContent = true;
        } else if (type === 'VIDEO_LECTURE' && (onlineContent.videoPlaylist?.length > 0 || onlineContent.schoolVideoPlaylist?.length > 0 || onlineContent.competitionVideoPlaylist?.length > 0 || onlineContent.freeVideoLink || onlineContent.premiumVideoLink)) {
            const videoUrl = onlineContent.premiumVideoLink || onlineContent.freeVideoLink || '';
            const vidPrice = onlineContent.videoCreditsCost !== undefined ? onlineContent.videoCreditsCost : 5;
            onlineContent = {
                ...onlineContent,
                content: videoUrl,
                videoPlaylist: onlineContent.videoPlaylist || onlineContent.schoolVideoPlaylist || onlineContent.competitionVideoPlaylist,
                type,
                price: vidPrice
            };
            foundAdminContent = true;
        } else {
            onlineContent = null;
        }
    }

    if (!onlineContent) {
        onlineContent = await getChapterData(typeKey);
    }

    if (onlineContent) {
         if(onlineContent.price !== undefined) cost = onlineContent.price;
    }

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

    if (state.settings.isCreditFreeEvent || state.settings.isGlobalFreeMode) cost = 0;

    const _timedUnlocks2 = (state.user as any).timedUnlocks || [];
    const _isTimedValid2 = (id: string) => _timedUnlocks2.some((u: any) => u.contentId === id && new Date(u.expiresAt) > new Date());
    if (state.user.unlockedContent && state.user.unlockedContent.includes(tempSelectedChapter.id)) {
        cost = 0;
    } else if (_isTimedValid2(tempSelectedChapter.id)) {
        cost = 0;
    }

    if (_fsGrantFree) cost = 0;

    let hasAccess = false;

    if (state.user.role === 'ADMIN' || state.originalAdmin) {
        hasAccess = true;
    } else if (state.settings.isGlobalFreeMode) {
        hasAccess = true;
    } else if (cost === 0) {
        hasAccess = true;
    } else {
        const isSubValid = state.user.isPremium && state.user.subscriptionEndDate && !isNaN(new Date(state.user.subscriptionEndDate).getTime()) && new Date(state.user.subscriptionEndDate) > new Date();

        if (state.user.isPremium && !isSubValid) {
             console.warn("Detected Expired Premium during Access Check. Treating as FREE.");
        }

        const userLevel = isSubValid ? (state.user.subscriptionLevel || 'BASIC') : 'FREE';
        const perms = state.settings.tierPermissions?.[userLevel];

        if (perms && perms.length > 0) {
             if (perms.includes('ALL') || perms.includes(type)) {
                 hasAccess = true;
             }
             if (type.startsWith('PDF') && perms.includes('NOTES_ACCESS')) hasAccess = true;
             if (type.startsWith('NOTES') && perms.includes('NOTES_ACCESS')) hasAccess = true;
             if (type === 'VIDEO_LECTURE' && perms.includes('VIDEO_ACCESS')) hasAccess = true;
             if (type.startsWith('AUDIO') && perms.includes('AUDIO_ACCESS')) hasAccess = true;
             if ((type === 'MCQ_SIMPLE' || type === 'MCQ_PRACTICE') && perms.includes('MCQ_PRACTICE')) hasAccess = true;
             if (type === 'MCQ_TEST' && perms.includes('MCQ_TEST')) hasAccess = true;
             if (type === 'AI_CHAT' && perms.includes('AI_CHAT')) hasAccess = true;
        } else if (isSubValid) {
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

    if (!hasAccess) {
        if (getTotalCredits(state.user) >= cost) {
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
                saveUserToLive(updatedUser);
            }

            setState(prev => ({...prev, user: updatedUser}));
            hasAccess = true;
        } else {
            setAlertConfig({isOpen: true, message: `Insufficient Credits! This content costs ${cost} credits.\n\nTip: Upgrade to Subscription to access unlimited content.`});
            return;
        }
    }

    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, loading: true }));
    setGenerationDataReady(false);

    logActivity("CONTENT_GEN", `Opened ${type} for ${tempSelectedChapter.title}`);

    if (state.user && !state.originalAdmin) {
        const activity = `Viewing ${type}: ${tempSelectedChapter.title}`;
        const updatedUser = { ...state.user, currentActivity: activity, lastActiveTime: new Date().toISOString() };
        saveUserToLive(updatedUser);
    }

    try {
        let restoredAnswers = undefined;
        if ((type === 'MCQ_ANALYSIS' || type === 'MCQ_SIMPLE') && state.user.testResults) {
            const pastResult = state.user.testResults.find(r => r.chapterId === tempSelectedChapter.id);
            if (pastResult) {
                restoredAnswers = pastResult.userAnswers;
            }
        }

        if (onlineContent) {
            const restoredContent = { ...onlineContent, userAnswers: restoredAnswers };
            if (!restoredContent.content && !restoredContent.videoPlaylist?.length && !restoredContent.aiHtmlContent && type !== 'MCQ_ANALYSIS' && type !== 'MCQ_SIMPLE') {
                 restoredContent.isComingSoon = true;
            }
            setState(prev => ({ ...prev, lessonContent: restoredContent }));
            setGenerationDataReady(true);
            return;
        }

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

        await saveChapterData(mainKey, content);

        const restoredContent = { ...content, userAnswers: restoredAnswers };
        setState(prev => ({ ...prev, lessonContent: restoredContent }));
        setGenerationDataReady(true);
        setIsFullScreen(true);
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
    if (state.user && !state.originalAdmin) {
        const activity = `Taking Test: ${test.name}`;
        const updatedUser = { ...state.user, currentActivity: activity, lastActiveTime: new Date().toISOString() };
        saveUserToLive(updatedUser);
    }
  };

  const handleWeeklyTestComplete = async (score: number, total: number, answers: Record<number, number>) => {
    if (!activeWeeklyTest || !state.user) return;

    // Leave the test player immediately after the user confirms submission.
    // Result persistence and reward calculation can continue asynchronously
    // without making the player appear stuck until the user presses Back.
    setActiveWeeklyTest(null);

    const attempt = {
        testId: activeWeeklyTest.id,
        testName: activeWeeklyTest.name,
        userId: state.user.id,
        userName: state.user.name,
        startedAt: localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`) || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score: Math.round((score / total) * 100),
        totalQuestions: total,
        answers: answers,
        isCompleted: true,
    };

    const key = `nst_test_attempts_${state.user.id}`;
    let attempts: Record<string, unknown> = {};
    try { attempts = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    attempts[activeWeeklyTest.id] = attempt;
    localStorage.setItem(key, JSON.stringify(attempts));
    window.dispatchEvent(new CustomEvent('iic-test-completed'));

    // Do not hold the result screen behind a remote write. The local attempt
    // is already durable; Firebase sync can finish in the background.
    void saveTestResult(state.user.id, attempt).catch((error) => {
        console.warn('Test result sync failed:', error);
    });

    const isChallenge20Daily = isDailyChallenge20(activeWeeklyTest);
    const isDailyChallengeAttempt = isChallenge20Daily || activeWeeklyTest.id.startsWith('weekly-auto-');
    if (isDailyChallengeAttempt && !state.originalAdmin) {
        const today = getChallengeDateKey();
        const timeTakenStr = localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`);
        const timeTaken = timeTakenStr ? Math.round((Date.now() - parseInt(timeTakenStr)) / 1000) : 0;
        saveDailyChallengeScore({
            userId: state.user.id,
            userName: state.user.name || 'Student',
            classLevel: state.user.classLevel || '10',
            score,
            totalQuestions: total,
            percentage: Math.round((score / total) * 100),
            timeTakenSeconds: timeTaken,
            submittedAt: new Date().toISOString(),
            date: today,
        });
        localStorage.setItem('nst_last_daily_challenge_completed', today);
    }

    logActivity("TEST_SUBMIT", `Completed ${activeWeeklyTest.name} with score ${score}/${total}`);

    let updatedUser = { ...state.user };
    let rewardMsg = "";

    const percentage = (score / total) * 100;
    const isDailyForReward = isChallenge20Daily;
    const category = isDailyForReward ? 'DAILY_CHALLENGE' : 'WEEKLY_TEST';

    const eligibleRules = (state.settings.prizeRules || [])
        .filter(r => r.enabled && r.category === category)
        .filter(r => percentage >= r.minPercentage)
        .sort((a, b) => b.minPercentage - a.minPercentage);

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
        if (isDailyForReward) {
             rewardMsg = `Daily Challenge Complete. Score: ${Math.round(percentage)}%.`;
        } else {
             rewardMsg = "Test Submitted!";
        }
    }

    // Daily Challenge 2.0's fixed +100 XP is deliberately claimable from
    // Routine after submission. Do not award it while submitting the test.
    if (isChallenge20Daily && !state.originalAdmin) {
        rewardMsg = rewardMsg
            ? `${rewardMsg} +100 XP claim karne ke liye Routine kholo.`
            : 'Daily Challenge 2.0 complete. +100 XP claim karne ke liye Routine kholo.';
    }

    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
         void saveUserToLive(updatedUser).catch((error) => {
             console.warn('Challenge result user sync failed:', error);
         });
    }
    setState(prev => ({...prev, user: updatedUser}));
    if (rewardMsg) setAlertConfig({isOpen: true, message: rewardMsg});

    const startTimeStr = localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`);
    const timeTaken = startTimeStr ? (Date.now() - parseInt(startTimeStr)) / 1000 : 0;

    const omrData = activeWeeklyTest.questions.map((q, idx) => ({
        qIndex: idx,
        selected: answers[idx] !== undefined ? answers[idx] : -1,
        correct: q.correctAnswer
    }));

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
         questions: activeWeeklyTest.questions,
         userAnswers: answers,
        omrData: omrData,
        wrongQuestions: wrongQuestions
    };

    const topicAnalysis: Record<string, { correct: number, total: number, percentage: number }> = {};
    activeWeeklyTest.questions.forEach((q, idx) => {
        const topic = q.topic || 'General';
        if (!topicAnalysis[topic]) topicAnalysis[topic] = { correct: 0, total: 0, percentage: 0 };
        topicAnalysis[topic].total++;
        if (answers[idx] === q.correctAnswer) topicAnalysis[topic].correct++;
    });
    Object.keys(topicAnalysis).forEach(topic => {
        const t = topicAnalysis[topic];
        t.percentage = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    });
    result.topicAnalysis = topicAnalysis;

    updatedUser.mcqHistory = [result, ...(updatedUser.mcqHistory || [])];

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

    if (!state.originalAdmin) {
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        saveUserToLive(updatedUser);
    }
    setState(prev => ({...prev, user: updatedUser}));

    setLastTestResult(result);
    setLastTestQuestions(activeWeeklyTest.questions);

    localStorage.removeItem(`weekly_test_start_${activeWeeklyTest.id}`);
    setActiveWeeklyTest(null);
  };

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
      if (!state.user) return;

      const config = state.settings.dailyChallengeConfig || { rewardPercentage: 90, mode: 'AUTO', selectedChapterIds: [] };
      const routineData = loadRoutineData(state.user.id);
      const routineClass = routineData.enabled && routineData.selectedClass
        ? routineData.selectedClass
        : null;
      const challengeClass = routineClass || state.user.classLevel || '10';

      const result = await generateDailyChallengeQuestions(
          challengeClass,
          state.user.board || 'BSEB',
          state.user.stream || null,
          state.settings,
          state.user.id,
          'DAILY'
      );

      if (!result || result.questions.length === 0) {
          setAlertConfig({isOpen: true, message: "Aaj ka challenge abhi available nahi hai. Admin se contact karo ya baad mein try karo!"});
          handlePopupClose('CHALLENGE');
          return;
      }

      const test: WeeklyTest = {
          id: result.id,
          name: result.name,
          description: `Aaj ke Class ${challengeClass} Routine ke sawaal!`,
          isActive: true,
          classLevel: challengeClass,
          questions: result.questions,
          totalQuestions: result.questions.length,
          passingScore: Math.ceil((config.rewardPercentage / 100) * result.questions.length),
          createdAt: new Date().toISOString(),
          durationMinutes: result.durationMinutes,
          autoSubmitEnabled: true
      };

      setActiveWeeklyTest(test);
      localStorage.setItem('nst_last_daily_challenge_date', new Date().toDateString());
      setPopupQueue(prev => prev.slice(1));
  };

  const handleStartWeeklyAutoChallenge = async () => {
      if (!state.user) return;
      const result = await generateDailyChallengeQuestions(
          state.user.classLevel || '10',
          state.user.board || 'BSEB',
          state.user.stream || null,
          state.settings,
          state.user.id,
          'WEEKLY'
      );
      if (!result || result.questions.length === 0) {
          setAlertConfig({isOpen: true, message: "Weekly test ke liye sawaal available nahi hai. Admin se contact karo!"});
          return;
      }
      const test: WeeklyTest = {
          id: result.id,
          name: result.name,
          description: "Is hafte ka mega test — syllabus ke sabhi chapters se!",
          isActive: true,
          classLevel: state.user.classLevel || '10',
          questions: result.questions,
          totalQuestions: result.questions.length,
          passingScore: Math.ceil(0.6 * result.questions.length),
          createdAt: new Date().toISOString(),
          durationMinutes: result.durationMinutes,
          autoSubmitEnabled: true
      };
      setActiveWeeklyTest(test);
      localStorage.setItem('nst_last_weekly_auto_week', getChallengeWeekKey());
      localStorage.setItem('nst_last_weekly_auto_date', getChallengeDateKey());
  };

  const goBack = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
    }

    if (isFullScreen) {
        setIsFullScreen(false);
        if (state.view === 'LESSON') {
             setState(prev => ({ ...prev, view: 'CHAPTERS', lessonContent: null }));
             return;
        }
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
      if (prev.view === 'LESSON') return { ...prev, view: 'CHAPTERS', lessonContent: null };

      if (prev.view === 'CHAPTERS') {
          return { ...prev, view: 'SUBJECTS', selectedChapter: null };
      }

      if (prev.view === 'SUBJECTS') {
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedSubject: null };
          }
          return { ...prev, view: ['11','12'].includes(prev.selectedClass||'') ? 'STREAMS' : 'CLASSES', selectedSubject: null };
      }

      if (prev.view === 'STREAMS') return { ...prev, view: 'CLASSES', selectedStream: null };
      if (prev.view === 'CLASSES') return { ...prev, view: 'BOARDS', selectedClass: null };

      if (prev.view === 'BOARDS') {
          return { ...prev, view: 'STUDENT_DASHBOARD' as any, selectedBoard: null };
      }

      return { ...prev, view: 'STUDENT_DASHBOARD' as any };
    });
  };

  const _goBackRef = React.useRef(goBack);
  _goBackRef.current = goBack;

  const _viewRef = React.useRef(state.view);
  _viewRef.current = state.view;

  useEffect(() => {
    try { window.history.pushState({ __appNavTrap: true }, ''); } catch {}

    const onPopState = () => {
      if (_viewRef.current === 'STUDENT_DASHBOARD') return;
      try { window.history.pushState({ __appNavTrap: true }, ''); } catch {}
      _goBackRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const getUserPlan = (): 'FREE' | 'BASIC' | 'ULTRA' => {
      if (!state.user?.isPremium) return 'FREE';
      if (state.user?.subscriptionLevel === 'ULTRA') return 'ULTRA';
      return 'BASIC';
  };

  if (isAppLoading) {
      return (
        <AppLoadingScreen
          isPremium={state.user?.isPremium || false}
          subscriptionLevel={getUserPlan()}
          userId={state.user?.id}
          userRole={state.user?.role}
           loadingScreenSlotAssignments={state.user?.loadingScreenSlotAssignments}
           loadingScreenSlotUnlocks={state.user?.loadingScreenSlotUnlocks}
           loadingScreenUnlocks={state.user?.loadingScreenUnlocks}
           loadingScreenLibrary={state.settings?.adminLoadingScreenLibrary}
          isPreview={isLoadingPreview}
          onBack={() => {
            sessionStorage.removeItem('nst_splash_preview_style');
            setIsLoadingPreview(false);
            setIsAppLoading(false);
          }}
          onApply={() => {
             const previewStyle = parseInt(sessionStorage.getItem('nst_splash_preview_style') || '1', 10);
             const currentUser = state.user;
              if (currentUser && previewStyle >= 1 && previewStyle <= 4) {
                localStorage.setItem(`nst_splash_style_preference_${currentUser.id}`, String(previewStyle));
                localStorage.setItem('nst_splash_style_preference', String(previewStyle));
              }
              sessionStorage.removeItem('nst_splash_preview_style');
              setIsLoadingPreview(false);
              setIsAppLoading(false);
          }}
          onComplete={() => {
            sessionStorage.removeItem('nst_splash_preview_style');
            setIsLoadingPreview(false);
            setIsAppLoading(false);
          }}
        />
      );
  }

  const bgImageStyle = (state.settings?.appBackgroundImage && state.view !== 'LESSON') ? `url(${state.settings.appBackgroundImage})` : undefined;

  return (
    <ErrorBoundary>
    <div className="min-h-[100dvh] flex flex-col font-sans relative pt-[env(safe-area-inset-top,24px)] pb-[env(safe-area-inset-bottom,0px)]" style={{
      background: `var(--app-bar-color, ${state.settings?.appBackground || '#ffffff'})`,
      backgroundImage: bgImageStyle,
      backgroundSize: bgImageStyle ? 'cover' : undefined,
      backgroundPosition: bgImageStyle ? 'center' : undefined,
      backgroundRepeat: bgImageStyle ? 'no-repeat' : undefined,
      backgroundAttachment: bgImageStyle ? 'fixed' : undefined
    }}>
      <a href="#main-content" className="skip-to-content">Skip to content</a>

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

      {showAdminCrashPopup && state.user && (state.user.role === 'ADMIN' || state.user.role === 'SUB_ADMIN') && (
        <AdminCrashPopup
          errorMessage={maintenanceState?.crashes?.adminDashboard?.errorMessage || 'Admin dashboard crash hua'}
          crashedAt={maintenanceState?.crashes?.adminDashboard?.crashedAt || Date.now()}
          onMarkFixed={() => {
            markCrashFixed('adminDashboard').catch(() => {});
            setAdminDashCrashed(false);
            setShowAdminCrashPopup(false);
            setState(prev => ({ ...prev, view: 'ADMIN_DASHBOARD' as any }));
          }}
          onDismiss={() => setShowAdminCrashPopup(false)}
        />
      )}

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
                                   if (state.user) {
                                      const wipedUser = { ...state.user, mcqHistory: [], testResults: [] };
                                      saveUserToLive(wipedUser);
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

      {state.originalAdmin && (
          <div className="fixed bottom-24 right-6 z-[90] animate-bounce">
              <button onClick={handleReturnToAdmin} className="bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 border-4 border-white">
                  <EyeOff size={20} /> Exit User View
              </button>
          </div>
      )}

      {!isFullScreen && state.user && state.view !== 'STUDENT_DASHBOARD' && !isLessonImmersive && (
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

      <main id="main-content" className={`flex-1 w-full ${!state.user ? 'p-0 max-w-none' : (isFullScreen || state.view === ('STUDENT_DASHBOARD' as any) ? 'p-0 max-w-6xl mx-auto' : 'p-4 mb-8 max-w-6xl mx-auto')}`}>
        {!state.user ? (
            <ErrorBoundary fallbackLabel="Login" compact>
              <Auth onLogin={handleLogin} logActivity={logActivity} appSettings={state.settings} />
            </ErrorBoundary>
        ) : (
            <ErrorBoundary resetKey={state.view}>
            <>
                {state.view === 'ADMIN_DASHBOARD' && (state.user.role === 'ADMIN' || state.user.role === 'SUB_ADMIN') && !adminDashCrashed && (
                  <ErrorBoundary
                    fallbackLabel="Admin Dashboard"
                    resetKey={state.view}
                    onError={(error) => {
                      reportMaintenanceCrash('adminDashboard', error?.message || 'Unknown error').catch(() => {});
                      setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD' as any }));
                      setAdminDashCrashed(true);
                      setShowAdminCrashPopup(true);
                    }}
                  >
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
                        <>
                        {maintenanceState?.config?.active && state.user?.role !== 'ADMIN' && state.user?.role !== 'SUB_ADMIN' && (
                          <MaintenanceBanner
                            title={maintenanceState.config.title || 'System Maintenance'}
                            message={maintenanceState.config.message || 'We are updating our system.'}
                            onClick={() => {}}
                          />
                        )}
                        <ErrorBoundary
                          fallbackLabel="Student Dashboard"
                          resetKey={studentTab}
                          crashTarget="studentDashboard"
                          maintenanceTitle={maintenanceState?.config?.title}
                          maintenanceMessage={maintenanceState?.config?.message}
                          maintenanceRetryMinutes={maintenanceState?.config?.retryMinutes}
                        >
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
                              onOpenMcqAnalysis={(result) => {
                                  setLastTestResult(result);
                                  setLastTestQuestions(result.questions || null);
                              }}
                          />
                        </ErrorBoundary>
                        </>
                    )
                )}

                {showDailyRankCard && state.user && (
                    <DailyChallengeRankCard
                        userId={state.user.id}
                        classLevel={state.user.classLevel || '10'}
                        onClose={() => setShowDailyRankCard(false)}
                    />
                )}
                
                {(!activeWeeklyTest && state.view === 'BOARDS') && (
                  <ErrorBoundary fallbackLabel="Board Selection" compact>
                    <BoardSelection onSelect={handleBoardSelect} onBack={goBack} />
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
                    <SubjectSelection classLevel={state.selectedClass} stream={state.selectedStream} board={state.selectedBoard || undefined} onSelect={handleSubjectSelect} onBack={goBack} settings={state.settings} lucentNotes={(state.settings?.lucentNotes || []) as any[]} />
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
                        const _isNotesContent = state.lessonContent && (
                          ['NOTES_HTML_FREE','NOTES_HTML_PREMIUM','NOTES_IMAGE_AI','NOTES_SIMPLE','NOTES_PREMIUM'].includes(state.lessonContent.type) ||
                          (!_lcIsUrl && !['VIDEO_LECTURE','MCQ_ANALYSIS','MCQ_SIMPLE','WEEKLY_TEST','PDF_FREE','PDF_PREMIUM','PDF_ULTRA','PDF_VIEWER'].includes(state.lessonContent.type))
                        );
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
                              nextTitle={_nextChapter?.title}
                              isFirstChapter={_isFirstChapter}
                              onAdminBoard={(state.user?.role === 'ADMIN' || state.user?.role === 'SUB_ADMIN') ? () => setState(prev => ({...prev, view: 'ADMIN'})) : undefined}
                              onSendToMcqCommunity={(draft) => setAppMcqCommunityDraft(draft)}
                              onSessionCreditsEarned={handleSessionCreditsEarned}
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

      {mcqLimitPopup && state.user && (
        <McqLimitLockedPopup
          isOpen={true}
          used={mcqLimitPopup.used}
          limit={mcqLimitPopup.limit}
          creditCost={mcqLimitPopup.creditCost}
          userCredits={getTotalCredits(state.user)}
          onPayCredits={() => {
            const _updated = applyDeduction(state.user!, mcqLimitPopup.creditCost) ?? state.user!;
            localStorage.setItem('nst_current_user', JSON.stringify(_updated));
            saveUserToLive(_updated);
            setState(prev => ({ ...prev, user: _updated }));
            setMcqLimitPopup(null);
            handleContentGeneration(
              tempSelectedChapter ? ('MCQ_SIMPLE' as any) : 'MCQ_SIMPLE',
              undefined,
              true
            );
          }}
          onGoHome={() => {
            setMcqLimitPopup(null);
            setState(prev => ({ ...prev, view: 'STUDENT_DASHBOARD', lessonContent: null }));
            setIsFullScreen(false);
          }}
        />
      )}

      <FreeSubjectLessonPopup
        isOpen={showFreeSubjectPopup}
        subjectName={state.selectedSubject?.title || state.selectedSubject?.name || 'This Subject'}
        onClose={() => setShowFreeSubjectPopup(false)}
      />

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
      

      {streakLoginPopup && state.user && !inMcqSession && (
        <StreakLoginPopup
          newStreak={streakLoginPopup.newStreak}
          prevStreak={streakLoginPopup.prevStreak}
          isNewRecord={streakLoginPopup.isNewRecord}
          onClose={() => setStreakLoginPopup(null)}
          language={state.language}
        />
      )}

      {levelUpNotif && !inMcqSession && (
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
      
      {popupQueue.length > 0 && !showPremiumModal && !activeWeeklyTest && (
          <>
            {popupQueue[0] === 'CHALLENGE' && (
                <DailyChallengePopup
                    onStart={handleStartDailyChallenge}
                    onClose={() => handlePopupClose('CHALLENGE')}
                    rewardPercentage={state.settings.dailyChallengeConfig?.rewardPercentage || 90}
                />
            )}
          </>
      )}

      {lastTestResult && state.user && (
        <Suspense fallback={null}>
          <MarksheetCard
              result={lastTestResult}
              user={state.user}
              settings={state.settings}
              questions={lastTestQuestions || undefined}
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

      {toastMessage && (
          <div
              className="fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl pointer-events-none"
              style={{ background: 'rgba(30,30,50,0.92)', backdropFilter: 'blur(8px)', maxWidth: '90vw', textAlign: 'center' }}
          >
              {toastMessage}
          </div>
      )}

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

      {inAppBrowserUrl && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white" style={{paddingTop: 'env(safe-area-inset-top)'}}>
              <div className="relative flex items-center gap-2 px-3 py-2 shrink-0 overflow-hidden" style={{
                minHeight: '52px',
                background: 'linear-gradient(135deg,#0d0d20 0%,#1a0a35 60%,#0a1020 100%)',
              }}>
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'linear-gradient(105deg,transparent 30%,rgba(139,92,246,0.08) 50%,transparent 70%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 3s linear infinite',
                }} />
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

                <div className="flex-1 flex items-center justify-center">
                  <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full overflow-hidden" style={{
                    background: 'linear-gradient(90deg,rgba(139,92,246,0.2),rgba(99,102,241,0.15),rgba(139,92,246,0.2))',
                    border: '1px solid rgba(139,92,246,0.45)',
                    boxShadow: '0 0 14px rgba(139,92,246,0.3)',
                  }}>
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
    {homeToastData && (
      <HomeToastNotification
        data={homeToastData}
        onDismiss={() => { setHomeToastData(null); setGroupedSessions([]); setPendingSessionSummary(null); displayedSessionsRef.current = []; }}
      />
    )}
    </ErrorBoundary>
  );
};
export default App;

