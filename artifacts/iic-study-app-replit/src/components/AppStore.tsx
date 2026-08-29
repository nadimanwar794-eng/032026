import React, { useMemo, useState, useCallback } from "react";
import { useDebounce } from "../utils/useDebounce";
import { DownloadApp, DownloadAppStore, SystemSettings } from "../types";
import {
  Download,
  ExternalLink,
  ShoppingBag,
  HardDrive,
  Cloud,
  Smartphone,
  Search,
  PackageOpen,
  Gift,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  loadRoutineData, saveRoutineData, checkAndResetDaily,
  getUserSubTier, ensureTodayClaimEntry, claimAllPendingCoins,
  getUnclaimedCoins, getDailyClaimAmount, DAILY_CLAIM_PRO, DAILY_CLAIM_MAX_PRO,
  type UserSubTier,
} from "../utils/routineStorage";
import { saveUserToLive } from "../firebase";

function getToday() { return new Date().toISOString().split('T')[0]; }

// ── Daily Claim Card ──────────────────────────────────────────────────────────
function DailyClaimCard({ tier, unclaimed, todayClaimed, dailyAmt, onClaim }: {
  tier: UserSubTier; unclaimed: number; todayClaimed: boolean; dailyAmt: number; onClaim: () => void;
}) {
  if (tier === 'NONE') return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Gift size={15} className="text-slate-400" />
        <p className="text-sm font-black text-slate-500">Daily Coin Claim</p>
      </div>
      <p className="text-xs text-slate-400 font-medium">Pro ya Max Pro lo → roz {DAILY_CLAIM_PRO}–{DAILY_CLAIM_MAX_PRO} 🪙 pao!</p>
    </div>
  );

  const grad  = tier === 'MAX_PRO' ? 'from-violet-600 to-purple-600' : 'from-blue-600 to-indigo-600';
  const bg    = tier === 'MAX_PRO' ? 'bg-violet-50 border-violet-200' : 'bg-blue-50 border-blue-200';
  const label = tier === 'MAX_PRO' ? 'Max Pro' : 'Pro';

  return (
    <div className={`rounded-2xl border-2 p-4 mb-5 ${bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <Gift size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700">{label} Daily Reward</p>
            <p className="text-[10px] text-slate-500 font-medium">Roz {dailyAmt} 🪙 · Kabhi expire nahi</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-black text-xs border border-amber-200">
          🪙 {dailyAmt.toLocaleString()}
        </span>
      </div>
      {unclaimed > 0 ? (
        <>
          {unclaimed > dailyAmt && (
            <div className="bg-amber-100 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
              <AlertCircle size={12} className="text-amber-600 shrink-0" />
              <p className="text-[10px] font-black text-amber-700">
                {Math.floor(unclaimed / dailyAmt)} din ka stack = {unclaimed} 🪙!
              </p>
            </div>
          )}
          <button onClick={onClaim} className={`w-full py-3 rounded-xl bg-gradient-to-r ${grad} text-white font-black text-sm active:scale-[0.98] transition shadow-md flex items-center justify-center gap-2`}>
            <Gift size={16} /> Claim {unclaimed} 🪙 Karo
          </button>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-100 rounded-xl border border-emerald-200">
          <Check size={14} className="text-emerald-600" />
          <span className="text-xs font-black text-emerald-700">Aaj ka reward claim ho gaya! ✅</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  settings: SystemSettings | null;
  user?: {
    id?: string;
    isPremium?: boolean;
    subscriptionLevel?: string;
    subscriptionEndDate?: string;
    credits?: number;
    bonusCredits?: number;
  } | null;
  onUserUpdate?: (u: any) => void;
}

const STORE_META: Record<
  DownloadAppStore,
  { label: string; color: string; gradient: string; Icon: any }
> = {
  PLAY_STORE: {
    label: "Play Store",
    color: "bg-green-100 text-green-700 border-green-200",
    gradient: "from-green-500 to-emerald-600",
    Icon: Smartphone,
  },
  APP_STORE: {
    label: "App Store",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    gradient: "from-blue-500 to-sky-600",
    Icon: ShoppingBag,
  },
  GOOGLE_DRIVE: {
    label: "Google Drive",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    gradient: "from-amber-500 to-yellow-600",
    Icon: Cloud,
  },
  MEDIAFIRE: {
    label: "MediaFire",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    gradient: "from-orange-500 to-red-500",
    Icon: HardDrive,
  },
  OTHER: {
    label: "Direct Link",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    gradient: "from-slate-500 to-slate-700",
    Icon: ExternalLink,
  },
};

const detectStore = (url: string): DownloadAppStore => {
  const u = (url || "").toLowerCase();
  if (u.includes("play.google.com")) return "PLAY_STORE";
  if (u.includes("apps.apple.com") || u.includes("itunes.apple.com"))
    return "APP_STORE";
  if (u.includes("drive.google.com")) return "GOOGLE_DRIVE";
  if (u.includes("mediafire.com")) return "MEDIAFIRE";
  return "OTHER";
};

export const AppStore: React.FC<Props> = ({ settings, user, onUserUpdate }) => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // ── Subscription daily coin claim ──────────────────────────────────────────
  const userId = user?.id || 'guest';
  const subTier: UserSubTier = getUserSubTier(user ?? {});
  const [routineData, setRoutineDataRaw] = useState(() => {
    const d = loadRoutineData(userId);
    const reset = checkAndResetDaily(d);
    return ensureTodayClaimEntry(reset, getUserSubTier(user ?? {}));
  });
  const setRoutineData = useCallback((updater: (prev: typeof routineData) => typeof routineData) => {
    setRoutineDataRaw(prev => {
      const next = updater(prev);
      saveRoutineData(userId, next);
      return next;
    });
  }, [userId]);
  const unclaimedCoins = getUnclaimedCoins(routineData, subTier);
  const todayClaimed = routineData.dailyClaims?.[getToday()]?.claimed ?? false;
  const dailyAmount = getDailyClaimAmount(subTier);
  const handleClaim = () => {
    const { data: updated, earned } = claimAllPendingCoins(routineData, subTier);
    setRoutineDataRaw(updated);
    saveRoutineData(userId, updated);
    // Add earned coins to main app credits
    if (earned > 0 && onUserUpdate && user) {
      const updatedUser = { ...user, credits: (user.credits || 0) + earned };
      onUserUpdate(updatedUser);
      try { saveUserToLive(updatedUser); } catch (_) {}
    }
  };

  const apps: DownloadApp[] = useMemo(
    () => settings?.downloadApps || [],
    [settings?.downloadApps],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    );
  }, [apps, debouncedSearch]);

  const handleDownload = (app: DownloadApp) => {
    const url = (app.downloadUrl || "").trim();
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback for restricted environments
      window.location.href = url;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-6">
      {/* HEADER */}
      <div className="rounded-3xl p-6 mb-5 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <ShoppingBag size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">App Store</h2>
            <p className="text-xs text-white/80 font-medium">
              Download apps recommended by your admin
            </p>
          </div>
        </div>
      </div>

      {/* DAILY COIN CLAIM */}
      <DailyClaimCard
        tier={subTier}
        unclaimed={unclaimedCoins}
        todayClaimed={todayClaimed}
        dailyAmt={dailyAmount}
        onClaim={handleClaim}
      />

      {/* SEARCH */}
      {apps.length > 0 && (
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
          />
        </div>
      )}

      {/* EMPTY STATE */}
      {apps.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <PackageOpen size={36} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">
            No apps yet
          </h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Your admin hasn't added any downloadable apps. Check back soon!
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">
            No apps match "{search}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((app) => {
            const storeKey: DownloadAppStore =
              app.store || detectStore(app.downloadUrl);
            const meta = STORE_META[storeKey] || STORE_META.OTHER;
            const StoreIcon = meta.Icon;
            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 ring-1 ring-slate-200">
                    {app.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={app.iconUrl}
                        alt={app.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <ShoppingBag size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-base leading-tight truncate">
                      {app.name || "Untitled App"}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}
                      >
                        <StoreIcon size={10} />
                        {meta.label}
                      </span>
                      {app.version && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          v{app.version}
                        </span>
                      )}
                      {app.size && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {app.size}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {app.description && (
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-3">
                    {app.description}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(app)}
                  disabled={!app.downloadUrl}
                  className={`mt-auto w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 bg-gradient-to-r ${meta.gradient} ${
                    !app.downloadUrl
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:brightness-110"
                  }`}
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTNOTE */}
      {apps.length > 0 && (
        <p className="text-center text-[11px] text-slate-400 mt-5">
          Tap Download to open the link in your browser.
        </p>
      )}
    </div>
  );
};

export default AppStore;
