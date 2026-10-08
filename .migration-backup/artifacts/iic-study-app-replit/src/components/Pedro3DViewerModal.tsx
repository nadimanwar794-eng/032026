import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCw, Volume2, Sparkles, Compass, Shield, Zap } from 'lucide-react';
import { Pedro3DMascot, PedroMascotPose, PedroColorScheme } from './Pedro3DMascot';
import { PedroEngine } from '../utils/engines/pedroEngine';
import { pedroSpeak } from '../utils/pedroVoiceManager';
import { hapticMedium, hapticLight } from '../utils/haptic';

interface Pedro3DViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
}

export const Pedro3DViewerModal: React.FC<Pedro3DViewerModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [pose, setPose] = useState<PedroMascotPose>('idle');
  const [autoSpin, setAutoSpin] = useState<boolean>(true);
  const [colorScheme, setColorScheme] = useState<PedroColorScheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pedro_color_scheme');
      if (saved === 'cyber') return 'cyber';
    }
    return 'classic';
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'poses' | 'appearance' | 'info'>('poses');

  const effectiveLevel = PedroEngine.getEffectiveLevel(user);
  const robotName = 'Pedro';

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync colorScheme with storage
  const handleColorChange = (scheme: PedroColorScheme) => {
    hapticLight();
    setColorScheme(scheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pedro_color_scheme', scheme);
      window.dispatchEvent(new CustomEvent('pedro-color-scheme-change', { detail: { scheme } }));
    }
  };

  const handleSpeak = () => {
    hapticMedium();
    setIsSpeaking(true);
    setPose('wave');
    const greetingText = `Namaste! Main ${robotName} hoon, aapka 3D AI companion. Aap mujhe screen par 360 degree ghumakar dekh sakte hain!`;
    pedroSpeak(greetingText, {
      pitch: 1.15,
      rate: 1.05,
      onEnd: () => {
        setIsSpeaking(false);
        setPose('idle');
      },
    });
  };

  if (!isOpen) return null;

  const posesList: { key: PedroMascotPose; label: string; icon: string; desc: string }[] = [
    { key: 'idle', label: 'Idle', icon: '🤖', desc: 'Default posture' },
    { key: 'wave', label: 'Wave', icon: '👋', desc: 'Friendly wave' },
    { key: 'headless_booster', label: 'Rocket Booster', icon: '🚀', desc: 'Back jetpack flames' },
    { key: 'reading', label: 'Study Book', icon: '📖', desc: 'Reading NSTA book' },
    { key: 'wink', label: 'Wink Smile', icon: '😉', desc: 'Smart smile & wink' },
    { key: 'spin', label: '360 Spin', icon: '💫', desc: 'Dynamic spin pose' },
  ];

  const levelTitles: Record<number, string> = {
    1: 'Level 1: Novice Robot',
    2: 'Level 2: Smart Antenna',
    3: 'Level 3: Scholar Glasses',
    4: 'Level 4: DJ Headphones',
    5: 'Level 5: Royal King Crown',
    6: 'Level 6: Dual Jetpack Booster',
    7: 'Level 7: NSTA Magician',
    8: 'Level 8: Supreme Chroma Master',
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 select-none touch-none overflow-hidden">
      {/* Dynamic Cosmic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: colorScheme === 'cyber'
              ? 'radial-gradient(ellipse at 50% 40%, #083344 0%, #020617 80%)'
              : 'radial-gradient(ellipse at 50% 40%, #31104b 0%, #050510 80%)',
          }}
        />
        {/* Subtle studio grid floor */}
        <div
          className="absolute bottom-0 left-0 right-0 h-64 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            transform: 'perspective(400px) rotateX(60deg)',
            transformOrigin: 'bottom center',
          }}
        />
      </div>

      {/* Main Studio Container */}
      <div className="relative w-full h-full sm:max-w-xl sm:h-[92vh] sm:rounded-3xl flex flex-col justify-between overflow-hidden bg-slate-950/75 border border-white/10 shadow-2xl">
        {/* ── Top Header ── */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/10"
              style={{
                background: colorScheme === 'cyber'
                  ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              }}
            >
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">{robotName} 3D Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/10 text-cyan-300 border border-cyan-400/30">
                  360° View
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                {levelTitles[effectiveLevel] || `Level ${effectiveLevel} Companion`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center border border-white/15 transition-all cursor-pointer"
            title="Studio band karein"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Center 3D Stage (Rotatable 360°) ── */}
        <div className="relative flex-1 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {/* Ambient Spotlight Circle */}
          <div
            className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full blur-3xl opacity-35 pointer-events-none transition-colors duration-500"
            style={{
              background: colorScheme === 'cyber' ? '#06b6d4' : '#8b5cf6',
            }}
          />

          {/* Gesture Hint Pill */}
          <div className="absolute top-3 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300 text-[11px] font-bold flex items-center gap-1.5 shadow-md backdrop-blur-md pointer-events-none animate-pulse">
            <Compass size={13} className="text-cyan-400" />
            <span>👆 Swipe / Drag karein Pedro ko 360° ghumane ke liye</span>
          </div>

          {/* 3D Pedro Mascot Component with OrbitControls */}
          <div className="relative cursor-grab active:cursor-grabbing touch-none flex items-center justify-center">
            <Pedro3DMascot
              size={Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 340, 360)}
              pose={pose}
              isSpeaking={isSpeaking}
              isRotatable={true}
              autoSpin360={autoSpin}
              level={effectiveLevel}
              colorScheme={colorScheme}
              allowTilt={true}
              allowZoom={true}
            />
          </div>

          {/* Auto-Rotate Floating Pill Button */}
          <div className="absolute bottom-3 flex items-center gap-2">
            <button
              onClick={() => {
                hapticLight();
                setAutoSpin(prev => !prev);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer ${
                autoSpin
                  ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/30'
                  : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
              }`}
            >
              <RotateCw size={13} className={autoSpin ? 'animate-spin' : ''} />
              <span>{autoSpin ? 'Auto-Spin: ON' : 'Auto-Spin: OFF'}</span>
            </button>

            <button
              onClick={handleSpeak}
              disabled={isSpeaking}
              className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Volume2 size={13} className={isSpeaking ? 'animate-bounce' : ''} />
              <span>{isSpeaking ? 'Bol raha hai...' : 'Pedro Awaz 🗣️'}</span>
            </button>
          </div>
        </div>

        {/* ── Bottom Controls & Actions Hub ── */}
        <div className="relative z-10 border-t border-white/10 bg-slate-900/90 backdrop-blur-lg p-3 sm:p-4 space-y-3">
          {/* Control Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              onClick={() => setSelectedTab('poses')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedTab === 'poses'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎭 Poses & Actions
            </button>
            <button
              onClick={() => setSelectedTab('appearance')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedTab === 'appearance'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎨 Theme Colors
            </button>
            <button
              onClick={() => setSelectedTab('info')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedTab === 'info'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Upgrades
            </button>
          </div>

          {/* Tab 1: Poses */}
          {selectedTab === 'poses' && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {posesList.map(p => {
                const isActive = pose === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      hapticLight();
                      setPose(p.key);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-95 cursor-pointer ${
                      isActive
                        ? 'bg-white/20 border-cyan-400 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[10px] font-black truncate max-w-full">{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Appearance / Colors */}
          {selectedTab === 'appearance' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleColorChange('classic')}
                className={`flex-1 p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all active:scale-95 cursor-pointer ${
                  colorScheme === 'classic'
                    ? 'bg-purple-950/60 border-purple-500/80 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8f7fd5] to-[#c4b5fd] shrink-0 shadow-sm" />
                <div>
                  <p className="text-xs font-black leading-tight">Cosmic Purple</p>
                  <p className="text-[10px] text-purple-300 font-medium">Classic Pedro Edition</p>
                </div>
              </button>

              <button
                onClick={() => handleColorChange('cyber')}
                className={`flex-1 p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all active:scale-95 cursor-pointer ${
                  colorScheme === 'cyber'
                    ? 'bg-cyan-950/60 border-cyan-500/80 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#06b6d4] to-[#67e8f9] shrink-0 shadow-sm" />
                <div>
                  <p className="text-xs font-black leading-tight">Cyber Neon Cyan</p>
                  <p className="text-[10px] text-cyan-300 font-medium">Futuristic High-Tech</p>
                </div>
              </button>
            </div>
          )}

          {/* Tab 3: Level Upgrades */}
          {selectedTab === 'info' && (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-amber-400" />
                <span>
                  Unlocked: <strong className="text-white">{levelTitles[effectiveLevel]}</strong>
                </span>
              </div>
              <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                100% 3D Interactive
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
