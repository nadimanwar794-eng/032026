const fs = require('fs');
const file = 'artifacts/iic-study-app/src/components/DailyEventPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = "          onTopicsMarked={(markedBuckets) => {\n            markedBuckets.forEach(b => {\n              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);\n              markNotesReviewed(k, settings?.revisionConfig);\n            });\n            if (onUpdateUser && markedBuckets.length > 0) {\n              const notesPts = markedBuckets.length * 5;\n              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };\n              onUpdateUser(updated);\n            }\n            setShowAllNotesModal(false);\n            reloadRevision();\n          }}";

const replacement = "          onTopicsMarked={(markedBuckets) => {\n            markedBuckets.forEach(b => {\n              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);\n              markNotesReviewed(k, settings?.revisionConfig);\n            });\n            if (onUpdateUser && markedBuckets.length > 0) {\n              const notesPts = markedBuckets.length * 5;\n              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };\n              onUpdateUser(updated);\n              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';\n              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));\n              const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, `${markedBuckets.length} Revision Note(s) Read`);\n              showClaimOverlay(earned);\n            }\n            setShowAllNotesModal(false);\n            reloadRevision();\n          }}";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Patched correctly.');
} else {
  console.log('Target block not found.');
}
