// @ts-nocheck
import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, Clock, Sparkles, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';
import { useAppTheme } from '../utils/themeContext';
import type { RoutineCategory, RoutineCategorySubject } from '../utils/routineStorage';

interface SevenDayRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: RoutineCategory[];
  allNotes: any[];
  studyMode?: 'CREDIT' | 'WITHOUT_CREDIT';
}

export const SevenDayRoutineModal: React.FC<SevenDayRoutineModalProps> = ({
  isOpen,
  onClose,
  categories = [],
  allNotes = [],
  studyMode = 'WITHOUT_CREDIT',
}) => {
  const theme = useAppTheme();
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('nsta-modal-open');
      window.dispatchEvent(new CustomEvent('nsta-modal-visibility-change', { detail: { open: true } }));
      return () => {
        setTimeout(() => {
          const remaining = document.querySelectorAll('[role="dialog"], [data-modal="true"], .iic-modal-overlay');
          if (remaining.length === 0) {
            document.body.classList.remove('nsta-modal-open');
            window.dispatchEvent(new CustomEvent('nsta-modal-visibility-change', { detail: { open: false } }));
          }
        }, 10);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dayNames = ['Aaj (Day 1)', 'Kal (Day 2)', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  // Helper to get notes for a subject
  const getSubjectNotes = (sub: RoutineCategorySubject) => {
    return allNotes.filter((n: any) => {
      const s = (n.subject || 'other').toLowerCase().trim();
      const targetSub = (sub.subjectId || '').toLowerCase().trim();
      if (s !== targetSub) return false;
      if (sub.bookName && n.bookName && n.bookName.trim() !== sub.bookName.trim()) return false;
      if (sub.classLevel && n.classLevel && String(n.classLevel) !== String(sub.classLevel)) return false;
      return true;
    });
  };

  // Build projected schedule for 7 days
  const scheduleByDay = Array.from({ length: 7 }, (_, dayIdx) => {
    const slots = categories.map((cat, catIdx) => {
      const subjects = cat.subjects || [];
      if (!subjects.length) return null;
      const subIdx = (cat.currentSubjectIndex || 0) % subjects.length;
      const sub = subjects[subIdx];
      const notes = getSubjectNotes(sub);
      const total = notes.length;
      const baseIdx = sub.currentLessonIndex || 0;
      const projectedIdx = total > 0 ? (baseIdx + dayIdx) % total : 0;
      const note = notes[projectedIdx];

      return {
        slotNumber: catIdx + 1,
        categoryName: cat.categoryName,
        emoji: cat.emoji || '📚',
        subjectName: sub.displayName || sub.subjectId,
        chapterTitle: note?.lessonTitle || `Chapter ${projectedIdx + 1}`,
        pageCount: Array.isArray(note?.pages) ? note.pages.length : (note?.pageCount || 1),
        isToday: dayIdx === 0,
      };
    }).filter(Boolean);

    return {
      dayIdx,
      dayLabel: dayNames[dayIdx],
      slots,
    };
  });

  const activeDay = scheduleByDay[selectedDayOffset] || scheduleByDay[0];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fadeIn iic-modal-overlay"
      role="dialog"
      aria-modal="true"
      data-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[85vh] overflow-hidden border"
        style={{ borderColor: `${theme.primary}30` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: `${theme.primary}15` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg" style={{ background: `${theme.primary}15`, color: theme.primary }}>
              📅
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                7-Day Study Timetable
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  style={{
                    background: studyMode === 'WITHOUT_CREDIT' ? '#ecfdf5' : '#eff6ff',
                    color: studyMode === 'WITHOUT_CREDIT' ? '#059669' : '#2563eb',
                  }}>
                  {studyMode === 'WITHOUT_CREDIT' ? '🎓 0 Credits' : '💰 Credit Mode'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Har din kaun sa chapter milega</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-90"
          >
            <X size={17} />
          </button>
        </div>

        {/* Rule Banner */}
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-amber-900 shrink-0">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight font-medium">
            <span className="font-black text-amber-800">📌 Daily 1 Full Chapter Target:</span> Chahe 5 page hon ya 20 page, roz ka target 1 full chapter hai. 
            <span className="font-bold text-amber-950"> Jab tak aaj ka chapter pura nahi hoga (Reading + MCQ), routine kal ke liye aage nahi badhega — wahi freeze rahega!</span>
          </div>
        </div>

        {/* 7-Day Tabs */}
        <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
          {scheduleByDay.map((d, idx) => {
            const isSelected = selectedDayOffset === idx;
            return (
              <button
                key={d.dayIdx}
                onClick={() => setSelectedDayOffset(idx)}
                className="px-3 py-2 rounded-2xl text-[11px] font-black shrink-0 transition-all flex items-center gap-1 active:scale-95"
                style={{
                  background: isSelected ? theme.primary : '#f1f5f9',
                  color: isSelected ? '#ffffff' : '#64748b',
                  boxShadow: isSelected ? `0 4px 12px ${theme.primary}40` : 'none',
                }}
              >
                {idx === 0 ? '📍 Aaj' : idx === 1 ? '⏭️ Kal' : `D${idx + 1}`}
              </button>
            );
          })}
        </div>

        {/* Selected Day Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-6 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-black text-slate-700">{activeDay.dayLabel} Ka Target</p>
            <span className="text-[10px] font-bold text-slate-400">
              {activeDay.slots.length} Active Subjects
            </span>
          </div>

          {activeDay.slots.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-400">Routine me abhi koi subjects active nahi hain.</p>
              <p className="text-[10px] text-slate-400 mt-1">Routine Setup se apne daily subjects chunein.</p>
            </div>
          ) : (
            activeDay.slots.map((s, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl border transition-all"
                style={{
                  background: s.isToday ? `${theme.primary}08` : '#ffffff',
                  borderColor: s.isToday ? `${theme.primary}30` : '#e2e8f0',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{s.emoji}</span>
                    <span className="text-xs font-black text-slate-800 truncate">{s.subjectName}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-500">
                      Slot {s.slotNumber}
                    </span>
                  </div>
                  {s.isToday ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                      <Clock size={11} /> Today's Task
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Projected
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100/80">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 truncate">
                    <BookOpen size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.chapterTitle}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-2">
                    {s.pageCount} Pages (1 Ch)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pb-6 sm:pb-4 border-t bg-slate-50 shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium">
            Daily sequential target: 1 Ch / Subject
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white active:scale-95 transition shadow-sm shrink-0"
            style={{ background: theme.btnGrad || theme.primary }}
          >
            Samajh Gaya (OK)
          </button>
        </div>
      </div>
    </div>
  );
};
