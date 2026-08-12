import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  X, 
  Save, 
  Bold, 
  Italic, 
  Code, 
  List, 
  Heading1, 
  Heading2, 
  CheckSquare, 
  Quote, 
  Eye, 
  Edit3, 
  Pin, 
  Star, 
  Clock, 
  Tag, 
  Download, 
  Copy, 
  Check,
  BookOpen
} from 'lucide-react';
import { Note, Lesson } from '../types';
import { formatDateTime, generateId } from '../lib/utils';

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Note) => void;
  lessons: Lesson[];
  existingNote?: Note | null;
  defaultLessonId?: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  lessons,
  existingNote,
  defaultLessonId,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title);
      setContent(existingNote.content);
      setLessonId(existingNote.lessonId);
      setTags(existingNote.tags || []);
      setIsPinned(existingNote.isPinned || false);
      setIsFavorite(existingNote.isFavorite || false);
      setSavedTime(formatDateTime(existingNote.updatedAt));
    } else {
      setTitle('');
      setContent('');
      setLessonId(defaultLessonId && defaultLessonId !== 'all' ? defaultLessonId : (lessons[0]?.id || ''));
      setTags([]);
      setIsPinned(false);
      setIsFavorite(false);
      setSavedTime(null);
    }
    setTagsInput('');
    setIsMarkdownPreview(false);
  }, [existingNote, defaultLessonId, lessons, isOpen]);

  if (!isOpen) return null;

  // Insert markdown formatting helper
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const cleanTag = tagsInput.trim().replace(/^#/, '');
      if (cleanTag && !tags.includes(cleanTag)) {
        setTags([...tags, cleanTag]);
      }
      setTagsInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;

    const now = Date.now();
    const finalLessonId = lessonId || lessons[0]?.id || 'uncategorized';

    const noteToSave: Note = {
      id: existingNote ? existingNote.id : generateId('note'),
      lessonId: finalLessonId,
      title: title.trim() || 'Untitled Note',
      content: content,
      tags: tags,
      isPinned,
      isFavorite,
      createdAt: existingNote ? existingNote.createdAt : now,
      updatedAt: now,
    };

    onSave(noteToSave);
    setSavedTime(formatDateTime(now));
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${title}\n\n${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const element = document.createElement('a');
    const file = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${(title || 'note').toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Editor Top Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 gap-3">
          
          {/* Lesson Selector */}
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2">
            
            {/* Pin & Star */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`p-2 rounded-lg border transition ${
                isPinned
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={isPinned ? 'Pinned to top' : 'Pin note'}
            >
              <Pin className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-lg border transition ${
                isFavorite
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={isFavorite ? 'Starred' : 'Star note'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>

            {/* Mode Toggle: Edit vs Preview */}
            <button
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                isMarkdownPreview
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isMarkdownPreview ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" /> <span>Edit Mode</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> <span>Preview</span>
                </>
              )}
            </button>

            {/* Download */}
            <button
              onClick={handleDownloadMarkdown}
              className="p-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
              title="Download Markdown"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="p-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
              title="Copy text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Note Title Input */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800/80 bg-slate-900">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note Title (e.g. Formulae & Concepts)..."
            className="w-full bg-transparent text-xl font-bold text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          {/* Tags Input & Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pb-2">
            <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-400 ml-1"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter..."
              className="bg-transparent text-xs text-slate-300 placeholder-slate-500 focus:outline-none min-w-[140px]"
            />
          </div>
        </div>

        {/* Formatting Toolbar (shown in Edit Mode) */}
        {!isMarkdownPreview && (
          <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-800 bg-slate-950/40 text-slate-400 overflow-x-auto">
            <button
              onClick={() => insertFormatting('**', '**')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Bold (**text**)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('*', '*')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Italic (*text*)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('# ')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Heading 1 (# )"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('## ')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Heading 2 (## )"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              onClick={() => insertFormatting('- ')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Bullet List (- )"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('- [ ] ')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Checklist (- [ ] )"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('> ')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Quote (> )"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('```javascript\n', '\n```')}
              className="p-1.5 hover:bg-slate-800 rounded hover:text-white transition"
              title="Code Block (```)"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Editor Area or Markdown Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 custom-scrollbar">
          {isMarkdownPreview ? (
            <div className="markdown-body prose prose-invert max-w-none text-slate-200">
              <ReactMarkdown>{content || '*No content provided yet...*'}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              id="note-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your lesson notes here... Supports Markdown formatting (# Heading, **bold**, code blocks, lists)"
              className="w-full h-full bg-transparent text-slate-200 text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar font-mono"
            />
          )}
        </div>

        {/* Footer info & Save Button */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {savedTime ? `Saved: ${savedTime}` : 'Unsaved changes'}
            </span>
            <span>{wordCount} words</span>
            <span>~{readingTime} min read</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
