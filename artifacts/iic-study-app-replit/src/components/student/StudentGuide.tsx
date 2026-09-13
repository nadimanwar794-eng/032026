import React, { useState, useMemo } from "react";
import { SystemSettings } from "../../types";
import { getStudentGuideData } from "../../utils/studentDocumentation";
import {
  BookOpen,
  HelpCircle,
  GraduationCap,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  ClipboardList,
  Bot,
  Trophy,
  Coins,
  Lightbulb,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface Props {
  settings?: SystemSettings;
  onClose: () => void;
}

const CATEGORY_ICONS = [BookOpen, ClipboardList, Bot, Trophy, HelpCircle];
const CATEGORY_ITEM_COUNTS = (items: any[]) => items.length;

function getCostStyle(cost: string, details: string) {
  const c = cost.toLowerCase();
  const d = details.toLowerCase();
  if (c.includes("limit") || d.includes("daily limit") || d.includes("subject to daily") || d.includes("limits")) {
    return { bg: "bg-red-500/25 text-red-200 border border-red-400/30", icon: <AlertCircle size={9} className="shrink-0" />, label: cost };
  }
  if (c.includes("earn") || d.includes("earn coin") || d.includes("bonus") || d.includes("rewards") || c.includes("reward")) {
    return { bg: "bg-emerald-500/25 text-emerald-200 border border-emerald-400/30", icon: <Lightbulb size={9} className="shrink-0" />, label: cost };
  }
  if (c.includes("free") && !c.includes("limit")) {
    return { bg: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/25", icon: <CheckCircle size={9} className="shrink-0" />, label: cost };
  }
  if (c.includes("coin") || c.includes("₹") || c.includes("cr")) {
    return { bg: "bg-amber-500/20 text-amber-200 border border-amber-400/25", icon: <Coins size={9} className="shrink-0" />, label: cost };
  }
  return { bg: "bg-white/15 text-white/80 border border-white/15", icon: null, label: cost };
}

export const StudentGuide: React.FC<Props> = ({ settings, onClose }) => {
  const data = getStudentGuideData(settings);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const totalItems = useMemo(
    () => data.features.reduce((sum, f) => sum + f.items.length, 0) + data.faq.length,
    [data]
  );

  const filteredFeatures = useMemo(() => {
    if (!query.trim()) return data.features;
    const q = query.toLowerCase();
    return data.features
      .map((f) => ({
        ...f,
        items: f.items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            it.details.toLowerCase().includes(q) ||
            it.cost.toLowerCase().includes(q)
        ),
      }))
      .filter((f) => f.items.length > 0 || f.title.toLowerCase().includes(q));
  }, [query, data]);

  const filteredFaq = useMemo(() => {
    if (!query.trim()) return data.faq;
    const q = query.toLowerCase();
    return data.faq.filter(
      (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
    );
  }, [query, data]);

  return (
    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md max-h-[94vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl">

        {/* ── HEADER: Ultra top bar style (dark slate) ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-5 py-4 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white" />
            <div className="absolute bottom-0 left-0 w-24 h-16 rounded-full bg-cyan-400 blur-xl" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <GraduationCap size={20} className="text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-white text-base leading-tight">Student Help Guide</h2>
              <p className="text-slate-400 text-[11px] font-medium mt-0.5">
                Har feature ki poori jaankaari — {totalItems} topics covered
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Overview strip */}
          <div className="relative mt-3 bg-white/8 rounded-xl p-3 border border-white/10">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              App ke <span className="font-black text-white">saare features, buttons aur sections</span> ka poora
              explanation — Credits se lekar AI tak, sab kuch samjhein.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setExpandedIdx(null); setExpandedFaq(null); }}
              placeholder="Koi bhi feature search karo... (e.g. coins, MCQ, streak)"
              className="w-full pl-8 pr-3 py-2 bg-white/10 border border-white/15 rounded-xl text-[12px] text-white placeholder:text-slate-500 font-medium outline-none focus:border-sky-500/50 focus:bg-white/15 transition"
            />
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto bg-slate-950">

          {/* Feature categories */}
          {filteredFeatures.length === 0 && filteredFaq.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Search size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm">Koi result nahi mila</p>
              <p className="text-xs mt-1">Alag keyword try karein</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {filteredFeatures.map((feat, idx) => {
                const Icon = CATEGORY_ICONS[idx % CATEGORY_ICONS.length];
                const isOpen = expandedIdx === idx;
                return (
                  <div key={idx} className="rounded-2xl overflow-hidden shadow-md">
                    {/* Collapsed button: Ultra top bar color (dark slate) */}
                    <button
                      onClick={() => setExpandedIdx(isOpen ? null : idx)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 text-left active:brightness-110 transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-sky-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-sm leading-tight">{feat.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug line-clamp-1">{feat.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded-full">
                          {CATEGORY_ITEM_COUNTS(feat.items)}
                        </span>
                        {isOpen
                          ? <ChevronDown size={15} className="text-sky-400" />
                          : <ChevronRight size={15} className="text-slate-400" />
                        }
                      </div>
                    </button>

                    {/* Expanded items: Free top bar color (sky/cyan) */}
                    {isOpen && (
                      <div className="bg-gradient-to-b from-sky-500 to-cyan-600 border-l border-r border-b border-sky-600/50 animate-in slide-in-from-top-1 duration-150">
                        {feat.items.map((item, i) => {
                          const costStyle = getCostStyle(item.cost, item.details);
                          return (
                            <div key={i} className={`px-4 py-3 ${i < feat.items.length - 1 ? 'border-b border-white/15' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-black text-white text-sm leading-tight flex-1 min-w-0">{item.name}</p>
                                <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${costStyle.bg}`}>
                                  {costStyle.icon}{costStyle.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/80 font-medium mt-1 leading-relaxed">{item.details}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* FAQ section */}
              {filteredFaq.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-md mt-2">
                  <div className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700">
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                      <HelpCircle size={16} className="text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm">Help / FAQ</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">Common sawaal aur unke jawab</p>
                    </div>
                    <span className="text-[9px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded-full">
                      {filteredFaq.length}
                    </span>
                  </div>

                  {filteredFaq.map((item, i) => {
                    const isOpen = expandedFaq === i;
                    return (
                      <div key={i} className={`${i < filteredFaq.length - 1 || isOpen ? 'border-b border-slate-700/50' : ''}`}>
                        <button
                          onClick={() => setExpandedFaq(isOpen ? null : i)}
                          className="w-full flex items-start gap-3 px-4 py-3 bg-slate-900/80 text-left"
                        >
                          <p className="flex-1 text-[12px] font-bold text-slate-200 leading-snug">{item.q}</p>
                          <span className="shrink-0 mt-0.5">
                            {isOpen
                              ? <ChevronDown size={14} className="text-sky-400" />
                              : <ChevronRight size={14} className="text-slate-500" />
                            }
                          </span>
                        </button>
                        {isOpen && (
                          <div className="bg-gradient-to-b from-sky-500 to-cyan-600 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
                            <p className="text-[12px] text-white/90 font-medium leading-relaxed">{item.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer tip */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg shrink-0">💬</span>
                <p className="text-[11px] text-slate-400 font-medium leading-snug">
                  Aur koi sawaal ho? Chat → Support mein admin ko seedha message karo — woh help karenge.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER: Close button (Ultra top bar style) ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700 px-4 py-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500 text-white font-black text-sm active:scale-95 transition-all shadow-lg shadow-sky-900/40"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
