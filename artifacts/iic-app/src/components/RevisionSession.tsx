// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, SystemSettings, MCQItem } from '../types';
import { X, BookOpen, Zap, CheckCircle, AlertCircle, ChevronRight, Check, RotateCcw, Loader2, Volume2, FileText } from 'lucide-react';
import { getChapterData, saveUserToLive } from '../firebase';
import { storage } from '../utils/storage';
import { DEFAULT_SUBJECTS } from '../constants';
import { addMistakes, removeMistakeByQuestion } from '../utils/mistakeBank';
import { ChunkedNotesReader } from './ChunkedNotesReader';
import { renderMathInHtml } from '../utils/mathUtils';

interface Props {
    user: User;
    settings?: SystemSettings;
    chapterId: string;
    subTopic: string;
    chapterTitle: string;
    subjectName?: string;
    onClose: () => void;
    onUpdateUser: (u: User) => void;
    onSessionComplete?: (status: 'weak' | 'average' | 'strong', topicName: string) => void;
}

export const RevisionSession: React.FC<Props> = ({ user, settings, chapterId, subTopic, chapterTitle, subjectName, onClose, onUpdateUser, onSessionComplete }) => {
    const [activeTab, setActiveTab] = useState<'NOTES' | 'MCQ'>('NOTES');
    const [notesViewMode, setNotesViewMode] = useState<'html' | 'chunk'>('html');
    const [loading, setLoading] = useState(true);
    const [notesContent, setNotesContent] = useState<string | null>(null);
    const [mcqData, setMcqData] = useState<MCQItem[]>([]);

    // Determine if MCQ is available based on status and time
    // Logic: Week (WEAK) -> 2 days after revision
    // Average (AVERAGE) -> 5 days after revision
    // Strong (STRONG) -> 10 days after revision
    const [isMcqAvailable, setIsMcqAvailable] = useState(false);
    const [readingTimer, setReadingTimer] = useState(10); // 10s Mandatory Reading

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (activeTab === 'NOTES' && readingTimer > 0) {
            interval = setInterval(() => {
                setReadingTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTab, readingTimer]);

    useEffect(() => {
        const checkMcqAvailability = () => {
            if (!user.mcqHistory) return;
            
            // Find last revision entry for this subtopic
            const relevantHistory = user.mcqHistory
                .filter(h => h.chapterId === chapterId)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (relevantHistory.length > 0) {
                const lastEntry = relevantHistory[0];
                let status = 'AVERAGE';
                if (lastEntry.ultraAnalysisReport) {
                    try {
                        const parsed = JSON.parse(lastEntry.ultraAnalysisReport);
                        const topic = parsed.topics?.find((t: any) => t.name === subTopic);
                        if (topic) status = topic.status;
                    } catch (e) {}
                }

                const lastDate = new Date(lastEntry.date);
                const now = new Date();
                const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

                let requiredDays = 5; // Default AVERAGE
                if (status === 'WEAK') requiredDays = 2;
                else if (status === 'STRONG') requiredDays = 10;
                // Note: We don't check streak here, but 7 is safe minimum for STRONG.
                // If it was a 30-day streak, diffDays will naturally be < 30 until due.

                setIsMcqAvailable(diffDays >= requiredDays);
            } else {
                // If no history, assume it's first revision or not set up, allow MCQ
                setIsMcqAvailable(true);
            }
        };
        checkMcqAvailability();
    }, [user.mcqHistory, chapterId, subTopic]);

    // MCQ State
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<number, number>>({}); // All selected answers
    const [notesRead, setNotesRead] = useState(false); // Track if user read notes

    // Review screen state
    const [showReview, setShowReview] = useState(false);
    const [sessionResult, setSessionResult] = useState<any>(null);

    // Extract stable user properties
    const userBoard = user.board || 'CBSE';
    const userClass = user.classLevel || '10';
    const userStream = user.stream;

    useEffect(() => {
        const loadContent = async () => {
            setLoading(true);
            try {
                let data = null;
                const streamKey = (userClass === '11' || userClass === '12') && userStream ? `-${userStream}` : '';

                let subject = subjectName || 'Unknown';
                // REVERSE MAP FOR HINDI
                const hindiMapReverse: Record<string, string> = {
                    'भौतिकी': 'Physics',
                    'रसायन शास्त्र': 'Chemistry',
                    'जीव विज्ञान': 'Biology',
                    'गणित': 'Mathematics',
                    'इतिहास': 'History',
                    'भूगोल': 'Geography',
                    'राजनीति विज्ञान': 'Political Science',
                    'अर्थशास्त्र': 'Economics',
                    'व्यवसाय अध्ययन': 'Business Studies',
                    'लेखाशास्त्र': 'Accountancy',
                    'विज्ञान': 'Science',
                    'सामाजिक विज्ञान': 'Social Science',
                    'अंग्रेजी': 'English',
                    'हिन्दी': 'Hindi',
                    'संस्कृत': 'Sanskrit',
                    'कंप्यूटर विज्ञान': 'Computer Science'
                };
                if (hindiMapReverse[subject]) {
                    subject = hindiMapReverse[subject];
                }


                // 1. Try Strict Key
                const strictKey = `nst_content_${userBoard}_${userClass}${streamKey}_${subject}_${chapterId}`;
                data = await storage.getItem(strictKey);

                // 2. If Failed, Search by Chapter ID (Robust Search)
                if (!data) {
                    try {
                        const allKeys = await storage.keys();
                        const matchKey = allKeys.find(k => k.endsWith(`_${chapterId}`) && k.startsWith('nst_content_'));
                        if (matchKey) {
                            data = await storage.getItem(matchKey);
                        }
                    } catch(e) { console.warn("Storage Scan failed", e); }
                }

                // 3. Fallback to Firebase
                if (!data) {
                    try {
                        data = await getChapterData(strictKey);
                    } catch(e) { console.error("Firebase fetch failed", e); }
                }

                if (data) {
                    // Filter Notes (Normalize Matching)
                    let relevantNote = null;
                    const combinedNotes = [...(data.topicNotes || []), ...(data.deepDiveEntries || []), ...(data.allTopics || [])];
                    if (combinedNotes.length > 0) {
                        relevantNote = findRelevantNote(combinedNotes, subTopic);
                    }

                    if (relevantNote && relevantNote.content) {
                        setNotesContent(formatMcqNotes(relevantNote.content));
                    } else if (data.content && data.content.length > 5) {
                        // If no specific topic notes but main content exists, show main content as fallback
                        setNotesContent(formatMcqNotes(data.content));
                    } else if (combinedNotes.length > 0) {
                        // Fallback to aggregating all topic notes if data.content is insufficient
                        setNotesContent(combinedNotes.map((n: any) => formatMcqNotes(n.content)).join('<hr class="my-6 border-slate-200" />'));
                    }

                    // Filter MCQs (Normalize Matching) + Randomize order each session
                    if (data.manualMcqData) {
                        const normSubTopic = subTopic.toLowerCase().trim();
                        const relevantMcqs = data.manualMcqData.filter((q: any) => q.topic && q.topic.toLowerCase().trim() === normSubTopic);
                        const shuffled = [...relevantMcqs];
                        for (let i = shuffled.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                        }
                        setMcqData(shuffled);
                    }
                } else {
                    // 4. Ultimate Fallback: Try to fetch using only Chapter ID from content_data collection directly
                    try {
                        const directData = await getChapterData(chapterId);
                        if (directData) {
                            let relevantNote = null;
                            const combinedDirectNotes = [...(directData.topicNotes || []), ...(directData.deepDiveEntries || []), ...(directData.allTopics || [])];
                            if (combinedDirectNotes.length > 0) {
                                relevantNote = findRelevantNote(combinedDirectNotes, subTopic);
                            }

                            if (relevantNote && relevantNote.content) {
                                setNotesContent(formatMcqNotes(relevantNote.content));
                            } else if (directData.content && directData.content.length > 20) {
                                setNotesContent(formatMcqNotes(directData.content));
                            } else if (combinedDirectNotes.length > 0) {
                                setNotesContent(combinedDirectNotes.map((n: any) => formatMcqNotes(n.content)).join('<hr class="my-6 border-slate-200" />'));
                            }

                            if (directData.manualMcqData) {
                                const normSubTopic = subTopic.toLowerCase().trim();
                                const relevantMcqs = directData.manualMcqData.filter((q: any) => q.topic && q.topic.toLowerCase().trim() === normSubTopic);
                                const shuffled = [...relevantMcqs];
                                for (let i = shuffled.length - 1; i > 0; i--) {
                                    const j = Math.floor(Math.random() * (i + 1));
                                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                                }
                                setMcqData(shuffled);
                            }
                        }
                    } catch(e) { console.error("Ultimate Firebase fallback failed", e); }
                }
            } catch (e) {
                console.error("Failed to load revision content", e);
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [chapterId, subTopic, subjectName, userBoard, userClass, userStream]);

    const handleOptionSelect = (idx: number) => {
        if (selectedOption !== null) return; // Prevent change
        setSelectedOption(idx);
        setUserAnswers(prev => ({ ...prev, [currentQIndex]: idx }));
    };

    const nextQuestion = () => {
        if (currentQIndex < mcqData.length - 1) {
            setCurrentQIndex(prev => prev + 1);
            setSelectedOption(null);
        }
    };

    // Phase 1 — compute score from answered Qs only, show review
    const handleSubmit = () => {
        const answeredKeys = Object.keys(userAnswers).map(Number);
        const answeredCount = answeredKeys.length;
        let correctCount = 0;
        const items = answeredKeys.map(i => {
            const q = mcqData[i];
            const isCorrect = userAnswers[i] === q.correctAnswer;
            if (isCorrect) correctCount++;
            return { questionIdx: i, question: q.question, options: q.options || [], userAnswerIdx: userAnswers[i], correctAnswer: q.correctAnswer, explanation: q.explanation, isCorrect };
        });
        const percentage = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;
        const status: 'weak' | 'average' | 'strong' = percentage < 50 ? 'weak' : percentage >= 80 ? 'strong' : 'average';
        const result = { score: correctCount, answeredCount, percentage, status, items };
        setSessionResult(result);
        setShowReview(true);

        // Save automatically on submit — no button needed
        try {
            items.forEach((item: any) => {
                const q = mcqData[item.questionIdx];
                if (item.isCorrect) {
                    removeMistakeByQuestion(q.question, q.correctAnswer);
                } else {
                    addMistakes([{ question: q.question, options: q.options || [], correctAnswer: q.correctAnswer, explanation: q.explanation, topic: q.topic || subTopic, chapterTitle, subjectName: subjectName || 'Revision', classLevel: user.classLevel, board: user.board, source: 'REVISION' }]);
                }
            });
        } catch (err) { console.warn('mistakeBank update failed:', err); }

        const ultraReport = { topics: [{ name: subTopic, status: status.toUpperCase() }] };
        const newEntry = { testId: `rev-${Date.now()}`, chapterId, chapterTitle, subjectName: subjectName || 'Revision', score: correctCount, totalQuestions: answeredCount, date: new Date().toISOString(), type: 'REVISION_MCQ', ultraAnalysisReport: JSON.stringify(ultraReport) };
        const updatedUser = { ...user, mcqHistory: [...(user.mcqHistory || []), newEntry] };
        onUpdateUser(updatedUser);
        saveUserToLive(updatedUser);
        onSessionComplete?.(status, subTopic);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-black text-slate-800 leading-tight">{subTopic}</h2>
                    <p className="text-xs text-slate-600 font-bold">{chapterTitle} • Revision Mode</p>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* TABS */}
            <div className="flex p-2 bg-slate-50 gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('NOTES')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'NOTES' ? 'bg-white shadow text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <BookOpen size={16} /> Study Notes
                </button>
                <button
                    onClick={() => {
                        if (!isMcqAvailable) return;
                        if (readingTimer > 0) {
                            alert(`Please read the notes for ${readingTimer} more seconds before starting the test.`);
                            return;
                        }
                        setActiveTab('MCQ');
                        setNotesRead(true);
                    }}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${!isMcqAvailable ? 'opacity-50 cursor-not-allowed text-slate-300' : activeTab === 'MCQ' ? 'bg-white shadow text-purple-600 ring-1 ring-purple-100' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <Zap size={16} />
                    {isMcqAvailable ? (readingTimer > 0 ? `Wait (${readingTimer}s)` : 'Quick Practice') : 'Locked'}
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <Loader2 size={32} className="animate-spin mb-2" />
                        <p className="text-xs font-bold">Fetching Revision Data...</p>
                    </div>
                ) : (
                    <>
                        {/* NOTES VIEW */}
                        {activeTab === 'NOTES' && (
                            <div className="max-w-3xl mx-auto">
                                {notesContent ? (
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                                        {/* View mode toggle */}
                                        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-100">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><BookOpen size={11} /> Notes</p>
                                            <button
                                                onClick={() => setNotesViewMode(m => m === 'html' ? 'chunk' : 'html')}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-black transition-all border ${notesViewMode === 'chunk' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                                title={notesViewMode === 'html' ? 'Switch to TTS Reader' : 'Switch to Styled Notes'}
                                            >
                                                {notesViewMode === 'html' ? <Volume2 size={13} /> : <FileText size={13} />}
                                            </button>
                                        </div>
                                        <div className="p-6 pt-3">
                                        {notesViewMode === 'chunk' ? (
                                            <ChunkedNotesReader
                                                key="revision-session-chunk"
                                                content={notesContent
                                                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                                    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
                                                    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
                                                    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()}
                                                topBarLabel={subTopic}
                                                hideTopBar={false}
                                                preferChunkMode
                                            />
                                        ) : (
                                            <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(notesContent) }} className="prose prose-sm prose-slate max-w-none" />
                                        )}
                                        
                                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
                                            {isMcqAvailable ? (
                                                <button
                                                    onClick={() => {
                                                        setNotesRead(true);
                                                        setActiveTab('MCQ');
                                                    }}
                                                    disabled={readingTimer > 0}
                                                    className={`flex items-center gap-2 px-8 py-4 font-bold rounded-2xl shadow-xl transition-all ${
                                                        readingTimer > 0
                                                        ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                                        : 'bg-slate-900 text-white hover:bg-indigo-600 hover:scale-105 active:scale-95'
                                                    }`}
                                                >
                                                    {readingTimer > 0 ? (
                                                        <><Loader2 size={18} className="animate-spin" /> Read Carefully ({readingTimer}s)</>
                                                    ) : (
                                                        <><Zap size={18} className="text-yellow-400" /> Start MCQ Practice</>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-200 text-xs font-bold text-center">
                                                    MCQ Practice will be unlocked after the required revision interval.
                                                </div>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
                                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-500">
                                            <BookOpen size={32} />
                                        </div>
                                        <p className="font-bold text-slate-600">No specific notes found for this topic.</p>
                                        <p className="text-xs mt-1">Try checking the main chapter notes.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MCQ VIEW */}
                        {activeTab === 'MCQ' && (
                            <div className="w-full mx-auto h-full flex flex-col">
                                {!notesRead && !loading ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
                                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
                                            <BookOpen size={32} />
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg">Notes First!</h3>
                                        <p className="text-sm text-slate-600 mt-1 mb-6">Please read the study notes carefully before starting the practice MCQ.</p>
                                        <button
                                            onClick={() => setActiveTab('NOTES')}
                                            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all"
                                        >
                                            Go to Notes
                                        </button>
                                    </div>
                                ) : mcqData.length > 0 ? (
                                    <div className="flex-1 flex flex-col gap-4">
                                        {/* PROGRESS BAR */}
                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-600 transition-all duration-300"
                                                style={{ width: `${((currentQIndex + 1) / mcqData.length) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                            <span>Question {currentQIndex + 1} / {mcqData.length}</span>
                                            <span>Topic: {subTopic}</span>
                                        </div>

                                        {/* QUESTION CARD */}
                                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex-1 flex flex-col">
                                            <h3 className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">
                                                {mcqData[currentQIndex].question}
                                            </h3>

                                            <div className="space-y-3 flex-1">
                                                {mcqData[currentQIndex].options.map((opt, idx) => {
                                                    const isSelected = selectedOption === idx;
                                                    const stateClass = isSelected
                                                        ? "bg-purple-100 border-purple-500 text-purple-800 font-bold"
                                                        : selectedOption !== null
                                                            ? "opacity-50 border-slate-100 text-slate-500"
                                                            : "border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-slate-600";

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleOptionSelect(idx)}
                                                            disabled={selectedOption !== null}
                                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${stateClass}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                                                                isSelected
                                                                    ? 'bg-purple-500 border-purple-600 text-white'
                                                                    : 'bg-white border-slate-300 text-slate-600'
                                                            }`}>
                                                                {['A','B','C','D'][idx]}
                                                            </div>
                                                            <span className="flex-1 text-sm">{opt}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* NEXT & SUBMIT BUTTONS */}
                                        <div className="space-y-3 pb-8 animate-in slide-in-from-bottom-4">
                                            {selectedOption !== null && currentQIndex < mcqData.length - 1 && (
                                                <button
                                                    onClick={nextQuestion}
                                                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    Next Question <ChevronRight size={18} />
                                                </button>
                                            )}
                                            {(() => {
                                                const answered = Object.keys(userAnswers).length;
                                                const minRequired = Math.min(30, mcqData.length);
                                                const ready = answered >= minRequired;
                                                return (
                                                    <button
                                                        onClick={handleSubmit}
                                                        disabled={!ready}
                                                        className={`w-full py-4 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${ready ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                                                    >
                                                        {ready
                                                            ? `✓ Submit & Review (${answered} Answered)`
                                                            : `${answered}/${minRequired} — ${minRequired - answered} aur chahiye`}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
                                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-500">
                                            <Zap size={32} />
                                        </div>
                                        <p className="font-bold text-slate-600">No quick practice questions found.</p>
                                        <p className="text-xs mt-1">Try taking the full chapter test.</p>
                                        <button
                                            onClick={finishSession}
                                            className="mt-4 px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl"
                                        >
                                            Go Back
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── REVIEW SCREEN ─────────────────────────────────────── */}
            {showReview && sessionResult && (
                <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-bottom-6">
                    {/* Review Header */}
                    <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Session Review</h2>
                            <p className="text-xs text-slate-500 font-bold">{subTopic} · {chapterTitle}</p>
                        </div>
                    </div>

                    {/* Score Summary */}
                    <div className={`mx-4 mt-4 p-5 rounded-2xl flex items-center justify-between ${
                        sessionResult.status === 'strong' ? 'bg-emerald-50 border border-emerald-200' :
                        sessionResult.status === 'average' ? 'bg-amber-50 border border-amber-200' :
                        'bg-rose-50 border border-rose-200'
                    }`}>
                        <div>
                            <p className={`text-4xl font-black ${
                                sessionResult.status === 'strong' ? 'text-emerald-600' :
                                sessionResult.status === 'average' ? 'text-amber-600' : 'text-rose-600'
                            }`}>{sessionResult.score}<span className="text-xl font-bold text-slate-400">/{sessionResult.answeredCount}</span></p>
                            <p className="text-sm font-bold text-slate-600 mt-0.5">{Math.round(sessionResult.percentage)}% correct</p>
                        </div>
                        <div className="text-right">
                            <span className={`text-base font-black px-4 py-2 rounded-xl block ${
                                sessionResult.status === 'strong' ? 'bg-emerald-500 text-white' :
                                sessionResult.status === 'average' ? 'bg-amber-500 text-white' :
                                'bg-rose-500 text-white'
                            }`}>
                                {sessionResult.status === 'strong' ? '💪 Strong' : sessionResult.status === 'average' ? '🙂 Average' : '😕 Weak'}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1 font-bold">Schedule ho jayega</p>
                        </div>
                    </div>

                    {/* Q&A Review list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
                        {sessionResult.items.map((item: any, idx: number) => (
                            <div key={idx} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${item.isCorrect ? 'border-emerald-200' : 'border-rose-200'}`}>
                                <div className={`px-4 py-2 flex items-center gap-2 ${item.isCorrect ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                    {item.isCorrect
                                        ? <CheckCircle size={13} className="text-emerald-600" />
                                        : <AlertCircle size={13} className="text-rose-600" />}
                                    <span className={`text-xs font-black ${item.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        Q{item.questionIdx + 1} · {item.isCorrect ? '✓ Sahi' : '✗ Galat'}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm font-bold text-slate-800 mb-3 leading-relaxed">{item.question}</p>
                                    <div className="space-y-1.5">
                                        {item.options.map((opt: string, oi: number) => {
                                            const isUserAns = item.userAnswerIdx === oi;
                                            const isCorrectAns = item.correctAnswer === oi;
                                            return (
                                                <div key={oi} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${
                                                    isCorrectAns ? 'bg-emerald-100 text-emerald-800 font-bold' :
                                                    isUserAns && !item.isCorrect ? 'bg-rose-100 text-rose-700 line-through' :
                                                    'bg-slate-50 text-slate-500'
                                                }`}>
                                                    <span className="font-black text-[11px] shrink-0">{['A','B','C','D'][oi]}</span>
                                                    <span className="flex-1">{opt}</span>
                                                    {isCorrectAns && <Check size={13} className="text-emerald-600 shrink-0" />}
                                                    {isUserAns && !item.isCorrect && <X size={13} className="text-rose-600 shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {item.explanation && (
                                        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                                            <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">💡 Explanation</p>
                                            <p className="text-xs text-indigo-800 leading-relaxed">{item.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer — Close */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-10">
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            ✅ Saved — Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
