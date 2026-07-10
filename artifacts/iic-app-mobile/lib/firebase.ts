// @ts-nocheck
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDatabase,
  ref,
  get,
  onValue,
  set,
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDyYNuSJr72nC52MinT0rt6jbDae8HLCts",
  authDomain: "project-1959318394445181665.firebaseapp.com",
  databaseURL:
    "https://project-1959318394445181665-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-1959318394445181665",
  storageBucket: "project-1959318394445181665.firebasestorage.app",
  messagingSenderId: "130030264192",
  appId: "1:130030264192:web:1b8a53d694b15c8ef1eb65",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export { onAuthStateChanged, signInAnonymously, signOut };
export type { User };

export async function getUserData(uid: string) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) return snap.data();
    return null;
  } catch {
    return null;
  }
}

export async function saveUserData(uid: string, data: Record<string, unknown>) {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, data, { merge: true });
  } catch (e) {
    console.error("saveUserData error", e);
  }
}

export async function getChapterData(
  board: string,
  classLevel: string,
  subjectId: string,
  chapterId: string
) {
  try {
    const path = `content/${board}/${classLevel}/${subjectId}/${chapterId}`;
    const snap = await get(ref(rtdb, path));
    if (snap.exists()) return snap.val();
    return null;
  } catch {
    return null;
  }
}

export async function subscribeToSettings(
  callback: (settings: Record<string, unknown>) => void
) {
  const settingsRef = ref(rtdb, "settings");
  return onValue(settingsRef, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
}
