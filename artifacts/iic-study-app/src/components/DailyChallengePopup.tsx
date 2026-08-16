import React from 'react';
import { Trophy, Clock, Target, Star, Play } from 'lucide-react';

interface Props {
    onStart: () => void;
    onClose: () => void;
    rewardPercentage: number;
}

export const DailyChallengePopup: React.FC<Props> = ({ onStart, onClose, rewardPercentage }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full shadow-2xl overflow-hidden relative border-4 border-white/20">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full transition-colors z-10 text-white"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* Hero Header — theme gradient */}
                <div
                    className="p-8 pt-12 text-center text-white relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5) 0%, var(--nst-btn-end, #7c3aed) 100%)' }}
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 animate-pulse" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3 hover:rotate-6 transition-transform">
                            <Trophy size={40} className="text-yellow-500 drop-shadow-sm" />
                        </div>
                        <h2 className="text-3xl font-black mb-1 tracking-tight drop-shadow-md">Daily Challenge</h2>
                        <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm border border-white/30">
                            <Star size={10} className="fill-yellow-300 text-yellow-300" />
                            Win Premium Access
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 bg-white">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                            <Clock size={20} className="text-slate-500 mx-auto mb-1" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Time</p>
                            <p className="font-black text-slate-800 text-lg">Custom</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                            <Target size={20} className="text-red-500 mx-auto mb-1" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Questions</p>
                            <p className="font-black text-slate-800 text-lg">100</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-yellow-50 opacity-50" />
                            <Trophy size={20} className="text-yellow-500 mx-auto mb-1 relative z-10" />
                            <p className="text-[10px] font-bold text-yellow-600 uppercase relative z-10">Target</p>
                            <p className="font-black text-slate-800 text-lg relative z-10">{rewardPercentage}%</p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div
                            className="flex items-start gap-3 p-3 rounded-xl border"
                            style={{ background: 'var(--nst-color-brand-5)', borderColor: 'var(--nst-color-brand-20)' }}
                        >
                            <div
                                className="min-w-[24px] h-6 rounded-full flex items-center justify-center font-bold text-xs text-white"
                                style={{ background: 'var(--nst-color-brand)' }}
                            >1</div>
                            <p className="text-xs text-slate-700 font-medium leading-tight">Questions are mixed from all your subject chapters.</p>
                        </div>
                        <div
                            className="flex items-start gap-3 p-3 rounded-xl border"
                            style={{ background: 'var(--nst-color-brand-5)', borderColor: 'var(--nst-color-brand-20)' }}
                        >
                            <div
                                className="min-w-[24px] h-6 rounded-full flex items-center justify-center font-bold text-xs text-white"
                                style={{ background: 'var(--nst-color-brand)' }}
                            >2</div>
                            <p className="text-xs text-slate-700 font-medium leading-tight">
                                Score <span className="font-black" style={{ color: 'var(--nst-color-brand)' }}>{rewardPercentage}%+</span> to unlock 1 Month Free Subscription instantly!
                            </p>
                        </div>
                    </div>

                    {/* Start button — theme gradient */}
                    <button
                        onClick={onStart}
                        className="w-full text-white font-bold py-4 rounded-2xl shadow-lg hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))' }}
                    >
                        <Play size={20} className="fill-white" /> Start Challenge
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full mt-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-600"
                    >
                        Remind me later
                    </button>
                </div>
            </div>
        </div>
    );
};
