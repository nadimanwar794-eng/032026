// @ts-nocheck
import React, { useState } from "react";
import {
  ArrowLeft, Crown, Shield, Lock, CheckCircle2, XCircle,
  Calendar, AlertTriangle, Phone, MessageSquare, ChevronDown, ChevronUp,
  BookOpen, Users, FileText, Brain, ClipboardList, IndianRupee, BarChart3
} from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import type { School } from "../../school-types";

interface Props {
  school: School | null;
  schoolId: string;
  adminUid: string;
  onBack: () => void;
}

// ── Plan feature matrix ───────────────────────────────────────────────────────
const FEATURES = [
  { id: "students",   icon: <Users       size={15} />, label: "Student Management",   lite: true,  pro: true  },
  { id: "teachers",   icon: <Users       size={15} />, label: "Teacher Management",   lite: true,  pro: true  },
  { id: "classes",    icon: <BookOpen    size={15} />, label: "Classes & Sections",   lite: true,  pro: true  },
  { id: "fees",       icon: <IndianRupee size={15} />, label: "Fee Collection",       lite: true,  pro: true  },
  { id: "attendance", icon: <ClipboardList size={15}/>, label: "Attendance System",  lite: true,  pro: true  },
  { id: "marks",      icon: <BarChart3   size={15} />, label: "Marks & Results",      lite: true,  pro: true  },
  { id: "reading",    icon: <BookOpen    size={15} />, label: "Smart Reading Notes",  lite: false, pro: true  },
  { id: "writing",    icon: <FileText    size={15} />, label: "Writing Mode Content", lite: false, pro: true  },
  { id: "pdf",        icon: <FileText    size={15} />, label: "PDF Resources",        lite: false, pro: true  },
  { id: "mcq",        icon: <Brain       size={15} />, label: "MCQ / Quiz System",    lite: false, pro: true  },
];

const daysRemaining = (isoDate?: string): number => {
  if (!isoDate) return 0;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

export const SchoolPlanView: React.FC<Props> = ({ school, schoolId, adminUid, onBack }) => {
  const [showCompare, setShowCompare] = useState(false);
  const [contactMsg, setContactMsg]   = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);

  // ── Derive plan info ─────────────────────────────────────────────────────
  const sub            = school?.subscription;
  const isActive       = sub?.status === "active";
  const tier           = sub?.tier;                        // "lite" | "full" | undefined
  const planLevel: "none" | "lite" | "pro" =
    !isActive        ? "none" :
    tier === "lite"  ? "lite" :
    tier === "full"  ? "pro"  : "pro";
  const expiresAt      = sub?.expiresAt || sub?.paidUntil;
  const days           = daysRemaining(expiresAt);
  const expiringSoon   = isActive && days > 0 && days <= 30;

  // ── Plan badge config ────────────────────────────────────────────────────
  const planCfg = {
    none: {
      label: "No Plan",
      color: "from-slate-400 to-slate-500",
      bg:    "bg-slate-50 border-slate-200",
      icon:  <Lock size={28} className="text-slate-400" />,
      desc:  "Aapke school ka koi active plan nahi hai. Super Admin se contact karo.",
    },
    lite: {
      label: "Lite Plan",
      color: "from-blue-500 to-indigo-600",
      bg:    "bg-blue-50 border-blue-200",
      icon:  <Shield size={28} className="text-blue-500" />,
      desc:  "Student management active hai. Content features ke liye Pro Plan lo.",
    },
    pro: {
      label: "Pro Plan",
      color: "from-amber-500 to-orange-500",
      bg:    "bg-amber-50 border-amber-200",
      icon:  <Crown size={28} className="text-amber-500" />,
      desc:  "Saari features unlock hain — content, MCQ, PDF, sab kuch!",
    },
  }[planLevel];

  // ── Upgrade request ──────────────────────────────────────────────────────
  const sendRequest = async () => {
    if (!contactMsg.trim()) return;
    setSending(true);
    try {
      const id = `${schoolId}_${Date.now()}`;
      await setDoc(doc(db, "schoolPlanRequests", id), {
        schoolId,
        schoolName: school?.name || "",
        adminUid,
        currentPlan: planLevel,
        message: contactMsg.trim(),
        requestedAt: serverTimestamp(),
        status: "pending",
      });
      setSent(true);
      setContactMsg("");
    } catch (e) {
      console.error("Plan request error:", e);
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-blue-900 px-4 pt-safe pb-5">
        <div className="flex items-center gap-3 pt-3 mb-4">
          <button onClick={onBack} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Mera School Plan</h1>
            <p className="text-xs text-blue-300">{school?.name || "School"}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">

        {/* ── Current Plan Card ── */}
        <div className={`rounded-2xl border p-5 ${planCfg.bg} dark:bg-slate-800 dark:border-slate-700`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${planCfg.color} flex items-center justify-center shadow-md`}>
              {planCfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xl font-black bg-gradient-to-r ${planCfg.color} bg-clip-text text-transparent`}>
                  {planCfg.label}
                </span>
                {isActive && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    ✅ Active
                  </span>
                )}
                {!isActive && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                    ❌ Inactive
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{planCfg.desc}</p>
            </div>
          </div>

          {/* Expiry info */}
          {isActive && expiresAt && (
            <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 ${
              expiringSoon ? "bg-red-100 dark:bg-red-900/30" : "bg-white/60 dark:bg-slate-700/60"
            }`}>
              {expiringSoon
                ? <AlertTriangle size={15} className="text-red-500 shrink-0" />
                : <Calendar size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
              }
              <div>
                <p className={`text-xs font-semibold ${expiringSoon ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>
                  {expiringSoon
                    ? `⚠️ Sirf ${days} din baaki — jaldi renew karo!`
                    : `Valid till: ${fmtDate(expiresAt)} (${days} din)`
                  }
                </p>
              </div>
            </div>
          )}
          {!isActive && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Plan active nahi hai. Neeche Super Admin ko contact karo.
              </p>
            </div>
          )}
        </div>

        {/* ── Active Features ── */}
        {isActive && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Aapke Plan mein kya hai</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {FEATURES.map(f => {
                const hasIt = planLevel === "pro" ? f.pro : planLevel === "lite" ? f.lite : false;
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={hasIt ? "text-slate-500 dark:text-slate-400" : "text-slate-300 dark:text-slate-600"}>
                      {f.icon}
                    </span>
                    <span className={`flex-1 text-sm ${hasIt ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>
                      {f.label}
                    </span>
                    {hasIt
                      ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      : <XCircle      size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Plan Comparison ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setShowCompare(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Plan Compare karo</p>
            {showCompare
              ? <ChevronUp size={16} className="text-slate-400" />
              : <ChevronDown size={16} className="text-slate-400" />
            }
          </button>
          {showCompare && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              {/* Column headers */}
              <div className="grid grid-cols-3 gap-0 border-b border-slate-100 dark:border-slate-700">
                <div className="px-3 py-2 text-xs text-slate-400 font-semibold">Feature</div>
                <div className="px-3 py-2 text-xs font-bold text-blue-600 text-center border-l border-slate-100 dark:border-slate-700">
                  Lite
                </div>
                <div className="px-3 py-2 text-xs font-bold text-amber-600 text-center border-l border-slate-100 dark:border-slate-700">
                  Pro
                </div>
              </div>
              {FEATURES.map(f => (
                <div key={f.id} className="grid grid-cols-3 gap-0 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    {f.icon} {f.label}
                  </div>
                  <div className="flex items-center justify-center border-l border-slate-100 dark:border-slate-700">
                    {f.lite
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <XCircle      size={15} className="text-slate-300 dark:text-slate-600" />
                    }
                  </div>
                  <div className="flex items-center justify-center border-l border-slate-100 dark:border-slate-700">
                    {f.pro
                      ? <CheckCircle2 size={15} className="text-green-500" />
                      : <XCircle      size={15} className="text-slate-300 dark:text-slate-600" />
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Contact / Upgrade Request ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={16} className="text-indigo-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Plan upgrade ya renew karna hai?
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Super Admin se contact karo. Apna message likhkar request bhejo — wo activate kar denge.
          </p>
          {sent ? (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-3">
              <CheckCircle2 size={16} className="text-green-500" />
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                Request bhej di! Super Admin jald reply karenge.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={contactMsg}
                onChange={e => setContactMsg(e.target.value)}
                placeholder="Jaise: Pro Plan lena hai, 1 saal ke liye. School: ABC Public School."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={sendRequest}
                disabled={sending || !contactMsg.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <MessageSquare size={14} />
                )}
                {sending ? "Bhej rahe hain…" : "Request Bhejo"}
              </button>
            </div>
          )}
        </div>

        {/* ── Info note ── */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-6">
          Plan sirf Super Admin activate ya deactivate kar sakta hai.
        </p>
      </div>
    </div>
  );
};
