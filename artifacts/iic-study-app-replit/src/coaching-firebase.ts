// IIC Coaching Ecosystem — Firebase CRUD Helpers
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where
} from "firebase/firestore";
import { db } from "./firebase";
import type { CoachingCentre, CoachingUserProfile } from "./coaching-types";

const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = sanitize(v);
  }
  return out;
};

const col = (path: string) => collection(db, path);
const d = (path: string) => doc(db, path);

export const generateCoachingId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── COACHING CENTRES ─────────────────────────────────────────────────────────

export const saveCoaching = async (c: CoachingCentre) => {
  await setDoc(d(`coachings/${c.id}`), sanitize(c));
};

export const getCoaching = async (id: string): Promise<CoachingCentre | null> => {
  const snap = await getDoc(d(`coachings/${id}`));
  return snap.exists() ? (snap.data() as CoachingCentre) : null;
};

export const updateCoaching = async (id: string, data: Partial<CoachingCentre>) => {
  await updateDoc(d(`coachings/${id}`), sanitize(data));
};

export const deleteCoaching = async (id: string) => {
  await deleteDoc(d(`coachings/${id}`));
};

// Active coachings list for student picker (Firestore se, RTDB nahi)
export const getActiveCoachings = async (): Promise<{ id: string; name: string; emoji?: string }[]> => {
  const snap = await getDocs(col('coachings'));
  return snap.docs
    .map(d => d.data() as CoachingCentre)
    .filter(c => c.subscription?.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
};

export const subscribeToAllCoachings = (
  cb: (list: CoachingCentre[]) => void,
  onError?: (err: Error) => void
) =>
  onSnapshot(
    col("coachings"),
    snap => cb(snap.docs.map(d => d.data() as CoachingCentre)),
    err => {
      console.error("[coaching-firebase] subscribeToAllCoachings error:", err);
      cb([]); // unblock loading state
      onError?.(err);
    }
  );

export const subscribeToCoaching = (id: string, cb: (c: CoachingCentre | null) => void) =>
  onSnapshot(
    d(`coachings/${id}`),
    snap => cb(snap.exists() ? (snap.data() as CoachingCentre) : null),
    err => { console.error("[coaching-firebase] subscribeToCoaching error:", err); cb(null); }
  );

// ── USER PROFILES ─────────────────────────────────────────────────────────────

export const saveCoachingUserProfile = async (profile: CoachingUserProfile) => {
  await setDoc(d(`coaching_users/${profile.uid}`), sanitize(profile));
};

export const getCoachingUserProfile = async (uid: string): Promise<CoachingUserProfile | null> => {
  const snap = await getDoc(d(`coaching_users/${uid}`));
  return snap.exists() ? (snap.data() as CoachingUserProfile) : null;
};

export const deleteCoachingUserProfile = async (uid: string) => {
  await deleteDoc(d(`coaching_users/${uid}`));
};

export const subscribeToCoachingUserProfile = (uid: string, cb: (p: CoachingUserProfile | null) => void) =>
  onSnapshot(
    d(`coaching_users/${uid}`),
    snap => cb(snap.exists() ? (snap.data() as CoachingUserProfile) : null),
    err => { console.error("[coaching-firebase] subscribeToCoachingUserProfile error:", err); cb(null); }
  );

// Assign admin to coaching by email lookup is done manually by super admin
// The admin profile is created when super admin assigns them
export const assignCoachingAdmin = async (
  coachingId: string,
  adminUid: string,
  adminName: string,
  adminEmail: string,
  role: 'COACHING_ADMIN' | 'COACHING_SUB_ADMIN' = 'COACHING_ADMIN'
) => {
  const profile: CoachingUserProfile = {
    uid: adminUid,
    coachingId,
    role,
    name: adminName,
    email: adminEmail,
    createdAt: new Date().toISOString(),
  };
  await saveCoachingUserProfile(profile);
  await updateCoaching(coachingId, { adminUid, adminEmail });
};

// Email se user dhundo (jaise school mein hota hai) — UID manually nahi dena
export const assignCoachingAdminByEmail = async (
  coachingId: string,
  email: string,
  role: 'COACHING_ADMIN' | 'COACHING_SUB_ADMIN' = 'COACHING_ADMIN'
): Promise<CoachingUserProfile> => {
  const q = query(col('users'), where('email', '==', email.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error(`Koi user nahi mila email "${email}" se. Pehle woh IIC app mein register kare.`);
  }
  const userData = snap.docs[0].data();
  const uid: string = userData.id || snap.docs[0].id;
  if (!uid) throw new Error('User ka UID nahi mila.');

  const profile: CoachingUserProfile = {
    uid,
    coachingId,
    role,
    name: userData.name || userData.displayName || email,
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  await saveCoachingUserProfile(profile);
  await updateCoaching(coachingId, { adminUid: uid, adminEmail: email.trim().toLowerCase() });
  return profile;
};

export const removeCoachingUser = async (uid: string) => {
  await deleteCoachingUserProfile(uid);
};

// Get all members of a coaching
export const subscribeToCoachingMembers = (
  coachingId: string,
  cb: (members: CoachingUserProfile[]) => void
) =>
  onSnapshot(
    query(col("coaching_users"), where("coachingId", "==", coachingId)),
    snap => cb(snap.docs.map(d => d.data() as CoachingUserProfile)),
    err => { console.error("[coaching-firebase] subscribeToCoachingMembers error:", err); cb([]); }
  );
