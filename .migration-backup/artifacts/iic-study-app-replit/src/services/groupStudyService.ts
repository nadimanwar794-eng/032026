// ─── Group Study & Live Classroom Realtime Service ──────────────────────────────
// Uses Firebase Realtime Database (RTDB) for ₹0 operational cost.
// Reads & writes are streamlined; timer ticks run purely in client memory.
// Presence uses onDisconnect() for automatic zero-cost member cleanup.

import { ref, set, get, update, remove, onValue, onDisconnect, push } from 'firebase/database';
import { rtdb, auth } from '../firebase';

export interface GroupStudyMember {
  id: string;
  name: string;
  photoURL?: string;
  joinedAt: number;
  lastSeen: number;
  isHost: boolean;
  level?: number;
  handRaised?: boolean;
  statusText?: string;
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

export interface GroupStudyRoom {
  id: string;
  name: string;
  subject: string;
  description?: string;
  code: string;
  isPrivate: boolean;
  hostId: string;
  hostName: string;
  hostPhotoURL?: string;
  createdAt: number;
  lastActive: number;
  maxMembers: number;
  mode: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS';
  timer: {
    durationMinutes: number;
    startTime: number | null;
    isPaused: boolean;
    remainingSeconds: number;
  };
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
    questionStartTime: number;
    durationPerQuestion: number;
    status: 'WAITING' | 'QUESTION' | 'REVEAL' | 'ENDED';
    questions: GroupStudyMcqQuestion[];
    scores?: Record<string, {
      name: string;
      score: number;
      correctCount: number;
      totalAnswered: number;
      lastAnswerTime?: number;
      selectedOption?: number;
    }>;
  };
  hostSync?: GroupStudyHostSync;
  members?: Record<string, GroupStudyMember>;
  chat?: Record<string, GroupStudyMessage>;
}

// ── Built-in Quick Battle Question Sets ──────────────────────────────────────────
export const CURATED_MCQ_SETS: Array<{ id: string; name: string; subject: string; emoji: string; questions: GroupStudyMcqQuestion[] }> = [
  {
    id: 'lucent_gk_mixed',
    name: 'Lucent Samanya Gyan (General Knowledge Top 10)',
    subject: 'General Knowledge',
    emoji: '🏆',
    questions: [
      {
        question: 'भारत के संविधान में मूल अधिकार (Fundamental Rights) किस देश से लिए गए हैं?',
        options: ['संयुक्त राज्य अमेरिका (USA)', 'रूस (USSR)', 'ब्रिटेन', 'कनाडा'],
        correctIndex: 0,
        explanation: 'भारतीय संविधान में मौलिक अधिकार संयुक्त राज्य अमेरिका (USA) के संविधान से प्रेरित हैं।'
      },
      {
        question: 'प्रकाश वर्ष (Light Year) किसका मात्रक (Unit) है?',
        options: ['समय', 'दूरी', 'प्रकाश की तीव्रता', 'द्रव्यमान'],
        correctIndex: 1,
        explanation: 'प्रकाश वर्ष खगोलीय दूरी (Astronomical Distance) मापने की इकाई है।'
      },
      {
        question: 'हड़प्पा सभ्यता की खोज किस वर्ष में हुई थी?',
        options: ['1921', '1925', '1935', '1942'],
        correctIndex: 0,
        explanation: 'दयाराम साहनी ने 1921 में हड़प्पा की खोज की थी।'
      },
      {
        question: 'मानव शरीर की सबसे बड़ी ग्रंथि (Largest Gland) कौन सी है?',
        options: ['अग्न्याशय (Pancreas)', 'यकृत (Liver)', 'थायरॉइड', 'पीयूष ग्रंथि'],
        correctIndex: 1,
        explanation: 'यकृत (Liver) मानव शरीर की सबसे बड़ी ग्रंथि है।'
      },
      {
        question: 'गायत्री मंत्र का उल्लेख किस वेद में मिलता है?',
        options: ['सामवेद', 'यजुर्वेद', 'ऋग्वेद', 'अथर्ववेद'],
        correctIndex: 2,
        explanation: 'गायत्री मंत्र ऋग्वेद के तीसरे मंडल में सूर्य देवता (सावित्री) को समर्पित है।'
      },
      {
        question: 'किस गैस को "लाफिंग गैस" (Laughing Gas) कहा जाता है?',
        options: ['नाइट्रोजन डाइऑक्साइड', 'नाइट्रस ऑक्साइड (N2O)', 'सल्फर डाइऑक्साइड', 'कार्बन मोनोऑक्साइड'],
        correctIndex: 1,
        explanation: 'नाइट्रस ऑक्साइड (N2O) को लाफिंग गैस कहा जाता है।'
      },
      {
        question: 'भारतीय राष्ट्रीय कांग्रेस (INC) की स्थापना 1885 में किसके द्वारा की गई थी?',
        options: ['ए. ओ. ह्यूम', 'महात्मा गांधी', 'दादाभाई नौरोजी', 'बाल गंगाधर तिलक'],
        correctIndex: 0,
        explanation: 'ए. ओ. ह्यूम (A. O. Hume) ने 1885 में भारतीय राष्ट्रीय कांग्रेस की स्थापना की थी।'
      },
      {
        question: 'भारत का सबसे बड़ा नेशनल पार्क (National Park) कौन सा है?',
        options: ['जिम कॉर्बेट', 'काजीरंगा', 'हेमिस नेशनल पार्क', 'कान्हा नेशनल पार्क'],
        correctIndex: 2,
        explanation: 'लद्दाख में स्थित हेमिस नेशनल पार्क भारत का सबसे बड़ा राष्ट्रीय उद्यान है।'
      },
      {
        question: 'विटामिन C का रासायनिक नाम (Chemical Name) क्या है?',
        options: ['एस्कॉर्बिक एसिड', 'थायमिन', 'टोकोफेरॉल', 'रेटिनॉल'],
        correctIndex: 0,
        explanation: 'विटामिन C का रासायनिक नाम एस्कॉर्बिक एसिड (Ascorbic Acid) है।'
      },
      {
        question: 'कंप्यूटर का मस्तिष्क (Brain of Computer) किसे कहा जाता है?',
        options: ['RAM', 'CPU', 'Hard Disk', 'Motherboard'],
        correctIndex: 1,
        explanation: 'CPU (Central Processing Unit) को कंप्यूटर का मस्तिष्क कहा जाता है।'
      }
    ]
  },
  {
    id: 'science_rapid',
    name: 'General Science Rapid Fire (सामान्य विज्ञान)',
    subject: 'Science',
    emoji: '⚡',
    questions: [
      {
        question: 'रक्त का pH मान (pH Value of Blood) लगभग कितना होता है?',
        options: ['6.4', '7.4', '8.2', '7.0'],
        correctIndex: 1,
        explanation: 'मानव रक्त का pH मान लगभग 7.4 (हल्का क्षारीय) होता है।'
      },
      {
        question: 'ध्वनि की गति (Speed of Sound) अधिकतम किस माध्यम में होती है?',
        options: ['ठोस (Solid/Steel)', 'पानी (Water)', 'हवा (Air)', 'निर्वात (Vacuum)'],
        correctIndex: 0,
        explanation: 'ध्वनि की गति ठोस (विशेषकर स्टील) में सबसे अधिक होती है और निर्वात में शून्य होती है।'
      },
      {
        question: 'विद्युत धारा (Electric Current) मापने का यंत्र कौन सा है?',
        options: ['वोल्टमीटर', 'एमीटर (Ammeter)', 'गैल्वेनोमीटर', 'ओहममीटर'],
        correctIndex: 1,
        explanation: 'विद्युत धारा को एमीटर (Ammeter) से मापा जाता है।'
      },
      {
        question: 'सौर ऊर्जा को विद्युत ऊर्जा में बदलने वाले उपकरण को क्या कहते हैं?',
        options: ['सोलर सेल (Photovoltaic Cell)', 'ट्रांसफार्मर', 'डायनेमो', 'इन्वर्टर'],
        correctIndex: 0,
        explanation: 'सोलर सेल (Photovoltaic Cell) सूर्य के प्रकाश को सीधे विद्युत में बदलता है।'
      },
      {
        question: 'ओजोन परत (Ozone Layer) वायुमंडल के किस मंडल में पाई जाती है?',
        options: ['क्षोभमंडल (Troposphere)', 'समतापमंडल (Stratosphere)', 'मध्यमंडल (Mesosphere)', 'आयनमंडल'],
        correctIndex: 1,
        explanation: 'ओजोन परत समतापमंडल (Stratosphere) में स्थित है।'
      }
    ]
  },
  {
    id: 'polity_history',
    name: 'Polity & Constitution (भारतीय राजव्यवस्था)',
    subject: 'Polity',
    emoji: '📜',
    questions: [
      {
        question: 'भारतीय संविधान सभा के स्थायी अध्यक्ष कौन थे?',
        options: ['डॉ. राजेंद्र प्रसाद', 'डॉ. बी. आर. अंबेडकर', 'पं. जवाहरलाल नेहरू', 'सच्चिदानंद सिन्हा'],
        correctIndex: 0,
        explanation: '11 दिसंबर 1946 को डॉ. राजेंद्र प्रसाद को स्थायी अध्यक्ष चुना गया था।'
      },
      {
        question: 'संविधान के किस अनुच्छेद के तहत वित्तीय आपातकाल (Financial Emergency) लगाया जाता है?',
        options: ['अनुच्छेद 352', 'अनुच्छेद 356', 'अनुच्छेद 360', 'अनुच्छेद 368'],
        correctIndex: 2,
        explanation: 'अनुच्छेद 360 के तहत राष्ट्रपति वित्तीय आपातकाल की घोषणा कर सकते हैं।'
      },
      {
        question: 'भारत के मुख्य चुनाव आयुक्त की नियुक्ति कौन करता है?',
        options: ['प्रधानमंत्री', 'राष्ट्रपति', 'मुख्य न्यायाधीश', 'लोकसभा अध्यक्ष'],
        correctIndex: 1,
        explanation: 'भारत के राष्ट्रपति मुख्य चुनाव आयुक्त की नियुक्ति करते हैं।'
      },
      {
        question: 'पंचायती राज व्यवस्था सबसे पहले किस राज्य में लागू हुई थी?',
        options: ['राजस्थान (नागौर)', 'आंध्र प्रदेश', 'उत्तर प्रदेश', 'गुजरात'],
        correctIndex: 0,
        explanation: '2 अक्टूबर 1959 को राजस्थान के नागौर जिले में पहली बार पंचायती राज लागू हुआ था।'
      },
      {
        question: 'संविधान की प्रारूप समिति (Drafting Committee) के अध्यक्ष कौन थे?',
        options: ['डॉ. बी. आर. अंबेडकर', 'के. एम. मुंशी', 'बी. एन. राव', 'सरदार पटेल'],
        correctIndex: 0,
        explanation: 'डॉ. भीमराव अंबेडकर प्रारूप समिति के अध्यक्ष थे।'
      }
    ]
  }
];

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

const getCachedRooms = (): Record<string, GroupStudyRoom> => {
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCachedRoom = (room: GroupStudyRoom) => {
  try {
    const map = getCachedRooms();
    map[room.id] = room;
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(map));
  } catch {}
};

// ── Subscribe to All Active Rooms ──────────────────────────────────────────────
export const subscribeToActiveRooms = (callback: (rooms: GroupStudyRoom[]) => void): (() => void) => {
  const roomsRef = ref(rtdb, 'group_study_rooms');
  const unsubscribe = onValue(roomsRef, (snap) => {
    const val = snap.val();
    const localMap = getCachedRooms();
    const map: Record<string, GroupStudyRoom> = { ...localMap, ...(val || {}) };
    const list: GroupStudyRoom[] = Object.values(map);
    // Filter rooms active in the last 12 hours
    const now = Date.now();
    const activeList = list.filter((r) => {
      const isFresh = (now - (r.lastActive || r.createdAt || 0)) < 12 * 3600 * 1000;
      return isFresh;
    }).sort((a, b) => (b.lastActive || b.createdAt) - (a.lastActive || a.createdAt));

    callback(activeList);
  }, (err) => {
    console.warn('RTDB study rooms listen warning, using local cache:', err);
    const localList = Object.values(getCachedRooms());
    callback(localList);
  });

  return () => unsubscribe();
};

// ── Subscribe to a Single Room ────────────────────────────────────────────────
export const subscribeToRoom = (roomId: string, callback: (room: GroupStudyRoom | null) => void): (() => void) => {
  const roomRef = ref(rtdb, `group_study_rooms/${roomId}`);
  const unsubscribe = onValue(roomRef, (snap) => {
    const val = snap.val();
    if (val) {
      saveCachedRoom(val);
      callback(val);
    } else {
      const cached = getCachedRooms()[roomId];
      callback(cached || null);
    }
  }, (err) => {
    console.warn(`RTDB subscribe error for room ${roomId}, using cache:`, err);
    const cached = getCachedRooms()[roomId];
    callback(cached || null);
  });

  return () => unsubscribe();
};

// ── Create a New Group Room ───────────────────────────────────────────────────
export const createGroupRoom = async (
  roomData: {
    name: string;
    subject: string;
    description?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    mode?: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS';
  },
  host: {
    id: string;
    name: string;
    photoURL?: string;
    level?: number;
  }
): Promise<string> => {
  const roomsRef = ref(rtdb, 'group_study_rooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key || `room_${Date.now()}`;
  const now = Date.now();
  const code = generateRoomCode();
  const effectiveHostId = auth.currentUser?.uid || host.id || 'host';

  const hostMember: GroupStudyMember = {
    id: effectiveHostId,
    name: host.name || 'Host',
    photoURL: host.photoURL || '',
    joinedAt: now,
    lastSeen: now,
    isHost: true,
    level: host.level || 1,
    handRaised: false,
    statusText: 'Hosting Room',
  };

  const initialRoom: GroupStudyRoom = {
    id: roomId,
    name: roomData.name.trim() || `${host.name}'s Study Session`,
    subject: roomData.subject || 'General Knowledge',
    description: roomData.description?.trim() || '',
    code,
    isPrivate: !!roomData.isPrivate,
    hostId: effectiveHostId,
    hostName: host.name,
    hostPhotoURL: host.photoURL,
    createdAt: now,
    lastActive: now,
    maxMembers: Math.min(Math.max(roomData.maxMembers || 30, 5), 50),
    mode: roomData.mode || 'STUDY',
    timer: {
      durationMinutes: 25,
      startTime: null,
      isPaused: true,
      remainingSeconds: 25 * 60,
    },
    liveClass: {
      isActive: false,
      title: 'Welcome to Live Class',
      lectureNotes: '📌 Pinned Lecture Notes\n• Topics to cover today:\n1. Core Concepts & Definitions\n2. Key Formulas / Dates\n3. Rapid MCQ Discussion',
      classUrl: '',
    },
    liveMcq: {
      isActive: false,
      title: 'Rapid MCQ Battle',
      currentQuestionIndex: 0,
      totalQuestions: 0,
      questionStartTime: 0,
      durationPerQuestion: 20,
      status: 'WAITING',
      questions: [],
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
        text: `🎉 Room created by ${host.name}! Welcome to the group study session.`,
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

    // Setup onDisconnect for host presence
    try {
      const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${effectiveHostId}`);
      onDisconnect(memberRef).remove();
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
  const newMember: GroupStudyMember = {
    id: effectiveUserId,
    name: user.name,
    photoURL: user.photoURL,
    joinedAt: now,
    lastSeen: now,
    isHost: room.hostId === effectiveUserId,
    level: user.level || 1,
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
    onDisconnect(memberRef).cancel();
    await remove(memberRef);

    // Check if room has 0 members left
    const roomSnap = await get(ref(rtdb, `group_study_rooms/${roomId}`));
    if (roomSnap.exists()) {
      const room: GroupStudyRoom = roomSnap.val();
      const remaining = Object.keys(room.members || {}).length;
      if (remaining === 0) {
        // All members left; delete room to save space
        await remove(ref(rtdb, `group_study_rooms/${roomId}`));
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

// ── Send a Chat Message / Doubt / Reaction ─────────────────────────────────────
export const sendRoomMessage = async (
  roomId: string,
  user: { id: string; name: string; photoURL?: string },
  text: string,
  type: 'MESSAGE' | 'DOUBT' | 'HAND_RAISE' | 'SYSTEM' = 'MESSAGE'
): Promise<void> => {
  if (!text.trim()) return;
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

  // Keep room lastActive fresh
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    lastActive: now,
  });
};

// ── Toggle Hand Raise ─────────────────────────────────────────────────────────
export const toggleHandRaise = async (roomId: string, userId: string, handRaised: boolean): Promise<void> => {
  const memberRef = ref(rtdb, `group_study_rooms/${roomId}/members/${userId}`);
  await update(memberRef, {
    handRaised,
    lastSeen: Date.now(),
  });
};

// ── Update Study Timer (Start, Pause, Reset) ──────────────────────────────────
export const updateRoomTimer = async (
  roomId: string,
  durationMinutes: number,
  isPaused: boolean,
  startTime: number | null,
  remainingSeconds: number
): Promise<void> => {
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
  });
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
  const liveClassRef = ref(rtdb, `group_study_rooms/${roomId}/liveClass`);
  await update(liveClassRef, {
    ...classData,
  });
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mode: classData.isActive ? 'LIVE_CLASS' : 'STUDY',
    lastActive: Date.now(),
  });
};

// ── Switch Room Mode ──────────────────────────────────────────────────────────
export const setRoomMode = async (
  roomId: string,
  mode: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS'
): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mode,
    lastActive: Date.now(),
  });
};

// ── Launch Live MCQ Battle ────────────────────────────────────────────────────
export const startLiveMcqBattle = async (
  roomId: string,
  quizTitle: string,
  questions: GroupStudyMcqQuestion[],
  durationPerQuestion: number = 20
): Promise<void> => {
  const now = Date.now();
  const liveMcqData = {
    isActive: true,
    title: quizTitle,
    currentQuestionIndex: 0,
    totalQuestions: questions.length,
    questionStartTime: now,
    durationPerQuestion,
    status: 'QUESTION' as const,
    questions,
    scores: {},
  };

  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mode: 'LIVE_MCQ',
    liveMcq: liveMcqData,
    lastActive: now,
  });

  // Post system announcement
  const chatRef = ref(rtdb, `group_study_rooms/${roomId}/chat`);
  const newMsgRef = push(chatRef);
  await set(newMsgRef, {
    id: newMsgRef.key,
    userId: 'system',
    userName: 'IIC Battle Arena',
    text: `🎯 Live MCQ Battle Started: "${quizTitle}" (${questions.length} Questions)! Get ready!`,
    timestamp: now,
    type: 'SYSTEM',
  });
};

// ── Advance or Reveal Question in MCQ Battle ──────────────────────────────────
export const revealMcqAnswer = async (roomId: string): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
    status: 'REVEAL',
  });
};

export const advanceMcqQuestion = async (roomId: string, nextIndex: number, isFinished: boolean = false): Promise<void> => {
  const now = Date.now();
  if (isFinished) {
    await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
      status: 'ENDED',
    });
  } else {
    await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
      currentQuestionIndex: nextIndex,
      questionStartTime: now,
      status: 'QUESTION',
    });
  }
};

export const submitMcqAnswer = async (
  roomId: string,
  userId: string,
  userName: string,
  isCorrect: boolean,
  timeTakenSec: number,
  selectedOption: number
): Promise<void> => {
  const userScoreRef = ref(rtdb, `group_study_rooms/${roomId}/liveMcq/scores/${userId}`);
  const snap = await get(userScoreRef);
  const current = snap.val() || {
    name: userName,
    score: 0,
    correctCount: 0,
    totalAnswered: 0,
  };

  // Speed-based point bonus:
  // Base points = 100 for correct
  // Speed bonus up to 50 points (faster = more points)
  const speedBonus = isCorrect ? Math.max(0, Math.round(50 - (timeTakenSec * 2))) : 0;
  const earnedPoints = isCorrect ? (100 + speedBonus) : 0;

  await update(userScoreRef, {
    name: userName,
    score: (current.score || 0) + earnedPoints,
    correctCount: (current.correctCount || 0) + (isCorrect ? 1 : 0),
    totalAnswered: (current.totalAnswered || 0) + 1,
    lastAnswerTime: Date.now(),
    selectedOption,
  });
};

export const endLiveMcqBattle = async (roomId: string): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mode: 'STUDY',
    'liveMcq/isActive': false,
    'liveMcq/status': 'ENDED',
  });
};

// ── Helper to strip undefined values recursively (RTDB throws if any field is undefined) ──
export const cleanRtdbPayload = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanRtdbPayload);
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = cleanRtdbPayload(val);
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
  } catch (err) {
    console.error('Failed to sync host activity:', err);
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
  } catch (err) {
    console.error('Failed to sync host notes:', err);
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
  } catch (err) {
    console.error('Failed to broadcast host MCQ:', err);
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
  } catch (err) {
    console.error('Failed to submit student live answer:', err);
  }
};

export const revealHostMcqAnswer = async (roomId: string): Promise<void> => {
  try {
    const statusRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq/status`);
    await set(statusRef, 'REVEAL');
  } catch (err) {
    console.error('Failed to reveal MCQ answer:', err);
  }
};

export const closeHostMcq = async (roomId: string): Promise<void> => {
  try {
    const mcqRef = ref(rtdb, `group_study_rooms/${roomId}/hostSync/activeMcq`);
    await update(mcqRef, {
      isOpen: false,
      status: 'ENDED',
    });
  } catch (err) {
    console.error('Failed to close host MCQ:', err);
  }
};

