import React, { useEffect, useMemo, useState } from 'react';
import { rtdb } from '../../firebase';
import { ref, onValue, update, remove, set, get, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
import {
  AlertTriangle, ArrowLeft, RefreshCw, Trash2, CheckCircle, Clock, Monitor,
  Smartphone, Tablet, X, Search, GitBranch, Users, BarChart2, ChevronDown,
  ChevronUp, Tag, Copy, Cpu, Globe, Download, EyeOff, Filter, Package,
  MapPin, TrendingUp, AlertOctagon, Shield
} from 'lucide-react';
import { AppError } from '../../utils/errorLogger';

interface Props { onBack: () => void; }

interface ErrorResolution { resolvedInVersion: string; resolvedAt: number; }

interface ErrorGroup {
  fingerprint: string;
  message: string;
  severity: AppError['severity'];
  type: AppError['type'];
  component?: string;
  urls: string[];
  versions: string[];
  browsers: string[];
  devices: string[];
  count: number;
  affectedUserIds: Set<string>;
  affectedUserNames: string[];
  firstSeen: number;
  lastSeen: number;
  entries: Array<AppError & { id: string }>;
  dismissed: boolean;
  autoCritical: boolean; // auto-escalated because 50+ users
}

const SEV_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; row: string }> = {
  low:      { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-600',  badge: 'bg-slate-100 text-slate-500',  row: 'border-l-slate-300' },
  medium:   { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  row: 'border-l-amber-400' },
  high:     { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', row: 'border-l-orange-500' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      row: 'border-l-red-500' },
};
const TYPE_EMOJI: Record<string, string> = { react: '⚛️', runtime: '💥', promise: '🔮', network: '🌐', manual: '📋' };
const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const DEVICE_ICON: Record<string, React.ReactNode> = {
  mobile: <Smartphone size={10} />, tablet: <Tablet size={10} />, desktop: <Monitor size={10} />,
};

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
function formatFull(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function getFingerprint(msg: string): string { return msg.slice(0, 90).replace(/\s+/g, ' ').trim(); }
function safeKey(fp: string): string { return btoa(encodeURIComponent(fp)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40); }

// ──────────────────────────────────────────────
// FilterChips — reusable pill row
// ──────────────────────────────────────────────
function FilterChips({ label, icon, values, active, onChange }: {
  label: string; icon: React.ReactNode;
  values: string[]; active: string; onChange: (v: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">{icon} {label}:</span>
      {(['ALL', ...values]).map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${active === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Build formatted report string for copy/download
// ──────────────────────────────────────────────
function buildReport(group: ErrorGroup): string {
  const e = group.entries[0] as any;
  const lines = [
    `╔══════════════════════════════════════════╗`,
    `║          NSTA ERROR REPORT               ║`,
    `╚══════════════════════════════════════════╝`,
    ``,
    `Error: ${group.message}`,
    ``,
    `━━━ App Info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Version  : ${e?.appVersion || 'unknown'}`,
    `Build    : ${e?.buildNumber || 'unknown'}`,
    ``,
    `━━━ Device Info ━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Device   : ${e?.deviceModel || e?.device || 'unknown'}`,
    `Android  : ${e?.osName || 'unknown'} ${e?.osVersion || ''}`.trim(),
    `Browser  : ${e?.browserName || 'unknown'} ${e?.browserVersion || ''}`.trim(),
    ``,
    `━━━ Error Details ━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Severity : ${group.severity.toUpperCase()}${group.autoCritical ? ' (AUTO-ESCALATED: 50+ users)' : ''}`,
    `Type     : ${group.type}`,
    `Component: ${group.component || 'unknown'}`,
    `Route    : ${group.urls.join(', ') || '/'}`,
    ``,
    `━━━ Frequency ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Occurrences  : ${group.count}`,
    `Affected Users: ${group.affectedUserIds.size}`,
    `User(s)      : ${group.affectedUserNames.join(', ') || 'anonymous'}`,
    `User ID      : ${e?.userId || 'unknown'}`,
    `First Seen   : ${formatFull(group.firstSeen)}`,
    `Last Seen    : ${formatFull(group.lastSeen)}`,
    ``,
    `━━━ Stack Trace ━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    e?.stack || '(none)',
    ``,
    `━━━ Component Stack ━━━━━━━━━━━━━━━━━━━━━━`,
    e?.componentStack || '(none)',
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Generated: ${formatFull(Date.now())}`,
  ];
  return lines.join('\n');
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export const ErrorNoticeBoard: React.FC<Props> = ({ onBack }) => {
  const [errors, setErrors] = useState<Array<AppError & { id: string }>>([]);
  const [resolutions, setResolutions] = useState<Record<string, ErrorResolution>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'critical' | 'resolved' | 'ignored'>('active');
  const [search, setSearch] = useState('');

  // Smart filters
  const [componentFilter, setComponentFilter] = useState('ALL');
  const [versionFilter, setVersionFilter] = useState('ALL');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [browserFilter, setBrowserFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveVersion, setResolveVersion] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Ignored fingerprints (session-level, localStorage backed)
  const [ignoredKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('err_ignored_keys') || '[]')); } catch { return new Set(); }
  });
  const [ignoredVersion, setIgnoredVersion] = useState(0); // force re-render after ignore

  // ── Firebase subscriptions ──
  useEffect(() => {
    const q = rtdbQuery(ref(rtdb, 'error_logs'), orderByChild('timestamp'), limitToLast(500));
    const unsub = onValue(q, snap => {
      const items: Array<AppError & { id: string }> = [];
      snap.forEach(child => { items.push({ ...child.val(), id: child.key! }); });
      items.reverse();
      setErrors(items);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'error_resolutions'), snap => {
      setResolutions(snap.exists() ? snap.val() : {});
    }, () => {});
    return unsub;
  }, []);

  // ── Grouping with auto-critical ──
  const groups = useMemo<ErrorGroup[]>(() => {
    const map = new Map<string, ErrorGroup>();
    for (const err of errors) {
      const fp = getFingerprint(err.message);
      const existing = map.get(fp);
      const e = err as any;
      const comp = err.component
        || (err.componentStack ? err.componentStack.match(/\bat\s+([A-Z]\w+)/)?.[1] : undefined)
        || (err.url?.split('/').pop() || undefined);
      const ver = e.appVersion || '';
      const browser = e.browserName || '';
      const dev = e.device || 'desktop';

      if (existing) {
        existing.count++;
        if (err.userId) {
          existing.affectedUserIds.add(err.userId);
          if (err.userName && !existing.affectedUserNames.includes(err.userName))
            existing.affectedUserNames.push(err.userName);
        }
        if (!existing.urls.includes(err.url)) existing.urls.push(err.url);
        if (ver && !existing.versions.includes(ver)) existing.versions.push(ver);
        if (browser && !existing.browsers.includes(browser)) existing.browsers.push(browser);
        if (!existing.devices.includes(dev)) existing.devices.push(dev);
        if (err.timestamp < existing.firstSeen) existing.firstSeen = err.timestamp;
        if (err.timestamp > existing.lastSeen) existing.lastSeen = err.timestamp;
        if (SEV_RANK[err.severity] > SEV_RANK[existing.severity]) existing.severity = err.severity;
        existing.entries.push(err);
        if (!err.dismissed) existing.dismissed = false;
      } else {
        map.set(fp, {
          fingerprint: fp, message: err.message, severity: err.severity,
          type: err.type, component: comp,
          urls: [err.url], versions: ver ? [ver] : [], browsers: browser ? [browser] : [],
          devices: [dev], count: 1,
          affectedUserIds: new Set(err.userId ? [err.userId] : []),
          affectedUserNames: err.userName ? [err.userName] : [],
          firstSeen: err.timestamp, lastSeen: err.timestamp,
          entries: [err], dismissed: !!err.dismissed, autoCritical: false,
        });
      }
    }
    // Auto-escalate to critical if 50+ users affected
    const result = Array.from(map.values()).map(g => {
      if (g.affectedUserIds.size >= 50 && SEV_RANK[g.severity] < SEV_RANK['critical']) {
        return { ...g, severity: 'critical' as const, autoCritical: true };
      }
      return g;
    });
    return result.sort((a, b) => {
      // Critical first, then by lastSeen
      const sevDiff = SEV_RANK[b.severity] - SEV_RANK[a.severity];
      return sevDiff !== 0 ? sevDiff : b.lastSeen - a.lastSeen;
    });
  }, [errors]);

  // ── Computed filter option lists ──
  const allComponents = useMemo(() => { const s = new Set<string>(); groups.forEach(g => { if (g.component) s.add(g.component); }); return Array.from(s).sort(); }, [groups]);
  const allVersions   = useMemo(() => { const s = new Set<string>(); groups.forEach(g => g.versions.forEach(v => s.add(v))); return Array.from(s).sort().reverse(); }, [groups]);
  const allBrowsers   = useMemo(() => { const s = new Set<string>(); groups.forEach(g => g.browsers.forEach(b => s.add(b))); return Array.from(s).sort(); }, [groups]);
  const allDevices    = useMemo(() => { const s = new Set<string>(); groups.forEach(g => g.devices.forEach(d => s.add(d))); return Array.from(s).sort(); }, [groups]);
  const allRoutes     = useMemo(() => { const s = new Set<string>(); groups.forEach(g => g.urls.filter(Boolean).forEach(u => s.add(u))); return Array.from(s).sort(); }, [groups]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    return groups.filter(g => {
      const key = safeKey(g.fingerprint);
      const isResolved = !!resolutions[key];
      const isIgnored = ignoredKeys.has(key);
      if (filter === 'active'   && (g.dismissed || isResolved || isIgnored)) return false;
      if (filter === 'critical' && g.severity !== 'critical' && g.severity !== 'high') return false;
      if (filter === 'resolved' && !isResolved) return false;
      if (filter === 'ignored'  && !isIgnored) return false;
      if (componentFilter !== 'ALL' && g.component !== componentFilter) return false;
      if (versionFilter !== 'ALL'   && !g.versions.includes(versionFilter)) return false;
      if (deviceFilter !== 'ALL'    && !g.devices.includes(deviceFilter)) return false;
      if (browserFilter !== 'ALL'   && !g.browsers.includes(browserFilter)) return false;
      if (routeFilter !== 'ALL'     && !g.urls.includes(routeFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!g.message.toLowerCase().includes(q) && !(g.component || '').toLowerCase().includes(q)
          && !g.affectedUserNames.some(n => n.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filter, componentFilter, versionFilter, deviceFilter, browserFilter, routeFilter, search, resolutions, ignoredVersion]);

  // ── Computed counts ──
  const totalGroups       = groups.length;
  const activeGroups      = groups.filter(g => !g.dismissed && !resolutions[safeKey(g.fingerprint)] && !ignoredKeys.has(safeKey(g.fingerprint))).length;
  const criticalGroups    = groups.filter(g => g.severity === 'critical' || g.severity === 'high').length;
  const resolvedGroups    = groups.filter(g => !!resolutions[safeKey(g.fingerprint)]).length;
  const ignoredGroups     = groups.filter(g => ignoredKeys.has(safeKey(g.fingerprint))).length;
  const totalAffectedUsers = new Set(errors.filter(e => e.userId).map(e => e.userId!)).size;
  const autoCriticalCount = groups.filter(g => g.autoCritical).length;

  // ── Handlers ──
  const handleDismissGroup = async (g: ErrorGroup) => {
    await Promise.all(g.entries.filter(e => !e.dismissed).map(e =>
      update(ref(rtdb, `error_logs/${e.id}`), { dismissed: true }).catch(() => {})
    ));
  };

  const handleIgnoreGroup = (g: ErrorGroup) => {
    const key = safeKey(g.fingerprint);
    ignoredKeys.add(key);
    try { localStorage.setItem('err_ignored_keys', JSON.stringify(Array.from(ignoredKeys))); } catch {}
    setIgnoredVersion(v => v + 1);
  };

  const handleUnignoreGroup = (g: ErrorGroup) => {
    const key = safeKey(g.fingerprint);
    ignoredKeys.delete(key);
    try { localStorage.setItem('err_ignored_keys', JSON.stringify(Array.from(ignoredKeys))); } catch {}
    setIgnoredVersion(v => v + 1);
  };

  const handleDeleteGroup = async (g: ErrorGroup) => {
    if (!window.confirm(`"${g.message.slice(0, 60)}…" — ${g.count} entries delete honge. Confirm?`)) return;
    await Promise.all(g.entries.map(e => remove(ref(rtdb, `error_logs/${e.id}`)).catch(() => {})));
  };

  const handleCopyGroup = (group: ErrorGroup) => {
    navigator.clipboard.writeText(buildReport(group)).catch(() => {});
    setCopiedKey(group.fingerprint);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadGroup = (group: ErrorGroup) => {
    const text = buildReport(group);
    const safeName = group.message.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `error_${safeName}_${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (!window.confirm('Sab error logs delete ho jayenge. Confirm?')) return;
    setClearing(true);
    await Promise.all(errors.map(e => remove(ref(rtdb, `error_logs/${e.id}`)))).catch(() => {});
    setClearing(false);
  };

  const handleMarkResolved = async (fingerprint: string) => {
    if (!resolveVersion.trim()) return;
    setResolveSaving(true);
    const key = safeKey(fingerprint);
    await set(ref(rtdb, `error_resolutions/${key}`), {
      resolvedInVersion: resolveVersion.trim(), resolvedAt: Date.now(),
    }).catch(() => {});
    setResolveSaving(false); setResolveTarget(null); setResolveVersion('');
  };

  const handleUnresolve = async (fingerprint: string) => {
    await remove(ref(rtdb, `error_resolutions/${safeKey(fingerprint)}`)).catch(() => {});
  };

  const activeFiltersCount = [componentFilter, versionFilter, deviceFilter, browserFilter, routeFilter].filter(f => f !== 'ALL').length;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ══ Header ══ */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-50 text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle size={16} className="text-red-500" />
                <h2 className="font-black text-slate-800">Error Notice Board</h2>
                {activeGroups > 0 && (
                  <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                    {activeGroups} ACTIVE
                  </span>
                )}
                {autoCriticalCount > 0 && (
                  <span className="text-[10px] font-black bg-rose-700 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertOctagon size={9} /> {autoCriticalCount} AUTO-CRITICAL
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Professional crash monitoring — frequency, device, version, resolution</p>
            </div>
          </div>
          <button onClick={handleClearAll} disabled={clearing || errors.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors">
            {clearing ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Clear All
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-6 gap-1.5">
          {[
            { label: 'Groups', count: totalGroups, color: 'text-slate-700', icon: '🗂️' },
            { label: 'Active', count: activeGroups, color: 'text-red-600', icon: '🔴' },
            { label: 'Critical', count: criticalGroups, color: 'text-orange-600', icon: '🔥' },
            { label: 'Resolved', count: resolvedGroups, color: 'text-green-600', icon: '✅' },
            { label: 'Ignored', count: ignoredGroups, color: 'text-slate-400', icon: '🙈' },
            { label: 'Users Hit', count: totalAffectedUsers, color: 'text-indigo-600', icon: '👥' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-1.5 text-center shadow-sm border border-slate-100">
              <p className="text-sm leading-none">{s.icon}</p>
              <p className={`text-sm font-black leading-tight ${s.color}`}>{s.count}</p>
              <p className="text-[7px] font-bold text-slate-400 uppercase leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Search + Smart Filters ══ */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search error message, user, component…"
              className="w-full pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-red-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl border transition-all ${showFilters || activeFiltersCount > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            <Filter size={11} />
            Filters
            {activeFiltersCount > 0 && <span className="bg-white text-indigo-600 rounded-full w-4 h-4 text-[9px] font-black flex items-center justify-center">{activeFiltersCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="space-y-2 pt-1">
            <FilterChips label="Component" icon={<GitBranch size={10} />} values={allComponents} active={componentFilter} onChange={setComponentFilter} />
            <FilterChips label="Version"   icon={<Package size={10} />}   values={allVersions}   active={versionFilter}   onChange={setVersionFilter} />
            <FilterChips label="Device"    icon={<Smartphone size={10} />} values={allDevices}    active={deviceFilter}    onChange={setDeviceFilter} />
            <FilterChips label="Browser"   icon={<Globe size={10} />}      values={allBrowsers}   active={browserFilter}   onChange={setBrowserFilter} />
            <FilterChips label="Route"     icon={<MapPin size={10} />}     values={allRoutes}     active={routeFilter}     onChange={setRouteFilter} />
            {activeFiltersCount > 0 && (
              <button onClick={() => { setComponentFilter('ALL'); setVersionFilter('ALL'); setDeviceFilter('ALL'); setBrowserFilter('ALL'); setRouteFilter('ALL'); }}
                className="text-[10px] font-bold text-red-500 hover:text-red-700">
                ✕ Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ Filter tabs ══ */}
      <div className="flex border-b border-slate-100 bg-white overflow-x-auto">
        {([
          { key: 'active',   label: `Active (${activeGroups})` },
          { key: 'critical', label: `Critical (${criticalGroups})` },
          { key: 'resolved', label: `Resolved (${resolvedGroups})` },
          { key: 'ignored',  label: `Ignored (${ignoredGroups})` },
          { key: 'all',      label: `All (${totalGroups})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 flex-1 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${filter === f.key ? 'text-red-600 border-b-2 border-red-500 bg-red-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ══ List ══ */}
      <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
        {loading && (
          <div className="text-center py-12">
            <RefreshCw size={24} className="animate-spin text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading error logs…</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={36} className="mx-auto mb-3 text-green-400" />
            <p className="font-bold text-slate-600">
              {filter === 'active' ? 'Koi active error nahi! 🎉' : filter === 'resolved' ? 'Koi resolved error nahi' : filter === 'ignored' ? 'Koi ignored error nahi' : 'Koi error nahi mili'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? `"${search}" ke liye koi result nahi` : activeFiltersCount > 0 ? 'Filters change karke try karo' : 'Sab thik lag raha hai'}
            </p>
          </div>
        )}

        {filtered.map(group => {
          const sev = SEV_COLORS[group.severity] || SEV_COLORS.medium;
          const isOpen = expanded === group.fingerprint;
          const key = safeKey(group.fingerprint);
          const resolution = resolutions[key];
          const isResolved = !!resolution;
          const isIgnored = ignoredKeys.has(key);
          const isResolvingThis = resolveTarget === group.fingerprint;
          const userCount = group.affectedUserIds.size;
          const latest = group.entries[0] as any;

          return (
            <div key={group.fingerprint} className={`border-l-4 ${sev.row} transition-all ${isResolved ? 'opacity-60' : ''} ${isIgnored ? 'opacity-40' : ''}`}>
              <div className={`p-3 ${sev.bg}`}>
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5 shrink-0">{TYPE_EMOJI[group.type] || '⚠️'}</span>

                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${sev.badge}`}>{group.severity}</span>
                      {group.autoCritical && (
                        <span className="text-[9px] font-black bg-rose-700 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <AlertOctagon size={8} /> AUTO
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400 font-mono">{group.type}</span>
                      {group.component && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                          <GitBranch size={9} /> {group.component}
                        </span>
                      )}
                      {latest?.appVersion && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          <Package size={8} /> v{latest.appVersion}
                        </span>
                      )}
                      {isResolved && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold border border-green-200">
                          <Tag size={9} /> v{resolution.resolvedInVersion}
                        </span>
                      )}
                      {isIgnored && (
                        <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">🙈 Ignored</span>
                      )}
                    </div>

                    {/* Error message */}
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{group.message}</p>

                    {/* Metrics */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        <BarChart2 size={9} /> {group.count}×
                      </span>
                      {userCount > 0 && (
                        <span className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${userCount >= 50 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
                          <Users size={9} /> {userCount} user{userCount > 1 ? 's' : ''}{userCount >= 50 ? ' 🚨' : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                        <Clock size={9} /> Last: {formatTime(group.lastSeen)}
                      </span>
                      {group.count > 1 && <span className="text-[9px] text-slate-400">First: {formatTime(group.firstSeen)}</span>}
                      {latest?.deviceModel && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                          <Smartphone size={9} /> {latest.deviceModel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <button onClick={() => setExpanded(isOpen ? null : group.fingerprint)}
                      className="text-[9px] text-slate-400 hover:text-slate-600 bg-white border border-slate-200 px-1.5 py-1 rounded-lg font-bold flex items-center gap-0.5">
                      {isOpen ? <><ChevronUp size={10} /> Less</> : <><ChevronDown size={10} /> More</>}
                    </button>
                    <button onClick={() => handleCopyGroup(group)} title="Copy error report"
                      className={`p-1 rounded-lg border transition-colors ${copiedKey === group.fingerprint ? 'bg-green-100 text-green-600 border-green-300' : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500 border-slate-200'}`}>
                      {copiedKey === group.fingerprint ? <CheckCircle size={12} /> : <Copy size={12} />}
                    </button>
                    <button onClick={() => handleDownloadGroup(group)} title="Download error report"
                      className="p-1 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500 border border-slate-200 transition-colors">
                      <Download size={12} />
                    </button>
                    {!isResolved ? (
                      <button onClick={() => { setResolveTarget(group.fingerprint); setResolveVersion(''); }}
                        title="Mark resolved" className="p-1 rounded-lg bg-green-50 text-green-500 hover:bg-green-100 border border-green-200 transition-colors">
                        <CheckCircle size={12} />
                      </button>
                    ) : (
                      <button onClick={() => handleUnresolve(group.fingerprint)} title="Unresolve"
                        className="p-1 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-200 transition-colors">
                        <RefreshCw size={12} />
                      </button>
                    )}
                    {!isIgnored ? (
                      <button onClick={() => handleIgnoreGroup(group)} title="Ignore"
                        className="p-1 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200 transition-colors">
                        <EyeOff size={12} />
                      </button>
                    ) : (
                      <button onClick={() => handleUnignoreGroup(group)} title="Unignore"
                        className="p-1 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-200 transition-colors">
                        <Shield size={12} />
                      </button>
                    )}
                    <button onClick={() => handleDeleteGroup(group)} title="Delete group"
                      className="p-1 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 border border-red-200 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Resolve input */}
                {isResolvingThis && (
                  <div className="mt-2 ml-6 flex items-center gap-2 bg-white border border-green-200 rounded-xl p-2">
                    <Tag size={12} className="text-green-500 shrink-0" />
                    <input autoFocus value={resolveVersion} onChange={e => setResolveVersion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleMarkResolved(group.fingerprint); if (e.key === 'Escape') setResolveTarget(null); }}
                      placeholder="Version number (e.g. 1.6.0)"
                      className="flex-1 text-xs outline-none text-slate-700" />
                    <button onClick={() => handleMarkResolved(group.fingerprint)}
                      disabled={resolveSaving || !resolveVersion.trim()}
                      className="text-[10px] font-black bg-green-600 text-white px-2 py-1 rounded-lg disabled:opacity-40 flex items-center gap-1">
                      {resolveSaving ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle size={10} />} Save
                    </button>
                    <button onClick={() => setResolveTarget(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* ══ Expanded: Full Professional Report ══ */}
                {isOpen && (
                  <div className="mt-3 ml-6 space-y-2">

                    {/* ── Full Error Report Card ── */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Card header */}
                      <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <AlertTriangle size={10} className="text-red-400" /> Error Report
                        </span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleCopyGroup(group)}
                            className="flex items-center gap-1 text-[9px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded font-bold transition-colors">
                            <Copy size={9} /> {copiedKey === group.fingerprint ? 'Copied!' : 'Copy'}
                          </button>
                          <button onClick={() => handleDownloadGroup(group)}
                            className="flex items-center gap-1 text-[9px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded font-bold transition-colors">
                            <Download size={9} /> Download
                          </button>
                        </div>
                      </div>

                      {/* Error message */}
                      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Error</p>
                        <p className="text-xs font-bold text-slate-800 leading-snug">{group.message}</p>
                      </div>

                      {/* 2-column info grid */}
                      <div className="grid grid-cols-2 divide-x divide-slate-100">
                        {/* App Info */}
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-[9px] font-black text-indigo-500 uppercase flex items-center gap-1 mb-1"><Package size={9}/> App Info</p>
                          {[
                            { label: 'Version',  value: latest?.appVersion  || '—' },
                            { label: 'Build',    value: latest?.buildNumber || '—' },
                            { label: 'Severity', value: group.severity.toUpperCase() + (group.autoCritical ? ' ⚡' : '') },
                            { label: 'Type',     value: group.type },
                            { label: 'Component',value: group.component || '—' },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between gap-2">
                              <span className="text-[9px] text-slate-400 font-bold shrink-0">{label}</span>
                              <span className="text-[9px] text-slate-700 font-mono text-right truncate">{value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Device Info */}
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 mb-1"><Cpu size={9}/> Device</p>
                          {[
                            { label: 'Model',   value: latest?.deviceModel || latest?.device || '—' },
                            { label: 'Android', value: latest?.osName ? `${latest.osName} ${latest.osVersion || ''}`.trim() : '—' },
                            { label: 'Browser', value: latest?.browserName ? `${latest.browserName} ${latest.browserVersion || ''}`.trim() : '—' },
                            { label: 'Type',    value: latest?.device || '—' },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between gap-2">
                              <span className="text-[9px] text-slate-400 font-bold shrink-0">{label}</span>
                              <span className="text-[9px] text-slate-700 font-mono text-right truncate">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Frequency + Users */}
                      <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-[9px] font-black text-orange-500 uppercase flex items-center gap-1 mb-1"><TrendingUp size={9}/> Frequency</p>
                          {[
                            { label: 'Occurrences', value: `${group.count}×` },
                            { label: 'Users Hit',   value: `${userCount}` },
                            { label: 'First Seen',  value: formatFull(group.firstSeen) },
                            { label: 'Last Seen',   value: formatFull(group.lastSeen) },
                            { label: 'Status',      value: isResolved ? `✅ Resolved v${resolution.resolvedInVersion}` : isIgnored ? '🙈 Ignored' : '🔴 Active' },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between gap-2">
                              <span className="text-[9px] text-slate-400 font-bold shrink-0">{label}</span>
                              <span className="text-[9px] text-slate-700 font-mono text-right">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-[9px] font-black text-indigo-500 uppercase flex items-center gap-1 mb-1"><Users size={9}/> Users</p>
                          {group.affectedUserNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {group.affectedUserNames.slice(0, 6).map(n => (
                                <span key={n} className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">{n}</span>
                              ))}
                              {userCount > group.affectedUserNames.length && (
                                <span className="text-[9px] text-slate-400">+{userCount - group.affectedUserNames.length} more</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-400">Anonymous users</p>
                          )}
                          <div className="mt-1">
                            <p className="text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1"><MapPin size={8}/> Routes</p>
                            <div className="flex flex-wrap gap-1">
                              {group.urls.filter(Boolean).map(u => (
                                <span key={u} className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded">{u || '/'}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stack Trace */}
                      {(group.entries[0]?.stack || group.entries[0]?.componentStack) && (
                        <div className="border-t border-slate-100 p-2.5 space-y-1.5">
                          {group.entries[0]?.stack && (
                            <div>
                              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Stack Trace</p>
                              <pre className="text-[8px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-auto max-h-24 whitespace-pre-wrap break-words">{group.entries[0].stack}</pre>
                            </div>
                          )}
                          {group.entries[0]?.componentStack && (
                            <div>
                              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Component Stack</p>
                              <pre className="text-[8px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-auto max-h-24 whitespace-pre-wrap break-words">{group.entries[0].componentStack}</pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resolution */}
                      {isResolved && (
                        <div className="border-t border-slate-100 bg-green-50 p-2.5 flex items-center gap-2">
                          <CheckCircle size={13} className="text-green-500 shrink-0" />
                          <div>
                            <p className="text-[9px] font-black text-green-700">Resolved in v{resolution.resolvedInVersion}</p>
                            <p className="text-[9px] text-green-600">{formatFull(resolution.resolvedAt)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Recent Occurrences ── */}
                    <details className="text-[9px]">
                      <summary className="text-slate-400 cursor-pointer hover:text-slate-600 font-bold flex items-center gap-1">
                        <Clock size={9} /> Recent {Math.min(5, group.entries.length)} occurrences
                      </summary>
                      <div className="mt-1 space-y-1">
                        {group.entries.slice(0, 5).map(e => {
                          const ea = e as any;
                          return (
                            <div key={e.id} className="bg-white border border-slate-100 rounded-xl px-2.5 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-0.5 text-slate-400">{DEVICE_ICON[e.device] || <Monitor size={10} />}</span>
                                <span className="text-slate-500 font-mono text-[9px]">{formatFull(e.timestamp)}</span>
                                {e.userName && <span className="text-indigo-700 font-black text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded-full">{e.userName}</span>}
                                {ea.appVersion && <span className="text-slate-600 font-bold text-[9px]">v{ea.appVersion}</span>}
                                {ea.buildNumber && <span className="text-slate-400 text-[9px]">#{ea.buildNumber}</span>}
                                {e.dismissed && <span className="text-green-500 font-bold text-[9px]">dismissed</span>}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1 pl-3">
                                {ea.deviceModel && <span className="text-[8px] text-amber-700 bg-amber-50 px-1 rounded font-bold">📱 {ea.deviceModel}</span>}
                                {ea.osName && <span className="text-[8px] text-blue-600 bg-blue-50 px-1 rounded">{ea.osName} {ea.osVersion}</span>}
                                {ea.browserName && <span className="text-[8px] text-purple-600 bg-purple-50 px-1 rounded">{ea.browserName} {ea.browserVersion}</span>}
                                {e.url && <span className="text-[8px] text-slate-500 bg-slate-100 px-1 rounded font-mono">{e.url}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>

                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
