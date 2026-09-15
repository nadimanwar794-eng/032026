import React, { useEffect, useState } from 'react';
import { Lock, Zap, RefreshCw, ShoppingCart, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  used: number;
  limit: number;
  creditCost: number;
  userCredits: number;
  onPayCredits: () => void;   // user has enough credits — charge & allow
  onGoHome: () => void;       // no credits / close → go home
}

export const McqLimitLockedPopup: React.FC<Props> = ({
  isOpen, used, limit, creditCost, userCredits, onPayCredits, onGoHome,
}) => {
  const [visible, setVisible] = useState(false);
  const hasCredits = userCredits >= creditCost;

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      return;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-350"
        style={{
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(60px) scale(0.97)',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Header */}
        <div
          className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}
        >
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10"
            style={{ background: 'rgba(255,255,255,0.5)' }} />

          {/* Lock icon with pulse */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: 'rgba(255,255,255,0.4)' }} />
            <div className="relative w-full h-full rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}>
              <Lock size={36} className="text-white" />
            </div>
          </div>

          <h2 className="text-white font-black text-xl mb-1">
            🚫 Daily MCQ Limit Reached!
          </h2>
          <p className="text-red-200 font-semibold text-sm">
            आज की MCQ limit पूरी हो गई!
          </p>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-5 space-y-4">

          {/* Usage bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>Today's Usage</span>
              <span className="text-red-600">{used}/{limit} MCQs</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, #dc2626, #ef4444)',
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Resets tomorrow at midnight · कल midnight को reset होगा
            </p>
          </div>

          {/* Credit option */}
          {hasCredits ? (
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-emerald-600 fill-emerald-500" />
                <p className="text-emerald-800 font-black text-sm">
                  Continue with Credits
                </p>
              </div>
              <p className="text-emerald-700 text-xs leading-relaxed">
                Spend <span className="font-black">{creditCost} credits</span> to unlock this MCQ session.
                <br />
                <span className="text-slate-500">आपके पास {userCredits} credits हैं।</span>
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart size={14} className="text-amber-600" />
                <p className="text-amber-800 font-black text-sm">
                  Not Enough Credits
                </p>
              </div>
              <p className="text-amber-700 text-xs leading-relaxed">
                You need <span className="font-black">{creditCost} credits</span> to continue. You have {userCredits}.
                <br />
                <span className="text-slate-500">Upgrade your plan or buy credits from Store.</span>
              </p>
            </div>
          )}

          {/* Reset info */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <RefreshCw size={13} className="text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500">
              Upgrade to <span className="font-bold text-indigo-600">BASIC</span> or <span className="font-bold text-purple-600">ULTRA</span> for higher daily limits.
              <br />Plan upgrade karein aur zyada MCQs karein!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-6 pb-8 pt-1 space-y-2">
          {hasCredits && (
            <button
              onClick={onPayCredits}
              className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                boxShadow: '0 8px 24px rgba(22,163,74,0.3)',
              }}
            >
              <Zap size={18} className="fill-white" />
              Use {creditCost} Credits &amp; Continue
            </button>
          )}
          <button
            onClick={onGoHome}
            className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{
              background: hasCredits ? '#f1f5f9' : 'linear-gradient(135deg, #dc2626, #991b1b)',
              color: hasCredits ? '#475569' : '#ffffff',
              boxShadow: hasCredits ? 'none' : '0 8px 24px rgba(220,38,38,0.3)',
            }}
          >
            {hasCredits ? (
              <>
                <X size={16} /> Go to Home
              </>
            ) : (
              <>
                Go to Home · होम पर जाएं
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
