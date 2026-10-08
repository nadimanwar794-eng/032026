import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

export interface StudyModeRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: 'WITHOUT_CREDIT' | 'CREDIT';
  onSelectMode: (mode: 'WITHOUT_CREDIT' | 'CREDIT') => void;
  initialTab?: 'WITHOUT_CREDIT' | 'CREDIT';
  isSubscriptionActive?: boolean;
  activeSubName?: string;
  subscriptionDaysRemaining?: number;
}

export const StudyModeRulesModal: React.FC<StudyModeRulesModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  initialTab,
  isSubscriptionActive = false,
  activeSubName = 'VIP',
  subscriptionDaysRemaining,
}) => {
  const [activeTab, setActiveTab] = useState<'WITHOUT_CREDIT' | 'CREDIT'>('WITHOUT_CREDIT');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || currentMode || 'WITHOUT_CREDIT');
      document.body.classList.add('nsta-modal-open');
      window.dispatchEvent(new CustomEvent('nsta-modal-visibility-change', { detail: { open: true } }));
      return () => {
        setTimeout(() => {
          const remaining = document.querySelectorAll('[role="dialog"], [data-modal="true"], .iic-modal-overlay');
          if (remaining.length === 0) {
            document.body.classList.remove('nsta-modal-open');
            window.dispatchEvent(new CustomEvent('nsta-modal-visibility-change', { detail: { open: false } }));
          }
        }, 10);
      };
    }
  }, [isOpen, initialTab, currentMode]);

  if (!isOpen) return null;

  const isCurrentActive = activeTab === currentMode;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in iic-modal-overlay"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-2xl shadow-xs shrink-0">
              📜
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  Study Mode Rules
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                  Official Guide
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dono modes ke sabhi niyam aur fayde vistaar se samjhein
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-all shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Top Mode Tabs */}
        <div className="p-3 sm:px-5 sm:pt-4 pb-2 shrink-0">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('WITHOUT_CREDIT')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'WITHOUT_CREDIT'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>🎓</span>
              <span>Without Credit (VIP)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CREDIT')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'CREDIT'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>💰</span>
              <span>Credit Mode (VIP+)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Rules Content */}
        <div className="overflow-y-auto px-4 sm:px-5 py-2 space-y-3.5 flex-1">
          {activeTab === 'WITHOUT_CREDIT' ? (
            <>
              {/* Without Credit Banner Card */}
              <div className="rounded-2xl p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎓</span>
                    <h4 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100">
                      Without Credit Mode (VIP / Free)
                    </h4>
                  </div>
                  {currentMode === 'WITHOUT_CREDIT' && (
                    <span className="text-[8.5px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono uppercase tracking-wider shadow-xs">
                      ACTIVE ON YOUR ACCOUNT
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  0 Credits! Bina kisi coin ya credit ke padhai karein. Yah mode structured, distraction-free study ke liye banaya gaya hai.
                </p>
              </div>

              {/* Numbered Rules */}
              <div className="space-y-2.5">
                {/* 1 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      0 Credits Required (100% Free Access)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Kisi bhi lesson, page ya MCQ ko unlock karne ke liye 0 credits lagenge. Aapka ek bhi coin ya credit nahi katega.
                    </p>
                  </div>
                </div>

                {/* 2 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Har Subject Ka 1st Lesson Sabhi Ke Liye Free
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Har ek subject ka pehla lesson har user ke liye 100% free unlocked hai (Reading, Notes, MCQ, Projector, Flashcards, Video, Audio sabhi).
                    </p>
                  </div>
                </div>

                {/* 3 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Sequential Page Reading Flow (Mandatory 5 Steps)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Agla page tabhi unlock hoga jab aap current page ke ye 5 steps kramashah (sequentially) poore karenge:
                    </p>
                    <div className="mt-2.5 space-y-1.5">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">Step 1:</span>
                        <span>📖 <strong>Reading Mode:</strong> Required reading time poora karein.</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-purple-600 dark:text-purple-400 mr-1.5">Step 2:</span>
                        <span>🧠 <strong>MCQ Practice:</strong> Is page ke questions solve karein.</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400 mr-1.5">Step 3:</span>
                        <span>🔄 <strong>Revision Hub (Same Topic):</strong> Same topic ka revision karein.</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">Step 4:</span>
                        <span>📅 <strong>Revision Hub (Today Topic):</strong> Aaj ka revision poora karein.</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-rose-600 dark:text-rose-400 mr-1.5">Step 5:</span>
                        <span>⚠️ <strong>My Mistake:</strong> Apni mistakes review karein.</span>
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      ✓ Step 5 complete hote hi Next Page turant 0 credits me unlock ho jayega!
                    </p>
                  </div>
                </div>

                {/* 4 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Store View: VIP Plans (PRO / MAX)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Store me direct VIP Plans (VIP PRO &amp; VIP MAX) dikhenge jisme bina kisi credit ke distraction-free unlimited access milta hai.
                    </p>
                  </div>
                </div>

                {/* 5 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Daily Login Bonus &amp; Streaks
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Daily streak, login XP aur level bonuses hamesha ki tarah milte rahenge.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Credit Economy Banner Card */}
              <div className="rounded-2xl p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💰</span>
                    <h4 className="text-xs sm:text-sm font-black text-blue-950 dark:text-blue-100">
                      Credit Economy Mode (VIP+ / Credit ON)
                    </h4>
                  </div>
                  {currentMode === 'CREDIT' && (
                    <span className="text-[8.5px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono uppercase tracking-wider shadow-xs">
                      ACTIVE ON YOUR ACCOUNT
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  100% Freedom! Apne man se kisi bhi order me padhein. Credit spend karein aur chapters complete karke credits kamayein.
                </p>
              </div>

              {/* Numbered Rules */}
              <div className="space-y-2.5">
                {/* 1 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Apne Man Se Padhein (No Sequential Lock)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Sequential flow ki koi bandish nahi hai! Aap kisi bhi page, MCQ, Revision Hub ya Mistake section me jab chahein direct ja sakte hain.
                    </p>
                  </div>
                </div>

                {/* 2 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Har Subject Ka 1st Lesson 100% Free
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Har subject ka pehla lesson sabhi ke liye permanently free rahega, jisme sabhi modes bina credit spend kiye chalu rahenge.
                    </p>
                  </div>
                </div>

                {/* 3 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Credit Spend &amp; Earn Economy
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Chapters ko credits spend karke unlock karein. Padhein, tests solve karein aur daily tasks poore karke naye credits kamayein.
                    </p>
                  </div>
                </div>

                {/* 4 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Store View: VIP+ Elite Plans (PRO+ / MAX+)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Store me VIP+ Elite Plans (PRO+ &amp; MAX+) dikhenge jisme daily subscription credits allowance aur multiplier bonuses aate hain.
                    </p>
                  </div>
                </div>

                {/* 5 */}
                <div className="rounded-2xl p-3.5 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-xs flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white">
                      Daily Credit Claim Allowance
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      VIP+ subscribers daily Store se apna fixed subscription credit allowance claim kar sakte hain.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          {!isCurrentActive && isSubscriptionActive && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-left">
              <span className="text-amber-500 text-sm mt-0.5 shrink-0">🔒</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                <strong>Mode Switch Locked:</strong> Aapka <strong>{activeSubName}</strong> subscription active hai. Jab tak subscription on hai, mode switch nahi kiya ja sakta taaki VIP users VIP+ ke benefits ka anuchit laabh na le sakein. Validity poori hone ke baad hi switch kar sakte hain.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {isCurrentActive ? (
              <button
                type="button"
                disabled
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-center cursor-default flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>Yeh Mode Active Hai</span>
              </button>
            ) : isSubscriptionActive ? (
              <button
                type="button"
                disabled
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-200/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 text-center cursor-not-allowed flex items-center justify-center gap-1.5 opacity-80"
              >
                <span>🔒 Locked (Subscription Active)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectMode(activeTab)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md active:scale-[0.98] transition-all text-center cursor-pointer ${
                  activeTab === 'WITHOUT_CREDIT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {activeTab === 'WITHOUT_CREDIT'
                  ? 'Switch to Without Credit Mode'
                  : 'Switch to Credit Economy Mode'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl font-bold text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer"
            >
              Band Karein
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
