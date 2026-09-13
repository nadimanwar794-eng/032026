// ─── WhatsApp-style Realtime Direct & Group Chat Service ───────────────────────────
import { ref, set, get, update, onValue, push, remove } from 'firebase/database';
import { doc, setDoc, collection, getDocs, limit, query, onSnapshot } from 'firebase/firestore';
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
}

export interface FriendRequest {
  id: string; // `${fromId}_${toId}`
  fromId: string;
  fromName: string;
  fromPhoto?: string;
  fromRole?: string;
  toId: string;
  toName: string;
  toPhoto?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  timestamp: number;
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
    isOnline: true,
    statusText: 'Maths Quadratic Equations solving 📐',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'YEARLY',
  },
  {
    id: 'student_priya_s',
    name: 'Priya Sharma',
    classLevel: 'Class 12',
    isOnline: true,
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
    lastSeen: Date.now() - 15 * 60 * 1000,
    statusText: 'Chemistry Organic notes revision 🧪',
    role: 'STUDENT',
    subscriptionLevel: 'BASIC',
    subscriptionTier: 'MONTHLY',
  },
  {
    id: 'student_ananya_s',
    name: 'Ananya Singh',
    classLevel: 'Class 10',
    isOnline: true,
    statusText: 'Biology NCERT line-by-line reading 🌿',
    role: 'STUDENT',
    subscriptionLevel: 'ULTRA',
    subscriptionTier: 'LIFETIME',
  },
  {
    id: 'student_vikash_p',
    name: 'Vikash Patel',
    classLevel: 'Competition (JEE)',
    isOnline: true,
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
    lastSeen: Date.now() - 40 * 60 * 1000,
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
    lastSeen: Date.now() - 2 * 3600 * 1000,
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
    lastSeen: Date.now() - 3.5 * 3600 * 1000,
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
    lastSeen: Date.now() - 5 * 3600 * 1000,
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
    lastSeen: Date.now() - 8 * 3600 * 1000,
    statusText: 'Offline • Evening study session 📖',
    role: 'STUDENT',
    subscriptionLevel: 'FREE',
    subscriptionTier: 'FREE',
  },
  {
    id: 'student_ritu_k',
    name: 'Ritu Kumari',
    classLevel: 'Class 12',
    isOnline: true,
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

export const SEEDED_GROUPS: ChatGroup[] = [];

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
  if (!m || !userId) return false;
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
  extra?: { mediaUrl?: string; voiceDuration?: number; doubtSubject?: string; replyTo?: any }
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
    ...(extra?.voiceDuration ? { voiceDuration: extra.voiceDuration } : {}),
    ...(extra?.doubtSubject ? { doubtSubject: extra.doubtSubject } : {}),
    ...(extra?.replyTo ? { replyTo: extra.replyTo } : {}),
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
  extra?: { mediaUrl?: string; voiceDuration?: number; doubtSubject?: string; replyTo?: any }
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
    ...(extra?.voiceDuration ? { voiceDuration: extra.voiceDuration } : {}),
    ...(extra?.doubtSubject ? { doubtSubject: extra.doubtSubject } : {}),
    ...(extra?.replyTo ? { replyTo: extra.replyTo } : {}),
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

  // Emit local cache immediately for zero loading wait
  const initialLocal = getLocalMessages(cacheKey);
  if (initialLocal.length > 0) {
    callback(initialLocal);
  } else {
    callback(getStarterPeerMessages(peerUserId));
  }

  // Merging logic that prevents messages from disappearing while strictly filtering out deleted messages
  const mergeAndEmit = (incoming: ChatMessage[]) => {
    const freshLocal = getLocalMessages(cacheKey, myUserId);
    const map = new Map<string, ChatMessage>();

    // 1. Seed with local messages (filtering out deleted for me)
    freshLocal.forEach((m) => {
      if (m && m.id && !isMessageDeletedForUser(myUserId, m)) {
        map.set(m.id, m);
      }
    });

    // 2. Merge incoming messages (strictly dropping messages deleted for me)
    incoming.forEach((m) => {
      if (m && m.id && !isMessageDeletedForUser(myUserId, m)) {
        const existing = map.get(m.id);
        if (existing?.isDeletedForEveryone) {
          map.set(m.id, {
            ...m,
            text: '🚫 This message was deleted',
            isDeletedForEveryone: true,
            type: 'TEXT',
          });
        } else {
          map.set(m.id, m);
        }
      }
    });

    const combined = Array.from(map.values())
      .filter((m) => !isMessageDeletedForUser(myUserId, m))
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
        // Safe fallback: never wipe out local messages when RTDB is empty or resets
        const freshLocal = getLocalMessages(cacheKey, myUserId);
        if (freshLocal.length > 0) {
          callback(freshLocal);
        } else {
          callback(getStarterPeerMessages(peerUserId));
        }
      }
    },
    (error) => {
      console.warn('[WhatsApp] RTDB listen error, using local:', error);
      const freshLocal = getLocalMessages(cacheKey, myUserId);
      callback(freshLocal.length > 0 ? freshLocal : getStarterPeerMessages(peerUserId));
    }
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

  const initialLocal = getLocalMessages(cacheKey);
  if (initialLocal.length > 0) {
    const filtered = currentUserId
      ? initialLocal.filter((m) => !isMessageDeletedForUser(currentUserId, m))
      : initialLocal;
    callback(filtered);
  } else {
    callback(getStarterGroupMessages(groupId));
  }

  const mergeAndEmit = (incoming: ChatMessage[]) => {
    const freshLocal = getLocalMessages(cacheKey);
    const map = new Map<string, ChatMessage>();

    freshLocal.forEach((m) => {
      if (m && m.id && (!currentUserId || !isMessageDeletedForUser(currentUserId, m))) {
        map.set(m.id, m);
      }
    });

    incoming.forEach((m) => {
      if (m && m.id && (!currentUserId || !isMessageDeletedForUser(currentUserId, m))) {
        const existing = map.get(m.id);
        if (existing?.isDeletedForEveryone) {
          map.set(m.id, {
            ...m,
            text: '🚫 This message was deleted',
            isDeletedForEveryone: true,
            type: 'TEXT',
          });
        } else {
          map.set(m.id, m);
        }
      }
    });

    const combined = Array.from(map.values())
      .filter((m) => !currentUserId || !isMessageDeletedForUser(currentUserId, m))
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
        if (freshLocal.length > 0) {
          callback(freshLocal);
        } else {
          callback(getStarterGroupMessages(groupId));
        }
      }
    },
    (error) => {
      console.warn('[WhatsApp] RTDB group listen error:', error);
      const freshLocal = getLocalMessages(cacheKey, currentUserId);
      callback(freshLocal.length > 0 ? freshLocal : getStarterGroupMessages(groupId));
    }
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

/**
 * Fetch registered students from Firestore / RTDB + seeds
 */
export const fetchRegisteredStudents = async (myUserId: string): Promise<ChatContact[]> => {
  const result: ChatContact[] = [];
  const seenIds = new Set<string>();

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
          result.push({
            id: uid,
            name: d.name || d.displayName || 'Student',
            photoURL: d.photoURL || d.avatarUrl || '',
            statusText: d.statusText || d.bio || 'Studying on IIC App 📚',
            isOnline: !!d.isOnline,
            classLevel: d.classLevel || d.role || 'Class 10-12',
            role: d.role || 'STUDENT',
            subscriptionLevel: d.subscriptionLevel || (d.isPremium ? 'BASIC' : 'FREE'),
            subscriptionTier: d.subscriptionTier || 'FREE',
            isPremium: !!d.isPremium,
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
          result.push({
            id: uid,
            name: d?.name || d?.displayName || 'Student',
            photoURL: d?.photoURL || d?.avatarUrl || '',
            statusText: d?.statusText || 'Available for study chat 💡',
            isOnline: !!d?.isOnline,
            classLevel: d?.classLevel || d?.role || 'Student',
            role: d?.role || 'STUDENT',
            subscriptionLevel: d?.subscriptionLevel || (d?.isPremium ? 'BASIC' : 'FREE'),
            subscriptionTier: d?.subscriptionTier || 'FREE',
            isPremium: !!d?.isPremium,
          });
        }
      });
    }
  } catch {}

  // 3. Always include institute classmates (both online & offline students)
  INSTITUTE_CLASSMATES.forEach((st) => {
    const isSelf = st.id === myUserId;
    if (!isSelf && !seenIds.has(st.id)) {
      seenIds.add(st.id);
      result.push(st);
    }
  });

  return result;
};

/**
 * Send a Friend Request to another student.
 */
export const sendFriendRequest = async (
  fromUser: { id: string; name: string; photoURL?: string; role?: string },
  toUser: { id: string; name: string; photoURL?: string }
): Promise<FriendRequest> => {
  const reqId = `${fromUser.id}_${toUser.id}`;
  const request: FriendRequest = {
    id: reqId,
    fromId: fromUser.id,
    fromName: fromUser.name,
    fromPhoto: fromUser.photoURL || '',
    fromRole: fromUser.role || 'STUDENT',
    toId: toUser.id,
    toName: toUser.name,
    toPhoto: toUser.photoURL || '',
    status: 'PENDING',
    timestamp: Date.now(),
  };

  const payload = cleanPayload(request);
  const cleanTo = sanitizeRtdbKey(toUser.id);
  const cleanFrom = sanitizeRtdbKey(fromUser.id);

  try {
    // 1. Save to recipient's incoming requests in RTDB using sanitized key
    await set(ref(rtdb, `chat/friend_requests/${cleanTo}/${cleanFrom}`), payload);
    // 2. Save to sender's outgoing requests in RTDB
    await set(ref(rtdb, `chat/friend_requests_sent/${cleanFrom}/${cleanTo}`), payload);

    // If raw IDs are valid and different, also write to raw paths for maximum compatibility
    if (cleanTo !== toUser.id && !/[.#$[\]/]/.test(toUser.id) && !/[.#$[\]/]/.test(fromUser.id)) {
      await set(ref(rtdb, `chat/friend_requests/${toUser.id}/${fromUser.id}`), payload).catch(() => {});
    }
    if (cleanFrom !== fromUser.id && !/[.#$[\]/]/.test(fromUser.id) && !/[.#$[\]/]/.test(toUser.id)) {
      await set(ref(rtdb, `chat/friend_requests_sent/${fromUser.id}/${toUser.id}`), payload).catch(() => {});
    }
  } catch (e) {
    console.warn('[Nsta Messenger] RTDB friend request write fallback:', e);
  }

  // 3. Firestore Dual-Sync Backup (in friend_requests collection and direct messages)
  try {
    if (db) {
      await setDoc(doc(db, 'friend_requests', reqId), payload, { merge: true }).catch(() => {});
      const convId = getDirectConversationId(fromUser.id, toUser.id);
      const fsDoc = doc(db, 'whatsapp_direct', convId, 'messages', `req_${reqId}`);
      await setDoc(fsDoc, {
        id: `req_${reqId}`,
        senderId: fromUser.id,
        senderName: fromUser.name,
        senderPhoto: fromUser.photoURL || '',
        text: `🤝 ${fromUser.name} ne friend request bheji hai`,
        timestamp: Date.now(),
        type: 'SYSTEM',
        status: 'SENT',
        friendRequestData: payload,
      }, { merge: true }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking
  }

  // 4. Local storage sync
  saveLocalFriendRequest(request);

  return request;
};

/**
 * Accept Friend Request: Both users become friends and 1-on-1 chat unlocks!
 */
export const acceptFriendRequest = async (
  myUser: { id: string; name: string; photoURL?: string },
  requester: { id: string; name: string; photoURL?: string }
): Promise<boolean> => {
  const now = Date.now();
  const cleanMy = sanitizeRtdbKey(myUser.id);
  const cleanRequester = sanitizeRtdbKey(requester.id);

  const friendData1 = cleanPayload({ id: requester.id, name: requester.name, photoURL: requester.photoURL || '', friendedAt: now });
  const friendData2 = cleanPayload({ id: myUser.id, name: myUser.name, photoURL: myUser.photoURL || '', friendedAt: now });

  try {
    // 1. Mark both as friends in RTDB
    await set(ref(rtdb, `chat/friends/${cleanMy}/${cleanRequester}`), friendData1);
    await set(ref(rtdb, `chat/friends/${cleanRequester}/${cleanMy}`), friendData2);

    // 2. Remove pending requests
    await remove(ref(rtdb, `chat/friend_requests/${cleanMy}/${cleanRequester}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanRequester}/${cleanMy}`)).catch(() => {});

    // Also clean raw IDs if different
    if (cleanMy !== myUser.id || cleanRequester !== requester.id) {
      if (!/[.#$[\]/]/.test(myUser.id) && !/[.#$[\]/]/.test(requester.id)) {
        await remove(ref(rtdb, `chat/friend_requests/${myUser.id}/${requester.id}`)).catch(() => {});
        await remove(ref(rtdb, `chat/friend_requests_sent/${requester.id}/${myUser.id}`)).catch(() => {});
      }
    }

    // 3. Post a congratulatory starter message in direct chat
    const convId = getDirectConversationId(myUser.id, requester.id);
    const starterMsgId = `friend_init_${now}`;
    const starterMsg = cleanPayload({
      id: starterMsgId,
      senderId: 'SYSTEM',
      senderName: 'System',
      text: `🤝 Friend request accept ho gayi! Aap dono ab Nsta Messenger par baatein aur doubts share kar sakte hain.`,
      timestamp: now,
      type: 'SYSTEM',
      status: 'READ',
    });
    await set(ref(rtdb, `chat/whatsapp_direct/${convId}/${starterMsgId}`), starterMsg).catch(() => {});
    if (db) {
      setDoc(doc(db, 'whatsapp_direct', convId, 'messages', starterMsgId), starterMsg, { merge: true }).catch(() => {});
    }
  } catch (e) {
    console.warn('[Nsta Messenger] RTDB accept friend error:', e);
  }

  // Local storage save
  saveLocalFriend(myUser.id, friendData1);
  saveLocalFriend(requester.id, friendData2);
  removeLocalFriendRequest(`${requester.id}_${myUser.id}`);
  removeLocalFriendRequest(`${cleanRequester}_${cleanMy}`);

  return true;
};

/**
 * Reject Friend Request.
 */
export const rejectFriendRequest = async (myUserId: string, requesterId: string): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanRequester = sanitizeRtdbKey(requesterId);
  try {
    await remove(ref(rtdb, `chat/friend_requests/${cleanMy}/${cleanRequester}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanRequester}/${cleanMy}`)).catch(() => {});
    if (cleanMy !== myUserId || cleanRequester !== requesterId) {
      if (!/[.#$[\]/]/.test(myUserId) && !/[.#$[\]/]/.test(requesterId)) {
        await remove(ref(rtdb, `chat/friend_requests/${myUserId}/${requesterId}`)).catch(() => {});
        await remove(ref(rtdb, `chat/friend_requests_sent/${requesterId}/${myUserId}`)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Nsta Messenger] Error rejecting friend request:', e);
  }
  removeLocalFriendRequest(`${requesterId}_${myUserId}`);
  removeLocalFriendRequest(`${cleanRequester}_${cleanMy}`);
  return true;
};

/**
 * Cancel outgoing Friend Request.
 */
export const cancelFriendRequest = async (myUserId: string, toUserId: string): Promise<boolean> => {
  const cleanMy = sanitizeRtdbKey(myUserId);
  const cleanTo = sanitizeRtdbKey(toUserId);
  try {
    await remove(ref(rtdb, `chat/friend_requests/${cleanTo}/${cleanMy}`)).catch(() => {});
    await remove(ref(rtdb, `chat/friend_requests_sent/${cleanMy}/${cleanTo}`)).catch(() => {});
    if (cleanMy !== myUserId || cleanTo !== toUserId) {
      if (!/[.#$[\]/]/.test(myUserId) && !/[.#$[\]/]/.test(toUserId)) {
        await remove(ref(rtdb, `chat/friend_requests/${toUserId}/${myUserId}`)).catch(() => {});
        await remove(ref(rtdb, `chat/friend_requests_sent/${myUserId}/${toUserId}`)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Nsta Messenger] Error cancelling friend request:', e);
  }
  removeLocalFriendRequest(`${myUserId}_${toUserId}`);
  removeLocalFriendRequest(`${cleanMy}_${cleanTo}`);
  return true;
};

/**
 * Subscribe to Incoming Friend Requests
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
    const combinedMap = new Map<string, FriendRequest>();
    sourceBuckets.forEach((bucket) => {
      bucket.forEach((item, id) => {
        if (item && item.status === 'PENDING') {
          combinedMap.set(id, item);
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
          console.warn('[Nsta Messenger] Friend requests RTDB listener error for key', targetKey, err);
        }
      );
      unsubs.push(unsub);
    } catch (e) {
      console.warn('[Nsta Messenger] Failed to attach friend requests listener:', e);
    }
  });

  // 2. Cloud Firestore listener for incoming friend requests
  try {
    if (db) {
      const fsBucket = new Map<string, FriendRequest>();
      sourceBuckets.set('firestore', fsBucket);

      const fsQuery = query(collection(db, 'friend_requests'), limit(50));
      const unsubFs = onSnapshot(
        fsQuery,
        (snap) => {
          fsBucket.clear();
          snap.forEach((docSnap) => {
            const data = docSnap.data() as FriendRequest;
            const toMatch = data.toId === myUserId || targetIds.includes(sanitizeRtdbKey(data.toId));
            if (toMatch && data.status === 'PENDING') {
              fsBucket.set(docSnap.id, { ...data, id: docSnap.id });
            }
          });
          emit();
        },
        (err) => {
          console.warn('[Nsta Messenger] Firestore friend_requests listener error:', err);
        }
      );
      unsubs.push(unsubFs);
    }
  } catch {}

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
};

/**
 * Subscribe to Outgoing Sent Friend Requests
 */
export const subscribeToSentFriendRequests = (
  myUserId: string,
  callback: (requests: FriendRequest[]) => void
): (() => void) => {
  if (!myUserId) return () => {};
  const cleanMy = sanitizeRtdbKey(myUserId);
  const sentRef = ref(rtdb, `chat/friend_requests_sent/${cleanMy}`);
  const unsub = onValue(
    sentRef,
    (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        const list: FriendRequest[] = Object.values(val);
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        callback(list);
      } else {
        callback([]);
      }
    },
    () => {
      callback([]);
    }
  );
  return unsub;
};

/**
 * Subscribe to Confirmed Friends
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

  const local = getLocalFriends(myUserId);
  if (local.length > 0) callback(local);

  const friendsMap = new Map<string, ChatContact>();
  local.forEach((f) => friendsMap.set(f.id, f));

  const unsubs: Array<() => void> = [];

  const emit = () => {
    const list = Array.from(friendsMap.values());
    callback(list);
    saveAllLocalFriends(myUserId, list);
  };

  targetIds.forEach((targetKey) => {
    try {
      const friendsRef = ref(rtdb, `chat/friends/${targetKey}`);
      const unsub = onValue(
        friendsRef,
        (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            Object.values(val).forEach((item: any) => {
              if (item && item.id) {
                friendsMap.set(item.id, {
                  id: item.id,
                  name: item.name || 'Friend',
                  photoURL: item.photoURL || '',
                  isOnline: true,
                  statusText: 'Friend 🤝 · Available to chat',
                  classLevel: 'Friend',
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

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
};

// Local storage helpers for Friends
function getLocalFriendRequests(): FriendRequest[] {
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

function removeLocalFriendRequest(reqId: string) {
  const list = getLocalFriendRequests().filter((r) => r.id !== reqId);
  try {
    localStorage.setItem('nsta_friend_requests', JSON.stringify(list));
  } catch {}
}

function getLocalFriends(userId: string): ChatContact[] {
  try {
    const raw = localStorage.getItem(`nsta_friends_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalFriend(userId: string, friend: any) {
  const list = getLocalFriends(userId).filter((f) => f.id !== friend.id);
  list.unshift({
    id: friend.id,
    name: friend.name,
    photoURL: friend.photoURL,
    isOnline: true,
    statusText: 'Friend 🤝 · Available to chat',
    classLevel: 'Friend',
  });
  saveAllLocalFriends(userId, list);
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
  const path = isGroup
    ? `chat/whatsapp_groups/${contextId}/${msgId}/reactions/${userId}`
    : `chat/whatsapp_direct/${contextId}/${msgId}/reactions/${userId}`;

  try {
    await set(ref(rtdb, path), emoji);
  } catch (e) {
    console.warn('[WhatsApp] Reaction error:', e);
  }
};

// ── Local Storage Helpers ────────────────────────────────────────────────────
function getLocalMessages(key: string, currentUserId?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`wa_msgs_${key}`);
    const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
    if (currentUserId) {
      return list.filter((m) => !isMessageDeletedForUser(currentUserId, m));
    }
    return list;
  } catch {
    return [];
  }
}

function setLocalMessages(key: string, msgs: ChatMessage[], currentUserId?: string) {
  try {
    const filtered = currentUserId
      ? msgs.filter((m) => !isMessageDeletedForUser(currentUserId, m))
      : msgs;
    localStorage.setItem(`wa_msgs_${key}`, JSON.stringify(filtered.slice(-100)));
  } catch {}
}

function saveLocalMessage(key: string, msg: ChatMessage, currentUserId?: string) {
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
  mode: 'FOR_ME' | 'FOR_EVERYONE'
) => {
  const cacheKey = isGroup ? `group_${contextId}` : `dm_${contextId}`;
  const localList = getLocalMessages(cacheKey);

  if (mode === 'FOR_ME') {
    // 1. Permanently register in persistent deleted-for-me cache
    addMessageToDeletedForMe(userId, msgId);

    // 2. Delete for me: remove immediately from local cache
    const updated = localList.filter((m) => m.id !== msgId);
    setLocalMessages(cacheKey, updated);

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
    } catch {}
  } else {
    // Delete for everyone: update message text to deleted placeholder
    const updated = localList.map((m) => {
      if (m.id === msgId) {
        return {
          ...m,
          text: '🚫 This message was deleted',
          isDeletedForEveryone: true,
          type: 'TEXT' as const,
          mediaUrl: undefined,
          voiceDuration: undefined,
        };
      }
      return m;
    });
    setLocalMessages(cacheKey, updated);

    // Sync to RTDB
    try {
      const msgPath = isGroup
        ? `chat/whatsapp_groups/${contextId}/${msgId}`
        : `chat/whatsapp_direct/${contextId}/${msgId}`;
      await update(ref(rtdb, msgPath), {
        text: '🚫 This message was deleted',
        isDeletedForEveryone: true,
        type: 'TEXT',
        mediaUrl: null,
      });
    } catch (e) {
      console.warn('[WhatsApp] Delete for everyone RTDB error:', e);
    }

    // Sync to Firestore
    try {
      if (db) {
        const col = isGroup ? 'whatsapp_groups' : 'whatsapp_direct';
        const fsDoc = doc(db, col, contextId, 'messages', msgId);
        setDoc(fsDoc, {
          text: '🚫 This message was deleted',
          isDeletedForEveryone: true,
          type: 'TEXT',
        }, { merge: true }).catch(() => {});
      }
    } catch {}
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
 * Filter messages based on disappearing messages timer & deletedFor
 */
export const filterDisappearingMessages = (
  msgs: ChatMessage[],
  contextId: string,
  currentUserId?: string
): ChatMessage[] => {
  const timer = getDisappearingTimer(contextId);
  const now = Date.now();

  return msgs.filter((m) => {
    // 1. Hide if deleted for current user
    if (currentUserId && isMessageDeletedForUser(currentUserId, m)) {
      return false;
    }

    // 2. Hide if expired under duration timer (24h, 7d, 30d, 90d)
    if (timer > 0) {
      if (now - m.timestamp > timer) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Snapchat / Vanish Mode: Clear read messages when user navigates back / exits chat
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

  // Filter out any messages that have been read/seen
  const kept = localList.filter((m) => {
    // Keep unread messages or messages not yet delivered
    if (m.senderId !== currentUserId && m.status === 'READ') {
      return false; // delete read messages!
    }
    return true;
  });

  setLocalMessages(cacheKey, kept);
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

export const isChatLocked = (contextId: string): boolean => {
  const locked = getLockedChatIds();
  return locked.includes(contextId);
};

export const toggleChatLock = (contextId: string): boolean => {
  const locked = getLockedChatIds();
  const index = locked.indexOf(contextId);
  let isNowLocked = false;
  if (index >= 0) {
    locked.splice(index, 1);
    isNowLocked = false;
  } else {
    locked.push(contextId);
    isNowLocked = true;
  }
  try {
    localStorage.setItem(LOCKED_CHATS_STORAGE_KEY, JSON.stringify(locked));
  } catch {}
  return isNowLocked;
};

export const getChatPin = (): string => {
  try {
    return localStorage.getItem(CHAT_PIN_STORAGE_KEY) || '1234';
  } catch {
    return '1234';
  }
};

export const setChatPin = (pin: string): void => {
  try {
    localStorage.setItem(CHAT_PIN_STORAGE_KEY, pin);
  } catch {}
};

export const hasChatPin = (): boolean => {
  try {
    return !!localStorage.getItem(CHAT_PIN_STORAGE_KEY);
  } catch {
    return false;
  }
};

export const verifyChatPin = (enteredPin: string): boolean => {
  const current = getChatPin();
  return enteredPin === current;
};
