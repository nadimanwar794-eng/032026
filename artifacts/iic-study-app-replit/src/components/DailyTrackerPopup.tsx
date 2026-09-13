import React, { useEffect, useState } from 'react';
import { X, Timer, Target, Trophy } from 'lucide-react';

interface Props {
    dailySeconds: number;
    targetSeconds: number;
    onClose: () => void;
}

export const DailyTrackerPopup: React.FC<Props> = ({ dailySeconds, targetSeconds, onClose }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const pct = Math.min((dailySeconds / targetSeconds) * 100, 100);
        setProgress(pct);
    }, [dailySeconds, targetSeconds]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return `${h}h ${m}m`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full shadow-2xl overflow-hidden relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors z-10 text-white"
                >
                    <X size={20} />
                </button>

                {/* Header — theme gradient */}
                <div
                    className="p-8 text-center text-white relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5) 0%, var(--nst-btn-end, #7c3aed) 100%)' }}
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse" />
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border-2 border-white/30">
                            <Target size={32} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-black mb-1">Daily Goal Tracker</h2>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Study Challenge</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Today's Study Time</p>
                            <p className="text-2xl font-black text-slate-800 flex items-baseline gap-1">
                                {formatTime(dailySeconds)}
                                <span className="text-sm text-slate-500 font-bold">/ {formatTime(targetSeconds)}</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black" style={{ color: 'var(--nst-color-brand)' }}>
                                {Math.round(progress)}%
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar — theme color */}
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-6 border border-slate-200">
                        <div
                            className="h-full transition-all duration-1000 ease-out relative"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))',
                            }}
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[spin_1s_linear_infinite]" />
                        </div>
                    </div>

                    {progress >= 100 ? (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-green-800">Goal Achieved! 🎉</p>
                                <p className="text-xs text-green-600">You completed your 3-hour target.</p>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="p-4 rounded-xl border flex items-center gap-3"
                            style={{ background: 'var(--nst-color-brand-5)', borderColor: 'var(--nst-color-brand-20)' }}
                        >
                            <div className="p-2 rounded-full" style={{ background: 'var(--nst-color-brand-10)', color: 'var(--nst-color-brand)' }}>
                                <Timer size={24} />
                            </div>
                            <div>
                                <p className="font-bold" style={{ color: 'var(--nst-color-brand)' }}>Keep Going!</p>
                                <p className="text-xs text-slate-500">Study more to unlock rewards.</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full mt-6 text-white font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] transition-transform active:scale-95"
                        style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))' }}
                    >
                        Continue Learning
                    </button>
                </div>
            </div>
        </div>
    );
};
