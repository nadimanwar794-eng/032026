import React, { useEffect, useState } from 'react';
import { getChapterData } from '../firebase';
import { ArrowLeft, Play, Lock } from 'lucide-react';
import { User, SystemSettings } from '../types';
import { CustomPlayer } from './CustomPlayer';
import { rotateScreen } from '../utils/displayPrefs';

interface Props {
    user: User;
    onBack: () => void;
    settings?: SystemSettings;
    isAdmin?: boolean;
    onBadgePosChange?: (pos: { portrait: { bottom: number; right: number }; landscape: { bottom: number; right: number }; fsButton: { bottom: number; right: number } }) => void;
}

export const UniversalVideoView: React.FC<Props> = ({ user, onBack, settings, isAdmin, onBadgePosChange }) => {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    useEffect(() => {
        getChapterData('nst_universal_playlist').then(data => {
            if (data && data.videoPlaylist) {
                setVideos(data.videoPlaylist);
            }
            setLoading(false);
        });
    }, []);

    const canAccess = (vid: any) => {
        if (user.role === 'ADMIN') return true;
        if (vid.access === 'FREE') return true;
        if (user.isPremium) {
            if (user.subscriptionLevel === 'ULTRA') return true;
            if (user.subscriptionLevel === 'BASIC' && vid.access === 'BASIC') return true;
        }
        return false;
    };

    const handleVideoClick = (idx: number) => {
        const vid = videos[idx];
        if (canAccess(vid)) {
            setActiveIndex(idx);
        } else {
            alert(`🔒 Locked! This video requires ${vid.access} subscription.`);
        }
    };

    const handleNext = () => {
        if (activeIndex === null) return;
        const nextIdx = activeIndex + 1;
        if (nextIdx < videos.length && canAccess(videos[nextIdx])) {
            setActiveIndex(nextIdx);
        }
    };

    const closePlayer = () => {
        setActiveIndex(null);
    };

    const activeVideo = activeIndex !== null ? videos[activeIndex] : null;
    const nextVideo = activeIndex !== null && activeIndex + 1 < videos.length ? videos[activeIndex + 1] : null;

    // ── PLAYER VIEW ──
    if (activeVideo) {
        return (
            <div
                className="fixed inset-0 bg-black flex flex-col animate-in fade-in"
                style={{ zIndex: 400 }}
            >
                {/* Video fills FULL screen — controls appear only on IIC×NSTA badge tap */}
                <div className="flex-1 relative">
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <CustomPlayer
                            videoUrl={activeVideo.url}
                            onBack={closePlayer}
                            onNext={nextVideo && canAccess(nextVideo) ? handleNext : undefined}
                            nextTitle={nextVideo?.title}
                            badgePos={settings?.iicNstaBadgePos}
                            badgeLabel={settings?.playerBadgeLabel}
                            fsButtonLabel={settings?.playerFsButtonLabel}
                            isAdmin={isAdmin}
                            onBadgePosChange={onBadgePosChange}
                            videoTitle={activeVideo.title}
                            onRotate={async () => { await rotateScreen(); }}
                            hideYtLogoBlocker={settings?.hideYtLogoBlocker}
                        />
                    </div>

                </div>
            </div>
        );
    }

    // ── PLAYLIST LIST VIEW ──
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col animate-in slide-in-from-bottom-8">
            {/* Top bar */}
            <div
                className="sticky top-0 z-10 flex items-center gap-3 px-5 pb-4"
                style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
                    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                }}
            >
                <button
                    onClick={onBack}
                    className="p-2.5 rounded-full active:scale-90 transition-transform shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                    <ArrowLeft size={20} color="#fff" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-white tracking-tight">Universal Videos</h2>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        Exclusive Mystery Content
                    </p>
                </div>
                <span className="text-[11px] font-bold text-white/60 shrink-0">{videos.length} videos</span>
            </div>

            {/* List */}
            <div className="flex-1 px-4 pt-4 pb-36 space-y-3">
                {loading ? (
                    <div className="text-center py-16 text-slate-400 font-medium">Loading videos...</div>
                ) : videos.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-bold">No videos found. Check back later!</div>
                ) : (
                    videos.map((vid, idx) => {
                        const locked = !canAccess(vid);
                        return (
                            <div
                                key={idx}
                                onClick={() => handleVideoClick(idx)}
                                className={`bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 shadow-sm transition-all active:scale-[0.98] cursor-pointer group ${locked ? 'opacity-70' : 'hover:shadow-md'}`}
                            >
                                <div className="relative shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <Play size={22} fill="white" className="text-white ml-0.5" />
                                    <span className="absolute bottom-1 right-1 text-[8px] font-black text-white/70 bg-black/30 rounded px-1">{idx + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate text-[14px]">{vid.title}</h4>
                                    {vid.description && (
                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{vid.description}</p>
                                    )}
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-1 inline-block uppercase tracking-wider border ${
                                        vid.access === 'FREE'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : vid.access === 'BASIC'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}>
                                        {vid.access}
                                    </span>
                                </div>
                                {locked && <Lock size={16} className="text-slate-400 shrink-0" />}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
