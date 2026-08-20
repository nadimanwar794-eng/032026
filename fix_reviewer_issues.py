import re

with open('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Replace the MeniscusNavIndicator component to include a sleeping state
old_indicator = """const MeniscusNavIndicator = ({ activeIndex, totalTabs, navBg, navBorderColor, activeColor }: { activeIndex: number, totalTabs: number, navBg: string, navBorderColor: string, activeColor: string }) => {
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
        const path = `M 0,0 L ${left},0 C ${left + 12},0 ${cx - 20},${depth} ${cx},${depth} C ${cx + 20},${depth} ${right - 12},0 ${right},0 L ${W},0 L ${W},${H} L 0,${H} Z`;
        dockPathRef.current.setAttribute('d', path);
        dockPathRef.current.parentElement!.setAttribute('viewBox', `0 0 ${W} ${H}`);
      }
      if (beadRef.current) {
         beadRef.current.style.transform = `translateX(${state.currentX - 24}px)`;
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
  }, [activeIndex, totalTabs]);"""

new_indicator = """const MeniscusNavIndicator = ({ activeIndex, totalTabs, navBg, navBorderColor, activeColor }: { activeIndex: number, totalTabs: number, navBg: string, navBorderColor: string, activeColor: string }) => {
  const dockPathRef = React.useRef<SVGPathElement>(null);
  const beadRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const animState = React.useRef({ currentX: 0, targetX: 0, velocity: 0, w: 360, h: 64, isAwake: false });
  const rafRef = React.useRef<number>(0);

  const wakeUp = React.useCallback(() => {
    if (animState.current.isAwake) return;
    animState.current.isAwake = true;

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
        const path = `M 0,0 L ${left},0 C ${left + 12},0 ${cx - 20},${depth} ${cx},${depth} C ${cx + 20},${depth} ${right - 12},0 ${right},0 L ${W},0 L ${W},${H} L 0,${H} Z`;
        dockPathRef.current.setAttribute('d', path);
        dockPathRef.current.parentElement!.setAttribute('viewBox', `0 0 ${W} ${H}`);
      }
      if (beadRef.current) {
         beadRef.current.style.transform = `translateX(${state.currentX - 24}px)`;
      }

      if (Math.abs(state.velocity) < 0.05 && Math.abs(state.targetX - state.currentX) < 0.05) {
         state.currentX = state.targetX;
         state.velocity = 0;
         state.isAwake = false;
         return; // sleep
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  React.useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
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
           wakeUp();
        }
     };
     updateTarget();
     // slight delay to ensure layout is done
     setTimeout(updateTarget, 50);
     window.addEventListener('resize', updateTarget);
     return () => window.removeEventListener('resize', updateTarget);
  }, [activeIndex, totalTabs, wakeUp]);"""

content = content.replace(old_indicator, new_indicator)

# 2. Fix the icon contrast
# It was: style={{ color: isActive ? tierTheme.primary : 'currentColor' }} for the icon wrapper
old_icon_color = """                  <div
                     className={`flex items-center justify-center h-6 w-6 transition-all duration-300 ${
                        isActive ? '-translate-y-2 opacity-100' : 'opacity-60 hover:opacity-100'
                     }`}
                     style={{
                        color: isActive ? tierTheme.primary : 'currentColor'
                     }}
                  >
                     <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>"""

new_icon_color = """                  <div
                     className={`flex items-center justify-center h-6 w-6 transition-all duration-300 ${
                        isActive ? '-translate-y-2 opacity-100' : 'opacity-60 hover:opacity-100'
                     }`}
                     style={{
                        color: isActive ? '#ffffff' : 'currentColor'
                     }}
                  >
                     <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>"""

content = content.replace(old_icon_color, new_icon_color)

with open('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'w') as f:
    f.write(content)

print("Done replacing.")
