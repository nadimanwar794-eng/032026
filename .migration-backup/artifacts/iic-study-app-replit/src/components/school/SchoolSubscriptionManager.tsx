// @ts-nocheck
import React, { useState, useEffect, useCallback } from "react";
import {
  Crown, Gift, Plus, Copy, Check, AlertCircle, CheckCircle,
  IndianRupee, Settings, Users, RefreshCw, Zap, X, ChevronDown,
  Loader2, Key, Star, Clock
} from "lucide-react";
import { ref, get, set } from "firebase/database";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { rtdb, db, saveUserToLive } from "../../firebase";
import { addSubscription, recalculateSubscriptionStatus } from "../../utils/subscriptionUtils";
import type { School } from "../../school-types";

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface IicSubConfig {
  weeklyPrice: number;
  monthlyPrice: number;
  threeMonthPrice: number;
  yearlyPrice: number;
  lifetimePrice: number;
  defaultLevel: "BASIC" | "ULTRA";
  enabled: boolean;
}

const DEFAULT_CONFIG: IicSubConfig = {
  weeklyPrice: 49,
  monthlyPrice: 149,
  threeMonthPrice: 399,
  yearlyPrice: 999,
  lifetimePrice: 2499,
  defaultLevel: "BASIC",
  enabled: true,
};

const PLAN_LABELS: Record<string, string> = {
  WEEKLY: "Weekly (7 days)",
  MONTHLY: "Monthly (30 days)",
  "3_MONTHLY": "3 Months (90 days)",
  YEARLY: "Yearly (365 days)",
  LIFETIME: "Lifetime",
};

const PLAN_DAYS: Record<string, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  "3_MONTHLY": 90,
  YEARLY: 365,
  LIFETIME: 365 * 10,
};

interface GrantLog {
  uid: string;
  name?: string;
  plan: string;
  level: string;
  price: number;
  grantedAt: string;
}

interface Props {
  schoolId: string;
  adminUid: string;
  school: School | null;
  onBack: () => void;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

const generateCode = (schoolCode: string): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 8; i++) random += chars[Math.floor(Math.random() * chars.length)];
  const code = schoolCode ? `SA${schoolCode.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4)}-${random}` : `SADC-${random}`;
  return code;
};

const getPriceForPlan = (plan: string, config: IicSubConfig): number => {
  if (plan === "WEEKLY") return config.weeklyPrice;
  if (plan === "MONTHLY") return config.monthlyPrice;
  if (plan === "3_MONTHLY") return config.threeMonthPrice;
  if (plan === "YEARLY") return config.yearlyPrice;
  if (plan === "LIFETIME") return config.lifetimePrice;
  return 0;
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export const SchoolSubscriptionManager: React.FC<Props> = ({ schoolId, adminUid, school, onBack }) => {
  const [tab, setTab] = useState<"grant" | "codes" | "config" | "my">("my");

  // Config
  const [config, setConfig] = useState<IicSubConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Admin's own subscription
  const [adminUser, setAdminUser] = useState<any>(null);
  const [adminSubLoading, setAdminSubLoading] = useState(true);
  const [autoGranting, setAutoGranting] = useState(false);
  const [autoGrantDone, setAutoGrantDone] = useState(false);

  // Grant form
  const [grantUid, setGrantUid] = useState("");
  const [grantPlan, setGrantPlan] = useState("MONTHLY");
  const [grantLevel, setGrantLevel] = useState<"BASIC" | "ULTRA">("BASIC");
  const [grantNote, setGrantNote] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [grantLogs, setGrantLogs] = useState<GrantLog[]>([]);

  // Redeem codes
  const [codeConfig, setCodeConfig] = useState({ plan: "MONTHLY", level: "BASIC", maxUses: 1 });
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeHistory, setCodeHistory] = useState<Array<{ code: string; plan: string; level: string; createdAt: string; maxUses: number }>>([]);

  // ── Load config + admin subscription ────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "schools", schoolId));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.iicSubConfig) setConfig({ ...DEFAULT_CONFIG, ...data.iicSubConfig });
        if (data?.iicSubGrantLogs) setGrantLogs(data.iicSubGrantLogs.slice(0, 20));
        if (data?.iicSubCodeHistory) setCodeHistory(data.iicSubCodeHistory.slice(0, 20));
      }
    } catch (e) { console.error(e); }
  }, [schoolId]);

  const loadAdminUser = useCallback(async () => {
    setAdminSubLoading(true);
    try {
      const snap = await get(ref(rtdb, `users/${adminUid}`));
      if (snap.exists()) {
        const u = snap.val();
        const recalc = recalculateSubscriptionStatus(u);
        setAdminUser(recalc);
      }
    } catch (e) { console.error(e); }
    setAdminSubLoading(false);
  }, [adminUid]);

  useEffect(() => {
    loadConfig();
    loadAdminUser();
  }, [loadConfig, loadAdminUser]);

  // ── Auto-grant ULTRA to school admin if no active subscription ───────────────

  const autoGrantAdminSub = async () => {
    if (!adminUser || adminUser.isPremium) return;
    setAutoGranting(true);
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const newSub = {
        id: `school_admin_grant_${Date.now()}`,
        tier: "YEARLY",
        level: "ULTRA",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        source: "ADMIN",
        grantSource: "SCHOOL_ADMIN_AUTO",
        grantedBy: "system",
        isFree: true,
      };
      const updated = addSubscription(adminUser, newSub);
      await saveUserToLive(updated);
      setAdminUser(updated);
      setAutoGrantDone(true);
    } catch (e) {
      console.error("Auto-grant failed:", e);
    }
    setAutoGranting(false);
  };

  // ── Save config ─────────────────────────────────────────────────────────────

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "schools", schoolId), { iicSubConfig: config }, { merge: true });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSavingConfig(false);
  };

  // ── Grant subscription to student ────────────────────────────────────────────

  const handleGrant = async () => {
    const uid = grantUid.trim();
    if (!uid) { setGrantResult({ ok: false, msg: "UID daalo pehle" }); return; }
    setGranting(true);
    setGrantResult(null);
    try {
      const snap = await get(ref(rtdb, `users/${uid}`));
      if (!snap.exists()) {
        setGrantResult({ ok: false, msg: "User nahi mila is UID se. Sahi IIC UID check karo." });
        setGranting(false);
        return;
      }
      const user = snap.val();
      const now = new Date();
      const days = PLAN_DAYS[grantPlan] ?? 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const newSub = {
        id: `sa_grant_${Date.now()}`,
        tier: grantPlan,
        level: grantLevel,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        source: "ADMIN",
        grantSource: "SCHOOL_ADMIN",
        grantedBy: adminUid,
        schoolId,
        isFree: false,
        price: getPriceForPlan(grantPlan, config),
        note: grantNote || undefined,
      };
      const updated = addSubscription(user, newSub);
      await saveUserToLive(updated);

      // Log to school doc
      const logEntry: GrantLog = {
        uid,
        name: user.name || user.displayName || "Unknown",
        plan: grantPlan,
        level: grantLevel,
        price: getPriceForPlan(grantPlan, config),
        grantedAt: now.toISOString(),
      };
      const newLogs = [logEntry, ...grantLogs].slice(0, 20);
      setGrantLogs(newLogs);
      await setDoc(doc(db, "schools", schoolId), { iicSubGrantLogs: newLogs }, { merge: true });

      setGrantResult({
        ok: true,
        msg: `✅ ${user.name || uid} ko ${PLAN_LABELS[grantPlan]} ${grantLevel} subscription de di!`,
      });
      setGrantUid("");
      setGrantNote("");
    } catch (e: any) {
      setGrantResult({ ok: false, msg: "Error: " + (e?.message || "kuch galat hua") });
    }
    setGranting(false);
  };

  // ── Generate redeem code ─────────────────────────────────────────────────────

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    setGeneratedCode(null);
    try {
      const code = generateCode(school?.code || "SCHOOL");
      const now = new Date();
      const days = PLAN_DAYS[codeConfig.plan] ?? 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const codeData = {
        code,
        type: "SUBSCRIPTION",
        subTier: codeConfig.plan,
        subLevel: codeConfig.level,
        subEndDate: endDate.toISOString(),
        createdAt: now.toISOString(),
        isRedeemed: false,
        maxUses: Number(codeConfig.maxUses) || 1,
        usedCount: 0,
        redeemedBy: [],
        generatedBy: "SCHOOL_ADMIN",
        schoolId,
        adminUid,
        price: getPriceForPlan(codeConfig.plan, config),
      };

      // Save to RTDB
      await set(ref(rtdb, `redeem_codes/${code}`), codeData);
      // Save to Firestore
      try { await setDoc(doc(db, "redeem_codes", code), codeData); } catch (_) {}

      // Log in school doc
      const histEntry = { code, plan: codeConfig.plan, level: codeConfig.level, createdAt: now.toISOString(), maxUses: Number(codeConfig.maxUses) };
      const newHistory = [histEntry, ...codeHistory].slice(0, 20);
      setCodeHistory(newHistory);
      await setDoc(doc(db, "schools", schoolId), { iicSubCodeHistory: newHistory }, { merge: true });

      setGeneratedCode(code);
    } catch (e: any) {
      alert("Code generate karne mein error: " + e?.message);
    }
    setGeneratingCode(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Subscription Status Helper ───────────────────────────────────────────────

  const adminSubExpiry = adminUser?.subscriptionEndDate
    ? new Date(adminUser.subscriptionEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const adminIsActive = adminUser?.isPremium;
  const adminLevel = adminUser?.subscriptionLevel;
  const adminTier = adminUser?.subscriptionTier;

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h1 className="font-bold text-slate-800 dark:text-white text-base">IIC Subscription</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex overflow-x-auto">
        {[
          { id: "my", label: "My Sub", icon: <Star className="w-3.5 h-3.5" /> },
          { id: "grant", label: "Grant", icon: <Users className="w-3.5 h-3.5" /> },
          { id: "codes", label: "Redeem Codes", icon: <Key className="w-3.5 h-3.5" /> },
          { id: "config", label: "Price Config", icon: <Settings className="w-3.5 h-3.5" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-4">

        {/* ── MY SUBSCRIPTION TAB ── */}
        {tab === "my" && (
          <div className="space-y-4">
            <div className={`rounded-2xl p-5 shadow-sm ${
              adminIsActive
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            }`}>
              {adminSubLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : adminIsActive ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-6 h-6" />
                    <span className="text-lg font-bold">
                      {adminLevel === "ULTRA" ? "MAX (ULTRA)" : "PRO (BASIC)"} Active
                    </span>
                  </div>
                  <p className="text-white/80 text-sm">{adminTier} Plan</p>
                  {adminSubExpiry && (
                    <p className="text-white/70 text-xs mt-1">Expires: {adminSubExpiry}</p>
                  )}
                  <div className="mt-3 bg-white/20 rounded-xl px-3 py-2">
                    <p className="text-xs text-white/80">School Admin hone ki wajah se aapko ULTRA access milta hai.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-slate-800 dark:text-white">No IIC Subscription</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    School Admin ke roop mein aapko FREE mein ULTRA subscription milti hai.
                  </p>
                  <button
                    onClick={autoGrantAdminSub}
                    disabled={autoGranting || autoGrantDone}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                  >
                    {autoGranting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Granting...</>
                    ) : autoGrantDone ? (
                      <><CheckCircle className="w-4 h-4" /> Done! Refresh karo</>
                    ) : (
                      <><Crown className="w-4 h-4" /> Apni ULTRA Subscription Activate Karo</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
                <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{grantLogs.length}</p>
                <p className="text-xs text-slate-400">Subs Granted</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
                <Key className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{codeHistory.length}</p>
                <p className="text-xs text-slate-400">Codes Generated</p>
              </div>
            </div>

            {/* Recent grants */}
            {grantLogs.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Grants</p>
                </div>
                <div className="divide-y dark:divide-slate-700">
                  {grantLogs.slice(0, 5).map((log, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-white">{log.name || log.uid.slice(0, 10) + "..."}</p>
                        <p className="text-xs text-slate-400">{PLAN_LABELS[log.plan]} · {log.level}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600">₹{log.price}</p>
                        <p className="text-xs text-slate-400">{new Date(log.grantedAt).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GRANT SUBSCRIPTION TAB ── */}
        {tab === "grant" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-slate-800 dark:text-white">Student ko Subscription Do</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Student IIC UID</label>
                  <input
                    value={grantUid}
                    onChange={e => setGrantUid(e.target.value)}
                    placeholder="IIC App ka UID paste karo..."
                    className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">Student ka IIC profile → Settings mein UID milega</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Plan</label>
                  <select
                    value={grantPlan}
                    onChange={e => setGrantPlan(e.target.value)}
                    className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {Object.entries(PLAN_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label} — ₹{getPriceForPlan(key, config)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["BASIC", "ULTRA"] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setGrantLevel(lvl)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          grantLevel === lvl
                            ? lvl === "ULTRA"
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                              : "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {lvl === "ULTRA" ? "⭐ MAX (ULTRA)" : "✨ PRO (BASIC)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Note (optional)</label>
                  <input
                    value={grantNote}
                    onChange={e => setGrantNote(e.target.value)}
                    placeholder="e.g. Cash payment received"
                    className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Price summary */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{PLAN_LABELS[grantPlan]} · {grantLevel}</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    ₹{getPriceForPlan(grantPlan, config)}
                  </span>
                </div>

                <button
                  onClick={handleGrant}
                  disabled={granting || !grantUid.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {granting ? <><Loader2 className="w-4 h-4 animate-spin" /> Granting...</> : <><Zap className="w-4 h-4" /> Subscription Grant Karo</>}
                </button>

                {grantResult && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                    grantResult.ok
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  }`}>
                    {grantResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {grantResult.msg}
                  </div>
                )}
              </div>
            </div>

            {/* Grant history */}
            {grantLogs.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Grant History</p>
                </div>
                <div className="divide-y dark:divide-slate-700">
                  {grantLogs.map((log, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-white">{log.name || "Student"}</p>
                        <p className="text-xs text-slate-400 font-mono">{log.uid.slice(0, 16)}...</p>
                        <p className="text-xs text-slate-400">{PLAN_LABELS[log.plan]} · {log.level}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">₹{log.price}</p>
                        <p className="text-xs text-slate-400">{new Date(log.grantedAt).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REDEEM CODES TAB ── */}
        {tab === "codes" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-500" />
                <h2 className="font-semibold text-slate-800 dark:text-white">Redeem Code Banao</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Plan</label>
                  <select
                    value={codeConfig.plan}
                    onChange={e => setCodeConfig(p => ({ ...p, plan: e.target.value }))}
                    className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                  >
                    {Object.entries(PLAN_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["BASIC", "ULTRA"].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setCodeConfig(p => ({ ...p, level: lvl }))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          codeConfig.level === lvl
                            ? lvl === "ULTRA"
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                              : "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {lvl === "ULTRA" ? "⭐ MAX (ULTRA)" : "✨ PRO (BASIC)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Max Uses</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={codeConfig.maxUses}
                    onChange={e => setCodeConfig(p => ({ ...p, maxUses: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">Kitne students is code se redeem kar sakte hain</p>
                </div>

                <button
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {generatingCode ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Gift className="w-4 h-4" /> Code Generate Karo</>}
                </button>

                {generatedCode && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-2">Generated Code:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-lg font-bold font-mono text-purple-800 dark:text-purple-200 tracking-widest">
                        {generatedCode}
                      </code>
                      <button
                        onClick={() => copyCode(generatedCode)}
                        className="p-2 bg-purple-100 dark:bg-purple-800/50 hover:bg-purple-200 dark:hover:bg-purple-700/50 rounded-lg transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-purple-600 dark:text-purple-300" />}
                      </button>
                    </div>
                    <p className="text-xs text-purple-500 dark:text-purple-400 mt-2">
                      {PLAN_LABELS[codeConfig.plan]} · {codeConfig.level} · Max {codeConfig.maxUses} uses
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Code history */}
            {codeHistory.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Codes</p>
                </div>
                <div className="divide-y dark:divide-slate-700">
                  {codeHistory.map((item, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-800 dark:text-white truncate">{item.code}</p>
                        <p className="text-xs text-slate-400">{PLAN_LABELS[item.plan]} · {item.level} · {item.maxUses} uses</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString("en-IN")}</p>
                        <button onClick={() => copyCode(item.code)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRICE CONFIG TAB ── */}
        {tab === "config" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" />
                <h2 className="font-semibold text-slate-800 dark:text-white">Subscription Price Config</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ye prices tab dikhenge jab aap students ko subscription grant karo ya redeem codes banao.</p>

              <div className="space-y-3">
                {[
                  { key: "weeklyPrice", label: "Weekly (7 days)" },
                  { key: "monthlyPrice", label: "Monthly (30 days)" },
                  { key: "threeMonthPrice", label: "3 Months (90 days)" },
                  { key: "yearlyPrice", label: "Yearly (365 days)" },
                  { key: "lifetimePrice", label: "Lifetime" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm text-slate-600 dark:text-slate-300 flex-1">{label}</label>
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl px-3 py-2">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        value={(config as any)[key]}
                        onChange={e => setConfig(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-20 bg-transparent text-slate-800 dark:text-white text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-2 border-t dark:border-slate-700">
                  <label className="text-sm text-slate-600 dark:text-slate-300 flex-1">Default Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["BASIC", "ULTRA"] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setConfig(prev => ({ ...prev, defaultLevel: lvl }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          config.defaultLevel === lvl
                            ? lvl === "ULTRA"
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700"
                              : "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700"
                            : "border-slate-200 dark:border-slate-600 text-slate-500"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="w-full py-3 bg-slate-800 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-white text-white dark:text-slate-800 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
                >
                  {savingConfig ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : configSaved ? (
                    <><CheckCircle className="w-4 h-4 text-green-500" /> Saved!</>
                  ) : (
                    <><Check className="w-4 h-4" /> Save Config</>
                  )}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Price Preview</p>
              <div className="space-y-2">
                {Object.entries(PLAN_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                    <span className="text-sm font-bold text-green-600">₹{getPriceForPlan(key, config)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
