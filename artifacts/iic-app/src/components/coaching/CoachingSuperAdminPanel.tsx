// @ts-nocheck
/**
 * CoachingSuperAdminPanel — IIC platform super admin manages all coaching centres.
 * Features:
 *  - Create / edit / delete coaching centres
 *  - Assign admins to coaching centres
 *  - Manage ₹500/month subscriptions (mark paid, suspend)
 *  - Lock / unlock coachings
 */
import React, { useState, useEffect } from "react";
import {
  subscribeToAllCoachings,
  saveCoaching,
  updateCoaching,
  deleteCoaching,
  assignCoachingAdminByEmail,
  generateCoachingId,
  subscribeToCoachingMembers,
  removeCoachingUser,
} from "../../coaching-firebase";
import type { CoachingCentre, CoachingSubscription, CoachingSubscriptionTier } from "../../coaching-types";
import { COACHING_SUBSCRIPTION_PLANS } from "../../coaching-types";
import {
  ArrowLeft, Plus, Trash2, Settings, Lock, Unlock, X, CheckCircle,
  AlertCircle, Users, IndianRupee, Clock, Shield, Eye, EyeOff,
  RefreshCw, ChevronRight, Building2, UserPlus, UserMinus, Crown
} from "lucide-react";

const EMOJIS = ["🏫", "🏛️", "📚", "✏️", "🎓", "📝", "🌟", "⭐", "🔥", "💡", "🚀", "💎"];
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#06b6d4"];

// Tier labels/colors for badge display
const TIER_BADGE: Record<CoachingSubscriptionTier, { label: string; color: string }> = {
  WEEKLY:      { label: "Weekly",    color: "bg-green-100 text-green-700" },
  MONTHLY:     { label: "Monthly",   color: "bg-blue-100 text-blue-700" },
  "3_MONTHLY": { label: "3 Month",   color: "bg-purple-100 text-purple-700" },
  YEARLY:      { label: "Yearly",    color: "bg-amber-100 text-amber-700" },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

interface Props {
  adminUid: string;
  onBack?: () => void;
}

type Tab = "COACHINGS" | "ADD";

const defaultSub = (): CoachingSubscription => ({
  status: "inactive",
  monthlyAmount: 500,
  assignedAt: new Date().toISOString(),
});

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CoachingSubscription["status"] }) {
  const map = {
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-slate-100 text-slate-500",
    suspended: "bg-red-100 text-red-600",
  };
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${map[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function CoachingCard({
  coaching,
  onEdit,
  onDelete,
  onLock,
  onManageAdmin,
  onMarkPaid,
  onSuspend,
}: {
  coaching: CoachingCentre;
  onEdit: () => void;
  onDelete: () => void;
  onLock: () => void;
  onManageAdmin: () => void;
  onMarkPaid: () => void;
  onSuspend: () => void;
}) {
  const sub = coaching.subscription;
  const paidUntil = sub.paidUntil ? new Date(sub.paidUntil) : null;
  const today = new Date();
  const isExpiringSoon = paidUntil
    ? (paidUntil.getTime() - today.getTime()) / 86400000 < 7
    : true;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
    >
      {/* Banner */}
      <div
        className="h-2"
        style={{ background: coaching.bannerColor || "#6366f1" }}
      />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: (coaching.bannerColor || "#6366f1") + "20" }}
          >
            {coaching.emoji || "🏫"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-800 text-base leading-tight">{coaching.name}</h3>
              {coaching.locked && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">LOCKED</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{coaching.code}</p>
            <p className="text-xs text-slate-500 truncate">{coaching.adminEmail}</p>
          </div>
          <StatusBadge status={sub.status} />
        </div>

        {/* Subscription */}
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">Subscription</span>
            <div className="flex items-center gap-1.5">
              {sub.tier && TIER_BADGE[sub.tier] ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${TIER_BADGE[sub.tier].color}`}>
                  {TIER_BADGE[sub.tier].label}
                </span>
              ) : null}
              {sub.lastPaidAmount ? (
                <span className="font-black text-slate-700">₹{sub.lastPaidAmount}</span>
              ) : null}
            </div>
          </div>
          {paidUntil ? (
            <div className="flex items-center gap-1.5">
              <Clock size={11} className={isExpiringSoon ? "text-orange-500" : "text-emerald-500"} />
              <span className={`text-[11px] font-bold ${isExpiringSoon ? "text-orange-600" : "text-emerald-600"}`}>
                Valid until: {paidUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {isExpiringSoon && " ⚠️"}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-red-500 font-bold">⚠️ Koi subscription active nahi</p>
          )}
          {sub.paymentNotes && (
            <p className="text-[10px] text-slate-400 italic">{sub.paymentNotes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onMarkPaid}
            className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all"
          >
            <IndianRupee size={12} /> Mark Paid
          </button>
          <button
            onClick={onManageAdmin}
            className="flex items-center justify-center gap-1.5 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 active:scale-95 transition-all"
          >
            <UserPlus size={12} /> Admin
          </button>
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all"
          >
            <Settings size={12} /> Edit
          </button>
          <button
            onClick={onLock}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${
              coaching.locked
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100"
            }`}
          >
            {coaching.locked ? <Unlock size={12} /> : <Lock size={12} />}
            {coaching.locked ? "Unlock" : "Lock"}
          </button>
        </div>
        <button
          onClick={onSuspend}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all ${
            sub.status === "suspended"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {sub.status === "suspended" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {sub.status === "suspended" ? "Activate Subscription" : "Suspend Subscription"}
        </button>
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 active:scale-95 transition-all"
        >
          <Trash2 size={12} /> Delete Coaching
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const CoachingSuperAdminPanel: React.FC<Props> = ({ adminUid, onBack }) => {
  const [coachings, setCoachings] = useState<CoachingCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState(false);
  const [tab, setTab] = useState<Tab>("COACHINGS");

  // Form state
  const [form, setForm] = useState({
    name: "", code: "", emoji: "🏫", bannerColor: "#6366f1",
    adminEmail: "", tagline: "", address: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Mark paid modal
  const [paidModal, setPaidModal] = useState<{ coaching: CoachingCentre } | null>(null);
  const [paidTier, setPaidTier] = useState<CoachingSubscriptionTier>("MONTHLY");
  const [paidNotes, setPaidNotes] = useState("");

  // Admin modal
  const [adminModal, setAdminModal] = useState<{ coaching: CoachingCentre } | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminRole, setAdminRole] = useState<"COACHING_ADMIN" | "COACHING_SUB_ADMIN">("COACHING_ADMIN");
  const [adminSaving, setAdminSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllCoachings(
      list => {
        setCoachings(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
        setPermError(false);
      },
      err => {
        setLoading(false);
        if (err?.code === "permission-denied") setPermError(true);
      }
    );
    return unsub;
  }, []);

  const resetForm = () => {
    setForm({ name: "", code: "", emoji: "🏫", bannerColor: "#6366f1", adminEmail: "", tagline: "", address: "", phone: "" });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      const id = editId || generateCoachingId();
      const coaching: CoachingCentre = {
        id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase().replace(/\s+/g, "_"),
        emoji: form.emoji,
        bannerColor: form.bannerColor,
        adminEmail: form.adminEmail.trim().toLowerCase(),
        tagline: form.tagline.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        subscription: editId
          ? (coachings.find(c => c.id === editId)?.subscription || defaultSub())
          : defaultSub(),
        active: true,
        createdAt: editId
          ? (coachings.find(c => c.id === editId)?.createdAt || new Date().toISOString())
          : new Date().toISOString(),
        createdBy: adminUid,
      };
      await saveCoaching(coaching);
      resetForm();
      setTab("COACHINGS");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c: CoachingCentre) => {
    setForm({
      name: c.name, code: c.code, emoji: c.emoji || "🏫",
      bannerColor: c.bannerColor || "#6366f1",
      adminEmail: c.adminEmail, tagline: c.tagline || "",
      address: c.address || "", phone: c.phone || "",
    });
    setEditId(c.id);
    setTab("ADD");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Coaching permanently delete karein? Yeh undo nahi ho sakta.")) return;
    await deleteCoaching(id);
  };

  const handleLock = async (c: CoachingCentre) => {
    await updateCoaching(c.id, { locked: !c.locked });
  };

  const handleMarkPaid = async () => {
    if (!paidModal) return;
    const plan = COACHING_SUBSCRIPTION_PLANS[paidTier];
    const now = new Date();
    const paidUntil = new Date(
      paidModal.coaching.subscription.paidUntil
        ? Math.max(new Date(paidModal.coaching.subscription.paidUntil).getTime(), now.getTime())
        : now.getTime()
    );
    paidUntil.setDate(paidUntil.getDate() + plan.days);
    const sub: CoachingSubscription = {
      ...paidModal.coaching.subscription,
      status: "active",
      tier: paidTier,
      monthlyAmount: plan.price,
      paidUntil: paidUntil.toISOString(),
      lastPaidDate: now.toISOString(),
      lastPaidAmount: plan.price,
      paymentNotes: paidNotes.trim() || undefined,
    };
    await updateCoaching(paidModal.coaching.id, { subscription: sub });
    setPaidModal(null);
    setPaidNotes("");
    setPaidTier("MONTHLY");
  };

  const handleSuspend = async (c: CoachingCentre) => {
    const newStatus = c.subscription.status === "suspended" ? "active" : "suspended";
    await updateCoaching(c.id, {
      subscription: { ...c.subscription, status: newStatus },
    });
  };

  const handleAssignAdmin = async () => {
    if (!adminModal || !adminEmailInput.trim()) return;
    setAdminSaving(true);
    setAdminError("");
    try {
      await assignCoachingAdminByEmail(
        adminModal.coaching.id,
        adminEmailInput.trim().toLowerCase(),
        adminRole
      );
      setAdminModal(null);
      setAdminEmailInput("");
    } catch (err: any) {
      setAdminError(err.message || "Kuch galat hua, dobara try karo.");
    } finally {
      setAdminSaving(false);
    }
  };

  const activeCoachings = coachings.filter(c => c.subscription.status === "active");
  // Revenue: use lastPaidAmount if set (new tier-based records), else fall back to monthlyAmount for legacy records
  const stats = {
    total: coachings.length,
    active: activeCoachings.length,
    revenue: activeCoachings.reduce((sum, c) => {
      const sub = c.subscription;
      const amt = sub.lastPaidAmount ?? sub.monthlyAmount ?? 500;
      return sum + amt;
    }, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
              <ArrowLeft size={18} className="text-slate-600" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-black text-slate-800 text-lg leading-tight">🏫 Coaching Super Admin</h1>
            <p className="text-xs text-slate-400">Sabhi coaching centres manage karo</p>
          </div>
          <Crown size={20} className="text-amber-500" />
        </div>

        {/* Stats */}
        <div className="max-w-2xl mx-auto px-4 pb-3 grid grid-cols-3 gap-2">
          {[
            { label: "Total", value: stats.total, icon: Building2, color: "text-violet-600 bg-violet-50" },
            { label: "Active", value: stats.active, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
            { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, color: "text-amber-600 bg-amber-50" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-2.5 ${s.color.split(" ")[1]} flex items-center gap-2`}>
              <s.icon size={16} className={s.color.split(" ")[0]} />
              <div>
                <p className={`font-black text-sm ${s.color.split(" ")[0]}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
          {(["COACHINGS", "ADD"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "COACHINGS") resetForm(); }}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                tab === t ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-500"
              }`}
            >
              {t === "COACHINGS" ? "📋 All Coachings" : editId ? "✏️ Edit" : "➕ New Coaching"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* ── COACHINGS LIST ── */}
        {tab === "COACHINGS" && (
          <>
            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Load ho raha hai...</p>
              </div>
            ) : permError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
                <div className="text-4xl">🔒</div>
                <p className="font-black text-red-700">Firebase Permission Denied</p>
                <p className="text-sm text-red-600">
                  Firestore Security Rules ne <code className="bg-red-100 px-1 rounded">coachings</code> collection ka access block kar diya.
                </p>
                <div className="bg-white border border-red-200 rounded-xl p-4 text-left text-xs font-mono text-slate-700 space-y-1 overflow-auto">
                  <p className="text-slate-400 font-sans font-bold mb-2">Firebase Console → Firestore → Rules mein yeh paste karo:</p>
                  <pre className="whitespace-pre-wrap text-[11px]">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /coachings/{id} {
      allow read, write: if request.auth != null;
    }
    match /coaching_users/{uid} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}</pre>
                </div>
                <p className="text-xs text-slate-500">Rules publish karne ke baad page refresh karo.</p>
              </div>
            ) : coachings.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="text-5xl">🏫</div>
                <p className="text-slate-500 font-bold">Koi coaching nahi mili</p>
                <p className="text-slate-400 text-sm">+ New Coaching tab se add karo</p>
              </div>
            ) : (
              coachings.map(c => (
                <CoachingCard
                  key={c.id}
                  coaching={c}
                  onEdit={() => handleEdit(c)}
                  onDelete={() => handleDelete(c.id)}
                  onLock={() => handleLock(c)}
                  onManageAdmin={() => setAdminModal({ coaching: c })}
                  onMarkPaid={() => setPaidModal({ coaching: c })}
                  onSuspend={() => handleSuspend(c)}
                />
              ))
            )}
          </>
        )}

        {/* ── ADD / EDIT FORM ── */}
        {tab === "ADD" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
            <h2 className="font-black text-slate-800 text-base">
              {editId ? "Coaching Edit Karo" : "Nayi Coaching Add Karo"}
            </h2>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Coaching Name *</span>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Success Point, Brilliant Classes"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Short Code *</span>
                <input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                  placeholder="e.g. SUCCESS_PT"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-violet-400"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Admin Email</span>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={e => setForm(p => ({ ...p, adminEmail: e.target.value }))}
                  placeholder="admin@coachingname.com"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tagline</span>
                <input
                  value={form.tagline}
                  onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
                  placeholder="e.g. Excellence in Education"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Phone</span>
                  <input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Address</span>
                  <input
                    value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="City, State"
                    className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  />
                </label>
              </div>

              {/* Emoji picker */}
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Emoji</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setForm(p => ({ ...p, emoji: e }))}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        form.emoji === e ? "ring-2 ring-violet-500 scale-110" : "bg-slate-50"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Banner Color</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(p => ({ ...p, bannerColor: c }))}
                      className={`w-8 h-8 rounded-xl transition-all ${
                        form.bannerColor === c ? "ring-2 ring-offset-1 ring-violet-500 scale-110" : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setTab("COACHINGS"); resetForm(); }}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.code.trim() || saving}
                className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {editId ? "Update" : "Create Coaching"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mark Paid Modal ── */}
      {paidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">Subscription Assign Karo</h3>
              <button onClick={() => setPaidModal(null)} className="p-1.5 rounded-xl bg-slate-100">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 font-bold">{paidModal.coaching.name}</p>

            {/* Tier selector */}
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Plan Select Karo</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.entries(COACHING_SUBSCRIPTION_PLANS) as [CoachingSubscriptionTier, { label: string; days: number; price: number }][]).map(([tier, plan]) => (
                  <button
                    key={tier}
                    onClick={() => setPaidTier(tier)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      paidTier === tier
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className={`text-xs font-black ${paidTier === tier ? "text-violet-700" : "text-slate-700"}`}>{plan.label}</p>
                    <p className={`text-base font-black ${paidTier === tier ? "text-violet-600" : "text-slate-500"}`}>₹{plan.price}</p>
                    <p className="text-[10px] text-slate-400">{plan.days} din</p>
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Payment Notes (optional)</span>
              <input
                value={paidNotes}
                onChange={e => setPaidNotes(e.target.value)}
                placeholder="e.g. UPI - 9876543210"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setPaidModal(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2"
              >
                <IndianRupee size={14} /> Confirm ₹{COACHING_SUBSCRIPTION_PLANS[paidTier].price}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Admin Modal ── */}
      {adminModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800">Admin Assign Karo</h3>
              <button onClick={() => setAdminModal(null)} className="p-1.5 rounded-xl bg-slate-100">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-500 font-bold">{adminModal.coaching.name}</p>

            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Admin Email *</span>
              <input
                type="email"
                value={adminEmailInput}
                onChange={e => { setAdminEmailInput(e.target.value); setAdminError(""); }}
                placeholder="admin@email.com (IIC app mein registered hona chahiye)"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              />
            </label>

            {adminError && (
              <p className="text-xs text-red-500 font-semibold bg-red-50 rounded-xl px-3 py-2">{adminError}</p>
            )}

            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Role</span>
              <select
                value={adminRole}
                onChange={e => setAdminRole(e.target.value as any)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              >
                <option value="COACHING_ADMIN">Coaching Admin (Full Access)</option>
                <option value="COACHING_SUB_ADMIN">Coaching Sub Admin (Limited)</option>
              </select>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setAdminModal(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignAdmin}
                disabled={!adminEmailInput.trim() || adminSaving}
                className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adminSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus size={14} />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
