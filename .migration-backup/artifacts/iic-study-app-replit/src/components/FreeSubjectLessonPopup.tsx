import React, { useEffect, useState } from 'react';
import { Gift, Star, Sparkles, ChevronRight, BookOpen, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  subjectName: string;
  onClose: () => void;
}

export const FreeSubjectLessonPopup: React.FC<Props> = ({ isOpen, subjectName, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // slight delay for smooth entrance
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      return;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}
    >
      {/* Card */}
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-400"
        style={{
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(60px) scale(0.97)',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* ── Header ── */}
        <div
          className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20"
            style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10"
            style={{ background: 'rgba(255,255,255,0.4)' }} />

          {/* Pulse ring + icon */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(255,255,255,0.25)' }} />
            <div className="relative w-full h-full rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)' }}>
              <Gift size={36} className="text-white" />
            </div>
          </div>

          {/* English title */}
          <h2 className="text-white font-black text-xl leading-tight mb-1">
            🎁 Free Lesson Unlocked!
          </h2>
          {/* Hindi title */}
          <p className="text-purple-100 font-bold text-sm">
            एक मुफ़्त Lesson आपका इंतज़ार कर रहा है!
          </p>
        </div>

        {/* ── Body ── */}
        <div className="bg-white px-6 py-5 space-y-4">

          {/* Subject badge */}
          <div className="flex items-center justify-center gap-2">
            <BookOpen size={14} className="text-purple-500" />
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">
              {subjectName}
            </span>
          </div>

          {/* English explanation */}
          <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
            <p className="text-slate-700 font-semibold text-sm leading-relaxed text-center">
              You can open{' '}
              <span className="text-purple-700 font-black">any 1 lesson</span>
              {' '}of your choice in this subject —{' '}
              <span className="text-purple-700 font-black">completely free, forever!</span>
            </p>
          </div>

          {/* Hindi explanation */}
          <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100">
            <p className="text-slate-700 font-semibold text-sm leading-relaxed text-center">
              इस subject में अपनी पसंद का{' '}
              <span className="text-pink-700 font-black">कोई भी 1 Lesson</span>
              {' '}बिल्कुल{' '}
              <span className="text-pink-700 font-black">मुफ़्त</span>
              {' '}खोलें — वो{' '}
              <span className="text-pink-700 font-black">हमेशा के लिए आपका Free</span>
              {' '}रहेगा!
            </p>
          </div>

          {/* Warning note */}
          <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3 border border-amber-100">
            <Zap size={14} className="text-amber-500 mt-0.5 shrink-0 fill-amber-400" />
            <div>
              <p className="text-amber-800 font-bold text-xs">
                After your free lesson, Credits will be required.
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                उसके बाद के Lessons के लिए Credits लगेंगे।
              </p>
            </div>
          </div>

          {/* Stars row */}
          <div className="flex justify-center gap-1 py-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="bg-white px-6 pb-8 pt-1">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
            }}
          >
            <Sparkles size={18} />
            Got it — Let me choose!
            <ChevronRight size={18} />
          </button>
          <p className="text-center text-xs text-slate-400 font-medium mt-3">
            समझ गया — Lesson चुनने जा रहा हूँ!
          </p>
        </div>
      </div>
    </div>
  );
};
