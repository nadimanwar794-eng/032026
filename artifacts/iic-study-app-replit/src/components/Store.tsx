// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, CreditPackage, SystemSettings } from '../types';
import {
  Sparkles, Check, MessageSquare, Lock, Ticket, ShieldCheck, Star,
  ChevronRight, Flame, BadgeCheck, History, TrendingDown,
  Calendar, Clock, Crown, DollarSign, ArrowLeft, Zap, Gift, Coins,
  Package, Wallet, X
} from 'lucide-react';
import { saveUserToLive } from '../firebase';
import { getLevelInfo, getScoreDiscountFromScore, getNextLevelInfo, getLevelProgress, getLevelDailyLimitsWithOverride, UNLIMITED } from '../utils/levelSystem';
import { SCORE_MULTIPLIERS, getDailyScoreLimit, getUserScoreMultiplier } from '../utils/scoreSystem';
import { addSubscription } from '../utils/subscriptionUtils';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { recordCreditTx } from '../utils/creditHistory';
import {
  loadRoutineData, saveRoutineData, checkAndResetDaily,
  getUserSubTier, ensureTodayClaimEntry, claimAllPendingCoins,
  getUnclaimedCoins, getDailyClaimAmount, DAILY_CLAIM_PRO, DAILY_CLAIM_MAX_PRO,
  type UserSubTier,
} from '../utils/routineStorage';
import {
  getCreditSubPlans,
  isCreditSubActive,
  canClaimCreditSubToday,
  getCreditSubDaysRemaining,
  claimDailyCreditSub,
  CREDIT_SUB_DURATIONS,
  type CreditSubDurationId,
  calculateCreditSubPrice,
  getCreditSubPlanMultiplier,
} from '../utils/creditSubscriptionUtils';

interface Props {
  user: User;
  settings?: SystemSettings;
  onUserUpdate: (user: User) => void;
  renderEarnContent?: React.ReactNode;
  onBack?: () => void;
  themeColor?: string;
  tierTheme?: any;
}

/* ─── Fixed color palette ─── */
const C = {
  bg:           '#07070e',
  surface:      '#0f0f1a',
  surfaceHigh:  '#181826',
  surfaceMid:   '#13131f',
  border:       'rgba(255,255,255,0.07)',
  borderMed:    'rgba(255,255,255,0.13)',
  text:         '#f1f5f9',
  textMuted:    '#64748b',
  textDim:      '#2d3748',

  pro:          '#22d3ee',
  proBg:        'rgba(34,211,238,0.08)',
  proBorder:    'rgba(34,211,238,0.30)',
  proGlow:      'rgba(34,211,238,0.20)',
  proGrad:      'linear-gradient(135deg,#0891b2 0%,#22d3ee 60%,#67e8f9 100%)',

  max:          '#c084fc',
  maxBg:        'rgba(192,132,252,0.08)',
  maxBorder:    'rgba(192,132,252,0.30)',
  maxGlow:      'rgba(192,132,252,0.20)',
  maxGrad:      'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#e879f9 100%)',

  gold:         '#fbbf24',
  goldBg:       'rgba(251,191,36,0.10)',
  goldBorder:   'rgba(251,191,36,0.28)',

  earn:         '#34d399',
  earnBg:       'rgba(52,211,153,0.08)',
  earnBorder:   'rgba(52,211,153,0.28)',

  green:        '#34d399',
  greenBg:      'rgba(52,211,153,0.09)',
  greenBorder:  'rgba(52,211,153,0.30)',
};

/* ─── Subscription History ─── */
const SubHistory: React.FC<{ user: User; onBack: () => void }> = ({ user, onBack }) => {
  const history = user.subscriptionHistory || [];
  const totalPaid = history.reduce((s, i) => s + i.price, 0);
  const totalFree = history.reduce((s, i) => i.isFree ? s + i.originalPrice : s, 0);
  const sorted = [...history].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="min-h-screen pb-28 animate-in fade-in slide-in-from-right duration-300" style={{ background: C.bg }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-5" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: C.surfaceHigh, border: `1px solid ${C.borderMed}` }}>
            <ArrowLeft size={18} color={C.text} />
          </button>
          <div>
            <h2 className="text-lg font-black" style={{ color: C.text }}>Subscription History</h2>
            <p className="text-[11px] font-medium" style={{ color: C.textMuted }}>Aapke sabhi plans ka record</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {history.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(52,211,153,0.2)' }}>
                <TrendingDown size={16} color={C.green} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>Total Paid</p>
              <p className="text-2xl font-black" style={{ color: C.text }}>₹{totalPaid}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: C.proBg, border: `1px solid ${C.proBorder}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(34,211,238,0.2)' }}>
                <Gift size={16} color={C.pro} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>Free Value</p>
              <p className="text-2xl font-black" style={{ color: C.pro }}>₹{totalFree}</p>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: C.textMuted }}>
            <History size={12} /> Recent Plans
          </p>
          {sorted.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
              <Crown size={38} className="mx-auto mb-3" style={{ color: C.textDim }} />
              <p className="font-bold text-sm mb-1" style={{ color: C.textMuted }}>Abhi tak koi plan nahi</p>
              <p className="text-xs" style={{ color: C.textDim }}>Pehla plan lo — yahan record aayega</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sorted.map((item) => (
                <div key={item.id} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: item.isFree ? C.greenBg : C.maxBg }}>
                      {item.isFree ? <Gift size={18} color={C.green} /> : <DollarSign size={18} color={C.max} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm" style={{ color: C.text }}>
                        {item.tier === 'LIFETIME' ? 'Lifetime Access' : `${item.durationHours < 24 ? item.durationHours + ' Hours' : Math.ceil(item.durationHours / 24) + ' Days'} Plan`}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>{item.level} · {item.grantSource}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm" style={{ color: item.isFree ? C.green : C.text }}>
                        {item.isFree ? 'FREE' : `₹${item.price}`}
                      </p>
                      {item.isFree && <p className="text-[10px] line-through" style={{ color: C.textDim }}>₹{item.originalPrice}</p>}
                    </div>
                  </div>
                  <div className="flex justify-between rounded-xl px-3 py-2" style={{ background: C.surfaceHigh }}>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                      <Calendar size={10} />
                      <span>{new Date(item.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                      <Clock size={10} />
                      <span>{item.tier === 'LIFETIME' ? 'Forever' : new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Credit price helper ─── */
function getCreditPrice(planDuration: string, isUltra: boolean, plan?: any, settings?: SystemSettings): number {
  // Check if this specific plan has an explicit credit price set by admin
  if (plan) {
    if (isUltra && typeof plan.creditPriceUltra === 'number' && plan.creditPriceUltra > 0) {
      return plan.creditPriceUltra;
    }
    if (!isUltra && typeof plan.creditPriceBasic === 'number' && plan.creditPriceBasic > 0) {
      return plan.creditPriceBasic;
    }
  }

  const d = (planDuration || '').toLowerCase();
  const sp = settings?.subscriptionCreditPrices;

  if (d.includes('year') || d.includes('365') || d.includes('annual') || d.includes('1 yr')) {
    if (isUltra && typeof sp?.yearlyUltra === 'number' && sp.yearlyUltra > 0) return sp.yearlyUltra;
    if (!isUltra && typeof sp?.yearlyBasic === 'number' && sp.yearlyBasic > 0) return sp.yearlyBasic;
    return isUltra ? 100000 : 75000;
  } else if (d.includes('3 month') || d.includes('90') || d.includes('quarter') || d.includes('tri')) {
    if (isUltra && typeof sp?.threeMonthUltra === 'number' && sp.threeMonthUltra > 0) return sp.threeMonthUltra;
    if (!isUltra && typeof sp?.threeMonthBasic === 'number' && sp.threeMonthBasic > 0) return sp.threeMonthBasic;
    return isUltra ? 30000 : 22500;
  } else if (d.includes('month') || d.includes('30')) {
    if (isUltra && typeof sp?.monthlyUltra === 'number' && sp.monthlyUltra > 0) return sp.monthlyUltra;
    if (!isUltra && typeof sp?.monthlyBasic === 'number' && sp.monthlyBasic > 0) return sp.monthlyBasic;
    return isUltra ? 12000 : 9000;
  } else if (d.includes('week') || d.includes('7')) {
    if (isUltra && typeof sp?.weeklyUltra === 'number' && sp.weeklyUltra > 0) return sp.weeklyUltra;
    if (!isUltra && typeof sp?.weeklyBasic === 'number' && sp.weeklyBasic > 0) return sp.weeklyBasic;
    return isUltra ? 4000 : 3000;
  }

  const base = isUltra ? 3500 : 2625;
  return base;
}

function isDiscountEventLive(discountEvent?: any): boolean {
  if (!discountEvent?.enabled) return false;
  const now = Date.now();
  const startsAt = discountEvent.startsAt ? new Date(discountEvent.startsAt).getTime() : 0;
  const endsAt = discountEvent.endsAt ? new Date(discountEvent.endsAt).getTime() : Infinity;
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return false;
  return now >= startsAt && now < endsAt;
}

function isDiscountAudienceAllowed(discountEvent: any, isSubscribed: boolean): boolean {
  return isSubscribed
    ? discountEvent?.showToPremiumUsers !== false
    : discountEvent?.showToFreeUsers !== false;
}

/* ─── Main Store ─── */
/* ─── Specific Tier Daily Subscription Coin Claim Card (Pro on Pro, Max on Max) ─── */
function TierDailyClaimCard({
  targetTier,
  userId,
  user: u,
  settings,
  onUpdateUser,
}: {
  targetTier: 'PRO' | 'MAX_PRO';
  userId: string;
  user: any;
  settings?: SystemSettings;
  onUpdateUser?: (u: any) => void;
}) {
  function getToday() { return new Date().toISOString().split('T')[0]; }
  const subTier: UserSubTier = getUserSubTier(u ?? {});
  const [routineData, setRoutineDataRaw] = useState(() => {
    const d = loadRoutineData(userId);
    const reset = checkAndResetDaily(d);
    return ensureTodayClaimEntry(reset, getUserSubTier(u ?? {}), settings);
  });

  const unclaimed = getUnclaimedCoins(routineData, targetTier);
  const isTargetActive = subTier === targetTier;

  // Only render if user has this active subscription tier OR has unclaimed stacked coins from it
  if (!isTargetActive && unclaimed <= 0) {
    return null;
  }

  const dailyAmt = getDailyClaimAmount(targetTier, settings);
  const isMax = targetTier === 'MAX_PRO';
  const grad = isMax ? 'linear-gradient(135deg,#7c3aed,#a855f7,#e879f9)' : 'linear-gradient(135deg,#0891b2,#22d3ee,#67e8f9)';
  const borderC = isMax ? C.maxBorder : C.proBorder;
  const bgC = isMax ? C.maxBg : C.proBg;
  const label = isMax ? 'Max' : 'Pro';

  const handleClaim = async () => {
    const { data: updated, earned } = claimAllPendingCoins(routineData, targetTier);
    // Add earned coins to main app credits
    if (earned > 0 && onUpdateUser && u) {
      const updatedUser = { ...u, credits: (u.credits || 0) + earned };
      if (!await saveUserToLive(updatedUser)) {
        window.alert("Coins save nahi ho paaye. Internet check karke dobara try karein.");
        return;
      }
      onUpdateUser(updatedUser);
    }
    setRoutineDataRaw(updated);
    saveRoutineData(userId, updated);
  };

  return (
    <div className="rounded-2xl p-4 mb-5 shadow-md" style={{ background: bgC, border: `1.5px solid ${borderC}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: grad }}>
            <Gift size={15} color="#fff" />
          </div>
          <div>
            <p className="text-xs font-black" style={{ color: C.text }}>{label} Daily Reward</p>
            <p className="text-[10px] font-medium" style={{ color: C.textMuted }}>Roz {dailyAmt} 🪙 · Kabhi expire nahi</p>
          </div>
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBorder}` }}>
          🪙 {dailyAmt}
        </span>
      </div>
      {unclaimed > 0 ? (
        <>
          {unclaimed > dailyAmt && (
            <div className="rounded-xl px-3 py-2 mb-3 flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.10)', border: `1px solid ${C.goldBorder}` }}>
              <p className="text-[10px] font-black" style={{ color: C.gold }}>
                {Math.floor(unclaimed / dailyAmt)} din ka stack = {unclaimed} 🪙!
              </p>
            </div>
          )}
          <button onClick={handleClaim}
            className="w-full py-3 rounded-xl font-black text-sm active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-lg"
            style={{ background: grad, color: '#fff', boxShadow: isMax ? '0 4px 14px rgba(168,85,247,0.35)' : '0 4px 14px rgba(34,211,238,0.25)' }}>
            <Gift size={15} /> Claim {unclaimed} 🪙 Karo
          </button>
        </>
      ) : (
        <div className="py-2.5 rounded-xl flex items-center justify-center gap-2"
          style={{ background: 'rgba(52,211,153,0.10)', border: `1px solid ${C.greenBorder}` }}>
          <Check size={14} color={C.green} />
          <span className="text-xs font-black" style={{ color: C.green }}>Aaj ka {label} Daily Reward claim ho gaya! ({dailyAmt} 🪙) ✅</span>
        </div>
      )}
    </div>
  );
}

export const Store: React.FC<Props> = ({ user, settings, onUserUpdate, onBack }) => {
  const [tierType, setTierType] = useState<'FREE' | 'BASIC' | 'ULTRA' | 'CREDITS' | 'HISTORY'>(() =>
    user.isPremium
      ? ((user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO') ? 'ULTRA' : 'BASIC')
      : 'FREE'
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const packages = settings?.packages || [];
  const subscriptionPlans = settings?.subscriptionPlans || [];
  const isCreditSubAllowed = settings?.allowCreditSubscription !== false;
  const [creditSubTab, setCreditSubTab] = useState<'PASS' | 'PACKAGES'>('PASS');
  const [creditSubDuration, setCreditSubDuration] = useState<CreditSubDurationId>('1_MONTH');
  const [claimingStorePass, setClaimingStorePass] = useState(false);
  const [passClaimSuccessMsg, setPassClaimSuccessMsg] = useState<string | null>(null);

  const handleClaimStorePass = async () => {
    if (!user || claimingStorePass) return;
    setClaimingStorePass(true);
    try {
      const res = claimDailyCreditSub(user);
      if (res) {
        const ok = await saveUserToLive(res.updatedUser);
        if (ok) {
          onUserUpdate(res.updatedUser);
          setPassClaimSuccessMsg(`🎉 +${res.earned} Daily Credits Claim Ho Gaye! Naya Balance: ${(res.updatedUser.credits || 0).toLocaleString('en-IN')} CR 🪙`);
          setTimeout(() => setPassClaimSuccessMsg(null), 6000);
        }
      }
    } finally {
      setClaimingStorePass(false);
    }
  };

  const totalScore = user.totalScore || 0;
  const scoreDiscount = getScoreDiscountFromScore(totalScore);
  const scoreTier = getLevelInfo(totalScore);

  const activeStoreDiscount =
    (user.storeDiscount && user.storeDiscount > 0 && scoreTier.level <= 4 && totalScore >= 100)
      ? user.storeDiscount : 0;

  const [visitCount, setVisitCount] = useState<number>(0);
  const visitDiscountRules = settings?.storeVisitDiscountRules || [];
  const visitDiscountEnabled = !!(settings?.storeVisitDiscountEnabled && visitDiscountRules.length > 0);
  const userSubTier: 'FREE' | 'BASIC' | 'ULTRA' =
    (user as any).subscriptionLevel === 'ULTRA' ? 'ULTRA'
    : (user as any).subscriptionLevel === 'BASIC' ? 'BASIC' : 'FREE';
  const eligibleTiers: ('FREE' | 'BASIC' | 'ULTRA')[] = settings?.storeVisitDiscountTiers || ['FREE'];
  const isEligibleForVisitDiscount = visitDiscountEnabled && eligibleTiers.includes(userSubTier);
  const visitDiscount = isEligibleForVisitDiscount
    ? (visitDiscountRules.filter(r => visitCount >= r.visits).sort((a, b) => b.discountPercent - a.discountPercent)[0]?.discountPercent || 0)
    : 0;

  useEffect(() => {
    if (!visitDiscountEnabled) return;
    const key = `store_visit_total_${user.id}`;
    const prev = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, String(prev + 1));
    setVisitCount(prev + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (subscriptionPlans.length > 0 && !selectedPlanId) {
      const defaultPlan = subscriptionPlans.find(p => p.name.includes('Monthly')) || subscriptionPlans[0];
      setSelectedPlanId(defaultPlan.id);
    }
  }, [subscriptionPlans]);

  const selectedPlan = subscriptionPlans.find(p => p.id === selectedPlanId);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<any>(null);

  const event = settings?.specialDiscountEvent;
  const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();

  const isEventActive = () => {
    return isDiscountEventLive(event);
  };
  const isCooldownPhase = () => {
    if (!event?.enabled || !event.startsAt) return false;
    return Date.now() < new Date(event.startsAt).getTime();
  };
  const activeEvent = isEventActive();
  const inCooldown = isCooldownPhase();
  const showEventBanner = activeEvent || inCooldown;

  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  useEffect(() => {
    if (!event?.enabled || (!event?.startsAt && !event?.endsAt)) { setTimeLeft(null); return; }
    const calc = () => {
      const now = Date.now();
      const start = event.startsAt ? new Date(event.startsAt).getTime() : 0;
      const end   = event.endsAt   ? new Date(event.endsAt).getTime()   : 0;
      let diff = 0;
      if (now < start) diff = start - now;
      else if (start === end && now >= start) { setTimeLeft(null); return; }
      else if (now < end) diff = end - now;
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({ days: Math.floor(diff/86400000), hours: Math.floor((diff%86400000)/3600000), minutes: Math.floor((diff%3600000)/60000), seconds: Math.floor((diff%60000)/1000) });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [event]);

  const [creditPurchaseMsg, setCreditPurchaseMsg] = useState<string | null>(null);
  const [showPaymentChooser, setShowPaymentChooser] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [creditConfirmLoading, setCreditConfirmLoading] = useState(false);

  const handleCreditPurchase = async (plan: any) => {
    if (!isCreditSubAllowed) {
      setCreditPurchaseMsg('❌ Admin ne credits se subscription khareedna band kiya hua hai.');
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
      return;
    }
    const isUltra = tierType === 'ULTRA';
    const dur = (plan.duration || '').toLowerCase();
    const pName = (plan.name || '').toLowerCase();
    if (pName.includes('lifetime') || dur.includes('lifetime') || plan.tier === 'LIFETIME') {
      setCreditPurchaseMsg('❌ Lifetime plan credits se nahi kharida ja sakta.');
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
      return;
    }
    const creditCost = getPlanCreditCost(plan, isUltra);
    const userCredits = getTotalCredits(user);
    if (userCredits < creditCost) {
      setCreditPurchaseMsg(`Credits kam hain! Chahiye: ${creditCost.toLocaleString('en-IN')} CR`);
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
      return;
    }

    const now = new Date();
    let days = 30;
    if (dur.includes('year') || dur.includes('365') || dur.includes('annual')) days = 365;
    else if (dur.includes('3 month') || dur.includes('90') || dur.includes('quarter')) days = 90;
    else if (dur.includes('month') || dur.includes('30')) days = 30;
    else if (dur.includes('week') || dur.includes('7')) days = 7;

    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const subTier = days <= 7 ? 'WEEKLY' : days <= 30 ? 'MONTHLY' : days <= 90 ? '3_MONTHLY' : 'YEARLY';
    const subLevel = isUltra ? 'ULTRA' : 'BASIC';
    const newSub = { id: `sub_${Date.now()}`, tier: subTier, level: subLevel, startDate: now.toISOString(), endDate: endDate.toISOString(), source: 'CREDITS' };
    const histEntry = {
      id: `hist-${Date.now()}`, tier: subTier, level: subLevel,
      startDate: now.toISOString(), endDate: endDate.toISOString(),
      durationHours: days * 24, price: 0, originalPrice: creditCost, isFree: false, grantSource: 'CREDITS'
    };
    // Deduct from the same credit pools used everywhere else (permanent,
    // legacy bonus, and active gifted credits). The old path only subtracted
    // from `credits`, so users could pass the balance check with bonus/gifted
    // credits but receive an inconsistent account state.
    const deductedUser = applyDeduction(user, creditCost);
    if (!deductedUser) {
      setCreditPurchaseMsg(`Credits kam hain! Chahiye: ${creditCost.toLocaleString('en-IN')} CR`);
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
      return;
    }

    const baseUser = {
      ...deductedUser,
      isPremium: true,
      subscriptionSource: 'CREDITS',
      grantedByAdmin: false,
      subscriptionHistory: [histEntry, ...(user.subscriptionHistory || [])],
    };
    const updatedUser = addSubscription(baseUser, newSub as any);

    try {
      setCreditConfirmLoading(true);
      if (!await saveUserToLive(updatedUser)) throw new Error('Subscription purchase could not be saved to the backend.');
      onUserUpdate(updatedUser);
      // Record in credit history so it appears in Store → History tab
      try {
        const planLabel = isUltra ? 'MAX (Ultra)' : 'PRO (Basic)';
        const durLabel = days === 365 ? '1 Saal' : days === 90 ? '3 Mahine' : days === 30 ? '1 Mahina' : `${days} Din`;
        recordCreditTx(
          user.id,
          -creditCost,
          'SPEND_SUBSCRIPTION',
          `Subscription Kharida: ${planLabel} — ${durLabel}`,
          updatedUser.credits,
        );
      } catch {}
      setShowCreditConfirm(false);
      setShowPaymentChooser(false);
      setCreditPurchaseMsg(`✅ ${isUltra ? 'MAX' : 'PRO'} Plan activate! ${days} din ke liye. (${creditCost.toLocaleString('en-IN')} CR kata)`);
      setTimeout(() => setCreditPurchaseMsg(null), 5000);
    } catch {
      setCreditPurchaseMsg('❌ Kuch galat hua. Dobara try karo.');
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
    } finally {
      setCreditConfirmLoading(false);
    }
  };

  const handleSupportClick = (numEntry: any) => {
    if (!purchaseItem) return;
    if (purchaseItem.isCreditSub || purchaseItem.dailyCredits !== undefined) {
      const price = purchaseItem.finalPrice !== undefined ? purchaseItem.finalPrice : purchaseItem.price;
      const totalCreds = (purchaseItem.dailyCredits || 0) * (purchaseItem.durationDays || 30);
      const discountDetails = purchaseItem.discountPercent > 0
        ? `\nDiscount Applied: ${purchaseItem.discountPercent}% OFF`
        : '';
      const durationText = purchaseItem.durationLabel
        ? `${purchaseItem.durationLabel} (${purchaseItem.durationDays || 30} Days)`
        : `${purchaseItem.durationDays || 30} Days`;
      const msg = `Hello Admin, I want to subscribe to Daily Credit Pass:\n\nPlan: ${purchaseItem.name}\nPrice: ₹${price}${discountDetails}\nDaily Credits: ${purchaseItem.dailyCredits} CR/day\nValidity: ${durationText} (Total ${totalCreds.toLocaleString('en-IN')} Credits)\nUser ID: ${user.id}\nNote: Daily Credits Subscription (No Premium Content Unlock)\n\nPlease share payment details / activate my pass.`;
      window.open(`https://wa.me/91${numEntry.number}?text=${encodeURIComponent(msg)}`, '_blank');
      setShowSupportModal(false);
      return;
    }
    const isSub = purchaseItem.duration !== undefined;
    const price = isSub
      ? (purchaseItem.finalPrice !== undefined ? purchaseItem.finalPrice : (tierType === 'BASIC' ? purchaseItem.basicPrice : purchaseItem.ultraPrice))
      : purchaseItem.price;
    const features = isSub ? (tierType === 'BASIC' ? 'MCQ + Notes (Pro)' : 'PDF + Videos + AI Studio (Max)') : `${purchaseItem.credits} Credits`;
    const discountNote = isSub && totalDiscount > 0 ? `\nDiscount Applied: ${totalDiscount}% OFF` : '';
    const msg = `Hello Admin, I want to buy:\n\nItem: ${purchaseItem.name} ${isSub ? `(${tierType === 'BASIC' ? 'PRO' : 'MAX'})` : ''}\nPrice: ₹${price}${discountNote}\nUser ID: ${user.id}\nDetails: ${features}\n\nPlease share payment details.`;
    window.open(`https://wa.me/91${numEntry.number}?text=${encodeURIComponent(msg)}`, '_blank');
    setShowSupportModal(false);
  };
  const initiatePurchase = (item: any) => { setPurchaseItem(item); setShowSupportModal(true); };


  const isFreeTab = tierType === 'FREE';
  const isPro = tierType === 'BASIC';
  const isBasicTab = tierType === 'BASIC';
  const isUltraTab = tierType === 'ULTRA';
  const isCreditsTab = tierType === 'CREDITS';
  const isHistoryTab = tierType === 'HISTORY';

  const ac = isFreeTab
    ? { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', glow: 'rgba(148,163,184,0.18)', grad: 'linear-gradient(135deg,#64748b,#94a3b8)', pill: 'rgba(148,163,184,0.14)', label: 'FREE', emoji: '🎯' }
    : isPro
    ? { color: C.pro, bg: C.proBg, border: C.proBorder, glow: C.proGlow, grad: C.proGrad, pill: 'rgba(34,211,238,0.14)', label: 'PRO', emoji: '⭐' }
    : isCreditsTab
    ? { color: C.gold, bg: C.goldBg, border: C.goldBorder, glow: 'rgba(251,191,36,0.22)', grad: 'linear-gradient(135deg,#d97706,#fbbf24)', pill: 'rgba(251,191,36,0.14)', label: 'CREDITS', emoji: '🪙' }
    : { color: C.max, bg: C.maxBg, border: C.maxBorder, glow: C.maxGlow, grad: C.maxGrad, pill: 'rgba(192,132,252,0.14)', label: 'MAX', emoji: '⚡' };

  // Row 2 tabs: Free, Pro, Max, Credits, and History
  const allTabs = [
    { id: 'FREE'    as const, label: 'Free',    emoji: '🎯', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', glow: 'rgba(148,163,184,0.18)' },
    { id: 'BASIC'   as const, label: 'Pro',     emoji: '⭐', color: C.pro,    bg: C.proBg,                  border: C.proBorder,            glow: C.proGlow  },
    { id: 'ULTRA'   as const, label: 'Max',     emoji: '⚡', color: C.max,    bg: C.maxBg,                  border: C.maxBorder,            glow: C.maxGlow  },
    { id: 'CREDITS' as const, label: 'Credits', emoji: '🪙', color: C.gold,   bg: C.goldBg,                 border: C.goldBorder,           glow: 'rgba(251,191,36,0.22)' },
  ];

  const isUltraUser = user.isPremium && (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO');
  const isBasicUser = user.isPremium && user.subscriptionLevel === 'BASIC';

  const totalDiscount = (() => {
    let d = 0;
    if (activeEvent && event?.discountPercent) d += event.discountPercent;
    // Active subscription discount on Pro & Max plans: Ultra members get 10% OFF, Basic/Pro get 5% OFF
    if (isSubscribed) {
      d += isUltraUser ? 10 : 5;
    }
    if (activeStoreDiscount > 0) d += activeStoreDiscount;
    if (scoreDiscount > 0) d += scoreDiscount;
    if (visitDiscount > 0) d += visitDiscount;
    return Math.min(d, 100);
  })();

  // Cash subscriptions and credit subscriptions are separate payment paths.
  // The dedicated credit event takes priority when configured; otherwise the
  // normal discount event also applies to the credit cost of a subscription.
  const creditDiscountPercent = (() => {
    const creditEvent = settings?.creditSubDiscountEvent;
    const discountEvent = creditEvent || event;
    let disc = 0;
    if (isDiscountEventLive(discountEvent) && isDiscountAudienceAllowed(discountEvent, !!isSubscribed)) {
      disc = Number(discountEvent?.discountPercent) || 0;
    }
    // Ultra subscribers get 40% off credits anywhere, Basic subscribers get 20%
    if (isUltraUser) {
      disc = Math.max(disc, 40);
    } else if (isBasicUser || isSubscribed) {
      disc = Math.max(disc, 20);
    }
    return Math.min(100, Math.max(0, disc));
  })();

  const getPlanCreditCost = (plan: any, ultra: boolean) => {
    const baseCost = getCreditPrice(plan.duration || plan.name || '', ultra, plan, settings);
    return creditDiscountPercent > 0
      ? Math.max(0, Math.round(baseCost * (1 - creditDiscountPercent / 100)))
      : baseCost;
  };

  // ── FREE PLAN: What is included vs What is NOT included ──
  const freeIncludedFeatures = [
    { title: 'Standard Daily MCQs', desc: 'Har din free quota ke MCQ tests practice karne ki suvidha', icon: '❓' },
    { title: 'Standard Reading Mode', desc: 'Syllabus chapters aur standard notes padhne ka access', icon: '📖' },
    { title: 'Daily Free Coin Claim', desc: 'Rozana login karke muft bonus coins claim karein', icon: '🪙' },
    { title: 'Login Streak & XP Tracker', desc: 'Consistency banayein aur daily streak points earn karein', icon: '🔥' },
    { title: 'Homework & Syllabus Overview', desc: 'Classes aur daily assignments overview dekhne ka access', icon: '📝' },
    { title: 'Public Leaderboard View', desc: 'Overall rankings aur student standing dekhne ki suvidha', icon: '🏆' },
    { title: 'Basic Voice Audio Reader', desc: 'Normal speed par chapters audio sunne ka access', icon: '🎧' },
  ];

  const freeLockedFeatures = [
    { title: 'Daily XP Limit Boost Locked', desc: 'XP limit normal (1,500 pts) par cap rehti hai — Score fast boost nahi hota', icon: '🔒' },
    { title: 'XP Multipliers Locked (1.0X Standard)', desc: 'Credit Pass (1.2X), Pro (1.5X) aur Ultra (2.0X) ka point bonus lock rehta hai', icon: '🔒' },
    { title: 'Daily 50/100 Credits Pass Locked', desc: 'Pro aur Ultra me milne wale daily free credits auto-claim locked hain', icon: '🔒' },
    { title: 'Projector & PDF Mode Locked', desc: 'Badi screen par projector view aur PDF reading mode locked hai', icon: '🔒' },
    { title: 'Writing & Correction Mode Locked', desc: 'Handwriting digital notebook aur question mistake correction locked hain', icon: '🔒' },
    { title: 'Flashcard Memory Mode Locked', desc: 'Speed memory revision aur formula flashcards locked hain', icon: '🔒' },
    { title: 'Full Video Mode & Lectures Locked', desc: 'Concept video lectures aur full video player locked hain', icon: '🔒' },
    { title: '0% Store & Credit Discounts', desc: 'Store purchases aur app-wide credit costs par koi extra discount nahi', icon: '🔒' },
    { title: 'Custom Themes & Text Colors Locked', desc: 'Personalized reading fonts, styles aur glowing VIP themes locked', icon: '🔒' },
    { title: 'Global Student Community Chat Locked', desc: 'All-students open chat aur instant study discussions locked', icon: '🔒' },
  ];

  // ── SUPERPOWERS ADDED WITH BASIC (PRO) PLAN ──
  const basicSuperPowers = [
    { title: '+66% Extra Daily XP Limit', desc: 'Daily score limit 1,500 se badhkar 2,500 points ho jati hai — Rank fast badhao!', badge: '+66% XP', icon: '🚀', highlight: true },
    { title: '1.5X Score Multiplier', desc: 'Har test, lesson aur activity par seedha 50% bonus XP point boost!', badge: '1.5X BOOST', icon: '⚡', highlight: true },
    { title: 'Daily 50 Credits Pass', desc: 'Har din 50 credits auto-claim karein (Mahine ke 1,500 Credits bilkul muft)!', badge: '50 CR/DAY', icon: '🪙', highlight: true },
    { title: '20% Off Everywhere (Credits)', desc: 'App me kisi bhi test/mode ke credit cost par flat 20% permanent discount', badge: '20% OFF', icon: '🏷️' },
    { title: 'Projector Mode & PDF Mode', desc: 'Badi screen projector display aur full PDF reading interface unlock', badge: 'UNLOCKED', icon: '📽️' },
    { title: 'Writing & Correction Mode', desc: 'Digital writing notebook aur community question mistake correction power', badge: 'UNLOCKED', icon: '✍️' },
    { title: 'Text Color & Style Customization', desc: 'Apni pasand ke fonts, background text color aur custom contrast lagayein', badge: 'CUSTOM', icon: '🎨' },
    { title: 'All Basic Themes Free', desc: 'Sabhi stylish basic themes bina kisi extra charge ke unlock', badge: 'THEMES FREE', icon: '🎭' },
    { title: 'Offline Download Available', desc: 'Important revision lessons aur study material offline save karein', badge: 'DOWNLOAD', icon: '📥' },
    { title: 'Detailed Score History', desc: 'Har test ka score graph aur deep performance analytics dekhein', badge: 'ANALYTICS', icon: '📊' },
    { title: 'Community MCQ Submission', desc: 'Apne banaye huye sawal community me contribute karein', badge: 'CREATOR', icon: '💬' },
    { title: '+5% Permanent Store Discount', desc: 'Har subscription renewal aur store purchase par extra 5% discount', badge: '5% OFF', icon: '💎' },
  ];

  // ── SUPERPOWERS ADDED WITH ULTRA (MAX) PLAN ──
  const ultraSuperPowers = [
    { title: '+133% Massive Daily XP Limit', desc: '1,400+ daily score capacity — Leaderboard me #1 rank hasil karne ki power!', badge: '+133% MAX', icon: '👑', highlight: true },
    { title: '2.0X Ultra Score Multiplier', desc: 'Seedha 100% (2X Double) bonus points har activity par (Sabse tez rank boost)!', badge: '2X SPEED', icon: '🔥', highlight: true },
    { title: 'Daily 100 Credits Pass', desc: 'Har din 100 credits muft claim karein (Mahine ke 3,000 Credits)!', badge: '100 CR/DAY', icon: '🪙', highlight: true },
    { title: '40% Off Everywhere (Credits)', desc: 'Poore app me kisi bhi credit transaction par maximum 40% discount!', badge: '40% OFF', icon: '🏷️', highlight: true },
    { title: '3,000 MCQ / Day Practice Limit', desc: 'Huge 3,000 MCQ quota per day — Practice aur self-study ki koi seema nahi!', badge: '3,000 MCQ', icon: '🎯', highlight: true },
    { title: 'Flashcard Memory Revision Mode', desc: 'Super-fast memory cards revision mode se formula aur facts instant yaad karein', badge: 'UNLOCKED', icon: '🗂️' },
    { title: 'Full Video Mode Unlocked', desc: 'High-quality concept video lectures aur video player full access', badge: 'UNLOCKED', icon: '🎬' },
    { title: 'Global Student Community Chat', desc: 'Sabhi serious students ke sath group discussion aur direct doubt sharing', badge: 'COMMUNITY', icon: '🌐' },
    { title: 'Priority Content Suggestions', desc: 'Aapki request par admin naye chapters aur study material add karega', badge: 'VIP RIGHT', icon: '💡' },
    { title: 'All Ultra Premium Themes Free', desc: 'VIP glowing themes, neon dark styles aur dynamic UI layouts permanently free', badge: 'ALL THEMES', icon: '✨' },
    { title: '+10% Store Discount (Pro & Max)', desc: 'Pro aur Max subscription purchase aur renewal par 10% permanent discount', badge: '10% OFF', icon: '💎', highlight: true },
    { title: 'Golden VIP Crown & Glowing Name', desc: 'Leaderboard aur profile par VIP golden badge aur glowing royal effect', badge: 'VIP STATUS', icon: '👑' },
    { title: 'Zero Interruptions & VIP Priority Help', desc: 'Completely distraction-free study aur fastest response priority support', badge: 'VIP SUPPORT', icon: '🛡️' },
  ];

  const defaultBasicFeatures = [
    'Daily Claim: 50 Credits / Day',
    'Community MCQ Send',
    'Content Request',
    'Correction Mode',
    'Text Color Customization',
    'Text Style Customization',
    'Basic Themes Free',
    'Daily XP Limit: +66%',
    'Store Discount: +5%',
    'Score History Unlocked',
    'Download Available',
    'Credit Off Anywhere: 20%',
    'XP Multiplier: 1.5X',
    'Projector Mode & PDF Mode',
  ];

  const defaultUltraFeatures = [
    'Daily Claim: 100 Credits / Day',
    'Everything in Basic',
    '+ Additional Perks:',
    '⚡ Ultra Mode (Chunk Notes / Reading Notes)',
    'Store Discount: +10% (Pro & Max)',
    'Daily XP Limit: +133%',
    'XP Multiplier: 2.0X',
    'Credit Off Anywhere: 40%',
    'Global Chat Available',
    'Ultra Themes Free',
    'Suggestions',
    'Flashcard Mode',
    'Video Mode',
    '3,000 MCQ / Day Limit',
  ];

  const pageTheme = isFreeTab ? {
    bg: '#080d16',
    bgGrad: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(100,116,139,0.22) 0%, #080d16 65%)',
    heroBg: 'linear-gradient(180deg, #111827 0%, #0b1120 100%)',
    heroBorder: 'rgba(148,163,184,0.25)',
    heroGlow1: 'rgba(148,163,184,0.16)',
    heroGlow2: 'rgba(100,116,139,0.10)',
    heroIconBg: 'linear-gradient(135deg,rgba(148,163,184,0.25),rgba(100,116,139,0.10))',
    heroIconBorder: 'rgba(148,163,184,0.45)',
    heroIconShadow: '0 0 16px rgba(148,163,184,0.25)',
    heroIconColor: '#cbd5e1',
    heroTitle: 'Free Plan',
    heroSub: 'Free Starter Tier · Standard Access & Limits',
    cardSurface: '#0f172a',
    cardSurfaceHigh: '#1e293b',
    cardBorder: 'rgba(148,163,184,0.18)',
    accent: '#94a3b8',
  } : isBasicTab ? {
    bg: '#04111a',
    bgGrad: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(34,211,238,0.16) 0%, #04111a 65%)',
    heroBg: 'linear-gradient(180deg, #071f2e 0%, #04131d 100%)',
    heroBorder: 'rgba(34,211,238,0.25)',
    heroGlow1: 'rgba(34,211,238,0.16)',
    heroGlow2: 'rgba(6,182,212,0.10)',
    heroIconBg: 'linear-gradient(135deg,rgba(34,211,238,0.25),rgba(6,182,212,0.10))',
    heroIconBorder: 'rgba(34,211,238,0.45)',
    heroIconShadow: '0 0 16px rgba(34,211,238,0.25)',
    heroIconColor: '#22d3ee',
    heroTitle: 'Pro Store',
    heroSub: 'Basic Theme · Standard Tier Unlock',
    cardSurface: '#071a26',
    cardSurfaceHigh: '#0d2536',
    cardBorder: 'rgba(34,211,238,0.18)',
    accent: '#22d3ee',
  } : isUltraTab ? {
    bg: '#0c061a',
    bgGrad: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(192,132,252,0.18) 0%, #0c061a 65%)',
    heroBg: 'linear-gradient(180deg, #160b2e 0%, #0c051a 100%)',
    heroBorder: 'rgba(192,132,252,0.25)',
    heroGlow1: 'rgba(192,132,252,0.16)',
    heroGlow2: 'rgba(124,58,237,0.10)',
    heroIconBg: 'linear-gradient(135deg,rgba(192,132,252,0.25),rgba(124,58,237,0.10))',
    heroIconBorder: 'rgba(192,132,252,0.45)',
    heroIconShadow: '0 0 16px rgba(192,132,252,0.25)',
    heroIconColor: '#c084fc',
    heroTitle: 'Ultra Store',
    heroSub: 'Ultra Theme · Elite VIP Tier Unlock',
    cardSurface: '#130c26',
    cardSurfaceHigh: '#1c1236',
    cardBorder: 'rgba(192,132,252,0.18)',
    accent: '#c084fc',
  } : isCreditsTab ? {
    bg: '#0d0a04',
    bgGrad: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(251,191,36,0.16) 0%, #0d0a04 65%)',
    heroBg: 'linear-gradient(180deg, #1c1507 0%, #0d0903 100%)',
    heroBorder: 'rgba(251,191,36,0.25)',
    heroGlow1: 'rgba(251,191,36,0.15)',
    heroGlow2: 'rgba(217,119,6,0.10)',
    heroIconBg: 'linear-gradient(135deg,rgba(251,191,36,0.25),rgba(251,191,36,0.10))',
    heroIconBorder: 'rgba(251,191,36,0.45)',
    heroIconShadow: '0 0 16px rgba(251,191,36,0.25)',
    heroIconColor: '#fbbf24',
    heroTitle: 'Credits Store',
    heroSub: 'Instant Coin Packages & Top-ups',
    cardSurface: '#161106',
    cardSurfaceHigh: '#221b0a',
    cardBorder: 'rgba(251,191,36,0.18)',
    accent: '#fbbf24',
  } : {
    bg: C.bg,
    bgGrad: 'none',
    heroBg: C.surface,
    heroBorder: C.border,
    heroGlow1: 'rgba(34,211,238,0.07)',
    heroGlow2: C.goldBg,
    heroIconBg: 'linear-gradient(135deg,rgba(251,191,36,0.22),rgba(251,191,36,0.08))',
    heroIconBorder: C.goldBorder,
    heroIconShadow: '0 0 14px rgba(251,191,36,0.2)',
    heroIconColor: C.gold,
    heroTitle: 'Plan History',
    heroSub: 'Pichle sabhi plans aur invoices',
    cardSurface: C.surface,
    cardSurfaceHigh: C.surfaceHigh,
    cardBorder: C.border,
    accent: C.gold,
  };

  const featuresList = isPro
    ? ((settings?.storeFeatures?.basic?.length && !settings?.storeFeatures?.basic?.includes('Full MCQs Unlocked'))
        ? settings.storeFeatures.basic.filter(f => f.trim())
        : defaultBasicFeatures)
    : ((settings?.storeFeatures?.ultra?.length && !settings?.storeFeatures?.ultra?.includes('Everything in Pro'))
        ? settings.storeFeatures.ultra.filter(f => f.trim())
        : defaultUltraFeatures);

  const getPerMonthPrice = (plan: any, price: number) => {
    if ((plan.duration || '').toLowerCase().includes('year') || (plan.duration || '').includes('365')) return Math.round(price / 12);
    return null;
  };

  const userCredits = getTotalCredits(user);

  /* ── Store locked ── */
  if (settings?.isPaymentEnabled === false) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6" style={{ background: C.bg }}>
        <div className="rounded-3xl p-10 text-center max-w-sm w-full" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: C.surfaceHigh }}>
            <Lock size={30} color={C.textMuted} />
          </div>
          <h3 className="text-xl font-black mb-2" style={{ color: C.text }}>Store Band Hai</h3>
          <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>
            {settings.paymentDisabledMessage || 'Purchases are currently disabled by the Admin.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-32 animate-in fade-in duration-300" style={{ background: pageTheme.bg, backgroundImage: pageTheme.bgGrad }}>

      {/* ── SUPPORT MODAL ── */}
      {showSupportModal && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm" onClick={() => setShowSupportModal(false)} />
          <div className="fixed inset-0 z-[201] flex items-end justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto rounded-3xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
              style={{ background: C.surface, border: `1px solid ${C.borderMed}` }}>
              <div className="px-5 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: ac.bg, border: `1px solid ${ac.border}` }}>
                    <MessageSquare size={19} color={ac.color} />
                  </div>
                  <div>
                    <h3 className="font-black text-base" style={{ color: C.text }}>Payment Channel</h3>
                    <p className="text-[11px]" style={{ color: C.textMuted }}>Ek number select karo</p>
                  </div>
                </div>
                <button onClick={() => setShowSupportModal(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: C.surfaceHigh }}>
                  <X size={14} color={C.textMuted} />
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                {(settings?.paymentNumbers || [{ id: 'def', name: 'Main Support', number: '8227070298', dailyClicks: 0 }]).map((num) => {
                  const totalClicks = settings?.paymentNumbers?.reduce((acc, curr) => acc + (curr.dailyClicks || 0), 0) || 1;
                  const traffic = Math.round(((num.dailyClicks || 0) / totalClicks) * 100);
                  const isFast = traffic < 30;
                  return (
                    <button key={num.id} onClick={() => handleSupportClick(num)}
                      className="w-full p-4 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98]"
                      style={{ background: C.surfaceHigh, border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm"
                          style={{ background: isFast ? C.greenBg : 'rgba(251,146,60,0.12)', color: isFast ? C.green : '#fb923c' }}>
                          {num.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm" style={{ color: C.text }}>{num.name}</p>
                          <p className="text-[10px]" style={{ color: C.textMuted }}>{isFast ? '✅ Fast Response' : '⚠️ High Traffic'}</p>
                        </div>
                      </div>
                      <ChevronRight size={15} color={C.textDim} />
                    </button>
                  );
                })}
              </div>
              <div className="px-4 pb-5">
                <button onClick={() => setShowSupportModal(false)}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-colors"
                  style={{ color: C.textMuted, background: C.surfaceHigh }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PAYMENT CHOOSER POPUP ── */}
      {showPaymentChooser && selectedPlan && (() => {
        const planName = (selectedPlan.name || '').toLowerCase();
        const planDuration = (selectedPlan.duration || '').toLowerCase();
        const isLifetimePlan =
          planName.includes('lifetime') ||
          planDuration.includes('lifetime') ||
          (selectedPlan as any).tier === 'LIFETIME';
        const basePrice = isPro ? selectedPlan.basicPrice : selectedPlan.ultraPrice;
        const finalPrice = totalDiscount > 0 ? Math.round(basePrice * (1 - totalDiscount / 100)) : basePrice;
      const creditCost = getPlanCreditCost(selectedPlan, !isPro);
        const hasEnoughCredits = userCredits >= creditCost;
        return (
          <>
            <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm" onClick={() => setShowPaymentChooser(false)} />
            <div className="fixed inset-0 z-[301] flex items-center justify-center p-5 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-sm rounded-3xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
                style={{ background: C.surface, border: `1px solid ${C.borderMed}` }}>
                <div className="px-5 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.textMuted }}>Payment Method</p>
                    <p className="font-black text-base" style={{ color: C.text }}>{selectedPlan.name}</p>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.border}` }}>
                      {ac.emoji} {ac.label}
                    </span>
                  </div>
                  <button onClick={() => setShowPaymentChooser(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: C.surfaceHigh }}>
                    <X size={14} color={C.textMuted} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => { setShowPaymentChooser(false); initiatePurchase({ ...selectedPlan, finalPrice }); }}
                    className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98] flex items-center gap-3"
                    style={{ background: ac.bg, border: `1.5px solid ${ac.border}` }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black"
                      style={{ background: ac.pill, color: ac.color }}>₹</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm" style={{ color: C.text }}>₹{finalPrice.toLocaleString('en-IN')} se Kharido</p>
                        {totalDiscount > 0 && (
                          <>
                            <span className="text-[10px] line-through" style={{ color: C.textDim }}>₹{basePrice.toLocaleString('en-IN')}</span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.18)', color: C.gold, border: `1px solid ${C.goldBorder}` }}>{totalDiscount}% OFF</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>WhatsApp par payment karo — Instant activate</p>
                    </div>
                    <ChevronRight size={16} color={C.textDim} />
                  </button>
                  {!isLifetimePlan && (
                    isCreditSubAllowed ? (
                      <button
                        onClick={() => { setShowPaymentChooser(false); setShowCreditConfirm(true); }}
                        disabled={!hasEnoughCredits}
                        className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98] disabled:opacity-40 flex items-center gap-3"
                        style={{
                          background: hasEnoughCredits ? C.goldBg : C.surfaceHigh,
                          border: `1.5px solid ${hasEnoughCredits ? C.goldBorder : C.border}`,
                        }}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl"
                          style={{ background: hasEnoughCredits ? 'rgba(251,191,36,0.2)' : C.surfaceHigh }}>🪙</div>
                        <div className="flex-1">
                          <p className="font-black text-sm" style={{ color: hasEnoughCredits ? C.gold : C.textMuted }}>
                            {creditCost.toLocaleString('en-IN')} Credits se Kharido
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>
                            {hasEnoughCredits
                              ? `Balance: ${userCredits.toLocaleString('en-IN')} CR → ${(userCredits - creditCost).toLocaleString('en-IN')} CR`
                              : `Kum hai — Chahiye: ${creditCost.toLocaleString('en-IN')} CR, Hai: ${userCredits.toLocaleString('en-IN')} CR`}
                          </p>
                        </div>
                        {hasEnoughCredits && <ChevronRight size={16} color={C.gold} />}
                      </button>
                    ) : (
                      <div className="w-full p-3 rounded-2xl flex items-center gap-2.5 opacity-75 border border-slate-700 bg-slate-900/50">
                        <span className="text-base">🔒</span>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Admin ne credits dwara subscription purchase off kar rakha hai.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── CREDIT CONFIRM POPUP ── */}
      {showCreditConfirm && selectedPlan && (() => {
        const creditCost = getPlanCreditCost(selectedPlan, !isPro);
        const afterBalance = userCredits - creditCost;
        return (
          <>
            <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm"
              onClick={() => !creditConfirmLoading && setShowCreditConfirm(false)} />
            <div className="fixed inset-0 z-[401] flex items-center justify-center p-5 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-xs rounded-3xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
                style={{ background: C.surface, border: `1.5px solid ${C.goldBorder}` }}>
                <div className="pt-7 pb-3 flex flex-col items-center px-5">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4"
                    style={{ background: C.goldBg, border: `1.5px solid ${C.goldBorder}` }}>🪙</div>
                  <p className="text-lg font-black text-center mb-1" style={{ color: C.text }}>Confirm Purchase</p>
                  <p className="text-[12px] text-center leading-relaxed" style={{ color: C.textMuted }}>
                    Credits se {isPro ? 'PRO' : 'MAX'} plan khareedne wale ho
                  </p>
                </div>
                <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.goldBorder}` }}>
                  {[
                    { label: 'Plan', value: `${selectedPlan.name} · ${isPro ? 'PRO' : 'MAX'}`, color: C.text },
                    { label: 'Credit Cost', value: `${creditCost.toLocaleString('en-IN')} CR`, color: C.gold },
                    { label: 'Aapka Balance', value: `${userCredits.toLocaleString('en-IN')} CR`, color: C.textMuted },
                    { label: 'Baad Bachega', value: `${afterBalance.toLocaleString('en-IN')} CR`, color: afterBalance >= 0 ? C.green : '#f87171' },
                  ].map((row, i, arr) => (
                    <div key={row.label}
                      className="flex justify-between items-center px-4 py-3"
                      style={{ background: i % 2 === 0 ? C.surfaceHigh : C.surface, borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <span className="text-[11px] font-bold" style={{ color: C.textMuted }}>{row.label}</span>
                      <span className="text-[12px] font-black" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-5 flex gap-3">
                  <button onClick={() => setShowCreditConfirm(false)} disabled={creditConfirmLoading}
                    className="flex-1 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95"
                    style={{ background: C.surfaceHigh, color: C.textMuted, border: `1px solid ${C.border}` }}>
                    Cancel
                  </button>
                  <button onClick={() => handleCreditPurchase(selectedPlan)} disabled={creditConfirmLoading}
                    className="flex-1 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: creditConfirmLoading ? 'rgba(251,191,36,0.5)' : C.gold, color: '#000' }}>
                    {creditConfirmLoading ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                        </svg>
                        Saving...
                      </>
                    ) : <>🪙 Haan, Kharido!</>}
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══════════ HERO HEADER ══════════ */}
      <div className="relative overflow-hidden" style={{ background: pageTheme.heroBg, borderBottom: `1px solid ${pageTheme.heroBorder}` }}>
        {/* Ambient glow blobs */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: pageTheme.heroGlow1, filter: 'blur(40px)' }} />
        <div className="absolute -bottom-10 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: pageTheme.heroGlow2, filter: 'blur(30px)' }} />

        <div className="relative px-4 pt-5 pb-4">
          {/* Single header row: Back + Crown + Title | Credits + Status */}
          <div className="flex items-center gap-2.5 mb-4">
            {onBack && (
              <button onClick={onBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                style={{ background: pageTheme.cardSurfaceHigh, border: `1px solid ${pageTheme.cardBorder}` }}>
                <ArrowLeft size={16} color={C.textMuted} />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: pageTheme.heroIconBg, border: `1.5px solid ${pageTheme.heroIconBorder}`, boxShadow: pageTheme.heroIconShadow }}>
              <Crown size={18} color={pageTheme.heroIconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black leading-none" style={{ color: C.text }}>{pageTheme.heroTitle}</h1>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: C.textMuted }}>{pageTheme.heroSub}</p>
            </div>
            {/* Credits display with + icon */}
            <button
              id="store-header-credits-btn"
              onClick={() => setTierType('CREDITS')}
              className="flex items-center gap-1.5 px-2.5 rounded-2xl shrink-0 active:scale-95 transition-all group"
              style={{ height: 34, background: C.goldBg, border: `1.5px solid ${C.goldBorder}`, boxShadow: `0 0 10px rgba(251,191,36,0.12)` }}
              title="Credits Pack Kharidein"
            >
              <span className="text-sm leading-none">🪙</span>
              <span className="font-black text-sm leading-none" style={{ color: C.gold }}>
                {userCredits.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] font-black" style={{ color: 'rgba(251,191,36,0.55)' }}>CR</span>
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-[10px] shadow-sm ml-0.5 group-hover:scale-110 transition-transform">
                +
              </span>
            </button>
          </div>

          {/* Plan type tabs + History */}
          {(() => {
            const totalCols = allTabs.length + 1;
            const colClass = totalCols === 3 ? 'grid-cols-3' : totalCols === 4 ? 'grid-cols-4' : totalCols === 5 ? 'grid-cols-5' : 'grid-cols-4';
            return (
              <div className={`grid gap-1.5 sm:gap-2 ${colClass}`}>
                {allTabs.map(tab => {
                  const isActive = tierType === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setTierType(tab.id)}
                      className="py-1.5 px-0.5 sm:px-1 rounded-xl font-black transition-all flex items-center justify-center gap-1 relative overflow-hidden"
                      style={isActive
                        ? { background: tab.bg, border: `2px solid ${tab.border}`, boxShadow: `0 0 14px ${tab.glow}` }
                        : { background: pageTheme.cardSurfaceHigh, border: `1.5px solid ${pageTheme.cardBorder}` }}>
                      <span className="text-xs sm:text-sm leading-none relative z-10 shrink-0">{tab.emoji}</span>
                      <span className="text-[9.5px] sm:text-[10px] relative z-10 truncate" style={{ color: isActive ? tab.color : C.textMuted }}>{tab.label}</span>
                    </button>
                  );
                })}
                {/* History tab — slim, no icon */}
                <button onClick={() => setTierType('HISTORY')}
                  className="py-1.5 px-0.5 sm:px-1 rounded-xl font-black transition-all flex items-center justify-center"
                  style={tierType === 'HISTORY'
                    ? { background: 'rgba(251,191,36,0.10)', border: `2px solid rgba(251,191,36,0.35)` }
                    : { background: pageTheme.cardSurfaceHigh, border: `1.5px solid ${pageTheme.cardBorder}` }}>
                  <span className="text-[9.5px] sm:text-[10px] truncate" style={{ color: tierType === 'HISTORY' ? C.gold : C.textMuted }}>History</span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div className="px-4 pt-5">

        {/* ── HISTORY TAB ── */}
        {tierType === 'HISTORY' && (() => {
          const history = user.subscriptionHistory || [];
          const sorted = [...history].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          const totalPaid = history.reduce((s, i) => s + i.price, 0);
          const totalFree = history.reduce((s, i) => i.isFree ? s + i.originalPrice : s, 0);
          return (
            <div className="animate-in fade-in duration-200 space-y-4">
              {history.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4" style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(52,211,153,0.2)' }}>
                      <TrendingDown size={16} color={C.green} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>Total Paid</p>
                    <p className="text-2xl font-black" style={{ color: C.text }}>₹{totalPaid}</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: C.proBg, border: `1px solid ${C.proBorder}` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(34,211,238,0.2)' }}>
                      <Gift size={16} color={C.pro} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: C.textMuted }}>Free Value</p>
                    <p className="text-2xl font-black" style={{ color: C.pro }}>₹{totalFree}</p>
                  </div>
                </div>
              )}
              <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: C.textMuted }}>
                <History size={12} /> Recent Plans
              </p>
              {sorted.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
                  <Crown size={38} className="mx-auto mb-3" style={{ color: C.textDim }} />
                  <p className="font-bold text-sm mb-1" style={{ color: C.textMuted }}>Abhi tak koi plan nahi</p>
                  <p className="text-xs" style={{ color: C.textDim }}>Pehla plan lo — yahan record aayega</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sorted.map((item) => (
                    <div key={item.id} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: item.isFree ? C.greenBg : C.maxBg }}>
                          {item.isFree ? <Gift size={18} color={C.green} /> : <DollarSign size={18} color={C.max} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm" style={{ color: C.text }}>
                            {item.tier === 'LIFETIME' ? 'Lifetime Access' : `${item.durationHours < 24 ? item.durationHours + ' Hours' : Math.ceil(item.durationHours / 24) + ' Days'} Plan`}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>{item.level} · {item.grantSource}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm" style={{ color: item.isFree ? C.green : C.text }}>
                            {item.isFree ? 'FREE' : `₹${item.price}`}
                          </p>
                          {item.isFree && <p className="text-[10px] line-through" style={{ color: C.textDim }}>₹{item.originalPrice}</p>}
                        </div>
                      </div>
                      <div className="flex justify-between rounded-xl px-3 py-2" style={{ background: C.surfaceHigh }}>
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                          <Calendar size={10} />
                          <span>{new Date(item.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textMuted }}>
                          <Clock size={10} />
                          <span>{item.tier === 'LIFETIME' ? 'Forever' : new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── CREDITS TAB ── */}
        {tierType === 'CREDITS' && (
          <div className="animate-in fade-in duration-200 space-y-4">
            {/* Success Claim Toast */}
            {passClaimSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <span>{passClaimSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setPassClaimSuccessMsg(null)}
                  className="w-6 h-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sub-tabs: Pass (Subscription) vs Packages */}
            <div className="flex p-1 rounded-xl bg-[#13131f] border border-white/5">
              <button
                onClick={() => setCreditSubTab('PASS')}
                className="flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5"
                style={creditSubTab === 'PASS'
                  ? { background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBorder}` }
                  : { color: C.textMuted }}>
                <span>⚡</span> Daily Credit Pass
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1"
                  style={{ background: creditSubTab === 'PASS' ? C.gold : 'rgba(255,255,255,0.08)', color: creditSubTab === 'PASS' ? '#000' : '#aaa' }}>
                  BEST VALUE
                </span>
              </button>
              {packages.length > 0 && (
                <button
                  onClick={() => setCreditSubTab('PACKAGES')}
                  className="flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  style={creditSubTab === 'PACKAGES'
                    ? { background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBorder}` }
                    : { color: C.textMuted }}>
                  <span>📦</span> One-Time Packs
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1"
                    style={{ background: creditSubTab === 'PACKAGES' ? C.gold : 'rgba(255,255,255,0.08)', color: creditSubTab === 'PACKAGES' ? '#000' : '#aaa' }}>
                    {packages.length}
                  </span>
                </button>
              )}
            </div>

            {/* SECTION 1: DAILY CREDIT SUBSCRIPTION PLANS */}
            {creditSubTab === 'PASS' && (
              <div className="space-y-3.5">
                {/* ════════ AAPKA CREDIT SUBSCRIPTION STATUS & DAILY CLAIM CARD ════════ */}
                {(() => {
                  const hasPass = isCreditSubActive(user);
                  const sub = user.creditSubscription;
                  const daysLeft = sub ? getCreditSubDaysRemaining(sub) : 0;
                  const canClaim = canClaimCreditSubToday(user);
                  const endDateFmt = sub?.endDate
                    ? new Date(sub.endDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  if (hasPass && sub) {
                    return (
                      <div
                        className="rounded-2xl p-5 border relative overflow-hidden transition-all shadow-xl"
                        style={{
                          background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.08), rgba(15,15,26,0.98))',
                          borderColor: canClaim ? '#f59e0b' : C.goldBorder,
                          boxShadow: canClaim ? '0 0 30px rgba(251,191,36,0.25)' : '0 4px 20px rgba(0,0,0,0.4)',
                        }}
                      >
                        {canClaim && (
                          <div
                            className="absolute -right-10 -top-10 w-32 h-32 rounded-full pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)' }}
                          />
                        )}

                        <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-md mt-0.5"
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: '#000',
                              }}
                            >
                              ⚡
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                                  style={{ background: C.gold, color: '#000' }}
                                >
                                  ACTIVE CREDIT PASS
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                  ⏳ {daysLeft} Din Baki
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-black mt-1 text-white truncate">
                                {sub.planName || 'Credit Subscription Pass'}
                              </h3>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className="text-sm font-black px-3.5 py-1.5 rounded-xl block shadow-sm"
                              style={{
                                background: C.goldBg,
                                color: C.gold,
                                border: `1px solid ${C.goldBorder}`,
                              }}
                            >
                              🪙 +{sub.dailyCredits} CR / din
                            </span>
                          </div>
                        </div>

                        {/* Validity, Days Left & Expiry Date Box */}
                        <div className="grid grid-cols-2 gap-2.5 my-3.5 p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">⏱️ Kitne Din Ke Liye Hai:</span>
                            <span className="font-bold text-white text-xs">
                              {sub.durationDays || 30} Din Ka Pass
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">⏳ Kitne Din Baki Hain:</span>
                            <span className="font-bold text-amber-400 text-xs">
                              {daysLeft} Din Baki
                            </span>
                          </div>
                          <div className="col-span-2 pt-1.5 border-t border-white/10">
                            <span className="text-[10px] text-slate-400 block font-medium">📅 Kab Khatam Hoga (Expiry):</span>
                            <span className="font-black text-amber-300 text-xs">
                              {endDateFmt}
                            </span>
                          </div>
                        </div>

                        {/* Claimed Stats */}
                        <div className="flex items-center justify-between text-xs text-slate-300 px-1 mb-2.5">
                          <span>Total Claimed: <strong className="text-amber-400 font-bold">{sub.totalClaimedDays || 0} Din</strong></span>
                          <span>Earned: <strong className="text-amber-400 font-bold">{sub.totalCreditsClaimed || 0} 🪙 Credits</strong></span>
                        </div>

                        {/* Multiplier & Stacking Stats */}
                        {(() => {
                          const activeMult = sub.scoreMultiplier || getCreditSubPlanMultiplier(sub);
                          const userTier = user.isPremium ? (user.subscriptionLevel || 'FREE') : 'FREE';
                          const totalCombined = getUserScoreMultiplier(user.subscriptionLevel, user.isPremium, sub);
                          return (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 mb-3 text-xs flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span>⚡</span>
                                <span className="text-slate-300">Credit Pass Boost: <strong className="text-amber-300 font-black">{activeMult}x XP</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span>🔥</span>
                                <span className="text-slate-300">Total Effective XP: <strong className="text-emerald-400 font-black">{totalCombined}x Multiplier</strong></span>
                                {userTier !== 'FREE' && (
                                  <span className="text-[10px] text-amber-300 font-bold bg-amber-400/20 px-1.5 py-0.5 rounded">
                                    {userTier} ({userTier === 'ULTRA' ? '2.0x' : '1.5x'}) + {activeMult}x
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* DAILY CLAIM BUTTON */}
                        {canClaim ? (
                          <button
                            onClick={handleClaimStorePass}
                            disabled={claimingStorePass}
                            className="w-full py-3.5 rounded-xl font-black text-sm active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                            style={{
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                              color: '#000',
                              boxShadow: '0 4px 20px rgba(245,158,11,0.45)',
                            }}
                          >
                            <Gift size={18} />
                            {claimingStorePass ? 'Credits Claim Ho Rahe Hain...' : `Aaj Ke +${sub.dailyCredits} Credits Claim Karo 🪙`}
                          </button>
                        ) : (
                          <div
                            className="py-3 rounded-xl flex items-center justify-center gap-2"
                            style={{ background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.greenBorder}` }}
                          >
                            <Check size={16} color={C.green} />
                            <span className="text-xs font-black text-emerald-400">
                              Aaj ka daily pass claim ho gaya! (+{sub.dailyCredits} 🪙) Agle credits kal milenge.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // When no credit pass is currently active
                  return (
                    <div
                      className="rounded-2xl p-4 sm:p-5 border relative overflow-hidden transition-all shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(30,41,59,0.7), rgba(15,23,42,0.85))',
                        borderColor: 'rgba(255,255,255,0.12)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border"
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              borderColor: 'rgba(255,255,255,0.1)',
                            }}
                          >
                            ⚡
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-white/10">
                                STATUS: INACTIVE
                              </span>
                              <span className="text-[10px] font-bold text-amber-400">
                                0 Din Active
                              </span>
                            </div>
                            <h4 className="text-base font-black text-white mt-1">
                              Abhi Koi Daily Credit Pass Active Nahi Hai
                            </h4>
                            <div className="grid grid-cols-2 gap-2 mt-2 p-2.5 rounded-xl bg-black/30 border border-white/5 text-[11px] text-slate-300">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Kon Sa Plan Active Hai:</span>
                                <strong className="text-slate-200">Koi Plan Active Nahi Hai</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Kitne Din Ke Liye:</span>
                                <strong className="text-slate-200">— (0 Din)</strong>
                              </div>
                              <div className="col-span-2 pt-1 border-t border-white/5">
                                <span className="text-slate-400 block text-[10px]">Daily Claim Option:</span>
                                <span className="text-amber-300/90 font-medium">Pass subscribe karne ke baad har roz daily credits claim karne ka option yahan milega!</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Duration Selector Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Clock size={12} /> Duration Chunein
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Lambi validity = Zyada discount
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CREDIT_SUB_DURATIONS.map((dur) => {
                      const isSelected = creditSubDuration === dur.id;
                      return (
                        <button
                          key={dur.id}
                          type="button"
                          onClick={() => setCreditSubDuration(dur.id)}
                          className={`relative p-2.5 rounded-xl text-left transition-all border ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/50'
                              : 'bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900'
                          }`}>
                          {dur.badge && (
                            <span className={`absolute -top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow ${
                              dur.highlight ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
                            }`}>
                              {dur.badge}
                            </span>
                          )}
                          <span className={`text-xs font-black block ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                            {dur.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {dur.subLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Plan Cards */}
                <div className="grid gap-3">
                  {getCreditSubPlans(settings).filter(p => p.isActive !== false).map((plan) => {
                    const selectedDurationOpt = CREDIT_SUB_DURATIONS.find(d => d.id === creditSubDuration) || CREDIT_SUB_DURATIONS[0];
                    const pricing = calculateCreditSubPrice(plan, selectedDurationOpt);
                    const isSuper = plan.price >= 300 || selectedDurationOpt.months >= 6;
                    const planMult = plan.scoreMultiplier || getCreditSubPlanMultiplier(plan);
                    const userTier = user.isPremium ? (user.subscriptionLevel || 'FREE') : 'FREE';
                    const baseMult = userTier === 'ULTRA' ? 2.0 : userTier === 'BASIC' ? 1.5 : 1.0;
                    const effectiveCombinedMult = Math.round((baseMult + (planMult - 1.0)) * 10) / 10;
                    const extraBoostPct = Math.round((planMult - 1.0) * 100);

                    return (
                      <div
                        key={plan.id}
                        className="rounded-2xl p-5 border relative overflow-hidden transition-all hover:border-amber-400/40"
                        style={isSuper
                          ? { background: C.goldBg, border: `2px solid ${C.goldBorder}`, boxShadow: '0 0 25px rgba(251,191,36,0.10)' }
                          : { background: C.surface, border: `1.5px solid ${C.border}` }}>
                        
                        {plan.badge && (
                          <div className="absolute top-0 right-0 text-[9px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-xl tracking-wider"
                            style={{ background: isSuper ? C.gold : 'rgba(255,255,255,0.15)', color: isSuper ? '#000' : '#fff' }}>
                            {plan.badge}
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-wider block" style={{ color: C.gold }}>
                                ⚡ {selectedDurationOpt.durationDays} Din Validity ({selectedDurationOpt.label})
                              </span>
                              {pricing.totalDiscountPercent > 0 && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                                  {pricing.totalDiscountPercent}% OFF
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-black mt-0.5" style={{ color: C.text }}>
                              {plan.name}
                            </h3>
                          </div>
                          <div className="text-right shrink-0 pr-6">
                            <div className="flex items-baseline justify-end gap-1.5">
                              {pricing.totalDiscountPercent > 0 ? (
                                <span className="text-xs line-through" style={{ color: C.textDim }}>
                                  ₹{pricing.basePrice.toLocaleString('en-IN')}
                                </span>
                              ) : plan.dummyPrice ? (
                                <span className="text-xs line-through" style={{ color: C.textDim }}>
                                  ₹{pricing.dummyPrice.toLocaleString('en-IN')}
                                </span>
                              ) : null}
                              <span className="text-xl font-black text-amber-400">
                                ₹{pricing.finalPrice.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <span className="text-[10px] block" style={{ color: C.textMuted }}>
                              ₹{pricing.perDayCost}/din
                            </span>
                          </div>
                        </div>

                        {/* Credits Highlight Pill */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 my-3">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                              style={{ background: C.goldBg, border: `1px solid ${C.goldBorder}` }}>
                              🪙
                            </div>
                            <div>
                              <p className="text-sm font-black text-amber-300">
                                +{plan.dailyCredits} Credits / Din
                              </p>
                              <p className="text-[10px]" style={{ color: C.textMuted }}>
                                Roz claim karein ({selectedDurationOpt.durationDays} din tak)
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-200 block">
                              Total {pricing.totalCredits.toLocaleString('en-IN')} 🪙
                            </span>
                            <span className="text-[9px] text-emerald-400 font-bold block">
                              ₹{pricing.perCreditCost} / credit
                            </span>
                          </div>
                        </div>

                        {plan.description && (
                          <p className="text-[11px] mb-2" style={{ color: C.textMuted }}>
                            {plan.description}
                          </p>
                        )}

                        {/* XP Multiplier & Subscription Stacking Benefits Box */}
                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-400/30 my-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">⚡</span>
                              <div>
                                <span className="text-xs font-black text-amber-300">
                                  Score & XP Multiplier: <span className="text-white text-sm font-black">{planMult}x XP</span>
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                                  (+{extraBoostPct}% Extra Score Boost)
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm">
                              {planMult}x XP
                            </span>
                          </div>

                          {/* Stacking Rule & Examples */}
                          <div className="pt-2 border-t border-white/10 text-[11px] leading-relaxed space-y-1.5">
                            <p className="text-[11px] text-slate-300 font-medium">
                              🔗 <strong className="text-amber-300">Subscription Stacking XP:</strong> Agar aapne Basic ya Ultra subscription li hui hai, to dono ka XP aapas me jud jayega:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                              <div className={`p-2 rounded-lg border flex flex-col justify-center ${userTier === 'FREE' ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 ring-1 ring-amber-400/40' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                                <span className="text-[9px] text-slate-400 font-semibold">Free Plan (1.0x):</span>
                                <span className="font-bold">1.0x + {(planMult - 1.0).toFixed(1)}x = <strong className="text-amber-300">{planMult}x XP</strong></span>
                              </div>

                              <div className={`p-2 rounded-lg border flex flex-col justify-center ${userTier === 'BASIC' ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 ring-1 ring-amber-400/50' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                                <span className="text-[9px] text-slate-400 font-semibold">Basic Plan (1.5x):</span>
                                <span className="font-bold">1.5x + {planMult}x = <strong className="text-amber-300">{(1.5 + (planMult - 1.0)).toFixed(1)}x XP</strong></span>
                              </div>

                              <div className={`p-2 rounded-lg border flex flex-col justify-center ${userTier === 'ULTRA' ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 ring-1 ring-amber-400/50' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                                <span className="text-[9px] text-slate-400 font-semibold">Ultra Plan (2.0x):</span>
                                <span className="font-bold">2.0x + {planMult}x = <strong className="text-amber-300">{(2.0 + (planMult - 1.0)).toFixed(1)}x XP</strong></span>
                              </div>
                            </div>

                            {userTier !== 'FREE' && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-black bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                <span>✓</span>
                                <span>Aapka {userTier === 'ULTRA' ? 'Ultra (2.0x)' : 'Basic (1.5x)'} Subscription active hai! Is pass se aapko kul <strong className="text-amber-300">{effectiveCombinedMult}x XP</strong> milega!</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => initiatePurchase({
                            ...plan,
                            id: `${plan.id}_${selectedDurationOpt.id}`,
                            basePlanId: plan.id,
                            name: `${plan.name} (${selectedDurationOpt.label})`,
                            price: pricing.finalPrice,
                            finalPrice: pricing.finalPrice,
                            basePrice: pricing.basePrice,
                            dummyPrice: pricing.dummyPrice,
                            dailyCredits: plan.dailyCredits,
                            durationDays: selectedDurationOpt.durationDays,
                            durationMonths: selectedDurationOpt.months,
                            durationLabel: selectedDurationOpt.label,
                            isCreditSub: true,
                            discountPercent: pricing.totalDiscountPercent,
                            durationDiscountPercent: pricing.durationDiscountPercent,
                            scoreMultiplier: planMult,
                          })}
                          className="w-full py-3 rounded-xl font-black text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md"
                          style={{
                            background: isSuper
                              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                              : 'linear-gradient(135deg, #1e293b, #0f172a)',
                            color: isSuper ? '#000' : '#fff',
                            border: isSuper ? 'none' : `1px solid ${C.borderMed}`,
                          }}>
                          <Zap size={14} /> Pass Subscribe Karo — ₹{pricing.finalPrice.toLocaleString('en-IN')}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center gap-8 pt-2">
                  {[{icon:<ShieldCheck size={13}/>,text:'Guaranteed Daily'},{icon:<Zap size={13}/>,text:'Multiple Durations'},{icon:<Star size={13}/>,text:'Max Savings'}].map(b=>(
                    <div key={b.text} className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: C.textDim }}>{b.icon}<span>{b.text}</span></div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: ONE-TIME CREDIT PACKAGES */}
            {creditSubTab === 'PACKAGES' && packages.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: C.textMuted }}>
                  <span className="text-base">📦</span> Instant One-Time Packages
                </p>
                {packages.map((pkg) => {
                  let finalPrice = pkg.price;
                  if (totalDiscount > 0) finalPrice = Math.round(finalPrice * (1 - totalDiscount / 100));
                  const perCredit = finalPrice > 0 ? (finalPrice / pkg.credits).toFixed(2) : '0';
                  const isPopular = pkg.credits === 500;
                  return (
                    <button key={pkg.id} onClick={() => initiatePurchase(pkg)}
                      className="w-full p-5 rounded-2xl text-left transition-all active:scale-[0.99] relative overflow-hidden"
                      style={isPopular
                        ? { background: C.goldBg, border: `2px solid ${C.goldBorder}`, boxShadow: `0 0 20px rgba(251,191,36,0.12)` }
                        : { background: C.surface, border: `1.5px solid ${C.border}` }}>
                      {isPopular && (
                        <div className="absolute top-0 right-0 text-[9px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-xl"
                          style={{ background: C.gold, color: '#000' }}>POPULAR</div>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                          style={{ background: C.goldBg, border: `1.5px solid ${C.goldBorder}` }}>🪙</div>
                        <div className="flex-1">
                          <p className="text-base font-black" style={{ color: C.text }}>{pkg.credits.toLocaleString('en-IN')} Credits</p>
                          <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>₹{perCredit} per credit</p>
                        </div>
                        <div className="text-right shrink-0">
                          {totalDiscount > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full block mb-1.5"
                              style={{ background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBorder}` }}>
                              {totalDiscount}% OFF
                            </span>
                          )}
                          <p className="text-xl font-black" style={{ color: C.text }}>₹{finalPrice.toLocaleString('en-IN')}</p>
                          {totalDiscount > 0 && <p className="text-[10px] line-through mt-0.5" style={{ color: C.textDim }}>₹{pkg.price.toLocaleString('en-IN')}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="flex justify-center gap-8 pt-2">
                  {[{icon:<ShieldCheck size={13}/>,text:'Secure'},{icon:<Zap size={13}/>,text:'Instant'},{icon:<Star size={13}/>,text:'No Expiry'}].map(b=>(
                    <div key={b.text} className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: C.textDim }}>{b.icon}<span>{b.text}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FREE PLAN TAB ── */}
        {tierType === 'FREE' && (
          <div className="animate-in fade-in duration-200 space-y-4">
            {/* Free Plan Status Card */}
            <div className="rounded-2xl p-5 border relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(148,163,184,0.12) 0%, rgba(30,41,59,0.7) 100%)',
                border: '1.5px solid rgba(148,163,184,0.25)',
                boxShadow: '0 0 25px rgba(100,116,139,0.10)',
              }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  {(!user.isPremium || user.subscriptionLevel === 'FREE') ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[11px] font-black tracking-wide mb-2 shadow-sm">
                      <BadgeCheck size={14} />
                      <span>AAPKA CURRENT PLAN (ACTIVE)</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600 text-slate-300 text-[11px] font-bold mb-2">
                      <span>ℹ️ BASE TIER (Aapke paas {user.subscriptionLevel === 'ULTRA' ? 'MAX (Ultra)' : 'PRO (Basic)'} active hai)</span>
                    </div>
                  )}
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>🎯 Free Plan</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">Base Tier</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Standard free access — sabhi basic features bina kisi payment ke hamesha muft available hain.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black text-slate-100">₹0</span>
                  <span className="text-[10px] block text-slate-400 font-bold uppercase tracking-wider">Free Forever</span>
                </div>
              </div>

              {/* Free Limits Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <span className="text-base block mb-0.5">📅</span>
                  <span className="text-xs font-black text-white block">1,500 XP/Day</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Daily XP Limit</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <span className="text-base block mb-0.5">⚡</span>
                  <span className="text-xs font-black text-slate-300 block">1.0X Speed</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Standard Score</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <span className="text-base block mb-0.5">❓</span>
                  <span className="text-xs font-black text-slate-300 block">Free Quota</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Daily MCQs</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                  <span className="text-base block mb-0.5">🏷️</span>
                  <span className="text-xs font-black text-slate-400 block">0% OFF</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Store Discount</span>
                </div>
              </div>
            </div>

            {/* Quick Credits Balance Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-amber-400/20">
              <div className="flex items-center gap-2">
                <span className="text-base">🪙</span>
                <span className="text-xs font-bold text-slate-300">
                  Aapke Credits: <strong className="text-amber-400 font-black">{userCredits.toLocaleString('en-IN')} CR</strong>
                </span>
              </div>
              <button
                onClick={() => setTierType('CREDITS')}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm active:scale-95 transition-transform"
              >
                + Buy Credits
              </button>
            </div>

            {/* Free: What is Included */}
            <div className="rounded-2xl p-4 bg-[#0d1522] border border-emerald-500/25">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-black">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-400 leading-none">
                    Free Me Kya-Kya Mil Raha Hai
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ye sabhi features aap Free plan me bina kisi charge ke use kar sakte hain:
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {freeIncludedFeatures.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/25 border border-emerald-500/15">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-200">{item.title}</span>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded">FREE</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade Cards: Superpowers in Basic vs Ultra */}
            <div className="space-y-3">
              <div className="text-center pt-2">
                <h3 className="text-base font-black text-white">Upgrade Karne Par Kya Naya Judega?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Basic aur Ultra plans se aapke account me judne wale superpowers:</p>
              </div>

              {/* Basic Superpowers Teaser */}
              <div className="rounded-2xl p-4 bg-[#071926] border border-cyan-400/30 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Standard Tier</span>
                      <h4 className="text-base font-black text-white">Basic (Pro) Plan Ke Superpowers</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => setTierType('BASIC')}
                    className="px-3 py-1.5 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-300 active:scale-95 transition-transform flex items-center gap-1 shadow-sm"
                  >
                    <span>Pro Dekhein</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>+66% Daily XP Boost</strong> (2,500 pts)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>1.5X Score Multiplier</strong> (50% bonus XP)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Daily 50 Credits Pass</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>20% Off Everywhere</strong> (Credits)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Projector & PDF Mode</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">✓</span>
                    <span><strong>Correction Mode</strong> + Basic Themes</span>
                  </div>
                </div>
              </div>

              {/* Ultra Superpowers Teaser */}
              <div className="rounded-2xl p-4 bg-[#140a26] border border-purple-400/35 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Elite VIP Tier</span>
                      <h4 className="text-base font-black text-white">Ultra (Max) Plan Ke Superpowers</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => setTierType('ULTRA')}
                    className="px-3 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 active:scale-95 transition-transform flex items-center gap-1 shadow-sm"
                  >
                    <span>Ultra Dekhein</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>+133% Massive Daily XP</strong> (3,500 pts)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>2.0X Ultra Multiplier</strong> (100% Double XP)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>Daily 100 Credits Pass</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>40% Off Everywhere</strong> (Credits)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>3,000 MCQ / Day</strong> practice</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>Video Mode & Flashcards</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>Global Student Chat</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">✓</span>
                    <span><strong>Golden VIP Crown</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Comparison Table */}
            <div className="rounded-2xl p-4 bg-[#0a0f1d] border border-white/10 overflow-x-auto">
              <h3 className="text-sm font-black text-white mb-1 flex items-center gap-2">
                <span>📊</span> Full Feature Comparison (Free vs Pro vs Max)
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">Sabhi plans ki direct tulna ek nazar me dekhein:</p>

              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 pr-2 font-black">Feature</th>
                    <th className="py-2 px-1 text-center font-black text-slate-300">Free 🎯</th>
                    <th className="py-2 px-1 text-center font-black text-cyan-400">Pro ⭐</th>
                    <th className="py-2 pl-1 text-center font-black text-purple-400">Max ⚡</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Daily XP Limit</td>
                    <td className="py-2 px-1 text-center text-slate-400">1,500 pts</td>
                    <td className="py-2 px-1 text-center text-cyan-300 font-bold">2,500 pts (+66%)</td>
                    <td className="py-2 pl-1 text-center text-purple-300 font-bold">3,500 pts (+133%)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">XP Multiplier</td>
                    <td className="py-2 px-1 text-center text-slate-400">1.0X</td>
                    <td className="py-2 px-1 text-center text-cyan-300 font-bold">1.5X Boost</td>
                    <td className="py-2 pl-1 text-center text-purple-300 font-bold">2.0X Super Boost</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Daily Credits Pass</td>
                    <td className="py-2 px-1 text-center text-slate-500">—</td>
                    <td className="py-2 px-1 text-center text-amber-300 font-bold">50 CR / Day</td>
                    <td className="py-2 pl-1 text-center text-amber-300 font-bold">100 CR / Day</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Credit Cost Off</td>
                    <td className="py-2 px-1 text-center text-slate-500">0%</td>
                    <td className="py-2 px-1 text-center text-emerald-400 font-bold">20% OFF</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">40% OFF</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">MCQ / Day Practice</td>
                    <td className="py-2 px-1 text-center text-slate-400">Free Quota</td>
                    <td className="py-2 px-1 text-center text-cyan-300 font-bold">1,500 / Day</td>
                    <td className="py-2 pl-1 text-center text-purple-300 font-bold">3,000 / Day</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Projector & PDF Mode</td>
                    <td className="py-2 px-1 text-center text-rose-400 font-bold">✕</td>
                    <td className="py-2 px-1 text-center text-emerald-400 font-bold">✓</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Writing & Correction</td>
                    <td className="py-2 px-1 text-center text-rose-400 font-bold">✕</td>
                    <td className="py-2 px-1 text-center text-emerald-400 font-bold">✓</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Flashcard Memory Mode</td>
                    <td className="py-2 px-1 text-center text-rose-400 font-bold">✕</td>
                    <td className="py-2 px-1 text-center text-slate-500">—</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">✓ Unlocked</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Video Player Mode</td>
                    <td className="py-2 px-1 text-center text-rose-400 font-bold">✕</td>
                    <td className="py-2 px-1 text-center text-slate-500">—</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">✓ Full Video</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Global Student Chat</td>
                    <td className="py-2 px-1 text-center text-rose-400 font-bold">✕</td>
                    <td className="py-2 px-1 text-center text-slate-500">—</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">✓ Live Chat</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Themes & Styling</td>
                    <td className="py-2 px-1 text-center text-slate-400">Default</td>
                    <td className="py-2 px-1 text-center text-cyan-300 font-bold">Basic Themes</td>
                    <td className="py-2 pl-1 text-center text-purple-300 font-bold">All Ultra Themes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Store Extra Discount</td>
                    <td className="py-2 px-1 text-center text-slate-500">0%</td>
                    <td className="py-2 px-1 text-center text-emerald-400 font-bold">+5% OFF</td>
                    <td className="py-2 pl-1 text-center text-emerald-400 font-bold">+5% OFF</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-slate-300">Leaderboard VIP Badge</td>
                    <td className="py-2 px-1 text-center text-slate-500">—</td>
                    <td className="py-2 px-1 text-center text-cyan-300 font-bold">PRO Badge</td>
                    <td className="py-2 pl-1 text-center text-amber-300 font-bold">👑 Golden Crown</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PRO / MAX PLANS ── */}
        {(tierType === 'BASIC' || tierType === 'ULTRA') && (
          <>
            {/* Pro Daily Reward: ONLY shown on the Pro (BASIC) page */}
            {tierType === 'BASIC' && (
              <TierDailyClaimCard
                targetTier="PRO"
                userId={user.id}
                user={user}
                settings={settings}
                onUpdateUser={onUserUpdate}
              />
            )}

            {/* Max Daily Reward: ONLY shown on the Max (ULTRA) page */}
            {tierType === 'ULTRA' && (
              <TierDailyClaimCard
                targetTier="MAX_PRO"
                userId={user.id}
                user={user}
                settings={settings}
                onUpdateUser={onUserUpdate}
              />
            )}

            {subscriptionPlans.length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
                <Package size={36} className="mx-auto mb-4" style={{ color: C.textDim }} />
                <p className="font-black text-base mb-1" style={{ color: C.textMuted }}>Plans Coming Soon</p>
                <p className="text-[12px] leading-relaxed" style={{ color: C.textDim }}>Admin jald hi plans add karega.</p>
              </div>
            ) : (
              <>
                {/* ── FF MAX Style Plan Card ── */}
                {(() => {
                  const levelInfo = getLevelInfo(user.totalScore || 0);
                  const subActive = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
                  const daysLeft = subActive && user.subscriptionEndDate
                    ? Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - Date.now()) / 86400000))
                    : 0;
                  const fmtTimer = (t) => t
                    ? `${t.days > 0 ? t.days + 'd ' : ''}${String(t.hours).padStart(2,'0')}:${String(t.minutes).padStart(2,'0')}:${String(t.seconds).padStart(2,'0')}`
                    : '...';
                  const score = user.totalScore || 0;
                  const nextLvl = getNextLevelInfo(score);
                  const lvlProgress = getLevelProgress(score);
                  const ptsNeeded = nextLvl ? nextLvl.minScore - score : 0;

                  const ffGold = '#FFD700';
                  const ffGoldDim = 'rgba(255,215,0,0.65)';
                  const ffCardBg = isPro ? '#071b29' : '#140c29';
                  const ffBorder = isPro ? '#22d3ee' : '#c084fc';
                  const ffStripe = isPro ? 'rgba(34,211,238,0.18)' : 'rgba(192,132,252,0.18)';

                  return (
                    <>
                      <style>{`
                        @keyframes shimmer-gold {
                          0%   { background-position: -300% center; }
                          100% { background-position: 300% center; }
                        }
                        .renewal-shimmer {
                          background: linear-gradient(90deg,#f59e0b 0%,#fcd34d 30%,#fffbeb 50%,#fcd34d 70%,#f59e0b 100%);
                          background-size: 300% auto;
                          -webkit-background-clip: text;
                          background-clip: text;
                          -webkit-text-fill-color: transparent;
                          animation: shimmer-gold 2.2s linear infinite;
                        }
                        @keyframes pulse-dot {
                          0%,100%{opacity:1;transform:scale(1);}
                          50%{opacity:0.4;transform:scale(0.7);}
                        }
                        .timer-dot{animation:pulse-dot 1s ease-in-out infinite;}
                        @keyframes ff-scan {
                          0%{transform:translateX(-100%);}
                          100%{transform:translateX(400%);}
                        }
                        .ff-scan-line{animation:ff-scan 3s linear infinite;}
                      `}</style>

                      {/* ── MAIN CARD ── */}
                      <div className="mb-5 rounded-2xl overflow-hidden relative"
                        style={{ background: ffCardBg, border: `2px solid ${ffBorder}`, boxShadow: `0 0 0 1px ${ffStripe}, 0 8px 32px ${ffStripe}, 0 0 24px ${ffStripe}` }}>

                        {/* ▌▌ FF-style header bar ▌▌ */}
                        <div className="relative overflow-hidden"
                          style={{ background: isPro ? 'rgba(8,145,178,0.35)' : 'rgba(124,58,237,0.35)', borderBottom: `2px solid ${ffBorder}` }}>
                          {/* Diagonal hazard stripes */}
                          <div className="absolute inset-0 pointer-events-none"
                            style={{ backgroundImage: `repeating-linear-gradient(60deg,transparent,transparent 10px,rgba(255,255,255,0.025) 10px,rgba(255,255,255,0.025) 12px)` }} />
                          {/* Scan line */}
                          <div className="ff-scan-line absolute top-0 bottom-0 w-12 pointer-events-none"
                            style={{ background: `linear-gradient(90deg,transparent,${ffStripe},transparent)` }} />
                          <div className="relative flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 relative"
                                style={{ background: 'rgba(255,215,0,0.12)', border: `1.5px solid rgba(255,215,0,0.45)`, boxShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
                                {ac.emoji}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[22px] font-black tracking-[0.12em] uppercase leading-none"
                                    style={{ color: ffGold, textShadow: `0 0 14px rgba(255,215,0,0.55), 0 1px 0 rgba(0,0,0,0.8)` }}>
                                    {isPro ? 'PRO' : 'MAX'}
                                  </span>
                                  <span className="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
                                    style={{ background: isPro ? 'rgba(34,211,238,0.15)' : 'rgba(192,132,252,0.15)', color: ffBorder, border: `1px solid ${ffBorder}44` }}>
                                    PLAN
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                  {isPro ? 'Standard Tier' : 'Elite Tier'}
                                </span>
                              </div>
                            </div>
                            {isSubscribed && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0"
                                style={{ background: 'rgba(52,211,153,0.12)', border: `1.5px solid rgba(52,211,153,0.4)`, boxShadow: '0 0 8px rgba(52,211,153,0.15)' }}>
                                <BadgeCheck size={12} color="#34d399" />
                                <span className="text-[11px] font-black" style={{ color: '#34d399' }}>Active</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ▌▌ Feature list — Uniform clean display ▌▌ */}
                        <div className="relative" style={{ borderBottom: `1.5px solid rgba(255,255,255,0.06)` }}>
                          <div className="px-4 py-2 flex items-center justify-between"
                            style={{ background: 'rgba(255,255,255,0.035)', borderBottom: `1px solid rgba(255,255,255,0.055)` }}>
                            <div className="flex items-center gap-1.5">
                              <Zap size={11} color={ffBorder} />
                              <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: ffBorder }}>
                                {isPro ? 'PRO (BASIC)' : 'MAX (ULTRA)'} INCLUDED FEATURES & PERKS
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,215,0,0.12)', color: ffGold, border: '1px solid rgba(255,215,0,0.25)' }}>
                              {featuresList.length} Features
                            </span>
                          </div>

                          <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            {featuresList.map((f, i) => (
                              <div key={i} className="flex items-center gap-2.5 py-1">
                                <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                                  style={{ background: 'rgba(255,215,0,0.12)', border: `1px solid rgba(255,215,0,0.3)` }}>
                                  <Check size={10} color={ffGold} strokeWidth={3.5} />
                                </div>
                                <span className="text-[12px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ▌▌ Level discount row ▌▌ */}
                        <div style={{ borderBottom: `1.5px solid rgba(255,255,255,0.06)` }}>
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-[16px] leading-none shrink-0">{levelInfo.emoji}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[12px] font-black" style={{ color: '#e2e8f0' }}>
                                    Level {levelInfo.level} {levelInfo.label}
                                  </span>
                                  <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                    {score.toLocaleString('en-IN')} pts
                                  </span>
                                </div>
                              </div>
                            </div>
                            {scoreDiscount > 0 && (
                              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg shrink-0 ml-2"
                                style={{ background: levelInfo.color, color: '#000', boxShadow: `0 0 8px ${levelInfo.color}55` }}>
                                {scoreDiscount}% OFF
                              </span>
                            )}
                          </div>
                          {nextLvl && (
                            <div className="px-4 pb-3 -mt-1">
                              <div className="h-1.5 rounded-full mb-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${lvlProgress}%`, background: 'linear-gradient(90deg,#d97706,#fbbf24,#fde68a)' }} />
                              </div>
                              <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                {ptsNeeded.toLocaleString('en-IN')} aur → Level {nextLvl.level} {nextLvl.emoji} ({nextLvl.discount}% OFF)
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ▌▌ Flash Sale row ▌▌ */}
                        {(activeEvent || inCooldown) && (
                          <div style={{ borderBottom: `1.5px solid rgba(255,255,255,0.06)` }}>
                            <div className="px-4 pt-2.5 pb-0">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                style={{ background: activeEvent ? 'rgba(40,18,5,0.9)' : 'rgba(20,20,20,0.7)', border: `1px solid ${activeEvent ? '#fb923c66' : '#64748b44'}` }}>
                                {activeEvent && <span className="timer-dot w-1.5 h-1.5 rounded-full shrink-0 inline-block" style={{ background: '#fb923c' }} />}
                                <span className="text-[10px] font-black tabular-nums tracking-wider" style={{ color: activeEvent ? '#fb923c' : C.textMuted }}>
                                  {fmtTimer(timeLeft)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-[12px] font-bold flex items-center gap-2" style={{ color: activeEvent ? '#e2e8f0' : C.textMuted }}>
                                <span className="text-[15px] leading-none">🔥</span>
                                {activeEvent ? 'Flash Sale' : 'Sale Jald Aayega'}
                              </span>
                              {activeEvent && (
                                <span className="text-[12px] font-black" style={{ color: '#fb923c' }}>
                                  +{event?.discountPercent || 0}% OFF
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ▌▌ Renewal bonus row ▌▌ */}
                        <div style={{ borderBottom: `1.5px solid rgba(255,255,255,0.06)` }}>
                          {isSubscribed && (
                            <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
                              <span className="renewal-shimmer text-[9px] font-black tracking-[0.18em] uppercase">✦ RENEWAL BONUS</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: isSubscribed ? '6px' : undefined }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[16px] leading-none shrink-0">💎</span>
                              <div>
                                <span className="text-[12px] font-bold" style={{ color: subActive ? '#e2e8f0' : C.textMuted }}>Subscription</span>
                                {subActive && (
                                  <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#34d399' }}>
                                    {(user as any).subscriptionLevel === 'ULTRA' ? 'MAX' : 'PRO'} · {daysLeft}d left
                                  </p>
                                )}
                              </div>
                            </div>
                            {isSubscribed ? (
                              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg shrink-0"
                                style={{ background: 'rgba(70,52,0,0.8)', color: ffGold, border: `1px solid rgba(255,215,0,0.4)` }}>
                                +{isUltraUser ? 10 : 5}% OFF
                              </span>
                            ) : !subActive ? (
                              <span className="text-[10px] font-bold" style={{ color: C.textDim }}>None</span>
                            ) : null}
                          </div>
                        </div>

                        {/* ▌▌ Total Discount — FF result-screen style ▌▌ */}
                        <div className="relative overflow-hidden">
                          <div className="absolute inset-0 pointer-events-none"
                            style={{ backgroundImage: `repeating-linear-gradient(60deg,transparent,transparent 10px,rgba(255,215,0,0.03) 10px,rgba(255,215,0,0.03) 12px)` }} />
                          <div className="relative flex items-center justify-between px-4 py-3.5"
                            style={{ background: 'rgba(255,215,0,0.08)', borderTop: `1.5px solid rgba(255,215,0,0.25)` }}>
                            <span className="text-[13px] font-black flex items-center gap-2 uppercase tracking-wider" style={{ color: ffGold }}>
                              <span className="text-[15px] leading-none">🏷️</span> Total Discount
                            </span>
                            <span className="text-[18px] font-black tabular-nums"
                              style={{ color: ffGold, textShadow: '0 0 12px rgba(255,215,0,0.5)' }}>
                              {totalDiscount > 0 ? `${totalDiscount}% OFF` : '0%'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ── Plan cards — glass morphism, background-adaptive ── */}
                      <div className="space-y-2.5 mb-5">
                        {subscriptionPlans.map((plan, idx) => {
                          const isSelected = selectedPlanId === plan.id;
                          const original = isPro ? plan.basicOriginalPrice : plan.ultraOriginalPrice;
                          const planNameL2 = (plan.name || '').toLowerCase();
                          const planDurL2 = (plan.duration || '').toLowerCase();
                          const isLifetimePlan = planNameL2.includes('lifetime') || planDurL2.includes('lifetime') || (plan as any).tier === 'LIFETIME';
                          let price = isPro ? plan.basicPrice : plan.ultraPrice;
                          if (isLifetimePlan) price = isPro ? 9999 : 19999;
                          else if (totalDiscount > 0) price = Math.round(price * (1 - totalDiscount / 100));
                          const perMonth = getPerMonthPrice(plan, price);
                          const isPopular = plan.name.toLowerCase().includes('monthly') || (subscriptionPlans.length > 1 && idx === 1);

                          // Per-card accent — adapts to active tier
                          const cardAccentColor  = isSelected ? ffBorder : 'rgba(255,255,255,0.55)';
                          const cardBg           = isSelected
                            ? (isPro ? 'rgba(34,211,238,0.09)' : 'rgba(192,132,252,0.09)')
                            : 'rgba(255,255,255,0.04)';
                          const cardBorder       = isSelected
                            ? `2px solid ${ffBorder}`
                            : '1.5px solid rgba(255,255,255,0.10)';
                          const cardShadow       = isSelected
                            ? `0 0 22px ${ffStripe}, 0 2px 12px rgba(0,0,0,0.35)`
                            : '0 1px 4px rgba(0,0,0,0.20)';

                          return (
                            <button key={plan.id} onClick={() => { setSelectedPlanId(plan.id); setShowPaymentChooser(true); }}
                              className="w-full block text-left active:scale-[0.985] transition-all relative overflow-hidden rounded-2xl"
                              style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>

                              {/* Selected: subtle left accent stripe */}
                              {isSelected && (
                                <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                                  style={{ background: `linear-gradient(180deg,${ffBorder},transparent)` }} />
                              )}

                              {/* Popular corner ribbon */}
                              {isPopular && (
                                <div className="absolute top-0 right-0 pointer-events-none">
                                  <div className="text-[8px] font-black px-2.5 py-1 rounded-bl-xl rounded-tr-2xl"
                                    style={{ background: 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', letterSpacing: '0.05em' }}>
                                    Popular
                                  </div>
                                </div>
                              )}

                              <div className="px-4 py-3.5 flex justify-between items-center relative z-10">
                                <div className="flex-1 pr-3">
                                  {/* Plan name row */}
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <p className="text-sm font-black" style={{ color: cardAccentColor }}>{plan.name}</p>
                                  </div>
                                  {/* Price row */}
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[26px] font-black leading-none" style={{ color: '#fff' }}>₹{price.toLocaleString('en-IN')}</span>
                                    {original > price && (
                                      <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.25)' }}>₹{original.toLocaleString('en-IN')}</span>
                                    )}
                                  </div>
                                  {perMonth && (
                                    <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>≈ ₹{perMonth}/month</p>
                                  )}
                                  {isCreditSubAllowed && !isLifetimePlan && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                         <span>🪙</span> {getPlanCreditCost(plan, !isPro).toLocaleString('en-IN')} CR
                                         {creditDiscountPercent > 0 && (
                                           <span className="ml-1 text-[9px] font-black text-emerald-300">
                                             ({creditDiscountPercent}% OFF)
                                           </span>
                                         )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  {totalDiscount > 0 && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                                      style={{ background: 'rgba(255,215,0,0.13)', color: ffGold, border: `1px solid rgba(255,215,0,0.30)` }}>
                                      {totalDiscount}% OFF
                                    </span>
                                  )}
                                  {/* Radio circle */}
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{ border: `2px solid ${isSelected ? ffBorder : 'rgba(255,255,255,0.20)'}`, background: isSelected ? ffStripe : 'transparent' }}>
                                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: ffBorder }} />}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Credit purchase success/error message */}
                {creditPurchaseMsg && (
                  <div className="mb-4 p-4 rounded-2xl text-sm font-bold text-center"
                    style={{
                      background: creditPurchaseMsg.startsWith('✅') ? C.greenBg : 'rgba(248,113,113,0.1)',
                      color: creditPurchaseMsg.startsWith('✅') ? C.green : '#f87171',
                      border: `1px solid ${creditPurchaseMsg.startsWith('✅') ? C.greenBorder : 'rgba(248,113,113,0.3)'}`,
                    }}>
                    {creditPurchaseMsg}
                  </div>
                )}


                {/* ── SUPERPOWERS ADDED WITH THIS TIER ── */}
                {isPro ? (
                  <div className="rounded-2xl p-4 bg-[#071a26] border-2 border-cyan-400/40 shadow-lg mb-5 relative overflow-hidden">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-base font-black">
                        ⭐
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                          Pro Unlocked Superpowers
                        </span>
                        <h3 className="text-sm font-black text-white leading-none">
                          Basic (Pro) Plan Se Add Hone Wale Superpowers
                        </h3>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                      Free Plan ke mukable Basic plan lene par ye sabhi extra powers aapke account me jud jayengi:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {basicSuperPowers.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-black/35 border border-cyan-400/20 flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-black text-cyan-200">{p.title}</span>
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-400/15 text-cyan-300 shrink-0">
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{p.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 bg-[#140a28] border-2 border-purple-400/45 shadow-lg mb-5 relative overflow-hidden">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/45 flex items-center justify-center text-purple-300 text-base font-black">
                        👑
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                          Elite VIP Superpowers
                        </span>
                        <h3 className="text-sm font-black text-white leading-none">
                          Ultra (Max) Plan Se Add Hone Wale Superpowers
                        </h3>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                      Basic Plan ke upar ye sabhi ultimate perks aur exclusive superpowers unlock ho jayengi:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ultraSuperPowers.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-black/35 border border-purple-400/20 flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-black text-purple-200">{p.title}</span>
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 shrink-0">
                                {p.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{p.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trust row */}
                <div className="flex justify-center gap-8 mb-2">
                  {[
                    { icon: <ShieldCheck size={13} />, text: 'Secure' },
                    { icon: <Flame size={13} />, text: 'Instant' },
                    { icon: <Star size={13} />, text: 'Support' },
                  ].map(b => (
                    <div key={b.text} className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: C.textDim }}>
                      {b.icon}<span>{b.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
