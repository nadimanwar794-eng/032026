const fs = require('fs');
const file = 'artifacts/iic-study-app/src/components/DailyEventPage.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, settings?.revisionConfig);
            });
            if (onUpdateUser && markedBuckets.length > 0) {
              onUpdateUser(user.id, {});
            }
            reloadRevision();
          }}`,
`          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, settings?.revisionConfig);
            });
            if (onUpdateUser && markedBuckets.length > 0) {
              onUpdateUser(user.id, {});
              const pts = markedBuckets.length * 10;
              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
              const earned = tryEarnScore(user.id, pts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, \`\${markedBuckets.length} Revision Note(s) Read\`);
              showClaimOverlay(earned);
            }
            reloadRevision();
          }}`
);

fs.writeFileSync(file, code);
