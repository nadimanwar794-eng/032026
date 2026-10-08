import React from 'react';

interface RankInsigniaProps {
  level: number;
  isPinnacleDiamondV?: boolean;
  size?: number; // size in px
  className?: string;
}

/**
 * High-definition Vector Rank Insignia Crests.
 * Level 1-5: Iron / Bronze Scholar Shield
 * Level 6-10: Silver / Sapphire Phoenix Crest
 * Level 11-14: Gold / Emerald / Ruby Grandmaster Crest
 * Level 15: Celestial Absolute Legend Crown
 * Level 15 Diamond Gamma V: Rainbow Prismatic Apex Diamond Crest
 */
export const RankInsignia: React.FC<RankInsigniaProps> = ({
  level,
  isPinnacleDiamondV = false,
  size = 64,
  className = '',
}) => {
  // Level 15 Diamond Gamma V: Ultra Pinnacle Prismatic Diamond
  if (isPinnacleDiamondV) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_16px_rgba(192,132,252,0.8)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pinnacleRainbow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="30%" stopColor="#c084fc" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <linearGradient id="pinnacleDiamondFill" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#c084fc" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#090d16" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Outer Rotating Glow Ring */}
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#pinnacleRainbow)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            className="animate-spin"
            style={{ animationDuration: '12s' }}
          />

          {/* Faceted Diamond Silhouette */}
          <polygon
            points="50,14 78,35 68,82 50,92 32,82 22,35"
            fill="url(#pinnacleDiamondFill)"
            stroke="url(#pinnacleRainbow)"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Inner Facet Lines */}
          <polygon
            points="50,14 62,35 50,48 38,35"
            fill="#ffffff"
            fillOpacity="0.3"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          <polygon
            points="38,35 50,48 50,84 32,82"
            fill="rgba(56, 189, 248, 0.25)"
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <polygon
            points="62,35 50,48 50,84 68,82"
            fill="rgba(245, 158, 11, 0.25)"
            stroke="#fbbf24"
            strokeWidth="1"
          />

          {/* Floating Crown at Top */}
          <path
            d="M34,22 L39,32 L50,24 L61,32 L66,22 L63,38 L37,38 Z"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <circle cx="34" cy="21" r="2" fill="#ffffff" />
          <circle cx="50" cy="23" r="2" fill="#ffffff" />
          <circle cx="66" cy="21" r="2" fill="#ffffff" />
        </svg>

        {/* Ambient Star Sparkle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[12px] animate-ping" style={{ animationDuration: '2.5s' }}>
            ✨
          </span>
        </div>
      </div>
    );
  }

  // Level 15: Absolute Legend Celestial Apex
  if (level >= 15) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(165,243,252,0.7)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="apexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#a5f3fc" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" stroke="url(#apexGrad)" strokeWidth="2.5" strokeDasharray="8 4" />
          <polygon
            points="50,16 80,36 70,80 50,90 30,80 20,36"
            fill="rgba(139, 92, 246, 0.25)"
            stroke="url(#apexGrad)"
            strokeWidth="2.8"
          />
          {/* Crown Apex */}
          <path
            d="M32,46 L40,32 L50,44 L60,32 L68,46 L64,62 L36,62 Z"
            fill="url(#apexGrad)"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          <circle cx="50" cy="52" r="5" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // Level 11-14: Master & Legend Leagues (Gold, Platinum, Cosmic)
  if (level >= 11) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <polygon
            points="50,14 84,32 74,80 50,92 26,80 16,32"
            fill="rgba(245, 158, 11, 0.15)"
            stroke="url(#goldGrad)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon
            points="50,26 72,40 64,74 50,82 36,74 28,40"
            fill="rgba(245, 158, 11, 0.25)"
            stroke="#fde047"
            strokeWidth="1.5"
          />
          {/* Star Core */}
          <polygon
            points="50,38 54,48 64,48 56,54 59,64 50,58 41,64 44,54 36,48 46,48"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // Level 6-10: Rising Achiever / Mystic Phoenix Shield
  if (level >= 6) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <polygon
            points="50,16 80,32 72,78 50,88 28,78 20,32"
            fill="rgba(56, 189, 248, 0.15)"
            stroke="url(#silverGrad)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="52" r="16" stroke="url(#silverGrad)" strokeWidth="1.5" />
          <polygon points="50,40 58,54 42,54" fill="#38bdf8" />
        </svg>
      </div>
    );
  }

  // Level 1-5: Beginner / Learner Shield
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_0_6px_rgba(110,231,183,0.4)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="50,18 78,32 70,76 50,86 30,76 22,32"
          fill="rgba(110, 231, 183, 0.12)"
          stroke="#6ee7b7"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="52" r="14" stroke="#6ee7b7" strokeWidth="1.2" strokeDasharray="4 3" />
        <circle cx="50" cy="52" r="6" fill="#6ee7b7" />
      </svg>
    </div>
  );
};
