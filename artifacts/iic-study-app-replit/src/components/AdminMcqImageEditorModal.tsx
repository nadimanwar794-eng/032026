import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Trash2,
  Image as ImageIcon,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { uploadToTelegramStorage, resolveTelegramUrl } from '../services/telegramStorageService';
import type { MCQItem } from '../types';

interface AdminMcqImageEditorModalProps {
  question: MCQItem;
  questionIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    imageUrl: string;
    imageWidth: string | number;
    imageAlign: 'left' | 'center' | 'right';
    imagePosition: 'above_question' | 'below_question' | 'after_options';
  }) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}

export const AdminMcqImageEditorModal: React.FC<AdminMcqImageEditorModalProps> = ({
  question,
  questionIndex,
  isOpen,
  onClose,
  onSave,
  onRemove,
}) => {
  const [currentUrl, setCurrentUrl] = useState<string>(question.imageUrl || '');
  const [imageWidth, setImageWidth] = useState<number>(
    typeof question.imageWidth === 'number'
      ? question.imageWidth
      : typeof question.imageWidth === 'string' && question.imageWidth.endsWith('%')
      ? parseInt(question.imageWidth, 10) || 100
      : 100
  );
  const [imageAlign, setImageAlign] = useState<'left' | 'center' | 'right'>(
    question.imageAlign || 'center'
  );
  const [imagePosition, setImagePosition] = useState<'above_question' | 'below_question' | 'after_options'>(
    question.imagePosition || 'below_question'
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(15);
    setErrorMsg(null);

    try {
      const res = await uploadToTelegramStorage(file, {
        fileName: `mcq_q${questionIndex + 1}_${Date.now()}.jpg`,
        caption: `MCQ Q${questionIndex + 1} Diagram`,
        onProgress: (p) => setUploadProgress(p),
      });

      if (res?.url) {
        setCurrentUrl(res.url);
        setUploadProgress(100);
      } else {
        throw new Error('Telegram storage upload se URL nahi mila.');
      }
    } catch (err: any) {
      console.error('[AdminMcqImageEditor] Upload error:', err);
      setErrorMsg(err?.message || 'Photo upload fail ho gayi. Dobara koshish karein.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!currentUrl) {
        await onRemove();
      } else {
        await onSave({
          imageUrl: currentUrl,
          imageWidth: `${imageWidth}%`,
          imageAlign,
          imagePosition,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Save karte waqt dikkat aayi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      setCurrentUrl('');
      await onRemove();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Photo hatane mein dikkat aayi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100005] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 leading-tight">
                MCQ Q{questionIndex + 1} · Picture Manager
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Direct Telegram HD Cloud Storage (Bina URL ke)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-left flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Hidden File Input for Direct Gallery / Camera Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Upload Button */}
          <div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  <span>Telegram Cloud par HD Upload ho raha hai ({uploadProgress}%)…</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>{currentUrl ? '🔄 Photo Badlein (Gallery / Camera)' : '📷 Direct Photo Upload Karein (Gallery / Camera)'}</span>
                </>
              )}
            </button>
          </div>

          {/* Live Preview & Sizing Controls (Only when image exists) */}
          {currentUrl && (
            <div className="space-y-4 pt-1">
              {/* Size Slider & Presets */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">
                    📐 Photo Ka Size (Bada / Chhota):
                  </span>
                  <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-indigo-600 text-white">
                    {imageWidth}%
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: 'Chhota (30%)', val: 30 },
                    { label: 'Medium (50%)', val: 50 },
                    { label: 'Bada (75%)', val: 75 },
                    { label: 'Full (100%)', val: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setImageWidth(preset.val)}
                      className={`py-1 px-1 text-[10px] font-bold rounded-lg border transition-all ${
                        imageWidth === preset.val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placement / Position Selector */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">📌 Photo Placement:</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Kahan dikhana hai?</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {[
                    { pos: 'above_question' as const, label: 'Question se Upar' },
                    { pos: 'below_question' as const, label: 'Question ke Neeche (Default)' },
                    { pos: 'after_options' as const, label: 'Options ke Neeche (Sabse Aakhiri)' },
                  ].map(({ pos, label }) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setImagePosition(pos)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold transition-all ${
                        imagePosition === pos
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {imagePosition === pos ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alignment Controls */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">📍 Position / Align:</span>
                <div className="flex items-center gap-1">
                  {[
                    { align: 'left' as const, icon: AlignLeft, label: 'Baayein' },
                    { align: 'center' as const, icon: AlignCenter, label: 'Beech mein' },
                    { align: 'right' as const, icon: AlignRight, label: 'Daayein' },
                  ].map(({ align, icon: Icon, label }) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setImageAlign(align)}
                      className={`p-1.5 rounded-lg border flex items-center gap-1 text-[10.5px] font-bold transition-all ${
                        imageAlign === align
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={label}
                    >
                      <Icon size={14} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Frame */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-900/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Live Question Preview:
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    Students ko aisa dikhega
                  </span>
                </div>
                <div
                  className={`flex ${
                    imageAlign === 'left' ? 'justify-start' : imageAlign === 'right' ? 'justify-end' : 'justify-center'
                  }`}
                >
                  <div
                    className="rounded-xl overflow-hidden border border-slate-300 bg-white shadow-sm transition-all duration-150"
                    style={{ width: `${imageWidth}%`, maxWidth: '100%' }}
                  >
                    <img
                      src={resolveTelegramUrl(currentUrl)}
                      alt="MCQ Diagram Preview"
                      className="w-full h-auto object-contain max-h-[220px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          {currentUrl ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleRemove}
              className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Trash2 size={14} />
              <span>Hatao</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || uploading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>✓ Save Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
