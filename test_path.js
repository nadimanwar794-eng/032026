function generatePath(cx, W, H, R) {
  const sw = 36; // Socket half-width
  const depth = 28; // Socket depth

  const left = Math.max(R, cx - sw);
  const right = Math.min(W - R, cx + sw);

  return `M ${R},0
L ${left},0 C ${left + 12},0 ${cx - 20},${depth} ${cx},${depth}
C ${cx + 20},${depth} ${right - 12},0 ${right},0
L ${W - R},0 A ${R},${R} 0 0 1 ${W},${R} L ${W},${H - R} A ${R},${R} 0 0 1 ${W - R},${H} L ${R},${H} A ${R},${R} 0 0 1 0,${H - R}
L 0,${R} A ${R},${R} 0 0 1 ${R},0
Z`;
}
console.log(generatePath(180, 360, 72, 20));
