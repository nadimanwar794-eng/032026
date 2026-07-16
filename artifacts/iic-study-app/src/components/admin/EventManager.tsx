// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../../types';
import { Save, Calendar, Clock, ChevronDown, ChevronUp, Zap, TrendingUp, Globe, Coins, Palette, Tag, Gift, Timer } from 'lucide-react';

interface Props {
  settings: SystemSettings;
  onUpdate: (s: SystemSettings) => void;
  onSave: () => void;
  isSaving?: boolean;
}

type EventStatus = 'LIVE' | 'SCHEDULED' | 'ENDED' | 'OFF';

function getStatus(enabled: boolean, startsAt?: string, endsAt?: string): EventStatus {
  if (!enabled) return 'OFF';
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : 0;
  const end = endsAt ? new Date(endsAt).getTime() : Infinity;
  if (now < start) return 'SCHEDULED';
  if (endsAt && now >= end) return 'ENDED';
  return 'LIVE';
}

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  } catch { return ''; }
}

function fromLocalInput(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

function enforceMax7Days(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return endIso;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const max = start + 7 * 24 * 60 * 60 * 1000;
  return end > max ? new Date(max).toISOString() : endIso;
}

const STATUS_BADGE: Record<EventStatus, { label: string; color: string; bg: string; dot: string }> = {
  LIVE:      { label: 'LIVE',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',  dot: '🟢' },
  SCHEDULED: { label: 'SCHEDULED', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: '⏰' },
  ENDED:     { label: 'ENDED',     color: '#64748b', bg: 'rgba(100,116,139,0.12)', dot: '✓' },
  OFF:       { label: 'OFF',       color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', dot: '○' },
};

interface EventCardProps {
  cardKey: string;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  description: string;
  enabled: boolean;
  eventName?: string;
  startsAt?: string;
  endsAt?: string;
  onToggle: (v: boolean) => void;
  onNameChange: (v: string) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  extraSettings?: React.ReactNode;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const EventCard: React.FC<EventCardProps> = ({
  cardKey, title, icon, accentColor, description,
  enabled, eventName, startsAt, endsAt,
  onToggle, onNameChange, onStartChange, onEndChange, extraSettings,
}) => {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const status = getStatus(enabled, startsAt, endsAt);
  const sb = STATUS_BADGE[status];

  const now = Date.now();
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs   = endsAt   ? new Date(endsAt).getTime()   : 0;
  const cooldownMs  = status === 'SCHEDULED' ? Math.max(0, startMs - now) : 0;
  const remainingMs = status === 'LIVE' && endMs ? Math.max(0, endMs - now) : 0;

  return (
    <div className="rounded-2xl border-2 overflow-hidden transition-all"
      style={{ borderColor: enabled ? accentColor : '#e2e8f0' }}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        style={{ background: enabled ? `${accentColor}14` : '#f8fafc' }}
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}20` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-slate-800 text-sm">{title}</p>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: sb.bg, color: sb.color }}>
              {sb.dot} {sb.label}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0"
            style={{ background: enabled ? accentColor : '#cbd5e1' }}
            onClick={e => { e.stopPropagation(); onToggle(!enabled); }}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform m-0.5 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
          <span className="text-slate-400 shrink-0">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* ── Cool Down / Time Remaining banner ── */}
      {(cooldownMs > 0 || remainingMs > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t"
          style={{
            background: cooldownMs > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
            borderColor: cooldownMs > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
          }}>
          <Timer size={14} style={{ color: cooldownMs > 0 ? '#f59e0b' : '#10b981', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: cooldownMs > 0 ? '#f59e0b' : '#10b981' }}>
              {cooldownMs > 0 ? '⏳ Cool Down — Time Until Start' : '🟢 Time Remaining'}
            </p>
            <p className="text-base font-black font-mono leading-none mt-0.5"
              style={{ color: cooldownMs > 0 ? '#92400e' : '#065f46' }}>
              {formatCountdown(cooldownMs > 0 ? cooldownMs : remainingMs)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-slate-400">
              {cooldownMs > 0
                ? `Starts: ${new Date(startMs).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : endMs ? `Ends: ${new Date(endMs).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-white">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Event Display Name</label>
            <input
              type="text"
              value={eventName || ''}
              onChange={e => onNameChange(e.target.value)}
              placeholder={`${title} — Display Name`}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* ── Start Time ── */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar size={9} /> Starts At
            </label>
            <input
              type="datetime-local"
              value={toLocalInput(startsAt)}
              onChange={e => onStartChange(fromLocalInput(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-indigo-200 mb-1.5"
            />
            <div className="flex gap-1.5 flex-wrap">
              <p className="text-[9px] text-slate-400 mr-0.5 self-center">Quick:</p>
              {[
                { label: 'Now',   ms: 0 },
                { label: '+1hr',  ms: 3600000 },
                { label: '+6hr',  ms: 6 * 3600000 },
                { label: '+1day', ms: 86400000 },
                { label: '+3day', ms: 3 * 86400000 },
              ].map(({ label, ms }) => (
                <button key={label} type="button"
                  onClick={() => onStartChange(new Date(Date.now() + ms).toISOString())}
                  className="text-[9px] font-black px-2 py-0.5 rounded-lg border transition-colors hover:text-white"
                  style={{ borderColor: accentColor, color: accentColor, background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = accentColor; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = accentColor; }}
                >{label}</button>
              ))}
              {startsAt && (
                <button type="button" onClick={() => onStartChange('')}
                  className="text-[9px] font-black px-2 py-0.5 rounded-lg border border-slate-300 text-slate-400 hover:bg-slate-100">
                  Clear
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Empty = turant shuru</p>
          </div>

          {/* ── End Time ── */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Clock size={9} /> Ends At
            </label>
            <input
              type="datetime-local"
              value={toLocalInput(endsAt)}
              onChange={e => {
                const raw = fromLocalInput(e.target.value);
                onEndChange(startsAt ? enforceMax7Days(startsAt, raw) : raw);
              }}
              className="w-full p-2 border border-slate-200 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-indigo-200 mb-1.5"
            />
            <div className="flex gap-1.5 flex-wrap">
              <p className="text-[9px] text-slate-400 mr-0.5 self-center">Duration:</p>
              {[
                { label: '1hr',  ms: 3600000 },
                { label: '6hr',  ms: 6 * 3600000 },
                { label: '12hr', ms: 12 * 3600000 },
                { label: '1day', ms: 86400000 },
                { label: '3day', ms: 3 * 86400000 },
                { label: '7day', ms: 7 * 86400000 },
              ].map(({ label, ms }) => {
                const base = startsAt ? new Date(startsAt).getTime() : Date.now();
                const target = new Date(Math.min(base + ms, base + 7 * 86400000)).toISOString();
                return (
                  <button key={label} type="button"
                    onClick={() => onEndChange(target)}
                    className="text-[9px] font-black px-2 py-0.5 rounded-lg border transition-colors"
                    style={{ borderColor: accentColor, color: accentColor, background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = accentColor; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = accentColor; }}
                  >{label}</button>
                );
              })}
            </div>
            <p className="text-[9px] text-amber-600 mt-1">Max 7 din start se</p>
          </div>

          {/* ── Chain Next Event ── */}
          {endsAt && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed"
              style={{ borderColor: `${accentColor}60`, background: `${accentColor}08` }}>
              <div className="text-lg">🔗</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-700">Chain Next Event</p>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Is event ke khatam hone ke baad turant agla event schedule karo —
                  Start time automatically set ho jayega <span className="font-bold text-slate-600">
                    {new Date(endsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span> pe.
                </p>
              </div>
              <button type="button"
                onClick={() => { onStartChange(endsAt); onEndChange(''); }}
                className="text-[10px] font-black px-3 py-1.5 rounded-xl text-white shrink-0 transition-all hover:scale-105 active:scale-95"
                style={{ background: accentColor }}>
                Chain ↗
              </button>
            </div>
          )}

          {extraSettings}
        </div>
      )}
    </div>
  );
};

export const EventManager: React.FC<Props> = ({ settings, onUpdate, onSave, isSaving }) => {
  const upd = (patch: Partial<SystemSettings>) => onUpdate({ ...settings, ...patch });

  const events = [
    {
      key: 'scoreBoost',
      title: 'Score Boost',
      icon: <Zap size={18} style={{ color: '#f59e0b' }} />,
      accentColor: '#f59e0b',
      description: 'MCQ answers mein extra score multiplier milega',
      enabled: settings.scoreBoostEvent?.enabled ?? false,
      eventName: settings.scoreBoostEvent?.eventName,
      startsAt: settings.scoreBoostEvent?.startsAt,
      endsAt: settings.scoreBoostEvent?.endsAt,
      onToggle: (v: boolean) => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { eventName: 'Score Boost', boostPercent: 50 }), enabled: v } }),
      onNameChange: (n: string) => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, boostPercent: 50 }), eventName: n } }),
      onStartChange: (s: string) => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, eventName: '', boostPercent: 50 }), startsAt: s || undefined } }),
      onEndChange: (e: string) => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, eventName: '', boostPercent: 50 }), endsAt: e || undefined } }),
      extraSettings: (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Score Boost %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={5} max={500} step={5}
                value={settings.scoreBoostEvent?.boostPercent ?? 50}
                onChange={e => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, eventName: '' }), boostPercent: Number(e.target.value) } })}
                className="w-24 p-2 border border-slate-200 rounded-xl text-sm font-bold" />
              <span className="text-sm font-black text-amber-600">%</span>
              <span className="text-[10px] text-slate-400">extra multiplier</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-5 rounded-full cursor-pointer transition-colors"
              style={{ background: settings.scoreBoostEvent?.themeStudioEnabled ? '#f59e0b' : '#cbd5e1' }}
              onClick={() => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, eventName: '', boostPercent: 50 }), themeStudioEnabled: !settings.scoreBoostEvent?.themeStudioEnabled } })}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform m-0.5 ${settings.scoreBoostEvent?.themeStudioEnabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-[10px] font-bold text-slate-600">Theme Studio bhi include karo</span>
            {settings.scoreBoostEvent?.themeStudioEnabled && (
              <div className="flex items-center gap-1 ml-1">
                <input type="number" min={1} max={30}
                  value={settings.scoreBoostEvent?.themeStudioDays ?? 3}
                  onChange={e => upd({ scoreBoostEvent: { ...(settings.scoreBoostEvent || { enabled: false, eventName: '', boostPercent: 50 }), themeStudioDays: Number(e.target.value) } })}
                  className="w-14 p-1.5 border rounded-lg text-xs font-bold" />
                <span className="text-[10px] text-slate-400">days</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'discountSale',
      title: 'Discount Sale',
      icon: <Tag size={18} style={{ color: '#ec4899' }} />,
      accentColor: '#ec4899',
      description: 'Store plans pe % discount apply karega',
      enabled: settings.specialDiscountEvent?.enabled ?? false,
      eventName: settings.specialDiscountEvent?.eventName,
      startsAt: settings.specialDiscountEvent?.startsAt,
      endsAt: settings.specialDiscountEvent?.endsAt,
      onToggle: (v: boolean) => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { eventName: 'Flash Sale', discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: true }), enabled: v } }),
      onNameChange: (n: string) => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { enabled: false, discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: true }), eventName: n } }),
      onStartChange: (s: string) => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { enabled: false, eventName: '', discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: true }), startsAt: s || undefined } }),
      onEndChange: (e: string) => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { enabled: false, eventName: '', discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: true }), endsAt: e || undefined } }),
      extraSettings: (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Discount %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={99}
                value={settings.specialDiscountEvent?.discountPercent ?? 20}
                onChange={e => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { enabled: false, eventName: '', showToFreeUsers: true, showToPremiumUsers: true }), discountPercent: Number(e.target.value) } })}
                className="w-24 p-2 border border-slate-200 rounded-xl text-sm font-bold" />
              <span className="text-sm font-black text-pink-600">% OFF</span>
            </div>
          </div>
          <div className="flex gap-4">
            {[
              { label: 'Free Users ko dikhao', fk: 'showToFreeUsers' as const },
              { label: 'Premium ko bhi dikhao', fk: 'showToPremiumUsers' as const },
            ].map(({ label, fk }) => (
              <label key={fk} className="flex items-center gap-2 cursor-pointer">
                <div
                  className="w-10 h-5 rounded-full transition-colors"
                  style={{ background: (settings.specialDiscountEvent as any)?.[fk] ? '#ec4899' : '#cbd5e1' }}
                  onClick={() => upd({ specialDiscountEvent: { ...(settings.specialDiscountEvent || { enabled: false, eventName: '', discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: true }), [fk]: !(settings.specialDiscountEvent as any)?.[fk] } })}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform m-0.5 ${(settings.specialDiscountEvent as any)?.[fk] ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'globalFree',
      title: 'Global Free Access',
      icon: <Globe size={18} style={{ color: '#10b981' }} />,
      accentColor: '#10b981',
      description: 'Sabhi premium content temporarily free ho jaata hai',
      enabled: settings.globalFreeAccessEvent?.enabled ?? (settings.isGlobalFreeMode ?? false),
      eventName: settings.globalFreeAccessEvent?.eventName,
      startsAt: settings.globalFreeAccessEvent?.startsAt,
      endsAt: settings.globalFreeAccessEvent?.endsAt,
      onToggle: (v: boolean) => upd({ globalFreeAccessEvent: { ...(settings.globalFreeAccessEvent || { eventName: 'Global Free Access' }), enabled: v }, isGlobalFreeMode: v }),
      onNameChange: (n: string) => upd({ globalFreeAccessEvent: { ...(settings.globalFreeAccessEvent || { enabled: false }), eventName: n } }),
      onStartChange: (s: string) => upd({ globalFreeAccessEvent: { ...(settings.globalFreeAccessEvent || { enabled: false, eventName: '' }), startsAt: s || undefined } }),
      onEndChange: (e: string) => upd({ globalFreeAccessEvent: { ...(settings.globalFreeAccessEvent || { enabled: false, eventName: '' }), endsAt: e || undefined } }),
    },
    {
      key: 'creditFree',
      title: 'Credit Free Event',
      icon: <Coins size={18} style={{ color: '#f59e0b' }} />,
      accentColor: '#d97706',
      description: 'Credit-based actions temporarily free ho jaate hain',
      enabled: settings.creditFreeEvent?.enabled ?? (settings.isCreditFreeEvent ?? false),
      eventName: (settings.creditFreeEvent as any)?.eventName,
      startsAt: (settings.creditFreeEvent as any)?.startsAt,
      endsAt: (settings.creditFreeEvent as any)?.endsAt,
      onToggle: (v: boolean) => upd({ creditFreeEvent: { ...(settings.creditFreeEvent || {}), enabled: v } as any, isCreditFreeEvent: v }),
      onNameChange: (n: string) => upd({ creditFreeEvent: { ...(settings.creditFreeEvent || { enabled: false }), eventName: n } as any }),
      onStartChange: (s: string) => upd({ creditFreeEvent: { ...(settings.creditFreeEvent || { enabled: false }), startsAt: s || undefined } as any }),
      onEndChange: (e: string) => upd({ creditFreeEvent: { ...(settings.creditFreeEvent || { enabled: false }), endsAt: e || undefined } as any }),
    },
    {
      key: 'dailyLimitBoost',
      title: 'Daily Limit Boost',
      icon: <TrendingUp size={18} style={{ color: '#6366f1' }} />,
      accentColor: '#6366f1',
      description: 'Daily MCQ aur score limits temporarily increase honge',
      enabled: (settings as any).dailyLimitBoostEvent?.enabled ?? false,
      eventName: (settings as any).dailyLimitBoostEvent?.eventName,
      startsAt: (settings as any).dailyLimitBoostEvent?.startsAt,
      endsAt: (settings as any).dailyLimitBoostEvent?.endsAt,
      onToggle: (v: boolean) => upd({ dailyLimitBoostEvent: { ...((settings as any).dailyLimitBoostEvent || { eventName: 'Daily Limit Boost' }), enabled: v } } as any),
      onNameChange: (n: string) => upd({ dailyLimitBoostEvent: { ...((settings as any).dailyLimitBoostEvent || { enabled: false }), eventName: n } } as any),
      onStartChange: (s: string) => upd({ dailyLimitBoostEvent: { ...((settings as any).dailyLimitBoostEvent || { enabled: false, eventName: '' }), startsAt: s || undefined } } as any),
      onEndChange: (e: string) => upd({ dailyLimitBoostEvent: { ...((settings as any).dailyLimitBoostEvent || { enabled: false, eventName: '' }), endsAt: e || undefined } } as any),
      extraSettings: (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-500 uppercase">MCQ Limit Boost (extra MCQs per day)</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: 'Free', fk: 'mcqBoostFree', color: '#64748b' },
              { label: 'Basic', fk: 'mcqBoostBasic', color: '#6366f1' },
              { label: 'Ultra', fk: 'mcqBoostUltra', color: '#f59e0b' },
            ] as const).map(({ label, fk, color }) => (
              <div key={fk}>
                <label className="text-[9px] font-black uppercase block mb-1" style={{ color }}>{label}</label>
                <input type="number" min={0} max={500}
                  value={(settings as any).dailyLimitBoostEvent?.[fk] ?? 50}
                  onChange={e => upd({ dailyLimitBoostEvent: { ...((settings as any).dailyLimitBoostEvent || { enabled: false, eventName: '' }), [fk]: Number(e.target.value) } } as any)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-center" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'creditBonus',
      title: 'Credit Bonus Event',
      icon: <Gift size={18} style={{ color: '#22c55e' }} />,
      accentColor: '#22c55e',
      description: 'MCQ prizes aur gifts mein extra % bonus credits milenge',
      enabled: settings.creditBonusEvent?.enabled ?? false,
      eventName: settings.creditBonusEvent?.eventName,
      startsAt: settings.creditBonusEvent?.startsAt,
      endsAt: settings.creditBonusEvent?.endsAt,
      onToggle: (v: boolean) => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { eventName: 'Credit Bonus', bonusPercent: 50, applyToMcqPrize: true, applyToGifts: true, applyToLoginBonus: false }), enabled: v } }),
      onNameChange: (n: string) => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { enabled: false, bonusPercent: 50 }), eventName: n } }),
      onStartChange: (s: string) => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { enabled: false, eventName: '', bonusPercent: 50 }), startsAt: s || undefined } }),
      onEndChange: (e: string) => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { enabled: false, eventName: '', bonusPercent: 50 }), endsAt: e || undefined } }),
      extraSettings: (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Bonus Credits %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={5} max={500} step={5}
                value={settings.creditBonusEvent?.bonusPercent ?? 50}
                onChange={e => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { enabled: false, eventName: '' }), bonusPercent: Number(e.target.value) } })}
                className="w-24 p-2 border border-slate-200 rounded-xl text-sm font-bold" />
              <span className="text-sm font-black text-green-600">% extra</span>
              <span className="text-[10px] text-slate-400">e.g. 50 = 1.5× credits</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase block">Kahan apply hoga?</label>
            {([
              { label: 'MCQ Prize Coins', fk: 'applyToMcqPrize' as const },
              { label: 'Inbox Gifts (Credits)', fk: 'applyToGifts' as const },
              { label: 'Login Bonus Credits', fk: 'applyToLoginBonus' as const },
            ]).map(({ label, fk }) => (
              <label key={fk} className="flex items-center gap-2 cursor-pointer">
                <div
                  className="w-10 h-5 rounded-full transition-colors"
                  style={{ background: settings.creditBonusEvent?.[fk] ? '#22c55e' : '#cbd5e1' }}
                  onClick={() => upd({ creditBonusEvent: { ...(settings.creditBonusEvent || { enabled: false, eventName: '', bonusPercent: 50 }), [fk]: !settings.creditBonusEvent?.[fk] } })}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform m-0.5 ${settings.creditBonusEvent?.[fk] ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const liveCount = events.filter(ev => getStatus(ev.enabled, ev.startsAt, ev.endsAt) === 'LIVE').length;
  const scheduledCount = events.filter(ev => getStatus(ev.enabled, ev.startsAt, ev.endsAt) === 'SCHEDULED').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-slate-800 text-sm">
            {liveCount > 0 ? `🟢 ${liveCount} event${liveCount > 1 ? 's' : ''} LIVE` : scheduledCount > 0 ? `⏰ ${scheduledCount} event${scheduledCount > 1 ? 's' : ''} scheduled` : '○ Koi event active nahi'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Max 7-din duration — automatic schedule supported</p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-black text-xs disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          <Save size={13} /> {isSaving ? 'Saving…' : 'Save Events'}
        </button>
      </div>

      {events.map(ev => (
        <EventCard key={ev.key} cardKey={ev.key} {...ev} />
      ))}

      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full py-3 rounded-2xl text-white font-black text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
      >
        {isSaving ? '💾 Saving…' : '💾 Save All Events'}
      </button>
    </div>
  );
};
