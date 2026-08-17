const fs = require('fs');
const file = 'artifacts/iic-study-app/src/components/DailyEventPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// I should import `toast` from 'sonner' and show it to be 100% sure the user sees a pop-up.
// Add import { toast } from 'sonner';
// And in onTopicsMarked, add toast.success("Reading task completed!");
// The user says "Pop up na dioh raha na complite ka kpi pop up hai na notification dikh raha".
// The existing `claimOverlay` is very specific to earning points, maybe because I added `setShowAllNotesModal(false)` *before* `reloadRevision()`, or maybe `setClaimOverlay` is somehow batched out? No.
// Let's check if 'sonner' is used.
if (!code.includes("import { toast }")) {
  code = code.replace("import React,", "import { toast } from 'sonner';\nimport React,");
}

const target = "          onTopicsMarked={(markedBuckets) => {\n            markedBuckets.forEach(b => {\n              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);\n              markNotesReviewed(k, settings?.revisionConfig);\n            });\n            if (onUpdateUser && markedBuckets.length > 0) {\n              const notesPts = markedBuckets.length * 5;\n              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };\n              onUpdateUser(updated);\n              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';\n              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));\n              const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, `${markedBuckets.length} Revision Note(s) Read`);\n              showClaimOverlay(earned);\n              setTimeout(() => {\n                toast.success(\"Reading Task Completed!\", {\n                  description: `${markedBuckets.length} topics marked as read.`\n                });\n              }, 500);\n            }\n            setShowAllNotesModal(false);\n            reloadRevision();\n          }}";

const oldTarget = "          onTopicsMarked={(markedBuckets) => {\n            markedBuckets.forEach(b => {\n              const k = bucketKey(b.subjectId, b.chapterId, b.pageKey, b.topic);\n              markNotesReviewed(k, settings?.revisionConfig);\n            });\n            if (onUpdateUser && markedBuckets.length > 0) {\n              const notesPts = markedBuckets.length * 5;\n              const updated = { ...user, totalScore: (user.totalScore || 0) + notesPts };\n              onUpdateUser(updated);\n              const tier = user.subscriptionLevel || user.subscriptionTier || 'FREE';\n              const isPrem = !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE'));\n              const earned = tryEarnScore(user.id, notesPts, tier, isPrem, 0, 'REVISION_NOTES_READ', undefined, undefined, `${markedBuckets.length} Revision Note(s) Read`);\n              showClaimOverlay(earned);\n            }\n            setShowAllNotesModal(false);\n            reloadRevision();\n          }}";

if (code.includes(oldTarget)) {
  code = code.replace(oldTarget, target);
  fs.writeFileSync(file, code);
  console.log('Patched with toast.');
} else {
  console.log('Target block not found for toast.');
}
