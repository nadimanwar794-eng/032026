Let's refine the plan. The user wants the meniscus navigation bar.
We need to add a new component inside `StudentDashboard.tsx` or outside, but it's simpler to just create a standalone component in a new file, say `MeniscusNav.tsx`, and import it, but wait, `StudentDashboard.tsx` is huge, I can just define the `MeniscusBackground` component at the top or inside the `StudentDashboard.tsx` file to avoid importing issues. Actually, creating a separate component inside `StudentDashboard.tsx` (e.g. just above `export const StudentDashboard = ...`) is safest.

Let's define `MeniscusNavIndicator`:
```tsx
const MeniscusNavIndicator = ({ activeIndex, totalTabs, navBg, navBorderColor }) => {
  const dockPathRef = useRef<SVGPathElement>(null);
  const beadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animState = useRef({ currentX: 0, targetX: 0, velocity: 0, w: 360 });

  useEffect(() => {
    // start animation loop
    let raf;
    const loop = () => {
      const spring = 0.16;
      const damping = 0.68;
      const state = animState.current;
      const force = (state.targetX - state.currentX) * spring;
      state.velocity = (state.velocity + force) * damping;
      state.currentX += state.velocity;

      if (dockPathRef.current) {
        // generatePath logic
      }
      if (beadRef.current) {
         beadRef.current.style.transform = `translateX(${state.currentX - 24}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
     // calculate targetX based on activeIndex, totalTabs, container width
     const updateTarget = () => {
        if (containerRef.current) {
           const w = containerRef.current.getBoundingClientRect().width;
           animState.current.w = w;
           const tabWidth = w / totalTabs;
           animState.current.targetX = (activeIndex * tabWidth) + (tabWidth / 2);
        }
     };
     updateTarget();
     window.addEventListener('resize', updateTarget);
     return () => window.removeEventListener('resize', updateTarget);
  }, [activeIndex, totalTabs]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-visible">
       <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <path ref={dockPathRef} fill={navBg} stroke={navBorderColor} strokeWidth="1" />
       </svg>
       <div ref={beadRef} className="absolute top-[-10px] left-0 w-[48px] h-[48px] rounded-full flex items-center justify-center z-10" style={{ background: 'var(--nst-nav-active, #c8f53c)', boxShadow: '0 0 15px var(--nst-nav-active, #c8f53c)' }}>
          {/* We could render the active icon here, but the user said "buttons app wale rahenge", so the original buttons stay. I will just render a bead, maybe with a smaller inner dot or keep it as a glow. */}
       </div>
    </div>
  );
}
```

Wait, if the SVG fills the `<nav>`, the `<nav>`'s original background needs to be transparent, or the SVG will just sit on top of it.
Currently, `<nav>` has:
```tsx
style={{
  background: tierTheme.navBg,
  borderTop: `1px solid ${(tierTheme as any).navBorderColor || tierTheme.primary + '22'}`,
  boxShadow: `0 -4px 20px -8px ${tierTheme.shadowColor}`,
}}
```
If we use the meniscus SVG, the SVG path itself will provide the `background` and `borderTop`.
So we should make the `nav` background `transparent` and `borderTop` `none`, and let the SVG handle it.
But we need to make sure the SVG covers the whole nav area.
The `<nav>` has `h-[64px]`. The SVG should be `viewBox="0 0 W 64"` where W is the dynamic width.
Since `viewBox` needs `W`, we can update it in the `requestAnimationFrame` loop too!
`svg.setAttribute('viewBox', \`0 0 ${W} 64\`);`
The path generation:
```javascript
    function generatePath(cx, W, H, R) {
      const sw = 36;
      const depth = 24; // slightly smaller depth for 64px height? 28 is fine.
      const left = Math.max(R, cx - sw);
      const right = Math.min(W - R, cx + sw);
      return `M ${R},0
      L ${left},0 C ${left + 12},0 ${cx - 20},${depth} ${cx},${depth}
      C ${cx + 20},${depth} ${right - 12},0 ${right},0
      L ${W - R},0 A ${R},${R} 0 0 1 ${W},${R}
      L ${W},${H}
      L 0,${H}
      L 0,${R} A ${R},${R} 0 0 1 ${R},0 Z`;
      // Removed bottom border radius for the bottom corners since the nav is fixed at bottom.
    }
```

Wait, the dock path SVG should cover the whole `<nav>` including the padding at the bottom for safe area (iPhone notch).
The `<nav>` has `pb-safe`. So its height might be more than 64px.
If we use `position: absolute; inset: 0`, the SVG will automatically stretch.
If we use `preserveAspectRatio="none"` and a `viewBox` that matches the exact dimensions `W` and `H`, then the path will draw exactly at the pixel level.
So in the `loop`, we should read `H = containerRef.current.offsetHeight`.

Let's test this in a standalone script first to see if it works.
