import React, { useState, useRef } from 'react';
import {
  X,
  Video,
  FileText,
  Music,
  Upload,
  Loader2,
  Trash2,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Save,
} from 'lucide-react';
import { LucentNoteEntry } from '../types';
import { uploadToTelegramStorage } from '../services/telegramStorageService';
import { saveLucentEntryDirect } from '../firebase';

interface AdminLucentMediaModalProps {
  entry: LucentNoteEntry;
  initialPageIndex?: number;
  onClose: () => void;
  onSaved: (updatedEntry: LucentNoteEntry) => void;
}

export const AdminLucentMediaModal: React.FC<AdminLucentMediaModalProps> = ({
  entry,
  initialPageIndex = 0,
  onClose,
  onSaved,
}) => {
  const pages = entry.pages || [];
  // -1 means "Lesson-Wide (All pages)", 0+ means specific page
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(
    pages.length > 0 ? Math.min(initialPageIndex, pages.length - 1) : -1
  );

  const isLessonWide = selectedPageIndex === -1;
  const currentPage = !isLessonWide ? pages[selectedPageIndex] : null;

  // Local state for URLs
  const [videoUrl, setVideoUrl] = useState<string>(
    isLessonWide ? (entry.videoUrl || '') : ((currentPage as any)?.videoUrl || '')
  );
  const [pdfUrl, setPdfUrl] = useState<string>(
    isLessonWide ? (entry.pdfUrl || '') : ((currentPage as any)?.pdfUrl || '')
  );
  const [audioUrl, setAudioUrl] = useState<string>(
    isLessonWide ? (entry.audioUrl || '') : ((currentPage as any)?.audioUrl || '')
  );

  // When switching page tab, sync URLs
  const handlePageSelect = (pageIdx: number) => {
    setSelectedPageIndex(pageIdx);
    if (pageIdx === -1) {
      setVideoUrl(entry.videoUrl || '');
      setPdfUrl(entry.pdfUrl || '');
      setAudioUrl(entry.audioUrl || '');
    } else {
      const pg = pages[pageIdx];
      setVideoUrl((pg as any)?.videoUrl || '');
      setPdfUrl((pg as any)?.pdfUrl || '');
      setAudioUrl((pg as any)?.audioUrl || '');
    }
  };

  // Uploading state
  const [uploadingType, setUploadingType] = useState<'video' | 'pdf' | 'audio' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, type: 'video' | 'pdf' | 'audio') => {
    setUploadingType(type);
    setUploadProgress(0);
    try {
      const res = await uploadToTelegramStorage(file, {
        type: type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'pdf',
        fileName: file.name,
        onProgress: (pct) => setUploadProgress(pct),
      });

      if (type === 'video') setVideoUrl(res.url);
      else if (type === 'pdf') setPdfUrl(res.url);
      else if (type === 'audio') setAudioUrl(res.url);

      setSuccessMsg(`✅ ${type.toUpperCase()} file Telegram Vault me upload ho gayi!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Network error'}`);
    } finally {
      setUploadingType(null);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updatedPages = [...pages];
      let updatedEntry: LucentNoteEntry;

      if (isLessonWide) {
        // Update lesson wide fields
        updatedEntry = {
          ...entry,
          videoUrl: videoUrl.trim() || undefined,
          pdfUrl: pdfUrl.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
        };
      } else {
        // Update specific page and preserve other pages
        updatedPages[selectedPageIndex] = {
          ...updatedPages[selectedPageIndex],
          videoUrl: videoUrl.trim() || undefined,
          pdfUrl: pdfUrl.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
        } as any;

        updatedEntry = {
          ...entry,
          pages: updatedPages,
        };
      }

      await saveLucentEntryDirect(updatedEntry);
      onSaved(updatedEntry);
      setSuccessMsg('✅ Lucent Media update ho gaya!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      alert(`Save failed: ${err.message || 'Error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl text-white space-y-4 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles size={16} />
              </span>
              <h3 className="text-base font-black text-white">Lucent Media Manager (Admin)</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Add Video, PDF, and Audio to <span className="text-indigo-300 font-bold">"{entry.lessonTitle}"</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Page / Lesson Selector Tabs */}
        {pages.length > 0 && (
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
              📌 Kiske Liye Media Add Karna Hai?
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {pages.map((pg, idx) => (
                <button
                  key={pg.id || idx}
                  type="button"
                  onClick={() => handlePageSelect(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                    selectedPageIndex === idx
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Page {pg.pageNo || idx + 1}
                  {(pg as any)?.videoUrl || (pg as any)?.pdfUrl || (pg as any)?.audioUrl ? ' 🌟' : ''}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handlePageSelect(-1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  selectedPageIndex === -1
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-black'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Entire Lesson {entry.videoUrl || entry.pdfUrl || entry.audioUrl ? ' 🌟' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Target indicator banner */}
        <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
          <span className="text-indigo-200">
            Target:{' '}
            <strong className="text-white">
              {isLessonWide ? 'Pura Lesson (All Pages)' : `Page ${currentPage?.pageNo || selectedPageIndex + 1}`}
            </strong>
            {!isLessonWide && currentPage?.topicName && ` · ${currentPage.topicName}`}
          </span>
          <span className="text-[10px] text-slate-400">Unlimited Telegram Storage</span>
        </div>

        {/* 🎬 1. VIDEO SECTION */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-rose-400 flex items-center gap-1.5">
              <Video size={15} /> 🎬 Video Link / Upload (YouTube / Drive / MP4)
            </label>
            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ExternalLink size={10} /> Test Link
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube, Drive or Direct MP4 link..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
            />
            {videoUrl && (
              <button
                type="button"
                onClick={() => setVideoUrl('')}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition"
                title="Clear"
              >
                <Trash2 size={14} />
              </button>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*,.mp4,.mkv,.webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, 'video');
              }}
            />
            <button
              type="button"
              disabled={uploadingType === 'video'}
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 whitespace-nowrap shadow"
            >
              {uploadingType === 'video' ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload size={13} /> Upload Video
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            YouTube, Google Drive preview link, ya phone/laptop se direct MP4 upload karein.
          </p>
        </div>

        {/* 📄 2. PDF SECTION */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-blue-400 flex items-center gap-1.5">
              <FileText size={15} /> 📄 PDF Document (Drive Link / Direct Upload)
            </label>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ExternalLink size={10} /> Test PDF
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="Paste Google Drive PDF link or direct PDF URL..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
            {pdfUrl && (
              <button
                type="button"
                onClick={() => setPdfUrl('')}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition"
                title="Clear"
              >
                <Trash2 size={14} />
              </button>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, 'pdf');
              }}
            />
            <button
              type="button"
              disabled={uploadingType === 'pdf'}
              onClick={() => pdfInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 whitespace-nowrap shadow"
            >
              {uploadingType === 'pdf' ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload size={13} /> Upload PDF
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Google Drive PDF ya direct .pdf file upload karein. App ke built-in PDF reader me khulega.
          </p>
        </div>

        {/* 🎵 3. AUDIO SECTION */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-violet-400 flex items-center gap-1.5">
              <Music size={15} /> 🎵 Audio Podcast / Lecture (MP3 / Direct Upload)
            </label>
            {audioUrl && (
              <a
                href={audioUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ExternalLink size={10} /> Test Audio
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="Paste audio link or direct MP3 URL..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-violet-500"
            />
            {audioUrl && (
              <button
                type="button"
                onClick={() => setAudioUrl('')}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition"
                title="Clear"
              >
                <Trash2 size={14} />
              </button>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, 'audio');
              }}
            />
            <button
              type="button"
              disabled={uploadingType === 'audio'}
              onClick={() => audioInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 whitespace-nowrap shadow"
            >
              {uploadingType === 'audio' ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload size={13} /> Upload Audio
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Audio lecture ya explanation audio. Student Modern Audio Player me sun sakega.
          </p>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle size={15} /> {successMsg}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !!uploadingType}
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Media Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
