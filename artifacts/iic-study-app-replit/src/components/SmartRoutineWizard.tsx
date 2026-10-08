// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { X, Check, Lock, Sparkles, BookOpen, AlertCircle, ChevronRight, Award, Zap } from 'lucide-react';
import { useAppTheme } from '../utils/themeContext';
import {
  isMultiPageRoutineNote,
  isRoutineSubjectNameExcluded,
  isAcademicSchoolNote,
  ACADEMIC_SUBJECT_NAMES,
  getSlotUnlockStatus,
  type RoutineCategory,
  type UserSubTier,
  type RoutineData,
} from '../utils/routineStorage';

interface SmartRoutineWizardProps {
  isOpen: boolean;
  onClose: () => void;
  allNotes: any[];
  user: any;
  userLevel: number;
  subTier: UserSubTier;
  routineData: RoutineData;
  userCredits: number;
  onUnlockSlotWithCredits: () => void;
  singleBookNames?: string[];
  onComplete: (config: {
    routineMode: 'SCHOOL' | 'COMPETITION';
    selectedBoard: string | null;
    selectedClass: string | null;
    selectedBooks: string[];
    routineCategories: RoutineCategory[];
  }) => void;
}

export const SmartRoutineWizard: React.FC<SmartRoutineWizardProps> = ({
  isOpen,
  onClose,
  allNotes = [],
  user,
  userLevel = 1,
  subTier = 'NONE',
  routineData,
  userCredits = 0,
  onUnlockSlotWithCredits,
  singleBookNames = [],
  onComplete,
}) => {
  const theme = useAppTheme();

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

  // Step 1: Goal & Class/Book
  const [mode, setMode] = useState<'SCHOOL' | 'COMPETITION'>(routineData.routineMode || 'SCHOOL');
  const [board, setBoard] = useState<string>(routineData.selectedBoard || 'BSEB');
  const [classLevel, setClassLevel] = useState<string>(routineData.selectedClass || '10');
  const [selectedBooks, setSelectedBooks] = useState<string[]>(
    routineData.selectedBooks?.length ? routineData.selectedBooks : [routineData.selectedBook || 'Lucent']
  );

  // Step 2: Slot Subjects Selection
  // Selected subjectIds array for each slot (1 to 5) - allows multiple rotating subjects per slot!
  const [slotSelections, setSlotSelections] = useState<Record<number, string[]>>(() => {
    const existing = routineData.routineCategories || [];
    const map: Record<number, string[]> = {};
    existing.forEach((cat, idx) => {
      const slotNum = idx + 1;
      if (slotNum <= 5 && Array.isArray(cat.subjects) && cat.subjects.length > 0) {
        const ids = cat.subjects.map(s => s.subjectId).filter(Boolean);
        if (ids.length > 0) {
          map[slotNum] = ids;
        }
      }
    });
    return map;
  });

  // Calculate available classes with real notes
  const availableClasses = useMemo(() => {
    const s = new Set<string>();
    const targetBoard = board || 'BSEB';
    allNotes.forEach(n => {
      const cl = n.classLevel;
      if (cl && !isNaN(Number(cl))) {
        const nb = n.board;
        if (targetBoard && targetBoard !== 'ALL_BOARDS' && nb && nb !== targetBoard && nb !== 'ALL_BOARDS') return;
        s.add(String(cl));
      }
    });
    if (s.size === 0) ['9', '10', '11', '12'].forEach(c => s.add(c));
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [allNotes, board]);

  // Available competition books with real notes (Strictly COMPETITION ONLY — NO Class 6-12 or academic subjects!)
  const availableBooks = useMemo(() => {
    const s = new Set<string>();
    allNotes.forEach(n => {
      if (!isMultiPageRoutineNote(n, singleBookNames)) return;
      // Exclude all academic school notes (Class 6-12, academic subjects, boards)
      if (isAcademicSchoolNote(n)) return;

      const bk = (n.bookName || '').trim();
      const bkLower = bk.toLowerCase();
      if (bk && !isRoutineSubjectNameExcluded(bkLower, singleBookNames) && !ACADEMIC_SUBJECT_NAMES.has(bkLower)) {
        s.add(bk);
      } else if (n.classLevel === 'COMPETITION') {
        s.add('Lucent');
      }
    });

    // Fallback: ensure Lucent is always present as standard competition book
    s.add('Lucent');
    return Array.from(s).sort();
  }, [allNotes, singleBookNames]);

  // CRITICAL RULE: Only subjects that ACTUALLY have notes uploaded in the app for the chosen class/book!
  const availableSubjectsWithNotes = useMemo(() => {
    const subjectMap = new Map<string, { subjectId: string; displayName: string; emoji: string; count: number }>();

    allNotes.forEach(n => {
      if (!isMultiPageRoutineNote(n, singleBookNames)) return;

      if (mode === 'SCHOOL') {
        if (n.classLevel === 'COMPETITION') return;
        if (board && board !== 'ALL_BOARDS' && n.board && n.board !== board && n.board !== 'ALL_BOARDS') return;
        if (classLevel && n.classLevel && String(n.classLevel) !== String(classLevel)) return;
      } else {
        // COMPETITION MODE: Strictly NO academic school notes (Class 6-12, BSEB, etc.)
        if (isAcademicSchoolNote(n)) return;

        const bk = (n.bookName || '').trim();
        const bkLower = bk.toLowerCase();
        if (selectedBooks.length > 0) {
          const isLucentSelected = selectedBooks.some(b => b.toLowerCase() === 'lucent');
          const matchesBook = selectedBooks.includes(bk) || (isLucentSelected && (!bk || bkLower === 'lucent' || n.classLevel === 'COMPETITION'));
          if (!matchesBook) return;
        }
      }

      const sid = (n.subject || 'other').toLowerCase().trim();
      if (isRoutineSubjectNameExcluded(sid, singleBookNames)) return;

      const rawTitle = n.subject || sid;
      const emoji = n.subjectIcon || (
        sid.includes('physic') ? '⚛️' :
        sid.includes('chem') ? '🧪' :
        sid.includes('bio') ? '🧬' :
        sid.includes('math') ? '📐' :
        sid.includes('hist') ? '📜' :
        sid.includes('geo') ? '🌍' :
        sid.includes('pol') ? '⚖️' :
        sid.includes('eco') ? '📊' :
        sid.includes('hind') ? '📖' :
        sid.includes('eng') ? '📚' : '📘'
      );

      const displayMap: Record<string, string> = {
        math: 'Mathematics',
        maths: 'Mathematics',
        mathematics: 'Mathematics',
        physics: 'Physics',
        chemistry: 'Chemistry',
        biology: 'Biology',
        history: 'History',
        geography: 'Geography',
        polity: 'Political Science',
        economics: 'Economics',
      };
      const finalDisplayName = displayMap[sid] || (rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1));

      const existing = subjectMap.get(sid);
      if (existing) {
        existing.count += 1;
      } else {
        subjectMap.set(sid, {
          subjectId: sid,
          displayName: finalDisplayName,
          emoji,
          count: 1,
        });
      }
    });

    // Only return subjects where count > 0!
    return Array.from(subjectMap.values()).filter(s => s.count > 0);
  }, [allNotes, mode, board, classLevel, selectedBooks, singleBookNames]);

  // Compute status for 5 slots
  const slotStatuses = useMemo(() => {
    return [1, 2, 3, 4, 5].map(num => getSlotUnlockStatus(num, subTier, userLevel, routineData));
  }, [subTier, userLevel, routineData]);

  // Subject toggle handler - allows multi-selecting rotating subjects in each slot!
  const handleToggleSubjectForSlot = (slotNum: number, subjectId: string) => {
    setSlotSelections(prev => {
      const currentList = prev[slotNum] || [];
      const exists = currentList.includes(subjectId);
      let updatedList: string[];
      if (exists) {
        updatedList = currentList.filter(id => id !== subjectId);
      } else {
        updatedList = [...currentList, subjectId];
      }

      if (updatedList.length === 0) {
        const copy = { ...prev };
        delete copy[slotNum];
        return copy;
      }

      return {
        ...prev,
        [slotNum]: updatedList,
      };
    });
  };

  const handleFinish = () => {
    // Generate RoutineCategories from selected slots
    const categories: RoutineCategory[] = [];

    [1, 2, 3, 4, 5].forEach(slotNum => {
      const status = slotStatuses[slotNum - 1];
      if (!status.isUnlocked) return;

      const subIds = slotSelections[slotNum];
      if (!subIds || subIds.length === 0) return;

      const subjectsInSlot: RoutineCategorySubject[] = [];

      subIds.forEach(subId => {
        const subObj = availableSubjectsWithNotes.find(s => s.subjectId === subId);
        if (!subObj) return;

        // Filter notes for this subject
        const matchingNotes = allNotes.filter(n => {
          if (!isMultiPageRoutineNote(n, singleBookNames)) return false;
          const s = (n.subject || '').toLowerCase().trim();
          if (s !== subId) return false;
          if (mode === 'SCHOOL') {
            if (n.classLevel === 'COMPETITION') return false;
            if (board && board !== 'ALL_BOARDS' && n.board && n.board !== board && n.board !== 'ALL_BOARDS') return false;
            if (classLevel && n.classLevel && String(n.classLevel) !== String(classLevel)) return false;
          } else {
            // Strictly exclude academic school notes from competition routine
            if (isAcademicSchoolNote(n)) return false;
            const bk = (n.bookName || '').trim();
            const bkLower = bk.toLowerCase();
            if (selectedBooks.length > 0) {
              const isLucentSelected = selectedBooks.some(b => b.toLowerCase() === 'lucent');
              const matchesBook = selectedBooks.includes(bk) || (isLucentSelected && (!bk || bkLower === 'lucent' || n.classLevel === 'COMPETITION'));
              if (!matchesBook) return false;
            }
          }
          return true;
        });

        subjectsInSlot.push({
          subjectId: subId,
          displayName: subObj.displayName,
          emoji: subObj.emoji,
          bookName: mode === 'COMPETITION' ? (selectedBooks[0] || 'Lucent') : '',
          classLevel: mode === 'SCHOOL' ? classLevel : undefined,
          board: mode === 'SCHOOL' ? board : undefined,
          currentLessonIndex: 0,
          totalLessons: matchingNotes.length,
        });
      });

      if (subjectsInSlot.length === 0) return;

      // Smart naming for the slot category:
      // 1 subject: e.g. "Mathematics"
      // 2 subjects: e.g. "Physics & Chemistry"
      // 3+ subjects: e.g. "Physics, Chemistry +1 more"
      let catName = subjectsInSlot[0].displayName;
      if (subjectsInSlot.length === 2) {
        catName = `${subjectsInSlot[0].displayName} & ${subjectsInSlot[1].displayName}`;
      } else if (subjectsInSlot.length > 2) {
        catName = `${subjectsInSlot[0].displayName}, ${subjectsInSlot[1].displayName} +${subjectsInSlot.length - 2}`;
      }

      categories.push({
        id: `cat_slot_${slotNum}_${Date.now()}`,
        categoryName: catName,
        emoji: subjectsInSlot[0].emoji || '📚',
        currentSubjectIndex: 0,
        subjects: subjectsInSlot,
      });
    });

    onComplete({
      routineMode: mode,
      selectedBoard: mode === 'SCHOOL' ? board : null,
      selectedClass: mode === 'SCHOOL' ? classLevel : null,
      selectedBooks: mode === 'COMPETITION' ? selectedBooks : [],
      routineCategories: categories,
    });
  };

  const activeSlotsCount = Object.keys(slotSelections).filter(k => {
    const isUnlocked = slotStatuses[Number(k) - 1]?.isUnlocked;
    const list = slotSelections[Number(k)];
    return isUnlocked && Array.isArray(list) && list.length > 0;
  }).length;

  const totalSelectedSubjectsCount = Object.entries(slotSelections)
    .filter(([k]) => slotStatuses[Number(k) - 1]?.isUnlocked)
    .reduce((sum, [, list]) => sum + (Array.isArray(list) ? list.length : 0), 0);

  const canSave = activeSlotsCount >= 1;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-modal="true"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn iic-modal-overlay"
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border"
        style={{ borderColor: `${theme.primary}30` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${theme.primary}15` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm" style={{ background: `${theme.primary}18`, color: theme.primary }}>
              🎯
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Smart Routine Setup</h2>
              <p className="text-[11px] text-slate-400 font-medium">Bina confusion ke apna roz ka schedule banayein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-90"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* QUESTION 1: Track Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">1</span>
              <p className="text-xs font-black text-slate-800">Aap kiski taiyari kar rahe hain?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('SCHOOL')}
                className={`p-3 rounded-2xl border text-left transition-all ${mode === 'SCHOOL' ? 'shadow-sm' : 'opacity-80'}`}
                style={{
                  background: mode === 'SCHOOL' ? `${theme.primary}12` : '#f8fafc',
                  borderColor: mode === 'SCHOOL' ? theme.primary : '#e2e8f0',
                }}
              >
                <div className="text-xl mb-1">🏫</div>
                <div className="font-black text-xs text-slate-800">School / Board Exam</div>
                <div className="text-[10px] text-slate-400">Class 6–12 (BSEB / NCERT)</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('COMPETITION')}
                className={`p-3 rounded-2xl border text-left transition-all ${mode === 'COMPETITION' ? 'shadow-sm' : 'opacity-80'}`}
                style={{
                  background: mode === 'COMPETITION' ? `${theme.primary}12` : '#f8fafc',
                  borderColor: mode === 'COMPETITION' ? theme.primary : '#e2e8f0',
                }}
              >
                <div className="text-xl mb-1">🏆</div>
                <div className="font-black text-xs text-slate-800">Competitive Exam</div>
                <div className="text-[10px] text-slate-400">Lucent GK, Railway, SSC, etc.</div>
              </button>
            </div>

            {/* School Class & Board pickers */}
            {mode === 'SCHOOL' ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Board Chunein</p>
                  <div className="flex gap-2">
                    {['BSEB', 'NCERT_HI', 'NCERT_EN'].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBoard(b)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-black transition-all"
                        style={{
                          background: board === b ? theme.primary : '#ffffff',
                          color: board === b ? '#ffffff' : '#64748b',
                          border: `1px solid ${board === b ? theme.primary : '#cbd5e1'}`,
                        }}
                      >
                        {b === 'BSEB' ? 'Bihar Board' : b === 'NCERT_HI' ? 'NCERT (Hindi)' : 'NCERT (Eng)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Class Chunein</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableClasses.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setClassLevel(c)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all"
                        style={{
                          background: classLevel === c ? theme.primary : '#ffffff',
                          color: classLevel === c ? '#ffffff' : '#64748b',
                          border: `1px solid ${classLevel === c ? theme.primary : '#cbd5e1'}`,
                        }}
                      >
                        Class {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Multi-Subject Book</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableBooks.map(bk => {
                    const isSel = selectedBooks.includes(bk);
                    return (
                      <button
                        key={bk}
                        type="button"
                        onClick={() => setSelectedBooks([bk])}
                        className="px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                        style={{
                          background: isSel ? theme.primary : '#ffffff',
                          color: isSel ? '#ffffff' : '#64748b',
                          border: `1px solid ${isSel ? theme.primary : '#cbd5e1'}`,
                        }}
                      >
                        <BookOpen size={13} /> {bk}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* QUESTION 2: Slot-by-Slot Daily Subjects Questionnaire */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-xs font-black text-slate-800">Roz kaun se subjects padhenge?</p>
                  <p className="text-[10px] text-slate-500">Ek slot me 1 ya multiple subjects chunein (Smart Rotation)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                🔄 Daily Rotation
              </span>
            </div>

            {/* Smart Daily Task Rotation Rule Banner */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/80 shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div className="text-[11px] leading-relaxed flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-black text-blue-950 text-xs">
                      Daily Subject Rotation Rule
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Auto Rotating System
                    </span>
                  </div>
                  <div className="mt-1.5 p-2 rounded-xl bg-white/90 border border-blue-100 space-y-1">
                    <p className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <span>✅</span>
                      <span><strong>Next Day Other Subject:</strong> Aaj ka daily task complete hone par hi agle din doosra subject aayega.</span>
                    </p>
                    <p className="text-rose-600 font-bold flex items-center gap-1.5">
                      <span>⛔</span>
                      <span><strong>Without Task Done:</strong> Subject change nahi hoga (task complete hone tak wahi subject rahega).</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {availableSubjectsWithNotes.length === 0 ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-xs font-bold text-amber-800">Is class ya book me abhi notes upload nahi hain.</p>
                <p className="text-[10px] text-amber-700 mt-1">Kripya doosri class ya book select karein.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(slotNum => {
                  const status = slotStatuses[slotNum - 1];
                  const currentSelectedSubjectIds = slotSelections[slotNum] || [];

                  // Other slots already selected subjects (these MUST BE LOCKED for this slot!)
                  const otherSelectedSubjectIds = new Set<string>();
                  Object.entries(slotSelections).forEach(([k, list]) => {
                    if (Number(k) !== slotNum && Array.isArray(list)) {
                      list.forEach(id => otherSelectedSubjectIds.add(id));
                    }
                  });

                  return (
                    <div
                      key={slotNum}
                      className="p-3.5 rounded-2xl border transition-all"
                      style={{
                        background: status.isUnlocked ? '#ffffff' : '#f8fafc',
                        borderColor: status.isUnlocked
                          ? (currentSelectedSubjectIds.length > 0 ? `${theme.primary}60` : '#e2e8f0')
                          : '#cbd5e1',
                        opacity: status.isUnlocked ? 1 : 0.85,
                      }}
                    >
                      {/* Slot Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                            style={{
                              background: status.isUnlocked ? `${theme.primary}15` : '#e2e8f0',
                              color: status.isUnlocked ? theme.primary : '#64748b',
                            }}
                          >
                            #{slotNum}
                          </span>
                          <div>
                            <span className="text-xs font-black text-slate-800">
                              {slotNum <= 2 ? `Slot ${slotNum} (🟢 Free)` : `Slot ${slotNum} (Extra Track)`}
                            </span>
                            {status.isUnlocked && (
                              <span className="ml-2 text-[10px] font-bold text-slate-500">
                                {currentSelectedSubjectIds.length === 0
                                  ? '• 1 ya zyada subjects chunein'
                                  : `• ${currentSelectedSubjectIds.length} subjects (Daily Cycle)`}
                              </span>
                            )}
                          </div>
                        </div>

                        {status.isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Unlocked
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                            <Lock size={10} /> {status.requirementText}
                          </span>
                        )}
                      </div>

                      {/* Professional Slot Rule Indicator on Slot */}
                      {status.isUnlocked && (
                        <div className="mb-2.5 p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 text-[10px] leading-snug">
                          {currentSelectedSubjectIds.length > 1 ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between font-bold text-indigo-900">
                                <span className="flex items-center gap-1">
                                  <span>🔄</span>
                                  <span>{currentSelectedSubjectIds.length} Subjects Rotating Daily</span>
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black">
                                  Day #{currentSelectedSubjectIds.length} Cycle
                                </span>
                              </div>
                              <p className="text-slate-600">
                                <strong className="text-emerald-700">✓ Task Done:</strong> Next day agla subject rotate hoga &nbsp;|&nbsp; <strong className="text-rose-600">✗ Without Done:</strong> Subject change nahi hoga (No change until done).
                              </p>
                            </div>
                          ) : currentSelectedSubjectIds.length === 1 ? (
                            <div className="flex items-center justify-between text-slate-700 font-medium">
                              <span className="flex items-center gap-1">
                                <span>📖</span>
                                <span><strong>Single Subject:</strong> Roz yahi subject rahega. Aur subjects add karne par daily rotation shuru hoga.</span>
                              </span>
                            </div>
                          ) : (
                            <div className="text-slate-500 font-medium flex items-center gap-1">
                              <span>👉</span>
                              <span>Is slot ke liye subjects chunein (Multiple subjects chunne par daily rotation chalega: <strong>Task Done hone par next day agla subject</strong>).</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* If Locked: show unlock prompt */}
                      {!status.isUnlocked ? (
                        <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-between">
                          <div className="text-[11px] text-slate-600 font-medium">
                            {status.canUnlockWithCredits ? (
                              <span>🔓 <strong>100 Credits</strong> se abhi unlock karein ya Basic VIP banein</span>
                            ) : (
                              <span>🏆 <strong>{status.requirementText}</strong></span>
                            )}
                          </div>
                          {status.canUnlockWithCredits && (
                            <button
                              type="button"
                              onClick={onUnlockSlotWithCredits}
                              className="px-3 py-1.5 rounded-xl text-xs font-black text-white active:scale-95 transition shadow-sm shrink-0 ml-2"
                              style={{ background: theme.btnGrad || theme.primary }}
                            >
                              Unlock (100 CR)
                            </button>
                          )}
                        </div>
                      ) : (
                        /* If Unlocked: show subject options with multi-select and order indicators */
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {availableSubjectsWithNotes.map(sub => {
                            const selectedIndex = currentSelectedSubjectIds.indexOf(sub.subjectId);
                            const isSelectedInThisSlot = selectedIndex !== -1;
                            const isLockedInOtherSlot = otherSelectedSubjectIds.has(sub.subjectId);

                            return (
                              <button
                                key={sub.subjectId}
                                type="button"
                                disabled={isLockedInOtherSlot}
                                onClick={() => handleToggleSubjectForSlot(slotNum, sub.subjectId)}
                                className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 relative ${
                                  isLockedInOtherSlot
                                    ? 'opacity-40 bg-slate-100 cursor-not-allowed border-slate-200'
                                    : isSelectedInThisSlot
                                    ? 'shadow-sm'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}
                                style={
                                  isSelectedInThisSlot
                                    ? {
                                        background: `${theme.primary}12`,
                                        borderColor: theme.primary,
                                        boxShadow: `0 2px 8px ${theme.primary}20`,
                                      }
                                    : {}
                                }
                              >
                                <span className="text-base">{sub.emoji}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-black text-slate-800 truncate">
                                    {sub.displayName}
                                  </p>
                                  <p className="text-[9px] text-slate-400">
                                    {isLockedInOtherSlot
                                      ? '🔒 Dusre slot me hai'
                                      : isSelectedInThisSlot
                                      ? `🔄 Day #${selectedIndex + 1} (${sub.count} Ch)`
                                      : `${sub.count} Ch`}
                                  </p>
                                </div>
                                {isSelectedInThisSlot && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-md text-[9px] font-black text-white shrink-0 shadow-sm"
                                    style={{ background: theme.primary }}
                                  >
                                    #{selectedIndex + 1}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-800">
              {totalSelectedSubjectsCount} Subjects ({activeSlotsCount} Slots) Chune Gaye
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Next day other subject if task is done • Without done not change
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition"
            >
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white active:scale-95 transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: theme.btnGrad || theme.primary }}
            >
              <Sparkles size={14} /> Routine Banayein
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
