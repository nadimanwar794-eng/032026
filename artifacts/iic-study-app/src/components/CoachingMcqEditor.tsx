import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { normalizeMcqPaste, parseMCQText } from '../utils/mcqParser';

export interface CoachingMcqEditorItem {
  id: string;
  topic?: string;
  question: string;
  statements?: string[];
  options: string[];
  correctAnswer: number;
  explanation?: string;
  concept?: string;
  examTip?: string;
  difficultyLevel?: string;
}

interface Props {
  value: CoachingMcqEditorItem[];
  onChange: (items: CoachingMcqEditorItem[]) => void;
  accent?: 'emerald' | 'green';
  compact?: boolean;
}

const makeId = () => `mcq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const emptyMcq = (): CoachingMcqEditorItem => ({
  id: makeId(),
  topic: '',
  question: '',
  statements: [],
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
});

function normalizeItem(item: any): CoachingMcqEditorItem {
  return {
    id: item?.id || makeId(),
    topic: item?.topic || '',
    question: item?.question || '',
    statements: Array.isArray(item?.statements) ? item.statements : [],
    options: [...(item?.options || ['', '', '', '']), '', '', '', ''].slice(0, 4),
    correctAnswer: Number.isInteger(item?.correctAnswer) ? item.correctAnswer : 0,
    explanation: item?.explanation || '',
    concept: item?.concept || '',
    examTip: item?.examTip || '',
    difficultyLevel: item?.difficultyLevel || '',
  };
}

export function CoachingMcqEditor({ value, onChange, accent = 'emerald', compact = false }: Props) {
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const color = accent === 'green' ? 'green' : 'emerald';
  const panelClass = accent === 'green'
    ? 'bg-green-50 border-green-200'
    : 'bg-emerald-50 border-emerald-200';
  const labelClass = accent === 'green' ? 'text-green-700' : 'text-emerald-700';
  const buttonClass = accent === 'green'
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-emerald-600 hover:bg-emerald-700';
  const items = (value || []).map(normalizeItem);

  const updateItem = (index: number, patch: Partial<CoachingMcqEditorItem>) => {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const updateOption = (index: number, optionIndex: number, text: string) => {
    onChange(items.map((item, i) => {
      if (i !== index) return item;
      const options = [...item.options];
      options[optionIndex] = text;
      return { ...item, options };
    }));
  };

  const updateStatement = (index: number, statementIndex: number, text: string) => {
    onChange(items.map((item, i) => {
      if (i !== index) return item;
      const statements = [...(item.statements || [])];
      statements[statementIndex] = text;
      return { ...item, statements };
    }));
  };

  const addStatement = (index: number) => {
    onChange(items.map((item, i) => i === index
      ? { ...item, statements: [...(item.statements || []), ''] }
      : item
    ));
  };

  const removeStatement = (index: number, statementIndex: number) => {
    onChange(items.map((item, i) => i === index
      ? { ...item, statements: (item.statements || []).filter((_, si) => si !== statementIndex) }
      : item
    ));
  };

  const parseBulk = () => {
    const raw = bulkText.trim();
    if (!raw) return;
    const parsed = parseMCQText(normalizeMcqPaste(raw));
    const added = (parsed.questions || []).map((q: any) => normalizeItem({
      ...q,
      id: makeId(),
      question: (q.question || '').replace(/<br\/?>/g, '\n').trim(),
      options: (q.options || ['', '', '', '']).slice(0, 4),
      correctAnswer: q.correctAnswer ?? 0,
      statements: q.statements || [],
      explanation: q.explanation || '',
    }));
    if (added.length > 0) {
      onChange([...items, ...added]);
      setBulkText('');
      setShowBulk(false);
    }
  };

  return (
    <div className={`${panelClass} border rounded-lg p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className={`text-[10px] font-bold ${labelClass} uppercase flex items-center gap-1`}>
          📝 Coaching MCQs ({items.length})
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowBulk(v => !v)}
            className="bg-amber-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-amber-600"
          >
            📋 Bulk Paste
          </button>
          <button
            type="button"
            onClick={() => {
              const item = emptyMcq();
              onChange([...items, item]);
              setOpenId(item.id);
            }}
            className={`${buttonClass} text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1`}
          >
            <Plus size={10} /> Add MCQ
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 space-y-1.5">
          <p className="text-[9px] text-amber-700 font-bold">
            Coaching format: <code>&lt;TOPIC: ...&gt;</code>, Q1., A-D, Answer:, Explanation:, aur optional <code>&lt;NOTE&gt;</code> blocks.
          </p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={'<TOPIC: रासायनिक अभिक्रियाएँ>\nQ1. प्रश्न लिखें?\nA) विकल्प 1\nB) विकल्प 2\nC) विकल्प 3\nD) विकल्प 4\nAnswer: B) विकल्प 2\nExplanation: समझाइए...'}
            className="w-full p-2 border border-amber-300 rounded text-[11px] font-mono outline-none min-h-[150px] resize-y focus:border-amber-500"
          />
          <div className="flex gap-1">
            <button type="button" onClick={parseBulk} className="flex-1 bg-amber-600 text-white px-2 py-1.5 rounded text-[10px] font-bold hover:bg-amber-700">
              Parse & Add All
            </button>
            <button type="button" onClick={() => { setBulkText(''); setShowBulk(false); }} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-[10px] font-bold hover:bg-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.map((mcq, index) => {
        const expanded = openId === mcq.id || items.length <= 1;
        return (
          <div key={mcq.id} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2 relative">
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 rounded"
              title="MCQ delete karein"
            >
              <Trash2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setOpenId(expanded ? null : mcq.id)}
              className="w-full pr-7 flex items-center gap-2 text-left"
            >
              <span className="text-[10px] font-black text-emerald-700">Q{index + 1}</span>
              <span className="flex-1 text-[11px] font-bold text-slate-700 truncate">
                {mcq.topic ? `${mcq.topic} · ` : ''}{mcq.question || 'Question likhein...'}
              </span>
              {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
            </button>

            {expanded && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={mcq.topic || ''}
                  onChange={e => updateItem(index, { topic: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                  placeholder="Topic (optional), e.g. रासायनिक अभिक्रियाएँ"
                />
                <textarea
                  value={mcq.question}
                  onChange={e => updateItem(index, { question: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none min-h-[70px] resize-y focus:border-emerald-500"
                  placeholder="Question / intro / closing question"
                />

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-indigo-700 uppercase">Numbered Statements (optional)</label>
                    <button type="button" onClick={() => addStatement(index)} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Statement</button>
                  </div>
                  {(mcq.statements || []).map((statement, statementIndex) => (
                    <div key={statementIndex} className="flex items-start gap-1">
                      <span className="text-[10px] font-black text-indigo-500 pt-2">{statementIndex + 1}.</span>
                      <textarea
                        value={statement}
                        onChange={e => updateStatement(index, statementIndex, e.target.value)}
                        className="flex-1 p-1.5 border border-indigo-100 rounded text-[11px] outline-none min-h-[38px] resize-y focus:border-indigo-400"
                        placeholder={`Statement ${statementIndex + 1}`}
                      />
                      <button type="button" onClick={() => removeStatement(index, statementIndex)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  {(mcq.statements || []).length === 0 && <p className="text-[9px] text-indigo-400">Agar statements nahi hain to khaali chhod sakte hain.</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {mcq.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-start gap-1">
                      <input
                        type="radio"
                        name={`coaching-mcq-answer-${mcq.id}`}
                        checked={mcq.correctAnswer === optionIndex}
                        onChange={() => updateItem(index, { correctAnswer: optionIndex })}
                        className="mt-2 shrink-0 accent-emerald-600"
                        aria-label={`Correct option ${String.fromCharCode(65 + optionIndex)}`}
                      />
                      <textarea
                        value={option}
                        onChange={e => updateOption(index, optionIndex, e.target.value)}
                        className="w-full p-1.5 border border-slate-200 rounded text-[11px] outline-none min-h-[36px] resize-y focus:border-emerald-500"
                        placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  value={mcq.explanation || ''}
                  onChange={e => updateItem(index, { explanation: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg text-[11px] outline-none min-h-[55px] resize-y focus:border-emerald-500"
                  placeholder="Explanation (optional)"
                />
                <p className="text-[9px] text-slate-500">✓ Sahi answer ke saamne radio select karein</p>
              </div>
            )}
          </div>
        );
      })}

      {!compact && items.length === 0 && (
        <p className="text-[10px] text-slate-500 text-center py-2">Add MCQ ya Bulk Paste se questions add karein.</p>
      )}
    </div>
  );
}

export default CoachingMcqEditor;