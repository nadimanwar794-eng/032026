import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, SystemSettings, SpinReward, SpinGameType } from '../types';
import { Trophy, Zap, Star, Lock, ChevronRight } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { recordCreditTx } from '../utils/creditHistory';

interface Props {
  user: User;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings;
}

const DEFAULT_REWARDS: SpinReward[] = [
  {id: '1', type: 'COINS', value: 0, label: '0', color: '#ef4444', probability: 20},
  {id: '2', type: 'COINS', value: 1, label: '1 CR', color: '#3b82f6', probability: 25},
  {id: '3', type: 'COINS', value: 2, label: '2 CR', color: '#22c55e', probability: 25},
  {id: '4', type: 'COINS', value: 5, label: '5 CR', color: '#a855f7', probability: 15},
  {id: '5', type: 'COINS', value: 10, label: '10 CR', color: '#f97316', probability: 10},
  {id: '6', type: 'COINS', value: 0, label: 'Try Again', color: '#fbbf24', probability: 5},
];

function pickWeightedRandom(rewards: SpinReward[]): number {
  const hasProbability = rewards.some(r => r.probability !== undefined && r.probability > 0);
  if (!hasProbability) return Math.floor(Math.random() * rewards.length);

  const total = rewards.reduce((s, r) => s + (r.probability || 0), 0);
  if (total === 0) return Math.floor(Math.random() * rewards.length);

  let rand = Math.random() * total;
  for (let i = 0; i < rewards.length; i++) {
    rand -= (rewards[i].probability || 0);
    if (rand <= 0) return i;
  }
  return rewards.length - 1;
}

interface SpinWheelCoreProps {
  user: User;
  onUpdateUser: (user: User) => void;
  rewards: SpinReward[];
  cost: number;
  dailyLimit: number;
  spinKey: string; // unique key per game type for tracking daily spins
  typeName: string;
  typeEmoji?: string;
}

const SpinWheelCore: React.FC<SpinWheelCoreProps> = ({ user, onUpdateUser, rewards, cost, dailyLimit, spinKey, typeName, typeEmoji }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [fastMode, setFastMode] = useState(false);
  const [spinCount, setSpinCount] = useState(1);
  const [spinInputVal, setSpinInputVal] = useState('1');
  const [autoMode, setAutoMode] = useState(false);
  const autoRef = useRef(false);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const spinDuration = fastMode ? 600 : 3000;

  const todayStr = new Date().toISOString().split('T')[0];

  const normalizedRewards: SpinReward[] = useMemo(() => {
    const raw = rewards || [];
    if (raw.length === 0) return DEFAULT_REWARDS;
    return raw.map((r: any, idx: number) => {
      if (typeof r === 'number') {
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#fbbf24'];
        return { id: `legacy-${idx}`, type: 'COINS', value: r, label: r === 0 ? '0' : `${r} CR`, color: colors[idx % colors.length] };
      }
      return r;
    });
  }, [rewards]);

  const SEGMENT_COUNT = normalizedRewards.length;
  const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

  const spinDateKey = `dailySpinDate_${spinKey}`;
  const spinCountKey = `dailySpinCount_${spinKey}`;

  const storedDate = (user as any)[spinDateKey];
  const storedCount = (user as any)[spinCountKey];
  const spinsUsed = storedDate === todayStr ? (storedCount || 0) : 0;
  const remainingSpins = Math.max(0, dailyLimit - spinsUsed);
  const canSpin = remainingSpins > 0;

  const stopAuto = () => {
    autoRef.current = false;
    setAutoMode(false);
  };

  const doSpin = (currentUser: User, currentSpinsUsed: number, count: number, isAuto: boolean) => {
    const spinsToRun = Math.min(count, dailyLimit - currentSpinsUsed, 99);
    if (spinsToRun <= 0) { stopAuto(); return; }

    const totalCost = cost * spinsToRun;
    if (totalCost > 0 && getTotalCredits(currentUser) < totalCost) {
      setAlertConfig({ isOpen: true, message: `Insufficient Credits! You need ${totalCost} CR to spin ${spinsToRun}×.` });
      stopAuto();
      return;
    }

    try {
      const _sk = `nst_spin_daily_${currentUser.id}_${todayStr}`;
      localStorage.setItem(_sk, String(parseInt(localStorage.getItem(_sk)||'0',10) + spinsToRun));
    } catch {}

    setIsSpinning(true);
    setResultMessage(null);

    const wonRewards: SpinReward[] = [];
    for (let i = 0; i < spinsToRun; i++) wonRewards.push(normalizedRewards[pickWeightedRandom(normalizedRewards)]);

    const lastWon = wonRewards[wonRewards.length - 1];
    const extraSpins = 360 * 5;
    const lastIdx = normalizedRewards.indexOf(lastWon);
    const segmentOffset = Math.floor(Math.random() * (SEGMENT_ANGLE - 4)) + 2;
    setRotation(prev => prev + extraSpins + (360 - (lastIdx * SEGMENT_ANGLE)) + segmentOffset);

    if (typeof (window as any).recordActivity === 'function') {
      (window as any).recordActivity('GAME', `Spin Wheel (${typeName}): ${spinsToRun}× Played`, totalCost);
    }

    setTimeout(() => {
      setIsSpinning(false);

      let totalWon = 0;
      // Apply credit deduction explicitly
      let updatedUser: any = { ...currentUser };
      if (totalCost > 0) {
        const deducted = applyDeduction(currentUser, totalCost);
        if (deducted) {
          updatedUser = { ...deducted };
        } else {
          // Fallback: direct deduction from permanent credits
          updatedUser.credits = Math.max(0, (currentUser.credits || 0) - totalCost);
        }
      }
      updatedUser[spinDateKey] = todayStr;
      updatedUser[spinCountKey] = currentSpinsUsed + spinsToRun;
      updatedUser.lastSpinTime = new Date().toISOString();
      updatedUser.totalScore = (currentUser.totalScore || 0) + totalCost;

      wonRewards.forEach(wonReward => {
        if (wonReward.type === 'COINS') {
          const v = Number(wonReward.value);
          totalWon += v;
          updatedUser.credits = (updatedUser.credits || 0) + v;
        } else if (wonReward.type === 'SUBSCRIPTION') {
          const parts = String(wonReward.value).split('_');
          const tier = parts[0] as any;
          const level = parts[1] as any || 'BASIC';
          let days = 7;
          if (tier === 'MONTHLY') days = 30;
          if (tier === 'YEARLY') days = 365;
          if (tier === 'LIFETIME') days = 36500;
          updatedUser.subscriptionTier = tier;
          updatedUser.subscriptionLevel = level;
          updatedUser.subscriptionEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          updatedUser.isPremium = true;
          updatedUser.grantedByAdmin = true;
        } else if (wonReward.type === 'GIFT_CODE' && wonReward.giftCode) {
          const expiryMs = (wonReward.expiryHours || 48) * 60 * 60 * 1000;
          const codeMsg = {
            id: `giftcode-${Date.now()}`, text: `🎁 ${wonReward.label} — Code: ${wonReward.giftCode}`,
            date: new Date().toISOString(), read: false, type: 'REWARD' as const,
            isClaimed: false, expiresAt: new Date(Date.now() + expiryMs).toISOString(),
            gift: { type: 'CREDITS' as const, value: 0 },
          };
          updatedUser.inbox = [codeMsg, ...(updatedUser.inbox || [])];
        }
      });

      try {
        if (totalCost > 0) {
          recordCreditTx(currentUser.id, -totalCost, 'SPEND_SPIN', `Spin Wheel (${typeName}): ${spinsToRun}× — Cost: -${totalCost} CR`, updatedUser.credits ?? 0);
        }
        if (totalWon > 0) {
          recordCreditTx(currentUser.id, totalWon, 'EARN_SPIN', `Spin Wheel (${typeName}): ${spinsToRun}× — Won: +${totalWon} CR`, (updatedUser.credits ?? 0));
        }
      } catch {}

      const netChange = totalWon - totalCost;
      const isWin = totalWon > 0;

      if (spinsToRun === 1) {
        const wonReward = wonRewards[0];
        const isGiftCode = wonReward.type === 'GIFT_CODE' && !!wonReward.giftCode;
        const isSub = wonReward.type === 'SUBSCRIPTION';
        const winLabel = isGiftCode ? '🎁 Gift Code Jeeta!' : isSub ? '🏆 Subscription Jeeti!' : `${wonReward.label} Jeeta!`;
        setResultMessage(
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">{isWin || isSub || isGiftCode ? '🎉' : '😢'}</div>
            <div className={`text-lg font-black ${isWin || isSub || isGiftCode ? 'text-green-600' : 'text-slate-600'}`}>
              {isWin || isSub || isGiftCode ? winLabel : 'Better luck next time!'}
            </div>
            {cost > 0 && (
              <div className="flex items-center gap-2 mt-1 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100 w-full justify-center flex-wrap">
                <span className="text-xs font-black text-rose-500">−{cost} CR</span>
                <span className="text-slate-300 text-xs">spent</span>
                {totalWon > 0 && <><span className="text-slate-400 text-xs">→</span><span className="text-xs font-black text-emerald-600">+{totalWon} CR</span><span className="text-slate-300 text-xs">won</span></>}
                <span className="text-slate-400 text-xs">·</span>
                <span className={`text-xs font-black ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Net: {netChange >= 0 ? '+' : ''}{netChange} CR</span>
              </div>
            )}
          </div>
        );
      } else {
        const breakdown = wonRewards.map((r, i) => {
          const v = r.type === 'COINS' ? Number(r.value) : 0;
          return <div key={i} className="flex items-center justify-between text-[11px]"><span className="text-slate-600">Spin {i+1}:</span><span className={`font-black ${v > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{v > 0 ? `+${v} CR` : r.label}</span></div>;
        });
        setResultMessage(
          <div className="flex flex-col gap-2 w-full">
            <div className="text-center text-2xl">{isWin ? '🎉' : '😢'}</div>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1 border border-slate-100">{breakdown}</div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              {cost > 0 && <span className="text-xs font-black text-rose-500">−{totalCost} CR spent</span>}
              <span className={`text-sm font-black ml-auto ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Net: {netChange >= 0 ? '+' : ''}{netChange} CR</span>
            </div>
          </div>
        );
      }

      onUpdateUser(updatedUser);

      if (autoRef.current) {
        const newSpinsUsed = currentSpinsUsed + spinsToRun;
        const newRemaining = dailyLimit - newSpinsUsed;
        if (newRemaining > 0 && getTotalCredits(updatedUser) >= cost) {
          setTimeout(() => {
            if (autoRef.current) doSpin(updatedUser, newSpinsUsed, 1, true);
          }, 600);
        } else {
          stopAuto();
        }
      }
    }, spinDuration);
  };

  const clampCount = (v: number) => Math.max(1, Math.min(99, Math.min(v, remainingSpins)));
  const applySpinCount = (v: number) => {
    const clamped = clampCount(v);
    setSpinCount(clamped);
    setSpinInputVal(String(clamped));
  };

  const handleSpin = () => {
    if (!canSpin || isSpinning) return;
    doSpin(user, spinsUsed, spinCount, false);
  };

  const toggleAuto = () => {
    if (autoMode) {
      stopAuto();
    } else {
      if (!canSpin || isSpinning) return;
      autoRef.current = true;
      setAutoMode(true);
      doSpin(user, spinsUsed, 1, true);
    }
  };

  const totalCostPreview = cost * spinCount;

  /* ── SVG Wheel ── */
  const cx = 150, cy = 150, r = 138;
  const segmentPaths = normalizedRewards.map((seg, idx) => {
    const startAngle = (idx * SEGMENT_ANGLE - 90) * (Math.PI / 180);
    const endAngle = ((idx + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;
    const midAngle = ((idx + 0.5) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
    const textR = r * 0.62;
    const tx = cx + textR * Math.cos(midAngle);
    const ty = cy + textR * Math.sin(midAngle);
    const textRot = (idx + 0.5) * SEGMENT_ANGLE;
    const fontSize = SEGMENT_COUNT <= 6 ? 13 : SEGMENT_COUNT <= 10 ? 11 : 9;
    return { seg, idx, d: `M${cx},${cy} L${x1},${y1} A${r},${r},0,${largeArc},1,${x2},${y2}Z`, tx, ty, textRot, fontSize };
  });

  return (
    <div className="flex flex-col items-center justify-center py-3 animate-in fade-in zoom-in duration-500 px-4">
      <CustomAlert
        isOpen={alertConfig.isOpen}
        message={alertConfig.message}
        onClose={() => { setAlertConfig({...alertConfig, isOpen: false}); stopAuto(); }}
      />

      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-black text-slate-800 flex items-center justify-center gap-2">
          <span className="text-2xl">{typeEmoji || '🎰'}</span> {typeName}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${cost === 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
            {cost === 0 ? '🆓 Free' : `💰 ${cost} CR / spin`}
          </span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
            🎯 {remainingSpins}/{dailyLimit} baaki aaj
          </span>
          <button
            onClick={() => setFastMode(f => !f)}
            disabled={isSpinning}
            className={`px-2 py-0.5 text-[10px] font-black rounded-full border transition-all ${fastMode ? 'bg-purple-600 text-white border-purple-700' : 'bg-purple-50 text-purple-600 border-purple-200'}`}
          >⚡ {fastMode ? 'Fast ON' : 'Fast'}</button>
        </div>
      </div>

      {/* Professional SVG Wheel */}
      <div className="relative mb-5" style={{ width: 300, height: 300 }}>
        {/* Outer decorative glow ring */}
        <div className={`absolute inset-0 rounded-full transition-all duration-300 ${isSpinning ? 'shadow-[0_0_40px_10px_rgba(251,191,36,0.5)]' : 'shadow-[0_0_20px_4px_rgba(251,191,36,0.2)]'}`} />

        {/* Pointer */}
        <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 z-30" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
          <svg width="32" height="38" viewBox="0 0 32 38">
            <polygon points="16,36 2,2 30,2" fill="#dc2626" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
            <polygon points="16,36 2,2 30,2" fill="url(#pointerGrad)"/>
            <defs>
              <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444"/>
                <stop offset="100%" stopColor="#991b1b"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Spinning wheel */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionDuration: isSpinning ? `${spinDuration / 1000}s` : '0s',
            transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)',
          }}
        >
          <svg viewBox="0 0 300 300" width="300" height="300" style={{ display: 'block' }}>
            <defs>
              <filter id="wheelShadow">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.3"/>
              </filter>
              <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7"/>
                <stop offset="25%" stopColor="#f59e0b"/>
                <stop offset="50%" stopColor="#fde68a"/>
                <stop offset="75%" stopColor="#d97706"/>
                <stop offset="100%" stopColor="#fef3c7"/>
              </linearGradient>
              <linearGradient id="hubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde68a"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </linearGradient>
              <linearGradient id="hubInner" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b"/>
                <stop offset="100%" stopColor="#0f172a"/>
              </linearGradient>
            </defs>
            {/* Gold border ring */}
            <circle cx={cx} cy={cy} r={r + 9} fill="url(#goldRing)" filter="url(#wheelShadow)"/>
            <circle cx={cx} cy={cy} r={r + 5} fill="#1e293b"/>
            <circle cx={cx} cy={cy} r={r + 2} fill="#0f172a"/>
            {/* Segments */}
            {segmentPaths.map(({ seg, idx, d, tx, ty, textRot, fontSize }) => (
              <g key={seg.id || idx}>
                <path d={d} fill={seg.color || '#3b82f6'} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                {/* lighter inner stripe for depth */}
                <text
                  x={tx} y={ty}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={fontSize} fontWeight="800" fill="white"
                  stroke="rgba(0,0,0,0.35)" strokeWidth="3" paintOrder="stroke"
                  transform={`rotate(${textRot}, ${tx}, ${ty})`}
                >{seg.label}</text>
              </g>
            ))}
            {/* Divider dots on outer ring */}
            {normalizedRewards.map((_, idx) => {
              const a = (idx * SEGMENT_ANGLE - 90) * Math.PI / 180;
              const dx = cx + (r + 3) * Math.cos(a);
              const dy2 = cy + (r + 3) * Math.sin(a);
              return <circle key={idx} cx={dx} cy={dy2} r="3" fill="#fde68a"/>;
            })}
            {/* Center hub */}
            <circle cx={cx} cy={cy} r={30} fill="url(#goldRing)"/>
            <circle cx={cx} cy={cy} r={24} fill="url(#hubInner)"/>
            <circle cx={cx} cy={cy} r={18} fill="url(#hubGrad)" opacity="0.9"/>
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="16">🏆</text>
          </svg>
        </div>
      </div>

      {/* Result */}
      {resultMessage && !autoMode && (
        <div className="mb-4 p-4 rounded-2xl bg-white border-2 border-slate-100 shadow-xl text-center w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500"/>
          {resultMessage}
        </div>
      )}

      {autoMode && (
        <div className="mb-3 px-4 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 w-full text-center">
          <p className="text-xs font-black text-indigo-600 animate-pulse">🔄 Auto Spin chal raha hai... ({remainingSpins} baaki)</p>
        </div>
      )}

      {canSpin ? (
        <div className="w-full flex flex-col gap-3">
          {/* Spin count stepper */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-wider text-center">Kitne Spin Karo? (1–99)</div>
            {/* +/- stepper + type input — prominent row */}
            <div className="flex items-center gap-2 mb-2.5">
              <button
                onClick={() => applySpinCount(spinCount - 1)}
                disabled={isSpinning || autoMode || spinCount <= 1}
                className="w-11 h-11 rounded-xl bg-slate-200 text-slate-800 font-black text-2xl leading-none disabled:opacity-30 active:scale-90 transition-all shrink-0"
              >−</button>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                min={1} max={Math.min(99, remainingSpins)}
                value={spinInputVal}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setSpinInputVal(raw);
                  const num = parseInt(raw, 10);
                  if (!isNaN(num)) setSpinCount(clampCount(num));
                }}
                onBlur={() => {
                  const num = parseInt(spinInputVal, 10);
                  const clamped = isNaN(num) ? 1 : clampCount(num);
                  setSpinCount(clamped);
                  setSpinInputVal(String(clamped));
                }}
                disabled={isSpinning || autoMode}
                className="flex-1 text-center text-2xl font-black bg-white border-2 border-indigo-300 rounded-xl py-2 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all disabled:opacity-50"
                placeholder="1"
              />
              <button
                onClick={() => applySpinCount(spinCount + 1)}
                disabled={isSpinning || autoMode || spinCount >= Math.min(99, remainingSpins)}
                className="w-11 h-11 rounded-xl bg-slate-200 text-slate-800 font-black text-2xl leading-none disabled:opacity-30 active:scale-90 transition-all shrink-0"
              >+</button>
            </div>
            {/* Quick preset chips */}
            <div className="flex gap-1.5 flex-wrap justify-center">
              {[1, 5, 10, 20, 50, 99].filter(v => v <= remainingSpins).map(v => (
                <button
                  key={v}
                  onClick={() => applySpinCount(v)}
                  disabled={isSpinning || autoMode}
                  className={`px-3 h-8 rounded-xl text-xs font-black border transition-all active:scale-90 ${spinCount === v ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200'}`}
                >{v}×</button>
              ))}
            </div>
            {cost > 0 && (
              <div className="text-center mt-2.5 text-[12px] font-black text-orange-600 bg-orange-50 rounded-xl py-1.5 border border-orange-100">
                💰 {spinCount}× spin = {totalCostPreview} CR total
              </div>
            )}
          </div>

          {/* Spin + Auto buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSpin}
              disabled={isSpinning || autoMode}
              className="flex-1 relative group bg-gradient-to-b from-yellow-400 to-orange-500 text-white text-base font-black py-4 rounded-2xl shadow-[0_5px_0_#c2410c] active:shadow-[0_2px_0_#c2410c] active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >
              <span className="relative z-10 drop-shadow-md flex items-center justify-center gap-1.5">
                {isSpinning ? '🌀 Spinning...' : `SPIN ${spinCount}× ${cost > 0 ? `(${totalCostPreview} CR)` : '🎰'}`}
              </span>
              <div className="absolute top-0 -left-full w-full h-full bg-white/25 -skew-x-12 group-hover:left-full transition-all duration-700"/>
            </button>
            <button
              onClick={toggleAuto}
              disabled={isSpinning && !autoMode}
              className={`px-4 py-4 rounded-2xl font-black text-sm transition-all shadow ${autoMode ? 'bg-red-500 text-white shadow-[0_4px_0_#b91c1c] active:shadow-[0_2px_0_#b91c1c] active:translate-y-0.5' : 'bg-slate-800 text-white shadow-[0_4px_0_#1e293b] active:shadow-[0_2px_0_#1e293b] active:translate-y-0.5'}`}
            >
              {autoMode ? '⏹ Stop' : '🔄 Auto'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 text-white px-8 py-5 rounded-2xl shadow-lg flex flex-col items-center border border-slate-700 w-full">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1 tracking-widest">
            <Lock size={12}/> Daily Limit Reached
          </div>
          <div className="text-2xl font-bold text-yellow-400 tracking-wider">{spinsUsed}/{dailyLimit} Used</div>
          <div className="mt-1 text-[11px] text-slate-500">Kal wapas aana! 🌅</div>
        </div>
      )}
    </div>
  );
};

export const SpinWheel: React.FC<Props> = ({ user, onUpdateUser, settings }) => {
  const spinGameTypes: SpinGameType[] = useMemo(() => {
    const types = settings?.spinGameTypes || [];
    if (types.length > 0) return types;

    // Fallback: single default type using legacy settings
    const raw = settings?.wheelRewards || [];
    const rewards: SpinReward[] = raw.length === 0
      ? DEFAULT_REWARDS
      : raw.map((r: any, idx: number) => {
          if (typeof r === 'number') {
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#fbbf24'];
            return { id: `legacy-${idx}`, type: 'COINS', value: r, label: r === 0 ? '0' : `${r} CR`, color: colors[idx % colors.length] };
          }
          return r;
        });

    const cost = settings?.gameCost || 0;
    return [{
      id: 'default',
      name: cost === 0 ? 'Free Spin' : `${cost} CR Spin`,
      cost,
      emoji: cost === 0 ? '🆓' : '💎',
      description: cost === 0 ? 'Spin for free and win coins!' : `Spend ${cost} credits for a chance to win big!`,
      dailyLimitFree: settings?.spinLimitFree || 2,
      dailyLimitBasic: settings?.spinLimitBasic || 5,
      dailyLimitUltra: settings?.spinLimitUltra || 10,
      rewards,
      color: cost === 0 ? '#22c55e' : '#f97316',
    }];
  }, [settings]);

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const selectedType = selectedTypeId
    ? spinGameTypes.find(t => t.id === selectedTypeId)
    : spinGameTypes.length === 1
      ? spinGameTypes[0]
      : null;

  const getDailyLimit = (type: SpinGameType) => {
    if (!user.isPremium) return type.dailyLimitFree ?? settings?.spinLimitFree ?? 2;
    if (user.grantedByAdmin) return type.dailyLimitFree ?? settings?.spinLimitFree ?? 2;
    if (user.subscriptionLevel === 'ULTRA') return type.dailyLimitUltra ?? settings?.spinLimitUltra ?? 10;
    return type.dailyLimitBasic ?? settings?.spinLimitBasic ?? 5;
  };

  if (spinGameTypes.length === 1 || selectedType) {
    const type = selectedType || spinGameTypes[0];
    return (
      <div>
        {spinGameTypes.length > 1 && (
          <button
            onClick={() => setSelectedTypeId(null)}
            className="mx-4 mb-2 flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            ← Back to Games
          </button>
        )}
        <SpinWheelCore
          user={user}
          onUpdateUser={onUpdateUser}
          rewards={type.rewards}
          cost={type.cost}
          dailyLimit={getDailyLimit(type)}
          spinKey={type.id}
          typeName={type.name}
          typeEmoji={type.emoji}
        />
      </div>
    );
  }

  // Game type selection grid
  return (
    <div className="px-4 py-4 animate-in fade-in duration-300">
      <h3 className="text-lg font-black text-slate-800 mb-1 text-center">Choose Your Game</h3>
      <p className="text-xs text-slate-500 text-center mb-5">Different games, different rewards!</p>
      <div className="grid grid-cols-1 gap-3">
        {spinGameTypes.map(type => {
          const limit = getDailyLimit(type);
          const todayStr = new Date().toISOString().split('T')[0];
          const storedDate = (user as any)[`dailySpinDate_${type.id}`];
          const storedCount = (user as any)[`dailySpinCount_${type.id}`];
          const spinsUsed = storedDate === todayStr ? (storedCount || 0) : 0;
          const remaining = Math.max(0, limit - spinsUsed);

          return (
            <button
              key={type.id}
              onClick={() => setSelectedTypeId(type.id)}
              className="flex items-center gap-4 p-4 rounded-2xl border-2 shadow-sm text-left transition-all active:scale-95 hover:shadow-md bg-white"
              style={{ borderColor: type.color || '#e2e8f0' }}
            >
              <div className="text-3xl shrink-0">{type.emoji || '🎰'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm">{type.name}</p>
                {type.description && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{type.description}</p>}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${type.cost === 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {type.cost === 0 ? 'FREE' : `${type.cost} CR`}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{remaining}/{limit} spins today</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
