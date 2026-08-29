import React from 'react';
import { Chapter, ContentType } from '../types';
import { FileText, CheckSquare, Video, Headphones, X, Lock } from 'lucide-react';

interface Props {
    chapter: Chapter;
    onClose: () => void;
    onSelect: (type: ContentType | 'NOTES_PREMIUM') => void;
    logoUrl?: string;
    appName?: string;
    hideMcq?: boolean;
    isPremiumUser?: boolean;
}

export const LessonActionModal: React.FC<Props> = ({ chapter, onClose, onSelect, logoUrl, appName, hideMcq, isPremiumUser }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="bg-white w-full max-w-xs rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-300 relative border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Branding — theme gradient */}
                <div
                    className="p-6 pb-8 text-center relative"
                    style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5) 0%, var(--nst-btn-end, #7c3aed) 100%)' }}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors backdrop-blur-sm"
                    >
                        <X size={16} />
                    </button>

                    <div className="w-16 h-16 bg-white rounded-2xl mx-auto shadow-lg flex items-center justify-center mb-3 transform rotate-3 overflow-hidden">
                        <img
                            src={logoUrl || "/icon-192.png"}
                            alt="App"
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/3426/3426653.png')}
                        />
                    </div>
                    <h2 className="text-white font-black text-lg tracking-tight leading-tight">{appName || 'IIC'}</h2>
                    <p className="text-white/70 text-[10px] uppercase font-bold tracking-widest mt-1">Premium Learning</p>
                </div>

                {/* Content Body */}
                <div className="p-5 -mt-4 bg-white rounded-t-[32px] relative z-10">
                    <div className="text-center mb-5">
                        <h3 className="font-black text-slate-800 text-lg leading-tight mb-1 line-clamp-2">{chapter.title}</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Select Resource</p>
                    </div>

                    {/* Notes Row: Free Notes + Premium Notes */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                            onClick={() => onSelect('PDF' as any)}
                            className="group relative flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
                            style={{ ['--hover-border' as any]: 'var(--nst-color-brand-20)' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--nst-color-brand-20)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                        >
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                                style={{ background: 'var(--nst-color-brand-10)', color: 'var(--nst-color-brand)' }}
                            >
                                <FileText size={16} />
                            </div>
                            <span className="font-bold text-slate-600 text-[11px]" style={{ color: 'var(--nst-color-brand)' }}>Reading Notes</span>
                        </button>

                        <button
                            onClick={() => onSelect('NOTES_PREMIUM')}
                            className={`group relative flex flex-col items-center justify-center gap-1.5 p-3 border rounded-2xl shadow-sm transition-all active:scale-95 ${
                                isPremiumUser
                                    ? 'bg-white border-amber-200 hover:shadow-md hover:border-amber-300'
                                    : 'bg-amber-50/60 border-amber-100'
                            }`}
                        >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                isPremiumUser
                                    ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white'
                                    : 'bg-amber-100 text-amber-500'
                            }`}>
                                {isPremiumUser ? <FileText size={16} /> : <Lock size={16} />}
                            </div>
                            <span className={`font-bold text-[11px] ${isPremiumUser ? 'text-slate-600 group-hover:text-amber-600' : 'text-amber-600'}`}>
                                PDF
                            </span>
                            {!isPremiumUser && (
                                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Lock size={8} className="text-white" />
                                </span>
                            )}
                        </button>
                    </div>

                    {/* MCQ / Video / Audio Row */}
                    <div className={`grid gap-2 ${hideMcq ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {!hideMcq && (
                            <button
                                onClick={() => onSelect('MCQ' as any)}
                                className="group relative flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95"
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--nst-color-brand-20)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                            >
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                                    style={{ background: 'var(--nst-color-brand-10)', color: 'var(--nst-color-brand)' }}
                                >
                                    <CheckSquare size={16} />
                                </div>
                                <span className="font-bold text-slate-600 text-[11px]">MCQ</span>
                            </button>
                        )}

                        <button
                            onClick={() => onSelect('VIDEO' as any)}
                            className="group relative flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-rose-200 transition-all active:scale-95"
                        >
                            <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                <Video size={16} />
                            </div>
                            <span className="font-bold text-slate-600 text-[11px] group-hover:text-rose-600">Video</span>
                        </button>

                        <button
                            onClick={() => onSelect('AUDIO' as any)}
                            className="group relative flex flex-col items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all active:scale-95"
                        >
                            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <Headphones size={16} />
                            </div>
                            <span className="font-bold text-slate-600 text-[11px] group-hover:text-amber-600">Audio</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
