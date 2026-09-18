// ─── WhatsApp-style Realtime Direct & Group Chat Service ───────────────────────────
import { ref, set, get, update, onValue, push, remove } from 'firebase/database';
import { doc, setDoc, deleteDoc, collection, getDocs, limit, query, onSnapshot, where } from 'firebase/firestore';
import { rtdb, db } from '../firebase';

export interface ChatContact {
  id: string;
  name: string;
  photoURL?: string;
  avatarUrl?: string;
  statusText?: string;
  isOnline?: boolean;
  lastSeen?: number;
  classLevel?: string;
  role?: string;
  subscriptionLevel?: string;
  subscriptionTier?: string;
  isPremium?: boolean;
  uid?: string;
  email?: string;
  displayId?: string;
  mobile?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  senderColor?: string;
  text: string;
  timestamp: number;
  type?: 'TEXT' | 'VOICE' | 'IMAGE' | 'DOUBT' | 'NOTE' | 'SYSTEM';
  mediaUrl?: string;
  mediaUrls?: string[]; // Multiple photos (up to 10 at once)
  voiceDuration?: number; // seconds
  doubtSubject?: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, string>; // userId -> emoji
  deletedFor?: string[]; // userIds for whom message is deleted locally
  isDeletedForEveryone?: boolean; // true if deleted for everyone
  deliveredAt?: number; // timestamp when delivered to recipient
  readAt?: number; // timestamp when read by recipient
  readBy?: Record<string, number>; // userId -> timestamp
  readByRecipient?: boolean; // true if recipient explicitly opened and read this message
  seen?: boolean; // true if recipient has opened and seen the message
  delivered?: boolean; // true if delivered
  disappearingExpiresAt?: number; // epoch ms when message auto-deletes
  isSaved?: boolean; // Snapchat-style "Saved in Chat" (never vanishes until unsaved)
  savedBy?: Record<string, boolean>; // userId -> true
  isHd?: boolean; // High Quality (HD) indicator for crisp notes, formulas & diagrams
}

export interface FriendRequest {
  id: string; // `${fromId}_${toId}`
  fromId: string;
  fromName: string;
  fromPhoto?: string;
  fromRole?: string;
  fromUid?: string;
  fromEmail?: string;
  toId: string;
  toName: string;
  toPhoto?: string;
  toUid?: string;
  toEmail?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  timestamp: number;
  recipientKeys?: string[];
  senderKeys?: string[];
  targetIds?: string[];
}

export interface ChatGroup {
  id: string;
  name: string;
  emoji: string;
  subject: string;
  description: string;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  memberCount: number;
  isPrivate: boolean; // false = Public (Anyone can join), true = Private (Admin approval needed)
  password?: string; // Optional password for private group direct entry
  members: Record<string, { id: string; name: string; role: 'ADMIN' | 'MEMBER'; joinedAt: number; photoURL?: string }>;
  joinRequests?: Record<string, { userId: string; userName: string; userPhoto?: string; requestedAt: number }>;
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageSender?: string;
  isOfficial?: boolean;
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  contact?: ChatContact;
  group?: ChatGroup;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  isPinned?: boolean;
}

// ── Default Seeded Classmates & Groups (Institute Classmates with Online & Offline Statuses) ────────────
export const INSTITUTE_CLASSMATES: ChatContact[] = [
  {
    id: 'student_rohit_v',
    name: 'Rohit Verma',
    classLevel: 'Class 10',
    isOnline: false,
    lastSeen: Date.now() - 45 * 60 * 1000,
    statusText: 'Maths Quadratic Equations solving 📐',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'YEARLY',
  },
  {
    id: 'student_priya_s',
    name: 'Priya Sharma',
    classLevel: 'Class 12',
    isOnline: false,
    lastSeen: Date.now() - 2 * 3600 * 1000,
    statusText: 'Physics Electrostatics practice ⚡',
    role: 'STUDENT',
    subscriptionLevel: 'BASIC',
    subscriptionTier: 'MONTHLY',
  },
  {
    id: 'student_amit_k',
    name: 'Amit Kumar',
    classLevel: 'Class 11',
    isOnline: false,
    lastSeen: Date.now() - 3 * 3600 * 1000,
    statusText: 'Chemistry Organic notes revision 🧪',
    role: 'STUDENT',
    subscriptionLevel: 'BASIC',
    subscriptionTier: 'MONTHLY',
  },
  {
    id: 'student_ananya_s',
    name: 'Ananya Singh',
    classLevel: 'Class 10',
    isOnline: false,
    lastSeen: Date.now() - 5 * 3600 * 1000,
    statusText: 'Biology NCERT line-by-line reading 🌿',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'LIFETIME',
  },
  {
    id: 'student_vikash_p',
    name: 'Vikash Patel',
    classLevel: 'Competition (JEE)',
    isOnline: false,
    lastSeen: Date.now() - 8 * 3600 * 1000,
    statusText: 'JEE Main mock test solving 🎯',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'YEARLY',
  },
  {
    id: 'student_sneha_g',
    name: 'Sneha Gupta',
    classLevel: 'Class 9',
    isOnline: false,
    lastSeen: Date.now() - 12 * 3600 * 1000,
    statusText: 'Class 9 Science cell chapter complete 🔬',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
  {
    id: 'student_rahul_m',
    name: 'Rahul Mehra',
    classLevel: 'Class 10',
    isOnline: false,
    lastSeen: Date.now() - 24 * 3600 * 1000,
    statusText: 'Offline • At tuition batch 📚',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
  {
    id: 'student_aditya_r',
    name: 'Aditya Raj',
    classLevel: 'Class 11',
    isOnline: false,
    lastSeen: Date.now() - 28 * 3600 * 1000,
    statusText: 'Self-study mode on 🔕',
    role: 'STUDENT',
    subscriptionLevel: 'BASIC',
    subscriptionTier: 'MONTHLY',
  },
  {
    id: 'student_pooja_y',
    name: 'Pooja Yadav',
    classLevel: 'Class 12',
    isOnline: false,
    lastSeen: Date.now() - 36 * 3600 * 1000,
    statusText: 'Solving Bihar Board 12th PYQs 📝',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
  {
    id: 'student_manish_t',
    name: 'Manish Tiwari',
    classLevel: 'Class 9',
    isOnline: false,
    lastSeen: Date.now() - 48 * 3600 * 1000,
    statusText: 'Offline • Evening study session 📖',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
  {
    id: 'student_ritu_k',
    name: 'Ritu Kumari',
    classLevel: 'Class 12',
    isOnline: false,
    lastSeen: Date.now() - 14 * 3600 * 1000,
    statusText: 'English & Hindi grammar revision ✍️',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'YEARLY',
  },
  {
    id: 'student_aman_j',
    name: 'Aman Jha',
    classLevel: 'Class 11',
    isOnline: false,
    lastSeen: Date.now() - 24 * 3600 * 1000,
    statusText: 'Maths Trigonometry formulas memorizing',
    role: 'STUDENT',
    subscriptionLevel: 'BASIC',
    subscriptionTier: 'MONTHLY',
  },
  {
    id: 'student_deepak_s',
    name: 'Deepak Soni',
    classLevel: 'Competition (NEET)',
    isOnline: false,
    lastSeen: Date.now() - 36 * 3600 * 1000,
    statusText: 'NEET Biology Human Physiology drills 🧬',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
];

export const SEEDED_CONTACTS: ChatContact[] = INSTITUTE_CLASSMATES;

export const isSeededClassmate = (userId: string): boolean => {
  if (!userId) return false;
  return (
    userId.startsWith('student_') ||
    userId.startsWith('peer_') ||
    INSTITUTE_CLASSMATES.some((c) => isSameUser(c.id, userId))
  );
};

export const SEEDED_GROUPS: ChatGroup[] = [];

// ── Delete-For-Everyone Persistent Registry ─────────────────────────────────
const DELETED_FOR_EVERYONE_KEY = 'nsta_deleted_for_everyone';

export function getDeletedForEveryoneSet(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_FOR_EVERYONE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => {
          if (id) set.add(id);
        });
      }
    }
  } catch {}
  return set;
}

export function addMessageToDeletedForEveryone(msgId: string): void {
  if (!msgId) return;
  try {
    const set = getDeletedForEveryoneSet();
    if (!set.has(msgId)) {
      set.add(msgId);
      const arr = Array.from(set).slice(-2000);
      localStorage.setItem(DELETED_FOR_EVERYONE_KEY, JSON.stringify(arr));
    }
  } catch {}
}

export function isMessageDeletedForEveryone(msgId?: string | null): boolean {
  if (!msgId) return false;
  return getDeletedForEveryoneSet().has(msgId);
}

// Helper to check if a message is deleted for a specific user (Persistent local cache)
export function getDeletedForMeSet(userId: string): Set<string> {
  if (!userId) return new Set();
  const set = new Set<string>();
  try {
    const raw1 = localStorage.getItem(`nsta_deleted_for_me_${userId}`);
    if (raw1) JSON.parse(raw1).forEach((id: string) => set.add(id));
    const cleanId = sanitizeRtdbKey(userId);
    if (cleanId && cleanId !== userId) {
      const raw2 = localStorage.getItem(`nsta_deleted_for_me_${cleanId}`);
      if (raw2) JSON.parse(raw2).forEach((id: string) => set.add(id));
    }
  } catch {}
  return set;
}

export function addMessageToDeletedForMe(userId: string, msgId: string): void {
  if (!userId || !msgId) return;
  try {
    const set = getDeletedForMeSet(userId);
    set.add(msgId);
    const serialized = JSON.stringify(Array.from(set));
    localStorage.setItem(`nsta_deleted_for_me_${userId}`, serialized);
    const cleanId = sanitizeRtdbKey(userId);
    if (cleanId && cleanId !== userId) {
      localStorage.setItem(`nsta_deleted_for_me_${cleanId}`, serialized);
    }
  } catch {}
}

export function isMessageDeletedForUser(userId: string, m: ChatMessage): boolean {
  if (!m || !m.id) return false;
  // If deleted for everyone, it is completely purged and neither sender nor recipient sees it
  if (
    m.isDeletedForEveryone ||
    (m as any).deletedCompletely ||
    m.text === '🚫 This message was deleted' ||
    isMessageDeletedForEveryone(m.id)
  ) {
    return true;
  }
  if (!userId) return false;
  // 1. Check local persistent delete-for-me set
  const localSet = getDeletedForMeSet(userId);
  if (localSet.has(m.id)) return true;

  // 2. Check deletedFor property on message object
  if (m.deletedFor) {
    const cleanUser = sanitizeRtdbKey(userId);
    if (Array.isArray(m.deletedFor)) {
      if (m.deletedFor.includes(userId) || (cleanUser && m.deletedFor.includes(cleanUser))) return true;
    } else if (typeof m.deletedFor === 'object') {
      const df = m.deletedFor as any;
      if (df[userId] || (cleanUser && df[cleanUser])) return true;
    }
  }
  return false;
}

// Helper to sanitize keys/paths for Firebase Realtime Database
export const sanitizeRtdbKey = (s: string): string => {
  return (s || '').replace(/[.#$[\]/]/g, '_');
};

/**
 * Robust user ID comparison across raw IDs, sanitized IDs, numbers, and strings.
 * Ensures the sender is never confused with the recipient.
 */
export const isSameUser = (id1?: string | number | null, id2?: string | number | null): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  const s1 = String(id1).trim().toLowerCase();
  const s2 = String(id2).trim().toLowerCase();
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  return sanitizeRtdbKey(s1) === sanitizeRtdbKey(s2);
};

// Helper to remove any undefined fields before writing to Firebase
export const cleanPayload = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanPayload);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = typeof v === 'object' && v !== null ? cleanPayload(v) : v;
    }
  }
  return out;
};

// Helper to generate consistent conversation ID for two users
export const getDirectConversationId = (uid1: string, uid2: string): string => {
  return [sanitizeRtdbKey(uid1), sanitizeRtdbKey(uid2)].sort().join('_');
};

// Distinct colors for group member name highlights (WhatsApp style)
const NAME_COLORS = [
  '#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#db2777', '#0891b2', '#4f46e5', '#ca8a04', '#0d9488'
];

export const getMemberNameColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % NAME_COLORS.length;
  return NAME_COLORS[index];
};

// ── Send Private 1-on-1 Message ───────────────────────────────────────────────
export const sendPrivateMessage = async (
  myUserId: string,
  myUserName: string,
  myPhoto: string | undefined,
  peerUserId: string,
  text: string,
  type: ChatMessage['type'] = 'TEXT',
  extra?: { mediaUrl?: string; mediaUrls?: string[]; voiceDuration?: number; doubtSubject?: string; replyTo?: any; isHd?: boolean }
): Promise<ChatMessage> => {
  const convId = getDirectConversationId(myUserId, peerUserId);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = Date.now();

  // Freshly sent messages have SENT status, NOT READ!
  // Read/Seen will only happen when recipient opens and views the thread.
  const message: ChatMessage = {
    id: msgId,
    senderId: myUserId,
    senderName: myUserName,
    ...(myPhoto ? { senderPhoto: myPhoto } : {}),
    text: text.trim(),
    timestamp,
    type,
    status: 'SENT',
    seen: false,
    delivered: false,
    readByRecipient: false,
    readAt: undefined,
    ...(extra?.mediaUrl ? { mediaUrl: extra.mediaUrl } : {}),
    ...(extra?.mediaUrls && extra.mediaUrls.length > 0 ? { mediaUrls: extra.mediaUrls } : {}),
    ...(extra?.voiceDuration ? { voiceDuration: extra.voiceDuration } : {}),
    ...(extra?.doubtSubject ? { doubtSubject: extra.doubtSubject } : {}),
    ...(extra?.replyTo ? { replyTo: extra.replyTo } : {}),
    ...(extra?.isHd ? { isHd: true } : {}),
  };

  // 1. Save to local storage IMMEDIATELY so it never gets lost
  saveLocalMessage(`dm_${convId}`, message, myUserId);

  const payload = cleanPayload(message);

  // 2. Try Firebase RTDB
  try {
    const msgRef = ref(rtdb, `chat/whatsapp_direct/${convId}/${msgId}`);
    await set(msgRef, payload);
  } catch (err) {
    console.warn('[WhatsApp] RTDB write error:', err);
  }

  // 3. Firestore Dual-Sync Backup (Permanent record in Cloud Firestore)
  try {
    if (db) {
      const fsDoc = doc(db, 'whatsapp_direct', convId, 'messages', msgId);
      setDoc(fsDoc, payload, { merge: true }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking background sync
  }

  // 4. Automated friendly peer response if chatting with bot or seeded contact
  if (peerUserId.startsWith('peer_')) {
    setTimeout(() => {
      triggerPeerReply(convId, peerUserId, text, myUserName);
    }, 1200);
  }

  return message;
};

// ── Send Group Message ───────────────────────────────────────────────────────
export const sendGroupMessage = async (
  groupId: string,
  myUserId: string,
  myUserName: string,
  myPhoto: string | undefined,
  text: string,
  type: ChatMessage['type'] = 'TEXT',
  extra?: { mediaUrl?: string; mediaUrls?: string[]; voiceDuration?: number; doubtSubject?: string; replyTo?: any; isHd?: boolean }
): Promise<ChatMessage> => {
  const msgId = `grp_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = Date.now();
  const color = getMemberNameColor(myUserName);

  const message: ChatMessage = {
    id: msgId,
    senderId: myUserId,
    senderName: myUserName,
    ...(myPhoto ? { senderPhoto: myPhoto } : {}),
    senderColor: color,
    text: text.trim(),
    timestamp,
    type,
    status: 'SENT',
    seen: false,
    readAt: undefined,
    ...(extra?.mediaUrl ? { mediaUrl: extra.mediaUrl } : {}),
    ...(extra?.mediaUrls && extra.mediaUrls.length > 0 ? { mediaUrls: extra.mediaUrls } : {}),
    ...(extra?.voiceDuration ? { voiceDuration: extra.voiceDuration } : {}),
    ...(extra?.doubtSubject ? { doubtSubject: extra.doubtSubject } : {}),
    ...(extra?.replyTo ? { replyTo: extra.replyTo } : {}),
    ...(extra?.isHd ? { isHd: true } : {}),
  };

  // 1. Local storage save first
  saveLocalMessage(`group_${groupId}`, message, myUserId);

  const payload = cleanPayload(message);

  // 2. Write to RTDB
  try {
    const msgRef = ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`);
    await set(msgRef, payload);

    // Update group meta last message
    const metaRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}`);
    await update(metaRef, {
      lastMessage: `${myUserName.split(' ')[0]}: ${text.slice(0, 40)}`,
      lastMessageTime: timestamp,
      lastMessageSender: myUserName,
    }).catch(() => {});
  } catch (err) {
    console.warn('[WhatsApp] RTDB group write fallback:', err);
  }

  // 3. Firestore Dual-Sync Backup
  try {
    if (db) {
      const fsDoc = doc(db, 'whatsapp_groups', groupId, 'messages', msgId);
      setDoc(fsDoc, payload, { merge: true }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking background sync
  }

  return message;
};

// ── Subscribe to Direct Messages ─────────────────────────────────────────────
export const subscribeToDirectMessages = (
  myUserId: string,
  peerUserId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const convId = getDirectConversationId(myUserId, peerUserId);
  const cacheKey = `dm_${convId}`;

  // Emit local cache immediately for zero loading wait (strictly filtered)
  const initialLocal = getLocalMessages(cacheKey, myUserId);
  if (initialLocal.length > 0) {
    callback(initialLocal);
  } else {
    callback(getStarterPeerMessages(peerUserId));
  }

  // Merging logic that prevents messages from disappearing while strictly filtering out deleted messages
  const mergeAndEmit = (incoming: ChatMessage[]) => {
    const freshLocal = getLocalMessages(cacheKey, myUserId);
    const map = new Map<string, ChatMessage>();

    // 1. Seed with local messages (filtering out deleted for me & deleted for everyone)
    freshLocal.forEach((m) => {
      if (m && m.id && !isMessageDeletedForUser(myUserId, m) && !isMessageDeletedForEveryone(m.id)) {
        map.set(m.id, m);
      }
    });

    // 2. Process incoming messages (strictly dropping messages deleted for me or deleted for everyone)
    incoming.forEach((m) => {
      if (!m || !m.id) return;
      if (
        m.isDeletedForEveryone ||
        (m as any).deletedCompletely ||
        m.text === '🚫 This message was deleted' ||
        isMessageDeletedForEveryone(m.id)
      ) {
        addMessageToDeletedForEveryone(m.id);
        map.delete(m.id);
        return;
      }
      if (isMessageDeletedForUser(myUserId, m)) {
        map.delete(m.id);
        return;
      }
      map.set(m.id, m);
    });

    const combined = Array.from(map.values())
      .filter((m) => !isMessageDeletedForUser(myUserId, m) && !isMessageDeletedForEveryone(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);

    setLocalMessages(cacheKey, combined, myUserId);
    callback(combined);
  };

  // 1. RTDB real-time listener
  const msgRef = ref(rtdb, `chat/whatsapp_direct/${convId}`);
  const unsubRtdb = onValue(
    msgRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: ChatMessage[] = Object.values(val);
        mergeAndEmit(list);
      } else {
        const freshLocal = getLocalMessages(cacheKey, myUserId);
        callback(freshLocal.length > 0 ? freshLocal : getStarterPeerMessages(peerUserId));
      }
    },
    (error) => {
      console.warn('[WhatsApp] RTDB listen error, using local:', error);
      const freshLocal = getLocalMessages(cacheKey, myUserId);
      callback(freshLocal.length > 0 ? freshLocal : getStarterPeerMessages(peerUserId));
    }
  );

  // 1b. Real-time listener for deleted-for-everyone registry in this direct chat
  const deletedRef = ref(rtdb, `chat/whatsapp_direct_deleted/${convId}`);
  const unsubDeleted = onValue(
    deletedRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        let hasNew = false;
        Object.keys(val).forEach((id) => {
          if (!isMessageDeletedForEveryone(id)) {
            addMessageToDeletedForEveryone(id);
            hasNew = true;
          }
        });
        if (hasNew) {
          const freshLocal = getLocalMessages(cacheKey, myUserId);
          callback(freshLocal);
        }
      }
    },
    () => {}
  );

  // 2. Cloud Firestore real-time listener (Ensures permanent sync across devices)
  let unsubFirestore: (() => void) | undefined;
  try {
    if (db) {
      const fsQuery = query(collection(db, 'whatsapp_direct', convId, 'messages'), limit(100));
      unsubFirestore = onSnapshot(
        fsQuery,
        (snap) => {
          if (!snap.empty) {
            const fsList: ChatMessage[] = [];
            snap.forEach((docSnap) => {
              fsList.push(docSnap.data() as ChatMessage);
            });
            mergeAndEmit(fsList);
          }
        },
        (err) => {
          console.warn('[WhatsApp] Firestore direct sync error:', err);
        }
      );
    }
  } catch {}

  return () => {
    unsubRtdb();
    unsubDeleted();
    if (unsubFirestore) unsubFirestore();
  };
};

// ── Subscribe to Group Messages ──────────────────────────────────────────────
export const subscribeToGroupMessages = (
  groupId: string,
  callback: (messages: ChatMessage[]) => void,
  currentUserId?: string
): (() => void) => {
  const cacheKey = `group_${groupId}`;

  const initialLocal = getLocalMessages(cacheKey, currentUserId);
  if (initialLocal.length > 0) {
    callback(initialLocal);
  } else {
    callback(getStarterGroupMessages(groupId));
  }

  const mergeAndEmit = (incoming: ChatMessage[]) => {
    const freshLocal = getLocalMessages(cacheKey, currentUserId);
    const map = new Map<string, ChatMessage>();

    freshLocal.forEach((m) => {
      if (
        m &&
        m.id &&
        (!currentUserId || !isMessageDeletedForUser(currentUserId, m)) &&
        !isMessageDeletedForEveryone(m.id)
      ) {
        map.set(m.id, m);
      }
    });

    incoming.forEach((m) => {
      if (!m || !m.id) return;
      if (
        m.isDeletedForEveryone ||
        (m as any).deletedCompletely ||
        m.text === '🚫 This message was deleted' ||
        isMessageDeletedForEveryone(m.id)
      ) {
        addMessageToDeletedForEveryone(m.id);
        map.delete(m.id);
        return;
      }
      if (currentUserId && isMessageDeletedForUser(currentUserId, m)) {
        map.delete(m.id);
        return;
      }
      map.set(m.id, m);
    });

    const combined = Array.from(map.values())
      .filter((m) => (!currentUserId || !isMessageDeletedForUser(currentUserId, m)) && !isMessageDeletedForEveryone(m.id))
      .sort((a, b) => a.timestamp - b.timestamp);

    setLocalMessages(cacheKey, combined, currentUserId);
    callback(combined);
  };

  const msgRef = ref(rtdb, `chat/whatsapp_groups/${groupId}`);
  const unsubRtdb = onValue(
    msgRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list: ChatMessage[] = Object.values(val);
        mergeAndEmit(list);
      } else {
        const freshLocal = getLocalMessages(cacheKey, currentUserId);
        callback(freshLocal.length > 0 ? freshLocal : getStarterGroupMessages(groupId));
      }
    },
    (error) => {
      console.warn('[WhatsApp] RTDB group listen error, using local:', error);
      const freshLocal = getLocalMessages(cacheKey, currentUserId);
      callback(freshLocal.length > 0 ? freshLocal : getStarterGroupMessages(groupId));
    }
  );

  // Real-time listener for deleted-for-everyone registry in this group
  const deletedRef = ref(rtdb, `chat/whatsapp_group_deleted/${groupId}`);
  const unsubDeleted = onValue(
    deletedRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        let hasNew = false;
        Object.keys(val).forEach((id) => {
          if (!isMessageDeletedForEveryone(id)) {
            addMessageToDeletedForEveryone(id);
            hasNew = true;
          }
        });
        if (hasNew) {
          const freshLocal = getLocalMessages(cacheKey, currentUserId);
          callback(freshLocal);
        }
      }
    },
    () => {}
  );

  let unsubFirestore: (() => void) | undefined;
  try {
    if (db) {
      const fsQuery = query(collection(db, 'whatsapp_groups', groupId, 'messages'), limit(100));
      unsubFirestore = onSnapshot(
        fsQuery,
        (snap) => {
          if (!snap.empty) {
            const fsList: ChatMessage[] = [];
            snap.forEach((docSnap) => {
              fsList.push(docSnap.data() as ChatMessage);
            });
            mergeAndEmit(fsList);
          }
        },
        (err) => {
          console.warn('[WhatsApp] Firestore group sync error:', err);
        }
      );
    }
  } catch {}

  return () => {
    unsubRtdb();
    unsubDeleted();
    if (unsubFirestore) unsubFirestore();
  };
};

// ── Create New Group ─────────────────────────────────────────────────────────
export const createWhatsAppGroup = async (
  creatorId: string,
  creatorName: string,
  groupData: { name: string; emoji: string; subject: string; description: string; isPrivate?: boolean; password?: string }
): Promise<ChatGroup> => {
  const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const isPrivate = !!groupData.isPrivate;
  const password = isPrivate ? (groupData.password?.trim() || '') : '';
  const newGroup: ChatGroup = {
    id: groupId,
    name: groupData.name.trim(),
    emoji: groupData.emoji || '👥',
    subject: groupData.subject || 'General Study',
    description: groupData.description || 'Study & Doubts Group',
    creatorId,
    creatorName,
    createdAt: Date.now(),
    memberCount: 1,
    isPrivate,
    password,
    members: {
      [creatorId]: { id: creatorId, name: creatorName, role: 'ADMIN', joinedAt: Date.now() },
    },
    joinRequests: {},
    lastMessage: isPrivate ? '🔒 Private group ban gaya hai (Password / Admin approval)' : '🌐 Public group create ho gaya hai!',
    lastMessageTime: Date.now(),
    lastMessageSender: creatorName,
  };

  try {
    await set(ref(rtdb, `chat/whatsapp_group_meta/${groupId}`), newGroup);
    // Send system announcement message
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/msg_init`), {
      id: 'msg_init',
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `🎉 ${creatorName} ne "${groupData.name}" (${isPrivate ? '🔒 Private Group' : '🌐 Public Group'}) banaya. Sabhi study members ka swagat hai!`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    });
  } catch (e) {
    console.warn('[Nsta Messenger] Error saving group in RTDB, saving locally:', e);
  }

  // Save to local storage list
  const groups = getLocalGroups();
  groups.unshift(newGroup);
  localStorage.setItem('wa_study_groups', JSON.stringify(groups));

  return newGroup;
};

/**
 * Toggle Group Privacy (Public <-> Private) and set optional password
 */
export const updateGroupPrivacy = async (
  groupId: string,
  isPrivate: boolean,
  password?: string,
  adminName?: string
): Promise<boolean> => {
  const cleanPassword = isPrivate ? (password?.trim() || '') : '';
  try {
    const metaRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}`);
    await update(metaRef, {
      isPrivate,
      password: cleanPassword,
    });
    // System announcement
    const msgId = `priv_${Date.now()}`;
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`), {
      id: msgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `⚙️ Admin ${adminName || 'Admin'} ne group ko ${isPrivate ? '🔒 Private' : '🌐 Public'} kar diya hai.${isPrivate && cleanPassword ? ' (Password set kiya gaya)' : ''}`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    });
  } catch (e) {
    console.warn('[Nsta Messenger] Error updating group privacy in RTDB:', e);
  }

  // Update local storage
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    target.isPrivate = isPrivate;
    target.password = cleanPassword;
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Directly join a private group if the password is correct
 */
export const joinPrivateGroupByPassword = async (
  groupId: string,
  enteredPassword: string,
  user: { id: string; name: string; photoURL?: string }
): Promise<{ success: boolean; error?: string }> => {
  const groups = getLocalGroups();
  let target = groups.find((g) => g.id === groupId);

  try {
    const snap = await get(ref(rtdb, `chat/whatsapp_group_meta/${groupId}`));
    if (snap.exists()) {
      const val = snap.val();
      if (val) target = val;
    }
  } catch (e) {
    console.warn('[Nsta Messenger] Error fetching group meta for password check:', e);
  }

  if (!target) {
    return { success: false, error: 'Group nahi mila' };
  }

  const groupPass = (target.password || '').trim();
  const userPass = (enteredPassword || '').trim();

  if (!groupPass) {
    return {
      success: false,
      error: 'Is group par password set nahi hai. Kripya Admin ko "Request to Join" bhejein.',
    };
  }

  if (groupPass !== userPass) {
    return {
      success: false,
      error: 'Galat password! Sahi password dalein ya Admin ko Request to Join bhejein.',
    };
  }

  // Password matched! Add as member
  await joinPublicGroup(groupId, user);
  // Also remove joinRequest if any
  try {
    await remove(ref(rtdb, `chat/whatsapp_group_meta/${groupId}/joinRequests/${user.id}`));
  } catch {}

  return { success: true };
};

// ── Group Join & Membership Management ───────────────────────────────────────

/**
 * Join a Public Group directly (No approval needed).
 */
export const joinPublicGroup = async (
  groupId: string,
  user: { id: string; name: string; photoURL?: string }
): Promise<boolean> => {
  try {
    // 1. Update RTDB group members
    const memberRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/members/${user.id}`);
    await set(memberRef, {
      id: user.id,
      name: user.name,
      role: 'MEMBER',
      joinedAt: Date.now(),
      photoURL: user.photoURL || '',
    });

    // 2. Post system announcement in group
    const msgId = `join_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`), {
      id: msgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `👋 ${user.name} ne group join kar liya!`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    });
  } catch (e) {
    console.warn('[Nsta Messenger] Error joining public group via RTDB:', e);
  }

  // Update local cache
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    target.members = target.members || {};
    if (!target.members[user.id]) {
      target.members[user.id] = { id: user.id, name: user.name, role: 'MEMBER', joinedAt: Date.now() };
      target.memberCount = Object.keys(target.members).length;
    }
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Request to Join a Private Group (Admin approval needed).
 */
export const requestToJoinPrivateGroup = async (
  groupId: string,
  user: { id: string; name: string; photoURL?: string }
): Promise<boolean> => {
  const reqData = {
    userId: user.id,
    userName: user.name,
    userPhoto: user.photoURL || '',
    requestedAt: Date.now(),
  };

  try {
    const reqRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/joinRequests/${user.id}`);
    await set(reqRef, reqData);
  } catch (e) {
    console.warn('[Nsta Messenger] Error submitting private join request:', e);
  }

  // Local cache update
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    target.joinRequests = target.joinRequests || {};
    target.joinRequests[user.id] = reqData;
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Admin approves a join request for a private group.
 */
export const approveJoinGroupRequest = async (
  groupId: string,
  requestUser: { userId: string; userName: string; userPhoto?: string },
  adminUser: { id: string; name: string }
): Promise<boolean> => {
  try {
    // Add to members
    const memberRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/members/${requestUser.userId}`);
    await set(memberRef, {
      id: requestUser.userId,
      name: requestUser.userName,
      role: 'MEMBER',
      joinedAt: Date.now(),
      photoURL: requestUser.userPhoto || '',
    });

    // Remove from join requests
    const reqRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/joinRequests/${requestUser.userId}`);
    await remove(reqRef);

    // Announce approval
    const msgId = `approved_${Date.now()}`;
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`), {
      id: msgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `✅ Admin ${adminUser.name} ne ${requestUser.userName} ki join request approve ki. Swagat hai!`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    });
  } catch (e) {
    console.warn('[Nsta Messenger] Error approving group request:', e);
  }

  // Local storage sync
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    target.members = target.members || {};
    target.members[requestUser.userId] = {
      id: requestUser.userId,
      name: requestUser.userName,
      role: 'MEMBER',
      joinedAt: Date.now(),
    };
    if (target.joinRequests) {
      delete target.joinRequests[requestUser.userId];
    }
    target.memberCount = Object.keys(target.members).length;
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Admin declines a join request.
 */
export const rejectJoinGroupRequest = async (groupId: string, requestUserId: string): Promise<boolean> => {
  try {
    const reqRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/joinRequests/${requestUserId}`);
    await remove(reqRef);
  } catch (e) {
    console.warn('[Nsta Messenger] Error rejecting group request:', e);
  }

  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target && target.joinRequests) {
    delete target.joinRequests[requestUserId];
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Friend adds another Friend directly to a group!
 * "friend apne friend ko group me daal sakta hai"
 */
export const addFriendToGroup = async (
  groupId: string,
  friendUser: { id: string; name: string; photoURL?: string },
  addedByUser: { id: string; name: string }
): Promise<boolean> => {
  try {
    const memberRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/members/${friendUser.id}`);
    await set(memberRef, {
      id: friendUser.id,
      name: friendUser.name,
      role: 'MEMBER',
      joinedAt: Date.now(),
      photoURL: friendUser.photoURL || '',
    });

    // Group message announcement
    const msgId = `friend_add_${Date.now()}`;
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`), {
      id: msgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `🎉 ${addedByUser.name} ne apne dost ${friendUser.name} ko group me add kiya!`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    });
  } catch (e) {
    console.warn('[Nsta Messenger] Error adding friend to group:', e);
  }

  // Update local storage
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    target.members = target.members || {};
    target.members[friendUser.id] = {
      id: friendUser.id,
      name: friendUser.name,
      role: 'MEMBER',
      joinedAt: Date.now(),
    };
    target.memberCount = Object.keys(target.members).length;
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }
  return true;
};

/**
 * Leave Group: allows user to exit a study group.
 */
export const leaveGroup = async (
  groupId: string,
  user: { id: string; name: string }
): Promise<boolean> => {
  const cleanUid = sanitizeRtdbKey(user.id);

  try {
    // 1. Remove member from RTDB group meta
    const memberRef = ref(rtdb, `chat/whatsapp_group_meta/${groupId}/members/${cleanUid}`);
    await remove(memberRef);

    // Also attempt original id path if different
    if (cleanUid !== user.id) {
      await remove(ref(rtdb, `chat/whatsapp_group_meta/${groupId}/members/${user.id}`)).catch(() => {});
    }

    // 2. Announce exit in group
    const msgId = `left_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const exitMsg: ChatMessage = {
      id: msgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `👋 ${user.name} ne group chhod diya (Left the group).`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      status: 'READ',
    };
    await set(ref(rtdb, `chat/whatsapp_groups/${groupId}/${msgId}`), exitMsg);
    saveLocalMessage(`group_${groupId}`, exitMsg);
  } catch (e) {
    console.warn('[Nsta Messenger] Error leaving group in RTDB:', e);
  }

  // 3. Update local groups
  const groups = getLocalGroups();
  const target = groups.find((g) => g.id === groupId);
  if (target) {
    if (target.members) {
      delete target.members[user.id];
      delete target.members[cleanUid];
      target.memberCount = Math.max(0, Object.keys(target.members).length);
    } else {
      target.memberCount = Math.max(0, (target.memberCount || 1) - 1);
    }
    localStorage.setItem('wa_study_groups', JSON.stringify(groups));
  }

  return true;
};

/**
 * Delete WhatsApp Group: removes group permanently if user is creator/admin
 */
export const deleteWhatsAppGroup = async (
  groupId: string,
  user: { id: string; name: string }
): Promise<boolean> => {
  try {
    // 1. Remove group metadata from RTDB
    await remove(ref(rtdb, `chat/whatsapp_group_meta/${groupId}`)).catch(() => {});
    // 2. Remove group messages from RTDB
    await remove(ref(rtdb, `chat/whatsapp_groups/${groupId}`)).catch(() => {});
  } catch (e) {
    console.warn('[Nsta Messenger] Error deleting group in RTDB:', e);
  }

  // 3. Remove from localStorage
  try {
    const raw = localStorage.getItem('wa_study_groups');
    if (raw) {
      const parsed: ChatGroup[] = JSON.parse(raw);
      const filtered = parsed.filter((g) => g.id !== groupId);
      localStorage.setItem('wa_study_groups', JSON.stringify(filtered));
    }
    // Also remove local messages cache
    localStorage.removeItem(`wa_msgs_group_${groupId}`);
    localStorage.removeItem(`wa_meta_group_${groupId}`);
  } catch {}

  return true;
};

// ── Friend Request & Friend System ───────────────────────────────────────────

/** Format last seen timestamp into WhatsApp-style human readable string */
export const formatLastSeen = (ts?: number | string | Date): string => {
  if (!ts) return 'recently';
  const time = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (isNaN(time) || time <= 0) return 'recently';
  const diffMs = Math.max(0, Date.now() - time);
  if (diffMs < 60 * 1000) return 'just now';
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.floor(diffMs / 60000);
    return `${mins}m ago`;
  }
  const date = new Date(time);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) {
    return `today at ${timeStr}`;
  }
  if (isYesterday) {
    return `yesterday at ${timeStr}`;
  }
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  return `${day} ${month} at ${timeStr}`;
};

/**
 * Update user presence and last seen in Realtime Database and Firestore
 */
export const updateUserPresence = (userId: string, isOnline: boolean) => {
  if (!userId) return;
  const now = Date.now();
  const cleanId = sanitizeRtdbKey(userId);
  try {
    set(ref(rtdb, `chat/presence/${cleanId}`), {
      isOnline,
      lastSeen: now,
      updatedAt: now,
    }).catch(() => {});
  } catch {}
  try {
    if (db) {
      setDoc(
        doc(db, 'users', userId),
        {
          isOnline,
          lastSeen: now,
        },
        { merge: true }
      ).catch(() => {});
    }
  } catch {}
};

/**
 * Real-time subscription to a contact's presence & last seen status
 */
export const subscribeToUserPresence = (
  userId: string,
  callback: (presence: { isOnline: boolean; lastSeen: number }) => void
): (() => void) => {
  if (!userId) return () => {};
  const cleanId = sanitizeRtdbKey(userId);
  try {
    const pRef = ref(rtdb, `chat/presence/${cleanId}`);
    return onValue(
      pRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          callback({
            isOnline: !!val.isOnline,
            lastSeen: val.lastSeen || val.updatedAt || Date.now(),
          });
        }
      },
      () => {}
    );
  } catch {
    return () => {};
  }
};

/**
 * Real-time subscription to all active users' presence from RTDB
 */
export const subscribeToAllPresence = (
  callback: (presenceMap: Record<string, { isOnline: boolean; lastSeen: number }>) => void
): (() => void) => {
  try {
    const pRef = ref(rtdb, 'chat/presence');
    return onValue(
      pRef,
      (snapshot) => {
        const val = snapshot.val();
        const map: Record<string, { isOnline: boolean; lastSeen: number }> = {};
        const now = Date.now();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([k, v]: [string, any]) => {
            if (v && typeof v === 'object') {
              const lastSeen = v.lastSeen || v.updatedAt || 0;
              // User is only online if flag is set AND active within last 2 minutes
              const isFresh = (now - lastSeen) < 2 * 60 * 1000;
              map[k] = {
                isOnline: !!v.isOnline && isFresh,
                lastSeen: lastSeen || now,
              };
            }
          });
        }
        callback(map);
      },
      () => {
        callback({});
      }
    );
  } catch {
    return () => {};
  }
};

/**
 * Fetch registered students from Firestore / RTDB + seeds
 */
export const fetchRegisteredStudents = async (myUserId: string): Promise<ChatContact[]> => {
  const result: ChatContact[] = [];
  const seenIds = new Set<string>();

  // Helper to determine lastSeen timestamp
  const resolveLastSeen = (d: any, uid: string): number => {
    const raw = d.lastSeen || d.lastActiveAt || d.lastSeenAt || d.updatedAt;
    let ts = typeof raw === 'number' ? raw : raw ? new Date(raw).getTime() : 0;
    if (!ts || isNaN(ts)) {
      const hash = Math.abs((uid || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0));
      ts = Date.now() - ((hash % 180) + 12) * 60 * 1000;
    }
    return ts;
  };

  // 1. Try Firestore `users`
  try {
    if (db) {
      const q = query(collection(db, 'users'), limit(200));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        const uid = docSnap.id || d.id || d.uid;
        const isSelf =
          uid === myUserId ||
          d.id === myUserId ||
          d.uid === myUserId ||
          (d.email && d.email === myUserId);
        if (uid && !isSelf && !seenIds.has(uid)) {
          seenIds.add(uid);
          const lastSeenTs = resolveLastSeen(d, uid);
          // Only truly online if recent activity within 2 minutes and not mock
          const isReallyOnline = !uid.startsWith('student_') && !!d.isOnline && (Date.now() - lastSeenTs < 2 * 60 * 1000);
          result.push({
            id: uid,
            name: d.name || d.displayName || 'Student',
            photoURL: d.photoURL || d.avatarUrl || '',
            statusText: d.statusText || d.bio || 'Studying on IIC App 📚',
            isOnline: isReallyOnline,
            lastSeen: lastSeenTs,
            classLevel: d.classLevel || d.role || 'Class 10-12',
            role: d.role || 'STUDENT',
            subscriptionLevel: d.subscriptionLevel || (d.isPremium ? 'BASIC' : 'FREE'),
            subscriptionTier: d.subscriptionTier || 'FREE',
            isPremium: !!d.isPremium,
            uid: d.uid || docSnap.id || '',
            email: d.email || '',
            displayId: d.displayId || '',
            mobile: d.mobile || d.phone || '',
          });
        }
      });
    }
  } catch (e) {
    console.warn('[Nsta Messenger] Error fetching Firestore users:', e);
  }

  // 2. Also try RTDB `users`
  try {
    const snap = await get(ref(rtdb, 'users'));
    const val = snap.val();
    if (val && typeof val === 'object') {
      Object.entries(val).forEach(([uid, d]: [string, any]) => {
        const isSelf =
          uid === myUserId ||
          d?.id === myUserId ||
          d?.uid === myUserId ||
          (d?.email && d?.email === myUserId);
        if (uid && !isSelf && !seenIds.has(uid)) {
          seenIds.add(uid);
          const lastSeenTs = resolveLastSeen(d || {}, uid);
          const isReallyOnline = !uid.startsWith('student_') && !!d?.isOnline && (Date.now() - lastSeenTs < 2 * 60 * 1000);
          result.push({
            id: uid,
            name: d?.name || d?.displayName || 'Student',
            photoURL: d?.photoURL || d?.avatarUrl || '',
            statusText: d?.statusText || 'Available for study chat 💡',
            isOnline: isReallyOnline,
            lastSeen: lastSeenTs,
            classLevel: d?.classLevel || d?.role || 'Student',
            role: d?.role || 'STUDENT',
            subscriptionLevel: d?.subscriptionLevel || (d?.isPremium ? 'BASIC' : 'FREE'),
            subscriptionTier: d?.subscriptionTier || 'FREE',
            isPremium: !!d?.isPremium,
            uid: d?.uid || uid,
            email: d?.email || '',
            displayId: d?.displayId || '',
            mobile: d?.mobile || d?.phone || '',
          });
        }
      });
    }
  } catch {}

  // 3. Always include institute classmates / seeds so the directory is never empty (all default to offline)
  INSTITUTE_CLASSMATES.forEach((c) => {
    const isSelf = isSameUser(c.id, myUserId);
    if (!isSelf && !seenIds.has(c.id)) {
      seenIds.add(c.id);
      result.push({
        ...c,
        isOnline: false,
      });
    }
  });

  return result;
};

/**
 * Send a Friend Request to another student.
 * Uses atomic multi-key updates and dual-sync so requests arrive immediately regardless of which ID variant is used.
 */
export const sendFriendRequest = async (
  fromUser: { id: string; name: string; photoURL?: string; role?: string; uid?: string; email?: string; displayId?: string; mobile?: string },
  toUser: { id: string; name: string; photoURL?: string; uid?: string; email?: string; displayId?: string; mobile?: string }
): Promise<FriendRequest> => {
  const fromId = String(fromUser.id || fromUser.uid || '').trim();
  const toId = String(toUser.id || toUser.uid || '').trim();
  const cleanFrom = sanitizeRtdbKey(fromId);
  const cleanTo = sanitizeRtdbKey(toId);
  const reqId = `${cleanFrom}_${cleanTo}`;

  const recipientKeys = Array.from(
    new Set(
      [toId, cleanTo, toUser.uid, toUser.email, toUser.displayId, toUser.mobile]
        .filter(Boolean)
        .map((k) => sanitizeRtdbKey(String(k).trim()))
        .filter((k) => k.length > 0)
    )
  );
  const senderKeys = Array.from(
    new Set(
      [fromId, cleanFrom, fromUser.uid, fromUser.email, fromUser.displayId, fromUser.mobile]
        .filter(Boolean)
        .map((k) => sanitizeRtdbKey(String(k).trim()))
        .filter((k) => k.length > 0)
    )
  );

  const request: FriendRequest = {
    id: reqId,
    fromId,
    fromName: fromUser.name || 'Student',
    fromPhoto: fromUser.photoURL || '',
    fromRole: fromUser.role || 'STUDENT',
    fromUid: fromUser.uid || '',
    fromEmail: fromUser.email || '',
    toId,
    toName: toUser.name || 'Student',
    toPhoto: toUser.photoURL || '',
    toUid: toUser.uid || '',
    toEmail: toUser.email || '',
    recipientKeys,
    senderKeys,
    targetIds: recipientKeys,
    status: 'PENDING',
    timestamp: Date.now(),
  };

  const payload = cleanPayload(request);

  // 1. Instant local persistence for zero delay and non-flickering UI
  saveLocalSentFriendRequest(fromId, request);
  saveLocalFriendRequest(request);

  // 2. Resilient individual RTDB path writes
  const rtdbWrites: Promise<any>[] = [
    set(ref(rtdb, `chat/friend_requests/${cleanTo}/${cleanFrom}`), payload).catch((err) => {
      console.warn('[Nsta Messenger] RTDB write incoming request notice:', err);
    }),
    set(ref(rtdb, `chat/friend_requests_sent/${cleanFrom}/${cleanTo}`), payload).catch((err) => {
      console.warn('[Nsta Messenger] RTDB write sent request notice:', err);
    }),
  ];

  // Distribute across all sender/recipient aliases
  recipientKeys.forEach((rKey) => {
    senderKeys.forEach((sKey) => {
      if (rKey !== cleanTo || sKey !== cleanFrom) {
        rtdbWrites.push(
          set(ref(rtdb, `chat/friend_requests/${rKey}/${sKey}`), payload).catch(() => {})
        );
        rtdbWrites.push(
          set(ref(rtdb, `chat/friend_requests_sent/${sKey}/${rKey}`), payload).catch(() => {})
        );
      }
    });
  });

  await Promise.allSettled(rtdbWrites);

  // 3. Firestore dual-sync
  try {
    if (db) {
      await Promise.allSettled([
        setDoc(doc(db, 'friend_requests', reqId), payload, { merge: true }),
        setDoc(doc(db, 'users', toId, 'friend_requests_incoming', reqId), payload, { merge: true }),
        setDoc(doc(db, 'users', fromId, 'friend_requests_sent', reqId), payload, { merge: true }),
      ]);
    }
  } catch (fsErr) {
    console.warn('[Nsta Messenger] Firestore friend request write notice:', fsErr);
  }

  // 4. Automated peer acceptance if target is an institute classmate
  if (isSeededClassmate(toId)) {
    setTimeout(async () => {
      try {
        await acceptFriendRequest(
          {
            id: toId,
            name: toUser.name,
            photoURL: toUser.photoURL || '',
            uid: toUser.uid || toId,
            email: toUser.email || '',
            displayId: toUser.displayId || '',
          },
          {
            id: fromId,
            name: fromUser.name,
            photoURL: fromUser.photoURL || '',
            uid: fromUser.uid || fromId,
            email: fromUser.email || '',
            displayId: fromUser.displayId || '',
          }
        );

        const greetingText = `Hi ${fromUser.name}! 👋 Maine aapki friend request accept kar li. Saath me study karte hain aur koi doubt ho to zaroor puchna! 📚✨`;
        await sendPrivateMessage(
          toId,
          toUser.name,
          toUser.photoURL,
          fromId,
          greetingText
        );
      } catch (err) {
        console.warn('[Nsta Messenger] Automated peer acceptance notice:', err);
      }
    }, 1800);
  }

  return request;
};

/**
 * Accept Friend Request: Both users become friends and 1-on-1 chat unlocks instantly!
 * Executes an atomic multi-path update in RTDB so both ends unlock simultaneously.
 */
export const acceptFriendRequest = async (
  myUser: { id: string; name: string; photoURL?: string; uid?: string; email?: string; displayId?: string },
  requester: { id: string; name: string; photoURL?: string; uid?: string; email?: string; displayId?: string }
): Promise<boolean> => {
  const now = Date.now();

  const friendData1 = cleanPayload({
    id: requester.id,
    name: requester.name,
    photoURL: requester.photoURL || '',
    friendedAt: now,
    lastSeen: now,
    isOnline: true,
    uid: requester.uid || '',
    email: requester.email || '',
    displayId: requester.displayId || '',
    statusText: 'Friend 🤝 · Available to chat',
  });
  const friendData2 = cleanPayload({
    id: myUser.id,
    name: myUser.name,
    photoURL: myUser.photoURL || '',
    friendedAt: now,
    lastSeen: now,
    isOnline: true,
    uid: myUser.uid || '',
    email: myUser.email || '',
    displayId: myUser.displayId || '',
    statusText: 'Friend 🤝 · Available to chat',
  });

  const myKeys = Array.from(
    new Set([myUser.id, myUser.uid, myUser.email, myUser.displayId].filter(Boolean).map(sanitizeRtdbKey))
  );
  const reqKeys = Array.from(
    new Set([requester.id, requester.uid, requester.email, requester.displayId].filter(Boolean).map(sanitizeRtdbKey))
  );

  const convId = getDirectConversationId(myUser.id, requester.id);
  const starterMsgId = `friend_init_${convId}`;
  const starterMsg = cleanPayload({
    id: starterMsgId,
    senderId: 'SYSTEM',
    senderName: 'System',
    text: `🤝 Friend request accept ho gayi! Aap dono ab Nsta Messenger par baatein aur doubts share kar sakte hain.`,
    timestamp: now,
    type: 'SYSTEM',
    status: 'READ',
  });

  const acceptedNotificationForSender = cleanPayload({
    friend: friendData2,
    acceptedAt: now,
    acceptedByName: myUser.name,
    requesterId: requester.id,
  });

  // Check if they are already friends locally or in RTDB to avoid re-posting starter messages
  const existingFriends = getLocalFriends(myUser.id);
  const isAlreadyFriend = existingFriends.some((f) => isSameUser(f.id, requester.id));

  // 1. Single atomic multi-path update: Adds friends, clears pending requests, posts starter message, notifies sender
  const updates: Record<string, any> = {};
  myKeys.forEach((mKey) => {
    reqKeys.forEach((rKey) => {
      updates[`chat/friends/${mKey}/${rKey}`] = friendData1;
      updates[`chat/friends/${rKey}/${mKey}`] = friendData2;
      updates[`chat/friend_requests/${mKey}/${rKey}`] = null;
      updates[`chat/friend_requests/${rKey}/${mKey}`] = null;
      updates[`chat/friend_requests_sent/${rKey}/${mKey}`] = null;
      updates[`chat/friend_requests_sent/${mKey}/${rKey}`] = null;
      updates[`chat/friend_accepted/${rKey}/${mKey}`] = acceptedNotificationForSender;
    });
  });
  if (!isAlreadyFriend) {
    updates[`chat/whatsapp_direct/${convId}/${starterMsgId}`] = starterMsg;
  }

  try {
    await update(ref(rtdb), updates);
  } catch (e) {
    console.warn('[Nsta Messenger] RTDB atomic accept friend error, falling back:', e);
    const cleanMy = sanitizeRtdbKey(myUser.id);
    const cleanRequester = sanitizeRtdbKey(requester.id);
    await set(ref(rtdb, `chat/friends/${cleanMy}/${cleanRequester}`), friendData1).catch(() => {});
    await set(ref(rtdb, `chat/friends/${cleanRequester}/${cleanMy}`), friendData2).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests/${cleanMy}/${cleanRequester}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests/${cleanRequester}/${cleanMy}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanRequester}/${cleanMy}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanMy}/${cleanRequester}`)).catch(() => {});
    await set(ref(rtdb, `chat/friend_accepted/${cleanRequester}/${cleanMy}`), acceptedNotificationForSender).catch(() => {});
  }

  // 2. Dual-Sync in Firestore (non-blocking in background)
  try {
    if (db) {
      const reqId1 = `${requester.id}_${myUser.id}`;
      const reqId2 = `${myUser.id}_${requester.id}`;
      Promise.allSettled([
        setDoc(doc(db, 'whatsapp_direct', convId, 'messages', starterMsgId), starterMsg, { merge: true }),
        setDoc(doc(db, 'friend_requests', reqId1), { status: 'ACCEPTED', acceptedAt: now, friend: friendData2 }, { merge: true }),
        setDoc(doc(db, 'friend_requests', reqId2), { status: 'ACCEPTED', acceptedAt: now, friend: friendData1 }, { merge: true }),
        setDoc(doc(db, 'users', requester.id, 'friends', myUser.id), friendData2, { merge: true }),
        setDoc(doc(db, 'users', myUser.id, 'friends', requester.id), friendData1, { merge: true }),
      ]).catch(() => {});
    }
  } catch {}

  // 3. Local storage instant updates
  saveLocalFriend(myUser.id, friendData1);
  saveLocalFriend(requester.id, friendData2);
  removeLocalFriendRequest(`${requester.id}_${myUser.id}`);
  removeLocalFriendRequest(`${myUser.id}_${requester.id}`);
  removeLocalSentFriendRequest(myUser.id, requester.id);
  removeLocalSentFriendRequest(requester.id, myUser.id);

  return true;
};

/**
 * Reject Friend Request.
 */
export const rejectFriendRequest = async (
  myUserId: string,
  requesterId: string,
  extraMyIds?: string[],
  extraReqIds?: string[]
): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanRequester = sanitizeRtdbKey(requesterId);

  removeLocalFriendRequest(`${requesterId}_${myUserId}`);
  removeLocalFriendRequest(`${myUserId}_${requesterId}`);
  removeLocalSentFriendRequest(myUserId, requesterId);
  removeLocalSentFriendRequest(requesterId, myUserId);

  const myKeys = Array.from(new Set([myUserId, cleanMy, ...(extraMyIds || [])].filter(Boolean).map(sanitizeRtdbKey)));
  const reqKeys = Array.from(new Set([requesterId, cleanRequester, ...(extraReqIds || [])].filter(Boolean).map(sanitizeRtdbKey)));

  const rtdbRemovals: Promise<any>[] = [
    remove(ref(rtdb, `chat/friend_requests/${cleanMy}/${cleanRequester}`)).catch(() => {}),
    remove(ref(rtdb, `chat/friend_requests_sent/${cleanRequester}/${cleanMy}`)).catch(() => {}),
  ];

  myKeys.forEach((mKey) => {
    reqKeys.forEach((rKey) => {
      rtdbRemovals.push(remove(ref(rtdb, `chat/friend_requests/${mKey}/${rKey}`)).catch(() => {}));
      rtdbRemovals.push(remove(ref(rtdb, `chat/friend_requests_sent/${rKey}/${mKey}`)).catch(() => {}));
    });
  });

  await Promise.allSettled(rtdbRemovals);

  try {
    if (db) {
      const reqId1 = `${cleanRequester}_${cleanMy}`;
      const reqId2 = `${cleanMy}_${cleanRequester}`;
      deleteDoc(doc(db, 'friend_requests', reqId1)).catch(() => {});
      deleteDoc(doc(db, 'friend_requests', reqId2)).catch(() => {});
      deleteDoc(doc(db, 'users', myUserId, 'friend_requests_incoming', reqId1)).catch(() => {});
      deleteDoc(doc(db, 'users', requesterId, 'friend_requests_sent', reqId1)).catch(() => {});
    }
  } catch {}

  return true;
};

/**
 * Cancel outgoing Friend Request.
 */
export const cancelFriendRequest = async (
  myUserId: string,
  toUserId: string,
  extraMyIds?: string[],
  extraToIds?: string[]
): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanTo = sanitizeRtdbKey(toUserId);
  const reqId = `${cleanMy}_${cleanTo}`;

  removeLocalFriendRequest(`${myUserId}_${toUserId}`);
  removeLocalFriendRequest(reqId);
  removeLocalSentFriendRequest(myUserId, toUserId);
  removeLocalSentFriendRequest(myUserId, reqId);

  const myKeys = Array.from(new Set([myUserId, cleanMy, ...(extraMyIds || [])].filter(Boolean).map(sanitizeRtdbKey)));
  const toKeys = Array.from(new Set([toUserId, cleanTo, ...(extraToIds || [])].filter(Boolean).map(sanitizeRtdbKey)));

  const rtdbRemovals: Promise<any>[] = [
    remove(ref(rtdb, `chat/friend_requests/${cleanTo}/${cleanMy}`)).catch(() => {}),
    remove(ref(rtdb, `chat/friend_requests_sent/${cleanMy}/${cleanTo}`)).catch(() => {}),
  ];

  toKeys.forEach((tKey) => {
    myKeys.forEach((mKey) => {
      rtdbRemovals.push(remove(ref(rtdb, `chat/friend_requests/${tKey}/${mKey}`)).catch(() => {}));
      rtdbRemovals.push(remove(ref(rtdb, `chat/friend_requests_sent/${mKey}/${tKey}`)).catch(() => {}));
    });
  });

  await Promise.allSettled(rtdbRemovals);

  try {
    if (db) {
      deleteDoc(doc(db, 'friend_requests', reqId)).catch(() => {});
      deleteDoc(doc(db, 'users', toUserId, 'friend_requests_incoming', reqId)).catch(() => {});
      deleteDoc(doc(db, 'users', myUserId, 'friend_requests_sent', reqId)).catch(() => {});
    }
  } catch {}

  return true;
};

/**
 * Subscribe to Incoming Friend Requests
 * Listens on all known user identity aliases to guarantee no request is ever missed.
 */
export const subscribeToFriendRequests = (
  myUserId: string,
  callback: (requests: FriendRequest[]) => void,
  extraUserIds?: string[]
): (() => void) => {
  if (!myUserId) return () => {};

  const cleanMy = sanitizeRtdbKey(myUserId);
  const rawTargetIds = [myUserId, cleanMy, ...(extraUserIds || [])];
  const targetIds = Array.from(new Set(rawTargetIds.map(sanitizeRtdbKey).filter(Boolean)));

  const local = getLocalFriendRequests().filter((r) =>
    (r.toId === myUserId || targetIds.includes(sanitizeRtdbKey(r.toId))) && r.status === 'PENDING'
  );
  if (local.length > 0) callback(local);

  // Each source (RTDB targetKey or Firestore) maintains its own list in sourceBuckets
  const sourceBuckets = new Map<string, Map<string, FriendRequest>>();
  const localMap = new Map<string, FriendRequest>();
  local.forEach((req) => {
    if (req && req.id) localMap.set(req.id, req);
  });
  sourceBuckets.set('local', localMap);

  const unsubs: Array<() => void> = [];

  const emit = () => {
    const localFriends = getLocalFriends(myUserId);
    const combinedMap = new Map<string, FriendRequest>();
    sourceBuckets.forEach((bucket) => {
      bucket.forEach((item) => {
        if (item && item.status === 'PENDING') {
          // Drop if sender is already a confirmed friend
          const isAlreadyFriend = localFriends.some(
            (f) => isSameUser(f.id, item.fromId) || isSameUser(f.uid, item.fromId)
          );
          if (isAlreadyFriend) return;

          // Normalize sender key so duplicate requests across aliases collapse cleanly
          const dedupeKey = `${item.fromId || (item as any).fromUid || ''}_${item.toId || ''}`;
          if (!combinedMap.has(dedupeKey)) {
            combinedMap.set(dedupeKey, item);
          }
        }
      });
    });

    const list = Array.from(combinedMap.values());
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  };

  // 1. RTDB listeners for each target key
  targetIds.forEach((targetKey) => {
    try {
      const bucket = new Map<string, FriendRequest>();
      sourceBuckets.set(`rtdb_${targetKey}`, bucket);

      const reqRef = ref(rtdb, `chat/friend_requests/${targetKey}`);
      const unsub = onValue(
        reqRef,
        (snapshot) => {
          // Live remote data received: clear local seed so it doesn't fight remote state
          sourceBuckets.delete('local');
          bucket.clear();
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.values(val).forEach((item: any) => {
              if (item && item.id && (item.status === 'PENDING' || !item.status)) {
                bucket.set(item.id, {
                  ...item,
                  status: 'PENDING',
                });
              }
            });
          }
          emit();
        },
        (err) => {
          console.warn('[Nsta Messenger] Friend requests RTDB listener warning for key', targetKey, err);
        }
      );
      unsubs.push(unsub);
    } catch (e) {
      console.warn('[Nsta Messenger] Failed to attach friend requests listener:', e);
    }
  });

  // 2. Cloud Firestore targeted listener for incoming friend requests
  try {
    if (db) {
      const fsBucket = new Map<string, FriendRequest>();
      sourceBuckets.set('firestore', fsBucket);

      const primaryTargetIds = Array.from(new Set([myUserId, ...(extraUserIds || [])].filter(Boolean))).slice(0, 10);
      primaryTargetIds.forEach((tId) => {
        try {
          const fsQuery = query(collection(db, 'friend_requests'), where('toId', '==', tId));
          const unsubFs = onSnapshot(
            fsQuery,
            (snap) => {
              snap.forEach((docSnap) => {
                const data = docSnap.data() as FriendRequest;
                if (data && data.status === 'PENDING') {
                  fsBucket.set(docSnap.id, { ...data, id: docSnap.id });
                } else if (data && data.status !== 'PENDING') {
                  fsBucket.delete(docSnap.id);
                }
              });
              emit();
            },
            () => {}
          );
          unsubs.push(unsubFs);
        } catch {}
      });
    }
  } catch {}

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

/**
 * Subscribe to Outgoing Sent Friend Requests
 * Uses isolated source buckets so that when an outgoing request is accepted/deleted in RTDB,
 * the sender's client immediately reflects the change without retaining stale entries.
 */
export const subscribeToSentFriendRequests = (
  myUserId: string,
  callback: (requests: FriendRequest[]) => void,
  extraUserIds?: string[]
): (() => void) => {
  if (!myUserId) return () => {};
  const cleanMy = sanitizeRtdbKey(myUserId);
  const rawTargetIds = [myUserId, cleanMy, ...(extraUserIds || [])];
  const targetIds = Array.from(new Set(rawTargetIds.map(sanitizeRtdbKey).filter(Boolean)));

  const sourceBuckets = new Map<string, Map<string, FriendRequest>>();
  const unsubs: Array<() => void> = [];

  // 0. Seed immediately from local cache so UI is instantaneous and never blinks empty
  const localSent = getLocalSentFriendRequests(myUserId);
  const localBucket = new Map<string, FriendRequest>();
  localSent.forEach((r) => {
    if (r && (r.status === 'PENDING' || !r.status)) {
      localBucket.set(r.id, r);
    }
  });
  sourceBuckets.set('local_sent', localBucket);

  const emit = () => {
    const localFriends = getLocalFriends(myUserId);
    const combinedMap = new Map<string, FriendRequest>();
    sourceBuckets.forEach((bucket) => {
      bucket.forEach((item) => {
        // Drop any request if the target student is already a confirmed friend
        const isAlreadyFriend = localFriends.some(
          (f) => isSameUser(f.id, item.toId) || isSameUser(f.uid, item.toId)
        );
        if (isAlreadyFriend) {
          removeLocalSentFriendRequest(myUserId, item.toId);
          return;
        }

        if (!combinedMap.has(item.id)) {
          combinedMap.set(item.id, item);
        }
      });
    });
    const list = Array.from(combinedMap.values());
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  };

  // Immediate emit from local cache
  emit();

  // 1. RTDB sent requests listeners
  targetIds.forEach((targetKey) => {
    try {
      const bucket = new Map<string, FriendRequest>();
      sourceBuckets.set(`rtdb_${targetKey}`, bucket);

      const sentRef = ref(rtdb, `chat/friend_requests_sent/${targetKey}`);
      const unsub = onValue(
        sentRef,
        (snapshot) => {
          // Authoritative remote data arrived: remove temporary local bucket
          sourceBuckets.delete('local_sent');
          bucket.clear();
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.values(val).forEach((item: any) => {
              if (item && item.id && (item.status === 'PENDING' || !item.status)) {
                bucket.set(item.id, item);
              }
            });
          }
          emit();
        },
        () => {
          emit();
        }
      );
      unsubs.push(unsub);
    } catch {}
  });

  // 2. Firestore redundancy for sent friend requests
  try {
    if (db) {
      const fsBucket = new Map<string, FriendRequest>();
      sourceBuckets.set('firestore_sent', fsBucket);
      const primaryTargetIds = Array.from(new Set([myUserId, ...(extraUserIds || [])].filter(Boolean))).slice(0, 10);
      primaryTargetIds.forEach((tId) => {
        try {
          // Direct subcollection listener (no composite index required)
          const unsubSub = onSnapshot(
            collection(db, 'users', tId, 'friend_requests_sent'),
            (snap) => {
              snap.forEach((docSnap) => {
                const data = docSnap.data() as FriendRequest;
                if (data && (data.status === 'PENDING' || !data.status)) {
                  fsBucket.set(docSnap.id, { ...data, id: docSnap.id });
                } else if (data && data.status !== 'PENDING') {
                  fsBucket.delete(docSnap.id);
                }
              });
              emit();
            },
            () => {}
          );
          unsubs.push(unsubSub);

          // Root collection query
          const fsQuery = query(collection(db, 'friend_requests'), where('fromId', '==', tId));
          const unsubFs = onSnapshot(
            fsQuery,
            (snap) => {
              snap.forEach((docSnap) => {
                const data = docSnap.data() as FriendRequest;
                if (data && (data.status === 'PENDING' || !data.status)) {
                  fsBucket.set(docSnap.id, { ...data, id: docSnap.id });
                } else if (data && data.status !== 'PENDING') {
                  fsBucket.delete(docSnap.id);
                }
              });
              emit();
            },
            () => {}
          );
          unsubs.push(unsubFs);
        } catch {}
      });
    }
  } catch {}

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

/**
 * Subscribe to Confirmed Friends
 * Uses isolated source buckets across all alias keys so friends unlock instantly on both sides!
 */
export const subscribeToFriends = (
  myUserId: string,
  callback: (friends: ChatContact[]) => void,
  extraUserIds?: string[]
): (() => void) => {
  if (!myUserId) return () => {};

  const cleanMy = sanitizeRtdbKey(myUserId);
  const rawTargetIds = [myUserId, cleanMy, ...(extraUserIds || [])];
  const targetIds = Array.from(new Set(rawTargetIds.map(sanitizeRtdbKey).filter(Boolean)));

  const sourceBuckets = new Map<string, Map<string, ChatContact>>();
  const local = getLocalFriends(myUserId);
  if (local.length > 0) {
    const localBucket = new Map<string, ChatContact>();
    local.forEach((f) => localBucket.set(f.id, f));
    sourceBuckets.set('local', localBucket);
    callback(local);
  }

  const unsubs: Array<() => void> = [];

  const emit = () => {
    const combinedMap = new Map<string, ChatContact>();
    sourceBuckets.forEach((bucket) => {
      bucket.forEach((friend) => {
        if (!combinedMap.has(friend.id)) {
          combinedMap.set(friend.id, friend);
        }
      });
    });
    const list = Array.from(combinedMap.values());
    callback(list);
    saveAllLocalFriends(myUserId, list);
  };

  targetIds.forEach((targetKey) => {
    try {
      const bucket = new Map<string, ChatContact>();
      sourceBuckets.set(`rtdb_${targetKey}`, bucket);

      const friendsRef = ref(rtdb, `chat/friends/${targetKey}`);
      const unsub = onValue(
        friendsRef,
        (snapshot) => {
          bucket.clear();
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.values(val).forEach((item: any) => {
              if (item && item.id) {
                const now = Date.now();
                const resolvedLastSeen = item.lastSeen || item.lastActiveAt || item.friendedAt || (now - 8 * 60 * 1000);
                bucket.set(item.id, {
                  id: item.id,
                  name: item.name || 'Friend',
                  photoURL: item.photoURL || '',
                  isOnline: item.isOnline !== undefined ? !!item.isOnline : false,
                  lastSeen: resolvedLastSeen,
                  statusText: item.statusText || 'Friend 🤝 · Available to chat',
                  classLevel: item.classLevel || 'Friend',
                  uid: item.uid || '',
                  email: item.email || '',
                });
              }
            });
          }
          emit();
        },
        () => {
          callback(local);
        }
      );
      unsubs.push(unsub);
    } catch {}
  });

  // Dual-source redundancy: Cloud Firestore friends subcollection & accepted friend requests
  try {
    if (db) {
      const fsFriendsBucket = new Map<string, ChatContact>();
      sourceBuckets.set('firestore_friends', fsFriendsBucket);

      const primaryTargetIds = Array.from(new Set([myUserId, ...(extraUserIds || [])].filter(Boolean))).slice(0, 10);
      primaryTargetIds.forEach((tId) => {
        try {
          // 1. Direct friends subcollection: users/{tId}/friends
          const unsubFriendsSub = onSnapshot(
            collection(db, 'users', tId, 'friends'),
            (snap) => {
              snap.forEach((docSnap) => {
                const data = docSnap.data();
                if (data && docSnap.id) {
                  fsFriendsBucket.set(docSnap.id, {
                    id: docSnap.id,
                    name: data.name || 'Friend',
                    photoURL: data.photoURL || '',
                    isOnline: data.isOnline !== undefined ? !!data.isOnline : false,
                    lastSeen: data.lastSeen || Date.now(),
                    statusText: data.statusText || 'Friend 🤝 · Available to chat',
                    classLevel: data.classLevel || 'Friend',
                    uid: data.uid || '',
                    email: data.email || '',
                  });
                }
              });
              emit();
            },
            () => {}
          );
          unsubs.push(unsubFriendsSub);

          // 2. Sent friend requests that have been accepted: friend_requests where fromId == tId and status == 'ACCEPTED'
          const unsubAcceptedReqs = onSnapshot(
            query(collection(db, 'friend_requests'), where('fromId', '==', tId), where('status', '==', 'ACCEPTED')),
            (snap) => {
              snap.forEach((docSnap) => {
                const data = docSnap.data();
                if (data && data.toId) {
                  fsFriendsBucket.set(data.toId, {
                    id: data.toId,
                    name: data.toName || data.friend?.name || 'Friend',
                    photoURL: data.toPhoto || data.friend?.photoURL || '',
                    isOnline: false,
                    lastSeen: data.acceptedAt || Date.now(),
                    statusText: 'Friend 🤝 · Available to chat',
                    classLevel: 'Friend',
                    uid: data.toUid || data.friend?.uid || '',
                    email: data.toEmail || data.friend?.email || '',
                  });
                }
              });
              emit();
            },
            () => {}
          );
          unsubs.push(unsubAcceptedReqs);
        } catch {}
      });
    }
  } catch {}

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

export interface FriendAcceptedEvent {
  friend: ChatContact;
  acceptedAt: number;
  acceptedByName: string;
  requesterId: string;
}

// Global deduplication set across subscriptions to prevent repeat alerts
const globalProcessedAcceptedEvents = new Set<string>();

/**
 * Subscribe to Friend Request Accepted Events in Real-Time!
 * When a recipient accepts a friend request, this immediately fires on the sender's client
 * providing instant notification, sound, and a direct 1-tap "Chat Now" pathway.
 */
export const subscribeToFriendAccepted = (
  myUserId: string,
  onAccepted: (event: FriendAcceptedEvent) => void,
  extraUserIds?: string[]
): (() => void) => {
  if (!myUserId) return () => {};

  const cleanMy = sanitizeRtdbKey(myUserId);
  const rawTargetIds = [myUserId, cleanMy, ...(extraUserIds || [])];
  const targetIds = Array.from(new Set(rawTargetIds.map(sanitizeRtdbKey).filter(Boolean)));

  const unsubs: Array<() => void> = [];
  const processedEvents = new Set<string>();

  targetIds.forEach((targetKey) => {
    try {
      const acceptedRef = ref(rtdb, `chat/friend_accepted/${targetKey}`);
      const unsub = onValue(acceptedRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          Object.entries(val).forEach(([peerKey, item]: [string, any]) => {
            const eventKey = `${targetKey}_${peerKey}_${item?.acceptedAt || ''}`;

            // Clean up from RTDB right away so this notification is not replayed repeatedly
            remove(ref(rtdb, `chat/friend_accepted/${targetKey}/${peerKey}`)).catch(() => {});

            if (globalProcessedAcceptedEvents.has(eventKey) || processedEvents.has(eventKey)) {
              return;
            }
            processedEvents.add(eventKey);
            globalProcessedAcceptedEvents.add(eventKey);

            // Stale check: If acceptedAt is older than 2 minutes, it's an old event from a past session; silently ignore alert
            const ageMs = Date.now() - (item?.acceptedAt || 0);
            if (item?.acceptedAt && ageMs > 2 * 60 * 1000) {
              return;
            }

            if (item && item.friend) {
              onAccepted({
                friend: {
                  id: item.friend.id || peerKey,
                  name: item.friend.name || 'Friend',
                  photoURL: item.friend.photoURL || '',
                  isOnline: true,
                  lastSeen: item.friend.lastSeen || item.acceptedAt || Date.now(),
                  statusText: item.friend.statusText || 'Friend 🤝 · Available to chat',
                  classLevel: item.friend.classLevel || 'Friend',
                  uid: item.friend.uid || '',
                  email: item.friend.email || '',
                },
                acceptedAt: item.acceptedAt || Date.now(),
                acceptedByName: item.acceptedByName || item.friend?.name || 'Friend',
                requesterId: item.requesterId || myUserId,
              });
            }
          });
        }
      });
      unsubs.push(unsub);
    } catch {}
  });

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
};

// Local storage helpers for Friends
export function getLocalSentFriendRequests(userId: string): FriendRequest[] {
  if (!userId) return [];
  const cleanId = sanitizeRtdbKey(userId);
  try {
    const raw = localStorage.getItem(`nsta_sent_requests_${cleanId}`);
    if (raw) return JSON.parse(raw);
    const globalRaw = localStorage.getItem('nsta_sent_requests_global');
    if (globalRaw) {
      const parsed: FriendRequest[] = JSON.parse(globalRaw);
      return parsed.filter((r) => isSameUser(r.fromId, userId));
    }
  } catch {}
  return [];
}

export function saveLocalSentFriendRequest(userId: string, req: FriendRequest) {
  if (!userId || !req) return;
  const cleanId = sanitizeRtdbKey(userId);
  const list = getLocalSentFriendRequests(userId).filter(
    (r) => r.id !== req.id && !isSameUser(r.toId, req.toId)
  );
  list.unshift(req);
  try {
    localStorage.setItem(`nsta_sent_requests_${cleanId}`, JSON.stringify(list));
    localStorage.setItem('nsta_sent_requests_global', JSON.stringify(list));
  } catch {}
}

export function removeLocalSentFriendRequest(userId: string, targetIdOrReqId: string) {
  if (!userId || !targetIdOrReqId) return;
  const cleanId = sanitizeRtdbKey(userId);
  const list = getLocalSentFriendRequests(userId).filter(
    (r) => r.id !== targetIdOrReqId && !isSameUser(r.toId, targetIdOrReqId) && !isSameUser(r.fromId, targetIdOrReqId)
  );
  try {
    localStorage.setItem(`nsta_sent_requests_${cleanId}`, JSON.stringify(list));
    const globalRaw = localStorage.getItem('nsta_sent_requests_global');
    if (globalRaw) {
      const parsed: FriendRequest[] = JSON.parse(globalRaw);
      const filtered = parsed.filter(
        (r) => r.id !== targetIdOrReqId && !isSameUser(r.toId, targetIdOrReqId) && !isSameUser(r.fromId, targetIdOrReqId)
      );
      localStorage.setItem('nsta_sent_requests_global', JSON.stringify(filtered));
    }
  } catch {}
}

export function getLocalFriendRequests(): FriendRequest[] {
  try {
    const raw = localStorage.getItem('nsta_friend_requests');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFriendRequest(req: FriendRequest) {
  const list = getLocalFriendRequests().filter((r) => r.id !== req.id);
  list.unshift(req);
  try {
    localStorage.setItem('nsta_friend_requests', JSON.stringify(list));
  } catch {}
}

export function removeLocalFriendRequest(reqId: string) {
  const list = getLocalFriendRequests().filter((r) => r.id !== reqId);
  try {
    localStorage.setItem('nsta_friend_requests', JSON.stringify(list));
  } catch {}
}

export function getLocalFriends(userId: string): ChatContact[] {
  try {
    const raw = localStorage.getItem(`nsta_friends_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveLocalFriend(userId: string, friend: any) {
  const list = getLocalFriends(userId).filter((f) => f.id !== friend.id);
  list.unshift({
    id: friend.id,
    name: friend.name,
    photoURL: friend.photoURL,
    isOnline: false,
    statusText: 'Friend 🤝 · Available to chat',
    classLevel: 'Friend',
  });
  saveAllLocalFriends(userId, list);
}

export function confirmFriendshipLocally(userId: string, friend: ChatContact | any) {
  if (!userId || !friend?.id) return;
  saveLocalFriend(userId, friend);
  removeLocalSentFriendRequest(userId, friend.id);
  removeLocalFriendRequest(`${friend.id}_${userId}`);
  removeLocalFriendRequest(`${userId}_${friend.id}`);
}

function saveAllLocalFriends(userId: string, friends: ChatContact[]) {
  try {
    localStorage.setItem(`nsta_friends_${userId}`, JSON.stringify(friends));
  } catch {}
}

/**
 * Unfriend a user: removes friendship from RTDB and local storage.
 */
export const unfriendUser = async (myUserId: string, friendId: string): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanFriend = sanitizeRtdbKey(friendId);

  try {
    // 1. Remove from RTDB friends list for both users
    await remove(ref(rtdb, `chat/friends/${cleanMy}/${cleanFriend}`));
    await remove(ref(rtdb, `chat/friends/${cleanFriend}/${cleanMy}`));

    // Also try un-sanitized keys if they were different
    if (cleanMy !== myUserId || cleanFriend !== friendId) {
      await remove(ref(rtdb, `chat/friends/${myUserId}/${friendId}`)).catch(() => {});
      await remove(ref(rtdb, `chat/friends/${friendId}/${myUserId}`)).catch(() => {});
    }

    // 2. Remove any pending/sent requests
    await remove(ref(rtdb, `chat/friend_requests/${cleanMy}/${cleanFriend}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests/${cleanFriend}/${cleanMy}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanMy}/${cleanFriend}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanFriend}/${cleanMy}`)).catch(() => {});
  } catch (e) {
    console.warn('[Nsta Messenger] Error unfriending user in RTDB:', e);
  }

  // 3. Remove from local storage
  const list = getLocalFriends(myUserId).filter((f) => f.id !== friendId);
  saveAllLocalFriends(myUserId, list);

  // Also remove from peer's local list if in current browser
  const peerList = getLocalFriends(friendId).filter((f) => f.id !== myUserId);
  saveAllLocalFriends(friendId, peerList);

  removeLocalFriendRequest(`${friendId}_${myUserId}`);
  removeLocalFriendRequest(`${myUserId}_${friendId}`);

  return true;
};

/**
 * Block a user: blocks messaging and unfriends them.
 */
export const blockUser = async (
  myUserId: string,
  targetUser: { id: string; name: string }
): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanTarget = sanitizeRtdbKey(targetUser.id);

  const blockData = {
    id: targetUser.id,
    name: targetUser.name,
    blockedAt: Date.now(),
  };

  try {
    await set(ref(rtdb, `chat/blocked_users/${cleanMy}/${cleanTarget}`), blockData);
  } catch (e) {
    console.warn('[Nsta Messenger] Error saving block to RTDB:', e);
  }

  // Save to local storage
  const currentBlocked = getLocalBlockedUsers(myUserId);
  if (!currentBlocked.some((b) => b.id === targetUser.id)) {
    currentBlocked.push(blockData);
    try {
      localStorage.setItem(`nsta_blocked_${myUserId}`, JSON.stringify(currentBlocked));
    } catch {}
  }

  // Automatically unfriend upon blocking
  await unfriendUser(myUserId, targetUser.id);

  return true;
};

/**
 * Unblock a user.
 */
export const unblockUser = async (myUserId: string, targetUserId: string): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanTarget = sanitizeRtdbKey(targetUserId);

  try {
    await remove(ref(rtdb, `chat/blocked_users/${cleanMy}/${cleanTarget}`));
    if (cleanMy !== myUserId || cleanTarget !== targetUserId) {
      await remove(ref(rtdb, `chat/blocked_users/${myUserId}/${targetUserId}`)).catch(() => {});
    }
  } catch (e) {
    console.warn('[Nsta Messenger] Error unblocking in RTDB:', e);
  }

  const currentBlocked = getLocalBlockedUsers(myUserId).filter((b) => b.id !== targetUserId);
  try {
    localStorage.setItem(`nsta_blocked_${myUserId}`, JSON.stringify(currentBlocked));
  } catch {}

  return true;
};

export function getLocalBlockedUsers(myUserId: string): { id: string; name: string; blockedAt: number }[] {
  try {
    const raw = localStorage.getItem(`nsta_blocked_${myUserId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Subscribe to Blocked Users list.
 */
export const subscribeToBlockedUsers = (
  myUserId: string,
  callback: (blocked: { id: string; name: string; blockedAt: number }[]) => void
): (() => void) => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const local = getLocalBlockedUsers(myUserId);
  callback(local);

  const blockRef = ref(rtdb, `chat/blocked_users/${cleanMy}`);
  const unsub = onValue(
    blockRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.values(val) as { id: string; name: string; blockedAt: number }[];
        try {
          localStorage.setItem(`nsta_blocked_${myUserId}`, JSON.stringify(list));
        } catch {}
        callback(list);
      } else {
        callback(local.length > 0 ? local : []);
      }
    },
    () => {
      callback(local);
    }
  );

  return unsub;
};

/**
 * Clear Chat History locally
 */
export const clearChatHistory = (contextId: string, isGroup: boolean) => {
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  try {
    localStorage.setItem(`wa_msgs_${cacheKey}`, JSON.stringify([]));
  } catch {}
};

// ── React to Message (WhatsApp Emoji Reaction) ────────────────────────────────
export const reactToChatMessage = async (
  isGroup: boolean,
  contextId: string, // convId or groupId
  msgId: string,
  userId: string,
  emoji: string
) => {
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);
  const target = localList.find((m) => m.id === msgId);
  const currentReaction = target?.reactions?.[userId];
  const nextEmoji = currentReaction === emoji ? null : emoji;

  // Optimistic update in local cache
  const updated = localList.map((m) => {
    if (m.id === msgId) {
      const reactions = { ...(m.reactions || {}) };
      if (nextEmoji) {
        reactions[userId] = nextEmoji;
      } else {
        delete reactions[userId];
      }
      return { ...m, reactions };
    }
    return m;
  });
  setLocalMessages(cacheKey, updated);

  const path = isGroup
    ? `chat/whatsapp_groups/${contextId}/${msgId}/reactions/${userId}`
    : `chat/whatsapp_direct/${contextId}/${msgId}/reactions/${userId}`;

  try {
    if (nextEmoji) {
      await set(ref(rtdb, path), nextEmoji);
    } else {
      await remove(ref(rtdb, path));
    }
  } catch (e) {
    console.warn('[WhatsApp] Reaction error:', e);
  }
};

// ── Local Storage Helpers ────────────────────────────────────────────────────
function getLocalMessages(key: string, currentUserId?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`wa_msgs_${key}`);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    return list.filter((m) => {
      if (!m || !m.id) return false;
      if (
        m.isDeletedForEveryone ||
        (m as any).deletedCompletely ||
        m.text === '🚫 This message was deleted' ||
        isMessageDeletedForEveryone(m.id)
      ) {
        return false;
      }
      if (currentUserId && isMessageDeletedForUser(currentUserId, m)) {
        return false;
      }
      return true;
    });
  } catch {
    return [];
  }
}

function setLocalMessages(key: string, msgs: ChatMessage[], currentUserId?: string) {
  try {
    const filtered = msgs.filter((m) => {
      if (!m || !m.id) return false;
      if (
        m.isDeletedForEveryone ||
        (m as any).deletedCompletely ||
        m.text === '🚫 This message was deleted' ||
        isMessageDeletedForEveryone(m.id)
      ) {
        return false;
      }
      if (currentUserId && isMessageDeletedForUser(currentUserId, m)) {
        return false;
      }
      return true;
    });
    localStorage.setItem(`wa_msgs_${key}`, JSON.stringify(filtered.slice(-100)));
  } catch {}
}

function saveLocalMessage(key: string, msg: ChatMessage, currentUserId?: string) {
  if (
    !msg ||
    !msg.id ||
    msg.isDeletedForEveryone ||
    (msg as any).deletedCompletely ||
    msg.text === '🚫 This message was deleted' ||
    isMessageDeletedForEveryone(msg.id)
  ) {
    return;
  }
  const list = getLocalMessages(key, currentUserId);
  if (!currentUserId || !isMessageDeletedForUser(currentUserId, msg)) {
    list.push(msg);
  }
  setLocalMessages(key, list, currentUserId);
}

export function getLocalGroups(): ChatGroup[] {
  try {
    const raw = localStorage.getItem('wa_study_groups');
    if (raw) {
      const parsed: ChatGroup[] = JSON.parse(raw);
      // Strip any legacy demo group IDs
      const cleaned = parsed.filter(
        (g) =>
          g.id !== 'group_board_warriors' &&
          g.id !== 'group_maths_doubts' &&
          g.id !== 'group_lucent_gk'
      );
      return cleaned;
    }
  } catch {}
  return [];
}

// ── Starter Peer Messages (No fake demo messages) ───────────────
function getStarterPeerMessages(_peerId: string): ChatMessage[] {
  return [];
}

function getStarterGroupMessages(_groupId: string): ChatMessage[] {
  return [];
}

// ── Automated Study Peer / Bot Response Generator ────────────────────────────
function triggerPeerReply(convId: string, peerId: string, userText: string, studentName: string) {
  const peer = SEEDED_CONTACTS.find((c) => c.id === peerId);
  const peerName = peer?.name || 'Study Partner';
  let replyText = `Bahut badhiya ${studentName}! Is question ko maine note kar liya hai. Main revision karke detail solution bhejta hoon 👍`;

  const lower = userText.toLowerCase();
  if (peerId === 'peer_iic_ai_tutor') {
    if (lower.includes('formula') || lower.includes('math') || lower.includes('science')) {
      replyText = `💡 **Concept Guide**: "${userText}" par sabse zaroori formula hai: a_n = a + (n-1)d (AP) aur Quadratic formula: x = (-b ± √(b²-4ac))/(2a). Kya iska detailed step dekhna chahte hain?`;
    } else if (lower.includes('gk') || lower.includes('lucent') || lower.includes('history')) {
      replyText = `📚 **GK Quick Fact**: Samvidhan Sabha ki pehli baithak 9 December 1946 ko hui thi aur Dr. Sachchidananda Sinha asthayi adhyaksh the. Is topic ke 10 MCQs app me available hain!`;
    } else {
      replyText = `Haan bilkul ${studentName}! "${userText}" samajh gaya. Aap apne syllabus ka chapter open karke revision test de sakte hain ya group study room me live battle khel sakte hain! 🚀`;
    }
  } else if (lower.includes('notes') || lower.includes('pdf')) {
    replyText = `Haan bilkul! Notes section me summary check karo, maine PDF points highlight kar diye hain.`;
  } else if (lower.includes('test') || lower.includes('quiz') || lower.includes('mcq')) {
    replyText = `Chalo shaam ko live MCQ battle room me match lagate hain! Tum room create karo code share karna 🔥`;
  } else if (lower.includes('kaisa') || lower.includes('kaise') || lower.includes('hi') || lower.includes('hello')) {
    replyText = `Hello ${studentName}! Main theek hoon, abhi mock test solve kar raha tha. Tumhari preparation kaisi chal rahi hai?`;
  }

  const replyMsg: ChatMessage = {
    id: `reply_${Date.now()}`,
    senderId: peerId,
    senderName: peerName,
    text: replyText,
    timestamp: Date.now(),
    type: 'TEXT',
    status: 'READ',
  };

  try {
    set(ref(rtdb, `chat/whatsapp_direct/${convId}/${replyMsg.id}`), replyMsg);
  } catch {}
  saveLocalMessage(`dm_${convId}`, replyMsg);
}

// ── Delete Message: For Me vs For Everyone ──────────────────────────────────
export const deleteChatMessage = async (
  isGroup: boolean,
  contextId: string, // convId or groupId
  msgId: string,
  userId: string,
  mode: 'FOR_ME' | 'FOR_EVERYONE',
  allUserAliases?: string[]
) => {
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);

  // Security authorization: A user can ONLY delete for everyone if they sent the message (or group creator / alias match)
  let effectiveMode = mode;
  if (mode === 'FOR_EVERYONE') {
    const targetMsg = localList.find((m) => m.id === msgId);
    if (targetMsg) {
      const isSender =
        isSameUser(targetMsg.senderId, userId) ||
        (allUserAliases && allUserAliases.some((alias) => isSameUser(targetMsg.senderId, alias)));
      if (!isSender && !isGroup) {
        console.warn(
          `[WhatsApp Security] User ${userId} is not the sender of message ${msgId}. Forcing FOR_ME.`
        );
        effectiveMode = 'FOR_ME';
      }
    }
  }

  if (effectiveMode === 'FOR_ME') {
    // 1. Permanently register in persistent deleted-for-me cache across all aliases
    addMessageToDeletedForMe(userId, msgId);
    if (allUserAliases && allUserAliases.length > 0) {
      allUserAliases.forEach((alias) => addMessageToDeletedForMe(alias, msgId));
    }

    // 2. Delete for me: remove immediately from local cache
    const updated = localList.filter((m) => m.id !== msgId);
    setLocalMessages(cacheKey, updated, userId);

    // 3. Sync deletedFor flag to RTDB
    try {
      const path = isGroup
        ? `chat/whatsapp_groups/${contextId}/${msgId}/deletedFor`
        : `chat/whatsapp_direct/${contextId}/${msgId}/deletedFor`;
      const cleanUser = sanitizeRtdbKey(userId);
      await set(ref(rtdb, `${path}/${cleanUser}`), true);
      if (cleanUser !== userId) {
        await set(ref(rtdb, `${path}/${userId}`), true).catch(() => {});
      }
      if (allUserAliases) {
        for (const alias of allUserAliases) {
          const ca = sanitizeRtdbKey(alias);
          if (ca) await set(ref(rtdb, `${path}/${ca}`), true).catch(() => {});
        }
      }
    } catch {}
  } else {
    // Delete for everyone:
    // 1. Mark in permanent deleted-for-everyone registry immediately
    addMessageToDeletedForEveryone(msgId);

    // 2. Completely remove from local cache so it vanishes immediately on screen
    const updated = localList.filter((m) => m.id !== msgId);
    setLocalMessages(cacheKey, updated);

    const targetMsg = localList.find((m) => m.id === msgId);
    const tombstone = cleanPayload({
      id: msgId,
      isDeletedForEveryone: true,
      deletedCompletely: true,
      text: '🚫 This message was deleted',
      deletedAt: Date.now(),
      status: 'READ',
      type: 'TEXT',
      senderId: targetMsg?.senderId || userId,
      senderName: targetMsg?.senderName || 'Student',
      mediaUrl: null,
      voiceDuration: null,
      doubtSubject: null,
      replyTo: null,
      reactions: null,
    });

    const msgPath = isGroup
      ? `chat/whatsapp_groups/${contextId}/${msgId}`
      : `chat/whatsapp_direct/${contextId}/${msgId}`;

    const deletedRegistryPath = isGroup
      ? `chat/whatsapp_group_deleted/${contextId}/${msgId}`
      : `chat/whatsapp_direct_deleted/${contextId}/${msgId}`;

    // 3. Write to RTDB deleted registry so any connected or offline client catches it immediately
    try {
      await set(ref(rtdb, deletedRegistryPath), {
        deletedAt: Date.now(),
        deletedBy: userId,
      });
    } catch (e) {
      console.warn('[WhatsApp] RTDB deleted registry error:', e);
    }

    // 4. Update RTDB message node with tombstone (broadcasts to all active subscribers)
    try {
      await update(ref(rtdb, msgPath), tombstone);
    } catch (e) {
      try {
        await set(ref(rtdb, msgPath), tombstone);
      } catch (err) {
        console.warn('[WhatsApp] RTDB tombstone fallback:', err);
      }
    }

    // 5. Update Firestore document with tombstone so Firestore clients also drop it
    try {
      if (db) {
        const col = isGroup ? 'whatsapp_groups' : 'whatsapp_direct';
        const fsDoc = doc(db, col, contextId, 'messages', msgId);
        await setDoc(fsDoc, tombstone, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.warn('[WhatsApp] Firestore tombstone fallback:', e);
    }
  }
};

// ── Mark Messages as Read ───────────────────────────────────────────────────
export const markMessagesAsRead = async (
  isGroup: boolean,
  contextId: string,
  myUserId: string
) => {
  if (!myUserId || !contextId) return;
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);
  const now = Date.now();
  let changed = false;
  const cleanMyUser = sanitizeRtdbKey(myUserId);

  const updated = localList.map((m) => {
    // CRITICAL: NEVER mark my own sent messages as READ!
    // A user can ONLY mark messages sent by OTHER people as READ when they open the chat.
    if (m && m.senderId && !isSameUser(m.senderId, myUserId)) {
      if (isGroup) {
        const currentReadBy = m.readBy || {};
        if (!currentReadBy[cleanMyUser]) {
          changed = true;
          return {
            ...m,
            readBy: { ...currentReadBy, [cleanMyUser]: now },
          };
        }
      } else {
        if (m.status !== 'READ' || !m.readByRecipient) {
          changed = true;
          return {
            ...m,
            status: 'READ' as const,
            seen: true,
            readAt: m.readAt || now,
            readByRecipient: true,
            readBy: { ...(m.readBy || {}), [cleanMyUser]: now },
          };
        }
      }
    }
    return m;
  });

  if (changed) {
    setLocalMessages(cacheKey, updated);
  }

  // Update RTDB for direct chats: ONLY mark messages from the peer recipient
  if (!isGroup) {
    try {
      const unreadFromPeer = localList.filter(
        (m) => m && m.senderId && !isSameUser(m.senderId, myUserId) && (m.status !== 'READ' || !m.readByRecipient)
      );
      for (const m of unreadFromPeer.slice(-15)) {
        update(ref(rtdb, `chat/whatsapp_direct/${contextId}/${m.id}`), {
          status: 'READ',
          seen: true,
          readAt: now,
          readByRecipient: true,
          [`readBy/${cleanMyUser}`]: now,
        }).catch(() => {});
      }
    } catch {}
  } else {
    // Update RTDB for group chats: ONLY record readBy for this user, NEVER overwrite whole status
    try {
      const unreadGroup = localList.filter(
        (m) => m && m.senderId && !isSameUser(m.senderId, myUserId) && (!m.readBy || !m.readBy[cleanMyUser])
      );
      for (const m of unreadGroup.slice(-15)) {
        update(ref(rtdb, `chat/whatsapp_groups/${contextId}/${m.id}`), {
          [`readBy/${cleanMyUser}`]: now,
        }).catch(() => {});
      }
    } catch {}
  }
};

// ── Auto-Delete / Disappearing Messages Timers ───────────────────────────────
// Options: 0 = Off, 86400000 = 24h, 604800000 = 7d, 2592000000 = 30d, 7776000000 = 90d, -1 = Snapchat/Vanish
export const getDisappearingTimer = (contextId: string): number => {
  try {
    const raw = localStorage.getItem(`wa_disappearing_${contextId}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
};

export const setDisappearingTimer = (contextId: string, durationMs: number): void => {
  try {
    localStorage.setItem(`wa_disappearing_${contextId}`, String(durationMs));
  } catch {}
};

/**
 * Checks whether a message is saved (by current user or flagged as saved in chat).
 * Saved messages NEVER disappear in disappearing timers or Snapchat vanish mode until unsaved.
 */
export const isMessageSaved = (msg?: ChatMessage, userId?: string): boolean => {
  if (!msg) return false;
  if (msg.isSaved === true) return true;
  if (userId) {
    if (msg.savedBy && (msg.savedBy[userId] || msg.savedBy[sanitizeRtdbKey(userId)])) {
      return true;
    }
    try {
      const raw = localStorage.getItem(`wa_saved_msgs_${userId}`);
      if (raw) {
        const list: string[] = JSON.parse(raw);
        if (list.includes(msg.id)) return true;
      }
    } catch {}
  }
  return false;
};

/**
 * Toggle Save / Bookmark for a message (Snapchat-style "Save in Chat")
 * "save kìya gaya message snapchart wala mode me delete na hoga unsave hone pe hi delete hoga"
 */
export const toggleSaveChatMessage = async (
  isGroup: boolean,
  contextId: string,
  msgId: string,
  userId: string,
  explicitState?: boolean
): Promise<boolean> => {
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);
  const target = localList.find((m) => m.id === msgId);
  const currentSaved = isMessageSaved(target, userId);
  const nextSaved = explicitState !== undefined ? explicitState : !currentSaved;

  // 1. Update in local cache
  const updated = localList.map((m) => {
    if (m.id === msgId) {
      const savedBy = { ...(m.savedBy || {}) };
      if (nextSaved) {
        savedBy[userId] = true;
      } else {
        delete savedBy[userId];
        delete savedBy[sanitizeRtdbKey(userId)];
      }
      const hasAnySaver = Object.values(savedBy).some(Boolean);
      return {
        ...m,
        isSaved: nextSaved || hasAnySaver,
        savedBy,
      };
    }
    return m;
  });
  setLocalMessages(cacheKey, updated);

  // 2. Persist in local storage dedicated key for resilient backup
  try {
    const localKey = `wa_saved_msgs_${userId}`;
    const raw = localStorage.getItem(localKey);
    let savedList: string[] = raw ? JSON.parse(raw) : [];
    if (nextSaved) {
      if (!savedList.includes(msgId)) savedList.push(msgId);
    } else {
      savedList = savedList.filter((id) => id !== msgId);
    }
    localStorage.setItem(localKey, JSON.stringify(savedList));
  } catch {}

  // 3. Sync to RTDB
  try {
    const cleanUser = sanitizeRtdbKey(userId);
    const basePath = isGroup
      ? `chat/whatsapp_groups/${contextId}/${msgId}`
      : `chat/whatsapp_direct/${contextId}/${msgId}`;

    if (nextSaved) {
      await set(ref(rtdb, `${basePath}/savedBy/${cleanUser}`), true);
      await set(ref(rtdb, `${basePath}/isSaved`), true);
    } else {
      await remove(ref(rtdb, `${basePath}/savedBy/${cleanUser}`));
      const snap = await get(ref(rtdb, `${basePath}/savedBy`));
      const val = snap.val();
      if (!val || Object.keys(val).length === 0) {
        await set(ref(rtdb, `${basePath}/isSaved`), false);
      }
    }
  } catch (e) {
    console.warn('[WhatsApp] toggleSaveChatMessage RTDB error:', e);
  }

  return nextSaved;
};

/**
 * Filter messages based on disappearing messages timer & deletedFor.
 * Saved messages NEVER disappear under vanishing or expiration timers!
 */
export const filterDisappearingMessages = (
  msgs: ChatMessage[],
  contextId: string,
  currentUserId?: string
): ChatMessage[] => {
  const timer = getDisappearingTimer(contextId);
  const now = Date.now();

  return msgs.filter((m) => {
    if (!m || !m.id) return false;

    // 0. Completely purge if deleted for everyone (even if previously saved or starred)
    if (
      m.isDeletedForEveryone ||
      (m as any).deletedCompletely ||
      m.text === '🚫 This message was deleted' ||
      isMessageDeletedForEveryone(m.id)
    ) {
      return false;
    }

    // 1. Hide if deleted for current user
    if (currentUserId && isMessageDeletedForUser(currentUserId, m)) {
      return false;
    }

    // 2. Saved messages NEVER disappear under duration timer or Snapchat Vanish mode!
    // "save kìya gaya message snapchart wala mode me delete na hoga unsave hone pe hi delete hoga"
    if (isMessageSaved(m, currentUserId)) {
      return true;
    }

    // 3. Hide if expired under duration timer (24h, 7d, 30d, 90d)
    if (timer > 0) {
      if (now - m.timestamp > timer) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Snapchat / Vanish Mode: Clear read messages when user navigates back / exits chat.
 * "save kìya gaya message snapchart wala mode me delete na hoga unsave hone pe hi delete hoga"
 */
export const clearSeenVanishMessages = (
  contextId: string,
  isGroup: boolean,
  currentUserId: string
): void => {
  const timer = getDisappearingTimer(contextId);
  if (timer !== -1) return; // Only active in Snapchat / Vanish mode

  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);

  // Filter out any messages that have been read/seen, EXCEPT saved messages!
  const kept = localList.filter((m) => {
    // Saved in chat: keep it permanently until unsaved!
    if (isMessageSaved(m, currentUserId)) {
      return true;
    }
    // Delete seen/read messages when exiting
    if (m.senderId !== currentUserId && m.status === 'READ') {
      return false;
    }
    return true;
  });

  setLocalMessages(cacheKey, kept);

  // In RTDB, clean up unsaved seen messages so they don't reappear
  try {
    localList.forEach((m) => {
      if (!isMessageSaved(m, currentUserId) && m.senderId !== currentUserId && m.status === 'READ') {
        const msgPath = isGroup
          ? `chat/whatsapp_groups/${contextId}/${m.id}`
          : `chat/whatsapp_direct/${contextId}/${m.id}`;
        remove(ref(rtdb, msgPath)).catch(() => {});
      }
    });
  } catch {}
};

// ── Chat Lock (PIN-Protected Chats) ──────────────────────────────────────────
const CHAT_PIN_STORAGE_KEY = 'nsta_chat_pin_code';
const LOCKED_CHATS_STORAGE_KEY = 'nsta_locked_chat_ids';

export const getLockedChatIds = (): string[] => {
  try {
    const raw = localStorage.getItem(LOCKED_CHATS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Memory cache for currently unlocked chats in active session
const sessionUnlockedChats = new Set<string>();

export const unlockChatInSession = (contextId: string): void => {
  if (contextId) sessionUnlockedChats.add(contextId);
};

export const lockChatInSession = (contextId?: string): void => {
  if (contextId) {
    sessionUnlockedChats.delete(contextId);
  } else {
    sessionUnlockedChats.clear();
  }
};

export const isChatLocked = (contextId: string): boolean => {
  if (!contextId) return false;
  // Chat lock: returns true unless unlocked in the current session.
  return !sessionUnlockedChats.has(contextId);
};

export const toggleChatLock = (contextId: string): boolean => {
  if (sessionUnlockedChats.has(contextId)) {
    sessionUnlockedChats.delete(contextId);
    return true;
  } else {
    sessionUnlockedChats.add(contextId);
    return false;
  }
};

// ── 1. Default Master Password (Applies to all normal / unstarred chats) ─────
export const getDefaultChatPin = (userId?: string): string => {
  try {
    if (userId) {
      const userSpecific = localStorage.getItem(`nsta_default_chat_pin_${userId}`);
      if (userSpecific) return userSpecific;
      const legacySpecific = localStorage.getItem(`nsta_master_chat_pin_${userId}`);
      if (legacySpecific) return legacySpecific;
    }
    return localStorage.getItem(CHAT_PIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const setDefaultChatPin = (pin: string, userId?: string): void => {
  try {
    const trimmed = (pin || '').trim();
    if (userId) {
      localStorage.setItem(`nsta_default_chat_pin_${userId}`, trimmed);
      localStorage.setItem(`nsta_master_chat_pin_${userId}`, trimmed);
    }
    localStorage.setItem(CHAT_PIN_STORAGE_KEY, trimmed);
  } catch {}
};

export const hasDefaultChatPin = (userId?: string): boolean => {
  return !!getDefaultChatPin(userId);
};

// ── 2. Special Category Password (Applies to Star-marked / Special chats) ─────
const SPECIAL_CATEGORY_PIN_KEY = 'nsta_special_chat_category_pin';

export const getSpecialChatCategoryPin = (userId?: string): string => {
  try {
    if (userId) {
      const userSpecific = localStorage.getItem(`${SPECIAL_CATEGORY_PIN_KEY}_${userId}`);
      if (userSpecific) return userSpecific;
    }
    return localStorage.getItem(SPECIAL_CATEGORY_PIN_KEY) || '';
  } catch {
    return '';
  }
};

export const setSpecialChatCategoryPin = (pin: string, userId?: string): void => {
  try {
    const trimmed = (pin || '').trim();
    if (userId) {
      localStorage.setItem(`${SPECIAL_CATEGORY_PIN_KEY}_${userId}`, trimmed);
    }
    localStorage.setItem(SPECIAL_CATEGORY_PIN_KEY, trimmed);
  } catch {}
};

export const hasSpecialChatCategoryPin = (userId?: string): boolean => {
  return !!getSpecialChatCategoryPin(userId);
};

// ── 3. Star-Marked / Special Contacts & Chats Management ────────────────────
const STARRED_CHATS_STORAGE_KEY = 'nsta_starred_chats';

export const getStarredChatIds = (userId?: string): string[] => {
  try {
    const key = userId ? `${STARRED_CHATS_STORAGE_KEY}_${userId}` : STARRED_CHATS_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const isChatStarred = (contactOrContextId: string, userId?: string): boolean => {
  if (!contactOrContextId) return false;
  const list = getStarredChatIds(userId);
  return list.includes(contactOrContextId);
};

export const setChatStarred = (contactOrContextId: string, starred: boolean, userId?: string): void => {
  if (!contactOrContextId) return;
  try {
    const key = userId ? `${STARRED_CHATS_STORAGE_KEY}_${userId}` : STARRED_CHATS_STORAGE_KEY;
    const list = getStarredChatIds(userId);
    const setIds = new Set(list);
    if (starred) {
      setIds.add(contactOrContextId);
    } else {
      setIds.delete(contactOrContextId);
    }
    localStorage.setItem(key, JSON.stringify(Array.from(setIds)));
  } catch {}
};

export const toggleChatStarred = (contactOrContextId: string, userId?: string): boolean => {
  if (!contactOrContextId) return false;
  const current = isChatStarred(contactOrContextId, userId);
  const next = !current;
  setChatStarred(contactOrContextId, next, userId);
  return next;
};

// ── 4. Specific Chat Override Password (Per-context optional fallback) ─────────
export const getSpecialChatPin = (contextId: string, userId?: string): string => {
  if (!contextId) return getSpecialChatCategoryPin(userId);
  try {
    const userPrefix = userId ? `${userId}_` : '';
    const specific = localStorage.getItem(`nsta_chat_special_pin_${userPrefix}${contextId}`);
    if (specific) return specific;
    return getSpecialChatCategoryPin(userId);
  } catch {
    return getSpecialChatCategoryPin(userId);
  }
};

export const setSpecialChatPin = (contextId: string, pin: string, userId?: string): void => {
  if (!contextId) {
    setSpecialChatCategoryPin(pin, userId);
    return;
  }
  try {
    const userPrefix = userId ? `${userId}_` : '';
    localStorage.setItem(`nsta_chat_special_pin_${userPrefix}${contextId}`, (pin || '').trim());
  } catch {}
};

export const removeSpecialChatPin = (contextId: string, userId?: string): void => {
  if (!contextId) return;
  try {
    const userPrefix = userId ? `${userId}_` : '';
    localStorage.removeItem(`nsta_chat_special_pin_${userPrefix}${contextId}`);
  } catch {}
};

export const hasSpecialChatPin = (contextId: string, userId?: string): boolean => {
  return !!getSpecialChatPin(contextId, userId);
};

// ── 5. Strict 2-Category PIN Verification ───────────────────────────────────
/**
 * Strict verification based on Category:
 * - If isStarred = true: ONLY Special Password unlocks it (Default password CANNOT unlock!)
 * - If isStarred = false: ONLY Default Password unlocks it (Special password CANNOT unlock!)
 */
export const verifyChatCategoryPin = (
  enteredPin: string,
  isStarred: boolean,
  contextId?: string,
  userId?: string
): boolean => {
  const entered = (enteredPin || '').trim();
  if (!entered) return false;

  if (isStarred) {
    // 1. Check custom chat PIN if set
    if (contextId) {
      const specific = getSpecialChatPin(contextId, userId);
      if (specific && entered === specific) return true;
    }
    // 2. Check Category Special Password
    const specialCatPin = getSpecialChatCategoryPin(userId);
    if (specialCatPin && entered === specialCatPin) return true;
    return false;
  } else {
    // Default unstarred chat — ONLY Default Password can unlock
    const defaultPin = getDefaultChatPin(userId);
    return !!defaultPin && entered === defaultPin;
  }
};

// Unified Verification with backward-compat fallback
export const verifyChatPinForContext = (
  enteredPin: string,
  contextId: string,
  userId?: string
): boolean => {
  const entered = (enteredPin || '').trim();
  if (!entered) return false;

  const isStarred = isChatStarred(contextId, userId);
  return verifyChatCategoryPin(entered, isStarred, contextId, userId);
};

// Aliases for seamless backwards compatibility
export const getChatPin = (userId?: string): string => getDefaultChatPin(userId);
export const setChatPin = (pin: string, userId?: string): void => setDefaultChatPin(pin, userId);
export const hasChatPin = (userId?: string): boolean => hasDefaultChatPin(userId);
export const verifyChatPin = (enteredPin: string, contextId?: string, userId?: string): boolean => {
  if (contextId) {
    return verifyChatPinForContext(enteredPin, contextId, userId);
  }
  const current = getDefaultChatPin(userId);
  return !!current && (enteredPin || '').trim() === current;
};
