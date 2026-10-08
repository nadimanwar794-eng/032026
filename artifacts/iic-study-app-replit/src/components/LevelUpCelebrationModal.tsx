import React, { useEffect } from 'react';
import { Trophy, Sparkles, ChevronRight, Unlock, Video, CheckCircle2, ArrowRight } from 'lucide-react';
import { FeatureUnlockItem } from '../constants/levelRoadmapData';

interface LevelUpCelebrationModalProps {
  isOpen: boolean;
  newLevel: number;
  unlockedFeatures: FeatureUnlockItem[];
  onClose: () => void;
  onExploreFeature?: (featureId: string) => void;
}

export const LevelUpCelebrationModal: React.FC<LevelUpCelebrationModalProps> = ({
  isOpen,
  newLevel,
  unlockedFeatures,
  onClose,
  onExploreFeature,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 p-3 sm:p-4 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-925 to-slate-950 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl shadow-amber-500/20 text-center overflow-hidden">
        
        {/* Glow Background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/25 rounded-full blur-3xl pointer-events-none" />

        {/* Level Up Badge Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-0.5 shadow-xl shadow-amber-500/30 mb-4 animate-bounce">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-widest mb-2">
          🎉 BADHAAI HO! LEVEL UP!
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
          Aap Pahunch Gaye <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">Level {newLevel}</span> Par!
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-5">
          Aapki mehnat rang laayi! Niche diye gaye features ab aapke liye unlock ho gaye hain:
        </p>

        {/* Unlocked Features List */}
        <div className="space-y-3 mb-6 text-left max-h-60 overflow-y-auto pr-1">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Unlock className="w-3.5 h-3.5" />
            <span>Naye Unlocked Features ({unlockedFeatures.length}):</span>
          </div>

          {unlockedFeatures.length > 0 ? (
            unlockedFeatures.map((feat) => (
              <div 
                key={feat.id}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/40 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                      <span>{feat.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-extrabold uppercase">
                        UNLOCKED
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">{feat.hindiTitle || feat.description}</p>
                  </div>
                </div>

                {onExploreFeature && (
                  <button
                    onClick={() => {
                      onExploreFeature(feat.id);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Kholein</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 text-center">
              Level {newLevel} par aapke study targets aur limit increase ho chuke hain!
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black tracking-wide shadow-lg shadow-amber-500/25 transition-all text-sm cursor-pointer"
          >
            Shaandar! (Continue)
          </button>
        </div>

      </div>
    </div>
  );
};
