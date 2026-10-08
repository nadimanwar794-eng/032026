// ─── Group Study & Live Classroom Realtime Service ──────────────────────────────
// Uses Firebase Realtime Database (RTDB) for ₹0 operational cost.
// Reads & writes are streamlined; timer ticks run purely in client memory.
// Presence uses onDisconnect() for automatic zero-cost member cleanup.

import { ref, set, get, update, remove, onValue, onDisconnect, push } from 'firebase/database';
import { rtdb, auth } from '../firebase';
import { notifyStudyRoomStartInBackground } from '../components/NotificationManager';
import { getLevelFromScore } from '../utils/levelSystem';

export interface GroupStudyMember {
  id: string;
  name: string;
  photoURL?: string;
  joinedAt: number;
  lastSeen: number;
  isHost: boolean;
  level?: number;
  xp?: number;
  totalXp?: number;
  handRaised?: boolean;
  statusText?: string;
  roomXp?: number;
  studyMinutes?: number;
}

export interface GroupStudyMessage {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  timestamp: number;
  type?: 'MESSAGE' | 'DOUBT' | 'HAND_RAISE' | 'SYSTEM';
}

export interface GroupStudyMcqQuestion {
  id?: string;
  question: string;
  statements?: string[];
  options: string[];
  correctIndex: number;
  explanation?: string;
  subject?: string;
}

export interface GroupStudyHostSync {
  view?: string;
  activeTab?: string;
  contentViewStep?: 'SUBJECTS' | 'CHAPTERS' | 'PLAYER';
  selectedBoard?: string;
  selectedClass?: string;
  selectedSubject?: {
    id: string;
    name: string;
    icon?: string;
  };
  selectedChapter?: {
    id: string;
    title: string;
    subject?: string;
    chapterNumber?: number | string;
    classLevel?: string;
  };
  contentType?: 'NOTES' | 'MCQ' | 'PDF' | 'AUDIO' | 'VIDEO' | 'OTHER';
  notesState?: {
    isOpen: boolean;
    title: string;
    chapterId?: string;
    topicIndex?: number;
    totalTopics?: number;
    activeTopicTitle?: string;
    scrollPercent?: number;
    isAudioPlaying?: boolean;
  };
  activeMcq?: {
    isOpen: boolean;
    chapterId?: string;
    chapterTitle?: string;
    questionIndex: number;
    totalQuestions: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    status: 'QUESTION' | 'REVEAL' | 'ENDED';
    startTime: number;
    durationSeconds: number;
    studentAnswers?: Record<string, {
      studentName: string;
      studentPhoto?: string;
      selectedOption: number;
      isCorrect: boolean;
      timeTaken: number;
      timestamp: number;
    }>;
  };
  timestamp: number;
}

export type StudyRoomMcqType = 'MCQ_PRACTICE' | 'PROJECTOR_MODE' | 'REVISION_HUB';

export interface McqAnswerOutcome {
  isCorrect: boolean;
  baseXp: number;
  streakBonusXp: number;
  netXpChange: number;
  currentStreak: number;
  maxStreak: number;
  streakBrokenAt?: number;
  earnedPoints: number;
  timeTakenSec?: number;
}

export interface GroupStudyRoom {
  id: string;
  name: string;
  subject: string;
  description?: string;
  code: string;
  password: string;
  isPrivate: boolean;
  hostId: string;
  hostName: string;
  hostPhotoURL?: string;
  createdAt: number;
  lastActive: number;
  maxMembers: number;
  mode: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS';
  mcqType: StudyRoomMcqType;
  durationMinutes: number;
  expiresAt: number;
  isExpired?: boolean;
  isDeleted?: boolean;
  totalRoomXp?: number;
  isScheduled?: boolean;
  scheduledStartTime?: number;
  autoRunWithoutHost?: boolean;
  themeColor?: 'blue' | 'black' | 'white';
  timer: {
    durationMinutes: number;
    startTime: number | null;
    isPaused: boolean;
    remainingSeconds: number;
  };
  preloadedTitle?: string;
  preloadedQuestions?: GroupStudyMcqQuestion[];
  liveClass?: {
    isActive: boolean;
    title: string;
    classUrl?: string;
    lectureNotes?: string;
    pinnedDoubt?: string;
  };
  liveMcq?: {
    isActive: boolean;
    title: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    autoAdvance?: boolean;
    autoAdvanceSeconds?: number;
    questionStartTime: number;
    durationPerQuestion: number;
    timerMode?: 'PER_QUESTION' | 'TOTAL_TEST' | 'MIX';
    totalTestDurationMinutes?: number;
    testStartTime?: number;
    testEndTime?: number;
    targetPaceSeconds?: number;
    vibrateOnPaceAlert?: boolean;
    status: 'WAITING' | 'QUESTION' | 'REVEAL' | 'ENDED';
    questions: GroupStudyMcqQuestion[];
    scores?: Record<string, {
      name: string;
      score: number;
      correctCount: number;
      wrongCount?: number;
      totalAnswered: number;
      lastAnswerTime?: number;
      selectedOption?: number;
      currentStreak?: number;
      maxStreak?: number;
      userXp?: number;
      streakBonusXp?: number;
    }>;
    questionAnswers?: Record<
      number,
      Record<
        string,
        {
          userId: string;
          userName: string;
          userPhotoURL?: string;
          selectedOption: number;
          isCorrect: boolean;
          timeTakenSec: number;
          timestamp: number;
        }
      >
    >;
  };
  hostSync?: GroupStudyHostSync;
  members?: Record<string, GroupStudyMember>;
  chat?: Record<string, GroupStudyMessage>;
}

// ── Built-in Quick Battle Question Sets ──────────────────────────────────────────
// Curated sets for Competition books so rooms can immediately launch battles
export const CURATED_MCQ_SETS: Array<{ id: string; name: string; subject: string; bookId?: string; emoji: string; questions: GroupStudyMcqQuestion[] }> = [
  {
    id: 'curated_lucent_polity',
    name: 'Lucent भारतीय संविधान एवं राजव्यवस्था',
    subject: 'Polity & Constitution',
    bookId: 'lucent',
    emoji: '📖',
    questions: [
      {
        question: 'संविधान सभा की प्रारूप समिति (Drafting Committee) के अध्यक्ष कौन थे?',
        options: ['डॉ. राजेंद्र प्रसाद', 'डॉ. भीमराव आंबेडकर', 'जवाहरलाल नेहरू', 'बी. एन. राव'],
        correctIndex: 1,
        explanation: 'डॉ. बी.आर. आंबेडकर संविधान सभा की प्रारूप समिति के अध्यक्ष थे।',
      },
      {
        question: 'भारतीय संविधान में मौलिक अधिकार (Fundamental Rights) किस देश के संविधान से प्रेरित हैं?',
        options: ['रूस', 'ब्रिटेन', 'संयुक्त राज्य अमेरिका (USA)', 'कनाडा'],
        correctIndex: 2,
        explanation: 'भारतीय संविधान में मौलिक अधिकार संयुक्त राज्य अमेरिका से लिए गए हैं।',
      },
      {
        question: 'संविधान के किस अनुच्छेद को डॉ. आंबेडकर ने "संविधान की आत्मा और हृदय" कहा था?',
        options: ['अनुच्छेद 14', 'अनुच्छेद 19', 'अनुच्छेद 21', 'अनुच्छेद 32'],
        correctIndex: 3,
        explanation: 'अनुच्छेद 32 (संवैधानिक उपचारों का अधिकार) को डॉ. आंबेडकर ने संविधान की आत्मा कहा था।',
      },
      {
        question: 'भारतीय संविधान में कुल कितनी अनुसूचियाँ (Schedules) वर्तमान में हैं?',
        options: ['8', '10', '12', '14'],
        correctIndex: 2,
        explanation: 'मूल संविधान में 8 अनुसूचियाँ थीं, वर्तमान में 12 अनुसूचियाँ हैं।',
      },
      {
        question: 'भारत में पंचायती राज व्यवस्था का उद्घाटन सर्वप्रथम किस राज्य में हुआ था?',
        options: ['उत्तर प्रदेश', 'राजस्थान (नागौर)', 'बिहार', 'मध्य प्रदेश'],
        correctIndex: 1,
        explanation: '2 अक्टूबर 1959 को राजस्थान के नागौर जिले में पंडित नेहरू द्वारा पंचायती राज का उद्घाटन हुआ था।',
      },
    ],
  },
  {
    id: 'curated_lucent_history',
    name: 'Lucent प्राचीन व मध्यकालीन भारत इतिहास',
    subject: 'Indian History',
    bookId: 'lucent',
    emoji: '📖',
    questions: [
      {
        question: 'सिंधु घाटी सभ्यता का प्रमुख बंदरगाह कौन-सा नगर था?',
        options: ['हड़प्पा', 'कालीबंगा', 'लोथल', 'मोहनजोदड़ो'],
        correctIndex: 2,
        explanation: 'लोथल (गुजरात) हड़प्पा सभ्यता का एक प्रमुख बंदरगाह था।',
      },
      {
        question: 'तराइन का प्रथम युद्ध (1191 ई.) किसके बीच लड़ा गया था?',
        options: [
          'मोहम्मद गोरी और पृथ्वीराज चौहान',
          'बाबर और इब्राहिम लोदी',
          'अकबर और हेमू',
          'महमूद गजनवी और जयपाल',
        ],
        correctIndex: 0,
        explanation: 'तराइन का प्रथम युद्ध 1191 ई. में पृथ्वीराज चौहान और मोहम्मद गोरी के मध्य हुआ, जिसमें पृथ्वीराज चौहान विजयी रहे।',
      },
      {
        question: 'जैन धर्म के 24वें एवं अंतिम तीर्थंकर कौन थे?',
        options: ['ऋषभदेव', 'पार्श्वनाथ', 'महावीर स्वामी', 'अरिष्टनेमि'],
        correctIndex: 2,
        explanation: 'महावीर स्वामी जैन धर्म के 24वें और अंतिम तीर्थंकर थे।',
      },
      {
        question: 'मुगल साम्राज्य की स्थापना 1526 में पानीपत के प्रथम युद्ध के बाद किसने की थी?',
        options: ['हुमायूँ', 'बाबर', 'शेरशाह सूरी', 'अकबर'],
        correctIndex: 1,
        explanation: 'बाबर ने 1526 में पानीपत के प्रथम युद्ध में इब्राहिम लोदी को हराकर मुगल साम्राज्य की स्थापना की।',
      },
    ],
  },
  {
    id: 'curated_speedy_science',
    name: 'Speedy Science • सामान्य विज्ञान प्रश्नोत्तरी',
    subject: 'General Science',
    bookId: 'speedyScience',
    emoji: '🔬',
    questions: [
      {
        question: 'ध्वनि की गति किस माध्यम में सर्वाधिक तेज होती है?',
        options: ['वायु में', 'जल में', 'ठोस (इस्पात) में', 'निर्वात में'],
        correctIndex: 2,
        explanation: 'ध्वनि की गति ठोस माध्यमों में सबसे अधिक होती है, जबकि निर्वात में ध्वनि गमन नहीं कर सकती।',
      },
      {
        question: 'रक्त का सामान्य pH मान कितना होता है?',
        options: ['6.4', '7.0', '7.4', '8.2'],
        correctIndex: 2,
        explanation: 'मानव रक्त हल्का क्षारीय होता है और इसका pH मान लगभग 7.4 होता है।',
      },
      {
        question: 'विटामिन C का रासायनिक नाम क्या है?',
        options: ['थायमिन', 'एस्कॉर्बिक एसिड', 'कैल्सीफेरॉल', 'रेटिनॉल'],
        correctIndex: 1,
        explanation: 'विटामिन C का रासायनिक नाम एस्कॉर्बिक एसिड (Ascorbic Acid) है।',
      },
      {
        question: 'मानव शरीर की सबसे बड़ी ग्रंथि (Largest Gland) कौन-सी है?',
        options: ['थायरॉयड', 'यकृत (Liver)', 'अग्न्याशय (Pancreas)', 'पीयूष ग्रंथि'],
        correctIndex: 1,
        explanation: 'यकृत (Liver) मानव शरीर की सबसे बड़ी ग्रंथि है।',
      },
      {
        question: 'प्रकाश वर्ष (Light Year) किसका मात्रक है?',
        options: ['समय का', 'प्रकाश की तीव्रता का', 'खगोलीय दूरी का', 'ऊर्जा का'],
        correctIndex: 2,
        explanation: 'प्रकाश वर्ष अत्यधिक लम्बी खगोलीय दूरियों को मापने का मात्रक है।',
      },
    ],
  },
  {
    id: 'curated_speedy_social',
    name: 'Speedy Social Science • सामान्य अध्ययन',
    subject: 'Social Science',
    bookId: 'speedySocialScience',
    emoji: '🌍',
    questions: [
      {
        question: 'कर्क रेखा भारत के कितने राज्यों से होकर गुजरती है?',
        options: ['6', '7', '8', '9'],
        correctIndex: 2,
        explanation: 'कर्क रेखा भारत के 8 राज्यों (गुजरात, राजस्थान, म.प्र., छत्तीसगढ़, झारखंड, प. बंगाल, त्रिपुरा, मिजोरम) से गुजरती है।',
      },
      {
        question: 'भारत छोड़ो आंदोलन (Quit India Movement) किस वर्ष प्रारंभ हुआ था?',
        options: ['1920', '1930', '1942', '1947'],
        correctIndex: 2,
        explanation: '8 अगस्त 1942 को बॉम्बे से महात्मा गांधी के नेतृत्व में भारत छोड़ो आंदोलन शुरू हुआ था।',
      },
      {
        question: 'भारतीय संविधान की आठवीं अनुसूची में कितनी भाषाओं को मान्यता दी गई है?',
        options: ['18', '20', '22', '24'],
        correctIndex: 2,
        explanation: 'भारतीय संविधान की आठवीं अनुसूची में वर्तमान में 22 प्राधिकृत भाषाएँ शामिल हैं।',
      },
      {
        question: 'नीति आयोग (NITI Aayog) के पदेन अध्यक्ष कौन होते हैं?',
        options: ['राष्ट्रपति', 'प्रधानमंत्री', 'वित्त मंत्री', 'रिजर्व बैंक गवर्नर'],
        correctIndex: 1,
        explanation: 'भारत के प्रधानमंत्री नीति आयोग के पदेन अध्यक्ष (Ex-officio Chairman) होते हैं।',
      },
    ],
  },
  {
    id: 'curated_sar_sangrah',
    name: 'Sar Sangrah • NCERT सार संग्रह स्पेशल',
    subject: 'NCERT Sar Sangrah',
    bookId: 'sarSangrah',
    emoji: '📜',
    questions: [
      {
        question: 'भारत का राष्ट्रीय आदर्श वाक्य "सत्यमेव जयते" किस उपनिषद से लिया गया है?',
        options: ['कठोपनिषद', 'मुण्डकोपनिषद', 'छांदोग्य उपनिषद', 'केनोपनिषद'],
        correctIndex: 1,
        explanation: '"सत्यमेव जयते" मुण्डकोपनिषद से उद्धृत है।',
      },
      {
        question: 'भारतीय राष्ट्रीय कांग्रेस के प्रथम अधिवेशन (1885) के अध्यक्ष कौन थे?',
        options: ['व्योमेश चन्द्र बनर्जी', 'दादाभाई नौरोजी', 'ए. ओ. ह्यूम', 'सुरेंद्रनाथ बनर्जी'],
        correctIndex: 0,
        explanation: 'भारतीय राष्ट्रीय कांग्रेस के पहले अध्यक्ष व्योमेश चन्द्र बनर्जी (W.C. Bonnerjee) थे।',
      },
      {
        question: 'ओजोन परत (Ozone Layer) वायुमंडल की किस परत में अवस्थित है?',
        options: ['क्षोभ मंडल (Troposphere)', 'समताप मंडल (Stratosphere)', 'मध्य मंडल (Mesosphere)', 'आयन मंडल'],
        correctIndex: 1,
        explanation: 'ओजोन परत समताप मंडल (Stratosphere) में पाई जाती है, जो पराबैंगनी किरणों से रक्षा करती है।',
      },
      {
        question: 'भारत का एकमात्र सक्रिय ज्वालामुखी कहाँ स्थित है?',
        options: ['नारकोंडम द्वीप', 'बैरन द्वीप (अंडमान)', 'लक्षद्वीप', 'कच्छ का रण'],
        correctIndex: 1,
        explanation: 'बैरन द्वीप (Barren Island, अंडमान एवं निकोबार) भारत का एकमात्र सक्रिय ज्वालामुखी है।',
      },
    ],
  },
  {
    id: 'curated_mcq_practice',
    name: 'MCQ Practice Bank • ऑल इंडिया टेस्ट सेट',
    subject: 'General Practice',
    bookId: 'mcq',
    emoji: '🎯',
    questions: [
      {
        question: 'भारत में राष्ट्रीय खेल दिवस किस तिथि को मेजर ध्यानचंद की जयंती पर मनाया जाता है?',
        options: ['15 अगस्त', '29 अगस्त', '5 सितंबर', '14 नवंबर'],
        correctIndex: 1,
        explanation: '29 अगस्त को हॉकी के जादूगर मेजर ध्यानचंद के जन्मदिवस पर राष्ट्रीय खेल दिवस मनाया जाता है।',
      },
      {
        question: 'वायुमंडल में सर्वाधिक मात्रा में पाई जाने वाली गैस कौन-सी है?',
        options: ['ऑक्सीजन (21%)', 'कार्बन डाइऑक्साइड (0.04%)', 'नाइट्रोजन (लगभग 78%)', 'आर्गन'],
        correctIndex: 2,
        explanation: 'वायुमंडल में नाइट्रोजन की मात्रा सर्वाधिक (लगभग 78.08%) है।',
      },
      {
        question: 'भारत का प्रथम राष्ट्रीय उद्यान (National Park) कौन-सा है?',
        options: ['काजीरंगा राष्ट्रीय उद्यान', 'जिम कॉर्बेट राष्ट्रीय उद्यान', 'कान्हा राष्ट्रीय उद्यान', 'गिर राष्ट्रीय उद्यान'],
        correctIndex: 1,
        explanation: 'उत्तराखंड में स्थित जिम कॉर्बेट राष्ट्रीय उद्यान (पहले हैली नेशनल पार्क) भारत का पहला राष्ट्रीय उद्यान है।',
      },
      {
        question: 'अंतर्राष्ट्रीय योग दिवस (International Yoga Day) प्रतिवर्ष किस तिथि को मनाया जाता है?',
        options: ['21 मई', '5 जून', '21 जून', '11 जुलाई'],
        correctIndex: 2,
        explanation: '21 जून को विश्व स्तर पर अंतर्राष्ट्रीय योग दिवस मनाया जाता है।',
      },
    ],
  },
];

// ── Room Cooldown (Day, Hour, Min, Sec) Helper ──────────────────────────────
export interface RoomCooldown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
  isStarted: boolean;
}

export const formatDayHourMinSec = (targetTime: number, nowTime: number = Date.now()): RoomCooldown => {
  const diffMs = targetTime - nowTime;
  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: '0d 00h 00m 00s',
      isStarted: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted,
    isStarted: false,
  };
};

// ── Room Code Generator ────────────────────────────────────────────────────────
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ── Local Fallback Cache for Smooth Experience ──────────────────────────────
const LOCAL_ROOMS_KEY = 'iic_cached_study_rooms';

export const getCachedRooms = (): Record<string, GroupStudyRoom> => {
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveCachedRoom = (room: GroupStudyRoom) => {
  if (!room || !room.id) return;
  try {
    const map = getCachedRooms();
    const ensuredRoom: GroupStudyRoom = {
      ...room,
      code: (room.code || room.id.slice(-6) || 'STUDY1').toUpperCase(),
      password: (room.password || '1234').trim(),
    };
    map[room.id] = ensuredRoom;
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(map));
  } catch {}
};

const CREATED_ROOMS_KEY = 'nst_my_created_rooms_v1';

export const markRoomAsCreatedByMe = (roomId: string) => {
  try {
    const raw = localStorage.getItem(CREATED_ROOMS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(roomId)) {
      ids.push(roomId);
      localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(ids));
    }
  } catch {}
};

export const isRoomCreatedByMe = (roomId: string, hostId?: string, currentUserId?: string): boolean => {
  if (hostId && currentUserId && hostId === currentUserId) return true;
  if (auth.currentUser && hostId && hostId === auth.currentUser.uid) return true;
  try {
    const raw = localStorage.getItem(CREATED_ROOMS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.includes(roomId)) return true;
  } catch {}
  return false;
};

export const removeCachedRoom = (roomId: string) => {
  try {
    const map = getCachedRooms();
    delete map[roomId];
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(map));
  } catch {}
};

// ── Subscribe to All Active Rooms ──────────────────────────────────────────────
export const subscribeToActiveRooms = (callback: (rooms: GroupStudyRoom[]) => void): (() => void) => {
  const roomsRef = ref(rtdb, 'group_study_rooms');
  const unsubscribe = onValue(roomsRef, (snap) => {
    const val = snap.val();
    const localMap = getCachedRooms();
    const merged: Record<string, GroupStudyRoom> = { ...localMap };

    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([k, v]: [string, any]) => {
        if (v && !v.isDeleted) {
          const roomObj: GroupStudyRoom = {
            ...v,
            id: v.id || k,
            code: (v.code || (v.id || k).slice(-6) || 'STUDY1').toUpperCase(),
            password: (v.password || '1234').trim(),
          };
          merged[k] = roomObj;
          saveCachedRoom(roomObj);
        } else if (v?.isDeleted) {
          delete merged[k];
          removeCachedRoom(k);
        }
      });
    }

    const list: GroupStudyRoom[] = Object.values(merged).filter(r => !r.isDeleted);
    // Filter rooms active in the last 24 hours OR scheduled for future
    const now = Date.now();
    const activeList = list.filter((r) => {
      if (r.isDeleted) return false;
      if (r.isScheduled && r.scheduledStartTime && r.scheduledStartTime > now) return true;
      const isFresh = (now - (r.lastActive || r.createdAt || 0)) < 24 * 3600 * 1000;
      return isFresh;
    }).sort((a, b) => {
      // Upcoming scheduled tests shown prominently
      const aUpcoming = Boolean(a.isScheduled && a.scheduledStartTime && a.scheduledStartTime > now);
      const bUpcoming = Boolean(b.isScheduled && b.scheduledStartTime && b.scheduledStartTime > now);
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;
      if (aUpcoming && bUpcoming) return (a.scheduledStartTime || 0) - (b.scheduledStartTime || 0);
      return (b.lastActive || b.createdAt) - (a.lastActive || a.createdAt);
    });

    callback(activeList);
  }, (err) => {
    console.warn('RTDB study rooms listen warning, using local cache:', err);
    const localList = Object.values(getCachedRooms()).filter(r => !r.isDeleted);
    callback(localList);
  });

  return () => unsubscribe();
};

// ── Subscribe to a Single Room ────────────────────────────────────────────────
export const subscribeToRoom = (roomId: string, callback: (room: GroupStudyRoom | null) => void): (() => void) => {
  const roomRef = ref(rtdb, `group_study_rooms/${roomId}`);
  let hasReceivedFirstSnapshot = false;

  const unsubscribe = onValue(roomRef, (snap) => {
    const val = snap.val();
    if (val && !val.isDeleted) {
      hasReceivedFirstSnapshot = true;
      const roomWithId: GroupStudyRoom = {
        ...val,
        id: val.id || roomId,
        code: (val.code || (val.id || roomId).slice(-6) || 'STUDY1').toUpperCase(),
        password: (val.password || '1234').trim(),
      };
      saveCachedRoom(roomWithId);
      callback(roomWithId);
    } else if (val?.isDeleted) {
      removeCachedRoom(roomId);
      callback(null);
    } else {
      // RTDB value is null or pending; check local cache before assuming deleted
      const cached = getCachedRooms()[roomId];
      if (cached && !cached.isDeleted) {
        callback(cached);
      } else if (hasReceivedFirstSnapshot) {
        // Only emit null if we previously had a valid snapshot and it was truly removed
        callback(null);
      }
    }
  }, (err) => {
    console.warn(`RTDB subscribe error for room ${roomId}, using cache:`, err);
    const cached = getCachedRooms()[roomId];
    if (cached && !cached.isDeleted) {
      callback(cached);
    }
  });

  return () => unsubscribe();
};

// ── Find a Room by Code or ID ────────────────────────────────────────────────
export const findRoomByCodeOrId = async (query: string): Promise<GroupStudyRoom | null> => {
  if (!query) return null;
  const clean = query.trim().toUpperCase();

  // 1. Search in local cache first
  try {
    const localMap = getCachedRooms();
    for (const r of Object.values(localMap)) {
      if (r && !r.isDeleted) {
        const c = (r.code || r.id?.slice(-6) || '').toUpperCase();
        if (c === clean || r.id?.toUpperCase() === clean || r.id?.slice(-6).toUpperCase() === clean) {
          return {
            ...r,
            code: c || clean,
            password: (r.password || '1234').trim(),
          };
        }
      }
    }
  } catch {}

  // 2. Query Firebase RTDB
  try {
    const snap = await get(ref(rtdb, 'group_study_rooms'));
    if (snap.exists()) {
      const data = snap.val();
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data as Record<string, any>)) {
          if (v && !v.isDeleted) {
            const c = (v.code || k.slice(-6) || '').toUpperCase();
            if (c === clean || k.toUpperCase() === clean || k.slice(-6).toUpperCase() === clean) {
              const matchedRoom: GroupStudyRoom = {
                ...v,
                id: v.id || k,
                code: c || clean,
                password: (v.password || '1234').trim(),
              };
              saveCachedRoom(matchedRoom);
              return matchedRoom;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[GroupStudy] findRoomByCodeOrId query error:', err);
  }

  return null;
};

// ── Create a New Group Room ───────────────────────────────────────────────────
export const createGroupRoom = async (
  roomData: {
    name: string;
    subject: string;
    password?: string;
    description?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    mode?: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS';
    mcqType?: StudyRoomMcqType;
    durationMinutes?: number;
    isScheduled?: boolean;
    scheduledStartTime?: number;
    autoRunWithoutHost?: boolean;
    themeColor?: 'blue' | 'black' | 'white';
    preloadedQuestions?: GroupStudyMcqQuestion[];
    preloadedTitle?: string;
    durationPerQuestion?: number;
  },
  host: {
    id: string;
    name: string;
    photoURL?: string;
    level?: number;
    xp?: number;
  }
): Promise<string> => {
  const cleanPassword = (roomData.password || '').trim();
  const isPrivate = roomData.isPrivate !== undefined ? roomData.isPrivate : (cleanPassword.length > 0);

  const roomsRef = ref(rtdb, 'group_study_rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key || `room_${Date.now()}`;
  const now = Date.now();
  const code = generateRoomCode();
  const effectiveHostId = auth.currentUser?.uid || host.id || 'host';

  const hostXp = host.xp || 0;
  const hostLevel = host.level || (hostXp > 0 ? getLevelFromScore(hostXp) : 1);

  const hostMember: GroupStudyMember = {
    id: effectiveHostId,
    name: host.name || 'Host',
    photoURL: host.photoURL || '',
    joinedAt: now,
    lastSeen: now,
    isHost: true,
    level: hostLevel,
    xp: hostXp,
    totalXp: hostXp,
    handRaised: false,
    statusText: 'Hosting Room',
    roomXp: 0,
    studyMinutes: 0,
  };

  const durationMinutes = roomData.durationMinutes && roomData.durationMinutes > 0 ? roomData.durationMinutes : 30;
  const baseTime = roomData.isScheduled && roomData.scheduledStartTime && roomData.scheduledStartTime > now
    ? roomData.scheduledStartTime
    : now;
  const expiresAt = baseTime + durationMinutes * 60 * 1000;
  const mcqType = roomData.mcqType || 'PROJECTOR_MODE';

  const initialRoom: GroupStudyRoom = {
    id: roomId,
    name: roomData.name.trim() || `${host.name}'s MCQ Arena`,
    subject: roomData.subject || 'General Knowledge',
    description: roomData.description?.trim() || '',
    code,
    password: cleanPassword,
    isPrivate: isPrivate,
    hostId: effectiveHostId,
    hostName: host.name,
    hostPhotoURL: host.photoURL,
    createdAt: now,
    lastActive: now,
    maxMembers: Math.min(Math.max(roomData.maxMembers || 30, 5), 100),
    mode: 'LIVE_MCQ',
    mcqType,
    durationMinutes,
    expiresAt,
    isExpired: false,
    totalRoomXp: 0,
    isScheduled: Boolean(roomData.isScheduled),
    scheduledStartTime: roomData.scheduledStartTime,
    autoRunWithoutHost: roomData.autoRunWithoutHost !== undefined ? roomData.autoRunWithoutHost : true,
    themeColor: roomData.themeColor || 'blue',
    timer: {
      durationMinutes,
      startTime: now,
      isPaused: false,
      remainingSeconds: durationMinutes * 60,
    },
    liveClass: {
      isActive: false,
      title: 'Welcome to Live MCQ Room',
      lectureNotes: '',
      classUrl: '',
    },
    liveMcq: {
      isActive: false,
      title: roomData.preloadedTitle || `${roomData.subject || 'Lesson'} MCQ Battle`,
      currentQuestionIndex: 0,
      totalQuestions: (roomData.preloadedQuestions || []).length,
      questionStartTime: 0,
      durationPerQuestion: roomData.durationPerQuestion || (mcqType === 'REVISION_HUB' ? 15 : (mcqType === 'PROJECTOR_MODE' ? 25 : 20)),
      status: 'WAITING',
      questions: roomData.preloadedQuestions || [],
      scores: {},
    },
    members: {
      [effectiveHostId]: hostMember,
    },
    chat: {
      welcome_msg: {
        id: 'welcome_msg',
        userId: effectiveHostId,
        userName: 'IIC Study Bot',
        text: `🎉 Room created by ${host.name}! Mode: ${mcqType === 'REVISION_HUB' ? '⚡ MCQ +' : '🎯 MCQ'}. Room duration: ${durationMinutes} mins.${roomData.isScheduled ? ' ⏰ Scheduled Room — Auto-starts at scheduled time!' : ''}`,
        timestamp: now,
        type: 'SYSTEM',
      }
    }
  };

  // 1. Always save in local room cache first
  saveCachedRoom(initialRoom);

  // 2. Sync to Firebase Realtime Database
  try {
    await set(newRoomRef, initialRoom);

    // Setup onDisconnect for host member presence (does NOT destroy entire room so host migration can occur)
    try {
      const hostMemberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${effectiveHostId}`);
      onDisconnect(hostMemberRef).remove();
    } catch {}
  } catch (err: any) {
    console.warn('[GroupStudy] RTDB write error, room kept in local session:', err);
  }

  return roomId;
};

// ── Join a Room ───────────────────────────────────────────────────────────────
export const joinGroupRoom = async (
  roomId: string,
  user: {
    id: string;
    name: string;
    photoURL?: string;
    level?: number;
    xp?: number;
  }
): Promise<boolean> => {
  const roomRef = ref(rtdb, `group_study_rooms/${roomId}`);
  let room: GroupStudyRoom | null = null;
  
  try {
    const snap = await get(roomRef);
    if (snap.exists()) {
      room = snap.val();
    }
  } catch {}

  if (!room) {
    room = getCachedRooms()[roomId] || null;
  }
  if (!room) return false;

  const members = room.members || {};
  const memberCount = Object.keys(members).length;

  if (memberCount >= room.maxMembers && !members[user.id]) {
    throw new Error('Room is currently full (max members reached).');
  }

  const now = Date.now();
  const effectiveUserId = auth.currentUser?.uid || user.id;
  const userXp = user.xp || 0;
  const userLevel = user.level || (userXp > 0 ? getLevelFromScore(userXp) : 1);

  const newMember: GroupStudyMember = {
    id: effectiveUserId,
    name: user.name,
    photoURL: user.photoURL,
    joinedAt: now,
    lastSeen: now,
    isHost: room.hostId === effectiveUserId,
    level: userLevel,
    xp: userXp,
    totalXp: userXp,
    roomXp: 0,
    studyMinutes: 0,
    handRaised: false,
    statusText: 'Studying',
  };

  // Update local cache
  if (!room.members) room.members = {};
  room.members[effectiveUserId] = newMember;
  room.lastActive = now;
  saveCachedRoom(room);

  // Add member in RTDB
  try {
    const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${effectiveUserId}`);
    await set(memberRef, newMember);

    try {
      onDisconnect(memberRef).remove();
    } catch {}

    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      lastActive: now,
    });

    // Post join message if not already present
    if (!members[effectiveUserId]) {
      const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
      const newMsgRef = push(chatRef);
      await set(newMsgRef, {
        id: newMsgRef.key,
        userId: effectiveUserId,
        userName: user.name,
        text: `👋 ${user.name} joined the room`,
        timestamp: now,
        type: 'SYSTEM',
      });
    }
  } catch (err) {
    console.warn('[GroupStudy] Join RTDB sync error:', err);
  }

  return true;
};

// ── Leave a Room ──────────────────────────────────────────────────────────────
export const leaveGroupRoom = async (roomId: string, userId: string, userName: string): Promise<void> => {
  const effectiveUserId = auth.currentUser?.uid || userId;
  try {
    const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${effectiveUserId}`);
    try {
      onDisconnect(memberRef).cancel();
      await remove(memberRef);
    } catch {}

    // Check if room host left OR if 0 members are left in the room
    const roomSnap = await get(ref(rtdb, `group_study_rooms/${roomId}`));
    if (roomSnap.exists()) {
      const room: GroupStudyRoom = roomSnap.val();
      const isHost =
        room.hostId === effectiveUserId ||
        room.hostId === userId ||
        isRoomCreatedByMe(roomId, room.hostId, userId) ||
        isRoomCreatedByMe(roomId, room.hostId, effectiveUserId);

      const remainingMembers = Object.keys(room.members || {}).filter((id) => id !== effectiveUserId);

      // "Room se bahar aane pe ab room destroy nahi hoga": Room stays alive even if 0 members remain!
      if (remainingMembers.length === 0) {
        // Room persists so host or students can re-enter, or scheduled battle can auto-start
        try {
          await update(ref(rtdb, `group_study_rooms/${roomId}`), {
            lastActive: Date.now(),
          });
        } catch {}
      } else if (isHost) {
        // HOST MIGRATION: Promote the highest-level and highest-XP remaining member to new Host!
        const memberList: GroupStudyMember[] = remainingMembers
          .map((mid) => room.members?.[mid])
          .filter((m): m is GroupStudyMember => !!m);

        memberList.sort((a, b) => {
          const lvlA = a.level || 1;
          const lvlB = b.level || 1;
          if (lvlB !== lvlA) return lvlB - lvlA;
          const xpA = a.xp ?? a.totalXp ?? a.roomXp ?? 0;
          const xpB = b.xp ?? b.totalXp ?? b.roomXp ?? 0;
          if (xpB !== xpA) return xpB - xpA;
          return (a.joinedAt || 0) - (b.joinedAt || 0);
        });

        const newHost = memberList[0];
        if (newHost) {
          try {
            await update(ref(rtdb, `group_study_rooms/${roomId}`), {
              hostId: newHost.id,
              hostName: newHost.name,
              hostPhotoURL: newHost.photoURL || '',
              lastActive: Date.now(),
            });
            await update(ref(rtdb, `group_study_rooms/${roomId}/members/${newHost.id}`), {
              isHost: true,
              statusText: 'Hosting Room',
            });

            // Announce new host in room chat
            const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
            const newMsgRef = push(chatRef);
            await set(newMsgRef, {
              id: newMsgRef.key,
              userId: 'system',
              userName: 'System',
              text: `👑 Host left the room. ${newHost.name} (Highest Level ${newHost.level || 1}, ${newHost.xp ?? newHost.totalXp ?? 0} XP) is now the new Host!`,
              timestamp: Date.now(),
              type: 'SYSTEM',
            });
          } catch (migrateErr) {
            console.warn('[GroupStudy] Host migration error:', migrateErr);
          }
        } else {
          try {
            await update(ref(rtdb, `group_study_rooms/${roomId}`), {
              lastActive: Date.now(),
            });
          } catch {}
        }
      } else {
        // Send leave message
        const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
        const newMsgRef = push(chatRef);
        await set(newMsgRef, {
          id: newMsgRef.key,
          userId: effectiveUserId,
          userName: userName,
          text: `🏃 ${userName} left the room`,
          timestamp: Date.now(),
          type: 'SYSTEM',
        });
      }
    }
  } catch (err) {
    console.error('Error leaving group room:', err);
  }
};

/**
 * Elects and promotes the highest Level & XP member to host if the current host went offline or disconnected.
 * Ensures room never closes when host drops out.
 */
export const electAndPromoteHighestLevelHost = async (
  roomId: string,
  room?: GroupStudyRoom | null
): Promise<GroupStudyMember | null> => {
  try {
    let targetRoom = room;
    if (!targetRoom) {
      const snap = await get(ref(rtdb, `group_study_rooms/${roomId}`));
      if (snap.exists()) {
        targetRoom = snap.val();
      }
    }
    if (!targetRoom || !targetRoom.members) return null;

    const memberList = Object.values(targetRoom.members).filter((m): m is GroupStudyMember => !!m);
    if (memberList.length === 0) return null;

    // If host is still in members and active, nothing to do
    if (targetRoom.hostId && targetRoom.members[targetRoom.hostId]) {
      return targetRoom.members[targetRoom.hostId];
    }

    // Host is disconnected / gone! Sort by highest level, then highest XP
    memberList.sort((a, b) => {
      const lvlA = a.level || 1;
      const lvlB = b.level || 1;
      if (lvlB !== lvlA) return lvlB - lvlA;
      const xpA = a.xp ?? a.totalXp ?? a.roomXp ?? 0;
      const xpB = b.xp ?? b.totalXp ?? b.roomXp ?? 0;
      if (xpB !== xpA) return xpB - xpA;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

    const newHost = memberList[0];
    if (!newHost) return null;

    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      hostId: newHost.id,
      hostName: newHost.name,
      hostPhotoURL: newHost.photoURL || '',
      lastActive: Date.now(),
    });
    await update(ref(rtdb, `group_study_rooms/${roomId}/members/${newHost.id}`), {
      isHost: true,
      statusText: 'Hosting Room',
    });

    // Announce promotion in chat
    const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      id: newMsgRef.key,
      userId: 'system',
      userName: 'System',
      text: `👑 Host went offline. ${newHost.name} (Highest Level ${newHost.level || 1}, ${newHost.xp ?? newHost.totalXp ?? 0} XP) has been elected as the new Host!`,
      timestamp: Date.now(),
      type: 'SYSTEM',
    });

    return newHost;
  } catch (err) {
    console.warn('[GroupStudy] electAndPromoteHighestLevelHost error:', err);
    return null;
  }
};

// ── Delete / Destroy a Room (Host or Admin Only) ───────────────────────────────
export const deleteGroupRoom = async (roomId: string): Promise<void> => {
  try {
    // 1. Remove from local cache immediately
    removeCachedRoom(roomId);

    // 2. Mark as deleted in RTDB so real-time subscribers immediately disconnect
    try {
      await update(ref(rtdb, `group_study_rooms/${roomId}`), { isDeleted: true });
    } catch {}

    // 3. Remove room node from Firebase RTDB
    const roomRef = ref(rtdb, `group_study_rooms/${roomId}`);
    await remove(roomRef);
  } catch (err) {
    console.error('Error deleting group room from RTDB:', err);
    // Even if RTDB fails or has permission issues, clean local cache
    removeCachedRoom(roomId);
  }
};

// ── Send a Chat Message / Doubt / Reaction ─────────────────────────────────────
export const sendRoomMessage = async (
  roomId: string,
  user: { id: string; name: string; photoURL?: string },
  text: string,
  type: 'MESSAGE' | 'DOUBT' | 'HAND_RAISE' | 'SYSTEM' = 'MESSAGE'
): Promise<void> => {
  if (!text.trim()) return;
  try {
    const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
    const newMsgRef = push(chatRef);
    const now = Date.now();

    await set(newMsgRef, {
      id: newMsgRef.key,
      userId: user.id,
      userName: user.name,
      userPhotoURL: user.photoURL,
      text: text.trim(),
      timestamp: now,
      type,
    });

    // Keep room lastActive fresh (non-fatal if restricted)
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      lastActive: now,
    }).catch(() => {});
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('[GroupStudy] sendRoomMessage notice:', err);
  }
};

// ── Toggle Hand Raise ─────────────────────────────────────────────────────────
export const toggleHandRaise = async (roomId: string, userId: string, handRaised: boolean): Promise<void> => {
  try {
    const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${userId}`);
    await update(memberRef, {
      handRaised,
      lastSeen: Date.now(),
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] toggleHandRaise notice:', err);
  }
};

// ── Update Study Timer (Start, Pause, Reset) ──────────────────────────────────
export const updateRoomTimer = async (
  roomId: string,
  durationMinutes: number,
  isPaused: boolean,
  startTime: number | null,
  remainingSeconds: number
): Promise<void> => {
  try {
    const timerRef = ref(rtdb, `group_study_rooms/${roomId}/timer`);
    const now = Date.now();
    await update(timerRef, {
      durationMinutes,
      isPaused,
      startTime,
      remainingSeconds,
    });
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      lastActive: now,
    }).catch(() => {});
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] updateRoomTimer notice:', err);
  }
};

// ── Update Live Class Settings ────────────────────────────────────────────────
export const updateLiveClass = async (
  roomId: string,
  classData: {
    isActive: boolean;
    title: string;
    classUrl?: string;
    lectureNotes?: string;
    pinnedDoubt?: string;
  }
): Promise<void> => {
  try {
    const liveClassRef = ref(rtdb, `group_study_rooms/${roomId}/liveClass`);
    await update(liveClassRef, {
      ...classData,
    });
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      mode: classData.isActive ? 'LIVE_CLASS' : 'STUDY',
      lastActive: Date.now(),
    }).catch(() => {});
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] updateLiveClass notice:', err);
  }
};

// ── Switch Room Mode ──────────────────────────────────────────────────────────
export const setRoomMode = async (
  roomId: string,
  mode: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS'
): Promise<void> => {
  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      mode,
      lastActive: Date.now(),
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] setRoomMode notice:', err);
  }
};

// ── Launch Live MCQ Battle ────────────────────────────────────────────────────
export const startLiveMcqBattle = async (
  roomId: string,
  quizTitle: string,
  questions: GroupStudyMcqQuestion[],
  durationPerQuestion: number = 20,
  autoAdvance: boolean = true,
  timerMode: 'PER_QUESTION' | 'TOTAL_TEST' | 'MIX' = 'PER_QUESTION',
  totalTestDurationMinutes: number = 15,
  targetPaceSeconds: number = 20,
  vibrateOnPaceAlert: boolean = true
): Promise<void> => {
  const now = Date.now();
  const isSelfPaced = timerMode === 'TOTAL_TEST' || timerMode === 'MIX';
  const effectiveAutoAdvance = isSelfPaced ? false : autoAdvance;
  const testStartTime = now;
  const testEndTime = now + (totalTestDurationMinutes || 15) * 60 * 1000;

  const safeQuestions = (questions || []).map((q, idx) => {
    const rawStmts = (q as any)?.statements ?? (q as any)?.statement ?? (q as any)?.mcqStatements;
    let statements: string[] | undefined = undefined;
    if (Array.isArray(rawStmts) && rawStmts.length > 0) {
      statements = rawStmts.map((s: any) => String(s ?? '').trim()).filter(Boolean);
    } else if (typeof rawStmts === 'string' && rawStmts.trim()) {
      statements = rawStmts.split('\n').map((s: string) => s.trim()).filter(Boolean);
    }

    return {
      question: String(q?.question || `Question ${idx + 1}`).trim(),
      ...(statements && statements.length > 0 ? { statements } : {}),
      options: (Array.isArray(q?.options) ? q.options : ['A', 'B', 'C', 'D'])
        .slice(0, 4)
        .map((opt, oIdx) => String(opt ?? `Option ${oIdx + 1}`).trim()),
      correctIndex: typeof q?.correctIndex === 'number' ? Math.max(0, Math.min(3, q.correctIndex)) : 0,
      explanation: q?.explanation ? String(q.explanation).trim() : '',
      ...(q?.subject ? { subject: q.subject } : {}),
    };
  });

  const liveMcqData: any = {
    isActive: true,
    title: quizTitle,
    currentQuestionIndex: 0,
    totalQuestions: safeQuestions.length,
    questionStartTime: now,
    durationPerQuestion,
    autoAdvance: effectiveAutoAdvance,
    timerMode,
    totalTestDurationMinutes,
    testStartTime,
    testEndTime,
    targetPaceSeconds,
    vibrateOnPaceAlert,
    status: 'QUESTION' as const,
    questions: safeQuestions,
  };

  // 1. Immediately update in local cache so host and observers have zero-latency state
  try {
    const cached = getCachedRooms()[roomId];
    if (cached) {
      cached.mode = 'LIVE_MCQ';
      cached.liveMcq = {
        ...liveMcqData,
        scores: {},
        questionAnswers: {},
      };
      cached.lastActive = now;
      saveCachedRoom(cached);
    }
  } catch (cacheErr) {
    console.warn('[GroupStudy] Local cache error in startLiveMcqBattle:', cacheErr);
  }

  // 2. Sync to Firebase RTDB with cleaned payload (prevents undefined field crashes)
  try {
    const payload = cleanRtdbPayload({
      mode: 'LIVE_MCQ',
      liveMcq: liveMcqData,
      lastActive: now,
    });

    await update(ref(rtdb, `group_study_rooms/${roomId}`), payload);

    // Post system announcement
    const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      id: newMsgRef.key,
      userId: 'system',
      userName: 'IIC Battle Arena',
      text: `🎯 Live MCQ Battle Started: "${quizTitle}" (${safeQuestions.length} Questions, ${durationPerQuestion}s per question)! Get ready!`,
      timestamp: now,
      type: 'SYSTEM',
    });
  } catch (err: any) {
    console.warn('[GroupStudy] RTDB startLiveMcqBattle sync error:', err);
  }
};

// ── Schedule Room with Chosen Questions & Timing Mode ──
export const scheduleRoomWithQuestions = async (
  roomId: string,
  scheduledStartTime: number,
  questions: GroupStudyMcqQuestion[],
  quizTitle: string,
  durationPerQuestion: number = 20,
  autoAdvance: boolean = true,
  timerMode: 'PER_QUESTION' | 'TOTAL_TEST' | 'MIX' = 'PER_QUESTION',
  totalTestDurationMinutes: number = 15,
  targetPaceSeconds: number = 20,
  vibrateOnPaceAlert: boolean = true,
  autoRunWithoutHost: boolean = true
): Promise<void> => {
  const now = Date.now();
  const safeQuestions = questions.map((q) => ({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation || '',
    statements: q.statements || [],
  }));

  const isSelfPaced = timerMode === 'TOTAL_TEST' || timerMode === 'MIX';
  const effectiveAutoAdvance = isSelfPaced ? false : autoAdvance;

  const liveMcqData: any = {
    isActive: false,
    status: 'WAITING',
    title: quizTitle,
    totalQuestions: safeQuestions.length,
    currentQuestionIndex: 0,
    questionStartTime: 0,
    durationPerQuestion,
    autoAdvance: effectiveAutoAdvance,
    timerMode,
    totalTestDurationMinutes,
    targetPaceSeconds,
    vibrateOnPaceAlert,
    questions: safeQuestions,
    scores: {},
    questionAnswers: {},
  };

  try {
    const cached = getCachedRooms()[roomId];
    if (cached) {
      cached.isScheduled = true;
      cached.scheduledStartTime = scheduledStartTime;
      cached.autoRunWithoutHost = autoRunWithoutHost;
      cached.preloadedTitle = quizTitle;
      cached.preloadedQuestions = safeQuestions;
      cached.liveMcq = liveMcqData;
      cached.lastActive = now;
      saveCachedRoom(cached);
    }
  } catch (cacheErr) {
    console.warn('[GroupStudy] Local cache error in scheduleRoomWithQuestions:', cacheErr);
  }

  try {
    const payload = cleanRtdbPayload({
      isScheduled: true,
      scheduledStartTime,
      autoRunWithoutHost,
      preloadedTitle: quizTitle,
      preloadedQuestions: safeQuestions,
      liveMcq: liveMcqData,
      lastActive: now,
    });

    await update(ref(rtdb, `group_study_rooms/${roomId}`), payload);

    const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      id: newMsgRef.key,
      userId: 'system',
      userName: 'IIC Study Bot',
      text: `⏰ Test Scheduled: "${quizTitle}" (${safeQuestions.length} Questions). Start Time: ${new Date(scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Auto-start is ON!`,
      timestamp: now,
      type: 'SYSTEM',
    });
  } catch (err: any) {
    console.warn('[GroupStudy] RTDB scheduleRoomWithQuestions sync error:', err);
  }
};

// ── Update Question Timer Duration During Battle ──
export const setRoomMcqDuration = async (
  roomId: string,
  durationPerQuestion: number
): Promise<void> => {
  try {
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      cached.liveMcq.durationPerQuestion = durationPerQuestion;
      saveCachedRoom(cached);
    }
  } catch {}

  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
      durationPerQuestion,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] setRoomMcqDuration notice:', err);
  }
};

// ── Update Auto Advance Setting ──
export const setRoomMcqAutoAdvance = async (
  roomId: string,
  autoAdvance: boolean
): Promise<void> => {
  try {
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      cached.liveMcq.autoAdvance = autoAdvance;
      saveCachedRoom(cached);
    }
  } catch {}

  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
      autoAdvance,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] setRoomMcqAutoAdvance notice:', err);
  }
};

// ── Advance or Reveal Question in MCQ Battle ──────────────────────────────────
export const revealMcqAnswer = async (roomId: string): Promise<void> => {
  // Update local cached room immediately
  try {
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      cached.liveMcq.status = 'REVEAL';
      saveCachedRoom(cached);
    }
  } catch {}

  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
      status: 'REVEAL',
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] revealMcqAnswer notice:', err);
  }
};

export const advanceMcqQuestion = async (roomId: string, nextIndex: number, isFinished: boolean = false): Promise<void> => {
  const now = Date.now();
  // Update local cached room immediately
  try {
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      if (isFinished) {
        cached.liveMcq.status = 'ENDED';
        cached.liveMcq.isActive = false;
      } else {
        cached.liveMcq.currentQuestionIndex = nextIndex;
        cached.liveMcq.questionStartTime = now;
        cached.liveMcq.status = 'QUESTION';
      }
      saveCachedRoom(cached);
    }
  } catch {}

  try {
    if (isFinished) {
      await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
        status: 'ENDED',
        isActive: false,
      });
    } else {
      await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
        currentQuestionIndex: nextIndex,
        questionStartTime: now,
        status: 'QUESTION',
      });
    }
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] advanceMcqQuestion notice:', err);
  }
};

export const submitMcqAnswer = async (
  roomId: string,
  userId: string,
  userName: string,
  isCorrect: boolean,
  timeTakenSec: number,
  selectedOption: number,
  currentQuestionIndex?: number,
  userPhotoURL?: string
): Promise<McqAnswerOutcome> => {
  let current: any = {
    name: userName,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    totalAnswered: 0,
    currentStreak: 0,
    maxStreak: 0,
    userXp: 0,
    streakBonusXp: 0,
  };

  const userScoreRef = ref(rtdb, `group_study_rooms/${roomId}/liveMcq/scores/${userId}`);
  try {
    const snap = await get(userScoreRef);
    if (snap.exists()) {
      current = snap.val();
    }
  } catch {}

  const oldStreak = current.currentStreak || 0;
  let newCurrentStreak = 0;
  let maxStreak = current.maxStreak || 0;
  let baseXp = 0;
  let streakBonusXp = 0;
  let streakBrokenAt: number | undefined = undefined;

  if (isCorrect) {
    // Sahi jawab pe +5 XP
    baseXp = 5;
    newCurrentStreak = oldStreak + 1;
    maxStreak = Math.max(maxStreak, newCurrentStreak);
  } else {
    // Galat jawab pe -2 XP
    baseXp = -2;
    // Streak toot gaya -> Break par bonus milega (3 pe 10, 5 pe 15, 7 pe 20, 10 pe 20)
    if (oldStreak >= 10) {
      streakBonusXp = 20;
      streakBrokenAt = oldStreak;
    } else if (oldStreak >= 7) {
      streakBonusXp = 20;
      streakBrokenAt = oldStreak;
    } else if (oldStreak >= 5) {
      streakBonusXp = 15;
      streakBrokenAt = oldStreak;
    } else if (oldStreak >= 3) {
      streakBonusXp = 10;
      streakBrokenAt = oldStreak;
    }
    newCurrentStreak = 0;
  }

  const netXpChange = baseXp + streakBonusXp;
  const newUserXp = Math.max(0, (current.userXp || 0) + netXpChange);

  // Speed-based point bonus for room leaderboard:
  const speedBonus = isCorrect ? Math.max(0, Math.round(50 - (timeTakenSec * 2))) : 0;
  const earnedPoints = isCorrect ? (100 + speedBonus) : 0;

  try {
    await update(userScoreRef, {
      name: userName,
      score: (current.score || 0) + earnedPoints,
      correctCount: (current.correctCount || 0) + (isCorrect ? 1 : 0),
      wrongCount: (current.wrongCount || 0) + (isCorrect ? 0 : 1),
      totalAnswered: (current.totalAnswered || 0) + 1,
      currentStreak: newCurrentStreak,
      maxStreak,
      userXp: newUserXp,
      streakBonusXp: (current.streakBonusXp || 0) + streakBonusXp,
      lastAnswerTime: Date.now(),
      selectedOption,
    });

    // Synchronize member live Level & XP in RTDB so all room participants see realtime updates
    try {
      const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${userId}`);
      const memSnap = await get(memberRef);
      if (memSnap.exists()) {
        const memData = memSnap.val() as GroupStudyMember;
        const currentMemberRoomXp = memData.roomXp || 0;
        const newMemberRoomXp = Math.max(0, currentMemberRoomXp + netXpChange);
        const currentMemberTotalXp = memData.xp ?? memData.totalXp ?? 0;
        const newMemberTotalXp = Math.max(0, currentMemberTotalXp + netXpChange);
        const newMemberLevel = getLevelFromScore(newMemberTotalXp);

        await update(memberRef, {
          roomXp: newMemberRoomXp,
          xp: newMemberTotalXp,
          totalXp: newMemberTotalXp,
          level: newMemberLevel,
          lastSeen: Date.now(),
        });
      }

      // Also update total room XP
      if (netXpChange > 0) {
        const roomRef = ref(rtdb, `group_study_rooms/${roomId}`);
        const roomSnap = await get(roomRef);
        if (roomSnap.exists()) {
          const roomVal = roomSnap.val();
          const currentTotalRoomXp = roomVal.totalRoomXp || 0;
          await update(roomRef, {
            totalRoomXp: currentTotalRoomXp + netXpChange,
            lastActive: Date.now(),
          });
        }
      }
    } catch (syncErr) {
      console.warn('[GroupStudy] Member live XP sync notice:', syncErr);
    }
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (!msg.includes('PERMISSION_DENIED') && !msg.includes('Permission denied')) {
      console.warn('[GroupStudy] submitMcqAnswer score update notice:', err);
    }
  }

  // Also record this specific question's answer for live per-question stats & final review
  if (typeof currentQuestionIndex === 'number') {
    try {
      const qAnswerRef = ref(
        rtdb,
        `group_study_rooms/${roomId}/liveMcq/questionAnswers/${currentQuestionIndex}/${userId}`
      );
      await set(qAnswerRef, {
        userId,
        userName,
        userPhotoURL: userPhotoURL || '',
        selectedOption,
        isCorrect,
        timeTakenSec,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (!msg.includes('PERMISSION_DENIED') && !msg.includes('Permission denied')) {
        console.warn('Could not save questionAnswer snapshot:', e);
      }
    }
  }

  return {
    isCorrect,
    baseXp,
    streakBonusXp,
    netXpChange,
    currentStreak: newCurrentStreak,
    maxStreak,
    streakBrokenAt,
    earnedPoints,
  };
};

/**
 * Staggered Batch Submission:
 * Saves the entire quiz score and stats in a SINGLE Firebase write when the test completes.
 * Prevents 10,000+ continuous reads/writes during questions and prevents Firebase quota burnout!
 */
export const submitFinalBatchScore = async (
  roomId: string,
  userId: string,
  userName: string,
  scoreData: {
    score: number;
    correctCount: number;
    wrongCount: number;
    totalAnswered: number;
    maxStreak: number;
    userXp: number;
    streakBonusXp: number;
    userPhotoURL?: string;
    answers?: Record<number, { selectedOption: number; isCorrect: boolean; timeTakenSec: number }>;
  }
): Promise<void> => {
  try {
    const userScoreRef = ref(rtdb, `group_study_rooms/${roomId}/liveMcq/scores/${userId}`);
    await set(userScoreRef, {
      name: userName,
      score: scoreData.score || 0,
      correctCount: scoreData.correctCount || 0,
      wrongCount: scoreData.wrongCount || 0,
      totalAnswered: scoreData.totalAnswered || 0,
      maxStreak: scoreData.maxStreak || 0,
      userXp: scoreData.userXp || 0,
      streakBonusXp: scoreData.streakBonusXp || 0,
      userPhotoURL: scoreData.userPhotoURL || '',
      submittedAt: Date.now(),
    });

    // Also update local cached room
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      if (!cached.liveMcq.scores) cached.liveMcq.scores = {};
      cached.liveMcq.scores[userId] = {
        name: userName,
        score: scoreData.score || 0,
        correctCount: scoreData.correctCount || 0,
        wrongCount: scoreData.wrongCount || 0,
        totalAnswered: scoreData.totalAnswered || 0,
        maxStreak: scoreData.maxStreak || 0,
        userXp: scoreData.userXp || 0,
        streakBonusXp: scoreData.streakBonusXp || 0,
      };
      saveCachedRoom(cached);
    }
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] submitFinalBatchScore notice:', err);
  }
};

/**
 * When the quiz or room ends, if a student has an active unbroken streak of 3+,
 * award their streak bonus upon session conclusion so they don't miss out.
 */
export const awardFinalStreakBonus = async (
  roomId: string,
  userId: string
): Promise<number> => {
  try {
    const userScoreRef = ref(rtdb, `group_study_rooms/${roomId}/liveMcq/scores/${userId}`);
    const snap = await get(userScoreRef);
    if (!snap.exists()) return 0;
    const current = snap.val();
    const streak = current.currentStreak || 0;
    if (streak < 3) return 0;

    let bonus = 0;
    if (streak >= 10) bonus = 20;
    else if (streak >= 7) bonus = 20;
    else if (streak >= 5) bonus = 15;
    else if (streak >= 3) bonus = 10;

    if (bonus > 0) {
      await update(userScoreRef, {
        currentStreak: 0,
        userXp: (current.userXp || 0) + bonus,
        streakBonusXp: (current.streakBonusXp || 0) + bonus,
      });
    }
    return bonus;
  } catch (e) {
    console.warn('awardFinalStreakBonus error:', e);
    return 0;
  }
};

export const endLiveMcqBattle = async (roomId: string): Promise<void> => {
  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      mode: 'LIVE_MCQ',
      'liveMcq/isActive': false,
      'liveMcq/status': 'ENDED',
    });
    const activeRoom = getCachedRooms()[roomId];
    if (activeRoom?.members) {
      void notifyStudyRoomStartInBackground({
        recipientIds: Object.keys(activeRoom.members),
        senderId: auth.currentUser?.uid || activeRoom.hostId,
        senderName: activeRoom.hostName || 'NSTA Student',
        roomName: activeRoom.name || 'Study Room',
        url: `/?open=study-room&room=${encodeURIComponent(roomId)}`,
      });
    }
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] endLiveMcqBattle notice:', err);
  }
};

export const resetLiveMcqToWaiting = async (roomId: string): Promise<void> => {
  try {
    const now = Date.now();
    const cached = getCachedRooms()[roomId];
    if (cached && cached.liveMcq) {
      cached.liveMcq.isActive = false;
      cached.liveMcq.status = 'WAITING';
      cached.liveMcq.scores = {};
      cached.liveMcq.questionAnswers = {};
      cached.lastActive = now;
      saveCachedRoom(cached);
    }

    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      mode: 'LIVE_MCQ',
      'liveMcq/isActive': false,
      'liveMcq/status': 'WAITING',
      'liveMcq/scores': {},
      'liveMcq/questionAnswers': {},
      lastActive: now,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] resetLiveMcqToWaiting notice:', err);
  }
};

export const autoSubmitRoom = async (roomId: string): Promise<void> => {
  const now = Date.now();
  try {
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      isExpired: true,
      lastActive: now,
      mode: 'LIVE_MCQ',
      'liveMcq/isActive': false,
      'liveMcq/status': 'ENDED',
      'timer/remainingSeconds': 0,
    });

    const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      id: newMsgRef.key,
      userId: 'system',
      userName: 'IIC Study Arena',
      text: '⏰ Room time expired! The session has been auto-submitted. Check your final score and XP results below!',
      timestamp: now,
      type: 'SYSTEM',
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) return;
    console.warn('[GroupStudy] autoSubmitRoom notice:', err);
  }
};

export const setRoomMcqType = async (
  roomId: string,
  mcqType: StudyRoomMcqType
): Promise<void> => {
  try {
    const cached = getCachedRooms()[roomId];
    if (cached) {
      cached.mcqType = mcqType;
      cached.lastActive = Date.now();
      saveCachedRoom(cached);
    }
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      mcqType,
      lastActive: Date.now(),
    });
  } catch (err) {
    console.warn('[GroupStudy] setRoomMcqType error:', err);
  }
};

// ── Helper to strip undefined values and empty objects recursively (RTDB throws if any field is undefined or an empty object {}) ──
export const cleanRtdbPayload = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanRtdbPayload).filter((v) => v !== undefined);
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      const cleaned = cleanRtdbPayload(val);
      // Firebase RTDB update() throws fatal error if an empty object {} is present
      if (
        cleaned !== null &&
        typeof cleaned === 'object' &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0
      ) {
        continue;
      }
      result[key] = cleaned;
    }
  }
  return result;
};

// ── Host Live Synchronization Functions ──────────────────────────────────────────
export const syncHostActivity = async (
  roomId: string,
  syncData: Partial<GroupStudyHostSync>
): Promise<void> => {
  try {
    const cleaned = cleanRtdbPayload(syncData);
    const syncRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync`);
    await update(syncRef, {
      ...cleaned,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      // Non-fatal permission boundary on RTDB sync for non-host participants or restricted nodes
      return;
    }
    console.warn('Failed to sync host activity:', err);
  }
};

export const syncHostNotesState = async (
  roomId: string,
  notesData: Partial<NonNullable<GroupStudyHostSync['notesState']>>
): Promise<void> => {
  try {
    const cleaned = cleanRtdbPayload(notesData);
    const notesRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/notesState`);
    await update(notesRef, {
      ...cleaned,
      isOpen: true,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('Failed to sync host notes:', err);
  }
};

export const broadcastHostMcq = async (
  roomId: string,
  mcqData: {
    chapterId?: string;
    chapterTitle?: string;
    questionIndex: number;
    totalQuestions: number;
    questionText: string;
    statements?: string[];
    options: string[];
    correctIndex: number;
    explanation?: string;
    durationSeconds?: number;
  }
): Promise<void> => {
  try {
    const now = Date.now();
    const mcqRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq`);
    await set(mcqRef, cleanRtdbPayload({
      isOpen: true,
      chapterId: mcqData.chapterId || '',
      chapterTitle: mcqData.chapterTitle || '',
      questionIndex: mcqData.questionIndex,
      totalQuestions: mcqData.totalQuestions,
      questionText: mcqData.questionText,
      ...(mcqData.statements && mcqData.statements.length > 0 ? { statements: mcqData.statements } : {}),
      options: mcqData.options,
      correctIndex: mcqData.correctIndex,
      explanation: mcqData.explanation || '',
      status: 'QUESTION',
      startTime: now,
      durationSeconds: mcqData.durationSeconds || 25,
      studentAnswers: {},
    }));
    // Update room lastActive
    await update(ref(rtdb, `group_study_rooms/${roomId}`), {
      lastActive: now,
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('Failed to broadcast host MCQ:', err);
  }
};

export const submitStudentLiveAnswer = async (
  roomId: string,
  student: { id: string; name: string; photoURL?: string },
  selectedOption: number,
  isCorrect: boolean,
  timeTaken: number
): Promise<void> => {
  try {
    const answerRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq/studentAnswers/${student.id}`);
    await set(answerRef, {
      studentName: student.name,
      studentPhoto: student.photoURL || '',
      selectedOption,
      isCorrect,
      timeTaken,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('Failed to submit student live answer:', err);
  }
};

export const revealHostMcqAnswer = async (roomId: string): Promise<void> => {
  try {
    const statusRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq/status`);
    await set(statusRef, 'REVEAL');
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('Failed to reveal MCQ answer:', err);
  }
};

export const closeHostMcq = async (roomId: string): Promise<void> => {
  try {
    const mcqRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq`);
    await update(mcqRef, {
      isOpen: false,
      status: 'ENDED',
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
      return;
    }
    console.warn('Failed to close host MCQ:', err);
  }
};

/**
 * Award XP to a member within a Group Study Room and accumulate in room totals.
 * Implements Room Management XP tracking requested by the user.
 */
export const awardRoomStudyXp = async (
  roomId: string,
  userId: string,
  xpPoints: number,
  studyMinutesIncrement: number = 0
): Promise<{ newMemberXp: number; newTotalRoomXp: number }> => {
  const cached = getCachedRooms()[roomId];
  let newMemberRoomXp = xpPoints;
  let newTotalRoomXp = xpPoints;
  let newMemberTotalXp = xpPoints;
  let newMemberLevel = 1;

  if (cached) {
    cached.totalRoomXp = (cached.totalRoomXp || 0) + xpPoints;
    newTotalRoomXp = cached.totalRoomXp;
    if (cached.members && cached.members[userId]) {
      cached.members[userId].roomXp = (cached.members[userId].roomXp || 0) + xpPoints;
      cached.members[userId].studyMinutes = (cached.members[userId].studyMinutes || 0) + studyMinutesIncrement;
      cached.members[userId].xp = (cached.members[userId].xp ?? cached.members[userId].totalXp ?? 0) + xpPoints;
      cached.members[userId].totalXp = cached.members[userId].xp;
      cached.members[userId].level = getLevelFromScore(cached.members[userId].xp);
      newMemberRoomXp = cached.members[userId].roomXp || 0;
      newMemberTotalXp = cached.members[userId].xp || 0;
      newMemberLevel = cached.members[userId].level || 1;
    }
    saveCachedRoom(cached);
  }

  try {
    const memRef = ref(rtdb, `group_study_rooms/${roomId}/members/${userId}`);
    const memSnap = await get(memRef);
    if (memSnap.exists()) {
      const mem = memSnap.val() as GroupStudyMember;
      newMemberRoomXp = (mem.roomXp || 0) + xpPoints;
      newMemberTotalXp = (mem.xp ?? mem.totalXp ?? 0) + xpPoints;
      newMemberLevel = getLevelFromScore(newMemberTotalXp);
      const newStudyMinutes = (mem.studyMinutes || 0) + studyMinutesIncrement;

      await update(memRef, {
        roomXp: newMemberRoomXp,
        xp: newMemberTotalXp,
        totalXp: newMemberTotalXp,
        level: newMemberLevel,
        studyMinutes: newStudyMinutes,
        lastSeen: Date.now(),
      });
    }

    const roomSnap = await get(ref(rtdb, `group_study_rooms/${roomId}`));
    if (roomSnap.exists()) {
      const room = roomSnap.val();
      newTotalRoomXp = (room.totalRoomXp || 0) + xpPoints;
      await update(ref(rtdb, `group_study_rooms/${roomId}`), {
        totalRoomXp: newTotalRoomXp,
        lastActive: Date.now(),
      });
    }
  } catch (e) {
    console.warn('[GroupStudy] Error syncing room XP:', e);
  }

  return { newMemberXp: newMemberRoomXp, newTotalRoomXp };
};

/**
 * Directly sync a member's live stats (Level, XP, Room XP, study minutes) to RTDB
 */
export const syncMemberLiveStats = async (
  roomId: string,
  userId: string,
  stats: {
    roomXpDelta?: number;
    totalXp?: number;
    level?: number;
    studyMinutesDelta?: number;
  }
): Promise<void> => {
  try {
    const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${userId}`);
    const memSnap = await get(memberRef);
    if (memSnap.exists()) {
      const mem = memSnap.val() as GroupStudyMember;
      const newRoomXp = stats.roomXpDelta !== undefined 
        ? Math.max(0, (mem.roomXp || 0) + stats.roomXpDelta) 
        : (mem.roomXp || 0);
      const newTotalXp = stats.totalXp !== undefined 
        ? stats.totalXp 
        : (stats.roomXpDelta !== undefined ? Math.max(0, (mem.xp ?? mem.totalXp ?? 0) + stats.roomXpDelta) : (mem.xp ?? mem.totalXp ?? 0));
      const newLevel = stats.level !== undefined ? stats.level : getLevelFromScore(newTotalXp);
      const newStudyMins = stats.studyMinutesDelta !== undefined ? (mem.studyMinutes || 0) + stats.studyMinutesDelta : (mem.studyMinutes || 0);

      await update(memberRef, {
        roomXp: newRoomXp,
        xp: newTotalXp,
        totalXp: newTotalXp,
        level: newLevel,
        studyMinutes: newStudyMins,
        lastSeen: Date.now(),
      });
    }
  } catch (e) {
    console.warn('[GroupStudy] Error in syncMemberLiveStats:', e);
  }
};

