import React, { useMemo } from 'react';
import { ClassLevel, Subject, Stream, Board, SystemSettings, LucentNoteEntry, HomeworkItem } from '../types';
import { getSubjectsList } from '../constants';
import { Calculator, FlaskConical, Languages, Globe2, BookMarked, History, TrendingUp, Briefcase, Landmark, Feather, Home, HeartPulse, Activity, Cpu, ChevronRight } from 'lucide-react';
import type { ContentIndexMap } from '../firebase';
import { useAppTheme } from '../utils/themeContext';
import { computeSubjectStats, computeHwSubjectStats, type SubjectLessonStats } from '../utils/subjectProgressStore';
import { formatDuration } from '../utils/routineAutoTrack';

interface Props {
  classLevel: ClassLevel;
  stream: Stream | null;
  board?: Board;
  onSelect: (subject: Subject) => void;
  onBack: () => void;
  hideBack?: boolean;
  initialParentSubject?: string | null;
  settings?: SystemSettings | null;
  contentIndex?: ContentIndexMap;
  lucentNotes?: LucentNoteEntry[];
  subscriptionLevel?: string;
  isPremium?: boolean;
  listCardBg?: string;
  listCardBorder?: string;
}

const SubjectIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => {
  switch (icon) {
    case 'math':     return <Calculator className={className} />;
    case 'science':
    case 'physics':
    case 'flask':    return <FlaskConical className={className} />;
    case 'bio':      return <HeartPulse className={className} />;
    case 'english':
    case 'hindi':
    case 'sanskrit':
    case 'book':     return <Languages className={className} />;
    case 'social':
    case 'geo':      return <Globe2 className={className} />;
    case 'computer': return <Cpu className={className} />;
    case 'history':  return <History className={className} />;
    case 'accounts': return <TrendingUp className={className} />;
    case 'business': return <Briefcase className={className} />;
    case 'gov':      return <Landmark className={className} />;
    case 'ppl':      return <BookMarked className={className} />;
    case 'mind':     return <Feather className={className} />;
    case 'home':     return <Home className={className} />;
    case 'active':   return <Activity className={className} />;
    default:         return <BookMarked className={className} />;
  }
};

interface SubjectStats { notes: number; pdf: number; video: number; audio: number; mcq: number; lucentNotes: number; }

const getSubjectStats = (
  subject: Subject,
  classLevel: string,
  board: string,
  contentIndex: ContentIndexMap,
  lucentNotes: LucentNoteEntry[],
  settings?: SystemSettings | null
): SubjectStats => {
  if (classLevel === 'COMPETITION') {
    if (subject.id === 'lucent') {
      const lessons = lucentNotes.length;
      let mcqTotal = 0;
      lucentNotes.forEach(n => {
        (n.pages || []).forEach(p => {
          if ((p as any).mcqs && Array.isArray((p as any).mcqs)) mcqTotal += (p as any).mcqs.length;
        });
      });
      const totalPages = lucentNotes.reduce((sum, n) => sum + (n.pages || []).length, 0);
      return { notes: lessons, pdf: totalPages, video: 0, audio: 0, mcq: mcqTotal, lucentNotes: 0 };
    }
    const homeworkItems = (settings?.homework || []).filter((hw: any) => hw.targetSubject === subject.id);
    let notes = 0, mcq = 0, audio = 0, video = 0, pdf = 0;
    homeworkItems.forEach((hw: any) => {
      if (hw.notes || hw.chunkNotes || hw.htmlNotes) notes++;
      if (hw.parsedMcqs && hw.parsedMcqs.length > 0) mcq += hw.parsedMcqs.length;
      if (hw.audioUrl) audio++;
      if (hw.videoUrl) video++;
      if (hw.pdfUrl) pdf++;
    });
    const bookLucentCount = lucentNotes.filter(
      (n: any) => (n.bookName?.trim() || 'Lucent') === subject.name.trim()
    ).length;
    notes += bookLucentCount;
    return { notes, pdf, video, audio, mcq, lucentNotes: 0 };
  }

  const prefix = `nst_content_${board}_${classLevel}_`;
  const subjectNameLower = subject.name.toLowerCase().replace(/\s+/g, '_');
  const subjectIdLower = subject.id.toLowerCase().replace(/\s+/g, '_');
  let notes = 0, pdf = 0, video = 0, audio = 0, mcq = 0;

  Object.entries(contentIndex).forEach(([key, entry]) => {
    if (!key.startsWith(prefix)) return;
    const rest = key.slice(prefix.length);
    const restLower = rest.toLowerCase();
    const storedSubject = (entry.subject || '').toLowerCase().replace(/\s+/g, '_');
    if (!storedSubject && !restLower.startsWith(subjectNameLower + '_') && !restLower.startsWith(subjectIdLower + '_')) return;
    if (storedSubject && storedSubject !== subjectNameLower && storedSubject !== subjectIdLower) return;
    if (entry.notes)  notes++;
    if (entry.pdf)    pdf++;
    if (entry.video)  video++;
    if (entry.audio)  audio++;
    if (entry.mcq)    mcq++;
  });

  const lucentCount = lucentNotes.filter(n => {
    const nClass = (n as any).classLevel || 'COMPETITION';
    return nClass === classLevel && (n.subject || '').toLowerCase() === subject.id.toLowerCase();
  }).length;

  return { notes, pdf, video, audio, mcq, lucentNotes: lucentCount };
};

// ── Progress bar for school subjects + competition ─────────────────────────────
const LessonProgressBar: React.FC<{ stats: SubjectLessonStats; primary: string }> = ({ stats, primary }) => {
  if (stats.totalLessons === 0) return null;

  const pct = stats.coveragePct;
  const statusColor =
    pct === 0 ? '#94a3b8' :
    pct >= 80 ? '#22c55e' :
    pct >= 40 ? '#f59e0b' : '#6366f1';

  const timeLabel = stats.totalTimeSecs > 0 ? formatDuration(stats.totalTimeSecs) : null;

  return (
    <div className="mt-2 space-y-1.5">
      {/* Stats row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Lessons */}
        <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
          style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
          📖 {stats.completedLessons}/{stats.totalLessons}
        </span>
        {/* Total time */}
        {timeLabel && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
            style={{ background: '#fdf4ff', color: '#7e22ce', borderColor: '#e9d5ff' }}>
            ⏱ {timeLabel}
          </span>
        )}
        {/* In-progress */}
        {stats.inProgressLessons > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
            style={{ background: '#fefce8', color: '#b45309', borderColor: '#fde68a' }}>
            ⏳ {stats.inProgressLessons} ongoing
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, background: statusColor }}
        />
      </div>

      {/* % label */}
      <p className="text-[9px] font-bold" style={{ color: statusColor }}>
        {pct === 0 ? 'Not started' : pct >= 100 ? '✅ Completed' : `${pct}% covered`}
      </p>
    </div>
  );
};

export const SubjectSelection: React.FC<Props> = ({
  classLevel, stream, board, onSelect, onBack, hideBack = false, settings,
  contentIndex = {}, lucentNotes = [], subscriptionLevel, isPremium,
  listCardBg, listCardBorder,
}) => {
  const appTheme = useAppTheme();
  const subjects = getSubjectsList(classLevel, stream, board, settings).filter(
    sub => !(settings?.hiddenSubjects || []).includes(sub.id)
  );
  const currentBoard = board || 'CBSE';
  const isCompetition = classLevel === 'COMPETITION';
  const isSchoolClass = !isCompetition && ['6','7','8','9','10','11','12'].includes(String(classLevel));

  const tier = isPremium && subscriptionLevel === 'ULTRA'
    ? 'ultra'
    : isPremium && subscriptionLevel === 'BASIC'
      ? 'basic'
      : 'free';

  const tierHeaderColor = appTheme.primary;

  // Pre-compute per-subject lesson progress for school classes (class 6-12) AND competition
  const subjectProgressMap = useMemo(() => {
    const map: Record<string, SubjectLessonStats> = {};

    if (isSchoolClass && lucentNotes.length > 0) {
      subjects.forEach(subject => {
        const lessons = lucentNotes.filter(n =>
          String((n as any).classLevel) === String(classLevel) &&
          (n.subject || '').toLowerCase().trim() === subject.id.toLowerCase().trim() &&
          (!(n as any).board || (n as any).board === currentBoard)
        ) as LucentNoteEntry[];
        if (lessons.length > 0) {
          map[subject.id] = computeSubjectStats(lessons);
        }
      });
    } else if (isCompetition) {
      subjects.forEach(subject => {
        if (subject.id === 'lucent') {
          // All competition lucent notes (no classLevel set, or classLevel === 'COMPETITION')
          const lessons = lucentNotes.filter(n =>
            (n as any).classLevel === 'COMPETITION' || !(n as any).classLevel
          ) as LucentNoteEntry[];
          if (lessons.length > 0) {
            map[subject.id] = computeSubjectStats(lessons);
          }
        } else {
          // Homework-based competition subjects (Polity, History, Geography, etc.)
          const hwItems = ((settings?.homework || []) as HomeworkItem[]).filter(
            hw => hw.targetSubject === subject.id
          );
          if (hwItems.length > 0) {
            map[subject.id] = computeHwSubjectStats(hwItems);
          }
        }
      });
    }

    return map;
  }, [subjects, lucentNotes, classLevel, currentBoard, isSchoolClass, isCompetition, settings]);

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 mt-0 pt-0">
      {!hideBack && (
        <div className="flex items-center mb-6">
          <button onClick={onBack} style={{ color: tierHeaderColor }} className="hover:opacity-70 transition-opacity mr-4 font-bold text-sm">
            &larr; Back
          </button>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: tierHeaderColor }}>
              {isCompetition ? 'Competition Books' : `Class ${classLevel} Subjects`}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: `${tierHeaderColor}99` }}>
              {isCompetition ? 'Ek book chunein padhne ke liye' : `Class ${classLevel} ka subject chunein`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subjects.map((subject) => {
          const stats = getSubjectStats(subject, classLevel, currentBoard, contentIndex, lucentNotes, settings);
          const totalContent = stats.notes + stats.pdf + stats.video + stats.audio + stats.mcq + stats.lucentNotes;

          const lessonProgress = subjectProgressMap[subject.id];

          let statBadges: { emoji: string; label: string; count: number }[];
          if (isCompetition && subject.id === 'lucent') {
            statBadges = [
              { emoji: '📚', label: 'Lessons', count: stats.notes },
              { emoji: '📄', label: 'Pages',   count: stats.pdf   },
              { emoji: '📊', label: 'MCQ',     count: stats.mcq   },
            ].filter(b => b.count > 0);
          } else if (isCompetition) {
            statBadges = [
              { emoji: '📝', label: 'Notes', count: stats.notes },
              { emoji: '📊', label: 'MCQ',   count: stats.mcq   },
              { emoji: '🎥', label: 'Video', count: stats.video },
              { emoji: '🔊', label: 'Audio', count: stats.audio },
            ].filter(b => b.count > 0);
          } else {
            statBadges = [
              { emoji: '📝', label: 'Notes', count: stats.notes + stats.lucentNotes },
              { emoji: '📄', label: 'PDF',   count: stats.pdf   },
              { emoji: '📊', label: 'MCQ',   count: stats.mcq   },
              { emoji: '🎥', label: 'Video', count: stats.video },
              { emoji: '🔊', label: 'Audio', count: stats.audio },
            ].filter(b => b.count > 0);
          }

          const _cardStyle = (listCardBg || listCardBorder) ? {
            background: listCardBg || undefined,
            borderColor: listCardBorder || undefined,
            borderWidth: listCardBorder ? 2 : undefined,
            borderStyle: listCardBorder ? 'solid' : undefined,
          } : undefined;

          return (
            <button
              key={subject.id}
              onClick={() => onSelect(subject)}
              data-tier={tier}
              className="nst-subject-card p-4 rounded-2xl flex flex-col gap-0 active:scale-95 text-left group"
              style={_cardStyle}
            >
              {/* Top row: icon + title + arrow */}
              <div className="flex items-center gap-4">
                <div className="nst-card-icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <SubjectIcon icon={subject.icon} className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="nst-card-title font-black text-base truncate">{subject.name}</h3>

                  {/* Lesson progress bar (school subjects + competition books) */}
                  {lessonProgress ? (
                    <LessonProgressBar stats={lessonProgress} primary={tierHeaderColor} />
                  ) : settings == null ? (
                    <p className="nst-card-meta text-[11px] font-medium mt-0.5 opacity-60">Loading…</p>
                  ) : null}
                </div>
                <ChevronRight size={18} className="nst-card-arrow opacity-70 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
