const fs = require('fs');

const content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');

const navStart = content.lastIndexOf('<nav\n        data-iic-bottom-nav=""');
const navEnd = content.indexOf('</nav>', navStart);
console.log("Nav block:", content.substring(navStart, navStart + 500));
