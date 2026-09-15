import { LucentNoteEntry } from "../types";

export interface ContentNotifItem {
  id: string;
  entryId: string;
  pageIndex: number;
  bookName: string;
  lessonTitle: string;
  pageNo: string;
  date: string;
  classLevel: string;
  subject: string;
  requiredTier: "FREE" | "BASIC" | "ULTRA";
}

const SEEN_KEY = (uid: string) => `nst_cnew_seen_${uid}`;
const DEFAULT_DAYS = 7;

function getSeenIds(uid: string): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || "[]"); } catch { return []; }
}

export function getNewContentItems(
  lucentNotes: LucentNoteEntry[],
  uid: string,
  windowDays = DEFAULT_DAYS
): ContentNotifItem[] {
  const seen = getSeenIds(uid);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);

  const items: ContentNotifItem[] = [];

  for (const entry of lucentNotes) {
    if (!entry.pages?.length) continue;
    for (let i = 0; i < entry.pages.length; i++) {
      const page = entry.pages[i];
      if (!page.date) continue;
      const d = new Date(page.date);
      if (isNaN(d.getTime()) || d < cutoff) continue;
      const id = `${entry.id}_pg${i}`;
      if (seen.includes(id)) continue;

      const isComp = entry.classLevel === "COMPETITION" || !entry.classLevel;
      items.push({
        id,
        entryId: entry.id,
        pageIndex: i,
        bookName: entry.bookName || "Lucent",
        lessonTitle: entry.lessonTitle || "Chapter",
        pageNo: page.pageNo || String(i + 1),
        date: page.date,
        classLevel: entry.classLevel || "COMPETITION",
        subject: entry.subject || "",
        requiredTier: isComp ? "ULTRA" : "FREE",
      });
    }
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function markContentItemSeen(uid: string, id: string) {
  const key = SEEN_KEY(uid);
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    if (!arr.includes(id)) {
      arr.push(id);
      localStorage.setItem(key, JSON.stringify(arr.slice(-300)));
    }
  } catch {}
}

export function markAllContentItemsSeen(uid: string, ids: string[]) {
  const key = SEEN_KEY(uid);
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    const merged = Array.from(new Set([...arr, ...ids]));
    localStorage.setItem(key, JSON.stringify(merged.slice(-300)));
  } catch {}
}

export function formatContentDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Aaj";
    if (d.toDateString() === yesterday.toDateString()) return "Kal";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return dateStr; }
}
