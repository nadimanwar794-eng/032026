const fs = require('fs');
const file = 'artifacts/iic-study-app/src/components/DailyEventPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = \`          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, settings?.revisionConfig);
            });
            if (onUpdateUser && markedBuckets.length > 0) {
              const notesPts = markedBuckets.length * 5;
              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
              onUpdateUser(updated);
            }
            setShowAllNotesModal(false);
            reloadRevision();
          }}\`;

const replacement = \`          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, settings?.revisionConfig);
            });
            if (onUpdateUser && markedBuckets.length > 0) {
              const notesPts = markedBuckets.length * 5;
              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
              onUpdateUser(updated);
              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
              const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, \\\`\\\${markedBuckets.length} Revision Note(s) Read\\\`);
              showClaimOverlay(earned);
            }
            setShowAllNotesModal(false);
            reloadRevision();
          }}\`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Patched correctly.');
} else {
  console.log('Target block not found.');
}
