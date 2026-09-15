// @ts-nocheck
import React, { useState } from 'react';
import { SystemSettings } from '../types';
import {
    Eye, EyeOff, Bell, Crown, Navigation, Star, CheckCircle2, X, Flame, Zap, Ticket,
    GraduationCap, BrainCircuit, Video, ShoppingBag, Home as HomeIcon
} from 'lucide-react';
import { ALL_FEATURES } from '../utils/featureRegistry';

interface Props {
    settings: SystemSettings;
    onUpdate: (s: SystemSettings) => void;
}

export const AdminPowerManager: React.FC<Props> = ({ settings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'VISIBILITY' | 'TOPBAR' | 'BOTTOMNAV' | 'HOMEGRID' | 'SCORE_THRESHOLDS'>('VISIBILITY');
    const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

    const showSavedNotification = (msg: string) => {
        setSaveFeedback(msg);
        setTimeout(() => setSaveFeedback(null), 3000);
    };

    const updateSetting = (key: keyof SystemSettings, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        onUpdate(newSettings);
    };

    // Helper: toggle item in a hidden-list array setting
    const toggleHidden = (key: 'hiddenTopBarButtons' | 'hiddenBottomNavButtons' | 'hiddenHomeButtons', id: string) => {
        const current = (localSettings[key] as string[]) || [];
        const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        updateSetting(key, updated);
    };

    // Top bar buttons we expose for hiding
    const TOPBAR_BUTTONS = [
        { id: 'STREAK', label: 'Streak Badge', Icon: Flame, hint: 'The 🔥 day-counter chip' },
        { id: 'CREDITS', label: 'Credits Chip', Icon: Crown, hint: '"50 CR" coin balance pill' },
        { id: 'LIGHTNING', label: 'Lightning ⚡', Icon: Zap, hint: 'Custom Page / Updates button' },
        { id: 'NOTIFICATION', label: 'Notification 🔔', Icon: Bell, hint: 'Bell icon with red dot' },
        { id: 'SALE', label: 'Sale Discount Chip', Icon: Ticket, hint: 'Special offer "% OFF" badge' },
    ];

    // Bottom nav slots we expose for hiding
    const BOTTOM_NAV_BUTTONS = [
        { id: 'HOMEWORK', label: 'Homework', Icon: GraduationCap, hint: 'Shown when active homework exists' },
        { id: 'REVISION_V2', label: 'Revision Hub', Icon: BrainCircuit, hint: 'Brain-circuit icon — Revision tab' },
        { id: 'GK', label: 'Important', Icon: Star, hint: 'Star icon — opens Important Notes' },
        { id: 'VIDEO', label: 'Video', Icon: Video, hint: 'When video is in bottom nav (not top bar)' },
        { id: 'PROFILE', label: 'Profile', Icon: Crown, hint: 'When video is moved to top bar' },
        { id: 'APP_STORE', label: 'Apps Store', Icon: ShoppingBag, hint: 'Apps marketplace tab' },
    ];

    // Home grid features (Layer 1+2 features — student-facing dashboard buttons)
    const HOME_GRID_FEATURES = ALL_FEATURES.filter(f => (f.surfaceLevel === 1 || f.surfaceLevel === 2) && !f.requiresSuperAdmin);

    return (
        <div className="p-6 bg-white min-h-[500px]">
            {saveFeedback && (
                <div className="mb-4 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200">
                    <span className="flex items-center gap-2"><CheckCircle2 size={16} /> {saveFeedback}</span>
                    <button onClick={() => setSaveFeedback(null)} className="text-white/80 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl">
                {[
                    { id: 'VISIBILITY', icon: Eye, label: 'Modules' },
                    { id: 'TOPBAR', icon: Bell, label: 'Top Bar' },
                    { id: 'BOTTOMNAV', icon: Navigation, label: 'Bottom Nav' },
                    { id: 'HOMEGRID', icon: HomeIcon, label: 'Home Grid' },
                    { id: 'SCORE_THRESHOLDS', icon: Star, label: 'Score Thresholds' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:bg-white/50'}`}
                    >
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: VISIBILITY */}
            {activeTab === 'VISIBILITY' && (
                <div className="space-y-6">
                     <div className="p-4 border rounded-xl bg-slate-50 col-span-1 md:col-span-2">
                         <h4 className="font-bold text-slate-700 text-sm mb-4">Module Visibility</h4>
                         <div className="flex flex-wrap gap-4">
                             {[
                                 {key: 'isGroupStudyEnabled', label: '👥 Group Study & Live Classroom', defaultVal: true},
                                 {key: 'isChatEnabled', label: 'Chat Module'},
                                 {key: 'isGameEnabled', label: 'Game Module'},
                                 {key: 'isPaymentEnabled', label: 'Payment Gateway'},
                                 {key: 'allowSignup', label: 'Allow Signups'},
                             ].map(mod => (
                                 <label key={mod.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                     <input
                                        type="checkbox"
                                        checked={localSettings[mod.key] !== false}
                                        onChange={e => updateSetting(mod.key as keyof SystemSettings, e.target.checked)}
                                        className="accent-green-600 w-4 h-4"
                                     />
                                     <span className="text-xs font-bold text-slate-700">{mod.label}</span>
                                 </label>
                             ))}
                         </div>
                     </div>

                     {/* GROUP STUDY ACCESS & USAGE LIMITS */}
                     <div className="p-5 border border-indigo-200 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50">
                         <div className="flex items-center justify-between gap-3 mb-3 border-b border-indigo-100 pb-3">
                             <div className="flex items-center gap-2.5">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">
                                     👥
                                 </div>
                                 <div>
                                     <h4 className="font-black text-slate-800 text-sm">Group Study & Live Classroom Power Controls</h4>
                                     <p className="text-[11px] text-slate-500">Kon student kitna use kar sakta hai, room create karne ki power aur daily limits</p>
                                 </div>
                             </div>
                             <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${localSettings.isGroupStudyEnabled !== false ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300'}`}>
                                 {localSettings.isGroupStudyEnabled !== false ? 'ACTIVE & VISIBLE' : 'HIDDEN FROM STUDENTS & STORE'}
                             </span>
                         </div>

                        {/* GLOBAL STUDY ROOM CREATION TOGGLE (Reading, Writing, MCQ, PDF) */}
                        <div className="mb-4 p-3.5 rounded-xl bg-white border border-indigo-200 shadow-sm flex items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 uppercase">🚫 Hide Study Room Creation Everywhere</span>
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${localSettings.hideCreateStudyRoom ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`}>
                                        {localSettings.hideCreateStudyRoom ? 'HIDDEN' : 'VISIBLE (ACTIVE)'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Reading mode, Writing mode, MCQ mode aur baki sabhi jagah se "Live" aur "Apna Study Room Banayein" buttons ko hide karein.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateSetting('hideCreateStudyRoom' as any, !localSettings.hideCreateStudyRoom)}
                                className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${!localSettings.hideCreateStudyRoom ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                title={!localSettings.hideCreateStudyRoom ? 'Click to Hide Study Room Creation' : 'Click to Show Study Room Creation'}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${!localSettings.hideCreateStudyRoom ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             {/* FREE TIER USAGE */}
                             <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                                 <div className="flex items-center justify-between border-b pb-1.5">
                                     <span className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                                         <span>🆓</span> Free Students
                                     </span>
                                     <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Starter</span>
                                 </div>
                                 <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700">
                                     <input
                                         type="checkbox"
                                         checked={localSettings.groupStudyConfig?.allowFreeUsers !== false}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, allowFreeUsers: e.target.checked });
                                         }}
                                         className="accent-indigo-600 w-3.5 h-3.5"
                                     />
                                     Can Access Group Study Lobby
                                 </label>
                                 <div>
                                     <label className="text-[10px] font-bold text-slate-500 block mb-1">Daily Free Sessions (Joins/Day):</label>
                                     <input
                                         type="number"
                                         min="0"
                                         max="999"
                                         value={localSettings.groupStudyConfig?.dailySessionsFree ?? 2}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, dailySessionsFree: Number(e.target.value) });
                                         }}
                                         className="w-full p-1.5 border rounded-lg text-xs font-black"
                                     />
                                     <span className="text-[9px] text-slate-400">Default: 2 sessions / day</span>
                                 </div>
                                 <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700">
                                     <input
                                         type="checkbox"
                                         checked={localSettings.groupStudyConfig?.canCreateRoomsFree === true}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, canCreateRoomsFree: e.target.checked });
                                         }}
                                         className="accent-indigo-600 w-3.5 h-3.5"
                                     />
                                     Can Create Rooms (Default: No)
                                 </label>
                             </div>

                             {/* BASIC (PRO) TIER USAGE */}
                             <div className="p-3.5 rounded-xl bg-cyan-50/50 border border-cyan-200 shadow-sm space-y-3">
                                 <div className="flex items-center justify-between border-b border-cyan-100 pb-1.5">
                                     <span className="text-xs font-black text-cyan-800 uppercase flex items-center gap-1.5">
                                         <span>⭐</span> Basic (Pro) Plan
                                     </span>
                                     <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">Recommended</span>
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-cyan-700 block mb-1">Daily Sessions Limit:</label>
                                     <input
                                         type="number"
                                         min="0"
                                         max="9999"
                                         value={localSettings.groupStudyConfig?.dailySessionsBasic ?? 10}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, dailySessionsBasic: Number(e.target.value) });
                                         }}
                                         className="w-full p-1.5 border border-cyan-300 rounded-lg text-xs font-black bg-white"
                                     />
                                     <span className="text-[9px] text-cyan-600">Default: 10 sessions (9999 = unlimited)</span>
                                 </div>
                                 <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-cyan-900">
                                     <input
                                         type="checkbox"
                                         checked={localSettings.groupStudyConfig?.canCreateRoomsBasic !== false}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, canCreateRoomsBasic: e.target.checked });
                                         }}
                                         className="accent-cyan-600 w-3.5 h-3.5"
                                     />
                                     Can Create Rooms (Yes)
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-cyan-900">
                                     <input
                                         type="checkbox"
                                         checked={localSettings.groupStudyConfig?.canHostMcqBattleBasic !== false}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, canHostMcqBattleBasic: e.target.checked });
                                         }}
                                         className="accent-cyan-600 w-3.5 h-3.5"
                                     />
                                     Can Host Live MCQ Battle (Yes)
                                 </label>
                                 <div>
                                     <label className="text-[10px] font-bold text-cyan-700 block mb-1">Max Room Capacity:</label>
                                     <input
                                         type="number"
                                         min="5"
                                         max="100"
                                         value={localSettings.groupStudyConfig?.maxMembersBasic ?? 25}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, maxMembersBasic: Number(e.target.value) });
                                         }}
                                         className="w-full p-1.5 border border-cyan-300 rounded-lg text-xs font-black bg-white"
                                     />
                                     <span className="text-[9px] text-cyan-600">Max members in room (Default: 25)</span>
                                 </div>
                             </div>

                             {/* ULTRA (MAX) TIER USAGE */}
                             <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 shadow-sm space-y-3">
                                 <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                                     <span className="text-xs font-black text-purple-900 uppercase flex items-center gap-1.5">
                                         <span>👑</span> Ultra (Max VIP) Plan
                                     </span>
                                     <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">VIP Unlimited</span>
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-purple-700 block mb-1">Daily Sessions Limit:</label>
                                     <input
                                         type="number"
                                         min="0"
                                         max="9999"
                                         value={localSettings.groupStudyConfig?.dailySessionsUltra ?? 9999}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, dailySessionsUltra: Number(e.target.value) });
                                         }}
                                         className="w-full p-1.5 border border-purple-300 rounded-lg text-xs font-black bg-white text-purple-900"
                                     />
                                     <span className="text-[9px] text-purple-600">9999 = Unlimited Access</span>
                                 </div>
                                 <div className="space-y-1.5 text-[11px] font-bold text-purple-900">
                                     <div className="flex items-center gap-1.5 text-emerald-700">
                                         <span>✓</span> Unlimited Room Creation & Hosting
                                     </div>
                                     <div className="flex items-center gap-1.5 text-emerald-700">
                                         <span>✓</span> Live Whiteboard Broadcasting
                                     </div>
                                     <div className="flex items-center gap-1.5 text-emerald-700">
                                         <span>✓</span> Host Live MCQ Battle (Custom Timer & Questions)
                                     </div>
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-purple-700 block mb-1">Max VIP Room Capacity:</label>
                                     <input
                                         type="number"
                                         min="10"
                                         max="200"
                                         value={localSettings.groupStudyConfig?.maxMembersUltra ?? 100}
                                         onChange={e => {
                                             const curr = localSettings.groupStudyConfig || {};
                                             updateSetting('groupStudyConfig' as any, { ...curr, maxMembersUltra: Number(e.target.value) });
                                         }}
                                         className="w-full p-1.5 border border-purple-300 rounded-lg text-xs font-black bg-white"
                                     />
                                     <span className="text-[9px] text-purple-600">Max members in room (Default: 100)</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                </div>
            )}

            {/* TAB 2: TOP BAR — per-button hide/unhide */}
            {activeTab === 'TOPBAR' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <Crown size={16} className="text-amber-600" /> Top Bar Buttons
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            Har button ko alag se hide ya show kar sakte hain. Greyed-out = hidden from students.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {TOPBAR_BUTTONS.map(btn => {
                                const isHidden = (localSettings.hiddenTopBarButtons || []).includes(btn.id);
                                return (
                                    <button
                                        key={btn.id}
                                        onClick={() => toggleHidden('hiddenTopBarButtons', btn.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-amber-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-amber-100 text-amber-700'}`}>
                                            <btn.Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800">{btn.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{btn.hint}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: BOTTOM NAV — per-slot hide/unhide */}
            {activeTab === 'BOTTOMNAV' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <Navigation size={16} className="text-blue-600" /> Bottom Navigation Slots
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            Hide karne par baki buttons automatically slide ho jaayenge.
                            <span className="font-bold"> Home button hamesha visible rehta hai.</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {BOTTOM_NAV_BUTTONS.map(btn => {
                                const isHidden = (localSettings.hiddenBottomNavButtons || []).includes(btn.id);
                                return (
                                    <button
                                        key={btn.id}
                                        onClick={() => toggleHidden('hiddenBottomNavButtons', btn.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-blue-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-700'}`}>
                                            <btn.Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800">{btn.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{btn.hint}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: HOME GRID — feature buttons on home page */}
            {activeTab === 'HOMEGRID' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <HomeIcon size={16} className="text-emerald-600" /> Home Page Buttons
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            All home grid feature buttons. Hiding a button will remove it from the student's home page.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
                            {HOME_GRID_FEATURES.map(f => {
                                const isHidden = (localSettings.hiddenHomeButtons || []).includes(f.id) || (localSettings.hiddenFeatures || []).includes(f.id);
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => toggleHidden('hiddenHomeButtons', f.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-emerald-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800 truncate">{f.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{f.description || f.id}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-3 italic">
                            Tip: Aap pre-existing "Hidden Features" list ka bhi use kar sakte hain (yeh dono respect kiye jaate hain).
                        </p>
                    </div>
                </div>
            )}

            {/* TAB 5: SCORE THRESHOLDS */}
            {activeTab === 'SCORE_THRESHOLDS' && (
                <div className="space-y-3">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200 space-y-4">
                        <div>
                            <h4 className="font-black text-amber-900 flex items-center gap-2 text-sm">
                                <Star size={16} className="text-amber-600" /> Level Score Thresholds
                            </h4>
                            <p className="text-[11px] text-amber-700 mt-0.5">Set minimum score for each level. Leave blank = use default system value.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                            {[
                                {level:1,label:'Beginner',emoji:'🌱',def:0},
                                {level:2,label:'Apprentice',emoji:'🌿',def:200},
                                {level:3,label:'Explorer',emoji:'🔍',def:500},
                                {level:4,label:'Scholar',emoji:'✨',def:1000},
                                {level:5,label:'Expert',emoji:'⚡',def:5000},
                                {level:6,label:'Veteran',emoji:'🔥',def:10000},
                                {level:7,label:'Master',emoji:'💫',def:20000},
                                {level:8,label:'GrandMaster',emoji:'💎',def:50000},
                                {level:9,label:'Titan',emoji:'🌟',def:100000},
                                {level:10,label:'Mythic',emoji:'👑',def:500000},
                                {level:11,label:'Supreme',emoji:'🏆',def:2500000},
                                {level:12,label:'Legend',emoji:'🔮',def:5000000},
                                {level:13,label:'Immortal',emoji:'⚜️',def:10000000},
                                {level:14,label:'Divine',emoji:'🌠',def:20000000},
                                {level:15,label:'Absolute',emoji:'💠',def:50000000},
                            ].map(({level, label, emoji, def}) => {
                                const cur = (localSettings.levelScoreOverride as any)?.[String(level)];
                                return (
                                    <div key={level} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100 shadow-sm">
                                        <span className="text-lg w-7 text-center">{emoji}</span>
                                        <div className="w-20 shrink-0">
                                            <p className="text-xs font-bold text-slate-700">L{level} {label}</p>
                                            <p className="text-[10px] text-slate-400">Default: {def.toLocaleString()}</p>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            value={cur ?? ''}
                                            placeholder={String(def)}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const overrides = {...((localSettings.levelScoreOverride as any) || {})};
                                                if (val === '' || val === undefined) {
                                                    delete overrides[String(level)];
                                                } else {
                                                    overrides[String(level)] = Number(val);
                                                }
                                                const updated = { ...localSettings, levelScoreOverride: overrides };
                                                setLocalSettings(updated);
                                                onUpdate(updated);
                                            }}
                                            className="flex-1 p-2 border rounded-lg text-sm font-bold text-right focus:outline-none focus:border-amber-400"
                                        />
                                        {cur !== undefined && (
                                            <button onClick={() => {
                                                const overrides = {...((localSettings.levelScoreOverride as any) || {})};
                                                delete overrides[String(level)];
                                                const updated = { ...localSettings, levelScoreOverride: overrides };
                                                setLocalSettings(updated);
                                                onUpdate(updated);
                                            }} className="text-[10px] text-red-400 hover:text-red-600 shrink-0 font-bold">Reset</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => {
                                const updated = { ...localSettings, levelScoreOverride: {} };
                                setLocalSettings(updated);
                                onUpdate(updated);
                            }}
                            className="w-full py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 transition-all"
                        >
                            Reset All Levels to Default
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
