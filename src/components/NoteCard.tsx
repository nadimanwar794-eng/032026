import React, { useState } from 'react';
import { 
  Pin, 
  Star, 
  Clock, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  BookOpen, 
  Eye, 
  Tag 
} from 'lucide-react';
import { Note, Lesson } from '../types';
import { formatDateTime, formatRelativeTime } from '../lib/utils';

interface NoteCardProps {
  note: Note;
  lesson?: Lesson;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin: (noteId: string) => void;
  onToggleFavorite: (noteId: string) => void;
  onSelectTag?: (tag: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  lesson,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleFavorite,
  onSelectTag,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Strip Markdown characters for clean snippet preview
  const previewText = note.content
    .replace(/[#*`_~\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <div
      onClick={() => onEdit(note)}
      className={`group relative bg-slate-900/90 border rounded-2xl p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer flex flex-col justify-between ${
        note.isPinned
          ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/20 to-slate-900'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Bar: Lesson Badge + Actions */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Lesson Badge */}
          {lesson ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 max-w-[70%]">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: lesson.color || '#3b82f6' }}
              />
              <span className="text-[11px] font-medium text-slate-300 truncate">
                {lesson.name}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500">Uncategorized</span>
          )}

          {/* Quick Actions (Pin & Star) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id);
              }}
              className={`p-1.5 rounded-lg transition ${
                note.isPinned
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
            >
              <Pin className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(note.id);
              }}
              className={`p-1.5 rounded-lg transition ${
                note.isFavorite
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title={note.isFavorite ? 'Remove Star' : 'Star Note'}
            >
              <Star className={`w-4 h-4 ${note.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Note Title */}
        <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-300 transition leading-snug line-clamp-2 mb-2">
          {note.title || 'Untitled Note'}
        </h3>

        {/* Content Snippet */}
        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-4">
          {previewText || <span className="italic text-slate-600">Empty note...</span>}
        </p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {note.tags.map((tag) => (
              <span
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag?.(tag);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-medium transition"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Date-time & Action Controls */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5" title={`Created: ${formatDateTime(note.createdAt)}`}>
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDateTime(note.createdAt)}</span>
        </div>

        {/* Action icons on hover or default */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
            title="Copy Note Content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(note);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
            title="Edit / Read Note"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            title="Delete Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
