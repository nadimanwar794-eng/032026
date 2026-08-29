// @ts-nocheck
import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, MessageCircle, Users, BookOpen, Star, Crown, Lock, Zap } from "lucide-react";
import type { School } from "../../school-types";

export const ADMIN_WHATSAPP_NUMBER = "918227070298";

const LITE_FEATURES = [
  { text: "Student Records (Add/Edit/Delete)", included: true },
  { text: "Session & Class Management", included: true },
  { text: "Teacher Management", included: true },
  { text: "Attendance Tracking", included: true },
  { text: "Fee Management & Reports", included: true },
  { text: "Marks & Report Cards", included: true },
  { text: "Content Management (Notes/PDF/MCQ)", included: false },
];

const FULL_FEATURES = [
  { text: "Student Records (Add/Edit/Delete)", included: true },
  { text: "Session & Class Management", included: true },
  { text: "Teacher Management", included: true },
  { text: "Attendance Tracking", included: true },
  { text: "Fee Management & Reports", included: true },
  { text: "Marks & Report Cards", included: true },
  { text: "Reading Mode (Smart Notes)", included: true },
  { text: "Writing Mode (Board-style)", included: true },
  { text: "PDF System", included: true },
  { text: "MCQ Practice System", included: true },
];

type Duration = "weekly" | "monthly" | "3monthly" | "yearly";

interface PlanOption {
  duration: Duration;
  label: string;
  price: number;
  mrp?: number;
  badge?: string;
}

const LITE_PLANS: PlanOption[] = [
  { duration: "weekly",  label: "Weekly",   price: 700,   mrp: undefined },
  { duration: "3monthly", label: "3 Months", price: 4000,  mrp: 4500, badge: "Save ₹500" },
  { duration: "yearly",  label: "Yearly",   price: 15000, mrp: 18000, badge: "Save ₹3,000" },
];

const PRO_PLANS: PlanOption[] = [
  { duration: "weekly",  label: "Weekly",   price: 1400,  mrp: 1500,  badge: "Save ₹100" },
  { duration: "monthly", label: "Monthly",  price: 4500,  mrp: 5000,  badge: "Save ₹500" },
  { duration: "3monthly", label: "3 Months", price: 12000, mrp: 15000, badge: "Save ₹3,000" },
  { duration: "yearly",  label: "Yearly",   price: 45000, mrp: 60000, badge: "Save ₹15,000" },
];

const durationLabel: Record<Duration, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  "3monthly": "3 Months",
  yearly: "Yearly",
};

interface Props {
  school: School;
  onBack: () => void;
}

export const SchoolStore: React.FC<Props> = ({ school, onBack }) => {
  const [selectedLiteDuration, setSelectedLiteDuration] = useState<Duration>("weekly");
  const [selectedProDuration, setSelectedProDuration] = useState<Duration>("monthly");

  const sendWhatsApp = (plan: "lite" | "full", option: PlanOption) => {
    const planName = plan === "lite" ? "Lite Plan" : "Pro Plan";
    const durLabel = durationLabel[option.duration];
    const priceStr = `₹${option.price.toLocaleString("en-IN")}`;
    const msg = encodeURIComponent(
      `Namaste! 🙏\n\nMain *${school.name}* ka School Admin hoon.\n\nMujhe *IIC School ${planName} — ${durLabel} (${priceStr})* subscription chahiye.\n\n📋 School Details:\n• School: ${school.name}\n• School Code: ${school.code}\n• Admin Email: ${school.adminEmail}\n\nKripya subscription activate karein. Dhanyawad!`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  const currentTier = school.subscription?.tier;
  const isActive = school.subscription?.status === "active";
  const expiresAt = school.subscription?.expiresAt;

  const selectedLiteOption = LITE_PLANS.find(p => p.duration === selectedLiteDuration)!;
  const selectedProOption = PRO_PLANS.find(p => p.duration === selectedProDuration)!;

  const DurationTab: React.FC<{
    plans: PlanOption[];
    selected: Duration;
    onSelect: (d: Duration) => void;
    color: string;
  }> = ({ plans, selected, onSelect, color }) => (
    <div className="flex gap-1.5 flex-wrap mt-3">
      {plans.map(p => (
        <button
          key={p.duration}
          onClick={() => onSelect(p.duration)}
          className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
            selected === p.duration
              ? `${color} text-white border-transparent shadow-sm`
              : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4 py-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm font-medium mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">School Store</p>
        <h1 className="text-xl font-bold text-white">Subscription Plans</h1>
        <p className="text-blue-200 text-sm mt-1">Apni school ke liye sahi plan chunein</p>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">

        {isActive && currentTier && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700 dark:text-green-300">
                {currentTier === "lite" ? "Lite Plan Active ✓" : "Pro Plan Active ✓"}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {expiresAt
                  ? `Valid until: ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : "Subscription active hai"}
              </p>
            </div>
          </div>
        )}

        {!isActive && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <Lock className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Subscription Inactive</p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Neeche se koi plan buy karo — features turant unlock ho jayenge
              </p>
            </div>
          </div>
        )}

        {/* ── LITE PLAN ──────────────────────────────────────────── */}
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${
          currentTier === "lite" && isActive
            ? "border-blue-400 shadow-blue-100 dark:shadow-blue-900/20"
            : "border-slate-100 dark:border-slate-700"
        }`}>
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white text-lg leading-tight">Lite Plan</h2>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Sirf Student Management</p>
                </div>
              </div>
              {currentTier === "lite" && isActive && (
                <span className="text-xs bg-blue-500 text-white px-2.5 py-1 rounded-full font-bold">Active</span>
              )}
            </div>

            <DurationTab
              plans={LITE_PLANS}
              selected={selectedLiteDuration}
              onSelect={setSelectedLiteDuration}
              color="bg-blue-600"
            />

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-700 dark:text-blue-300">
                ₹{selectedLiteOption.price.toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-slate-500">/{selectedLiteOption.label.toLowerCase()}</span>
              {selectedLiteOption.mrp && (
                <>
                  <span className="text-xs line-through text-slate-400">
                    ₹{selectedLiteOption.mrp.toLocaleString("en-IN")}
                  </span>
                  {selectedLiteOption.badge && (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded-full font-bold">
                      {selectedLiteOption.badge}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="px-4 py-3 space-y-2 border-t border-slate-100 dark:border-slate-700">
            {LITE_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-base ${f.included ? "text-green-500" : "text-slate-300 dark:text-slate-600"}`}>
                  {f.included ? "✓" : "✕"}
                </span>
                <span className={`text-sm ${f.included ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => sendWhatsApp("lite", selectedLiteOption)}
              className="w-full py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp pe Buy Karo — ₹{selectedLiteOption.price.toLocaleString("en-IN")}
            </button>
          </div>
        </div>

        {/* ── PRO PLAN ──────────────────────────────────────────── */}
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${
          currentTier === "full" && isActive
            ? "border-amber-400 shadow-amber-100 dark:shadow-amber-900/20"
            : "border-slate-100 dark:border-slate-700"
        }`}>
          <div className="bg-amber-500 text-white text-center text-xs font-bold py-1.5 tracking-wide">
            ⭐ MOST POPULAR — FULL ACCESS
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 px-4 py-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-white text-lg leading-tight">Pro Plan</h2>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Content + Student Management</p>
                </div>
              </div>
              {currentTier === "full" && isActive && (
                <span className="text-xs bg-amber-500 text-white px-2.5 py-1 rounded-full font-bold">Active</span>
              )}
            </div>

            <DurationTab
              plans={PRO_PLANS}
              selected={selectedProDuration}
              onSelect={setSelectedProDuration}
              color="bg-amber-500"
            />

            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-black text-amber-700 dark:text-amber-300">
                ₹{selectedProOption.price.toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-slate-500">/{selectedProOption.label.toLowerCase()}</span>
              {selectedProOption.mrp && (
                <>
                  <span className="text-xs line-through text-slate-400">
                    ₹{selectedProOption.mrp.toLocaleString("en-IN")}
                  </span>
                  {selectedProOption.badge && (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded-full font-bold">
                      {selectedProOption.badge}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="px-4 py-3 space-y-2 border-t border-slate-100 dark:border-slate-700">
            {FULL_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-base text-green-500">✓</span>
                <span className="text-sm text-slate-700 dark:text-slate-200">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => sendWhatsApp("full", selectedProOption)}
              className="w-full py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp pe Buy Karo — ₹{selectedProOption.price.toLocaleString("en-IN")}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-4 space-y-1.5">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-200">📋 Subscription ke baare mein jaano:</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">• Subscription expire hone par content add/edit karne ki power band ho jayegi</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">• Purana data bilkul safe rahega — kuch bhi delete nahi hoga</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">• Renew karte hi sab features turant wapas aa jayenge</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">• WhatsApp pe message karo, admin activate kar denge</p>
        </div>
      </div>
    </div>
  );
};
