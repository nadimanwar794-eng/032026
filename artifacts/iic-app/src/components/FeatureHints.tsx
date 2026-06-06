import React from 'react';
import { Sparkles } from 'lucide-react';

const HINTS_KEY = 'nst_hints_seen_v1';
const HINT_DELAY = 2500; // ms before showing first hint

export interface Hint {
  id: string;
  emoji: string;
  title: string;
  body: string;
  tab?: string;
}

const HINTS: Hint[] = [
  {
    id: 'revision_hub',
    emoji: '🔁',
    title: 'Revision Hub',
    body: 'Galat answers automatically track hote hain. Revision Hub mein wapas practice karo — smart spaced repetition ke saath!',
    tab: 'REVISION',
  },
  {
    id: 'tts_tap',
    emoji: '🔊',
    title: 'Tap-to-Read (TTS)',
    body: 'Kisi bhi note line pe tap karo — woh line Hindi/English mein bol dega. Long-press karo poora chapter sunne ke liye.',
  },
  {
    id: 'offline_save',
    emoji: '📥',
    title: 'Offline Save',
    body: 'Notes aur MCQs offline save kar sakte ho — internet nahi hai tab bhi padho!',
  },
  {
    id: 'mistake_bank',
    emoji: '❌',
    title: 'My Mistakes',
    body: 'Jo MCQ galat gaye woh automatically "My Mistakes" mein save hote hain. Wahan se focused practice karo.',
    tab: 'MCQ',
  },
  {
    id: 'lucent_book',
    emoji: '📖',
    title: 'Lucent Reader',
    body: 'Competition tab mein Lucent Book full reader milta hai — line by line TTS ke saath!',
    tab: 'COMPETITION',
  },
  {
    id: 'coins_streak',
    emoji: '🪙',
    title: 'Daily Login Coins',
    body: 'Roz login karo toh coins milte hain. Streak maintain karo — jitna bada streak, utne zyada coins!',
  },
  {
    id: 'theme_studio',
    emoji: '🎨',
    title: 'Theme Studio',
    body: 'Profile → Theme Studio mein apna custom color theme banao. Level 4+ pe unlock hota hai!',
    tab: 'PROFILE',
  },
];

interface Props {
  activeTab: string;
  onTabChange?: (tab: string) => void;
}

export const HINTS_LIST = HINTS;

export const FeatureTipsList: React.FC<{ onTabChange?: (tab: string) => void; onClose?: () => void }> = ({ onTabChange, onClose }) => {
  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2 px-1 mb-1">
        <Sparkles size={13} className="text-yellow-400" />
        <span className="text-[11px] font-black uppercase tracking-widest text-yellow-400">Feature Tips</span>
      </div>
      {HINTS.map(h => (
        <div key={h.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">{h.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-black text-white leading-tight mb-0.5">{h.title}</p>
              <p className="text-[11px] text-white/60 leading-relaxed">{h.body}</p>
            </div>
            {h.tab && onTabChange && (
              <button
                onClick={() => { onTabChange(h.tab!); onClose?.(); }}
                className="shrink-0 text-[9px] font-black px-2 py-1 rounded-lg active:scale-95 transition-all mt-0.5"
                style={{ background: 'rgba(59,130,246,0.20)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
              >Go →</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const FeatureHints: React.FC<Props> = ({ activeTab: _activeTab, onTabChange: _onTabChange }) => {
  return null;
};
