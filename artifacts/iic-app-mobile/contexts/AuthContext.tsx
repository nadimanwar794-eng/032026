// @ts-nocheck
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  getUserData,
  onAuthStateChanged,
  saveUserData,
  signInAnonymously,
  type User,
} from "@/lib/firebase";

export type Board = "BSEB" | "NCERT_EN" | "NCERT_HI" | "COMPETITION";
export type ClassLevel =
  | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "COMPETITION";
export type Stream = "Science" | "Commerce" | "Arts";

export interface AppUser {
  id: string;
  name?: string;
  role?: string;
  board?: Board;
  classLevel?: ClassLevel;
  stream?: Stream;
  selectedSubjectIds?: string[];
  isPremium?: boolean;
  credits?: number;
  streak?: number;
  profileCompleted?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: User | null;
  loading: boolean;
  signInAnon: () => Promise<void>;
  updateProfile: (data: Partial<AppUser>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  signInAnon: async () => {},
  updateProfile: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const data = await getUserData(fbUser.uid);
        if (data) {
          setUser({ id: fbUser.uid, ...data } as AppUser);
        } else {
          // Try local cache
          try {
            const cached = await AsyncStorage.getItem("iic_user_profile");
            if (cached) {
              setUser({ id: fbUser.uid, ...JSON.parse(cached) } as AppUser);
            } else {
              setUser({ id: fbUser.uid } as AppUser);
            }
          } catch {
            setUser({ id: fbUser.uid } as AppUser);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInAnon = async () => {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("signInAnon error", e);
    }
  };

  const updateProfile = async (data: Partial<AppUser>) => {
    if (!firebaseUser) return;
    const updated = { ...user, ...data, id: firebaseUser.uid } as AppUser;
    setUser(updated);
    try {
      await AsyncStorage.setItem(
        "iic_user_profile",
        JSON.stringify({ ...data })
      );
      await saveUserData(firebaseUser.uid, data as Record<string, unknown>);
    } catch (e) {
      console.error("updateProfile error", e);
    }
  };

  const logout = async () => {
    try {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
      await AsyncStorage.removeItem("iic_user_profile");
      setUser(null);
    } catch (e) {
      console.error("logout error", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, firebaseUser, loading, signInAnon, updateProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
