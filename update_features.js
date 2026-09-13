const fs = require('fs');

// 1. Update src/constants.ts
let constantsCode = fs.readFileSync('artifacts/iic-study-app-replit/src/constants.ts', 'utf8');

const newFeatures = `export const NSTA_DEFAULT_FEATURES = [
    { category: '⭐ PAGE 1', id: 'LEADER_BOARD', label: 'Leader Board', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'READING_MODE', label: 'Reading mode', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'WRITING_MODE', label: 'Writing mode', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'MCQ_MODE', label: 'Mcq mode', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'PROJECTOR_MODE', label: 'Projector mode', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'FLASHCARD', label: 'Flashcard', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'PDF', label: 'Pdf', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'VIDEO', label: 'Video', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'SOLUTION_MCQ', label: 'Solution (Mcq)', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'OFFICIAL_MARKSHEET', label: 'Official Marksheet', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'FULL_ANALYSIS', label: 'Full Analysis', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'REVISION_HUB', label: 'Revision Hub', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'ROUTINE', label: 'Routine', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'COMMUNITY', label: 'Community', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'GLOBAL_MESSAGE', label: 'Global message', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'MCQ', label: 'Mcq', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'HELP_ADMIN', label: 'Help (Admin support)', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'THEME_STUDIO', label: 'Theme Studio', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'SCORE_HISTORY', label: 'Score History', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'ROUTINE_COMPILATION', label: 'Routine multiple Books compilation', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'NSTA_MESSENGER', label: 'Nsta messenger', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'DAILY_LIMITE', label: 'Daily limite', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'VP_MULTIPLAYER', label: 'Vp multiplayer', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'CREDIT_DISCOUNT', label: 'Credit Discount', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'FONT_STYLE_COLOR', label: 'Font & style color', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'OFFLINE_DOWNLOAD', label: 'Offline Download', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'DAILY_CLAIM', label: 'Daily claim', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '⭐ PAGE 1', id: 'STORE_DISCOUNT', label: 'Store discount', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '🚀 PAGE 2', id: 'WRITING_CORRECTION', label: 'Writing & Correction mode', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '🚀 PAGE 2', id: 'BASIC_THEME', label: 'Basic Theme', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '🚀 PAGE 2', id: 'ULTRA_THEME', label: 'Ultra Theme', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '🚀 PAGE 2', id: 'MCQ_LIMITE', label: 'Mcq limite', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 },
    { category: '🚀 PAGE 2', id: 'NAME_CHANGE', label: 'Name change', visible: true, allowedTiers: ['FREE', 'BASIC', 'ULTRA'], limits: {}, creditCost: 0 }
];`;

const startIndex = constantsCode.indexOf('export const NSTA_DEFAULT_FEATURES = [');
const endIndex = constantsCode.indexOf('];', startIndex) + 2;

if (startIndex !== -1 && endIndex !== -1) {
    constantsCode = constantsCode.substring(0, startIndex) + newFeatures + constantsCode.substring(endIndex);
    fs.writeFileSync('artifacts/iic-study-app-replit/src/constants.ts', constantsCode);
    console.log("Updated constants.ts successfully.");
} else {
    console.log("Failed to find NSTA_DEFAULT_FEATURES in constants.ts");
}

// 2. Update src/utils/featureRegistry.ts to rename "NSTA Control" to "Nsta"
let registryCode = fs.readFileSync('artifacts/iic-study-app-replit/src/utils/featureRegistry.ts', 'utf8');
registryCode = registryCode.replace(/label: 'NSTA Control',/g, "label: 'Nsta',");
fs.writeFileSync('artifacts/iic-study-app-replit/src/utils/featureRegistry.ts', registryCode);
console.log("Updated featureRegistry.ts successfully.");

