import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  Play,
  Headphones,
  FileText,
  Clock,
  HardDrive,
  X,
  AlertCircle,
  Crown,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  getAllOfflineMedia,
  deleteOfflineMedia,
  clearAllOfflineVault,
  getOfflineVaultStorageUsageMB,
  formatBytes,
  OfflineMediaMeta,
  OfflineMediaKind,
  validateOfflinePlaybackAccess,
} from '../services/offlineStorageService';
import { ModernVideoPlayer } from './ModernVideoPlayer';
import { ModernAudioPlayer } from './ModernAudioPlayer';
import { ModernPdfViewer } from './ModernPdfViewer';

interface OfflineDownloadsHubProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  isAdmin?: boolean;
  appLogo?: string;
  appName?: string;
  onUpgradeClick?: () => void;
}

export const OfflineDownloadsHub: React.FC<OfflineDownloadsHubProps> = ({
  isOpen,
  onClose,
  user,
  isAdmin = false,
  appLogo = '/nsta-logo.png',
  appName = 'NSTA ACADEMY',
  onUpgradeClick,
}) => {
  const [items, setItems] = useState<OfflineMediaMeta[]>([]);
  const [activeTab, setActiveTab] = useState<OfflineMediaKind>('video');
  const [totalStorageMB, setTotalStorageMB] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active playing item inside modal
  const [playingItem, setPlayingItem] = useState<OfflineMediaMeta | null>(null);

  const loadData = async () => {
    setLoading(true);
    const mediaList = await getAllOfflineMedia();
    const storageUsed = await getOfflineVaultStorageUsageMB();
    setItems(mediaList);
    setTotalStorageMB(storageUsed);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteOfflineMedia(id);
    if (playingItem?.id === id) setPlayingItem(null);
    loadData();
  };

  const handleClearAll = async () => {
    if (window.confirm('Kya aap saare offline downloaded files hatana chahte hain?')) {
      await clearAllOfflineVault();
      setPlayingItem(null);
      loadData();
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter((it) => it.kind === activeTab);
  const videoCount = items.filter((it) => it.kind === 'video').length;
  const audioCount = items.filter((it) => it.kind === 'audio').length;
  const pdfCount = items.filter((it) => it.kind === 'pdf').length;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Download size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                📥 My Offline Downloads Hub
              </h2>
              <p className="text-[11px] text-slate-400">Bina Internet ke app ke andar padhein aur dekhein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* Storage Bar & Summary */}
        <div className="bg-slate-800/60 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <HardDrive size={15} className="text-indigo-400" />
            <span className="text-xs font-bold text-slate-300">
              Total Storage Used: <span className="text-indigo-400 font-mono">{totalStorageMB} MB</span>
            </span>
          </div>

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
            >
              <Trash2 size={12} /> Clear All Downloads
            </button>
          )}
        </div>

        {/* Embedded In-App Player if an item is selected */}
        {playingItem && (
          <div className="p-4 border-b border-slate-800 bg-black/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} /> Offline Playing Now
              </span>
              <button
                onClick={() => setPlayingItem(null)}
                className="text-xs font-bold text-slate-400 hover:text-white transition"
              >
                ✕ Close Player
              </button>
            </div>

            {playingItem.kind === 'video' && (
              <ModernVideoPlayer
                videoUrl={playingItem.originalUrl}
                mediaId={playingItem.id}
                title={playingItem.title}
                subject={playingItem.subject}
                user={user}
                isAdmin={isAdmin}
                appLogo={appLogo}
                appName={appName}
                isOfflinePlayback={true}
                onUpgradeRequired={onUpgradeClick}
              />
            )}

            {playingItem.kind === 'audio' && (
              <ModernAudioPlayer
                audioUrl={playingItem.originalUrl}
                mediaId={playingItem.id}
                title={playingItem.title}
                subtitle={playingItem.subject}
                user={user}
                isAdmin={isAdmin}
                appLogo={appLogo}
                appName={appName}
                isOfflinePlayback={true}
                onUpgradeRequired={onUpgradeClick}
              />
            )}

            {playingItem.kind === 'pdf' && (
              <ModernPdfViewer
                pdfUrl={playingItem.originalUrl}
                mediaId={playingItem.id}
                title={playingItem.title}
                subtitle={playingItem.subject}
                user={user}
                isAdmin={isAdmin}
                appLogo={appLogo}
                appName={appName}
                isOfflinePlayback={true}
                onUpgradeRequired={onUpgradeClick}
              />
            )}
          </div>
        )}

        {/* 3 Main Media Tabs */}
        <div className="p-3 border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'video'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Play size={14} /> Videos ({videoCount})
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'audio'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Headphones size={14} /> Audios ({audioCount})
          </button>

          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'pdf'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText size={14} /> PDFs ({pdfCount})
          </button>
        </div>

        {/* Media Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Download size={24} className="mx-auto mb-2 animate-bounce opacity-60" />
              Loading your offline vault...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Download size={32} className="mx-auto mb-2 opacity-30" />
              <p className="font-bold text-sm">Abhi koi {activeTab.toUpperCase()} offline save nahi hai.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Chapters me jakar <span className="text-indigo-400 font-bold">"Save Offline"</span> button dabayein
                aur bina internet ke kabhi bhi dekhein!
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const access = validateOfflinePlaybackAccess(item, user);
              const isExpired = !access.allowed && access.reason === 'EXPIRED';

              return (
                <div
                  key={item.id}
                  onClick={() => setPlayingItem(item)}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer group ${
                    playingItem?.id === item.id
                      ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md'
                      : 'bg-slate-800/70 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.kind === 'video'
                          ? 'bg-rose-500/20 text-rose-400'
                          : item.kind === 'audio'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {item.kind === 'video' ? (
                        <Play size={18} />
                      ) : item.kind === 'audio' ? (
                        <Headphones size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {item.subject && <span className="font-semibold uppercase text-slate-300">{item.subject}</span>}
                        <span>•</span>
                        <span className="font-mono">{formatBytes(item.sizeBytes)}</span>
                        <span>•</span>
                        <span>{new Date(item.downloadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isExpired ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded-lg">
                        <AlertCircle size={11} /> Plan Expired
                      </span>
                    ) : (
                      <button
                        onClick={() => setPlayingItem(item)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition active:scale-95 shadow"
                      >
                        ▶ Play
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition active:scale-90"
                      title="Delete from offline storage"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Lock size={11} className="text-amber-400" />
            Offline downloads are securely encrypted inside the NSTA app.
          </p>
        </div>
      </div>
    </div>
  );
};
