import { ClassLevel, Subject, Chapter, LessonContent, Language, Board, Stream, ContentType, MCQItem, SystemSettings } from "../types";
import { STATIC_SYLLABUS, DEFAULT_SUBJECTS } from "../constants";
import { getChapterData, getCustomSyllabus } from "../firebase";
import { storage } from "../utils/storage";

// --- AI DISABLED ---
// Groq and Gemini have been removed from this app.
// All AI functions return safe stubs.

export const callGroqApi = async (_messages: any[], _model?: string): Promise<string> => {
    return "⚠️ AI service is currently disabled.";
};

export const callGroqApiWithTools = async (_messages: any[], _tools: any[], _model?: string): Promise<any> => {
    return { content: "⚠️ AI service is currently disabled." };
};

export const callGroqApiStream = async (_messages: any[], onChunk: (text: string) => void, _model?: string): Promise<string> => {
    const msg = "⚠️ AI service is currently disabled.";
    onChunk(msg);
    return msg;
};

export const executeWithRotation = async <T>(
    operation: () => Promise<T>,
    _usageType?: 'PILOT' | 'STUDENT'
): Promise<T> => {
    return operation();
};

export const translateToHindi = async (content: string, _isJson?: boolean, _usageType?: 'PILOT' | 'STUDENT'): Promise<string> => {
    return content;
};

export const generateCustomNotes = async (_userTopic: string, _adminPrompt: string, _modelName?: string): Promise<string> => {
    return "⚠️ AI note generation is currently disabled.";
};

export const generateUltraAnalysis = async (_data: any, _settings?: SystemSettings): Promise<string> => {
    return "{}";
};

export const generateDevCode = async (_userPrompt: string): Promise<string> => {
    return "// AI Dev Console is disabled.";
};

export const generateStudyRoutine = async (_userContext: any, _settings?: SystemSettings): Promise<string> => {
    return "{}";
};

export const generateTestPaper = async (_topics: any, _count: number, _language: Language): Promise<MCQItem[]> => {
    return [];
};

// --- ADMIN CONTENT FETCHING (preserved) ---
const getAdminContent = async (
    board: Board,
    classLevel: ClassLevel,
    stream: Stream | null,
    subject: Subject,
    chapterId: string,
    type: ContentType,
    syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL'
): Promise<LessonContent | null> => {
    const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
    const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapterId}`;

    try {
        let parsed = await getChapterData(key);
        if (!parsed) {
            parsed = await storage.getItem(key);
        }

        if (parsed) {
            if (type === 'PDF_FREE' || type === 'NOTES_SIMPLE') {
                const linkKey = syllabusMode === 'SCHOOL' ? 'schoolPdfLink' : 'competitionPdfLink';
                const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolFreeNotesHtml' : 'competitionFreeNotesHtml';
                const link = parsed[linkKey] || parsed.freeLink;
                const html = parsed[htmlKey] || parsed.freeNotesHtml;

                if (link && type === 'PDF_FREE') {
                    return { id: Date.now().toString(), title: "Free Study Material", subtitle: "Provided by Admin", content: link, type: 'PDF_FREE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
                if (html) {
                    return { id: Date.now().toString(), title: "Study Notes", subtitle: "Detailed Notes (Admin)", content: html, type: 'NOTES_SIMPLE', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
            }

            if (type === 'PDF_PREMIUM' || type === 'NOTES_PREMIUM') {
                const linkKey = syllabusMode === 'SCHOOL' ? 'schoolPdfPremiumLink' : 'competitionPdfPremiumLink';
                const htmlKey = syllabusMode === 'SCHOOL' ? 'schoolPremiumNotesHtml' : 'competitionPremiumNotesHtml';
                const link = parsed[linkKey] || parsed.premiumLink;
                const html = parsed[htmlKey] || parsed.premiumNotesHtml;

                if (link && type === 'PDF_PREMIUM') {
                    return { id: Date.now().toString(), title: "Premium Notes", subtitle: "High Quality Content", content: link, type: 'PDF_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
                }
                if (html) {
                    const htmlKeyHI = syllabusMode === 'SCHOOL' ? 'schoolPremiumNotesHtml_HI' : 'competitionPremiumNotesHtml_HI';
                    const htmlHI = parsed[htmlKeyHI];
                    return {
                        id: Date.now().toString(), title: "Premium Notes", subtitle: "Exclusive Content (Admin)", content: html, type: 'NOTES_PREMIUM', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false,
                        schoolPremiumNotesHtml_HI: syllabusMode === 'SCHOOL' ? htmlHI : undefined,
                        competitionPremiumNotesHtml_HI: syllabusMode === 'COMPETITION' ? htmlHI : undefined
                    };
                }
            }

            if (type === 'VIDEO_LECTURE' && (parsed.premiumVideoLink || parsed.freeVideoLink)) {
                return { id: Date.now().toString(), title: "Video Lecture", subtitle: "Watch Class", content: parsed.premiumVideoLink || parsed.freeVideoLink, type: 'PDF_VIEWER', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
            }

            if (type === 'PDF_VIEWER' && parsed.link) {
                return { id: Date.now().toString(), title: "Class Notes", subtitle: "Provided by Teacher", content: parsed.link, type: 'PDF_VIEWER', dateCreated: new Date().toISOString(), subjectName: subject.name, isComingSoon: false };
            }

            if ((type === 'MCQ_SIMPLE' || type === 'MCQ_ANALYSIS') && parsed.manualMcqData) {
                return { id: Date.now().toString(), title: "Class Test (Admin)", subtitle: `${parsed.manualMcqData.length} Questions`, content: '', type: type, dateCreated: new Date().toISOString(), subjectName: subject.name, mcqData: parsed.manualMcqData, manualMcqData_HI: parsed.manualMcqData_HI };
            }
        }
    } catch (e) {
        console.error("Content Lookup Error", e);
    }
    return null;
};

const chapterCache: Record<string, Chapter[]> = {};

export const fetchChapters = async (
    board: Board,
    classLevel: ClassLevel,
    stream: Stream | null,
    subject: Subject,
    language: Language
): Promise<Chapter[]> => {
    const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
    const cacheKey = `${board}-${classLevel}${streamKey}-${subject.name}-${language}`;

    const firebaseChapters = await getCustomSyllabus(cacheKey);
    if (firebaseChapters && firebaseChapters.length > 0) return firebaseChapters;

    const customChapters = await storage.getItem<Chapter[]>(`nst_custom_chapters_${cacheKey}`);
    if (customChapters && customChapters.length > 0) return customChapters;

    if (chapterCache[cacheKey]) return chapterCache[cacheKey];

    const staticKey = `${board}-${classLevel}-${subject.name}`;
    let staticList = STATIC_SYLLABUS[staticKey];

    if (!staticList) {
        const defaultSub = Object.values(DEFAULT_SUBJECTS).find((s: any) => s.id === subject.id);
        if (defaultSub) {
            const fallbackKey = `${board}-${classLevel}-${(defaultSub as any).name}`;
            staticList = STATIC_SYLLABUS[fallbackKey];
        }
    }

    if (staticList && staticList.length > 0) {
        const chapters: Chapter[] = staticList.map((title: string, idx: number) => ({
            id: `static-${idx + 1}`,
            title,
            description: `Chapter ${idx + 1}`
        }));
        chapterCache[cacheKey] = chapters;
        return chapters;
    }

    return [];
};

export const fetchLessonContent = async (
    board: Board,
    classLevel: ClassLevel,
    stream: Stream | null,
    subject: Subject,
    chapter: Chapter,
    language: Language,
    type: ContentType,
    existingMCQCount: number = 0,
    isPremium: boolean = false,
    targetQuestions: number = 15,
    adminPromptOverride: string = "",
    allowAiGeneration: boolean = false,
    syllabusMode: 'SCHOOL' | 'COMPETITION' = 'SCHOOL',
    forceRegenerate: boolean = false,
    dualGeneration: boolean = false,
    usageType: 'PILOT' | 'STUDENT' = 'STUDENT',
    onStream?: (text: string) => void
): Promise<LessonContent> => {

    if (!forceRegenerate) {
        const adminContent = await getAdminContent(board, classLevel, stream, subject, chapter.id, type, syllabusMode);
        if (adminContent) {
            return { ...adminContent, title: chapter.title };
        }
    }

    return {
        id: Date.now().toString(),
        title: chapter.title,
        subtitle: "Content Unavailable",
        content: "",
        type,
        dateCreated: new Date().toISOString(),
        subjectName: subject.name,
        isComingSoon: true
    };
};
