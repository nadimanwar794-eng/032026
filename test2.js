const fs = require('fs');

const content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');

const navStart = content.indexOf('<nav');
const bottomNavStart = content.indexOf('data-iic-bottom-nav=""', navStart);
console.log("Nav start:", navStart);
console.log("Bottom Nav Start:", bottomNavStart);
