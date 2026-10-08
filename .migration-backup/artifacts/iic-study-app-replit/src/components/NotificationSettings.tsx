import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Check, Clock, Settings, X, Smartphone, ShieldCheck, AlertCircle, Play } from 'lucide-react';
import {
  hydrateNotificationPreferences,
  loadNotificationPreferences,
  NOTIFICATION_CATEGORY_DEFINITIONS,
  requestNotificationPermission,
  saveNotificationPreferences,
  subscribeUserToPush,
  testDelayedBackgroundNotification,
  type NotificationPreferences,
} from './NotificationManager';

interface Props {
  userId: string;
  placement?: 'floating' | 'topbar';
}

export const NotificationSettings: React.FC<Props> = ({ userId, placement = 'floating' }) => {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => loadNotificationPreferences(userId));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const isTopbar = placement === 'topbar';

  useEffect(() => {
    let active = true;
    hydrateNotificationPreferences(userId).then((next) => {
      if (active) setPreferences(next);
    });
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    return () => { active = false; };
  }, [userId]);

  const update = (next: Partial<NotificationPreferences>) => {
    setPreferences((current) => ({ ...current, ...next }));
    setSaved(false);
  };

  const handleTestNotification = async () => {
    const success = await testDelayedBackgroundNotification(5);
    if (success) {
      setTestCountdown(5);
      const interval = setInterval(() => {
        setTestCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const granted = await requestNotificationPermission();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermissionStatus(Notification.permission);
      }
      const next = await saveNotificationPreferences(userId, preferences);
      if (granted) await subscribeUserToPush(userId);
      setPreferences(next);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={isTopbar
          ? "relative p-1.5 rounded-xl transition-all text-white hover:bg-white/10 active:scale-95 shrink-0"
          : "fixed bottom-28 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg transition hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"}
        aria-label="Notification settings"
        title="Notification settings"
      >
        {preferences.enabled
          ? <Bell size={17} className={isTopbar ? "text-amber-200" : undefined} />
          : <BellOff size={17} className={isTopbar ? "text-slate-300" : undefined} />}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                  <Settings size={14} /> Smart alerts
                </p>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Notification settings</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Lock screen alerts, routine reminders aur private messages ko control karein.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <label className="mb-5 flex cursor-pointer items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">All notifications</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Ek switch se push alerts pause karein</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
                className="h-5 w-5 accent-indigo-600"
              />
            </label>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"><Clock size={14} /> Morning routine</span>
                <input type="time" value={preferences.morningRoutineTime} onChange={(event) => update({ morningRoutineTime: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700 dark:text-white" />
              </label>
              <label className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"><Clock size={14} /> Streak saver</span>
                <input type="time" value={preferences.streakSaverTime} onChange={(event) => update({ streakSaverTime: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700 dark:text-white" />
              </label>
            </div>
            <div className="mb-5 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Routine slot reminders</p>
              <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">Apne do daily study slots ke time set karein. Blank time par reminder off rahega.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['slot-1', 'slot-2'].map((slotId, index) => (
                  <label key={slotId} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Slot {index + 1}
                    <input
                      type="time"
                      value={preferences.routineSlotTimes[slotId] || ''}
                      onChange={(event) => update({ routineSlotTimes: { ...preferences.routineSlotTimes, [slotId]: event.target.value } })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700 dark:text-white"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {NOTIFICATION_CATEGORY_DEFINITIONS.map((category) => (
                <label key={category.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 px-3 py-3 dark:border-slate-800">
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{category.label}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{category.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.categories[category.key]}
                    onChange={(event) => update({ categories: { ...preferences.categories, [category.key]: event.target.checked } })}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
              ))}
            </div>

            {/* Background Notification Test Card */}
            <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Background Push Test
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {permissionStatus === 'granted' ? '✅ Permission Allowed' : '⚠️ Permission Required'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                App band hone ya phone lock hone par notification test karein. Button dabakar 5 second ke andar phone lock ya app band karein:
              </p>
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testCountdown !== null}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-75 cursor-pointer shadow-sm"
              >
                {testCountdown !== null ? (
                  <>
                    <span className="animate-pulse">⏳ App band karein... ({testCountdown}s)</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Test Background Notification (5s Timer)</span>
                  </>
                )}
              </button>
              {testCountdown !== null && (
                <p className="mt-2 text-[11px] text-amber-400 font-semibold text-center animate-bounce">
                  👉 Abhi apna phone lock karein ya doosra app kholein!
                </p>
              )}
            </div>

            {/* Background push tips */}
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-indigo-400" />
                App band hone par notification aane ke niyam:
              </p>
              <p>1. Chrome popup aane par <strong>"Allow"</strong> par click karein.</p>
              <p>2. Chrome menu (⋮) me jakar <strong>"Install app"</strong> ya <strong>"Add to Home screen"</strong> karein.</p>
              <p>3. Android phone settings &gt; Apps &gt; Chrome &gt; Battery me <strong>"Unrestricted"</strong> set karein taki phone app band hone par background push na roke.</p>
            </div>

            <button type="button" disabled={saving} onClick={save} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {saved ? <Check size={16} /> : <Bell size={16} />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save notification settings'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};