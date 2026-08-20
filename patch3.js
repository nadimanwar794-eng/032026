const fs = require('fs');
const file = './artifacts/iic-study-app/src/components/StudentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `            if (lessonTitle) {
              const _isAdm = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
              if (_isAdm) {
                setInitialRevisionLessonTitle(lessonTitle);
                setShowDailyEventPage(false);
                setShowRevisionHubScreen(true);
                return;
              }
              setCoinGate({
                cost: 50,
                originalCost: 100,
                discountPct: 50,
                reason: 'Revision Hub MCQ Session (Routine 50% OFF)',
                action: () => {
                  setInitialRevisionLessonTitle(lessonTitle);
                  setShowDailyEventPage(false);
                  setShowRevisionHubScreen(true);
                },
              });
              return;
            }
            setShowDailyEventPage(false);`;

const replacement1 = `            if (lessonTitle) {
              const _isAdm = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
              if (_isAdm) {
                setInitialRevisionLessonTitle(lessonTitle);
                setShowDailyEventPage(false);
                setShowRevisionHubScreen(true);
                return;
              }
              setCoinGate({
                cost: 50,
                originalCost: 100,
                discountPct: 50,
                reason: 'Revision Hub MCQ Session (Routine 50% OFF)',
                action: () => {
                  setInitialRevisionLessonTitle(lessonTitle);
                  setShowDailyEventPage(false);
                  setShowRevisionHubScreen(true);
                },
              });
              return;
            } else {
              setInitialRevisionLessonTitle(null);
            }
            setShowDailyEventPage(false);`;

const target2 = `            if (lessonTitle) {
              const _isAdm = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
              if (_isAdm) {
                setInitialRevisionLessonTitle(lessonTitle);
                setShowMyRoutine(false);
                setShowRevisionHubScreen(true);
                return;
              }
              setCoinGate({
                cost: 50,
                originalCost: 100,
                discountPct: 50,
                reason: 'Revision Hub MCQ Session (Routine 50% OFF)',
                action: () => {
                  setInitialRevisionLessonTitle(lessonTitle);
                  setShowMyRoutine(false);
                  setShowRevisionHubScreen(true);
                },
              });
              return;
            }
            setShowMyRoutine(false);`;

const replacement2 = `            if (lessonTitle) {
              const _isAdm = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
              if (_isAdm) {
                setInitialRevisionLessonTitle(lessonTitle);
                setShowMyRoutine(false);
                setShowRevisionHubScreen(true);
                return;
              }
              setCoinGate({
                cost: 50,
                originalCost: 100,
                discountPct: 50,
                reason: 'Revision Hub MCQ Session (Routine 50% OFF)',
                action: () => {
                  setInitialRevisionLessonTitle(lessonTitle);
                  setShowMyRoutine(false);
                  setShowRevisionHubScreen(true);
                },
              });
              return;
            } else {
              setInitialRevisionLessonTitle(null);
            }
            setShowMyRoutine(false);`;

if (content.indexOf(target1) !== -1) {
  content = content.replace(target1, replacement1);
  console.log('Replaced target 1');
} else {
  console.log('Target 1 not found');
}
if (content.indexOf(target2) !== -1) {
  content = content.replace(target2, replacement2);
  console.log('Replaced target 2');
} else {
  console.log('Target 2 not found');
}

fs.writeFileSync(file, content);

