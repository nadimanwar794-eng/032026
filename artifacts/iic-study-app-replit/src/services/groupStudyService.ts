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
    autoAdvance?: boolean;
    autoAdvanceSeconds?: number;
    questionStartTime: number;
    durationPerQuestion: number;
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
// Strictly only real MCQs created or loaded in the app will be displayed (no dummy/hardcoded questions)
export const CURATED_MCQ_SETS: Array<{ id: string; name: string; subject: string; emoji: string; questions: GroupStudyMcqQuestion[] }> = [];

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
  try {
    const map = getCachedRooms();
    map[room.id] = room;
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
          merged[k] = v;
          saveCachedRoom(v);
        } else if (v?.isDeleted) {
          delete merged[k];
          removeCachedRoom(k);
        }
      });
    }

    const list: GroupStudyRoom[] = Object.values(merged).filter(r => !r.isDeleted);
    // Filter rooms active in the last 12 hours
    const now = Date.now();
    const activeList = list.filter((r) => {
      const isFresh = (now - (r.lastActive || r.createdAt || 0)) < 12 * 3600 * 1000;
      return isFresh;
    }).sort((a, b) => (b.lastActive || b.createdAt) - (a.lastActive || a.createdAt));

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
  const unsubscribe = onValue(roomRef, (snap) => {
    const val = snap.val();
    if (val && !val.isDeleted) {
      saveCachedRoom(val);
      callback(val);
    } else if (val?.isDeleted) {
      removeCachedRoom(roomId);
      callback(null);
    } else {
      // RTDB value is null; check local cache before assuming deleted
      const cached = getCachedRooms()[roomId];
      if (cached && !cached.isDeleted) {
        callback(cached);
      } else {
        callback(null);
      }
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
    password: string;
    description?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    mode?: 'STUDY' | 'LIVE_MCQ' | 'LIVE_CLASS';
    mcqType?: StudyRoomMcqType;
    durationMinutes?: number;
  },
  host: {
    id: string;
    name: string;
    photoURL?: string;
    level?: number;
  }
): Promise<string> => {
  const cleanPassword = (roomData.password || '').trim();
  if (!cleanPassword) {
    throw new Error('Room Password is required to create and start a room!');
  }

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

  const durationMinutes = roomData.durationMinutes && roomData.durationMinutes > 0 ? roomData.durationMinutes : 30;
  const expiresAt = now + durationMinutes * 60 * 1000;
  const mcqType = roomData.mcqType || 'PROJECTOR_MODE';

  const initialRoom: GroupStudyRoom = {
    id: roomId,
    name: roomData.name.trim() || `${host.name}'s MCQ Arena`,
    subject: roomData.subject || 'General Knowledge',
    description: roomData.description?.trim() || '',
    code,
    password: cleanPassword,
    isPrivate: !!roomData.isPrivate,
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
      title: `${roomData.subject || 'Lesson'} MCQ Battle`,
      currentQuestionIndex: 0,
      totalQuestions: 0,
      questionStartTime: 0,
      durationPerQuestion: mcqType === 'REVISION_HUB' ? 15 : (mcqType === 'PROJECTOR_MODE' ? 25 : 20),
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
        text: `🎉 Room created by ${host.name}! Mode: ${mcqType === 'REVISION_HUB' ? '⚡ MCQ +' : '🎯 MCQ'}. Room duration: ${durationMinutes} mins.`,
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
        removeCachedRoom(roomId);
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
  durationPerQuestion: number = 20,
  autoAdvance: boolean = true
): Promise<void> => {
  const now = Date.now();
  const liveMcqData = {
    isActive: true,
    title: quizTitle,
    currentQuestionIndex: 0,
    totalQuestions: questions.length,
    questionStartTime: now,
    durationPerQuestion,
    autoAdvance,
    status: 'QUESTION' as const,
    questions,
    scores: {},
    questionAnswers: {},
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
    text: `🎯 Live MCQ Battle Started: "${quizTitle}" (${questions.length} Questions, ${durationPerQuestion}s per question)! Get ready!`,
    timestamp: now,
    type: 'SYSTEM',
  });
};

// ── Update Question Timer Duration During Battle ──
export const setRoomMcqDuration = async (
  roomId: string,
  durationPerQuestion: number
): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
    durationPerQuestion,
  });
};

// ── Update Auto Advance Setting ──
export const setRoomMcqAutoAdvance = async (
  roomId: string,
  autoAdvance: boolean
): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}/liveMcq`), {
    autoAdvance,
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
      isActive: false,
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
  selectedOption: number,
  currentQuestionIndex?: number,
  userPhotoURL?: string
): Promise<McqAnswerOutcome> => {
  const userScoreRef = ref(rtdb, `group_study_rooms/${roomId}/liveMcq/scores/${userId}`);
  const snap = await get(userScoreRef);
  const current = snap.val() || {
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
    // "aur han suno ye strik jab tutegabtab milega xp aysa na ki 3/5/7 sba pe alag alag xp mil raha ho agar 7 strik hai to 3/5wala xp na mikega"
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
    } catch (e) {
      console.warn('Could not save questionAnswer snapshot:', e);
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
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mode: 'LIVE_MCQ',
    'liveMcq/isActive': false,
    'liveMcq/status': 'ENDED',
  });
};

export const autoSubmitRoom = async (roomId: string): Promise<void> => {
  const now = Date.now();
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
};

export const setRoomMcqType = async (
  roomId: string,
  mcqType: StudyRoomMcqType
): Promise<void> => {
  await update(ref(rtdb, `group_study_rooms/${roomId}`), {
    mcqType,
    lastActive: Date.now(),
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

