import React from 'react';

interface PlayerWatermarkProps {
  appLogo?: string;
  appName?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  opacity?: number;
  className?: string;
  onClick?: () => void;
  isFullscreen?: boolean;
  isTopBarHidden?: boolean;
}

export const PlayerWatermark: React.FC<PlayerWatermarkProps> = ({
  appLogo = '/branding/nsta-logo.png',
  appName = 'NSTA',
  position = 'top-right',
  opacity = 0.8,
  className = '',
  onClick,
  isFullscreen = false,
  isTopBarHidden = false,
}) => {
  const posClasses: Record<string, string> = {
    'top-right': 'top-2.5 right-2.5',
    'top-left': 'top-2.5 left-2.5',
    'bottom-right': 'bottom-14 right-3',
    'bottom-left': 'bottom-14 left-3',
  };

  const Component = onClick ? 'button' : 'div';

  const defaultTitle = isTopBarHidden
    ? 'Top Bar Dikhayein (Tap to show top bar)'
    : isFullscreen
    ? 'Exit Fullscreen / Toggle Top Bar'
    : 'NSTA Logo • Tap karein to Top Bar hide/show hoga';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={onClick ? defaultTitle : undefined}
      aria-label={onClick ? 'Toggle Top Bar / Fullscreen' : undefined}
      className={`absolute z-30 select-none flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md transition-all duration-200 active:scale-90 ${posClasses[position] || posClasses['top-right']} ${
        onClick
          ? 'pointer-events-auto cursor-pointer hover:opacity-100 hover:scale-105 active:scale-95 shadow-lg'
          : 'pointer-events-none'
      } ${isTopBarHidden ? 'ring-2 ring-indigo-400/60 shadow-indigo-500/30 shadow-lg' : ''} ${className}`}
      style={{
        background: isTopBarHidden ? 'rgba(30, 27, 75, 0.88)' : 'rgba(15, 23, 42, 0.78)',
        border: isTopBarHidden ? '1px solid rgba(165, 180, 252, 0.45)' : '1px solid rgba(255, 255, 255, 0.22)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        opacity: onClick ? 0.95 : opacity,
      }}
    >
      <img
        src={appLogo || '/branding/nsta-logo.png'}
        alt={appName}
        className="w-4 h-4 object-contain rounded-full shadow-sm shrink-0"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
      <span className="text-[10px] font-black tracking-wider text-white drop-shadow-md uppercase whitespace-nowrap">
        {appName}
      </span>
      {onClick && (
        <span className="text-[10px] text-indigo-300 font-bold ml-0.5">
          {isTopBarHidden ? '👁️' : isFullscreen ? '⤓' : '⛶'}
        </span>
      )}
    </Component>
  );
};
