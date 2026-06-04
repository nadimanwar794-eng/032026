import React, { useState, useEffect } from 'react';
import { User, CreditPackage, SystemSettings } from '../types';
import {
  Sparkles, Check, MessageSquare, Lock, Ticket, ShieldCheck, Star,
  ChevronRight, Flame, BadgeCheck, History, TrendingDown,
  Calendar, Clock, Crown, DollarSign, ArrowLeft, Zap, Gift, Coins,
  Package, Wallet, X
} from 'lucide-react';
import { saveUserToLive } from '../firebase';
import { getLevelInfo, getScoreDiscountFromScore } from '../utils/levelSystem';

interface Props {
  user: User;
  settings?: SystemSettings;
  onUserUpdate: (user: User) => void;
  renderEarnContent?: React.ReactNode;
  onBack?: () => void;
  themeColor?: string;
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
function getCreditPrice(planDuration: string, isUltra: boolean): number {
  const d = (planDuration || '').toLowerCase();
  let base = 3500;
  if (d.includes('year') || d.includes('365') || d.includes('annual') || d.includes('1 yr')) base = 35000;
  else if (d.includes('3 month') || d.includes('90') || d.includes('quarter') || d.includes('tri')) base = 10000;
  else if (d.includes('month') || d.includes('30')) base = 3500;
  else if (d.includes('week') || d.includes('7')) base = 1000;
  return isUltra ? base : Math.round(base * 0.75);
}

/* ─── Main Store ─── */
export const Store: React.FC<Props> = ({ user, settings, onUserUpdate, renderEarnContent, onBack }) => {
  const [tierType, setTierType] = useState<'BASIC' | 'ULTRA' | 'EARN' | 'CREDITS' | 'HISTORY'>('BASIC');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const packages = settings?.packages || [];
  const subscriptionPlans = settings?.subscriptionPlans || [];

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
    if (!event?.enabled) return false;
    const now = Date.now();
    if (!event.startsAt && !event.endsAt) return true;
    const startsAt = event.startsAt ? new Date(event.startsAt).getTime() : 0;
    const endsAt = event.endsAt ? new Date(event.endsAt).getTime() : Infinity;
    if (startsAt === endsAt) return now >= startsAt;
    return now >= startsAt && now < endsAt;
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
    const isUltra = tierType === 'ULTRA';
    const dur = (plan.duration || '').toLowerCase();
    const pName = (plan.name || '').toLowerCase();
    if (pName.includes('lifetime') || dur.includes('lifetime') || plan.tier === 'LIFETIME') {
      setCreditPurchaseMsg('❌ Lifetime plan credits se nahi kharida ja sakta.');
      setTimeout(() => setCreditPurchaseMsg(null), 4000);
      return;
    }
    const creditCost = getCreditPrice(plan.duration || plan.name || '', isUltra);
    const userCredits = (user.credits || 0) + (user.bonusCredits || 0);
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
    const updatedUser = {
      ...user,
      credits: Math.max(0, (user.credits || 0) - creditCost),
      activeSubscriptions: [...(user.activeSubscriptions || []), newSub as any],
      subscriptionTier: subTier, subscriptionLevel: subLevel,
      subscriptionEndDate: endDate.toISOString(),
      isPremium: true, grantedByAdmin: false,
      subscriptionHistory: [histEntry, ...(user.subscriptionHistory || [])],
    };

    try {
      setCreditConfirmLoading(true);
      await saveUserToLive(updatedUser);
      onUserUpdate(updatedUser);
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
    const isSub = purchaseItem.duration !== undefined;
    const price = isSub
      ? (purchaseItem.finalPrice !== undefined ? purchaseItem.finalPrice : (tierType === 'BASIC' ? purchaseItem.basicPrice : purchaseItem.ultraPrice))
      : purchaseItem.price;
    const features = isSub ? (tierType === 'BASIC' ? 'MCQ + Notes (Pro)' : 'PDF + Videos + AI Studio (Max)') : `${purchaseItem.credits} Credits`;
    const msg = `Hello Admin, I want to buy:\n\nItem: ${purchaseItem.name} ${isSub ? `(${tierType === 'BASIC' ? 'PRO' : 'MAX'})` : ''}\nPrice: ₹${price}\nUser ID: ${user.id}\nDetails: ${features}\n\nPlease share payment details.`;
    window.open(`https://wa.me/91${numEntry.number}?text=${encodeURIComponent(msg)}`, '_blank');
    setShowSupportModal(false);
  };
  const initiatePurchase = (item: any) => { setPurchaseItem(item); setShowSupportModal(true); };


  const isPro = tierType === 'BASIC';
  const isGameEnabled = settings?.isGameEnabled !== false;

  const ac = isPro
    ? { color: C.pro, bg: C.proBg, border: C.proBorder, glow: C.proGlow, grad: C.proGrad, pill: 'rgba(34,211,238,0.14)', label: 'PRO', emoji: '⭐' }
    : { color: C.max, bg: C.maxBg, border: C.maxBorder, glow: C.maxGlow, grad: C.maxGrad, pill: 'rgba(192,132,252,0.14)', label: 'MAX', emoji: '⚡' };

  const allTabs = [
    { id: 'BASIC'   as const, label: 'Pro',     emoji: '⭐', color: C.pro,  bg: C.proBg,  border: C.proBorder,  glow: C.proGlow  },
    { id: 'ULTRA'   as const, label: 'Max',     emoji: '⚡', color: C.max,  bg: C.maxBg,  border: C.maxBorder,  glow: C.maxGlow  },
    ...(packages.length > 0 ? [{ id: 'CREDITS' as const, label: 'Credits', emoji: '🪙', color: C.gold, bg: C.goldBg, border: C.goldBorder, glow: 'rgba(251,191,36,0.18)' }] : []),
    ...(isGameEnabled ? [{ id: 'EARN' as const, label: 'Earn', emoji: '🎁', color: C.earn, bg: C.earnBg, border: C.earnBorder, glow: 'rgba(52,211,153,0.18)' }] : []),
  ];

  const totalDiscount = (() => {
    let d = 0;
    if (activeEvent && event?.discountPercent) d += event.discountPercent;
    if (isSubscribed) d += 5;
    if (activeStoreDiscount > 0) d += activeStoreDiscount;
    if (scoreDiscount > 0) d += scoreDiscount;
    if (visitDiscount > 0) d += visitDiscount;
    return Math.min(d, 100);
  })();

  const defaultBasicFeatures = ['Full MCQs Unlocked', 'Premium Notes', 'Audio Library', 'AI Videos (2D Basic)', 'Team Support'];
  const defaultUltraFeatures = ['Everything in Pro', 'Deep Dive Notes', 'Studio HD Podcast', 'AI Videos (2D + 3D)', 'Competitive Mode 🏆'];
  const featuresList = isPro
    ? (settings?.storeFeatures?.basic?.filter(f => f.trim()) || defaultBasicFeatures)
    : (settings?.storeFeatures?.ultra?.filter(f => f.trim()) || defaultUltraFeatures);

  const getPerMonthPrice = (plan: any, price: number) => {
    if ((plan.duration || '').toLowerCase().includes('year') || (plan.duration || '').includes('365')) return Math.round(price / 12);
    return null;
  };

  const userCredits = (user.credits || 0) + (user.bonusCredits || 0);

  /* ── Store locked ── */
  if (settings?.isPaymentEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.bg }}>
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
    <div className="min-h-screen pb-32 animate-in fade-in duration-300" style={{ background: C.bg }}>

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
        const finalPrice = isPro ? selectedPlan.basicPrice : selectedPlan.ultraPrice;
        const creditCost = getCreditPrice(selectedPlan.duration || selectedPlan.name || '', !isPro);
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
                      <p className="font-black text-sm" style={{ color: C.text }}>₹{finalPrice.toLocaleString('en-IN')} se Kharido</p>
                      <p className="text-[11px] mt-0.5" style={{ color: C.textMuted }}>WhatsApp par payment karo — Instant activate</p>
                    </div>
                    <ChevronRight size={16} color={C.textDim} />
                  </button>
                  {!isLifetimePlan && (
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
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── CREDIT CONFIRM POPUP ── */}
      {showCreditConfirm && selectedPlan && (() => {
        const creditCost = getCreditPrice(selectedPlan.duration || selectedPlan.name || '', !isPro);
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
      <div className="relative overflow-hidden" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {/* Ambient glow blobs */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: isPro ? 'rgba(34,211,238,0.07)' : 'rgba(192,132,252,0.07)', filter: 'blur(40px)' }} />
        <div className="absolute -bottom-10 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: C.goldBg, filter: 'blur(30px)' }} />

        <div className="relative px-4 pt-5 pb-4">
          {/* Single header row: Back + Crown + Title | Credits + Status */}
          <div className="flex items-center gap-2.5 mb-4">
            {onBack && (
              <button onClick={onBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                style={{ background: C.surfaceHigh, border: `1px solid ${C.border}` }}>
                <ArrowLeft size={16} color={C.textMuted} />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.22),rgba(251,191,36,0.08))', border: `1.5px solid ${C.goldBorder}`, boxShadow: `0 0 14px rgba(251,191,36,0.2)` }}>
              <Crown size={18} color={C.gold} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black leading-none" style={{ color: C.text }}>Premium Store</h1>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: C.textMuted }}>Sab kuch unlock karo</p>
            </div>
            {/* Credits + Status */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl"
                style={{ background: C.goldBg, border: `1.5px solid ${C.goldBorder}`, boxShadow: `0 0 10px rgba(251,191,36,0.12)` }}>
                <span className="text-sm leading-none">🪙</span>
                <span className="font-black text-sm leading-none" style={{ color: C.gold }}>
                  {userCredits.toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] font-black" style={{ color: 'rgba(251,191,36,0.55)' }}>CR</span>
              </div>
              {user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date() && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
                  style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
                  <BadgeCheck size={10} color={C.green} />
                  <span className="text-[10px] font-black" style={{ color: C.green }}>
                    {user.subscriptionLevel === 'ULTRA' ? 'MAX' : 'PRO'} Active
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Plan type tabs + History */}
          {(() => {
            const totalCols = allTabs.length + 1;
            const colClass = totalCols === 3 ? 'grid-cols-3' : totalCols === 4 ? 'grid-cols-4' : totalCols === 5 ? 'grid-cols-5' : 'grid-cols-4';
            return (
              <div className={`grid gap-2 ${colClass}`}>
                {allTabs.map(tab => {
                  const isActive = tierType === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setTierType(tab.id)}
                      className="py-3 rounded-2xl font-black transition-all flex flex-col items-center gap-1 relative overflow-hidden"
                      style={isActive
                        ? { background: tab.bg, border: `2px solid ${tab.border}`, boxShadow: `0 0 14px ${tab.glow}, inset 0 1px 0 rgba(255,255,255,0.08)` }
                        : { background: C.surfaceHigh, border: `1.5px solid ${C.border}` }}>
                      {isActive && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: `radial-gradient(ellipse at 50% 0%, ${tab.glow} 0%, transparent 70%)` }} />
                      )}
                      <span className="text-lg leading-none relative z-10">{tab.emoji}</span>
                      <span className="text-[11px] relative z-10" style={{ color: isActive ? tab.color : C.textMuted }}>{tab.label}</span>
                    </button>
                  );
                })}
                {/* History tab */}
                <button onClick={() => setTierType('HISTORY')}
                  className="py-3 rounded-2xl font-black transition-all flex flex-col items-center gap-1 relative overflow-hidden"
                  style={tierType === 'HISTORY'
                    ? { background: 'rgba(251,191,36,0.10)', border: `2px solid rgba(251,191,36,0.35)`, boxShadow: '0 0 14px rgba(251,191,36,0.18)' }
                    : { background: C.surfaceHigh, border: `1.5px solid ${C.border}` }}>
                  <span className="text-lg leading-none">📋</span>
                  <span className="text-[11px]" style={{ color: tierType === 'HISTORY' ? C.gold : C.textMuted }}>History</span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ══════════ BODY ══════════ */}
      <div className="px-4 pt-5">

        {/* ── DISCOUNT BANNER ── */}
        {totalDiscount > 0 && showEventBanner && (
          <div className="mb-5 animate-in fade-in">
            <div className="p-4 rounded-2xl"
              style={activeEvent
                ? { background: 'linear-gradient(135deg,rgba(251,191,36,0.13),rgba(234,88,12,0.07))', border: `1.5px solid ${C.goldBorder}` }
                : { background: C.surfaceHigh, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activeEvent ? '🔥' : '⏳'}</span>
                <div className="flex-1">
                  <p className="text-sm font-black" style={{ color: activeEvent ? C.gold : C.text }}>
                    {activeEvent
                      ? `${event?.eventName || 'Flash Sale'} — ${event?.discountPercent || 0}% OFF!`
                      : `${event?.eventName || 'Sale'} — Jald aane wala hai!`}
                  </p>
                  {activeEvent && <p className="text-[11px] mt-0.5" style={{ color: '#fb923c' }}>Sabhi plans pe discount laga hua hai</p>}
                </div>
              </div>
              {timeLeft && (
                <div className="flex gap-2 mt-3 justify-center">
                  {timeLeft.days > 0 && (
                    <div className="rounded-xl px-3 py-2 text-center min-w-[48px]" style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <p className="text-lg font-black font-mono leading-none" style={{ color: C.text }}>{String(timeLeft.days).padStart(2,'0')}</p>
                      <p className="text-[8px] uppercase mt-0.5" style={{ color: C.textMuted }}>Days</p>
                    </div>
                  )}
                  {[{v:timeLeft.hours,l:'Hrs'},{v:timeLeft.minutes,l:'Min'},{v:timeLeft.seconds,l:'Sec'}].map(t => (
                    <div key={t.l} className="rounded-xl px-3 py-2 text-center min-w-[48px]" style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <p className="text-lg font-black font-mono leading-none" style={{ color: C.text }}>{String(t.v).padStart(2,'0')}</p>
                      <p className="text-[8px] uppercase mt-0.5" style={{ color: C.textMuted }}>{t.l}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* ── EARN TAB ── */}
        {tierType === 'EARN' && isGameEnabled && (
          <div className="animate-in fade-in duration-200">
            {renderEarnContent ?? (
              <div className="text-center py-16" style={{ color: C.textMuted }}>
                <p className="text-4xl mb-3">🎁</p>
                <p className="font-bold text-sm">Earn content loading...</p>
              </div>
            )}
          </div>
        )}

        {/* ── CREDITS TAB ── */}
        {tierType === 'CREDITS' && packages.length > 0 && (
          <div className="animate-in fade-in duration-200 space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: C.textMuted }}>
              <span className="text-base">🪙</span> Credits Kharido
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

        {/* ── PRO / MAX PLANS ── */}
        {tierType !== 'EARN' && tierType !== 'CREDITS' && tierType !== 'HISTORY' && (
          <>
            {subscriptionPlans.length === 0 ? (
              <div className="rounded-2xl p-12 text-center" style={{ border: `1.5px dashed ${C.border}` }}>
                <Package size={36} className="mx-auto mb-4" style={{ color: C.textDim }} />
                <p className="font-black text-base mb-1" style={{ color: C.textMuted }}>Plans Coming Soon</p>
                <p className="text-[12px] leading-relaxed" style={{ color: C.textDim }}>Admin jald hi plans add karega.</p>
              </div>
            ) : (
              <>
                {/* ── Features card (redesigned) ── */}
                <div className="mb-5 rounded-3xl relative overflow-hidden"
                  style={{ background: ac.bg, border: `2px solid ${ac.border}`, boxShadow: `0 0 32px ${ac.glow}` }}>
                  {/* Top gradient stripe */}
                  <div className="h-1.5 w-full" style={{ background: ac.grad }} />
                  {/* Glow blob */}
                  <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: ac.glow, filter: 'blur(32px)' }} />

                  <div className="relative p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                          style={{ background: ac.pill, border: `1.5px solid ${ac.border}` }}>
                          {ac.emoji}
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: ac.color }}>
                            {ac.label} Plan
                          </div>
                          <p className="text-xl font-black leading-none" style={{ color: C.text }}>
                            {isPro ? 'Pro Features' : 'Max Features'}
                          </p>
                        </div>
                      </div>
                      {isSubscribed && (
                        <span className="text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0"
                          style={{ background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                          <BadgeCheck size={11} /> Active
                        </span>
                      )}
                    </div>

                    {/* Feature list */}
                    <div className="space-y-2.5">
                      {featuresList.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: ac.pill, border: `1px solid ${ac.border}` }}>
                            <Check size={12} color={ac.color} strokeWidth={3} />
                          </div>
                          <span className="text-[13px] font-semibold" style={{ color: C.text }}>{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* Discount breakdown */}
                    {totalDiscount > 0 && (() => {
                      const rows: { label: string; pct: number; emoji: string }[] = [];
                      if (activeEvent && event?.discountPercent) rows.push({ label: event.eventName || 'Offer', pct: event.discountPercent, emoji: '🔥' });
                      if (scoreDiscount > 0) rows.push({ label: `Level Discount (${scoreTier.label})`, pct: scoreDiscount, emoji: '⭐' });
                      if (isSubscribed) rows.push({ label: 'Membership Renewal', pct: 5, emoji: '♻️' });
                      if (activeStoreDiscount > 0) rows.push({ label: 'Special Discount', pct: activeStoreDiscount, emoji: '🎁' });
                      if (visitDiscount > 0) rows.push({ label: 'Loyalty Discount', pct: visitDiscount, emoji: '💎' });
                      return (
                        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${ac.border}`, background: 'rgba(0,0,0,0.25)' }}>
                          {rows.map((r, i) => (
                            <div key={r.label} className="flex items-center justify-between px-3 py-2"
                              style={{ borderBottom: i < rows.length - 1 ? `1px solid rgba(255,255,255,0.07)` : 'none' }}>
                              <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: C.textMuted }}>
                                <span>{r.emoji}</span>{r.label}
                              </span>
                              <span className="text-[11px] font-black" style={{ color: C.gold }}>-{r.pct}%</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-3 py-2 rounded-b-xl"
                            style={{ background: 'rgba(251,191,36,0.12)', borderTop: `1px solid rgba(251,191,36,0.25)` }}>
                            <span className="text-[11px] font-black flex items-center gap-1.5" style={{ color: C.gold }}>
                              🏷️ Total Discount
                            </span>
                            <span className="text-[13px] font-black" style={{ color: C.gold }}>{totalDiscount}% OFF</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Plan cards ── */}
                <div className="space-y-3 mb-5">
                  {subscriptionPlans.map((plan, idx) => {
                    const isSelected = selectedPlanId === plan.id;
                    const original = isPro ? plan.basicOriginalPrice : plan.ultraOriginalPrice;
                    let price = isPro ? plan.basicPrice : plan.ultraPrice;
                    if (totalDiscount > 0) price = Math.round(price * (1 - totalDiscount / 100));
                    const perMonth = getPerMonthPrice(plan, price);
                    const isPopular = plan.name.toLowerCase().includes('monthly') || (subscriptionPlans.length > 1 && idx === 1);

                    return (
                      <button key={plan.id} onClick={() => setSelectedPlanId(plan.id)}
                        className="w-full block px-4 py-2.5 rounded-2xl text-left transition-all relative overflow-hidden"
                        style={isSelected
                          ? { background: ac.bg, border: `2px solid ${ac.border}`, boxShadow: `0 0 28px ${ac.glow}` }
                          : { background: C.surface, border: `1.5px solid ${C.border}` }}>
                        {/* shimmer on selected */}
                        {isSelected && (
                          <div className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.03) 50%,transparent 60%)', animation: 'shimmer-sweep 2.5s linear infinite' }} />
                        )}
                        {/* Popular badge */}
                        {isPopular && !isSelected && (
                          <div className="absolute top-0 right-0 text-[9px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-xl"
                            style={{ background: C.gold, color: '#000' }}>POPULAR</div>
                        )}
                        {/* Selected badge */}
                        {isSelected && (
                          <div className="absolute top-0 right-0 text-[9px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-xl"
                            style={{ background: ac.grad, color: '#fff' }}>✓ SELECTED</div>
                        )}
                        <div className="flex justify-between items-center relative z-10">
                          <div className="flex-1 pr-2">
                            <p className="text-sm font-black mb-1" style={{ color: isSelected ? ac.color : C.text }}>{plan.name}</p>
                            <div className="flex items-baseline gap-2.5">
                              <span className="text-2xl font-black" style={{ color: C.text }}>₹{price.toLocaleString('en-IN')}</span>
                              {original > price && (
                                <span className="text-sm line-through" style={{ color: C.textDim }}>₹{original.toLocaleString('en-IN')}</span>
                              )}
                            </div>
                            {perMonth && (
                              <p className="text-[11px] mt-0.5 font-medium" style={{ color: C.textMuted }}>≈ ₹{perMonth}/month</p>
                            )}
                          </div>
                          {/* Radio indicator */}
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: isSelected ? ac.bg : C.surfaceHigh, border: `2px solid ${isSelected ? ac.color : C.borderMed}` }}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: ac.color }} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

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

                {/* ── CTA Button ── */}
                <button
                  onClick={() => { if (!selectedPlan) return; setShowPaymentChooser(true); }}
                  className="w-full py-5 rounded-2xl font-black text-base tracking-wide text-white relative overflow-hidden group mb-4 transition-all active:scale-[0.98]"
                  style={{ background: ac.grad, boxShadow: `0 8px 28px ${ac.glow}` }}>
                  <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-active:translate-x-[100%] transition-transform duration-500 skew-x-12 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2.5">
                    <Sparkles size={17} />
                    {isPro ? 'PRO' : 'MAX'} Plan Lo — Abhi Unlock Karo
                  </span>
                </button>

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
