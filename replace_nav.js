const fs = require('fs');

const content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');

// Find the bottom nav area
const navStart = content.lastIndexOf('<nav\n        data-iic-bottom-nav=""');
const navEnd = content.indexOf('</nav>', navStart) + '</nav>'.length;

const navBlock = content.substring(navStart, navEnd);

console.log("Found nav block length:", navBlock.length);
