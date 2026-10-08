import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, Sparkles } from 'lucide-react';
import { requestNotificationPermission, subscribeUserToPush, dispatchSmartNotification } from './NotificationManager';

interface Props {
  userId?: string;
}

export const NotificationPrompt: React.FC<Props> = ({ userId }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [enabledSuccess, setEnabledSuccess] = useState(false);

    useEffect(() => {
        // 1. If permission is already granted, ensure device FCM token is synced to database
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            subscribeUserToPush(userId).catch(() => {});
            return;
        }

        // 2. Prompt gently after 2.5 seconds so mobile users can quickly enable notifications
        const timer = setTimeout(() => {
             if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && !localStorage.getItem('nst_push_prompt_dismissed')) {
                 setShowPrompt(true);
             }
        }, 2500);
        return () => clearTimeout(timer);
    }, [userId]);

    const handleEnable = async () => {
        try {
            const granted = await requestNotificationPermission();
            if (granted) {
                await subscribeUserToPush(userId);
                setEnabledSuccess(true);
                dispatchSmartNotification({
                    title: '🔔 Notifications Active!',
                    body: 'Aapko chat messages, friend requests aur study updates ke notifications aayenge.',
                    category: 'DEFAULT',
                    url: '/',
                });
                setTimeout(() => {
                    setShowPrompt(false);
                }, 2200);
            } else {
                setShowPrompt(false);
            }
        } catch (e) {
            console.warn('[NotificationPrompt] Enable error:', e);
            setShowPrompt(false);
        }
        localStorage.setItem('nst_push_prompt_dismissed', 'true');
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('nst_push_prompt_dismissed', 'true');
    };

    if (!showPrompt) return null;

    if (enabledSuccess) {
        return (
            <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl z-50 p-4 text-white flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-emerald-300">Notifications Enabled!</h4>
                    <p className="text-[11px] text-slate-300">Aapko important study aur test updates milenge.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-84 bg-slate-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
            <div className="bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-700 p-4 text-white flex gap-3 items-start relative">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center shrink-0 shadow-sm">
                    <Bell size={20} className="text-white animate-bounce" />
                </div>
                <div className="pr-4">
                    <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded-full mb-1 text-amber-200">
                        <Sparkles size={9} />
                        <span>Smart Alerts</span>
                    </div>
                    <h3 className="font-black text-sm leading-tight text-white">Study Updates &amp; Messages</h3>
                    <p className="text-[11px] text-indigo-100 mt-1 leading-snug">Daily challenge, doubt replies aur test results ke alerts paane ke liye enable karein.</p>
                </div>
                <button 
                  onClick={handleDismiss} 
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="p-2.5 bg-slate-900/90 flex gap-2">
                <button 
                  onClick={handleDismiss} 
                  className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Baad me
                </button>
                <button 
                  onClick={handleEnable} 
                  className="flex-1 py-2 text-xs font-black text-slate-900 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  Enable Alerts
                </button>
            </div>
        </div>
    );
};
