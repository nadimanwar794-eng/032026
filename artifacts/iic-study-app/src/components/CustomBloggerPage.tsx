import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { APP_VERSION } from '../constants';
import { SystemSettings } from '../types';
import { CustomPlayer } from './CustomPlayer';
import { renderMathInHtml } from '../utils/mathUtils';

interface Props {
  onBack: () => void;
  settings?: SystemSettings;
}

export const CustomBloggerPage: React.FC<Props> = ({ onBack, settings }) => {
  const [content, setContent] = useState<string>('');

  const extractDriveId = (url: string) => {
    try {
      if (!url) return null;
      const match = url.match(/\/d\/(.*?)\//) || url.match(/id=([^&]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const driveId = extractDriveId(settings?.customBloggerVideoUrl || '');

  useEffect(() => {
    const saved = localStorage.getItem('nst_custom_blogger_page');
    if (saved) setContent(saved);

    const contentRef = ref(rtdb, 'custom_blogger_page');
    const unsubscribe = onValue(contentRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setContent(data);
        localStorage.setItem('nst_custom_blogger_page', data);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-white" style={{ height: '100dvh' }}>

      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-100 shrink-0 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all px-3 py-1.5 rounded-full"
        >
          <ArrowLeft size={15} className="text-slate-600" />
          <span className="text-xs font-bold text-slate-700">Back</span>
        </button>

        <div className="flex flex-col items-end leading-tight">
          <span className="text-[9px] text-slate-400 font-medium">v{APP_VERSION}</span>
          {settings?.showFooter !== false && (
            <span className="text-[9px] text-slate-400">
              by <span className="font-bold text-slate-600">Nadim Anwar</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Full-screen scrollable content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">

        {/* Video (if any) */}
        {driveId && (
          <div className="w-full bg-black" style={{ aspectRatio: '16/9' }}>
            <CustomPlayer videoUrl={`https://drive.google.com/file/d/${driveId}/view`} />
          </div>
        )}

        {/* HTML Content — full width, no side padding */}
        {content ? (
          <div
            className="w-full custom-html-content"
            dangerouslySetInnerHTML={{ __html: renderMathInHtml(content) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-24 text-slate-400">
            <p className="text-sm font-medium">No content available.</p>
          </div>
        )}
      </div>
    </div>
  );
};
