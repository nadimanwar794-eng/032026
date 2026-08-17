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
              const notesPts = markedBuckets.length * 5;
              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
              onUpdateUser(updated);
            }
            setShowAllNotesModal(false);
          }}`,
`          onTopicsMarked={(markedBuckets) => {
            markedBuckets.forEach(b => {
              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);
              markNotesReviewed(k, settings?.revisionConfig);
            });
            if (onUpdateUser && markedBuckets.length > 0) {
              const notesPts = markedBuckets.length * 10;
              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };
              onUpdateUser(updated);
              // Calculate points correctly as per tryEarnScore and show popup overlay
              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';
              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));
              const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, \`\${markedBuckets.length} Revision Note(s) Read\`);
              showClaimOverlay(earned);
            }
            setShowAllNotesModal(false);
            reloadRevision();
          }}`
);

fs.writeFileSync(file, code);
