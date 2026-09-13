// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  subscribeToAllSchools, saveSchool, updateSchool, generateId, setSchoolLockCode,
  assignSchoolAdminByEmail, lockSchool, deleteSchool
} from "../../school-firebase";
import type { School, SchoolSubscription } from "../../school-types";
import {
  School as SchoolIcon, Plus, Pause, Play,
  Users, IndianRupee, Settings, X, Zap, Tag, Lock, Eye, EyeOff, Shield, Trash2, Unlock, ArrowLeft,
  CreditCard, CheckCircle, AlertCircle, Clock, ChevronRight, FileText, StickyNote, Calendar
} from "lucide-react";

interface Props {
  adminUid: string;
  onBack?: () => void;
}

// ── PRICING CONFIG ────────────────────────────────────────────────────────────
const FEATURE_PRICES = { reading: 2000, writing: 1000, pdf: 1000, mcq: 1000 };
const COMBO_PRICE = 4500;       // all-4 combo offer (Pro Plan)
const COMBO_RETAIL = 5000;      // sum of individual prices
const COMBO_SAVING = COMBO_RETAIL - COMBO_PRICE; // ₹500
const LITE_PRICE = 1500;        // Lite plan — student management only

const isCombo = (s: SchoolSubscription) =>
  s.reading && s.writing && s.pdf && s.mcq;

const calcAmount = (s: SchoolSubscription): number => {
  if (s.tier === "lite") return LITE_PRICE;
  if (isCombo(s)) return COMBO_PRICE;
  let total = 0;
  if (s.reading) total += FEATURE_PRICES.reading;
  if (s.writing) total += FEATURE_PRICES.writing;
  if (s.pdf)     total += FEATURE_PRICES.pdf;
  if (s.mcq)     total += FEATURE_PRICES.mcq;
  return total;
};

const COMBO_SUB: SchoolSubscription = {
  reading: true, writing: true, pdf: true, mcq: true,
  monthlyAmount: COMBO_PRICE, status: "active", tier: "full"
};

const defaultSub: SchoolSubscription = {
  reading: true, writing: false, pdf: false, mcq: false,
  monthlyAmount: 2000, status: "active", tier: "full"
};

// ── REUSABLE SUBSCRIPTION EDITOR ─────────────────────────────────────────────
const SubEditor = ({
  value,
  onChange,
  label = "Subscription Features",
}: {
  value: SchoolSubscription;
  onChange: (s: SchoolSubscription) => void;
  label?: string;
}) => {
  const tier = value.tier ?? "full";
  const isLite = tier === "lite";
  const combo = !isLite && isCombo(value);
  const amount = isLite ? LITE_PRICE : calcAmount(value);

  const applyCombo = () => onChange({ ...value, reading: true, writing: true, pdf: true, mcq: true, tier: "full" });
  const toggle = (key: keyof typeof FEATURE_PRICES) =>
    onChange({ ...value, [key]: !value[key], tier: "full" });
  const switchToLite = () => onChange({
    ...value, reading: false, writing: false, pdf: false, mcq: false,
    monthlyAmount: LITE_PRICE, tier: "lite"
  });
  const switchToFull = () => onChange({ ...value, tier: "full" });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{label}</h3>
        {combo && !isLite && (
          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold">
            <Zap className="w-3 h-3" /> COMBO
          </span>
        )}
      </div>

      {/* Tier selector */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        <button
          onClick={switchToLite}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isLite ? "bg-blue-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
        >
          📦 Lite — ₹{LITE_PRICE.toLocaleString()}
        </button>
        <button
          onClick={switchToFull}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isLite ? "bg-amber-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}
        >
          ⭐ Pro — ₹{COMBO_PRICE.toLocaleString()}+
        </button>
      </div>

      {isLite ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-bold">Lite Plan — ₹{LITE_PRICE.toLocaleString()}/month</p>
          <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">✅ Student data management only (No content editing)</p>
        </div>
      ) : (
        <>
          {/* Combo CTA */}
          {!combo && (
            <button
              onClick={applyCombo}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <div className="text-left">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Apply Combo Offer</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">All 4 features — Save ₹{COMBO_SAVING}/month</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-black text-amber-700 dark:text-amber-300">₹{COMBO_PRICE}</p>
                <p className="text-xs line-through text-amber-500">₹{COMBO_RETAIL}</p>
              </div>
            </button>
          )}

          {/* Combo active banner */}
          {combo && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Combo Offer Active</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">All features • Saving ₹{COMBO_SAVING}/month</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">₹{COMBO_PRICE}</p>
                <p className="text-xs line-through text-slate-400">₹{COMBO_RETAIL}</p>
              </div>
            </div>
          )}

          {/* Individual toggles */}
          <div className="space-y-1 pt-1">
            {([ 
              ["reading", "📖 Reading Mode"],
              ["writing", "✏️ Writing Mode"],
              ["pdf",     "📄 PDF System"],
              ["mcq",     "❓ MCQ System"],
            ] as const).map(([key, featureLabel]) => (
              <label key={key} className="flex items-center justify-between gap-3 cursor-pointer py-2 border-b dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value[key]}
                    onChange={() => toggle(key)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{featureLabel}</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {combo ? (
                    <span className="text-amber-500 font-bold">Combo</span>
                  ) : (
                    `₹${FEATURE_PRICES[key]}/mo`
                  )}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Total row */}
      <div className="pt-2 border-t dark:border-slate-700 flex items-center justify-between">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Total Monthly</span>
        <div className="text-right">
          {combo && <p className="text-xs line-through text-slate-400">₹{COMBO_RETAIL}</p>}
          <p className={`text-xl font-black ${isLite ? "text-blue-600" : combo ? "text-amber-600" : "text-blue-600"}`}>
            ₹{amount.toLocaleString()}
          </p>
          {combo && (
            <p className="text-xs text-green-600 font-medium">You save ₹{COMBO_SAVING}!</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── PLAN ASSIGNER COMPONENT ───────────────────────────────────────────────────
type PlanTier = "lite" | "pro";
type PlanDur  = "weekly" | "monthly" | "3months" | "yearly";

const PLAN_PRICES: Record<PlanTier, Record<PlanDur, number>> = {
  lite: { weekly: 500,  monthly: 1500, "3months": 4000,  yearly: 14000 },
  pro:  { weekly: 1200, monthly: 4500, "3months": 12000, yearly: 45000 },
};
const PLAN_SAVINGS: Record<PlanTier, Record<PlanDur, number>> = {
  lite: { weekly: 0, monthly: 0, "3months": 500,  yearly: 4000 },
  pro:  { weekly: 0, monthly: 0, "3months": 1500, yearly: 9000 },
};
const DURATION_DAYS: Record<PlanDur, number> = {
  weekly: 7, monthly: 30, "3months": 90, yearly: 365,
};
const DURATION_LABEL: Record<PlanDur, string> = {
  weekly: "Weekly", monthly: "Monthly", "3months": "3 Months", yearly: "Yearly",
};

const PlanAssigner: React.FC<{
  school: School;
  onAssigned: (updatedSub: SchoolSubscription) => void;
}> = ({ school, onAssigned }) => {
  const [tier, setTier]       = useState<PlanTier>("pro");
  const [duration, setDur]    = useState<PlanDur>("monthly");
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  const price   = PLAN_PRICES[tier][duration];
  const saving_ = PLAN_SAVINGS[tier][duration];

  const computeExpiry = (dur: PlanDur): string => {
    const d = new Date();
    d.setDate(d.getDate() + DURATION_DAYS[dur]);
    return d.toISOString().split("T")[0];
  };

  const handleAssign = async () => {
    setSaving(true);
    setSuccess(false);
    const expiresAt = computeExpiry(duration);
    const newSub: SchoolSubscription = {
      ...school.subscription,
      tier:          tier === "pro" ? "full" : "lite",
      status:        "active",
      expiresAt,
      paidUntil:     expiresAt,
      reading:       tier === "pro",
      writing:       tier === "pro",
      pdf:           tier === "pro",
      mcq:           tier === "pro",
      monthlyAmount: price,
      planDuration:  duration,
      assignedAt:    new Date().toISOString(),
      lastPaidDate:  new Date().toISOString(),
      lastPaidAmount: price,
    };
    await updateSchool(school.id, { subscription: newSub });
    onAssigned(newSub);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Plan Assign Karo</h3>
        {school.subscription.expiresAt && (
          <span className="ml-auto text-[10px] text-slate-400">
            Expires: {new Date(school.subscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Tier selector */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        {(["lite", "pro"] as PlanTier[]).map(t => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              tier === t
                ? t === "lite"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-amber-500 text-white shadow"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t === "lite" ? "📦 Lite" : "⭐ Pro"}
          </button>
        ))}
      </div>

      {/* Plan description */}
      <div className={`rounded-lg px-3 py-2 text-xs ${tier === "pro" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"}`}>
        {tier === "pro"
          ? "✅ Sab features: Student data + Reading, Writing, PDF, MCQ"
          : "✅ Student data only: Attendance, Fees, Marks, Teachers — No content"}
      </div>

      {/* Duration selector */}
      <div className="grid grid-cols-4 gap-1.5">
        {(["weekly", "monthly", "3months", "yearly"] as PlanDur[]).map(d => {
          const p = PLAN_PRICES[tier][d];
          const s = PLAN_SAVINGS[tier][d];
          return (
            <button
              key={d}
              onClick={() => setDur(d)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all active:scale-95 ${
                duration === d
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                  : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
              }`}
            >
              <span className={`text-[10px] font-black uppercase ${duration === d ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}>
                {DURATION_LABEL[d]}
              </span>
              <span className={`text-xs font-black ${duration === d ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300"}`}>
                ₹{p.toLocaleString()}
              </span>
              {s > 0 && (
                <span className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-1 rounded font-bold">
                  Save ₹{s.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-slate-400">Plan</p>
          <p className="text-sm font-black text-slate-800 dark:text-white">
            {tier === "pro" ? "Pro" : "Lite"} · {DURATION_LABEL[duration]}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Valid till: {computeExpiry(duration)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">₹{price.toLocaleString()}</p>
          {saving_ > 0 && <p className="text-[10px] text-green-600 font-bold">Save ₹{saving_}</p>}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5 text-green-700 dark:text-green-300 text-sm font-bold">
          <CheckCircle className="w-4 h-4" /> Plan assign ho gaya! ✅
        </div>
      )}

      <button
        onClick={handleAssign}
        disabled={saving}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
      >
        {saving ? (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        {saving ? "Assigning..." : `Assign ${tier === "pro" ? "Pro" : "Lite"} Plan`}
      </button>
    </div>
  );
};

// ── SUBSCRIPTION HELPERS ──────────────────────────────────────────────────────

// Get payment status for a school
function getPaymentStatus(school: School): "overdue" | "due_soon" | "paid" | "no_date" {
  const paidUntil = school.subscription.paidUntil;
  if (!paidUntil) return "no_date";
  const daysLeft = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "due_soon";
  return "paid";
}

function daysLeftLabel(paidUntil?: string): string {
  if (!paidUntil) return "Date not set";
  const days = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days} days`;
  return `Valid till ${new Date(paidUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

// Extend paidUntil by N months from today or from paidUntil (whichever is later)
function extendPaidUntil(current?: string, months = 1): string {
  const base = current && new Date(current) > new Date() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().split("T")[0];
}

// ── SUBSCRIPTION MANAGEMENT PANEL ────────────────────────────────────────────
const SubscriptionHub: React.FC<{ schools: School[]; onRefresh: () => void }> = ({ schools }) => {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [editPaidUntil, setEditPaidUntil] = useState("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "overdue" | "due_soon" | "paid">("all");

  const now = new Date();
  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });

  const overdueSchools  = schools.filter(s => s.active && getPaymentStatus(s) === "overdue");
  const dueSoonSchools  = schools.filter(s => s.active && getPaymentStatus(s) === "due_soon");
  const paidSchools     = schools.filter(s => s.active && getPaymentStatus(s) === "paid");
  const noDateSchools   = schools.filter(s => s.active && getPaymentStatus(s) === "no_date");
  const totalExpected   = schools.filter(s => s.active).reduce((sum, s) => sum + s.subscription.monthlyAmount, 0);
  const totalOverdue    = overdueSchools.reduce((sum, s) => sum + s.subscription.monthlyAmount, 0);

  const sortedSchools = [...schools].filter(s => s.active).sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, no_date: 2, paid: 3 };
    return order[getPaymentStatus(a)] - order[getPaymentStatus(b)];
  });

  const filtered = filter === "all" ? sortedSchools
    : sortedSchools.filter(s => getPaymentStatus(s) === filter);

  const openEdit = (school: School) => {
    setSelectedSchool(school);
    setEditPaidUntil(school.subscription.paidUntil || "");
    setNotes(school.subscription.paymentNotes || "");
    setCustomAmount(String(school.subscription.monthlyAmount));
    setMarkingPaid(null);
  };

  const handleMarkPaid = async (school: School, months = 1) => {
    setMarkingPaid(school.id);
    const newPaidUntil = extendPaidUntil(school.subscription.paidUntil, months);
    const amount = Number(customAmount) || school.subscription.monthlyAmount;
    await updateSchool(school.id, {
      subscription: {
        ...school.subscription,
        paidUntil: newPaidUntil,
        lastPaidDate: new Date().toISOString(),
        lastPaidAmount: amount,
        paymentNotes: notes || school.subscription.paymentNotes,
        status: "active",
        monthlyAmount: amount,
      },
      active: true,
    });
    setMarkingPaid(null);
    setSelectedSchool(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedSchool) return;
    setSaving(true);
    await updateSchool(selectedSchool.id, {
      subscription: {
        ...selectedSchool.subscription,
        paidUntil: editPaidUntil || undefined,
        paymentNotes: notes,
        monthlyAmount: Number(customAmount) || selectedSchool.subscription.monthlyAmount,
      },
    });
    setSaving(false);
    setSelectedSchool(null);
  };

  return (
    <div className="space-y-4">
      {/* Revenue Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm col-span-3 flex gap-4 items-center">
          <div className="flex-1">
            <p className="text-[11px] text-slate-400 font-medium">Monthly Expected</p>
            <p className="text-2xl font-black text-green-600">₹{totalExpected.toLocaleString()}</p>
          </div>
          <div className="flex-1 border-l pl-4 dark:border-slate-600">
            <p className="text-[11px] text-slate-400 font-medium">Overdue</p>
            <p className="text-2xl font-black text-red-500">₹{totalOverdue.toLocaleString()}</p>
            <p className="text-[10px] text-red-400">{overdueSchools.length} schools</p>
          </div>
          <div className="flex-1 border-l pl-4 dark:border-slate-600">
            <p className="text-[11px] text-slate-400 font-medium">Clear</p>
            <p className="text-2xl font-black text-blue-500">{paidSchools.length}</p>
            <p className="text-[10px] text-slate-400">schools paid</p>
          </div>
        </div>
      </div>

      {/* Alert strips */}
      {overdueSchools.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
            {overdueSchools.length} school{overdueSchools.length > 1 ? "s" : ""} overdue — ₹{totalOverdue.toLocaleString()} pending
          </p>
        </div>
      )}
      {dueSoonSchools.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">
            {dueSoonSchools.length} school{dueSoonSchools.length > 1 ? "s" : ""} due within 7 days
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {([
          ["all", "All", schools.filter(s => s.active).length],
          ["overdue", "⚠️ Overdue", overdueSchools.length],
          ["due_soon", "⏰ Due Soon", dueSoonSchools.length],
          ["paid", "✅ Clear", paidSchools.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === key
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            {label} <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Schools List */}
      {filtered.map(school => {
        const status = getPaymentStatus(school);
        const statusColors = {
          overdue:  { bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900", badge: "bg-red-100 text-red-700", icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
          due_soon: { bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900", badge: "bg-amber-100 text-amber-700", icon: <Clock className="w-4 h-4 text-amber-500" /> },
          paid:     { bg: "bg-white dark:bg-slate-800 border-transparent", badge: "bg-green-100 text-green-700", icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
          no_date:  { bg: "bg-white dark:bg-slate-800 border-transparent", badge: "bg-slate-100 text-slate-500", icon: <Calendar className="w-4 h-4 text-slate-400" /> },
        }[status];

        const isExpanded = selectedSchool?.id === school.id;

        return (
          <div key={school.id} className={`rounded-xl border shadow-sm overflow-hidden ${statusColors.bg}`}>
            {/* School row */}
            <button
              onClick={() => isExpanded ? setSelectedSchool(null) : openEdit(school)}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
            >
              <div className="flex-shrink-0">{statusColors.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{school.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{daysLeftLabel(school.subscription.paidUntil)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-slate-700 dark:text-slate-200 text-sm">₹{school.subscription.monthlyAmount.toLocaleString()}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColors.badge}`}>
                  {status === "overdue" ? "OVERDUE" : status === "due_soon" ? "DUE SOON" : status === "paid" ? "CLEAR" : "NO DATE"}
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>

            {/* Expanded payment panel */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t dark:border-slate-700 space-y-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">

                {/* Last payment info */}
                {school.subscription.lastPaidDate && (
                  <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                    Last paid: <span className="font-semibold text-slate-600 dark:text-slate-300">
                      ₹{school.subscription.lastPaidAmount?.toLocaleString() || school.subscription.monthlyAmount.toLocaleString()}
                    </span> on {new Date(school.subscription.lastPaidDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Monthly Amount (₹)</label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold"
                  />
                </div>

                {/* Paid until */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Paid Until Date</label>
                  <input
                    type="date"
                    value={editPaidUntil}
                    onChange={e => setEditPaidUntil(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                  />
                </div>

                {/* Payment notes */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Payment Notes</label>
                  <input
                    type="text"
                    placeholder="UPI ID, receipt no., remarks..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkPaid(school, 1)}
                    disabled={markingPaid === school.id}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black disabled:opacity-60 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {markingPaid === school.id ? "Saving..." : "Mark Paid (+1 Month)"}
                  </button>
                  <button
                    onClick={() => handleMarkPaid(school, 3)}
                    disabled={markingPaid === school.id}
                    className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform"
                  >
                    +3M
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-3 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                </div>

                {/* Subscription plan badge */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {school.subscription.reading && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">📖 Reading</span>}
                  {school.subscription.writing && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">✏️ Writing</span>}
                  {school.subscription.pdf     && <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">📄 PDF</span>}
                  {school.subscription.mcq     && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">❓ MCQ</span>}
                  {school.subscription.tier === "lite" && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">📦 Lite</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No schools in this category</p>
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const SuperAdminPanel: React.FC<Props> = ({ adminUid, onBack }) => {
  const [schools, setSchools]           = useState<School[]>([]);
  const [view, setView]                 = useState<"dashboard" | "new" | "manage">("dashboard");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [saving, setSaving]             = useState(false);
  const [dashTab, setDashTab]           = useState<"schools" | "subscriptions">("schools");

  // Lock code state
  const [lockCodeInput, setLockCodeInput]       = useState('');
  const [lockCodeActive, setLockCodeActive]     = useState(false);
  const [showLockCode, setShowLockCode]         = useState(false);
  const [savingLockCode, setSavingLockCode]     = useState(false);

  // Assign school admin state
  const [assignEmail, setAssignEmail]           = useState('');
  const [assigningAdmin, setAssigningAdmin]     = useState(false);
  const [assignResult, setAssignResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm]       = useState(false);
  const [deleting, setDeleting]                 = useState(false);

  const [form, setForm] = useState({
    name: "", code: "", email: "", adminEmail: "", phone: "", address: ""
  });
  const [sub, setSub] = useState<SchoolSubscription>({ ...defaultSub });

  useEffect(() => {
    const unsub = subscribeToAllSchools(setSchools);
    return unsub;
  }, []);

  const activeSchools   = schools.filter(s => s.active && s.subscription.status === "active");
  const inactiveSchools = schools.filter(s => !s.active || s.subscription.status !== "active");
  const monthlyRevenue  = activeSchools.reduce((sum, s) => sum + (s.subscription.monthlyAmount || 0), 0);
  const comboSchools    = activeSchools.filter(s => isCombo(s.subscription));

  const [createError, setCreateError] = useState<string | null>(null);

  const createSchool = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    setCreateError(null);
    try {
      const id = generateId();
      const school: School = {
        id,
        name: form.name,
        code: form.code || form.name.slice(0, 6).toUpperCase().replace(/\s/g, "_"),
        email: form.email,
        adminEmail: form.adminEmail || form.email,
        phone: form.phone,
        address: form.address,
        subscription: { ...sub, monthlyAmount: calcAmount(sub) },
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: adminUid,
        totalStudents: 0,
        totalTeachers: 0,
      };
      await saveSchool(school);
      setForm({ name: "", code: "", email: "", adminEmail: "", phone: "", address: "" });
      setSub({ ...defaultSub });
      setView("dashboard");
    } catch (e: any) {
      setCreateError(e?.message || "School create karne mein error aaya. Dobara try karo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSchoolStatus = async (school: School) => {
    await updateSchool(school.id, {
      active: !school.active,
      subscription: { ...school.subscription, status: school.active ? "suspended" : "active" },
    });
  };

  const openManage = (school: School) => {
    setSelectedSchool(school);
    setLockCodeInput(school.lockCode || '');
    setLockCodeActive(school.lockCodeActive ?? false);
    setShowLockCode(false);
    setView("manage");
  };

  const saveLockCode = async () => {
    if (!selectedSchool) return;
    setSavingLockCode(true);
    await setSchoolLockCode(selectedSchool.id, lockCodeInput.trim(), lockCodeActive);
    setSelectedSchool({ ...selectedSchool, lockCode: lockCodeInput.trim(), lockCodeActive });
    setSavingLockCode(false);
  };

  const handleAssignAdmin = async () => {
    if (!selectedSchool || !assignEmail.trim()) return;
    setAssigningAdmin(true);
    setAssignResult(null);
    try {
      const profile = await assignSchoolAdminByEmail(selectedSchool.id, assignEmail.trim());
      setAssignResult({ ok: true, msg: `✅ ${profile.name} (${profile.email}) ab is school ka admin hai!` });
      setAssignEmail('');
    } catch (e: any) {
      setAssignResult({ ok: false, msg: `❌ ${e.message || 'Error aaya, dobara try karo.'}` });
    }
    setAssigningAdmin(false);
  };

  const updateSubscription = async (school: School, newSub: SchoolSubscription) => {
    const updated = { ...newSub, monthlyAmount: calcAmount(newSub) };
    await updateSchool(school.id, { subscription: updated });
    setSelectedSchool({ ...school, subscription: updated });
  };

  const handleToggleLock = async () => {
    if (!selectedSchool) return;
    const newLocked = !selectedSchool.locked;
    await lockSchool(selectedSchool.id, newLocked);
    setSelectedSchool({ ...selectedSchool, locked: newLocked });
  };

  const handleDelete = async () => {
    if (!selectedSchool) return;
    setDeleting(true);
    await deleteSchool(selectedSchool.id);
    setDeleting(false);
    setDeleteConfirm(false);
    setView("dashboard");
    setSelectedSchool(null);
  };

  // ── NEW SCHOOL FORM ──────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView("dashboard")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white">Add New School</h2>
          <button onClick={createSchool} disabled={saving || !form.name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {createError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300 font-medium">
              ❌ {createError}
            </div>
          )}
          {/* School Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">School Details</h3>
            {([
              ["name",       "School Name *",            "text"],
              ["code",       "School Code (auto)",        "text"],
              ["email",      "School Email *",            "email"],
              ["adminEmail", "Admin Email",               "email"],
              ["phone",      "Phone Number",              "tel"],
              ["address",    "Address",                   "text"],
            ] as const).map(([k, lbl, t]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                <input
                  type={t}
                  value={(form as any)[k]}
                  onChange={e => setForm(prev => ({ ...prev, [k]: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                />
              </div>
            ))}
          </div>

          <SubEditor
            value={sub}
            onChange={s => setSub({ ...s, monthlyAmount: calcAmount(s) })}
          />
        </div>
      </div>
    );
  }

  // ── MANAGE SCHOOL ────────────────────────────────────────────────────────
  if (view === "manage" && selectedSchool) {
    const s = selectedSchool;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-2">
          <button onClick={() => { setView("dashboard"); setDeleteConfirm(false); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white truncate">{s.name}</h2>
          {s.locked && (
            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
          <button
            onClick={() => toggleSchoolStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${s.active ? "bg-red-100 text-red-700 dark:bg-red-900/40" : "bg-green-100 text-green-700 dark:bg-green-900/40"}`}
          >
            {s.active ? <><Pause className="w-3.5 h-3.5" /> Suspend</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
          </button>
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* School Info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">School Info</h3>
            <div className="space-y-2 text-sm">
              {[["Email", s.email], ["Admin Email", s.adminEmail], ["Code", s.code]].map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between">
                  <span className="text-slate-400">{lbl}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">{val}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={`font-medium ${s.active ? "text-green-500" : "text-red-400"}`}>{s.subscription.status}</span>
              </div>
            </div>
          </div>

          <PlanAssigner
            school={s}
            onAssigned={newSub => setSelectedSchool({ ...s, subscription: newSub })}
          />

          <SubEditor
            value={s.subscription}
            onChange={newSub => updateSubscription(s, newSub)}
            label="Advanced: Manual Override"
          />

          {/* ── ASSIGN SCHOOL ADMIN ──────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">School Admin Assign Karo</h3>
            </div>
            <p className="text-xs text-slate-400">
              Jis IIC user ko is school ka admin banana hai, uska email enter karo. Woh pehle se IIC app mein registered hona chahiye.
            </p>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Admin ka Email</label>
              <input
                type="email"
                placeholder="schooladmin@example.com"
                value={assignEmail}
                onChange={e => { setAssignEmail(e.target.value); setAssignResult(null); }}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
              />
            </div>
            {assignResult && (
              <div className={`text-xs px-3 py-2 rounded-lg font-medium ${assignResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {assignResult.msg}
              </div>
            )}
            <button
              onClick={handleAssignAdmin}
              disabled={assigningAdmin || !assignEmail.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {assigningAdmin ? 'Searching...' : '👤 School Admin Banao'}
            </button>
          </div>

          {/* Lock Code Management */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Lock Code</h3>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${lockCodeActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {lockCodeActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Jab active hoga, students ko join karne ke liye yeh code enter karna padega.</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lockCodeActive}
                onChange={e => setLockCodeActive(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Lock Code Enable Karo</span>
            </label>

            <div className="relative">
              <label className="text-xs text-slate-500 mb-1 block">Lock Code</label>
              <input
                type={showLockCode ? "text" : "password"}
                placeholder="School ka secret code"
                value={lockCodeInput}
                onChange={e => setLockCodeInput(e.target.value)}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowLockCode(!showLockCode)}
                className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
              >
                {showLockCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={saveLockCode}
              disabled={savingLockCode}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold disabled:opacity-60"
            >
              {savingLockCode ? 'Saving...' : 'Lock Code Save Karo'}
            </button>
          </div>

          {/* ── DANGER ZONE ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3 border border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">Danger Zone</h3>
            </div>

            {/* Lock / Unlock school */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {s.locked ? '🔒 School Locked' : '🔓 School Unlocked'}
                </p>
                <p className="text-xs text-slate-400">
                  {s.locked
                    ? 'Students is school mein login nahi kar sakte.'
                    : 'Students is school mein freely login kar sakte hain.'}
                </p>
              </div>
              <button
                onClick={handleToggleLock}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${s.locked
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300'}`}
              >
                {s.locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
              </button>
            </div>

            {/* Delete school */}
            <div className="pt-2 border-t dark:border-slate-700">
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> School Delete Karo
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                    ⚠️ Yeh action permanent hai! School ka saara data delete ho jayega.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-60"
                    >
                      {deleting ? 'Deleting...' : 'Haan, Delete Karo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-4 py-5">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin Dashboard
          </button>
        )}
        <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">Super Admin</p>
        <h1 className="text-2xl font-bold text-white">IIC×NSTA Control Panel</h1>
        <p className="text-slate-400 text-sm mt-1">Manage all schools in the ecosystem</p>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {/* Revenue cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm col-span-2 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <IndianRupee className="w-4 h-4 text-green-500" />
                <span className="text-xs text-slate-500">Monthly Revenue</span>
              </div>
              <p className="text-3xl font-bold text-green-600">₹{monthlyRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{activeSchools.length} active schools</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 font-medium">Combo schools</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{comboSchools.length}</p>
              <p className="text-xs text-slate-400">₹{(comboSchools.length * COMBO_PRICE).toLocaleString()}/mo</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Schools</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{schools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-500">{activeSchools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Inactive/Suspended</p>
            <p className="text-2xl font-bold text-red-400">{inactiveSchools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Students</p>
            <p className="text-2xl font-bold text-blue-500">{schools.reduce((s, sc) => s + (sc.totalStudents || 0), 0)}</p>
          </div>
        </div>

        {/* Combo offer info strip */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <Tag className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-bold text-amber-700 dark:text-amber-300">Combo Offer: </span>
            <span className="text-amber-600 dark:text-amber-400">All 4 features @ ₹{COMBO_PRICE}/mo</span>
            <span className="text-xs text-slate-400 ml-2">(Save ₹{COMBO_SAVING} vs individual)</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <button
            onClick={() => setDashTab("schools")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
              dashTab === "schools" ? "bg-blue-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <SchoolIcon className="w-4 h-4" /> Schools
          </button>
          <button
            onClick={() => setDashTab("subscriptions")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all relative ${
              dashTab === "subscriptions" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Subscriptions
            {schools.filter(s => s.active && (getPaymentStatus(s) === "overdue" || getPaymentStatus(s) === "due_soon")).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {schools.filter(s => s.active && (getPaymentStatus(s) === "overdue" || getPaymentStatus(s) === "due_soon")).length}
              </span>
            )}
          </button>
        </div>

        {/* Subscriptions Tab */}
        {dashTab === "subscriptions" && (
          <SubscriptionHub schools={schools} onRefresh={() => {}} />
        )}

        {/* Schools Tab */}
        {dashTab === "schools" && <>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white">All Schools</h3>
          <button onClick={() => setView("new")}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>

        {schools.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <SchoolIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No schools yet. Add your first school.</p>
          </div>
        )}

        {schools.map(school => {
          const combo = isCombo(school.subscription);
          return (
            <div key={school.id} className={`rounded-xl p-4 shadow-sm border ${combo ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-transparent"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${combo ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                  {combo ? <Zap className="w-5 h-5 text-amber-500" /> : <SchoolIcon className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 dark:text-white truncate">{school.name}</p>
                    {combo && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> COMBO
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${school.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {school.active ? "Active" : "Suspended"}
                    </span>
                    {school.locked && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{school.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {school.subscription.reading && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Reading</span>}
                    {school.subscription.writing && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Writing</span>}
                    {school.subscription.pdf     && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">PDF</span>}
                    {school.subscription.mcq     && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">MCQ</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${combo ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      ₹{school.subscription.monthlyAmount.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
                <button onClick={() => openManage(school)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0">
                  <Settings className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
        </>}
      </div>
    </div>
  );
};
