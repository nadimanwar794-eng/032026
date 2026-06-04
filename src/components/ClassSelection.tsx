
import React from 'react';
import { ClassLevel, Board, SystemSettings, User } from '../types';
import { GraduationCap, Lock, Trophy, Landmark, Building2, Sparkles, BookOpen, Zap } from 'lucide-react';

interface Props {
  selectedBoard: Board | null;
  allowedClasses?: ClassLevel[];
  syllabusMode?: 'SCHOOL' | 'COMPETITION' | 'BOTH';
  onSelect: (level: ClassLevel) => void;
  onBack: () => void;
  onBoardSwitch?: (board: Board) => void;
  settings?: SystemSettings;
  user?: User | null;
}

const all_classes: ClassLevel[] = ['6', '7', '8', '9', '10', '11', '12', 'COMPETITION'];

export const ClassSelection: React.FC<Props> = ({ selectedBoard, allowedClasses, onSelect, onBack, onBoardSwitch, settings, user }) => {
  
  const isPremium = user?.isPremium && user?.subscriptionEndDate && new Date(user?.subscriptionEndDate) > new Date();
  const allowedModes = isPremium 
      ? (settings?.appMode?.allowedModesForPremium || ['SCHOOL', 'COMPETITION'])
      : (settings?.appMode?.allowedModesForFree || ['SCHOOL']);

  const isAdminView = user?.role === 'ADMIN';
  const hiddenSet = new Set<string>(isAdminView ? [] : (settings?.hiddenClasses || []));

  const customClasses = (settings?.customClasses || []) as ClassLevel[];
  const baseList: ClassLevel[] = [...all_classes, ...customClasses];

  const classes = baseList.filter(c => {
      if (hiddenSet.has(c as string)) return false;
      if (c !== 'COMPETITION') return allowedModes.includes('SCHOOL');
      return true;
  });

  const allowedBoards: Board[] = settings?.allowedBoards?.length
    ? (settings.allowedBoards as Board[])
    : ['CBSE', 'BSEB'];
  const switchableBoards = allowedBoards.filter(b => b === 'CBSE' || b === 'BSEB');
  const showBoardSwitch = switchableBoards.length > 1 && onBoardSwitch && selectedBoard !== 'COMPETITION';

  React.useEffect(() => {
      if (selectedBoard === 'COMPETITION') {
          onSelect('COMPETITION');
      }
  }, [selectedBoard]);

  if (selectedBoard === 'COMPETITION') {
      return (
          <div className="h-[60vh] flex items-center justify-center">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
      );
  }

  const handleClassClick = (cls: ClassLevel) => {
      if (allowedClasses && allowedClasses.length > 0 && !allowedClasses.includes(cls)) return;
      onSelect(cls);
  };

  // Class-level color palette — inspired by FeatureMatrix tier colors
  const getClassStyle = (cls: ClassLevel, isLocked: boolean) => {
    if (isLocked) return {
      card: 'bg-slate-50 border-slate-200 opacity-70 grayscale-[0.4] cursor-not-allowed',
      iconWrap: 'bg-slate-200 text-slate-400',
      label: 'text-slate-400',
      sub: 'text-slate-300',
      accent: 'bg-slate-100',
      glow: '',
    };
    if (cls === 'COMPETITION') return {
      card: 'bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 border-purple-200 hover:border-purple-400 hover:shadow-purple-100 hover:-translate-y-1 cursor-pointer',
      iconWrap: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
      label: 'text-purple-800',
      sub: 'text-purple-500 group-hover:text-purple-600',
      accent: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
      glow: 'shadow-purple-100',
    };
    const num = parseInt(cls as string, 10);
    if (num >= 11) return {
      card: 'bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-100 hover:-translate-y-1 cursor-pointer',
      iconWrap: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      label: 'text-indigo-800',
      sub: 'text-indigo-400 group-hover:text-indigo-600',
      accent: 'bg-gradient-to-r from-indigo-500 to-blue-500',
      glow: 'shadow-indigo-100',
    };
    if (num >= 9) return {
      card: 'bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 border-blue-200 hover:border-blue-400 hover:shadow-blue-100 hover:-translate-y-1 cursor-pointer',
      iconWrap: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
      label: 'text-blue-800',
      sub: 'text-blue-400 group-hover:text-blue-600',
      accent: 'bg-gradient-to-r from-blue-500 to-sky-500',
      glow: 'shadow-blue-100',
    };
    return {
      card: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-green-200 hover:border-green-400 hover:shadow-green-100 hover:-translate-y-1 cursor-pointer',
      iconWrap: 'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white',
      label: 'text-green-800',
      sub: 'text-green-400 group-hover:text-green-600',
      accent: 'bg-gradient-to-r from-green-500 to-emerald-500',
      glow: 'shadow-green-100',
    };
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header row */}
      <div className="flex items-center mb-4 px-1">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-3 font-bold flex items-center gap-1 text-sm">
          ← Back
        </button>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedBoard} Board</span>
      </div>

      {/* Board Switch — FeatureMatrix style pill */}
      {showBoardSwitch && (
        <div className="max-w-4xl mx-auto px-4 mb-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Board Switch</p>
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1 shadow-inner">
            {switchableBoards.map(board => {
              const isActive = selectedBoard === board;
              return (
                <button
                  key={board}
                  onClick={() => !isActive && onBoardSwitch!(board)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all active:scale-95 ${
                    isActive
                      ? board === 'CBSE'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                        : 'bg-orange-500 text-white shadow-md shadow-orange-200'
                      : 'text-slate-500 hover:bg-white hover:text-slate-700'
                  }`}
                >
                  {board === 'CBSE' ? <Landmark size={14} /> : <Building2 size={14} />}
                  {board}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Page heading — FeatureMatrix style */}
      <div className="text-center mb-6 px-4">
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-black shadow-lg mb-3">
          <BookOpen size={14} className="text-yellow-400" />
          <span>Select Your Class</span>
        </div>
        <p className="text-slate-500 text-sm">Choose your grade to start learning</p>
      </div>

      {/* Tier legend — mirrors FeatureMatrix header */}
      <div className="max-w-4xl mx-auto px-4 mb-5">
        <div className="grid grid-cols-3 gap-2 bg-slate-100 rounded-2xl p-1 shadow-inner text-center text-[10px] font-black uppercase tracking-widest">
          <div className="py-2 px-1 bg-emerald-50 rounded-xl border border-emerald-100 text-green-700">
            <div className="text-base mb-0.5">📗</div>
            <div>6 – 8</div>
            <div className="text-[9px] text-green-500 font-bold normal-case">Foundation</div>
          </div>
          <div className="py-2 px-1 bg-blue-50 rounded-xl border border-blue-100 text-blue-700">
            <div className="text-base mb-0.5">📘</div>
            <div>9 – 12</div>
            <div className="text-[9px] text-blue-500 font-bold normal-case">Advanced</div>
          </div>
          <div className="py-2 px-1 bg-purple-50 rounded-xl border border-purple-100 text-purple-700">
            <div className="text-base mb-0.5">🏆</div>
            <div>Competition</div>
            <div className="text-[9px] text-purple-500 font-bold normal-case">Elite</div>
          </div>
        </div>
      </div>
      
      {/* Class Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto px-4">
        {classes.map((cls) => {
            let isLocked = allowedClasses && allowedClasses.length > 0 && !allowedClasses.includes(cls);
            if (cls === 'COMPETITION' && !allowedModes.includes('COMPETITION')) isLocked = true;
            const st = getClassStyle(cls, !!isLocked);
            const num = cls === 'COMPETITION' ? 0 : parseInt(cls as string, 10);
            const isFeatured = num === 10 || num === 12;

            return (
              <button
                key={cls}
                onClick={() => !isLocked && onSelect(cls)}
                disabled={!!isLocked}
                className={`group relative overflow-hidden border-2 shadow-sm transition-all duration-300 text-left
                  ${isFeatured ? 'col-span-2 rounded-3xl' : 'rounded-2xl'}
                  ${st.card} ${st.glow}`}
              >
                {/* Top accent strip */}
                {!isLocked && (
                  <div className={`${isFeatured ? 'h-1.5' : 'h-1'} w-full ${st.accent} absolute top-0 left-0`} />
                )}

                {/* Lock overlay */}
                {isLocked && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-3 animate-in fade-in">
                    <div className="bg-slate-100 p-3 rounded-full shadow-inner mb-2 border border-slate-200">
                      <Lock size={18} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Locked</span>
                  </div>
                )}

                {isFeatured ? (
                  /* ── Featured horizontal layout for Class 10 & 12 ── */
                  <div className="relative z-10 flex items-center gap-5 px-6 py-5 pt-6">
                    {/* Icon */}
                    <div className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${st.iconWrap}`}>
                      <GraduationCap size={30} />
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className={`text-3xl font-black leading-none ${st.label}`}>
                          Class {cls}
                        </h3>
                        {!isLocked && selectedBoard && selectedBoard !== 'COMPETITION' && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            selectedBoard === 'CBSE'
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-orange-500 text-white border-orange-600'
                          }`}>
                            {selectedBoard === 'CBSE' ? <Landmark size={9} /> : <Building2 size={9} />}
                            {selectedBoard} Board
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-bold transition-colors ${st.sub}`}>
                        {isLocked ? 'Unavailable' : num === 10 ? 'Secondary Exam →' : 'Senior Secondary Exam →'}
                      </p>
                    </div>
                    {/* Arrow hint */}
                    {!isLocked && (
                      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${st.iconWrap} opacity-60 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-base font-black">→</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Regular vertical layout for other classes ── */
                  <div className="relative z-10 p-5 pt-6">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 ${st.iconWrap}`}>
                      {cls === 'COMPETITION'
                        ? <Trophy size={22} />
                        : num >= 9
                          ? <GraduationCap size={22} />
                          : <BookOpen size={22} />
                      }
                    </div>

                    {/* Class label */}
                    <h3 className={`text-xl font-black mb-0.5 ${st.label}`}>
                      {cls === 'COMPETITION' ? 'Competition' : `Class ${cls}`}
                    </h3>

                    {/* Subtitle */}
                    <p className={`text-[11px] font-bold transition-colors ${st.sub}`}>
                      {isLocked ? 'Unavailable'
                        : cls === 'COMPETITION' ? 'Competitive Exams →'
                        : num >= 9 ? 'Secondary →'
                        : 'Middle School →'
                      }
                    </p>

                    {/* Competition extra badge */}
                    {cls === 'COMPETITION' && !isLocked && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          <Sparkles size={8} /> Elite
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
        })}
      </div>
    </div>
  );
};
