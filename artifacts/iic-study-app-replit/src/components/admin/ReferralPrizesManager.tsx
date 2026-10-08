import React, { useState } from 'react';
import {
  ArrowLeft,
  Gift,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Save,
  CheckCircle,
  Award,
  Crown,
  Coins,
  Gem,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { SystemSettings, ReferralMilestone } from '../../types';
import { REFERRAL_MILESTONES, getEffectiveReferralMilestones } from '../../utils/referralEngine';

interface Props {
  settings: SystemSettings;
  onSaveSettings: (updated: SystemSettings) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export const ReferralPrizesManager: React.FC<Props> = ({
  settings,
  onSaveSettings,
  onBack,
  isSaving = false,
}) => {
  // Local state for milestones
  const [milestones, setMilestones] = useState<ReferralMilestone[]>(() => {
    return getEffectiveReferralMilestones(settings?.referralMilestones);
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<ReferralMilestone | null>(null);
  const [isNewMilestone, setIsNewMilestone] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Helper to show transient notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Edit Modal
  const handleEdit = (m: ReferralMilestone) => {
    setEditingMilestone({ ...m });
    setIsNewMilestone(false);
  };

  // Open Add Modal
  const handleAddNew = () => {
    // Find a suggested new target
    const currentTargets = milestones.map((m) => m.target);
    const maxTarget = currentTargets.length > 0 ? Math.max(...currentTargets) : 0;
    const suggestedTarget = maxTarget > 0 ? maxTarget + 10 : 1;

    setEditingMilestone({
      target: suggestedTarget,
      title: `${suggestedTarget} Users Joined`,
      badgeLabel: 'Achiever ⭐',
      rewardType: 'CURRENCY',
      credits: 200,
      diamonds: 10,
      rewardDescription: '+200 Credits & +10 Diamonds 💎',
    });
    setIsNewMilestone(true);
  };

  // Save Modal changes to local state
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;

    if (!editingMilestone.target || editingMilestone.target <= 0) {
      alert('Kripya valid target (minimum 1 active user) daalein.');
      return;
    }

    if (!editingMilestone.title.trim()) {
      alert('Kripya milestone title daalein.');
      return;
    }

    let updatedList: ReferralMilestone[];

    if (isNewMilestone) {
      // Check if target already exists
      if (milestones.some((m) => m.target === editingMilestone.target)) {
        alert(`Target #${editingMilestone.target} pehle se maujood hai! Kripya alag target chunein.`);
        return;
      }
      updatedList = [...milestones, editingMilestone];
    } else {
      updatedList = milestones.map((m) =>
        m.target === editingMilestone.target ? editingMilestone : m
      );
    }

    // Sort by target
    updatedList.sort((a, b) => a.target - b.target);
    setMilestones(updatedList);
    setEditingMilestone(null);
    showToast(isNewMilestone ? '🎉 Naya milestone list me jud gaya! Save par click karein.' : '✏️ Milestone update ho gaya! Save par click karein.');
  };

  // Delete milestone
  const handleDelete = (target: number) => {
    const item = milestones.find((m) => m.target === target);
    if (!window.confirm(`Kya aap "#${target} - ${item?.title || ''}" prize ko delete karna chahte hain?`)) {
      return;
    }
    const updated = milestones.filter((m) => m.target !== target);
    setMilestones(updated);
    showToast('🗑️ Milestone remove ho gaya. Save Settings par click karein.');
  };

  // Reset to default
  const handleResetToDefault = () => {
    setMilestones([...REFERRAL_MILESTONES]);
    setShowResetConfirm(false);
    showToast('🔄 Default 15 Milestones restore ho gaye! Save karein.');
  };

  // Persist to System Settings
  const handleSaveAll = () => {
    const sorted = [...milestones].sort((a, b) => a.target - b.target);
    const updatedSettings: SystemSettings = {
      ...settings,
      referralMilestones: sorted,
    };
    onSaveSettings(updatedSettings);
    showToast('✅ Refer & Earn Prizes successfully save ho gaye!');
  };

  // Auto-generate description helper
  const updateAutoDescription = (draft: ReferralMilestone): string => {
    if (draft.rewardType === 'CURRENCY') {
      const parts: string[] = [];
      if (draft.credits && draft.credits > 0) parts.push(`+${draft.credits.toLocaleString('en-IN')} Credits 🪙`);
      if (draft.diamonds && draft.diamonds > 0) parts.push(`+${draft.diamonds.toLocaleString('en-IN')} Diamonds 💎`);
      return parts.length > 0 ? parts.join(' & ') : 'Special Currency Reward';
    } else {
      const tier = draft.subTier || 'MONTHLY';
      const level = draft.subLevel || 'ULTRA';
      const days = draft.subDurationDays || 30;
      return `Free ${days}-Days ${tier} ${level} Pass 👑`;
    }
  };

  // Stats calculation
  const currencyCount = milestones.filter((m) => m.rewardType === 'CURRENCY').length;
  const subCount = milestones.filter((m) => m.rewardType === 'SUBSCRIPTION').length;
  const minTarget = milestones.length > 0 ? milestones[0].target : 0;
  const maxTarget = milestones.length > 0 ? milestones[milestones.length - 1].target : 0;

  return (
    <div className="bg-slate-50 min-h-[85vh] p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 text-sm font-bold animate-in slide-in-from-bottom-3">
          <Sparkles size={18} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors shadow-sm"
            title="Wapas Jayein"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300/60">
                <Gift size={18} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Refer & Earn Prizes Manager
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Student app ke Refer & Earn section ke sabhi prizes, targets, coins, diamonds aur VIP membership passes ko yahan se badle ya naye jodein.
            </p>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            title="Original 15 Milestones Restore Karein"
          >
            <RotateCcw size={14} className="text-slate-500" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleAddNew}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus size={16} />
            <span>Naya Prize Add Karein</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* QUICK STATS & RULES OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Milestones</span>
            <Award size={16} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-800">{milestones.length}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active Reward Tiers</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Coin & Diamond Prizes</span>
            <Coins size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{currencyCount}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Credits / Diamonds</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">VIP Passes</span>
            <Crown size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-600">{subCount}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Free Subscriptions</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Target Range</span>
            <Sparkles size={16} className="text-emerald-500" />
          </div>
          <p className="text-base sm:text-lg font-black text-slate-800 truncate">
            {minTarget.toLocaleString('en-IN')} - {maxTarget.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active Friends Target</p>
        </div>
      </div>

      {/* HOW IT WORKS BANNER */}
      <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <HelpCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong className="font-black text-blue-950 block mb-0.5">Active Friend Rule:</strong>
          Jab koi dost student ke referral code se join karta hai aur app me <strong>1 ghanta (60 minutes) study</strong> complete kar leta hai, toh wo <strong>Active Friend</strong> count hota hai. Yahan set kiye gaye targets achieve hone par student prize claim kar sakta hai!
        </div>
      </div>

      {/* MILESTONES LIST TABLE / CARDS */}
      <div className="space-y-3">
        {milestones.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
            <Gift size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">Koi bhi referral milestone nahi hai.</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Naya add karein ya default 15 milestones restore karein.</p>
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs"
            >
              Default Milestones Restore Karein
            </button>
          </div>
        ) : (
          milestones.map((m, index) => {
            const isSub = m.rewardType === 'SUBSCRIPTION';

            return (
              <div
                key={m.target}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
              >
                {/* Left side: Target badge + title + badge label */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 font-black text-sm flex flex-col items-center justify-center shrink-0 border border-slate-800 shadow-sm font-mono">
                    <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Target</span>
                    <span>{m.target.toLocaleString('en-IN')}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-black text-slate-900">
                        {m.title}
                      </h4>
                      {m.badgeLabel && (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                          {m.badgeLabel}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isSub
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isSub ? 'VIP Pass 👑' : 'Currency 🪙'}
                      </span>
                    </div>

                    {/* Reward description */}
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 text-xs">Reward:</span>
                      <strong className="text-slate-800">{m.rewardDescription}</strong>
                    </p>

                    {/* Meta details */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                      {m.credits !== undefined && m.credits > 0 && (
                        <span className="flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                          <Coins size={12} className="text-amber-500" />
                          {m.credits.toLocaleString('en-IN')} Credits
                        </span>
                      )}
                      {m.diamonds !== undefined && m.diamonds > 0 && (
                        <span className="flex items-center gap-1 font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200/60">
                          <Gem size={12} className="text-cyan-500" />
                          {m.diamonds.toLocaleString('en-IN')} Diamonds
                        </span>
                      )}
                      {isSub && (
                        <span className="flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                          <Zap size={12} className="text-purple-500" />
                          {m.subTier} {m.subLevel} ({m.subDurationDays || 7} Days)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleEdit(m)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    title="Milestone Edit Karein"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(m.target)}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-colors"
                    title="Milestone Delete Karein"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* BOTTOM SAVE BAR */}
      <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
        <p className="text-xs text-slate-500 font-medium">
          Sabhi badlaav live app me turant reflect hone ke liye <strong>Save Settings</strong> par click karein.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* EDIT / ADD MODAL */}
      {editingMilestone && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Gift size={18} />
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {isNewMilestone ? 'Naya Referral Prize Add Karein' : `Edit Prize: #${editingMilestone.target}`}
                </h3>
              </div>
              <button
                onClick={() => setEditingMilestone(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* TARGET (ACTIVE USERS REQUIRED) */}
              <div>
                <label className="text-xs font-black uppercase text-slate-600 block mb-1">
                  Active Users Target (Doston ki sankhya) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={!isNewMilestone}
                    value={editingMilestone.target}
                    onChange={(e) => {
                      const t = parseInt(e.target.value, 10) || 0;
                      setEditingMilestone({
                        ...editingMilestone,
                        target: t,
                        title: isNewMilestone ? `${t} Users Joined` : editingMilestone.title,
                      });
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border font-bold text-sm bg-white ${
                      !isNewMilestone ? 'bg-slate-100 text-slate-500 border-slate-200' : 'border-slate-300 focus:border-amber-500'
                    }`}
                    placeholder="e.g. 5, 50, 100, 1000"
                  />
                  {!isNewMilestone && (
                    <span className="absolute right-3 top-3 text-[10px] font-bold text-slate-400">
                      Target Locked
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kitne active friends par yeh prize unlock hoga.
                </p>
              </div>

              {/* TITLE */}
              <div>
                <label className="text-xs font-black uppercase text-slate-600 block mb-1">
                  Milestone Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingMilestone.title}
                  onChange={(e) =>
                    setEditingMilestone({ ...editingMilestone, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-sm focus:border-amber-500"
                  placeholder="e.g. 50 Users Joined"
                />
              </div>

              {/* BADGE LABEL */}
              <div>
                <label className="text-xs font-black uppercase text-slate-600 block mb-1">
                  Badge / Tag Label
                </label>
                <input
                  type="text"
                  value={editingMilestone.badgeLabel || ''}
                  onChange={(e) =>
                    setEditingMilestone({ ...editingMilestone, badgeLabel: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-sm focus:border-amber-500"
                  placeholder="e.g. Starter 🚀, Gold 🥇, Legend 👑"
                />
              </div>

              {/* REWARD TYPE SELECTOR */}
              <div>
                <label className="text-xs font-black uppercase text-slate-600 block mb-1.5">
                  Reward Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated: ReferralMilestone = {
                        ...editingMilestone,
                        rewardType: 'CURRENCY',
                        credits: editingMilestone.credits || 100,
                        diamonds: editingMilestone.diamonds || 5,
                        subTier: undefined,
                        subLevel: undefined,
                        subDurationDays: undefined,
                      };
                      updated.rewardDescription = updateAutoDescription(updated);
                      setEditingMilestone(updated);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      editingMilestone.rewardType === 'CURRENCY'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Coins size={14} />
                    <span>Credits & Diamonds</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated: ReferralMilestone = {
                        ...editingMilestone,
                        rewardType: 'SUBSCRIPTION',
                        subTier: editingMilestone.subTier || 'MONTHLY',
                        subLevel: editingMilestone.subLevel || 'ULTRA',
                        subDurationDays: editingMilestone.subDurationDays || 30,
                        credits: undefined,
                        diamonds: undefined,
                      };
                      updated.rewardDescription = updateAutoDescription(updated);
                      setEditingMilestone(updated);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      editingMilestone.rewardType === 'SUBSCRIPTION'
                        ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Crown size={14} />
                    <span>Free VIP Subscription</span>
                  </button>
                </div>
              </div>

              {/* REWARD TYPE SPECIFIC FIELDS */}
              {editingMilestone.rewardType === 'CURRENCY' ? (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <div>
                    <label className="text-[11px] font-black uppercase text-amber-900 block mb-1">
                      Credits (Coins 🪙)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingMilestone.credits || 0}
                      onChange={(e) => {
                        const c = parseInt(e.target.value, 10) || 0;
                        const updated = { ...editingMilestone, credits: c };
                        updated.rewardDescription = updateAutoDescription(updated);
                        setEditingMilestone(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold text-sm bg-white"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase text-amber-900 block mb-1">
                      Diamonds (💎)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingMilestone.diamonds || 0}
                      onChange={(e) => {
                        const d = parseInt(e.target.value, 10) || 0;
                        const updated = { ...editingMilestone, diamonds: d };
                        updated.rewardDescription = updateAutoDescription(updated);
                        setEditingMilestone(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold text-sm bg-white"
                      placeholder="e.g. 20"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-black uppercase text-purple-900 block mb-1">
                        Subscription Tier
                      </label>
                      <select
                        value={editingMilestone.subTier || 'MONTHLY'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          const days = val === 'WEEKLY' ? 7 : val === 'MONTHLY' ? 30 : val === '3_MONTHLY' ? 90 : val === 'YEARLY' ? 365 : 30;
                          const updated: ReferralMilestone = {
                            ...editingMilestone,
                            subTier: val,
                            subDurationDays: days,
                          };
                          updated.rewardDescription = updateAutoDescription(updated);
                          setEditingMilestone(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-purple-300 font-bold text-xs bg-white"
                      >
                        <option value="WEEKLY">WEEKLY (7 Days)</option>
                        <option value="MONTHLY">MONTHLY (30 Days)</option>
                        <option value="3_MONTHLY">3 MONTHLY (90 Days)</option>
                        <option value="YEARLY">YEARLY (365 Days)</option>
                        <option value="CUSTOM">CUSTOM DURATION</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase text-purple-900 block mb-1">
                        Plan Level
                      </label>
                      <select
                        value={editingMilestone.subLevel || 'ULTRA'}
                        onChange={(e) => {
                          const updated: ReferralMilestone = {
                            ...editingMilestone,
                            subLevel: e.target.value as any,
                          };
                          updated.rewardDescription = updateAutoDescription(updated);
                          setEditingMilestone(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-purple-300 font-bold text-xs bg-white"
                      >
                        <option value="ULTRA">ULTRA (VIP All Access 👑)</option>
                        <option value="BASIC">BASIC (Standard ⚡)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase text-purple-900 block mb-1">
                      Duration in Days (Kitne din ka pass milega)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingMilestone.subDurationDays || 7}
                      onChange={(e) => {
                        const d = parseInt(e.target.value, 10) || 1;
                        const updated = { ...editingMilestone, subDurationDays: d };
                        updated.rewardDescription = updateAutoDescription(updated);
                        setEditingMilestone(updated);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 font-bold text-sm bg-white"
                      placeholder="e.g. 7, 30, 365"
                    />
                  </div>
                </div>
              )}

              {/* REWARD DESCRIPTION (STUDENT VISIBLE) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase text-slate-600 block">
                    Reward Description (Student ko dikhega) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMilestone({
                        ...editingMilestone,
                        rewardDescription: updateAutoDescription(editingMilestone),
                      });
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Auto Generate Text
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingMilestone.rewardDescription}
                  onChange={(e) =>
                    setEditingMilestone({
                      ...editingMilestone,
                      rewardDescription: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-sm focus:border-amber-500"
                  placeholder="e.g. +500 Credits & +20 Diamonds 💎"
                />
              </div>

              {/* MODAL ACTION BUTTONS */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingMilestone(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md"
                >
                  {isNewMilestone ? 'Add Milestone' : 'Update Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertCircle size={24} />
              <h3 className="text-lg font-black text-slate-900">Reset to Defaults?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Kya aap sach me sabhi custom referral milestones ko hata kar <strong>original 15 standard milestones</strong> (1 user se lekar 50,000 users tak) restore karna chahte hain?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 shadow-md"
              >
                Haan, Reset Karein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
