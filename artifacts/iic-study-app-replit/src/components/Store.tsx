// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, CreditPackage, SystemSettings } from '../types';
import {
  Sparkles, Check, MessageSquare, Lock, Ticket, ShieldCheck, Star,
  ChevronRight, ChevronDown, Flame, BadgeCheck, History, TrendingDown,
  Calendar, Clock, Crown, DollarSign, ArrowLeft, Zap, Gift, Coins,
  Package, Wallet, X
} from 'lucide-react';
import { saveUserToLive } from '../firebase';
import { getLevelInfo, getScoreDiscountFromScore, getNextLevelInfo, getLevelProgress, getLevelDailyLimitsWithOverride, UNLIMITED } from '../utils/levelSystem';
import { SCORE_MULTIPLIERS, getDailyScoreLimit, getUserScoreMultiplier } from '../utils/scoreSystem';
import { addSubscription, isSubscriptionFromCoins } from '../utils/subscriptionUtils';
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
  const [tierType, setTierType] = useState<'FREE' | 'SUBSCRIPTION' | 'CREDITS' | 'HISTORY'>(() =>
    user.isPremium ? 'SUBSCRIPTION' : 'FREE'
  );
  const [subTierView, setSubTierView] = useState<'ALL' | 'CREDIT_PASS' | 'PRO' | 'MAX'>(() =>
    user.isPremium
      ? ((user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO') ? 'MAX' : 'PRO')
      : 'ALL'
  );
  const [selectedProPlanId, setSelectedProPlanId] = useState<string | null>(null);
  const [selectedMaxPlanId, setSelectedMaxPlanId] = useState<string | null>(null);
  const [selectedTierForPurchase, setSelectedTierForPurchase] = useState<'BASIC' | 'ULTRA'>('BASIC');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const packages = settings?.packages || [];
  const subscriptionPlans = settings?.subscriptionPlans || [];
  const isCreditSubAllowed = settings?.allowCreditSubscription !== false;
  const [creditSubTab, setCreditSubTab] = useState<'PASS' | 'PACKAGES'>('PASS');
  const [creditSubDuration, setCreditSubDuration] = useState<CreditSubDurationId>('1_MONTH');
  const [planDurations, setPlanDurations] = useState<Record<string, CreditSubDurationId>>({});
  const [showAllTiersModal, setShowAllTiersModal] = useState(false);
  const [openFaqBasic, setOpenFaqBasic] = useState(false);
  const [openFaqUltra, setOpenFaqUltra] = useState(false);
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
    if (subscriptionPlans.length > 0) {
      const defaultPlan = subscriptionPlans.find(p => p.name.includes('Monthly')) || subscriptionPlans[0];
      if (!selectedProPlanId) setSelectedProPlanId(defaultPlan.id);
      if (!selectedMaxPlanId) setSelectedMaxPlanId(defaultPlan.id);
      if (!selectedPlanId) setSelectedPlanId(defaultPlan.id);
    }
  }, [subscriptionPlans, selectedProPlanId, selectedMaxPlanId, selectedPlanId]);

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
    const isUltra = selectedTierForPurchase === 'ULTRA';
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
    const isUltraPurchase = selectedTierForPurchase === 'ULTRA';
    const price = isSub
      ? (purchaseItem.finalPrice !== undefined ? purchaseItem.finalPrice : (isUltraPurchase ? purchaseItem.ultraPrice : purchaseItem.basicPrice))
      : purchaseItem.price;
    const features = isSub ? (isUltraPurchase ? 'PDF + Videos + AI Studio (Max)' : 'MCQ + Notes (Pro)') : `${purchaseItem.credits} Credits`;
    const effectiveDisc = purchaseItem.discountPercent !== undefined ? purchaseItem.discountPercent : totalDiscount;
    const discountNote = isSub && effectiveDisc > 0
      ? `\nDiscount Applied: ${effectiveDisc}% OFF${purchaseItem.durDiscount !== undefined ? ` (Duration Discount: ${purchaseItem.durDiscount}% OFF)` : ''}`
      : '';
    const msg = `Hello Admin, I want to buy:\n\nItem: ${purchaseItem.name} ${isSub ? `(${isUltraPurchase ? 'MAX VIP' : 'PRO'})` : ''}\nPrice: ₹${price}${discountNote}\nUser ID: ${user.id}\nDetails: ${features}\n\nPlease share payment details.`;
    window.open(`https://wa.me/91${numEntry.number}?text=${encodeURIComponent(msg)}`, '_blank');
    setShowSupportModal(false);
  };
  const initiatePurchase = (item: any) => { setPurchaseItem(item); setShowSupportModal(true); };


  const isFreeTab = tierType === 'FREE';
  const isSubTab = tierType === 'SUBSCRIPTION';
  const isCreditsTab = tierType === 'CREDITS';
  const isHistoryTab = tierType === 'HISTORY';
  const isPro = selectedTierForPurchase === 'BASIC';
  const isBasicTab = isSubTab && subTierView === 'PRO';
  const isUltraTab = isSubTab && subTierView === 'MAX';

  const ac = isFreeTab
    ? { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', glow: 'rgba(148,163,184,0.18)', grad: 'linear-gradient(135deg,#64748b,#94a3b8)', pill: 'rgba(148,163,184,0.14)', label: 'FREE', emoji: '🎯' }
    : isCreditsTab
    ? { color: C.gold, bg: C.goldBg, border: C.goldBorder, glow: 'rgba(251,191,36,0.22)', grad: 'linear-gradient(135deg,#d97706,#fbbf24)', pill: 'rgba(251,191,36,0.14)', label: 'CREDITS', emoji: '🪙' }
    : selectedTierForPurchase === 'BASIC'
    ? { color: C.pro, bg: C.proBg, border: C.proBorder, glow: C.proGlow, grad: C.proGrad, pill: 'rgba(34,211,238,0.14)', label: 'PRO', emoji: '⭐' }
    : { color: C.max, bg: C.maxBg, border: C.maxBorder, glow: C.maxGlow, grad: C.maxGrad, pill: 'rgba(192,132,252,0.14)', label: 'MAX', emoji: '👑' };

  // Row 2 tabs: Free, Subscription, Credits, and History
  const allTabs = [
    { id: 'FREE'         as const, label: 'Free',         emoji: '🎯', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)',  glow: 'rgba(148,163,184,0.18)' },
    { id: 'SUBSCRIPTION' as const, label: 'Subscription', emoji: '💎', color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.35)', glow: 'rgba(192,132,252,0.25)' },
    { id: 'CREDITS'      as const, label: 'Credits',      emoji: '🪙', color: C.gold,   bg: C.goldBg,                  border: C.goldBorder,            glow: 'rgba(251,191,36,0.22)' },
  ];

  const isUltraUser = user.isPremium && (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO');
  const isBasicUser = user.isPremium && user.subscriptionLevel === 'BASIC';

  // Base subscription renewal / user bonus discounts:
  // Ultra members get 10% OFF, Basic/Pro get 5% OFF
  const subDiscount = isSubscribed ? (isUltraUser ? 10 : 5) : 0;
  const userBonusDiscount = (activeStoreDiscount > 0 ? activeStoreDiscount : 0) +
    (scoreDiscount > 0 ? scoreDiscount : 0) +
    (visitDiscount > 0 ? visitDiscount : 0);
  const baseAccountDiscount = subDiscount + userBonusDiscount;
  const eventDiscountPercent = (activeEvent && event?.discountPercent) ? Number(event.discountPercent) : 0;

  // Special Validity Discount Event (Monthly, 3-Monthly, 6-Monthly, Yearly)
  const validityEvent = settings?.validityDiscountEvent;
  const isValidityDiscountActive = (() => {
    if (validityEvent) {
      if (validityEvent.enabled === false) return false;
      if (!isDiscountEventLive(validityEvent)) return false;
      if (!isDiscountAudienceAllowed(validityEvent, !!isSubscribed)) return false;
      return true;
    }
    // Default active until admin modifies/toggles it
    return true;
  })();

  const getValidityDiscountPercent = (months: number, days?: number): number => {
    if (!isValidityDiscountActive) return 0;
    const monthlyPct = validityEvent?.monthlyPercent ?? 5;
    const threeMonthlyPct = validityEvent?.threeMonthlyPercent ?? 10;
    const sixMonthlyPct = validityEvent?.sixMonthlyPercent ?? 15;
    const yearlyPct = validityEvent?.yearlyPercent ?? 20;

    if (months === 1 || days === 30) return monthlyPct;
    if (months === 3 || days === 90) return threeMonthlyPct;
    if (months === 6 || days === 180) return sixMonthlyPct;
    if (months >= 12 || days === 365) return yearlyPct;
    return 0;
  };

  const getCreditSubDurationDiscount = (durationId: CreditSubDurationId): number => {
    if (!isValidityDiscountActive) return 0;
    const monthlyPct = validityEvent?.monthlyPercent ?? 5;
    const threeMonthlyPct = validityEvent?.threeMonthlyPercent ?? 10;
    const sixMonthlyPct = validityEvent?.sixMonthlyPercent ?? 15;
    const yearlyPct = validityEvent?.yearlyPercent ?? 20;

    if (durationId === '1_MONTH') return monthlyPct;
    if (durationId === '3_MONTH') return threeMonthlyPct;
    if (durationId === '6_MONTH') return sixMonthlyPct;
    if (durationId === '1_YEAR') return yearlyPct;
    return 0;
  };

  // User requested duration discounts:
  // Weekly: 0% OFF, Monthly: 5% OFF, 3-Monthly: 10% OFF, Yearly: 20% OFF (controlled by admin event manager)
  const getPlanDurationDiscount = (plan: any): number => {
    if (!plan) return 0;
    if (!isValidityDiscountActive) return 0; // Off karega to sare ye off khatam ho jayenge!

    const monthlyPct = validityEvent?.monthlyPercent ?? 5;
    const threeMonthlyPct = validityEvent?.threeMonthlyPercent ?? 10;
    const sixMonthlyPct = validityEvent?.sixMonthlyPercent ?? 15;
    const yearlyPct = validityEvent?.yearlyPercent ?? 20;

    const id = (plan.id || '').toLowerCase();
    const name = (plan.name || '').toLowerCase();
    const dur = (plan.duration || '').toLowerCase();

    if (id.includes('weekly') || name.includes('weekly') || dur.includes('7') || dur.includes('week')) {
      return 0; // Weekly: 0% off
    }
    if (id.includes('monthly') || name.includes('monthly') || dur.includes('30') || dur.includes('1 month') || dur === '30 days') {
      return monthlyPct;
    }
    if (id.includes('quarterly') || id.includes('3month') || id.includes('3-month') || name.includes('quarterly') || name.includes('3 month') || dur.includes('3 month') || dur.includes('90')) {
      return threeMonthlyPct;
    }
    if (id.includes('6month') || id.includes('6-month') || id.includes('half') || name.includes('6 month') || name.includes('half') || dur.includes('6 month') || dur.includes('180')) {
      return sixMonthlyPct;
    }
    if (id.includes('yearly') || id.includes('annual') || name.includes('yearly') || name.includes('annual') || dur.includes('year') || dur.includes('365') || dur.includes('12 month')) {
      return yearlyPct;
    }
    return 0;
  };

  /**
   * Compound / Successive discount calculation:
   * 1. Plan Duration Discount (Weekly 0%, Monthly 5%, 3-Monthly 10%, Yearly 20%) + Active Subscription Discount (10% Ultra / 5% Pro)
   *    add together directly as Base Discount.
   *    Example: Yearly (20%) + Subscription (10%) = 30% Base Discount.
   * 2. Event / Special / Coupon discount applies on the REMAINING balance, NOT added linearly!
   *    Example: Remaining balance = 100% - 30% = 70%.
   *    Event discount 20% -> 20% of 70% = 14% additional discount.
   *    Total Effective Discount = 30% + 14% = 44% (NOT 30% + 20% = 50%)!
   */
  const calculatePlanDiscount = (plan: any, isProTier: boolean) => {
    if (!plan) {
      return {
        durDiscount: 0,
        subDiscount,
        userBonusDiscount,
        baseDiscount: 0,
        eventDiscount: eventDiscountPercent,
        eventEffectiveDiscount: 0,
        totalEffectiveDiscount: 0,
        basePrice: 0,
        finalPrice: 0,
        isLifetimePlan: false,
      };
    }
    const planNameL2 = (plan.name || '').toLowerCase();
    const planDurL2 = (plan.duration || '').toLowerCase();
    const isLifetimePlan = planNameL2.includes('lifetime') || planDurL2.includes('lifetime') || (plan as any).tier === 'LIFETIME';

    const basePrice = isProTier ? plan.basicPrice : plan.ultraPrice;
    if (isLifetimePlan) {
      const lifetimePrice = isProTier ? 9999 : 19999;
      return {
        durDiscount: 0,
        subDiscount: 0,
        userBonusDiscount: 0,
        baseDiscount: 0,
        eventDiscount: 0,
        eventEffectiveDiscount: 0,
        totalEffectiveDiscount: 0,
        basePrice: lifetimePrice,
        finalPrice: lifetimePrice,
        isLifetimePlan: true,
      };
    }

    const durDiscount = getPlanDurationDiscount(plan);
    const baseDiscount = Math.min(100, durDiscount + baseAccountDiscount);

    // Event discount applies to the remaining balance after base discount
    let eventEffectiveDiscount = 0;
    if (eventDiscountPercent > 0 && baseDiscount < 100) {
      const remainingBalance = 100 - baseDiscount;
      eventEffectiveDiscount = Math.round((remainingBalance * eventDiscountPercent) / 100);
    }

    const totalEffectiveDiscount = Math.min(100, baseDiscount + eventEffectiveDiscount);
    const finalPrice = Math.max(0, Math.round(basePrice * (1 - totalEffectiveDiscount / 100)));

    return {
      durDiscount,
      subDiscount,
      userBonusDiscount,
      baseDiscount,
      eventDiscount: eventDiscountPercent,
      eventEffectiveDiscount,
      totalEffectiveDiscount,
      basePrice,
      finalPrice,
      isLifetimePlan: false,
    };
  };

  const totalDiscount = (() => {
    const base = baseAccountDiscount;
    if (eventDiscountPercent > 0 && base < 100) {
      const rem = 100 - base;
      return Math.min(100, Math.round(base + (rem * eventDiscountPercent) / 100));
    }
    return Math.min(100, base);
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
  const isGroupStudyHidden =
    settings?.isGroupStudyEnabled === false ||
    (settings?.hiddenFeatures || []).includes('GROUP_STUDY') ||
    (settings?.hiddenHomeButtons || []).includes('GROUP_STUDY');

  // Filter helper to guarantee removal of Group Study from feature lists if hidden by Admin
  const filterGroupStudy = (list: string[]) => {
    if (!isGroupStudyHidden) return list;
    return (list || []).filter(f => {
      const lower = (f || '').toLowerCase();
      return !lower.includes('group study') &&
             !lower.includes('live classroom') &&
             !lower.includes('mcq battle') &&
             !lower.includes('live room');
    });
  };

  const basicSuperPowers = [
    ...(!isGroupStudyHidden ? [{
      title: 'Group Study & Live Classroom',
      desc: 'Friends ke sath real-time live study room join karein aur Live MCQ Battles me compete karein!',
      badge: 'LIVE STUDY',
      icon: '👥',
      highlight: true
    }] : []),
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
    ...(!isGroupStudyHidden ? [{
      title: 'Host Live Classroom & MCQ Battles',
      desc: 'Apna khud ka live room create karein, whiteboard par padhayein aur custom Live MCQ Battles host karein!',
      badge: 'HOST & TEACH',
      icon: '🎓',
      highlight: true
    }] : []),
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
    ...(!isGroupStudyHidden ? ['Group Study: Join Live Rooms & Battles'] : []),
    'Daily Claim: 50 Credits / Day',
    'Daily XP Limit: +66%',
    'XP Multiplier: 1.5X Boost',
    'Credit Off Anywhere: 20%',
    'Store Discount: +5%',
    'Projector & PDF Mode',
    'Writing & Correction Mode',
    'Text Color & Fonts Custom',
    'All Basic Themes Free',
    'Offline Download Available',
    'Detailed Score History',
    'Community MCQ Submission',
  ];

  const defaultUltraFeatures = [
    ...(!isGroupStudyHidden ? ['👑 Group Study Pro: Host Live Classroom & Battles'] : []),
    'Daily Claim: 100 Credits / Day',
    'All Basic Features Included',
    '⚡ Ultra Mode (Reading Notes)',
    'Store Discount: +10% (Pro & Max)',
    'Daily XP Limit: +133%',
    'XP Multiplier: 2.0X Super Boost',
    'Credit Off Anywhere: 40%',
    'Global Student Chat',
    'All Ultra Themes Free',
    'Priority Content Requests',
    'Flashcard Memory Mode',
    'Concept Video Mode',
    '3,000 MCQ / Day Limit',
    'VIP Golden Crown & Glow',
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
  } : isSubTab ? {
    bg: '#080a18',
    bgGrad: 'radial-gradient(ellipse 120% 70% at 50% -10%, rgba(124,58,237,0.18) 0%, #080a18 65%)',
    heroBg: 'linear-gradient(180deg, #130e26 0%, #090615 100%)',
    heroBorder: 'rgba(168,85,247,0.30)',
    heroGlow1: 'rgba(34,211,238,0.16)',
    heroGlow2: 'rgba(168,85,247,0.16)',
    heroIconBg: 'linear-gradient(135deg,rgba(34,211,238,0.25),rgba(168,85,247,0.25))',
    heroIconBorder: 'rgba(168,85,247,0.45)',
    heroIconShadow: '0 0 16px rgba(168,85,247,0.30)',
    heroIconColor: '#c084fc',
    heroTitle: 'VIP Subscriptions',
    heroSub: 'Pro & Max Elite Plans · Superpowers & Multipliers',
    cardSurface: '#0f0c22',
    cardSurfaceHigh: '#181335',
    cardBorder: 'rgba(168,85,247,0.20)',
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

  const featuresList = filterGroupStudy(
    isPro
      ? ((settings?.storeFeatures?.basic?.length && !settings?.storeFeatures?.basic?.includes('Full MCQs Unlocked'))
          ? settings.storeFeatures.basic.filter(f => f.trim())
          : defaultBasicFeatures)
      : ((settings?.storeFeatures?.ultra?.length && !settings?.storeFeatures?.ultra?.includes('Everything in Pro'))
          ? settings.storeFeatures.ultra.filter(f => f.trim())
          : defaultUltraFeatures)
  );

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
        const isProTarget = selectedTierForPurchase === 'BASIC';
        const discInfo = calculatePlanDiscount(selectedPlan, isProTarget);
        const basePrice = discInfo.basePrice;
        const finalPrice = discInfo.finalPrice;
        const effectiveDiscount = discInfo.totalEffectiveDiscount;
        const durDiscount = discInfo.durDiscount;
        const isLifetimePlan = discInfo.isLifetimePlan;
        const creditCost = getPlanCreditCost(selectedPlan, !isProTarget);
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
                    onClick={() => { setShowPaymentChooser(false); initiatePurchase({ ...selectedPlan, finalPrice, discountPercent: effectiveDiscount, durDiscount }); }}
                    className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98] flex items-center gap-3"
                    style={{ background: ac.bg, border: `1.5px solid ${ac.border}` }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black"
                      style={{ background: ac.pill, color: ac.color }}>₹</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm" style={{ color: C.text }}>₹{finalPrice.toLocaleString('en-IN')} se Kharido</p>
                        {effectiveDiscount > 0 && (
                          <>
                            <span className="text-[10px] line-through" style={{ color: C.textDim }}>₹{basePrice.toLocaleString('en-IN')}</span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.18)', color: C.gold, border: `1px solid ${C.goldBorder}` }}>
                              {effectiveDiscount}% OFF
                            </span>
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
                  <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10.5px] text-amber-300 text-center font-medium leading-tight">
                    ℹ️ Sabhi Premium study features (MCQs, Notes, XP Boost) unlock honge. Daily Credits claim sirf cash/UPI plans me milta hai.
                  </div>
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

            {/* Quick Balance Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">
                  🪙
                </div>
                <div>
                  <p className="text-xs font-black text-white">Aapka Balance: {userCredits.toLocaleString('en-IN')} Credits</p>
                  <p className="text-[10px] text-amber-300/80">One-time top-ups · Instant recharge</p>
                </div>
              </div>
            </div>


            {/* SECTION: ONE-TIME CREDIT PACKAGES */}
            {packages.length > 0 && (
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

            {/* Interactive Questions: Basic Plan & Ultra Plan Superpowers */}
            <div className="space-y-3 pt-1">
              {/* Question 1: Basic Plan Kya Hai? */}
              <div
                id="faq-basic-plan"
                className="rounded-2xl border transition-all overflow-hidden"
                style={{
                  background: openFaqBasic ? 'rgba(8, 145, 178, 0.08)' : 'rgba(15, 23, 42, 0.65)',
                  borderColor: openFaqBasic ? 'rgba(34, 211, 238, 0.45)' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: openFaqBasic ? '0 0 25px rgba(34, 211, 238, 0.12)' : 'none',
                }}
              >
                <button
                  type="button"
                  id="btn-toggle-basic-faq"
                  onClick={() => setOpenFaqBasic(!openFaqBasic)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, #0891b2, #22d3ee)',
                        color: '#000',
                      }}
                    >
                      ⭐
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white">
                          Basic Plan Kya Hai?
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                          PRO SUPERPOWERS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {openFaqBasic ? 'Tap karke band karein' : 'Tap karein: Pro (Basic) plan se add hone wale superpowers dekhein'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 shrink-0 transition-transform duration-200 ${
                      openFaqBasic ? 'rotate-180 bg-cyan-500/20 text-cyan-300' : ''
                    }`}
                  >
                    <ChevronDown size={16} />
                  </div>
                </button>

                {openFaqBasic && (
                  <div className="px-4 pb-4 pt-1 border-t border-cyan-500/20 animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                    {/* Header requested by user */}
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">⭐</span>
                          <h4 className="text-xs sm:text-sm font-black text-cyan-300 tracking-wide uppercase">
                            PRO UNLOCKED SUPERPOWERS
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Pro (Basic) Plan Se Add Hone Wale Superpowers
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setTierType('SUBSCRIPTION'); setSubTierView('PRO'); }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-black text-[11px] hover:bg-cyan-300 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        ⚡ Pro Plan Dekhein
                      </button>
                    </div>

                    {/* Basic Superpowers List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {basicSuperPowers.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/40 border border-cyan-400/15 hover:border-cyan-400/35 transition-colors"
                        >
                          <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 mb-0.5">
                              <span className="text-xs font-black text-slate-100 truncate">{item.title}</span>
                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 shrink-0">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Question 2: Ultra Plan Kya Hai? */}
              <div
                id="faq-ultra-plan"
                className="rounded-2xl border transition-all overflow-hidden"
                style={{
                  background: openFaqUltra ? 'rgba(124, 58, 237, 0.08)' : 'rgba(15, 23, 42, 0.65)',
                  borderColor: openFaqUltra ? 'rgba(192, 132, 252, 0.45)' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: openFaqUltra ? '0 0 25px rgba(192, 132, 252, 0.12)' : 'none',
                }}
              >
                <button
                  type="button"
                  id="btn-toggle-ultra-faq"
                  onClick={() => setOpenFaqUltra(!openFaqUltra)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed, #c084fc)',
                        color: '#fff',
                      }}
                    >
                      👑
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white">
                          Ultra Plan Kya Hai?
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                          ELITE VIP SUPERPOWERS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {openFaqUltra ? 'Tap karke band karein' : 'Tap karein: Ultra (Max) plan se add hone wale superpowers dekhein'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 shrink-0 transition-transform duration-200 ${
                      openFaqUltra ? 'rotate-180 bg-purple-500/20 text-purple-300' : ''
                    }`}
                  >
                    <ChevronDown size={16} />
                  </div>
                </button>

                {openFaqUltra && (
                  <div className="px-4 pb-4 pt-1 border-t border-purple-500/20 animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                    {/* Header requested by user */}
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-400/20 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">👑</span>
                          <h4 className="text-xs sm:text-sm font-black text-purple-300 tracking-wide uppercase">
                            ELITE VIP SUPERPOWERS
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Ultra (Max) Plan Se Add Hone Wale Superpowers
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setTierType('SUBSCRIPTION'); setSubTierView('MAX'); }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-[11px] hover:brightness-110 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        ⚡ Ultra Plan Dekhein
                      </button>
                    </div>

                    {/* Ultra Superpowers List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ultraSuperPowers.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-black/40 border border-purple-400/15 hover:border-purple-400/35 transition-colors"
                        >
                          <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 mb-0.5">
                              <span className="text-xs font-black text-slate-100 truncate">{item.title}</span>
                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30 shrink-0">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CONSOLIDATED VIP SUBSCRIPTIONS PAGE (PRO & MAX IN ONE PAGE) ── */}
        {tierType === 'SUBSCRIPTION' && (
          <div className="space-y-4">
            {/* ════════ TOP DAILY CLAIM CARDS (PRO, MAX & CREDIT PASS) ════════ */}
            {/* 1. Active Pro / Max VIP Daily Reward Claim Card */}
            {user.isPremium && !isSubscriptionFromCoins(user) && (
              (user.subscriptionLevel === 'BASIC') ? (
                <TierDailyClaimCard
                  targetTier="PRO"
                  userId={user.id}
                  user={user}
                  settings={settings}
                  onUpdateUser={onUserUpdate}
                />
              ) : (
                <TierDailyClaimCard
                  targetTier="MAX_PRO"
                  userId={user.id}
                  user={user}
                  settings={settings}
                  onUpdateUser={onUserUpdate}
                />
              )
            )}

            {/* Active Subscription from Credits Info Banner */}
            {user.isPremium && isSubscriptionFromCoins(user) && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
                <span className="text-base">✨</span>
                <div>
                  <span className="font-bold text-white">Active {user.subscriptionLevel === 'ULTRA' ? 'Max VIP' : 'Pro Learner'} Plan (Credits dwara activated):</span>
                  <span className="text-amber-200/90 ml-1">Aapke sabhi premium study features, MCQs, notes aur XP boost unlocked hain. (Daily credit claim sirf Cash/UPI plans par uplabdh hota hai).</span>
                </div>
              </div>
            )}

            {/* 2. Active Credit Pass Daily Claim Card (Always at TOP) */}
            {(() => {
              const hasPass = isCreditSubActive(user);
              const sub = user.creditSubscription;
              if (!hasPass || !sub) return null;
              const daysLeft = getCreditSubDaysRemaining(sub);
              const canClaim = canClaimCreditSubToday(user);

              return (
                <div
                  className="rounded-2xl p-3.5 sm:p-4 border relative overflow-hidden transition-all shadow-xl"
                  style={{
                    background: 'linear-gradient(145deg, rgba(251,191,36,0.16) 0%, rgba(20,16,10,0.94) 30%, rgba(12,12,20,0.98) 100%)',
                    borderColor: canClaim ? 'rgba(245,158,11,0.6)' : C.goldBorder,
                    boxShadow: canClaim ? '0 0 30px rgba(251,191,36,0.2)' : '0 4px 18px rgba(0,0,0,0.4)',
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 relative z-10 mb-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg mt-0.5"
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#000',
                        }}
                      >
                        ⚡
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span
                            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ background: C.gold, color: '#000' }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                            ACTIVE CREDIT PASS
                          </span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            ⏳ {daysLeft} Din Baki
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-white truncate">
                          {sub.planName || 'Daily Credit Pass'}
                        </h3>
                      </div>
                    </div>

                    <span
                      className="text-xs font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                      style={{
                        background: C.goldBg,
                        color: C.gold,
                        border: `1.5px solid ${C.goldBorder}`,
                      }}
                    >
                      🪙 +{sub.dailyCredits} CR / din
                    </span>
                  </div>

                  {canClaim ? (
                    <button
                      type="button"
                      onClick={handleClaimStorePass}
                      disabled={claimingStorePass}
                      className="w-full py-2.5 rounded-xl font-black text-xs active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#000',
                        boxShadow: '0 4px 18px rgba(245,158,11,0.45)',
                      }}
                    >
                      <Gift size={15} />
                      {claimingStorePass ? 'Claim Ho Raha Hai...' : `Aaj Ke +${sub.dailyCredits} Credits Claim Karein 🪙`}
                    </button>
                  ) : (
                    <div
                      className="py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-center"
                      style={{ background: 'rgba(52,211,153,0.12)', border: `1px solid ${C.greenBorder}` }}
                    >
                      <Check size={14} color={C.green} />
                      <span className="text-[11px] font-black text-emerald-400">
                        ✓ Aaj ka claim ho gaya (+{sub.dailyCredits} 🪙) · Agle credits kal raat 12:00 AM par milenge.
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Success Claim Toast */}
            {passClaimSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <span>{passClaimSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPassClaimSuccessMsg(null)}
                  className="w-6 h-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {subscriptionPlans.length === 0 && getCreditSubPlans(settings).filter(p => p.isActive !== false).length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
                <Package size={36} className="mx-auto mb-4" style={{ color: C.textDim }} />
                <p className="font-black text-base mb-1" style={{ color: C.textMuted }}>Plans Coming Soon</p>
                <p className="text-[12px] leading-relaxed" style={{ color: C.textDim }}>Admin jald hi plans add karega.</p>
              </div>
            ) : (
              <>
                {/* VIP Subscription Plan Cards */}
                {(() => {
                  const renderVipCard = (tierTarget: 'BASIC' | 'ULTRA') => {
                    const isProTier = tierTarget === 'BASIC';
                    const activePlanId = isProTier ? selectedProPlanId : selectedMaxPlanId;
                    const setActivePlanId = (id: string) => {
                      if (isProTier) setSelectedProPlanId(id);
                      else setSelectedMaxPlanId(id);
                    };

                    const subActive = user.isPremium && (
                      (isProTier && user.subscriptionLevel === 'BASIC') ||
                      (!isProTier && (user.subscriptionLevel === 'ULTRA' || (user.subscriptionLevel as any) === 'PRO'))
                    ) && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();

                    const daysLeft = subActive && user.subscriptionEndDate
                      ? Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - Date.now()) / 86400000))
                      : 0;

                    const themeBorder = isProTier ? '#22d3ee' : '#c084fc';
                    const themeGlow = isProTier ? 'rgba(34,211,238,0.25)' : 'rgba(192,132,252,0.25)';

                    const computePlanDetails = (plan: any) => {
                      if (!plan) return null;
                      const discInfo = calculatePlanDiscount(plan, isProTier);
                      const planDurL2 = (plan.duration || '').toLowerCase();

                      const perMonth = getPerMonthPrice(plan, discInfo.finalPrice);
                      const creditCost = getPlanCreditCost(plan, !isProTier);

                      let days = 30;
                      if (planDurL2.includes('year') || planDurL2.includes('365') || planDurL2.includes('annual')) {
                        days = 365;
                      } else if (planDurL2.includes('3 month') || planDurL2.includes('90') || planDurL2.includes('quarter')) {
                        days = 90;
                      } else if (planDurL2.includes('month') || planDurL2.includes('30')) {
                        days = 30;
                      } else if (planDurL2.includes('week') || planDurL2.includes('7')) {
                        days = 7;
                      } else if (discInfo.isLifetimePlan) {
                        days = 3650;
                      }

                      const perDayCost = days > 0 ? (discInfo.finalPrice / days).toFixed(1) : '0';

                      return {
                        plan,
                        ...discInfo,
                        effectiveDiscount: discInfo.totalEffectiveDiscount,
                        perMonth,
                        creditCost,
                        days,
                        perDayCost,
                      };
                    };

                    const activePlan = subscriptionPlans.find(p => p.id === activePlanId) || subscriptionPlans[0];
                    const activeDetails = computePlanDetails(activePlan);
                    const cardFeatures = filterGroupStudy(
                      isProTier
                        ? ((settings?.storeFeatures?.basic?.length && !settings?.storeFeatures?.basic?.includes('Full MCQs Unlocked'))
                            ? settings.storeFeatures.basic.filter(f => f.trim())
                            : defaultBasicFeatures)
                        : ((settings?.storeFeatures?.ultra?.length && !settings?.storeFeatures?.ultra?.includes('3,000 MCQs Daily'))
                            ? settings.storeFeatures.ultra.filter(f => f.trim())
                            : defaultUltraFeatures)
                    );

                    if (!activePlan || !activeDetails) return null;

                    return (
                      <div
                        key={tierTarget}
                        className="mb-4 rounded-2xl p-3 sm:p-4 relative overflow-hidden transition-all shadow-xl"
                        style={{
                          background: isProTier
                            ? 'linear-gradient(145deg, rgba(8,51,68,0.75) 0%, rgba(6,30,48,0.92) 50%, rgba(3,15,28,0.98) 100%)'
                            : 'linear-gradient(145deg, rgba(59,7,100,0.7) 0%, rgba(33,9,68,0.92) 50%, rgba(15,5,32,0.98) 100%)',
                          border: `1.5px solid ${themeBorder}55`,
                          boxShadow: `0 8px 32px ${themeGlow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                        }}
                      >
                        {/* Glow Circle */}
                        <div
                          className="absolute -right-16 -top-16 w-52 h-52 rounded-full pointer-events-none blur-3xl opacity-30"
                          style={{ background: isProTier ? '#06b6d4' : '#a855f7' }}
                        />

                        {/* Top-Right Tier Corner Badge */}
                        <div
                          className="absolute top-0 right-0 text-[9px] font-black px-2.5 py-0.5 rounded-bl-xl tracking-wider uppercase z-20 shadow-sm"
                          style={{
                            background: isProTier ? '#06b6d4' : '#a855f7',
                            color: isProTier ? '#04111d' : '#1e0538',
                          }}
                        >
                          {isProTier ? 'PRO PASS' : 'MAX VIP'}
                        </div>

                        {/* Top Header: Title & Badges on Left, Dynamic Price on Right */}
                        <div className="flex items-start justify-between gap-2 relative z-10 mb-2 pb-2 border-b border-white/10 pr-16 sm:pr-20">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-base sm:text-lg shrink-0">
                                {isProTier ? '⭐' : '👑'}
                              </span>
                              <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                                {isProTier ? 'Pro Learner Pass' : 'Max Elite VIP Pass'}
                              </h2>
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0">
                                🪙 +{isProTier ? 50 : 100}/din
                              </span>
                              <span
                                className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  background: isProTier ? 'rgba(6,182,212,0.18)' : 'rgba(251,191,36,0.18)',
                                  color: isProTier ? '#67e8f9' : '#fde047',
                                  border: isProTier ? '1px solid rgba(6,182,212,0.35)' : '1px solid rgba(251,191,36,0.35)',
                                }}
                              >
                                ⚡ {isProTier ? '1.5x XP' : '2.0x XP'}
                              </span>
                              {activeDetails.effectiveDiscount > 0 && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 shrink-0">
                                  {activeDetails.effectiveDiscount}% OFF
                                </span>
                              )}
                            </div>

                            {/* Subtitle / Active Status */}
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-300">
                              {subActive ? (
                                <div className="flex items-center gap-1 font-bold text-emerald-400">
                                  <BadgeCheck size={11} color="#34d399" />
                                  <span>Active Plan · {daysLeft} din baaki</span>
                                </div>
                              ) : (
                                <p className="truncate text-slate-300">
                                  Daily claim & sabhi premium features instantly unlock
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Live Dynamic Price on Right */}
                          <div className="text-right shrink-0 pt-0.5">
                            <div className="flex items-baseline justify-end gap-1">
                              {activeDetails.effectiveDiscount > 0 && (
                                <span className="text-[11px] line-through text-slate-400 font-bold">
                                  ₹{activeDetails.basePrice.toLocaleString('en-IN')}
                                </span>
                              )}
                              <span className={`text-xl sm:text-2xl font-black leading-none ${isProTier ? 'text-cyan-300' : 'text-purple-300'}`}>
                                ₹{activeDetails.finalPrice.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-0.5 text-[9.5px] text-slate-400 font-medium">
                              <span>₹{activeDetails.perDayCost}/din</span>
                              {activeDetails.perMonth && (
                                <span>· ≈ ₹{activeDetails.perMonth}/mo</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ── Validity / Duration Selector Directly On Card ── */}
                        <div className="p-2.5 rounded-xl bg-black/35 border border-white/5 my-2.5 relative z-10">
                          <div className="flex items-center justify-between mb-1.5 px-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                              <Clock size={11} /> VALIDITY CHUNEIN:
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              Selected: <strong className="text-white">{activeDetails.plan.duration || activeDetails.plan.name}</strong>
                            </span>
                          </div>

                          <div className={`grid gap-1.5 ${subscriptionPlans.length <= 4 ? 'grid-cols-4' : 'grid-flow-col auto-cols-fr overflow-x-auto'}`}>
                            {subscriptionPlans.map((plan) => {
                              const isSel = activePlan.id === plan.id;
                              const pInfo = computePlanDetails(plan);
                              if (!pInfo) return null;

                              const dur = (plan.duration || plan.name || '').toLowerCase();
                              let shortLabel = plan.duration || plan.name;
                              let shortDays = `${pInfo.days}D`;
                              if (dur.includes('week') || dur.includes('7')) { shortLabel = 'Weekly'; shortDays = '7D'; }
                              else if (dur.includes('365') || dur.includes('year')) { shortLabel = '1 Year'; shortDays = '365D'; }
                              else if (dur.includes('90') || dur.includes('3 month') || dur.includes('quarter')) { shortLabel = '3 Months'; shortDays = '90D'; }
                              else if (dur.includes('180') || dur.includes('6 month')) { shortLabel = '6 Months'; shortDays = '180D'; }
                              else if (dur.includes('month') || dur.includes('30')) { shortLabel = '1 Month'; shortDays = '30D'; }
                              else if (pInfo.isLifetimePlan) { shortLabel = 'Lifetime'; shortDays = 'VIP'; }

                              const badgeText = pInfo.durDiscount > 0
                                ? `${pInfo.durDiscount}% OFF`
                                : (pInfo.isLifetimePlan ? 'VIP' : null);

                              return (
                                <button
                                  key={plan.id}
                                  type="button"
                                  onClick={() => setActivePlanId(plan.id)}
                                  className={`py-1.5 px-1 rounded-lg text-center transition-all border relative flex flex-col items-center justify-center cursor-pointer min-w-0 ${
                                    isSel
                                      ? (isProTier
                                          ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black shadow-[0_0_10px_rgba(34,211,238,0.35)]'
                                          : 'bg-purple-400 text-slate-950 border-purple-300 font-black shadow-[0_0_10px_rgba(192,132,252,0.35)]')
                                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                  }`}
                                >
                                  {badgeText && (
                                    <span className={`text-[8px] font-black px-1 rounded leading-tight -mt-0.5 mb-0.5 ${
                                      isSel
                                        ? 'bg-slate-950 text-white'
                                        : (pInfo.durDiscount > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700/60 text-slate-300')
                                    }`}>
                                      {badgeText}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-black leading-tight truncate w-full">
                                    {shortLabel}
                                  </span>
                                  <span className={`text-[9px] leading-tight ${isSel ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                                    {shortDays}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Successive / Compound Discount Explainer Strip */}
                        {activeDetails.totalEffectiveDiscount > 0 && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/25 my-2 text-[10.5px] relative z-10">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap mb-1 pb-1 border-b border-amber-400/20">
                              <span className="font-black text-amber-300 flex items-center gap-1 text-[11px]">
                                <span>🔥</span> Discount Breakdown: <strong className="text-white text-xs">Flat {activeDetails.totalEffectiveDiscount}% OFF</strong>
                              </span>
                              <span className="text-[10px] font-bold text-amber-200 bg-amber-400/20 px-1.5 py-0.2 rounded">
                                ₹{(activeDetails.basePrice - activeDetails.finalPrice).toLocaleString('en-IN')} Ki Direct Bachat
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              {activeDetails.durDiscount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-white/10 text-white font-bold">
                                  Plan: {activeDetails.durDiscount}%
                                </span>
                              )}
                              {activeDetails.subDiscount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                  + Renewal: {activeDetails.subDiscount}%
                                </span>
                              )}
                              {activeDetails.userBonusDiscount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                                  + Bonus: {activeDetails.userBonusDiscount}%
                                </span>
                              )}
                              {activeDetails.eventDiscount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-orange-500/25 text-orange-300 font-black border border-orange-400/35">
                                  + Event: {activeDetails.eventDiscount}%
                                </span>
                              )}
                              <span className="font-black text-amber-300 ml-auto">
                                ➔ Total: {activeDetails.totalEffectiveDiscount}% OFF
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Features & Privileges List */}
                        <div className="my-2 p-2.5 rounded-xl bg-black/35 border border-white/10 relative z-10">
                          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
                            <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                              <span>✨</span> {isProTier ? 'Pro Member' : 'Max Elite'} Features ({cardFeatures.length} Unlocked):
                            </span>
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                              isProTier ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30' : 'bg-purple-400/20 text-purple-300 border border-purple-400/30'
                            }`}>
                              {isProTier ? 'All Basic Features' : 'All VIP Superpowers'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
                            {cardFeatures.map((feat: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-[10.5px] text-slate-200 leading-tight min-w-0">
                                <span className={`shrink-0 font-black text-xs ${isProTier ? 'text-cyan-400' : 'text-purple-400'}`}>✓</span>
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 mt-3 relative z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlanId(activePlan.id);
                              setSelectedTierForPurchase(isProTier ? 'BASIC' : 'ULTRA');
                              setShowPaymentChooser(true);
                            }}
                            className="w-full py-3.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                            style={{
                              background: isProTier
                                ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                                : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                              color: '#fff',
                              boxShadow: `0 4px 18px ${themeGlow}`,
                            }}
                          >
                            <Zap size={16} />
                            <span>
                              {activeDetails.plan.duration || activeDetails.plan.name} Subscribe Karein — ₹{activeDetails.finalPrice.toLocaleString('en-IN')}
                            </span>
                            <ChevronRight size={16} />
                          </button>

                          {isCreditSubAllowed && !activeDetails.isLifetimePlan && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlanId(activePlan.id);
                                setSelectedTierForPurchase(isProTier ? 'BASIC' : 'ULTRA');
                                if (userCredits < activeDetails.creditCost) {
                                  setCreditPurchaseMsg(`Credits kam hain! Chahiye: ${activeDetails.creditCost.toLocaleString('en-IN')} CR (Aapke paas: ${userCredits.toLocaleString('en-IN')} CR)`);
                                  setTimeout(() => setCreditPurchaseMsg(null), 4000);
                                  return;
                                }
                                setShowCreditConfirm(true);
                              }}
                              className="w-full py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 border cursor-pointer"
                              style={{
                                background: 'rgba(251,191,36,0.10)',
                                borderColor: 'rgba(251,191,36,0.35)',
                                color: '#fbbf24',
                              }}
                            >
                              <span>🪙 {activeDetails.creditCost.toLocaleString('en-IN')} Credits Se Kharido</span>
                              <span className="text-[10px] text-amber-200/80">
                                (Balance: {userCredits.toLocaleString('en-IN')} CR)
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const renderCreditPassCard = () => {
                    const creditSubPlans = getCreditSubPlans(settings).filter(p => p.isActive !== false);
                    if (creditSubPlans.length === 0) return null;

                    return (
                      <div className="space-y-3">
                        {/* Credit Pass Plan Card(s) */}
                        {creditSubPlans.map(plan => {
                          const selectedDurationId = planDurations[plan.id] || '1_MONTH';
                          const selectedDurationOpt = CREDIT_SUB_DURATIONS.find(d => d.id === selectedDurationId) || CREDIT_SUB_DURATIONS[0];
                          const durDisc = getCreditSubDurationDiscount(selectedDurationOpt.id);
                          const pricing = calculateCreditSubPrice(plan, selectedDurationOpt, false, durDisc);
                          const planMult = plan.scoreMultiplier || getCreditSubPlanMultiplier(plan);
                          const userTier = user.isPremium ? (user.subscriptionLevel || 'FREE') : 'FREE';
                          const baseMult = userTier === 'ULTRA' ? 2.0 : userTier === 'BASIC' ? 1.5 : 1.0;
                          const effectiveCombinedMult = Math.round((baseMult + (planMult - 1.0)) * 10) / 10;
                          const extraBoostPct = Math.round((planMult - 1.0) * 100);

                          return (
                            <div
                              key={plan.id}
                              className="rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border relative overflow-hidden transition-all shadow-xl"
                              style={{
                                background: 'linear-gradient(145deg, rgba(35,20,5,0.75) 0%, rgba(18,11,3,0.92) 50%, rgba(10,7,2,0.98) 100%)',
                                borderColor: 'rgba(251,191,36,0.35)',
                                boxShadow: '0 4px 20px rgba(251,191,36,0.08)',
                              }}
                            >
                              <div
                                className="absolute top-0 right-0 text-[8px] font-black px-2.5 py-0.5 rounded-bl-xl tracking-wider uppercase"
                                style={{ background: C.gold, color: '#000' }}
                              >
                                {plan.badge || 'CREDIT PASS'}
                              </div>

                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-base">⚡</span>
                                    <h2 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                                      {plan.name}
                                    </h2>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0">
                                      🪙 +{plan.dailyCredits}/din
                                    </span>
                                    <span
                                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                                      style={{
                                        background: 'rgba(251,191,36,0.18)',
                                        color: '#fde047',
                                        border: '1px solid rgba(251,191,36,0.35)',
                                      }}
                                    >
                                      ⚡ +{extraBoostPct}% XP
                                    </span>
                                    {pricing.totalDiscountPercent > 0 && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 shrink-0">
                                        {pricing.totalDiscountPercent}% OFF
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-0.5 text-[10px] text-slate-300 truncate">
                                    Guaranteed daily credit deposits · Har roz claim karein
                                  </p>
                                </div>

                                <div className="text-right shrink-0 pt-0.5">
                                  <div className="flex items-baseline justify-end gap-1">
                                    {pricing.totalDiscountPercent > 0 && (
                                      <span className="text-[11px] line-through text-slate-400 font-bold">
                                        ₹{pricing.basePrice.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                    <span className="text-base sm:text-lg font-black text-amber-400">
                                      ₹{pricing.finalPrice.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-medium">
                                    ₹{pricing.perDayCost}/din · ₹{pricing.perCreditCost}/credit
                                  </div>
                                </div>
                              </div>

                              {/* Validity Selector in 1-line Grid */}
                              <div className="p-2 rounded-xl bg-black/40 border border-white/10 my-2">
                                <div className="flex items-center justify-between mb-1 px-0.5">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                    <Clock size={11} /> Validity Chunein:
                                  </span>
                                  <span className="text-[9px] font-medium text-slate-400">
                                    Total <strong className="text-amber-300">{pricing.totalCredits.toLocaleString('en-IN')} 🪙</strong>
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                                  {CREDIT_SUB_DURATIONS.map(dur => {
                                    const isSelected = selectedDurationId === dur.id;
                                    return (
                                      <button
                                        key={dur.id}
                                        type="button"
                                        onClick={() => setPlanDurations(prev => ({ ...prev, [plan.id]: dur.id }))}
                                        className={`py-1.5 px-1 rounded-lg text-center transition-all border relative flex flex-col items-center justify-center cursor-pointer ${
                                          isSelected
                                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                        }`}
                                      >
                                        {(() => {
                                          const durPillDisc = getCreditSubDurationDiscount(dur.id);
                                          if (durPillDisc <= 0) return null;
                                          return (
                                            <span className={`text-[8px] font-black px-1 rounded leading-tight -mt-0.5 mb-0.5 ${
                                              isSelected ? 'bg-slate-950 text-amber-300' : 'bg-emerald-500 text-slate-950'
                                            }`}>
                                              {durPillDisc}% OFF
                                            </span>
                                          );
                                        })()}
                                        <span className="text-[10px] sm:text-[11px] font-black leading-tight">
                                          {dur.label}
                                        </span>
                                        <span className={`text-[8px] sm:text-[9px] leading-tight ${isSelected ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                                          {dur.durationDays}D
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Multiplier strip */}
                              <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/25 my-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs shrink-0">⚡</span>
                                  <p className="text-[10px] text-slate-300 truncate">
                                    <strong className="text-amber-300">{planMult}x XP Pass Boost (+{extraBoostPct}%)</strong> · Total Effective XP: <strong className="text-emerald-400">{effectiveCombinedMult}x</strong>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowAllTiersModal(true)}
                                  className="shrink-0 text-[9px] font-bold text-amber-300 hover:text-amber-200 underline decoration-dotted cursor-pointer"
                                >
                                  Tiers Info
                                </button>
                              </div>

                              {/* Quick Perks */}
                              <div className="grid grid-cols-2 gap-1 my-2 text-[10px] text-slate-300">
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400">✓</span>
                                  <span>No Expiry (Credits Safe)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400">✓</span>
                                  <span>Har Raat 12 AM Reset</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400">✓</span>
                                  <span>Stacks with Pro & Max VIP</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400">✓</span>
                                  <span>Instant Activation</span>
                                </div>
                              </div>

                              {/* Subscribe Button */}
                              <button
                                type="button"
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
                                className="w-full py-2.5 rounded-xl font-black text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md cursor-pointer mt-1"
                                style={{
                                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                  color: '#000',
                                  boxShadow: '0 4px 18px rgba(245,158,11,0.3)',
                                }}
                              >
                                <Zap size={14} />
                                <span>
                                  {plan.name} ({selectedDurationOpt.label}) Subscribe Karein — ₹{pricing.finalPrice.toLocaleString('en-IN')}
                                </span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <>
                      {renderVipCard('BASIC')}
                      {renderVipCard('ULTRA')}
                      {renderCreditPassCard()}
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

                {/* Trust row */}
                <div className="flex justify-center gap-8 pt-2 pb-4">
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
          </div>
        )}

        {/* All Tiers Stacking Modal for Credit Pass reference */}
        {showAllTiersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-md w-full p-5 space-y-4 relative shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-base font-black text-white">Subscription & Pass XP Stacking</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllTiersModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg text-lg leading-none cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p>
                  Agar aapke paas already koi subscription (Basic ya Ultra) hai, to Credit Pass ka bonus multiplier usme jud jata hai:
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-black text-white">Free Plan User (1.0x Base)</span>
                      <p className="text-[10px] text-slate-400">Pass se jitna multiplier hai wahi milega (e.g. 1.1x / 1.5x)</p>
                    </div>
                    <span className="text-xs font-bold text-amber-300">1.0x + Boost</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-black text-white">Basic Plan User (1.5x Base)</span>
                      <p className="text-[10px] text-slate-400">1.5x Base + Pass Multiplier Boost jud kar milta hai</p>
                    </div>
                    <span className="text-xs font-bold text-amber-300">1.5x + Boost</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-black text-white">Ultra Plan User (2.0x Base)</span>
                      <p className="text-[10px] text-slate-400">2.0x Base + Pass Multiplier Boost jud kar milta hai</p>
                    </div>
                    <span className="text-xs font-bold text-amber-300">2.0x + Boost</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAllTiersModal(false)}
                className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition-colors cursor-pointer">
                Samajh Gaya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
