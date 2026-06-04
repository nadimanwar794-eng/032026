import React, { useEffect, useMemo, useState } from 'react';
import { rtdb } from '../../firebase';
import { ref, onValue, update, remove, set, get, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
import { AlertTriangle, ArrowLeft, RefreshCw, Trash2, CheckCircle, Clock, Monitor, Smartphone, Tablet, X, Search, GitBranch, Users, BarChart2, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { AppError } from '../../utils/errorLogger';

interface Props {
  onBack: () => void;
}

interface ErrorResolution {
  resolvedInVersion: string;
  resolvedAt: number;
}

interface ErrorGroup {
  fingerprint: string;
  message: string;
  severity: AppError['severity'];
  type: AppError['type'];
  component?: string;
  urls: string[];
  count: number;
  affectedUserIds: Set<string>;
  affectedUserNames: string[];
  firstSeen: number;
  lastSeen: number;
  entries: Array<AppError & { id: string }>;
  dismissed: boolean;
}

const SEV_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; row: string }> = {
  low:      { bg: 'bg-slate-50',   border: 'border-slate-200',  text: 'text-slate-600',  badge: 'bg-slate-100 text-slate-500',  row: 'border-l-slate-300' },
  medium:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  row: 'border-l-amber-400' },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', row: 'border-l-orange-500' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      row: 'border-l-red-500' },
};

const TYPE_EMOJI: Record<string, string> = {
  react: '⚛️', runtime: '💥', promise: '🔮', network: '🌐', manual: '📋'
};
const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const DEVICE_ICON: Record<string, React.ReactNode> = {
  mobile: <Smartphone size={10} />,
  tablet: <Tablet size={10} />,
  desktop: <Monitor size={10} />,
};

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getFingerprint(msg: string): string {
  return msg.slice(0, 90).replace(/\s+/g, ' ').trim();
}

function safeKey(fingerprint: string): string {
  return btoa(encodeURIComponent(fingerprint)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
}

export const ErrorNoticeBoard: React.FC<Props> = ({ onBack }) => {
  const [errors, setErrors] = useState<Array<AppError & { id: string }>>([]);
  const [resolutions, setResolutions] = useState<Record<string, ErrorResolution>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'critical' | 'resolved'>('active');
  const [search, setSearch] = useState('');
  const [componentFilter, setComponentFilter] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveVersion, setResolveVersion] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);

  useEffect(() => {
    const q = rtdbQuery(ref(rtdb, 'error_logs'), orderByChild('timestamp'), limitToLast(300));
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

  const groups = useMemo<ErrorGroup[]>(() => {
    const map = new Map<string, ErrorGroup>();
    for (const err of errors) {
      const fp = getFingerprint(err.message);
      const existing = map.get(fp);
      const comp = err.component || (err.componentStack
        ? err.componentStack.match(/\bat\s+([A-Z]\w+)/)?.[1]
        : undefined)
        || (err.url?.split('/').pop() || undefined);

      if (existing) {
        existing.count++;
        if (err.userId) {
          existing.affectedUserIds.add(err.userId);
          if (err.userName && !existing.affectedUserNames.includes(err.userName)) {
            existing.affectedUserNames.push(err.userName);
          }
        }
        if (!existing.urls.includes(err.url)) existing.urls.push(err.url);
        if (err.timestamp < existing.firstSeen) existing.firstSeen = err.timestamp;
        if (err.timestamp > existing.lastSeen) existing.lastSeen = err.timestamp;
        if (SEV_RANK[err.severity] > SEV_RANK[existing.severity]) existing.severity = err.severity;
        existing.entries.push(err);
        if (!err.dismissed) existing.dismissed = false;
      } else {
        map.set(fp, {
          fingerprint: fp,
          message: err.message,
          severity: err.severity,
          type: err.type,
          component: comp,
          urls: [err.url],
          count: 1,
          affectedUserIds: new Set(err.userId ? [err.userId] : []),
          affectedUserNames: err.userName ? [err.userName] : [],
          firstSeen: err.timestamp,
          lastSeen: err.timestamp,
          entries: [err],
          dismissed: !!err.dismissed,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [errors]);

  const allComponents = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) { if (g.component) set.add(g.component); }
    return Array.from(set).sort();
  }, [groups]);

  const filtered = useMemo(() => {
    return groups.filter(g => {
      const key = safeKey(g.fingerprint);
      const isResolved = !!resolutions[key];
      if (filter === 'active' && (g.dismissed || isResolved)) return false;
      if (filter === 'critical' && g.severity !== 'critical' && g.severity !== 'high') return false;
      if (filter === 'resolved' && !isResolved) return false;
      if (componentFilter !== 'ALL' && g.component !== componentFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!g.message.toLowerCase().includes(q) && !(g.component || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [groups, filter, componentFilter, search, resolutions]);

  const handleDismissGroup = async (g: ErrorGroup) => {
    await Promise.all(g.entries.filter(e => !e.dismissed).map(e =>
      update(ref(rtdb, `error_logs/${e.id}`), { dismissed: true }).catch(() => {})
    ));
  };

  const handleDeleteGroup = async (g: ErrorGroup) => {
    if (!window.confirm(`"${g.message.slice(0, 60)}…" — ${g.count} entries delete honge. Confirm?`)) return;
    await Promise.all(g.entries.map(e => remove(ref(rtdb, `error_logs/${e.id}`)).catch(() => {})));
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
      resolvedInVersion: resolveVersion.trim(),
      resolvedAt: Date.now(),
    }).catch(() => {});
    setResolveSaving(false);
    setResolveTarget(null);
    setResolveVersion('');
  };

  const handleUnresolve = async (fingerprint: string) => {
    const key = safeKey(fingerprint);
    await remove(ref(rtdb, `error_resolutions/${key}`)).catch(() => {});
  };

  const totalGroups = groups.length;
  const activeGroups = groups.filter(g => !g.dismissed && !resolutions[safeKey(g.fingerprint)]).length;
  const criticalGroups = groups.filter(g => g.severity === 'critical' || g.severity === 'high').length;
  const resolvedGroups = groups.filter(g => !!resolutions[safeKey(g.fingerprint)]).length;
  const totalAffectedUsers = new Set(errors.filter(e => e.userId).map(e => e.userId!)).size;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ── Header ── */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-50 text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <h2 className="font-black text-slate-800">Error Notice Board</h2>
                {activeGroups > 0 && (
                  <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                    {activeGroups} ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Grouped by error type — frequency, users, resolution tracking</p>
            </div>
          </div>
          <button onClick={handleClearAll} disabled={clearing || errors.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors">
            {clearing ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Clear All
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Error Groups', count: totalGroups, color: 'text-slate-700', icon: '🗂️' },
            { label: 'Active', count: activeGroups, color: 'text-red-600', icon: '🔴' },
            { label: 'Critical/High', count: criticalGroups, color: 'text-orange-600', icon: '🔥' },
            { label: 'Resolved', count: resolvedGroups, color: 'text-green-600', icon: '✅' },
            { label: 'Affected Users', count: totalAffectedUsers, color: 'text-indigo-600', icon: '👥' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-2 text-center shadow-sm border border-slate-100">
              <p className="text-base">{s.icon}</p>
              <p className={`text-base font-black leading-tight ${s.color}`}>{s.count}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + Component Filter ── */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Error message search karo…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-red-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        {allComponents.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><GitBranch size={10} /> Component:</span>
            {(['ALL', ...allComponents]).map(c => (
              <button
                key={c}
                onClick={() => setComponentFilter(c)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${componentFilter === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex border-b border-slate-100 bg-white">
        {([
          { key: 'active', label: `Active (${activeGroups})` },
          { key: 'critical', label: `Critical (${criticalGroups})` },
          { key: 'resolved', label: `Resolved (${resolvedGroups})` },
          { key: 'all', label: `All (${totalGroups})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${filter === f.key ? 'text-red-600 border-b-2 border-red-500 bg-red-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto">
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
              {filter === 'active' ? 'Koi active error nahi! 🎉' : filter === 'resolved' ? 'Koi resolved error nahi' : 'Koi error nahi mili'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? `"${search}" ke liye koi result nahi` : 'Sab thik lag raha hai'}
            </p>
          </div>
        )}

        {filtered.map(group => {
          const sev = SEV_COLORS[group.severity] || SEV_COLORS.medium;
          const isOpen = expanded === group.fingerprint;
          const key = safeKey(group.fingerprint);
          const resolution = resolutions[key];
          const isResolved = !!resolution;
          const isResolvingThis = resolveTarget === group.fingerprint;
          const userCount = group.affectedUserIds.size;

          return (
            <div key={group.fingerprint} className={`border-l-4 ${sev.row} transition-all ${isResolved ? 'opacity-60' : ''}`}>
              <div className={`p-3 ${sev.bg}`}>
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5 shrink-0">{TYPE_EMOJI[group.type] || '⚠️'}</span>

                  <div className="flex-1 min-w-0">
                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${sev.badge}`}>{group.severity}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{group.type}</span>
                      {group.component && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                          <GitBranch size={9} /> {group.component}
                        </span>
                      )}
                      {isResolved && (
                        <span className="flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold border border-green-200">
                          <Tag size={9} /> v{resolution.resolvedInVersion}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{group.message}</p>

                    {/* Metrics row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* Frequency */}
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        <BarChart2 size={9} /> {group.count}× occurrences
                      </span>
                      {/* Affected users */}
                      {userCount > 0 && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                          <Users size={9} /> {userCount} user{userCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {/* Time */}
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                        <Clock size={9} /> Last: {formatTime(group.lastSeen)}
                      </span>
                      {group.count > 1 && (
                        <span className="text-[9px] text-slate-400">First: {formatTime(group.firstSeen)}</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : group.fingerprint)}
                      className="text-[9px] text-slate-400 hover:text-slate-600 bg-white border border-slate-200 px-1.5 py-1 rounded-lg font-bold flex items-center gap-0.5">
                      {isOpen ? <><ChevronUp size={10} /> Less</> : <><ChevronDown size={10} /> More</>}
                    </button>
                    {!isResolved ? (
                      <button
                        onClick={() => { setResolveTarget(group.fingerprint); setResolveVersion(''); }}
                        title="Mark resolved"
                        className="p-1 rounded-lg bg-green-50 text-green-500 hover:bg-green-100 border border-green-200 transition-colors">
                        <CheckCircle size={12} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnresolve(group.fingerprint)}
                        title="Unresolve"
                        className="p-1 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-200 transition-colors">
                        <RefreshCw size={12} />
                      </button>
                    )}
                    <button onClick={() => handleDismissGroup(group)} title="Dismiss all"
                      className="p-1 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200 transition-colors">
                      <X size={12} />
                    </button>
                    <button onClick={() => handleDeleteGroup(group)} title="Delete group"
                      className="p-1 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 border border-red-200 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* ── Resolve input inline ── */}
                {isResolvingThis && (
                  <div className="mt-2 ml-6 flex items-center gap-2 bg-white border border-green-200 rounded-xl p-2">
                    <Tag size={12} className="text-green-500 shrink-0" />
                    <input
                      autoFocus
                      value={resolveVersion}
                      onChange={e => setResolveVersion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleMarkResolved(group.fingerprint); if (e.key === 'Escape') setResolveTarget(null); }}
                      placeholder="Version number (e.g. 1.2.3)"
                      className="flex-1 text-xs outline-none text-slate-700"
                    />
                    <button
                      onClick={() => handleMarkResolved(group.fingerprint)}
                      disabled={resolveSaving || !resolveVersion.trim()}
                      className="text-[10px] font-black bg-green-600 text-white px-2 py-1 rounded-lg disabled:opacity-40 flex items-center gap-1">
                      {resolveSaving ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle size={10} />} Save
                    </button>
                    <button onClick={() => setResolveTarget(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div className="mt-2 ml-6 space-y-2">

                    {/* Affected users list */}
                    {group.affectedUserNames.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 p-2">
                        <p className="text-[9px] font-black text-indigo-500 uppercase mb-1 flex items-center gap-1"><Users size={9} /> Affected Users</p>
                        <div className="flex flex-wrap gap-1">
                          {group.affectedUserNames.map(n => (
                            <span key={n} className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">{n}</span>
                          ))}
                          {userCount > group.affectedUserNames.length && (
                            <span className="text-[9px] text-slate-400">+{userCount - group.affectedUserNames.length} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* URLs where it occurred */}
                    {group.urls.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 mb-0.5">Occurred on routes:</p>
                        <div className="flex flex-wrap gap-1">
                          {group.urls.filter(Boolean).map(u => (
                            <span key={u} className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{u || '/'}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Latest entry stack trace */}
                    {group.entries[0]?.stack && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 mb-0.5">Latest Stack Trace:</p>
                        <pre className="text-[8px] font-mono text-slate-600 bg-white border border-slate-200 rounded-lg p-2 overflow-auto max-h-24 whitespace-pre-wrap break-words">{group.entries[0].stack}</pre>
                      </div>
                    )}
                    {group.entries[0]?.componentStack && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 mb-0.5">Component Stack:</p>
                        <pre className="text-[8px] font-mono text-slate-600 bg-white border border-slate-200 rounded-lg p-2 overflow-auto max-h-24 whitespace-pre-wrap break-words">{group.entries[0].componentStack}</pre>
                      </div>
                    )}

                    {/* Resolution info */}
                    {isResolved && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-2 flex items-center gap-2">
                        <CheckCircle size={13} className="text-green-500 shrink-0" />
                        <div>
                          <p className="text-[9px] font-black text-green-700">Resolved in v{resolution.resolvedInVersion}</p>
                          <p className="text-[9px] text-green-600">{formatTime(resolution.resolvedAt)}</p>
                        </div>
                      </div>
                    )}

                    {/* Recent occurrences */}
                    <details className="text-[9px]">
                      <summary className="text-slate-400 cursor-pointer hover:text-slate-600 font-bold">
                        Recent {Math.min(5, group.entries.length)} occurrences
                      </summary>
                      <div className="mt-1 space-y-1">
                        {group.entries.slice(0, 5).map(e => (
                          <div key={e.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-2 py-1">
                            <span className="flex items-center gap-0.5 text-slate-400">{DEVICE_ICON[e.device] || <Monitor size={10} />}</span>
                            <span className="text-slate-500 font-mono">{formatTime(e.timestamp)}</span>
                            {e.userName && <span className="text-slate-600 font-bold">{e.userName}</span>}
                            {e.dismissed && <span className="text-green-500 font-bold">✓</span>}
                          </div>
                        ))}
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
