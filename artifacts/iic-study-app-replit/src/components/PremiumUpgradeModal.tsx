import React from 'react';
import { createPortal } from 'react-dom';
import { Zap, Crown, Check, X, Sparkles, Star, ShieldCheck } from 'lucide-react';

export interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  requiredTier?: 'BASIC' | 'ULTRA' | 'BASIC_OR_ULTRA';
  description?: string;
  perks?: string[];
  onUpgrade?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  featureName = 'Exclusive VIP Feature',
  requiredTier = 'BASIC_OR_ULTRA',
  description,
  perks,
  onUpgrade,
}) => {
  if (!isOpen) return null;

  const defaultPerks = [
    '🎯 Daily Challenge 2.0 — 100 MCQs timed test & live state ranks',
    '💬 Nsta Messenger — Direct doubts solving with verified teachers',
    '📖 Unlimited Reading & Premium Notes — No daily point locks',
    '📥 Offline Downloads & High-Speed Material Access',
  ];

  const displayPerks = perks && perks.length > 0 ? perks : defaultPerks;
  const isUltraOnly = requiredTier === 'ULTRA';

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-amber-500/30 text-white animate-in zoom-in-95 duration-200"
        style={{
          boxShadow: isUltraOnly
            ? '0 25px 60px -15px rgba(168, 85, 247, 0.45)'
            : '0 25px 60px -15px rgba(245, 158, 11, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Gradient Header */}
        <div
          className={`relative px-6 pt-7 pb-5 text-center overflow-hidden ${
            isUltraOnly
              ? 'bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900'
              : 'bg-gradient-to-br from-amber-500 via-amber-600 to-indigo-900'
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/25 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer text-sm font-bold active:scale-90"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Floating Icon Badge */}
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto mb-3 text-3xl shadow-lg shadow-black/20">
            {isUltraOnly ? '👑' : '💎'}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 border border-white/20 text-[10px] font-black uppercase tracking-widest text-amber-300 mb-2">
            <Sparkles size={11} className="animate-spin text-amber-300" />
            {isUltraOnly ? 'Ultra Exclusive' : 'Basic+ / Ultra Required'}
          </div>

          <h3 className="text-white font-black text-xl leading-tight">
            {featureName}
          </h3>

          <p className="text-white/85 text-xs mt-1.5 font-medium leading-relaxed">
            {description ||
              (isUltraOnly
                ? 'Yeh feature sirf Ultra VIP members ke liye exclusive hai.'
                : 'Yeh feature sirf Basic (Pro) aur Ultra (VIP) members ke liye unlock hota hai.')}
          </p>
        </div>

        {/* Perks & Comparison */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              VIP Membership Perks:
            </p>
            {displayPerks.map((perk, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={12} className="text-amber-400" />
                </div>
                <p className="text-xs text-slate-200 leading-snug font-medium">
                  {perk}
                </p>
              </div>
            ))}
          </div>

          {/* Plan Comparison Pills */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-400/20">
              <span className="text-[11px] font-black text-blue-300 block">⭐ Basic Plan</span>
              <span className="text-[10px] text-slate-400">Tests + Messenger + Downloads</span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20">
              <span className="text-[11px] font-black text-purple-300 block">👑 Ultra VIP</span>
              <span className="text-[10px] text-slate-400">All Unlimited + Priority</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onUpgrade) onUpgrade();
              }}
              className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 shadow-lg shadow-purple-500/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap size={16} className="text-amber-300 fill-amber-300" />
              <span>Upgrade / View VIP Plans</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer text-center"
            >
              Baad Me (Close)
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
