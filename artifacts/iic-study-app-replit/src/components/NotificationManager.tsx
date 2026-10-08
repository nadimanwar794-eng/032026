import { VAPID_KEY, getFirebaseMessaging, db, rtdb, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { get, ref, set, onValue, remove, update } from 'firebase/database';

export const NOTIFICATION_CATEGORY_DEFINITIONS = [
  { key: 'DAILY_ROUTINE', label: 'Today’s routine', description: 'Subah ka daily study target' },
  { key: 'ROUTINE_SLOT', label: 'Routine slots', description: 'Aapke selected subject ke time reminders' },
  { key: 'STUDY_PROGRESS', label: 'Study progress', description: '50% / 100% target aur coins milestones' },
  { key: 'STREAK_SAVER', label: 'Streak saver', description: 'Shaam ka pending-target reminder' },
  { key: 'CONTENT', label: 'New content', description: 'Naye notes, MCQs, PDFs aur tests' },
  { key: 'COMMUNITY', label: 'Community updates', description: 'Doubt replies, comments aur notices' },
  { key: 'CHAT', label: 'Private messages', description: 'Direct chat messages' },
  { key: 'FRIEND_REQUEST', label: 'Friend requests', description: 'Friend request aur acceptance alerts' },
  { key: 'LIVE_CLASS', label: 'Live classes', description: 'Live class start alerts' },
  { key: 'STUDY_ROOM', label: 'Study rooms', description: 'Room invites aur live study-room alerts' },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_DEFINITIONS)[number]['key'] | 'DEFAULT';

export type NotificationPreferences = {
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  morningRoutineTime: string;
  streakSaverTime: string;
  routineSlotTimes: Record<string, string>;
  timezone: string;
  updatedAt?: string;
};

const NOTIFICATION_PREFERENCES_KEY = (userId: string) => `nst_notification_preferences_${userId}`;

export const getDefaultNotificationPreferences = (): NotificationPreferences => {
  const categories = {} as Record<NotificationCategory, boolean>;
  for (const item of NOTIFICATION_CATEGORY_DEFINITIONS) categories[item.key] = true;
  categories.DEFAULT = true;
  return {
    enabled: true,
    categories,
    morningRoutineTime: '07:00',
    streakSaverTime: '19:00',
    routineSlotTimes: {},
    timezone: typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      : 'Asia/Kolkata',
  };
};

export const loadNotificationPreferences = (userId?: string): NotificationPreferences => {
  const defaults = getDefaultNotificationPreferences();
  if (!userId || typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFERENCES_KEY(userId));
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...defaults,
      ...saved,
      categories: { ...defaults.categories, ...(saved.categories || {}) },
      routineSlotTimes: { ...(saved.routineSlotTimes || {}) },
    };
  } catch {
    return defaults;
  }
};

export const saveNotificationPreferences = async (
  userId: string,
  next: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> => {
  const preferences = {
    ...loadNotificationPreferences(userId),
    ...next,
    categories: {
      ...loadNotificationPreferences(userId).categories,
      ...(next.categories || {}),
    },
    routineSlotTimes: {
      ...loadNotificationPreferences(userId).routineSlotTimes,
      ...(next.routineSlotTimes || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(NOTIFICATION_PREFERENCES_KEY(userId), JSON.stringify(preferences));
  }
  try {
    const payload = { ...preferences, userId };
    await Promise.all([
      set(ref(rtdb, `notification_preferences/${userId}`), payload),
      set(ref(rtdb, `users/${userId}/notificationPreferences`), payload),
    ]);
  } catch (error) {
    console.warn('[NotificationManager] Preference sync failed:', error);
  }
  return preferences;
};

export const hydrateNotificationPreferences = async (
  userId: string,
): Promise<NotificationPreferences> => {
  if (!userId) return getDefaultNotificationPreferences();
  const local = loadNotificationPreferences(userId);
  try {
    const snapshot = await get(ref(rtdb, `notification_preferences/${userId}`));
    if (!snapshot.exists()) return local;
    const remote = snapshot.val() as Partial<NotificationPreferences>;
    const merged: NotificationPreferences = {
      ...local,
      ...remote,
      categories: { ...local.categories, ...(remote.categories || {}) },
      routineSlotTimes: { ...local.routineSlotTimes, ...(remote.routineSlotTimes || {}) },
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIFICATION_PREFERENCES_KEY(userId), JSON.stringify(merged));
    }
    return merged;
  } catch {
    return local;
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('[NotificationManager] This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.warn('[NotificationManager] Permission request error:', e);
      return false;
    }
  }

  return false;
};

const FCM_SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

const getFcmServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('ServiceWorker not supported in this environment');
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  
  // Prefer the primary active root-scoped service worker (PWA worker),
  // which browser OS push daemons reliably wake up even when the device is locked.
  const activeRoot = registrations.find(
    (r) => (r.active && (r.scope === window.location.origin + '/' || r.scope.endsWith('/')))
  );
  if (activeRoot) return activeRoot;

  if (registrations.length > 0 && registrations[0].active) {
    return registrations[0];
  }

  // Fallback to registering firebase-messaging-sw.js
  try {
    return await navigator.serviceWorker.register(FCM_SERVICE_WORKER_PATH, {
      updateViaCache: 'none',
    });
  } catch (err) {
    console.warn('[NotificationManager] Register fallback warning:', err);
    return await navigator.serviceWorker.ready;
  }
};

export const subscribeUserToPush = async (userId?: string): Promise<string | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const isGranted = await requestNotificationPermission();
    if (!isGranted) {
      console.log('[NotificationManager] Notification permission not granted');
      return null;
    }

    // Firebase Messaging uses its dedicated worker, separate from the PWA worker.
    const swReg = await getFcmServiceWorkerRegistration();

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn('[NotificationManager] Firebase messaging not available');
      return null;
    }

    const { getToken } = await import('firebase/messaging');
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (currentToken) {
      console.log('[NotificationManager] FCM Token acquired:', currentToken.slice(0, 15) + '...');
      localStorage.setItem('nst_fcm_token', currentToken);

      if (userId) {
        await saveFcmToken(userId, currentToken);
        const preferences = loadNotificationPreferences(userId);
        await saveNotificationPreferences(userId, preferences);
      }
      return currentToken;
    } else {
      console.warn('[NotificationManager] No registration token available.');
    }
  } catch (err) {
    console.warn('[NotificationManager] Unable to get FCM token:', err);
  }
  return null;
};

export const saveFcmToken = async (userId: string, token: string) => {
  if (!userId || !token) return;
  try {
    const safeUserId = String(userId).replace(/[.#$[\]/]/g, '_');

    // Save in RTDB
    await Promise.all([
      set(ref(rtdb, `users/${safeUserId}/fcmToken`), token),
      set(ref(rtdb, `users/${safeUserId}/notificationTokenUpdatedAt`), new Date().toISOString()),
    ]).catch(() => {});

    // Save in user's token list for broadcast pushes
    const broadcastRef = ref(rtdb, `fcm_tokens/${safeUserId}`);
    await set(broadcastRef, {
      token,
      updatedAt: new Date().toISOString(),
        platform: 'pwa',
        userId,
    }).catch(() => {});

    // Save in Firestore
    const userDoc = doc(db, 'users', safeUserId);
    await updateDoc(userDoc, { fcmToken: token }).catch(() => {});
  } catch (e) {
    console.warn('[NotificationManager] Token save non-fatal error:', e);
  }
};

export const getStoredFcmToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nst_fcm_token');
};

export interface PushNotificationRequest {
  recipientIds: string[];
  type: NotificationCategory;
  title: string;
  body: string;
  url?: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  icon?: string;
  broadcast?: boolean;
  classLevel?: string;
}

/** Ask the server to send an FCM push, AND directly deliver via Firebase RTDB user inbox for instant background wake-up. */
export const sendPushNotification = async (request: PushNotificationRequest) => {
  const timestamp = Date.now();
  const notifId = `notif_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
  const notifPayload = {
    id: notifId,
    type: request.type,
    title: request.title,
    body: request.body,
    url: request.url || '/',
    senderId: request.senderId || '',
    senderName: request.senderName || '',
    senderPhoto: request.senderPhoto || '',
    icon: request.icon || request.senderPhoto || '/icons/icon-192.png',
    timestamp,
    status: 'UNREAD',
    ...(request.classLevel ? { classLevel: String(request.classLevel).trim() } : {}),
  };

  // 1. Direct real-time delivery via Firebase RTDB user inbox
  const cleanRecipients = (request.recipientIds || [])
    .map((id) => String(id).trim().replace(/[.#$[\]/]/g, '_'))
    .filter(Boolean);

  const writePromises: Promise<any>[] = cleanRecipients.map((recId) =>
    set(ref(rtdb, `user_notifications/${recId}/${notifId}`), notifPayload).catch((err) => {
      console.warn('[NotificationManager] RTDB direct deliver error:', err);
    })
  );

  if (request.broadcast) {
    writePromises.push(
      set(ref(rtdb, `broadcast_notifications/${notifId}`), notifPayload).catch(() => {})
    );
  }

  await Promise.allSettled(writePromises);

  // 2. Also try native server push via /api/notifications/push (non-blocking)
  try {
    const idToken = await auth?.currentUser?.getIdToken().catch(() => null);
    if (idToken) {
      void fetch('/api/notifications/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...request,
          url: request.url || '/',
        }),
      }).catch(() => {});
    }
  } catch (_) {}

  return true;
};

export const notifyFriendRequestInBackground = async (request: {
  recipientIds: string[];
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  url?: string;
}) => {
  if (request.recipientIds.length === 0) return false;
  return sendPushNotification({
    ...request,
    type: 'FRIEND_REQUEST',
    title: '🤝 Friend Request',
    body: `${request.senderName} ne aapko friend request bheji hai! Accept karke baat start karein.`,
    senderPhoto: request.senderPhoto,
    icon: request.senderPhoto,
  });
};

export const notifyFriendAcceptedInBackground = async (request: {
  recipientIds: string[];
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  url?: string;
}) => {
  if (request.recipientIds.length === 0) return false;
  return sendPushNotification({
    ...request,
    type: 'FRIEND_REQUEST',
    title: '🤝 Friend Request Sweekar Hui!',
    body: `${request.senderName} ne aapki friend request accept kar li hai. Ab aap live chat kar sakte hain!`,
    senderPhoto: request.senderPhoto,
    icon: request.senderPhoto,
    url: request.url || '/?open=messenger',
  });
};

export const notifyDirectMessageInBackground = async (request: {
  recipientIds: string[];
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  message: string;
  messageType?: string;
  url?: string;
}) => sendPushNotification({
  recipientIds: request.recipientIds,
  senderId: request.senderId,
  senderName: request.senderName,
  senderPhoto: request.senderPhoto,
  icon: request.senderPhoto,
  type: 'CHAT',
  title: `💬 Naya Message: ${request.senderName}`,
  body: request.message.slice(0, 180) ||
    (request.messageType === 'IMAGE' ? 'Aapko ek photo bheji gayi hai.' :
      request.messageType === 'VIDEO' ? 'Aapko ek video bheja gaya hai.' :
        request.messageType === 'AUDIO' || request.messageType === 'VOICE' ? 'Aapko ek voice message mila hai.' :
          'Aapko ek naya private message mila hai.'),
  url: request.url || '/?open=messenger',
});

export const notifyGroupMessageInBackground = async (request: {
  recipientIds: string[];
  groupId: string;
  groupName: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  message: string;
  messageType?: string;
  url?: string;
}) => {
  if (request.recipientIds.length === 0) return false;
  return sendPushNotification({
    recipientIds: request.recipientIds,
    senderId: request.senderId,
    senderName: request.senderName,
    senderPhoto: request.senderPhoto,
    icon: request.senderPhoto,
    type: 'CHAT',
    title: `👥 ${request.groupName}: ${request.senderName}`,
    body: request.message.slice(0, 180) ||
      (request.messageType === 'IMAGE' ? 'Photo bheji gayi.' :
        request.messageType === 'VIDEO' ? 'Video bheja gaya.' :
          request.messageType === 'AUDIO' ? 'Audio message.' :
            'Naya group message.'),
    url: request.url || '/?open=messenger',
  });
};

export const notifyCommunityUpdateInBackground = async (request: {
  recipientIds: string[];
  senderId?: string;
  senderName: string;
  body: string;
  url?: string;
}) => sendPushNotification({
  recipientIds: request.recipientIds,
  senderId: request.senderId,
  senderName: request.senderName,
  type: 'COMMUNITY',
  title: '💬 Community Update',
  body: request.body,
  url: request.url || '/?open=community',
});

export const getNotificationPermissionStatus = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const listenToForegroundMessages = async (onMessageReceived?: (payload: any) => void) => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};

    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      console.log('[NotificationManager] Foreground message received:', payload);
      
      // 1. Invoke custom callback
      if (onMessageReceived) {
        try { onMessageReceived(payload); } catch (_) {}
      }

      // 2. Automatically display visual alert so user sees it even when app is open!
      const title = payload.notification?.title || payload.data?.title || 'NSTA Study Alert';
      const body = payload.notification?.body || payload.data?.body || 'New update received!';
      const icon = payload.notification?.icon || payload.data?.icon || '/icons/icon-192.png';

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          if ('serviceWorker' in navigator) {
            getFcmServiceWorkerRegistration().then((reg) => {
              reg.showNotification(title, {
                body,
                icon,
                badge: '/favicon.svg',
                tag: 'fcm-foreground-' + Date.now(),
                data: payload.data,
              });
            }).catch(() => {
              try { new Notification(title, { body, icon }); } catch (_) {}
            });
          } else {
            try { new Notification(title, { body, icon }); } catch (_) {}
          }
        } catch (_) {}
      }

      // Also trigger chime & custom event for in-app toasts
      try {
        const audio = new Audio('/branding/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('nst_foreground_notification', {
        detail: { title, body, payload }
      }));
    });
  } catch (e) {
    console.warn('[NotificationManager] listenToForegroundMessages error:', e);
    return () => {};
  }
};

export interface SmartNotificationPayload {
  title: string;
  body: string;
  category: NotificationCategory;
  url?: string;
  senderId?: string;
  silent?: boolean;
}

// Smart Anti-Fatigue Notification Trigger
export const dispatchSmartNotification = async (payload: SmartNotificationPayload) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const { title, body, category, url = '/', senderId } = payload;
  const showNotification = async (
    registration: ServiceWorkerRegistration,
    options: NotificationOptions & { vibrate?: number[]; renotify?: boolean },
  ) => registration.showNotification(title, options);

  // 1. Community & Notes Updates: Silent in-app update only. Never vibrate or spam the phone tray repeatedly.
  if (category === 'COMMUNITY' || category === 'CONTENT') {
    console.log('[SmartNotify] Anti-Fatigue: Silent in-app notification for community/notes:', title);
    // Silent notification without loud vibration
    try {
      if ('serviceWorker' in navigator) {
        const reg = await getFcmServiceWorkerRegistration();
        showNotification(reg, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/favicon.svg',
          tag: 'community-silent',
          silent: true,
          data: { url, category }
        });
      }
    } catch {}
    return;
  }

  // 2. Direct Chat & Friend Request: Instant notification with vibration
  if (category === 'CHAT' || category === 'FRIEND_REQUEST') {
    try {
      // Audio chime & mobile hardware vibration
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([200, 100, 200]); } catch (_) {}
      }

      // Play soft notification sound if available
      try {
        const audio = new Audio('/branding/notification.mp3');
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch (_) {}

      if ('serviceWorker' in navigator) {
        const reg = await getFcmServiceWorkerRegistration();
        showNotification(reg, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/favicon.svg',
          tag: senderId ? `req-${senderId}` : 'friend-request',
          vibrate: [200, 100, 200],
          renotify: true,
          data: { url, category, senderId }
        });
      } else {
        new Notification(title, { body, icon: '/icons/icon-192.png' });
      }
    } catch (e) {
      console.warn('[SmartNotify] Chat notification trigger notice:', e);
    }
    return;
  }

  // 3. Streak & Daily Coins: Gentle reminder
  if (category === 'STREAK_SAVER' || category === 'STUDY_PROGRESS') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await getFcmServiceWorkerRegistration();
        showNotification(reg, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/favicon.svg',
          tag: 'streak-reminder',
          vibrate: [80],
          renotify: false,
          data: { url, category }
        });
      }
    } catch (e) {
      console.warn('[SmartNotify] Streak notification trigger notice:', e);
    }
  }
};

export const testDelayedBackgroundNotification = async (delaySeconds = 5): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    alert('Aapka browser notifications support nahi karta.');
    return false;
  }

  const isGranted = await requestNotificationPermission();
  if (!isGranted) {
    alert('Pehle browser settings me Notification permission ko "Allow" karein.');
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await getFcmServiceWorkerRegistration();
      setTimeout(() => {
        reg.showNotification('🎉 Background Notification Test!', {
          body: 'Aapki app band hone par bhi notification bilkul sahi kaam kar raha hai! (Lock Screen Test Successful)',
          icon: '/icons/icon-192.png',
          badge: '/favicon.svg',
          tag: 'bg-test-' + Date.now(),
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200],
          data: { url: '/' },
        });
      }, Math.max(1, delaySeconds) * 1000);
      return true;
    } else {
      setTimeout(() => {
        new Notification('🎉 Background Notification Test!', {
          body: 'Notifications active hain!',
          icon: '/icons/icon-192.png',
        });
      }, Math.max(1, delaySeconds) * 1000);
      return true;
    }
  } catch (err) {
    console.warn('[NotificationManager] Test notification failed:', err);
    return false;
  }
};

export const notifyStudyProgressMilestone = async (request: {
  recipientIds: string[];
  senderId?: string;
  milestone: 50 | 100;
  lessonTitle?: string;
  subjectName?: string;
  percentComplete?: number;
}) => {
  const pct = typeof request.percentComplete === 'number' && !isNaN(request.percentComplete)
    ? Math.max(1, Math.min(100, Math.round(request.percentComplete)))
    : request.milestone;

  return sendPushNotification({
    recipientIds: request.recipientIds,
    senderId: request.senderId,
    type: 'STUDY_PROGRESS',
    title: request.milestone === 100
      ? `🎉 Lesson Complete: ${request.lessonTitle || 'Study Target'}`
      : `⚡ 50% Progress: ${request.lessonTitle || 'Lesson'}`,
    body: request.milestone === 100
      ? `Shaandar! Aapka ${pct}% Syllabus complete ho gaya hai 📈. Revision Hub unlock ho gaya hai, abhi revision test karein!`
      : `Aaj ke lesson ka 50% progress complete ho gaya (${pct}% syllabus). Keep going!`,
    url: '/?open=routine',
  });
};

export const notifyStudyRoomInviteInBackground = async (request: {
  senderId: string;
  senderName: string;
  roomName: string;
  roomId: string;
  roomCode?: string;
  password?: string;
  classLevel?: string;
  url?: string;
}) => {
  const displayCode = request.roomCode || request.roomId.slice(-6).toUpperCase();
  const passText = request.password?.trim() ? request.password.trim() : 'None (Open Entry)';
  const classText = request.classLevel ? `Class ${request.classLevel}` : 'All Students';

  return sendPushNotification({
    recipientIds: [],
    broadcast: true,
    senderId: request.senderId,
    senderName: request.senderName,
    type: 'STUDY_ROOM',
    classLevel: request.classLevel,
    title: `🟢 Live Study Room: ${request.roomName}`,
    body: `${classText} | Room ID: ${displayCode} | Password: ${passText} - Turant judiye aur sath padhein!`,
    url: request.url || `/?open=study-room&room=${encodeURIComponent(request.roomId)}`,
  });
};

export const notifyStudyRoomStartInBackground = async (request: {
  recipientIds: string[];
  senderId: string;
  senderName: string;
  roomName: string;
  classLevel?: string;
  url?: string;
}) => sendPushNotification({
  recipientIds: request.recipientIds.filter((id) => id !== request.senderId),
  senderId: request.senderId,
  senderName: request.senderName,
  type: 'STUDY_ROOM',
  classLevel: request.classLevel,
  title: '🟢 Study room live hai',
  body: `${request.senderName} ne "${request.roomName}" study room start kiya.`,
  url: request.url || '/?open=study-room',
});

// Evening Gentle Streak & Coin Saver Reminder
// Checks if current time is evening (after 6 PM) and reminder not already sent today
export const checkEveningStreakReminder = (user?: { streak?: number; streakClaimedToday?: boolean }) => {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const currentHour = now.getHours();
  // Only trigger between 6 PM (18:00) and 10 PM (22:00)
  if (currentHour < 18 || currentHour > 22) return;

  const todayKey = `nst_streak_reminder_${now.toISOString().split('T')[0]}`;
  if (localStorage.getItem(todayKey)) return;

  // Mark as checked for today
  localStorage.setItem(todayKey, 'true');

  dispatchSmartNotification({
    title: '🔥 Streak Saver & Daily Coins!',
    body: `Aapka ${user?.streak || 1}-day streak tootne se bachayein! Aaj ke free daily coins collect karein.`,
    category: 'STREAK_SAVER',
    url: '/'
  });
};

// Morning Daily Routine & Challenge Reminder
// Checks if current time is morning (between 6 AM and 11 AM) and reminder not already sent today
export const checkMorningRoutineReminder = (user?: { name?: string }) => {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const currentHour = now.getHours();
  // Only trigger between 6 AM (06:00) and 11 AM (11:00)
  if (currentHour < 6 || currentHour > 11) return;

  const todayKey = `nst_morning_routine_${now.toISOString().split('T')[0]}`;
  if (localStorage.getItem(todayKey)) return;

  localStorage.setItem(todayKey, 'true');

  dispatchSmartNotification({
    title: '🌅 Subah Ka Daily Study Target!',
    body: `Namaste ${user?.name ? user.name.split(' ')[0] : ''}! Aaj ke routine ke chapters aur MCQs complete karke study coins aur rank badhayein.`,
    category: 'DAILY_ROUTINE',
    url: '/?open=routine'
  });
};

export const notifyLiveClassStartInBackground = async (request: {
  title: string;
  subject?: string;
  teacherName?: string;
  url?: string;
}) => {
  return sendPushNotification({
    recipientIds: [],
    broadcast: true,
    type: 'LIVE_CLASS',
    title: '🔴 Live Class Shuru Ho Chuki Hai!',
    body: `${request.teacherName || 'Teacher'} ne "${request.title}" live class start kar di hai. Turant judiye!`,
    url: request.url || '/?open=live-class',
  });
};

export const notifyContentPublishedInBackground = async (request: {
  title: string;
  contentType: 'NOTES' | 'MCQ' | 'TEST' | 'SYLLABUS';
  subject?: string;
  classLevel?: string;
  url?: string;
}) => {
  const typeLabel =
    request.contentType === 'NOTES' ? '📖 Naye Notes' :
    request.contentType === 'MCQ' ? '⚡ Naya MCQ Set' :
    request.contentType === 'TEST' ? '📝 Naya Test' : '📚 Syllabus Update';

  return sendPushNotification({
    recipientIds: [],
    broadcast: true,
    type: 'CONTENT',
    title: `${typeLabel} Uplabdh Hai!`,
    body: `${request.subject ? `[${request.subject}] ` : ''}${request.title} app me add ho gaya hai. Abhi padhein!`,
    url: request.url || '/',
  });
};

export const isCategoryEnabled = (prefs: NotificationPreferences | null, type: string): boolean => {
  if (!prefs) return true;
  if (prefs.enabled === false) return false;
  const cats = prefs.categories as Record<string, boolean>;
  return cats?.[type] !== false;
};

/**
 * Real-time User Notification Subscriber (RTDB User Inbox):
 * Runs on every user device/PWA, receives incoming direct messages, friend requests,
 * study room battles, and routine alerts in real time.
 * Automatically wakes up device via Service Worker showNotification, vibrates mobile hardware,
 * plays audio chime, and triggers in-app toast alerts.
 */
export const subscribeToUserNotifications = (
  userId: string,
  onNotificationReceived?: (notification: any) => void
): (() => void) => {
  if (!userId || typeof window === 'undefined') return () => {};

  const safeUserId = String(userId).trim().replace(/[.#$[\]/]/g, '_');
  const seenIdsKey = `nst_seen_notif_${safeUserId}`;
  const seenIds = new Set<string>();

  try {
    const raw = sessionStorage.getItem(seenIdsKey);
    if (raw) {
      JSON.parse(raw).forEach((id: string) => seenIds.add(id));
    }
  } catch {}

  const saveSeenIds = () => {
    try {
      const arr = Array.from(seenIds).slice(-100);
      sessionStorage.setItem(seenIdsKey, JSON.stringify(arr));
    } catch {}
  };

  const handleIncomingNotification = async (item: any, notifKey?: string) => {
    if (!item || !item.id) return;
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    saveSeenIds();

    // Discard notifications older than 45 minutes to prevent ancient loop on app re-open
    const now = Date.now();
    if (item.timestamp && now - Number(item.timestamp) > 45 * 60 * 1000) {
      if (notifKey) {
        remove(ref(rtdb, `user_notifications/${safeUserId}/${notifKey}`)).catch(() => {});
      }
      return;
    }

    // Check user preferences
    const prefs = loadNotificationPreferences(userId);
    if (item.type && !isCategoryEnabled(prefs, item.type)) {
      if (notifKey) {
        remove(ref(rtdb, `user_notifications/${safeUserId}/${notifKey}`)).catch(() => {});
      }
      return;
    }

    // Class filter check for Study Room broadcasts: only notify matching class students
    if (item.type === 'STUDY_ROOM' && item.classLevel) {
      try {
        const storedClass = (localStorage.getItem('nst_user_class') || localStorage.getItem('nst_session_class') || '').trim();
        const targetClass = String(item.classLevel).trim();
        if (storedClass && targetClass && storedClass !== targetClass) {
          if (notifKey) {
            remove(ref(rtdb, `user_notifications/${safeUserId}/${notifKey}`)).catch(() => {});
          }
          return;
        }
      } catch {}
    }

    console.log('[NotificationManager] Real-time user notification received:', item.title, item.type);

    // 1. Invoke custom callback
    if (onNotificationReceived) {
      try { onNotificationReceived(item); } catch (_) {}
    }

    // 2. Dispatch custom DOM event for in-app toast
    try {
      window.dispatchEvent(
        new CustomEvent('nst_foreground_notification', {
          detail: {
            title: item.title,
            body: item.body,
            payload: item,
          },
        })
      );
    } catch (_) {}

    // 3. Audio Chime
    try {
      const audio = new Audio('/branding/notification.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch (_) {}

    // 4. Mobile Hardware Vibration
    const isUrgent = item.type === 'FRIEND_REQUEST' || item.type === 'STUDY_ROOM';
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(isUrgent ? [250, 100, 250] : [100, 50, 100]);
      } catch (_) {}
    }

    // 5. Native OS Notification via Service Worker (Works even when app tab is in background!)
    // NSTA Messenger Rule:
    // When app is in background (document.hidden), do NOT spam private CHAT push notifications.
    // Private CHAT alerts notify inside the app. FRIEND_REQUEST, STUDY_ROOM, ROUTINE trigger OS push even in background!
    const isAppHidden = typeof document !== 'undefined' && document.hidden;
    const allowOsNotification = !(item.type === 'CHAT' && isAppHidden);

    if (allowOsNotification && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await getFcmServiceWorkerRegistration();
          reg.showNotification(item.title, {
            body: item.body,
            icon: item.icon || item.senderPhoto || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: item.senderId ? `nst-${item.type}-${item.senderId}` : `nst-${item.type}-${item.id}`,
            vibrate: isUrgent ? [250, 100, 250] : [100, 50, 100],
            renotify: true,
            requireInteraction: isUrgent,
            data: { url: item.url || '/', ...item },
            actions: [
              { action: 'open', title: 'Open App' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          } as any);
        } else {
          new Notification(item.title, { body: item.body, icon: item.icon || '/icons/icon-192.png' });
        }
      } catch (err) {
        console.warn('[NotificationManager] Native showNotification warning:', err);
      }
    }

    // 6. Clean up from RTDB queue once handled
    if (notifKey) {
      try {
        await remove(ref(rtdb, `user_notifications/${safeUserId}/${notifKey}`));
      } catch (_) {}
    }
  };

  // Subscribe to personal notifications
  const userNotifRef = ref(rtdb, `user_notifications/${safeUserId}`);
  const unsubUser = onValue(
    userNotifRef,
    (snapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== 'object') return;
      Object.entries(val).forEach(([key, notif]: [string, any]) => {
        handleIncomingNotification(notif, key);
      });
    },
    (err) => {
      console.warn('[NotificationManager] User notifications listen warning:', err);
    }
  );

  // Subscribe to broadcast notifications
  const broadcastRef = ref(rtdb, 'broadcast_notifications');
  const unsubBroadcast = onValue(
    broadcastRef,
    (snapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== 'object') return;
      Object.entries(val).forEach(([key, notif]: [string, any]) => {
        handleIncomingNotification(notif, key);
      });
    },
    (err) => {
      console.warn('[NotificationManager] Broadcast notifications listen warning:', err);
    }
  );

  return () => {
    unsubUser();
    unsubBroadcast();
  };
};

