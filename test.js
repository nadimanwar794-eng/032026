const fs = require('fs');

const content = fs.readFileSync('artifacts/iic-study-app/src/components/StudentDashboard.tsx', 'utf8');
const searchString = 'const visibleTabs = tabs.filter((t) => {';
const index = content.indexOf(searchString);

console.log("Index of visibleTabs:", index);
