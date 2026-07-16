import React from 'react';
import { ClassLevel, Subject, Stream, Board, SystemSettings, LucentNoteEntry } from '../types';
import { getSubjectsList } from '../constants';
import { Calculator, FlaskConical, Languages, Globe2, BookMarked, History, TrendingUp, Briefcase, Landmark, Feather, Home, HeartPulse, Activity, Cpu, ChevronRight } from 'lucide-react';
import type { ContentIndexMap } from '../firebase';
import { useAppTheme } from '../utils/themeContext';

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
    // Also count lucent-style lessons added for this book (e.g. Speedy Science, Sar Sangrah)
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

export const SubjectSelection: React.FC<Props> = ({
  classLevel, stream, board, onSelect, onBack, hideBack = false, settings,
  contentIndex = {}, lucentNotes = [], subscriptionLevel, isPremium
}) => {
  const appTheme = useAppTheme();
  const subjects = getSubjectsList(classLevel, stream, board).filter(
    sub => !(settings?.hiddenSubjects || []).includes(sub.id)
  );
  const currentBoard = board || 'CBSE';
  const isCompetition = classLevel === 'COMPETITION';

  const tier = isPremium && subscriptionLevel === 'ULTRA'
    ? 'ultra'
    : isPremium && subscriptionLevel === 'BASIC'
      ? 'basic'
      : 'free';

  const tierHeaderColor = appTheme.primary;

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

          return (
            <button
              key={subject.id}
              onClick={() => onSelect(subject)}
              data-tier={tier}
              className="nst-subject-card p-4 rounded-2xl flex items-center gap-4 active:scale-95 text-left group"
            >
              <div className="nst-card-icon w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <SubjectIcon icon={subject.icon} className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="nst-card-title font-black text-base truncate">{subject.name}</h3>
                {totalContent > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {statBadges.map(b => (
                      <span
                        key={b.emoji}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black border"
                        style={{
                          background: b.label === 'Notes'  ? '#dcfce7' :
                                      b.label === 'PDF'    ? '#dbeafe' :
                                      b.label === 'MCQ'    ? '#fef9c3' :
                                      b.label === 'Video'  ? '#fee2e2' :
                                      b.label === 'Audio'  ? '#f3e8ff' :
                                      b.label === 'Lessons'? '#dcfce7' :
                                      b.label === 'Pages'  ? '#dbeafe' : '#f1f5f9',
                          color:      b.label === 'Notes'  ? '#16a34a' :
                                      b.label === 'PDF'    ? '#1d4ed8' :
                                      b.label === 'MCQ'    ? '#b45309' :
                                      b.label === 'Video'  ? '#dc2626' :
                                      b.label === 'Audio'  ? '#7c3aed' :
                                      b.label === 'Lessons'? '#16a34a' :
                                      b.label === 'Pages'  ? '#1d4ed8' : '#475569',
                          borderColor:b.label === 'Notes'  ? '#86efac' :
                                      b.label === 'PDF'    ? '#93c5fd' :
                                      b.label === 'MCQ'    ? '#fde047' :
                                      b.label === 'Video'  ? '#fca5a5' :
                                      b.label === 'Audio'  ? '#d8b4fe' :
                                      b.label === 'Lessons'? '#86efac' :
                                      b.label === 'Pages'  ? '#93c5fd' : '#e2e8f0',
                        }}
                      >
                        {b.emoji} {b.count}
                      </span>
                    ))}
                  </div>
                ) : settings != null ? (
                  <p className="nst-card-meta text-[11px] font-medium mt-0.5 opacity-40">No content yet</p>
                ) : (
                  <p className="nst-card-meta text-[11px] font-medium mt-0.5 opacity-60">Loading…</p>
                )}
              </div>
              <ChevronRight size={18} className="nst-card-arrow opacity-70 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
