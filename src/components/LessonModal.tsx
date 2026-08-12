import React, { useState, useEffect } from 'react';
import { X, BookOpen, Check, FolderPlus } from 'lucide-react';
import { Lesson } from '../types';
import { PRESET_COLORS, generateId } from '../lib/utils';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lesson: Lesson) => void;
  existingLesson?: Lesson | null;
}

export const LessonModal: React.FC<LessonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingLesson,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingLesson) {
      setName(existingLesson.name);
      setCategory(existingLesson.category || '');
      setDescription(existingLesson.description || '');
      setColor(existingLesson.color || PRESET_COLORS[0].value);
    } else {
      setName('');
      setCategory('');
      setDescription('');
      setColor(PRESET_COLORS[0].value);
    }
    setError('');
  }, [existingLesson, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a lesson name');
      return;
    }

    const now = Date.now();
    const lessonToSave: Lesson = {
      id: existingLesson ? existingLesson.id : generateId('lesson'),
      name: name.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      color,
      createdAt: existingLesson ? existingLesson.createdAt : now,
      updatedAt: now,
    };

    onSave(lessonToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">
                {existingLesson ? 'Edit Lesson' : 'Create New Lesson'}
              </h3>
              <p className="text-xs text-slate-400">
                Organize notes into structured lessons/topics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* Lesson Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Lesson Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lesson 1: Cell Biology & Genetics"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* Category / Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Subject / Category (Optional)
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Science, Mathematics, History, React"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description / Overview (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of what this lesson covers..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Color Badge
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((item) => {
                const isSelected = color === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setColor(item.value)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition ${item.bg} hover:scale-110 ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : ''
                    }`}
                    title={item.label}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{existingLesson ? 'Update Lesson' : 'Save Lesson'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
