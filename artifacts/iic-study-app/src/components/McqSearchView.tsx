/**
 * McqSearchView.tsx
 * Full-screen MCQ search, browse, and download.
 * - Search bar drives `searchMcqsByWords`
 * - Results grouped by book / topic
 * - Correct answer highlighted; explanation shown on expand
 * - Download visible MCQs as text
 * - Tier limit: admin controls via settings.featureConfig.MCQ_SEARCH.limits
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  X, Search, Download, ChevronDown, ChevronUp, CheckCircle, Circle,
  FileQuestion, Lock, Trophy, BookOpen, Loader2, ChevronRight,
} from 'lucide-react';
import type { McqSearchHit } from '../utils/mcqSearcher';

interface Props {
  initialQuery?: string;
  initialHits?: McqSearchHit[];
  onClose: () => void;
  user?: { subscriptionLevel?: string; isPremium?: boolean };
  settings?: Record<string, any>;
}

function getTierLimit(settings?: Record<string, any>, level?: string): number {
  const cfg = settings?.featureConfig?.MCQ_SEARCH?.limits;
  if (level === 'ULTRA') return cfg?.ultra ?? 9999;
  if (level === 'BASIC') return cfg?.basic ?? 20;
  return cfg?.free ?? 8;
}

function groupByBook(hits: McqSearchHit[]): { key: string; label: string; hits: McqSearchHit[] }[] {
  const map = new Map<string, { label: string; hits: McqSearchHit[] }>();
  for (const h of hits) {
    const key = `${h.bookName}__${h.classLevel}`;
    if (!map.has(key)) {
      const classInfo = h.classLevel === 'COMPETITION' ? '🏆 Competition' : `Class ${h.classLevel}`;
      map.set(key, { label: `${h.bookName} · ${classInfo}`, hits: [] });
    }
    map.get(key)!.hits.push(h);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const McqCard: React.FC<{ hit: McqSearchHit; idx: number }> = ({ hit, idx }) => {
  const [revealed, setRevealed] = useState(false);
  const [showExp, setShowExp] = useState(false);
  return (
    <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Question */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-black text-orange-500 bg-orange-50 rounded-full px-1.5 py-0.5 shrink-0 mt-0.5">Q{idx + 1}</span>
          <p className="text-sm font-bold text-slate-800 leading-snug flex-1">{hit.question}</p>
        </div>
      </div>
      {/* Options */}
      <div className="px-4 pb-2 space-y-1">
        {hit.options.map((opt, oi) => {
          const isCorrect = oi === hit.correctAnswer;
          return (
            <div
              key={oi}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all ${
                revealed && isCorrect
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold'
                  : 'bg-slate-50 border border-slate-100 text-slate-700'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${revealed && isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {OPTION_LETTERS[oi]}
              </span>
              <span className="flex-1">{opt}</span>
              {revealed && isCorrect && <CheckCircle size={13} className="text-emerald-600 shrink-0" />}
            </div>
          );
        })}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={() => setRevealed(r => !r)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
            revealed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-600'
          }`}
        >
          {revealed ? <CheckCircle size={12} /> : <Circle size={12} />}
          {revealed ? 'Answer shown' : 'Show Answer'}
        </button>
        {hit.explanation && (
          <button
            onClick={() => setShowExp(s => !s)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
          >
            {showExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Explanation
          </button>
        )}
      </div>
      {showExp && hit.explanation && (
        <div className="px-4 pb-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <p className="text-[11px] text-blue-800 leading-relaxed">{hit.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const McqSearchView: React.FC<Props> = ({ initialQuery = '', initialHits = [], onClose, user, settings }) => {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<McqSearchHit[]>(initialHits);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(initialHits.length > 0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const subLevel = user?.isPremium ? (user.subscriptionLevel ?? 'FREE') : 'FREE';
  const limit = getTierLimit(settings, subLevel);
  const isUltra = subLevel === 'ULTRA';

  const visibleHits = isUltra ? hits : hits.slice(0, limit);
  const hiddenCount = hits.length - visibleHits.length;
  const groups = useMemo(() => groupByBook(visibleHits), [visibleHits]);

  // Auto-expand all groups when results come in
  React.useEffect(() => {
    if (groups.length > 0) {
      setExpandedGroups(new Set(groups.map(g => g.key)));
    }
  }, [groups.length]);

  const doSearch = useCallback(async (q: string) => {
    const words = q.trim().split(/\s+/).filter(w => w.length >= 2);
    if (!words.length) { setHits([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const mod = await import('../utils/mcqSearcher');
      const results = await mod.searchMcqsByWords(words, 100);
      setHits(results);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownload = () => {
    if (visibleHits.length === 0) return;
    const savedOn = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const safeQuery = query.replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]||c));
    let counter = 1;
    const groupsHtml = groups.map(g => {
      const mcqRows = g.hits.map(h => {
        const qText = h.question.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]||c));
        const optRows = h.options.map((o, oi) => {
          const isCorrect = oi === h.correctAnswer;
          const oText = o.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]||c));
          return `<div style="padding:4px 0 4px 16px;color:${isCorrect?'#16a34a':'#374151'};font-weight:${isCorrect?'700':'400'};">${OPTION_LETTERS[oi]}) ${oText}${isCorrect?' ✓':''}</div>`;
        }).join('');
        const exp = h.explanation ? `<div style="margin-top:6px;padding:8px 12px;background:#fefce8;border-left:3px solid #eab308;border-radius:6px;font-size:12px;color:#713f12;">💡 ${h.explanation.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]||c))}</div>` : '';
        const num = counter++;
        return `<div style="margin-bottom:16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><div style="font-weight:700;margin-bottom:8px;color:#1e293b;">Q${num}. ${qText}</div>${optRows}${exp}</div>`;
      }).join('');
      return `<div style="margin-bottom:24px;"><h3 style="font-size:14px;font-weight:800;color:#ea580c;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #fed7aa;">📚 ${g.label.replace(/[<>&]/g,'?')}</h3>${mcqRows}</div>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IIC · MCQ: ${safeQuery}</title>
  <style>
    body { margin:0; padding:0; font-family: 'Segoe UI', system-ui, sans-serif; background:#f1f5f9; color:#0f172a; font-size:14px; }
    .topbar { background:linear-gradient(135deg,#ea580c,#d97706); color:#fff; padding:14px 20px; display:flex; align-items:center; gap:14px; position:sticky; top:0; z-index:50; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
    .logo { width:40px; height:40px; border-radius:12px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:18px; }
    .title-block { flex:1; }
    .app-label { font-size:11px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; opacity:.8; margin:0; }
    .page-title { font-size:16px; font-weight:800; margin:2px 0 0; }
    .badge { font-size:10px; font-weight:800; text-transform:uppercase; background:rgba(0,0,0,0.2); padding:4px 10px; border-radius:999px; }
    .subhead { background:#fff; border-bottom:1px solid #e2e8f0; padding:10px 20px; font-size:12px; color:#64748b; display:flex; justify-content:space-between; }
    .main { padding:20px; display:flex; justify-content:center; }
    .card { background:#fff; width:100%; max-width:900px; border:1px solid #e2e8f0; border-radius:18px; box-shadow:0 10px 30px -10px rgba(0,0,0,0.12); padding:24px; }
    .footer { padding:18px 20px 26px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0; background:#fff; }
    @media print { .topbar { position:static; } }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="logo">IIC</div>
    <div class="title-block">
      <p class="app-label">IIC</p>
      <h1 class="page-title">MCQ Search: ${safeQuery}</h1>
    </div>
    <span class="badge">${visibleHits.length} MCQs</span>
  </div>
  <div class="subhead"><span>Search results for "${safeQuery}"</span><span>Saved on ${savedOn}</span></div>
  <div class="main"><div class="card">${groupsHtml}</div></div>
  <div class="footer">Saved from <strong>IIC</strong> — MCQ Search.<br/>This is a static snapshot for offline reading.</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcq_search_${query.replace(/\s+/g, '_').slice(0, 40)}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow-lg">
        <div className="p-2 rounded-xl bg-white/20">
          <FileQuestion size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-base leading-tight">MCQ Search</h2>
          <p className="text-[11px] text-orange-100">
            {searched ? (loading ? 'Dhundh raha hai...' : `${hits.length} MCQ mila`) : 'Class 6–12 + Competition'}
          </p>
        </div>
        {visibleHits.length > 0 && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
          >
            <Download size={13} /> Download
          </button>
        )}
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors shrink-0">
          <X size={20} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            placeholder="MCQ search karein — topic, subject, question..."
            className="w-full pl-9 pr-20 py-2.5 text-sm border border-orange-200 rounded-xl bg-orange-50/40 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 placeholder:text-slate-400"
          />
          <button
            onClick={() => doSearch(query)}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Tier info */}
      {!isUltra && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 border-b border-orange-100 shrink-0">
          <span className="text-[10px] font-bold text-orange-600">{subLevel}: {limit} MCQ limit</span>
          {hiddenCount > 0 && <span className="text-[10px] text-slate-400">{hiddenCount} aur locked hain</span>}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6 px-3 pt-2">

        {/* Empty / initial state */}
        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
              <FileQuestion size={28} className="text-orange-500" />
            </div>
            <p className="text-base font-black text-slate-700 mb-1">MCQ Search</p>
            <p className="text-sm text-slate-400">Koi topic ya word type karein aur Search dabayein</p>
            <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><BookOpen size={12} /> Class 6–12</span>
              <span className="flex items-center gap-1"><Trophy size={12} /> Competition</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={28} className="text-orange-500 animate-spin mb-3" />
            <p className="text-sm text-slate-400">MCQs dhundh raha hai...</p>
          </div>
        )}

        {/* No results */}
        {searched && !loading && hits.length === 0 && (
          <div className="text-center py-12">
            <FileQuestion size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">Koi MCQ nahi mila</p>
            <p className="text-xs text-slate-400 mt-1">Dusra keyword try karein</p>
          </div>
        )}

        {/* Results grouped by book */}
        {!loading && groups.map((g) => {
          const isOpen = expandedGroups.has(g.key);
          let counter = 0;
          groups.forEach(gr => {
            if (gr.key === g.key) return;
            if (groups.indexOf(gr) < groups.indexOf(g)) counter += gr.hits.length;
          });
          return (
            <div key={g.key} className="mb-3">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(g.key)}
                className="w-full flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-left mb-1.5"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  {g.label.includes('Competition') ? <Trophy size={12} className="text-white" /> : <BookOpen size={12} className="text-white" />}
                </div>
                <span className="flex-1 text-xs font-black text-slate-700 truncate">{g.label}</span>
                <span className="text-[10px] font-bold text-orange-500">{g.hits.length} MCQ</span>
                {isOpen ? <ChevronUp size={13} className="text-orange-400 shrink-0" /> : <ChevronDown size={13} className="text-orange-400 shrink-0" />}
              </button>

              {/* MCQ cards */}
              {isOpen && (
                <div className="space-y-2 pl-1">
                  {g.hits.map((hit, hi) => (
                    <McqCard key={`${hit.storageKey}_${hi}`} hit={hit} idx={counter + hi} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Tier lock message */}
        {hiddenCount > 0 && !loading && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mt-2">
            <Lock size={18} className="text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800">{hiddenCount} aur MCQ locked hain</p>
              <p className="text-[10px] text-slate-500">
                {subLevel === 'BASIC' ? 'Ultra plan mein upgrade karein unlimited MCQ ke liye' : 'Basic ya Ultra plan mein upgrade karein'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
