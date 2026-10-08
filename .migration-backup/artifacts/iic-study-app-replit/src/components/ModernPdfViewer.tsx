import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Crown,
  Lock,
  ArrowLeft,
  ExternalLink,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { PlayerWatermark } from './PlayerWatermark';
import { resolveTelegramUrl } from '../services/telegramStorageService';
import {
  downloadAndSaveOfflineMedia,
  isMediaOffline,
  getOfflineMediaObjectUrl,
  validateOfflinePlaybackAccess,
} from '../services/offlineStorageService';

interface ModernPdfViewerProps {
  pdfUrl: string;
  title?: string;
  subtitle?: string;
  mediaId?: string;
  appLogo?: string;
  appName?: string;
  user?: any;
  isAdmin?: boolean;
  onBack?: () => void;
  onUpgradeRequired?: (feature: string) => void;
  isOfflinePlayback?: boolean;
}

export const ModernPdfViewer: React.FC<ModernPdfViewerProps> = ({
  pdfUrl,
  title = 'Study PDF Notes',
  subtitle,
  mediaId,
  appLogo = '/nsta-logo.png',
  appName = 'NSTA ACADEMY',
  user,
  isAdmin = false,
  onBack,
  onUpgradeRequired,
  isOfflinePlayback = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentViewUrl, setCurrentViewUrl] = useState(pdfUrl);
  const [is916Mobile, setIs916Mobile] = useState(false);

  // Download state
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Access check
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const userTier = (user?.subscriptionTier || user?.subscriptionLevel || 'FREE').toUpperCase();
  const canDownloadPdf = isAdmin || userTier === 'BASIC' || userTier === 'ULTRA';

  const itemId = mediaId || `pdf_${encodeURIComponent(pdfUrl || '').slice(0, 32)}`;

  useEffect(() => {
    let active = true;
    (async () => {
      const offline = await isMediaOffline(itemId);
      if (active) setIsDownloaded(offline);

      if (offline || isOfflinePlayback) {
        const res = await getOfflineMediaObjectUrl(itemId);
        if (res && active) {
          const validation = validateOfflinePlaybackAccess(res.record, user);
          if (!validation.allowed) {
            setAccessBlocked(true);
            setBlockedReason(
              validation.reason === 'EXPIRED'
                ? 'Aapka Subscription expire ho chuka hai! Offline PDF dekhne ke liye plan renew karein.'
                : 'Ye PDF sirf Basic aur Ultra members ke liye exclusive hai.'
            );
            return;
          }
          setCurrentViewUrl(res.url);
        }
      } else {
        if (active) setCurrentViewUrl(pdfUrl);
      }
    })();

    return () => {
      active = false;
    };
  }, [itemId, isOfflinePlayback, user, pdfUrl]);

  const handleDownload = async () => {
    if (!canDownloadPdf) {
      if (onUpgradeRequired) {
        onUpgradeRequired('Offline PDF Downloads');
      } else {
        alert('📄 PDF Offline Download Basic & Ultra members ke liye hai! Plan upgrade karein.');
      }
      return;
    }

    if (isDownloaded) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      await downloadAndSaveOfflineMedia(
        {
          id: itemId,
          title,
          subject: subtitle,
          kind: 'pdf',
          originalUrl: pdfUrl,
          mimeType: 'application/pdf',
          requiredTier: 'BASIC',
          subscriptionExpiry: user?.subscriptionExpiresAt || null,
        },
        (pct) => setDownloadProgress(pct)
      );

      setIsDownloaded(true);
      setIsDownloading(false);
    } catch (err) {
      console.error('PDF download error:', err);
      setIsDownloading(false);
    }
  };

  const formatPdfUrl = (url: string) => {
    if (!url) return '';
    // If it's a local object URL (from IndexedDB blob)
    if (url.startsWith('blob:')) return url;

    // Google Drive URL format
    if (url.includes('drive.google.com')) {
      const match = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) || url.match(/[?&]id=([^&#]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview?rm=minimal`;
      }
    }

    // Direct PDF URLs (Telegram, Cloudinary, .pdf, external server)
    const cleanLower = url.toLowerCase();
    const resolvedUrl = resolveTelegramUrl(url);

    // If it's a Telegram stored PDF, load directly via safe proxy
    if (resolvedUrl.startsWith('/api/telegram/file') || cleanLower.includes('telegram')) {
      return resolvedUrl;
    }

    if (cleanLower.includes('.pdf') || url.includes('/upload/') || url.includes('cloudinary.com')) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    return url;
  };

  if (accessBlocked) {
    return (
      <div className="w-full bg-slate-950 rounded-2xl p-6 text-center text-white border border-rose-900/50 shadow-2xl relative overflow-hidden min-h-[350px] flex flex-col items-center justify-center">
        <PlayerWatermark appLogo={appLogo} appName={appName} />
        <div className="w-14 h-14 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center mb-3">
          <Lock size={28} className="text-rose-400" />
        </div>
        <h4 className="text-base font-black text-white mb-1.5">Offline PDF Locked</h4>
        <p className="text-xs text-rose-200/80 max-w-sm mb-4">{blockedReason}</p>
        <button
          onClick={() => onUpgradeRequired?.('Renew Subscription')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 font-bold text-xs shadow-lg active:scale-95 transition inline-flex items-center gap-1.5"
        >
          <Crown size={14} /> Plan Renew Karein
        </button>
      </div>
    );
  }

  const renderedUrl = formatPdfUrl(currentViewUrl);

  return (
    <div
      className={`relative w-full flex flex-col select-none transition-all duration-300 ${
        is916Mobile
          ? 'fixed inset-0 z-[99999] h-[100dvh] w-full rounded-none bg-slate-950'
          : `rounded-2xl overflow-hidden border shadow-2xl flex-1 min-h-[80vh] h-[85vh] sm:min-h-[720px] ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`
      }`}
    >
      {/* ── Official Semi-Transparent Logo Watermark ── */}
      <PlayerWatermark appLogo={appLogo} appName={appName} position="top-right" />

      {/* Header Toolbar */}
      <div
        className={`p-2.5 sm:p-3 flex items-center justify-between border-b transition-colors z-20 pr-24 ${
          isDarkMode || is916Mobile
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={is916Mobile ? () => setIs916Mobile(false) : onBack}
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-90"
              title="Go Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <FileText size={18} className="text-rose-500 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate">{title}</h4>
            {subtitle && <p className="text-[10px] text-slate-400 font-semibold uppercase">{subtitle}</p>}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom controls (Compact & works on Mobile) */}
          <div className="flex items-center gap-0.5 bg-slate-200 dark:bg-slate-800 px-1.5 py-1 rounded-lg text-xs font-bold">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              className="hover:text-indigo-500 p-0.5 transition"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="font-mono text-[10px] min-w-[28px] text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
              className="hover:text-indigo-500 p-0.5 transition"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* 9:16 Full Mobile Screen Toggle */}
          <button
            onClick={() => setIs916Mobile((prev) => !prev)}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
              is916Mobile
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title={is916Mobile ? 'Normal View' : '9:16 Mobile Full Screen'}
          >
            {is916Mobile ? <Minimize2 size={14} /> : <Smartphone size={14} />}
            <span className="text-[10px] hidden xs:inline font-black">
              {is916Mobile ? 'Standard' : '9:16 Full'}
            </span>
          </button>

          {/* Dark / Light Reader Mode */}
          <button
            onClick={() => setIsDarkMode((d) => !d)}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:text-amber-400 transition"
            title="Toggle Night Mode"
          >
            {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
          </button>

          {/* Open Original PDF in New Tab */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:text-indigo-400 transition"
              title="Open Original in New Tab"
            >
              <ExternalLink size={14} />
            </a>
          )}

          {/* In-App Offline Download Button */}
          <div>
            {isDownloaded ? (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <CheckCircle size={11} /> Saved
              </span>
            ) : isDownloading ? (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full animate-pulse">
                <Download size={11} className="animate-bounce" /> {downloadProgress}%
              </span>
            ) : (
              <button
                onClick={handleDownload}
                className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full transition active:scale-95 shadow ${
                  canDownloadPdf
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                }`}
              >
                {canDownloadPdf ? <Download size={11} /> : <Crown size={11} />}
                <span className="hidden xs:inline">{canDownloadPdf ? 'Save Offline' : 'Basic/Ultra'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Document Frame (9:16 Full Height / Fill Container) */}
      <div className="flex-1 relative overflow-auto bg-slate-900/5 dark:bg-black flex items-center justify-center min-h-[500px]">
        {renderedUrl ? (
          <iframe
            src={renderedUrl}
            className="w-full h-full border-none transition-all duration-200"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none',
              minHeight: is916Mobile ? 'calc(100dvh - 54px)' : '100%',
            }}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="autoplay; fullscreen"
          />
        ) : (
          <div className="text-center p-8 text-slate-400">
            <FileText size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold">PDF Available Nahi Hai</p>
          </div>
        )}
      </div>
    </div>
  );
};

