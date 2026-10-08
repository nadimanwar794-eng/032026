import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  Volume2,
  X,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { Pedro3DMascotComponent } from './Pedro3DMascot';
import { speakPedroVoice } from './PedroAssistant';
import { pedroSpeak } from '../utils/pedroVoiceManager';

interface PedroVipExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
  hoursRemaining: number;
  isExpired?: boolean;
  message?: string;
  userName?: string;
  pedroLevel?: number;
}

export const PedroVipExpiryModal: React.FC<PedroVipExpiryModalProps> = ({
  isOpen,
  onClose,
  onRenew,
  hoursRemaining,
  isExpired = false,
  message,
  userName = 'Student',
  pedroLevel = 1,
}) => {
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false);

  const cleanName = userName || 'Student';
  const defaultSpeech = isExpired
    ? 'Aapka VIP plan expire ho chuka hai.'
    : 'Aapka VIP plan kal expire ho raha hai.';

  const speechText = message || defaultSpeech;

  const playVoiceAlert = useCallback(() => {
    setIsSpeakingVoice(true);
    pedroSpeak(speechText, { pitch: 1.15, rate: 1.05, onEnd: () => setIsSpeakingVoice(false) });
    const durationEstimate = Math.min(5000, Math.max(2000, speechText.length * 60));
    setTimeout(() => {
      setIsSpeakingVoice(false);
    }, durationEstimate);
  }, [speechText]);

  // Auto-play voice alert when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        playVoiceAlert();
      }, 600);
      return () => {
        clearTimeout(timer);
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      };
    }
  }, [isOpen, playVoiceAlert]);

  if (!isOpen) return null;

  return (
    <div
      id="pedro-vip-expiry-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="pedro-vip-expiry-modal-container"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border-2 border-amber-500/70 shadow-2xl shadow-amber-500/20 text-white animate-in zoom-in-95 duration-200"
      >
        {/* Glowing Top Banner */}
        <div className="relative bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 px-6 pt-6 pb-5 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
          
          {/* Close button */}
          <button
            id="pedro-vip-expiry-close-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors"
            title="Band Karein"
          >
            <X size={18} />
          </button>

          {/* Pedro Mascot Display */}
          <div className="flex justify-center items-center mb-2">
            <div className="relative p-2 rounded-2xl bg-black/30 border border-amber-300/40 shadow-inner">
              <Pedro3DMascotComponent size={68} isMini={false} pose="look_around" level={pedroLevel} />
              {isSpeakingVoice && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border border-white" />
                </span>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-amber-300/40 text-[11px] font-black text-amber-200 uppercase tracking-wider mb-2">
            <ShieldAlert size={14} className="text-amber-400 animate-pulse" />
            Pedro Level 1+ VIP Expiry Alert
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {isExpired ? 'VIP Membership Expired!' : 'VIP Plan 24-Hour Expiry Alert!'}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-1 font-medium">
            {isExpired
              ? 'Aapka VIP access expire ho gaya hai. Abhi renew karein!'
              : `Aapki VIP validity agle ${hoursRemaining} ghante mein khatam ho jayegi!`}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Speech Bubble from Pedro */}
          <div className="relative p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  Pedro Voice Guide
                </span>
                <button
                  id="pedro-vip-expiry-replay-voice-btn"
                  onClick={playVoiceAlert}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-400/30 transition-colors"
                >
                  <Volume2 size={12} className={isSpeakingVoice ? 'animate-bounce text-emerald-400' : ''} />
                  {isSpeakingVoice ? 'Bol raha hai...' : 'Awaaz Sunein'}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                "{speechText}"
              </p>
            </div>
          </div>

          {/* Time Countdown Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <Clock size={13} className="text-amber-400" />
                Remaining Time
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400">
                {isExpired ? '0' : hoursRemaining}
                <span className="text-xs text-slate-400 font-bold ml-1">Ghante</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                <Zap size={13} className="text-amber-400" />
                Renewal Status
              </div>
              <div className="text-sm font-black text-rose-400 flex items-center justify-center h-8">
                {isExpired ? 'Expired Now' : 'Critical (< 24h)'}
              </div>
            </div>
          </div>

          {/* Features at risk */}
          <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/25">
            <p className="text-[11px] font-black uppercase text-rose-300 tracking-wider mb-1.5 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-rose-400" />
              VIP Features At Risk:
            </p>
            <ul className="text-xs text-rose-200/90 space-y-1 font-medium pl-1">
              <li className="flex items-center gap-1.5">
                <span className="text-rose-400 text-base leading-none">•</span>
                Unlimited MCQ Battles & Group Study Rooms
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-rose-400 text-base leading-none">•</span>
                Pedro AI Auto-Claim & Bonus Study XP
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-rose-400 text-base leading-none">•</span>
                Full Video Classes & High-Speed PDF Access
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              id="pedro-vip-expiry-renew-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                onRenew();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:via-orange-400 hover:to-rose-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.98]"
            >
              <Zap size={18} className="fill-white" />
              Store Se VIP Plan Renew Karein
              <ArrowRight size={18} />
            </button>

            <button
              id="pedro-vip-expiry-dismiss-btn"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-bold text-xs transition-colors"
            >
              Baad Mein Yaad Dilayein (Dismiss)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
