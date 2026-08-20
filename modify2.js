const fs = require('fs');

let content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');

// I also need to adjust the active icon position to fit nicely in the bead.
// The bead is at top: -10px, so it moves up.
// Let's find the button mapping and adjust the scale/transform for the active tab icon.

const iconScaleStr = 'tab.isActive ? "nav-icon-pop scale-110" : "scale-100"';
const newIconScaleStr = 'tab.isActive ? "nav-icon-pop scale-110 -translate-y-2" : "scale-100"';

content = content.replace(iconScaleStr, newIconScaleStr);

// Text translation when active
// Let's find the text span
const textSpanStr = `className={\`relative z-10 text-[10.5px] leading-none tracking-wide transition-all duration-300 \${
                          tab.isActive
                            ? "font-bold translate-y-0 opacity-100"
                            : "font-medium translate-y-0 opacity-100"
                        }\`}`;
const newTextSpanStr = `className={\`relative z-10 text-[10.5px] leading-none tracking-wide transition-all duration-300 \${
                          tab.isActive
                            ? "font-bold translate-y-[2px] opacity-100"
                            : "font-medium translate-y-0 opacity-100"
                        }\`}`;

content = content.replace(textSpanStr, newTextSpanStr);

fs.writeFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', content);
console.log("Secondary modifications applied successfully.");
