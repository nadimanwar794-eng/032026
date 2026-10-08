import { Router, type Request } from "express";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

const router = Router();

const NOTIFICATION_TYPES = new Set([
  "DAILY_ROUTINE",
  "ROUTINE_SLOT",
  "STUDY_PROGRESS",
  "STREAK_SAVER",
  "CONTENT",
  "COMMUNITY",
  "CHAT",
  "FRIEND_REQUEST",
  "LIVE_CLASS",
  "STUDY_ROOM",
  "DEFAULT",
]);

type PushBody = {
  recipientIds?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  url?: unknown;
  senderId?: unknown;
  senderName?: unknown;
  senderPhoto?: unknown;
  icon?: unknown;
  broadcast?: unknown;
};

type NotificationPreferences = {
  enabled?: boolean;
  categories?: Record<string, boolean>;
  timezone?: string;
  morningRoutineTime?: string;
  streakSaverTime?: string;
  routineSlotTimes?: Record<string, string>;
};

let adminApp: App | undefined;

function getFirebaseAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return existing;
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const serviceAccount = JSON.parse(rawServiceAccount) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  adminApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });
  return adminApp;
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function cleanIds(value: unknown, max = 500): string[] {
  return Array.isArray(value)
    ? [...new Set(value
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim())
      .map((id) => id.replace(/[.#$[\]/]/g, "_"))
      .slice(0, max))]
    : [];
}

function isCategoryEnabled(preferences: NotificationPreferences | null, type: string): boolean {
  if (!preferences) return true;
  if (preferences.enabled === false) return false;
  return preferences.categories?.[type] !== false;
}

function notificationTimeInZone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}

function localDateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function tokensForRecipients(database: ReturnType<typeof getDatabase>, recipientIds: string[], type: string) {
  const tokens = new Set<string>();
  const enabledRecipients: string[] = [];
  await Promise.all(recipientIds.map(async (recipientId) => {
    const [direct, broadcast, preferencesSnapshot] = await Promise.all([
      database.ref(`users/${recipientId}/fcmToken`).get(),
      database.ref(`fcm_tokens/${recipientId}`).get(),
      database.ref(`notification_preferences/${recipientId}`).get(),
    ]);
    const preferences = (preferencesSnapshot.val() || null) as NotificationPreferences | null;
    if (!isCategoryEnabled(preferences, type)) return;
    enabledRecipients.push(recipientId);
    if (typeof direct.val() === "string" && direct.val()) tokens.add(direct.val());
    const broadcastValue = broadcast.val();
    if (typeof broadcastValue === "string" && broadcastValue) tokens.add(broadcastValue);
    if (broadcastValue && typeof broadcastValue === "object") {
      for (const device of Object.values(broadcastValue as Record<string, unknown>)) {
        if (typeof device === "string" && device) tokens.add(device);
        if (device && typeof device === "object" && typeof (device as { token?: unknown }).token === "string") {
          tokens.add((device as { token: string }).token);
        }
      }
    }
  }));
  return { tokens, enabledRecipients };
}

async function sendPush(
  app: App,
  input: {
    recipientIds: string[];
    type: string;
    title: string;
    body: string;
    url: string;
    senderId?: string;
    senderName?: string;
    senderPhoto?: string;
    icon?: string;
    broadcast?: boolean;
  },
) {
  const database = getDatabase(app);
  let recipientIds = input.recipientIds;
  if (input.broadcast) {
    const snapshot = await database.ref("fcm_tokens").get();
    recipientIds = Object.keys(snapshot.val() || {});
  }
  const { tokens } = await tokensForRecipients(database, recipientIds, input.type);
  if (!tokens.size) return { sent: 0, failed: 0, skipped: recipientIds.length, reason: "no_push_tokens" };

  let successCount = 0;
  let failureCount = 0;
  for (const batch of Array.from(tokens).reduce<string[][]>((groups, token, index) => {
    const groupIndex = Math.floor(index / 500);
    if (!groups[groupIndex]) groups[groupIndex] = [];
    groups[groupIndex].push(token);
    return groups;
  }, [])) {
    const isUrgent = input.type === "CHAT" || input.type === "FRIEND_REQUEST" || input.type === "DIRECT_MESSAGE";
    const notificationIcon = input.icon || input.senderPhoto || '/icons/icon-192.png';

    const response = await getMessaging(app).sendEachForMulticast({
      tokens: batch,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url,
        ...(input.senderId ? { senderId: input.senderId } : {}),
        ...(input.senderName ? { senderName: input.senderName } : {}),
        ...(input.senderPhoto ? { senderPhoto: input.senderPhoto } : {}),
        ...(input.icon ? { icon: input.icon } : {}),
      },
      webpush: {
        headers: {
          Urgency: isUrgent ? "high" : "normal",
          TTL: "86400",
        },
        notification: {
          title: input.title,
          body: input.body,
          icon: notificationIcon,
          badge: '/favicon.svg',
          requireInteraction: isUrgent,
          vibrate: isUrgent ? [250, 100, 250] : [100, 50, 100],
          data: {
            url: input.url,
            type: input.type,
            ...(input.senderId ? { senderId: input.senderId } : {}),
          },
        },
        fcmOptions: {
          link: input.url || '/',
        },
      },
      android: {
        priority: 'high',
        notification: {
          title: input.title,
          body: input.body,
          icon: notificationIcon,
          priority: 'max',
          sound: 'default',
          visibility: 'public',
        },
      },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
  }
  return { sent: successCount, failed: failureCount, skipped: Math.max(0, recipientIds.length - tokens.size) };
}

router.post("/notifications/push", async (req, res) => {
  const body = req.body as PushBody;
  const type = typeof body.type === "string" && NOTIFICATION_TYPES.has(body.type) ? body.type : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const message = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
  const recipientIds = cleanIds(body.recipientIds);
  const senderId = typeof body.senderId === "string" ? body.senderId.trim().slice(0, 120) : undefined;
  const senderName = typeof body.senderName === "string" ? body.senderName.trim().slice(0, 120) : undefined;
  const senderPhoto = typeof body.senderPhoto === "string" && /^https?:\/\//i.test(body.senderPhoto)
    ? body.senderPhoto.trim().slice(0, 1000)
    : undefined;
  const icon = typeof body.icon === "string" && /^https?:\/\//i.test(body.icon)
    ? body.icon.trim().slice(0, 1000)
    : undefined;
  const url = typeof body.url === "string" && body.url.startsWith("/") ? body.url.slice(0, 500) : "/";
  const broadcast = body.broadcast === true;

  if (!type || !title || !message || (!recipientIds.length && !broadcast)) {
    return res.status(400).json({ error: "type, title, body and recipientIds are required" });
  }

  try {
    const app = getFirebaseAdminApp();
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const caller = await getAuth(app).verifyIdToken(token);
    if (broadcast && type !== "STUDY_ROOM" && caller.admin !== true && caller.role !== "ADMIN" && caller.role !== "SUB_ADMIN") {
      return res.status(403).json({ error: "Only admins can broadcast notifications" });
    }
    const result = await sendPush(app, {
      recipientIds,
      type,
      title,
      body: message,
      url,
      senderId,
      senderName,
      senderPhoto,
      icon: icon || senderPhoto,
      broadcast,
    });
    req.log.info({ type, sent: result.sent, failed: result.failed }, "Notification push sent");
    return res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Notification push failed");
    return res.status(503).json({ error: "Push service is not configured or unavailable" });
  }
});

// Called by the API process once per minute. This is intentionally best-effort:
// each user's local timezone and preference record decide whether a reminder is due.
async function runScheduledPushSweep() {
  try {
    const app = getFirebaseAdminApp();
    const database = getDatabase(app);
    const snapshot = await database.ref("notification_preferences").get();
    const allPreferences = (snapshot.val() || {}) as Record<string, NotificationPreferences>;
    const now = new Date();

    for (const [userId, preferences] of Object.entries(allPreferences)) {
      if (!preferences || preferences.enabled === false) continue;
      const time = notificationTimeInZone(now, preferences.timezone || "Asia/Kolkata");
      const date = localDateKey(now, preferences.timezone || "Asia/Kolkata");
      const jobs: Array<{ key: string; type: string; time?: string; title: string; body: string }> = [
        {
          key: "morning-routine",
          type: "DAILY_ROUTINE",
          time: preferences.morningRoutineTime,
          title: "📚 Today’s Routine Ready",
          body: "Aaj ka study routine ready hai. App kholkar apna pehla target complete karein.",
        },
        {
          key: "streak-saver",
          type: "STREAK_SAVER",
          time: preferences.streakSaverTime,
          title: "🔥 Streak Saver Reminder",
          body: "Aaj ka target pending hai. Thoda study karke apna streak bachaiye.",
        },
      ];
      for (const [slotId, slotTime] of Object.entries(preferences.routineSlotTimes || {})) {
        jobs.push({
          key: `routine-slot-${slotId}`,
          type: "ROUTINE_SLOT",
          time: slotTime,
          title: "⏰ Routine Slot Reminder",
          body: `${slotId} ka study slot start ho gaya. App kholkar apna selected topic complete karein.`,
        });
      }

      for (const job of jobs) {
        if (!job.time || job.time !== time || preferences.categories?.[job.type] === false) continue;
        const runRef = database.ref(`notification_schedule_runs/${userId}/${date}/${job.key}`);
        const alreadySent = await runRef.get();
        if (alreadySent.exists()) continue;
        const result = await sendPush(app, {
          recipientIds: [userId],
          type: job.type,
          title: job.title,
          body: job.body,
          url: "/",
        });
        if (result.sent > 0 || result.skipped > 0) await runRef.set({ sentAt: new Date().toISOString(), result });
      }
    }
  } catch (error) {
    // Missing FIREBASE_SERVICE_ACCOUNT_JSON is expected in local development.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) console.warn("[Notifications] Scheduled sweep failed", error);
  }
}

const scheduler = setInterval(() => { void runScheduledPushSweep(); }, 60_000);
scheduler.unref?.();

export default router;