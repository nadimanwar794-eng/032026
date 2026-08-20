const fs = require('fs');

let content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');

const componentCode = `
// ── MENISCUS NAV INDICATOR ───────────────────────────────────────────────
const MeniscusNavIndicator = ({ activeIndex, totalTabs, navBg, navBorderColor, activeColor }: { activeIndex: number, totalTabs: number, navBg: string, navBorderColor: string, activeColor: string }) => {
  const dockPathRef = React.useRef<SVGPathElement>(null);
  const beadRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animState = React.useRef({ currentX: 0, targetX: 0, velocity: 0, w: 360, h: 64 });

  React.useEffect(() => {
    let raf: number;
    const loop = () => {
      const spring = 0.16;
      const damping = 0.68;
      const state = animState.current;
      const force = (state.targetX - state.currentX) * spring;
      state.velocity = (state.velocity + force) * damping;
      state.currentX += state.velocity;

      if (dockPathRef.current && containerRef.current) {
        const W = state.w;
        const H = state.h;
        const cx = state.currentX;
        const sw = 36;
        const depth = 28;
        const left = Math.max(0, cx - sw);
        const right = Math.min(W, cx + sw);

        // Meniscus path
        const path = \`M 0,0 L \${left},0 C \${left + 12},0 \${cx - 20},\${depth} \${cx},\${depth} C \${cx + 20},\${depth} \${right - 12},0 \${right},0 L \${W},0 L \${W},\${H} L 0,\${H} Z\`;
        dockPathRef.current.setAttribute('d', path);
        dockPathRef.current.parentElement!.setAttribute('viewBox', \`0 0 \${W} \${H}\`);
      }
      if (beadRef.current) {
         beadRef.current.style.transform = \`translateX(\${state.currentX - 24}px)\`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
     const updateTarget = () => {
        if (containerRef.current) {
           const rect = containerRef.current.getBoundingClientRect();
           animState.current.w = rect.width;
           animState.current.h = rect.height;
           const tabWidth = rect.width / totalTabs;
           animState.current.targetX = (activeIndex * tabWidth) + (tabWidth / 2);

           if (animState.current.currentX === 0) {
              animState.current.currentX = animState.current.targetX;
           }
        }
     };
     updateTarget();
     // slight delay to ensure layout is done
     setTimeout(updateTarget, 50);
     window.addEventListener('resize', updateTarget);
     return () => window.removeEventListener('resize', updateTarget);
  }, [activeIndex, totalTabs]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-visible z-0">
       <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <path ref={dockPathRef} fill={navBg} stroke={navBorderColor} strokeWidth="1" />
       </svg>
       <div
          ref={beadRef}
          className="absolute top-[-10px] left-0 w-[48px] h-[48px] rounded-full z-0 flex items-center justify-center"
          style={{
             background: activeColor,
             boxShadow: \`0 0 20px \${activeColor}80\`,
             willChange: 'transform'
          }}
       />
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────
`;

// Insert the component before export const StudentDashboard
const exportIndex = content.indexOf('export const StudentDashboard: React.FC<Props> =');
content = content.substring(0, exportIndex) + componentCode + '\n' + content.substring(exportIndex);

// Find <nav and modify it
const navStartStr = '<nav\n        data-iic-bottom-nav=""';
const navStart = content.lastIndexOf(navStartStr);
const navEndStr = 'aria-label="Primary"\n      >';
const navEnd = content.indexOf(navEndStr, navStart) + navEndStr.length;

const navReplacement = `<nav
        data-iic-bottom-nav=""
        className={\`fixed bottom-0 left-0 right-0 w-full mx-auto backdrop-blur-md z-[300] pb-safe \${activeExternalApp || isDocFullscreen || (contentViewStep === "PLAYER" && selectedChapter && activeTab !== 'STORE' && activeTab !== 'PROFILE') || isLandscapeUiHidden || isInternalImmersive || !!hwActiveHwId || !!lucentNoteViewer || coachingNotesReaderOpen ? "hidden" : ""}\`}
        style={{
          background: 'transparent', // Meniscus will draw background
          borderTop: 'none',
          boxShadow: \`0 -4px 20px -8px \${tierTheme.shadowColor}\`,
        }}
        aria-label="Primary"
      >`;

content = content.substring(0, navStart) + navReplacement + content.substring(navEnd);

// Replace sliding pill and add MeniscusNavIndicator
const slidingPillStartStr = '{/* SLIDING TOP ACCENT — single pill that glides between tabs */}';
const slidingPillEndStr = '/>';
const slidingPillStart = content.indexOf(slidingPillStartStr, navStart);
const slidingPillEnd = content.indexOf(slidingPillEndStr, slidingPillStart) + slidingPillEndStr.length;

const meniscusCall = `
                <MeniscusNavIndicator
                  activeIndex={activeIndex}
                  totalTabs={totalVisible}
                  navBg={tierTheme.navBg}
                  navBorderColor={(tierTheme as any).navBorderColor || tierTheme.primary + '22'}
                  activeColor={_isNavDark ? ((tierTheme as any).navActive || '#7dd3fc') : tierTheme.primary}
                />
`;

content = content.substring(0, slidingPillStart) + meniscusCall.trim() + content.substring(slidingPillEnd);

fs.writeFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', content);
console.log("Modifications applied successfully.");
