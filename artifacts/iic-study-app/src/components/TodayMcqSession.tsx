// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { User, MCQItem, MCQResult, TopicItem, SystemSettings } from '../types';
import { X, CheckCircle, ArrowRight, Loader2, BrainCircuit, AlertCircle, List, Tag, Trophy, TrendingDown, Minus, TrendingUp, Star, Calendar, ChevronRight } from 'lucide-react';
import { getChapterData, saveUserToLive, saveTestResult, saveDemand } from '../firebase';
import { storage } from '../utils/storage';
import { generateAnalysisJson } from '../utils/analysisUtils';
import { recordAttempt as recordRevisionAttempt, applyInitialSchedule, bucketKey } from '../utils/revisionTrackerV2';
import { addMistakes, removeMistakeByQuestion } from '../utils/mistakeBank';
import { getEffectiveDailyLimit, getLevelInfo, UNLIMITED } from '../utils/levelSystem';
import { SubscriptionEngine } from '../utils/engines/subscriptionEngine';
import { tryEarnScore, subtractDailyScore, getMcqStreakBonus } from '../utils/scoreSystem';

interface InterleavedQ extends MCQItem {
    _topicIndex: number;
    _topicName: string;
    _chapterId: string;
    _chapterName: string;
    _subjectId: string;
    _subjectName: string;
}

interface TopicSessionResult {
    topicName: string;
    chapterName: string;
    subjectName: string;
    correct: number;
    total: number;
    percentage: number;
    tier: 'weak' | 'average' | 'strong' | 'mastered';
    nextRevisionDays: number;
}

interface Props {
    user: User;
    topics: TopicItem[];
    onClose: () => void;
    onComplete: (results: MCQResult[], questions?: any[]) => void;
    settings?: SystemSettings | null;
    onTrackAnswer?: (isCorrect: boolean) => boolean;
    onUpdateUser?: (user: User) => void;
}

export const TodayMcqSession: React.FC<Props> = ({ user, topics, onClose, onComplete, settings, onTrackAnswer, onUpdateUser }) => {
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);
    const [loading, setLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Sab topics load ho rahe hain...');
    const [interleavedQuestions, setInterleavedQuestions] = useState<InterleavedQ[]>([]);
    const [qIndex, setQIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [showSidebar, setShowSidebar] = useState(false);
    const [totalTime, setTotalTime] = useState(0);
    const [noMcqTopics, setNoMcqTopics] = useState<string[]>([]);

    // Result screen state
    const [sessionSummary, setSessionSummary] = useState<TopicSessionResult[] | null>(null);
    const pendingCompleteRef = useRef<{ results: MCQResult[]; questions: any[] } | null>(null);

    // ── MCQ Score Popup ────────────────────────────────────────────────────────
    const [mcqScorePopup, setMcqScorePopup] = useState<number | null>(null);
    const [mcqScoreVisible, setMcqScoreVisible] = useState(false);
    const mcqPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showMcqScore = (pts: number) => {
        if (mcqPopupTimerRef.current) clearTimeout(mcqPopupTimerRef.current);
        setMcqScorePopup(pts);
        setMcqScoreVisible(true);
        mcqPopupTimerRef.current = setTimeout(() => setMcqScoreVisible(false), 1800);
    };

    const [mcqStreak, setMcqStreak] = useState(0);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => setTotalTime(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Load ALL topics upfront, then interleave ──────────────────────────
    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            const board = user.board || 'CBSE';
            const classLevel = user.classLevel || '10';
            const streamKey = (classLevel === '11' || classLevel === '12') && user.stream ? `-${user.stream}` : '';

            // Collect MCQs per topic
            const topicBuckets: InterleavedQ[][] = [];
            const skipped: string[] = [];

            for (let i = 0; i < topics.length; i++) {
                const topic = topics[i];
                setLoadingMsg(`Topic load ho raha hai: ${i + 1} / ${topics.length} — ${topic.name}`);

                try {
                    let data: any = null;
                    const subject = topic.subjectName || 'Unknown';
                    const strictKey = `nst_content_${board}_${classLevel}${streamKey}_${subject}_${topic.chapterId}`;
                    data = await storage.getItem(strictKey);
                    if (!data) data = await getChapterData(strictKey);
                    if (!data) data = await getChapterData(topic.chapterId);

                    let mcqs: MCQItem[] = [];
                    if (data && data.manualMcqData) {
                        const norm = topic.name.toLowerCase().trim();
                        mcqs = data.manualMcqData.filter((q: any) => q.topic && q.topic.toLowerCase().trim() === norm);
                        if (mcqs.length === 0) {
                            mcqs = data.manualMcqData.filter((q: any) => q.topic && q.topic.toLowerCase().includes(norm));
                        }
                        if (mcqs.length === 0) {
                            mcqs = data.manualMcqData;
                        }
                    }

                    if (mcqs.length === 0) {
                        skipped.push(topic.name);
                        saveDemand(user.id, `Missing MCQs for Revision: ${topic.name} (${topic.chapterName})`);
                        continue;
                    }

                    // Fisher-Yates shuffle within topic
                    for (let k = mcqs.length - 1; k > 0; k--) {
                        const j = Math.floor(Math.random() * (k + 1));
                        [mcqs[k], mcqs[j]] = [mcqs[j], mcqs[k]];
                    }

                    // Cap per topic at 20 to avoid burnout
                    const capped = mcqs.slice(0, 20);

                    // Tag with topic metadata
                    const tagged: InterleavedQ[] = capped.map(q => ({
                        ...q,
                        _topicIndex: i,
                        _topicName: topic.name,
                        _chapterId: topic.chapterId,
                        _chapterName: topic.chapterName,
                        _subjectId: topic.subjectId || 'REVISION',
                        _subjectName: topic.subjectName || 'Revision',
                    }));

                    topicBuckets.push(tagged);
                } catch (e) {
                    console.error('Failed to load topic', topic.name, e);
                    skipped.push(topic.name);
                }
            }

            setNoMcqTopics(skipped);

            if (topicBuckets.length === 0) {
                setLoading(false);
                return;
            }

            // ── Round-robin interleave ─────────────────────────────────────
            // T1-Q1, T2-Q1, T3-Q1, T1-Q2, T2-Q2 ...
            const interleaved: InterleavedQ[] = [];
            const maxLen = Math.max(...topicBuckets.map(b => b.length));
            for (let row = 0; row < maxLen; row++) {
                for (let col = 0; col < topicBuckets.length; col++) {
                    if (row < topicBuckets[col].length) {
                        interleaved.push(topicBuckets[col][row]);
                    }
                }
            }

            setInterleavedQuestions(interleaved);
            setLoading(false);
        };

        loadAll();
    }, []);

    // ── Answer handler ────────────────────────────────────────────────────
    const handleAnswer = (optionIdx: number) => {
        if (answers[qIndex] !== undefined) return;

        // Today Revision Hub MCQs — NO daily MCQ limit applies here
        const isCorrect = interleavedQuestions[qIndex]?.correctAnswer === optionIdx;
        if (onTrackAnswer) {
            if (!onTrackAnswer(isCorrect)) return;
        }

        // ── MCQ Scoring: +2 correct, -1 wrong, streak bonuses ─────────────────
        if (user.id) {
            const _subValid = SubscriptionEngine.isPremium(user);
            const _tier = _subValid && user.subscriptionLevel === 'ULTRA' ? 'ULTRA' :
                          _subValid && user.subscriptionLevel === 'BASIC' ? 'BASIC' : 'FREE';
            if (isCorrect) {
                const newStreak = mcqStreak + 1;
                setMcqStreak(newStreak);
                const pts = tryEarnScore(user.id, 2, _tier, _subValid, 0, 'REVISION_MCQ_CORRECT');
                const bonus = getMcqStreakBonus(newStreak);
                const bonusPts = bonus > 0 ? tryEarnScore(user.id, bonus, _tier, _subValid, 0, `REVISION_MCQ_STREAK_${newStreak}`) : 0;
                const totalPts = pts + bonusPts;
                if (totalPts > 0) {
                    const _u = userRef.current;
                    if (_u && onUpdateUser) {
                        const updated = { ..._u, totalScore: (_u.totalScore || 0) + totalPts };
                        onUpdateUser(updated);
                        saveUserToLive(updated);
                    }
                    showMcqScore(totalPts);
                }
            } else {
                setMcqStreak(0);
                subtractDailyScore(user.id, 1);
                const _u = userRef.current;
                if (_u && onUpdateUser) {
                    const updated = { ..._u, totalScore: Math.max(0, (_u.totalScore || 0) - 1) };
                    onUpdateUser(updated);
                    saveUserToLive(updated);
                }
                showMcqScore(-1);
            }
        }

        const newAnswers = { ...answers, [qIndex]: optionIdx };
        setAnswers(newAnswers);

        setTimeout(() => {
            if (qIndex < interleavedQuestions.length - 1) {
                setQIndex(prev => prev + 1);
            } else {
                finishSession(newAnswers);
            }
        }, 500);
    };

    // ── Finish: reconstruct per-topic results + mega result ───────────────
    const finishSession = (finalAnswers: Record<number, number>) => {
        if (interleavedQuestions.length === 0) {
            onClose();
            return;
        }

        const thresholds = settings?.revisionConfig?.thresholds ?? { strong: 65, average: 50, mastery: 80 };
        const intervals = settings?.revisionConfig?.intervals ?? {
            weak:     { revision: 86400 },
            average:  { revision: 259200 },
            strong:   { revision: 604800 },
            mastered: { revision: 2592000 },
        };

        // Group questions + answers by topic
        const topicGroups: Record<number, { qs: InterleavedQ[]; ans: Record<number, number>; meta: InterleavedQ }> = {};
        interleavedQuestions.forEach((q, idx) => {
            const ti = q._topicIndex;
            if (!topicGroups[ti]) {
                topicGroups[ti] = { qs: [], ans: {}, meta: q };
            }
            const localIdx = topicGroups[ti].qs.length;
            topicGroups[ti].qs.push(q);
            if (finalAnswers[idx] !== undefined) {
                topicGroups[ti].ans[localIdx] = finalAnswers[idx];
            }
        });

        const sessionResults: MCQResult[] = [];
        const topicSummary: TopicSessionResult[] = [];

        Object.entries(topicGroups).forEach(([_ti, group]) => {
            const { qs, ans, meta } = group;
            const topic = topics[meta._topicIndex];

            let correct = 0;
            const topicAnalysis: Record<string, { correct: number; total: number; percentage: number }> = {};
            const omrData: any[] = [];
            const wrongQuestions: any[] = [];

            qs.forEach((q, localIdx) => {
                const t = (q.topic || 'General').trim();
                if (!topicAnalysis[t]) topicAnalysis[t] = { correct: 0, total: 0, percentage: 0 };
                topicAnalysis[t].total += 1;

                const selected = ans[localIdx] ?? -1;
                omrData.push({ qIndex: localIdx, selected, correct: q.correctAnswer, timeSpent: 0 });

                if (selected === q.correctAnswer) {
                    correct++;
                    topicAnalysis[t].correct += 1;
                    removeMistakeByQuestion(q.question, q.correctAnswer);
                } else if (selected !== -1) {
                    wrongQuestions.push({ question: q.question, qIndex: localIdx, explanation: q.explanation, correctAnswer: q.correctAnswer });
                }
            });

            Object.keys(topicAnalysis).forEach(t => {
                const s = topicAnalysis[t];
                s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            });

            const total = qs.length;
            const percentage = total > 0 ? (correct / total) * 100 : 0;
            const accuracy = total > 0 ? correct / total : 0;

            // Compute tier
            let tier: 'weak' | 'average' | 'strong' | 'mastered';
            let nextRevisionDays: number;
            const pct = accuracy * 100;
            if (pct >= thresholds.mastery) {
                tier = 'mastered';
                nextRevisionDays = Math.round((intervals.mastered?.revision ?? 2592000) / 86400);
            } else if (pct >= thresholds.strong) {
                tier = 'strong';
                nextRevisionDays = Math.round((intervals.strong?.revision ?? 604800) / 86400);
            } else if (pct >= thresholds.average) {
                tier = 'average';
                nextRevisionDays = Math.round((intervals.average?.revision ?? 259200) / 86400);
            } else {
                tier = 'weak';
                nextRevisionDays = Math.round((intervals.weak?.revision ?? 86400) / 86400);
            }

            topicSummary.push({
                topicName: meta._topicName,
                chapterName: meta._chapterName,
                subjectName: meta._subjectName,
                correct,
                total,
                percentage: Math.round(percentage),
                tier,
                nextRevisionDays,
            });

            // Mistake bank
            try {
                const wrongPayload = qs
                    .map((q, localIdx) => {
                        const selected = ans[localIdx];
                        if (selected !== undefined && selected !== q.correctAnswer) {
                            return {
                                question: q.question,
                                options: q.options || [],
                                correctAnswer: q.correctAnswer,
                                explanation: q.explanation,
                                topic: q.topic || meta._topicName,
                                chapterTitle: meta._chapterName,
                                subjectName: meta._subjectName,
                                classLevel: user.classLevel,
                                board: user.board,
                                source: 'REVISION',
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);
                if (wrongPayload.length > 0) addMistakes(wrongPayload);
            } catch (_) {}

            // Revision tracker
            try {
                const userAnswersArr = qs.map((_, localIdx) => ans[localIdx] ?? null);
                recordRevisionAttempt({
                    subjectId: meta._subjectId,
                    subjectName: meta._subjectName,
                    chapterId: meta._chapterId,
                    chapterTitle: meta._chapterName,
                    pageKey: meta._chapterId,
                    questions: qs,
                    userAnswers: userAnswersArr,
                });
                if (topic) {
                    const bk = bucketKey(meta._subjectId, meta._chapterId, meta._chapterId, meta._topicName);
                    applyInitialSchedule(bk, accuracy, settings?.revisionConfig);
                }
            } catch (_) {}

            const analysisJson = generateAnalysisJson(qs, ans, user.mcqHistory, meta._chapterId);

            const result: MCQResult = {
                id: `mcq-rev-${Date.now()}-${meta._topicIndex}`,
                userId: user.id,
                chapterId: meta._chapterId,
                chapterTitle: meta._chapterName,
                subjectId: meta._subjectId,
                subjectName: meta._subjectName,
                date: new Date().toISOString(),
                score: correct,
                totalQuestions: total,
                correctCount: correct,
                wrongCount: total - correct,
                totalTimeSeconds: totalTime,
                averageTimePerQuestion: totalTime / (total || 1),
                performanceTag: percentage >= 80 ? 'EXCELLENT' : percentage >= 50 ? 'GOOD' : 'BAD',
                ultraAnalysisReport: analysisJson,
                topicAnalysis,
                omrData,
                wrongQuestions,
                topic: meta._topicName,
            };

            saveTestResult(user.id, result);
            sessionResults.push(result);
        });

        // ── Mega combined result ──────────────────────────────────────────
        let totalQ = 0, totalScore = 0, totalCorrect = 0, totalWrong = 0;
        let megaOmrData: any[] = [];
        let megaWrongQuestions: any[] = [];
        let megaTopicAnalysis: Record<string, any> = {};

        sessionResults.forEach(res => {
            const startIdx = megaOmrData.length;
            totalQ += res.totalQuestions;
            totalScore += res.score;
            totalCorrect += res.correctCount;
            totalWrong += res.wrongCount;

            if (res.omrData) res.omrData.forEach(o => megaOmrData.push({ ...o, qIndex: startIdx + o.qIndex }));
            if (res.wrongQuestions) res.wrongQuestions.forEach(wq => megaWrongQuestions.push({ ...wq, qIndex: startIdx + wq.qIndex }));

            if (res.topicAnalysis) {
                Object.entries(res.topicAnalysis).forEach(([key, val]: [string, any]) => {
                    if (!megaTopicAnalysis[key]) megaTopicAnalysis[key] = { correct: 0, total: 0, percentage: 0 };
                    megaTopicAnalysis[key].total += val.total;
                    megaTopicAnalysis[key].correct += val.correct;
                });
            }
        });

        Object.keys(megaTopicAnalysis).forEach(t => {
            const s = megaTopicAnalysis[t];
            s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        });

        const megaResult: MCQResult = {
            id: `mcq-mega-${Date.now()}`,
            userId: user.id,
            chapterId: sessionResults[0]?.chapterId || 'revision',
            chapterTitle: `Revision Analysis (${Object.keys(topicGroups).length} Topics)`,
            subjectId: 'REVISION',
            subjectName: 'Revision Hub',
            date: new Date().toISOString(),
            score: totalScore,
            totalQuestions: totalQ,
            correctCount: totalCorrect,
            wrongCount: totalWrong,
            totalTimeSeconds: totalTime,
            averageTimePerQuestion: totalTime / (totalQ || 1),
            performanceTag: totalQ > 0 && (totalCorrect / totalQ) >= 0.8 ? 'EXCELLENT' : totalQ > 0 && (totalCorrect / totalQ) >= 0.5 ? 'GOOD' : 'BAD',
            topicAnalysis: megaTopicAnalysis,
            omrData: megaOmrData,
            wrongQuestions: megaWrongQuestions,
        };

        // Store results + show summary screen instead of immediately closing
        pendingCompleteRef.current = { results: [megaResult], questions: interleavedQuestions };
        setSessionSummary(topicSummary);
    };

    // ── Tier helpers ──────────────────────────────────────────────────────
    const tierConfig = {
        weak:     { label: 'Weak',     icon: TrendingDown, bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',    bar: 'bg-rose-500' },
        average:  { label: 'Average',  icon: Minus,        bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-500' },
        strong:   { label: 'Strong',   icon: TrendingUp,   bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
        mastered: { label: 'Mastered', icon: Star,         bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',  bar: 'bg-indigo-500' },
    };

    // ── Result Summary Screen ─────────────────────────────────────────────
    if (sessionSummary !== null) {
        const totalQ = sessionSummary.reduce((s, r) => s + r.total, 0);
        const totalCorrect = sessionSummary.reduce((s, r) => s + r.correct, 0);
        const overallPct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
        const weakCount = sessionSummary.filter(r => r.tier === 'weak').length;
        const avgCount = sessionSummary.filter(r => r.tier === 'average').length;
        const strongCount = sessionSummary.filter(r => r.tier === 'strong').length;
        const masteredCount = sessionSummary.filter(r => r.tier === 'mastered').length;

        const overallTier = overallPct >= (settings?.revisionConfig?.thresholds?.mastery ?? 80) ? 'mastered'
            : overallPct >= (settings?.revisionConfig?.thresholds?.strong ?? 65) ? 'strong'
            : overallPct >= (settings?.revisionConfig?.thresholds?.average ?? 50) ? 'average'
            : 'weak';
        const overallCfg = tierConfig[overallTier];

        return (
            <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${overallCfg.bg} ${overallCfg.text} flex items-center justify-center`}>
                            <Trophy size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-black text-slate-800">MCQ Session Complete!</h2>
                            <p className="text-[11px] text-slate-500">{sessionSummary.length} topic{sessionSummary.length !== 1 ? 's' : ''} attempt kiye · {Math.floor(totalTime / 60)}m {totalTime % 60}s</p>
                        </div>
                    </div>

                    {/* Overall score pill */}
                    <div className={`mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl ${overallCfg.bg} border ${overallCfg.border}`}>
                        <div className="flex-1">
                            <p className={`text-2xl font-black ${overallCfg.text}`}>{overallPct}%</p>
                            <p className="text-[11px] text-slate-500 font-semibold">{totalCorrect} / {totalQ} sahi · {overallCfg.label}</p>
                        </div>
                        {/* Mini tier summary */}
                        <div className="flex gap-2 flex-wrap justify-end">
                            {weakCount > 0 && (
                                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-1 rounded-full">{weakCount} Weak</span>
                            )}
                            {avgCount > 0 && (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{avgCount} Avg</span>
                            )}
                            {strongCount > 0 && (
                                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{strongCount} Strong</span>
                            )}
                            {masteredCount > 0 && (
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{masteredCount} ⭐</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Topic-wise list */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+100px)]">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">Topic-wise Performance</p>

                    {sessionSummary.map((result, idx) => {
                        const cfg = tierConfig[result.tier];
                        const TierIcon = cfg.icon;
                        return (
                            <div key={idx} className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} overflow-hidden`}>
                                {/* Topic header row */}
                                <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-xl ${cfg.badge} flex items-center justify-center shrink-0 mt-0.5`}>
                                        <TierIcon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 leading-snug">{result.topicName}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{result.subjectName}{result.chapterName ? ` · ${result.chapterName}` : ''}</p>
                                    </div>
                                    {/* Score */}
                                    <div className="shrink-0 text-right">
                                        <p className={`text-lg font-black ${cfg.text}`}>{result.percentage}%</p>
                                        <p className="text-[10px] text-slate-500">{result.correct}/{result.total}</p>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="px-4 pb-2">
                                    <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${cfg.bar} transition-all`}
                                            style={{ width: `${result.percentage}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Tier badge + next revision */}
                                <div className="px-4 pb-3 flex items-center justify-between gap-2">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${cfg.badge}`}>
                                        <TierIcon size={10} />
                                        {cfg.label}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                                        <Calendar size={10} className="text-slate-400" />
                                        {result.tier === 'mastered'
                                            ? `${result.nextRevisionDays} din baad (🎉 Mastered!)`
                                            : result.nextRevisionDays === 1
                                                ? 'Kal phir aayega'
                                                : `${result.nextRevisionDays} din baad revision`
                                        }
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Explanation */}
                    <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 mt-2">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Aage kya hoga?</p>
                        <div className="space-y-1.5">
                            {weakCount > 0 && (
                                <div className="flex items-center gap-2 text-[11px] text-rose-700">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                    <span><b>Weak topics</b> — kal phir se Notes + MCQ milega</span>
                                </div>
                            )}
                            {avgCount > 0 && (
                                <div className="flex items-center gap-2 text-[11px] text-amber-700">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                    <span><b>Average topics</b> — 3 din baad revision milega</span>
                                </div>
                            )}
                            {strongCount > 0 && (
                                <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    <span><b>Strong topics</b> — 7 din baad revision milega</span>
                                </div>
                            )}
                            {masteredCount > 0 && (
                                <div className="flex items-center gap-2 text-[11px] text-indigo-700">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                    <span><b>Mastered topics</b> — 30 din baad revision milega ⭐</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom action button */}
                <div className="shrink-0 bg-white border-t border-slate-200 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+76px)]">
                    <button
                        onClick={() => {
                            if (pendingCompleteRef.current) {
                                onComplete(pendingCompleteRef.current.results, pendingCompleteRef.current.questions);
                            } else {
                                onClose();
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black py-4 rounded-2xl text-sm shadow-lg shadow-indigo-200 transition-all"
                    >
                        <CheckCircle size={18} />
                        Revision Hub pe Wapas Jao
                    </button>
                </div>
            </div>
        );
    }

    // ── Loading Screen ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center gap-4 p-8">
                <Loader2 size={48} className="text-indigo-600 animate-spin" />
                <p className="font-bold text-slate-600 text-center animate-pulse">{loadingMsg}</p>
                <p className="text-xs text-slate-400">Sab topics ke MCQ ek saath load ho rahe hain...</p>
            </div>
        );
    }

    // ── No MCQs found ─────────────────────────────────────────────────────
    if (interleavedQuestions.length === 0) {
        return (
            <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle size={52} className="text-amber-400 mb-4" />
                <h2 className="text-xl font-black text-slate-800 mb-2">MCQ Nahi Mila</h2>
                <p className="text-sm text-slate-500 mb-1">
                    In {topics.length} topic{topics.length > 1 ? 's' : ''} ke liye abhi tak MCQ upload nahi hua hai.
                </p>
                <p className="text-xs text-slate-400 mb-8">
                    Admin ko demand bhej diya gaya hai — jaldi MCQ aa jayega!
                </p>
                <button onClick={onClose} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">
                    Wapas Jao
                </button>
            </div>
        );
    }

    const question = interleavedQuestions[qIndex];
    const topicColor = [
        'bg-blue-100 text-blue-700',
        'bg-purple-100 text-purple-700',
        'bg-green-100 text-green-700',
        'bg-orange-100 text-orange-700',
        'bg-rose-100 text-rose-700',
        'bg-teal-100 text-teal-700',
    ][question._topicIndex % 6];

    // Count unique topics done so far
    const topicsDoneSet = new Set(interleavedQuestions.slice(0, qIndex + 1).map(q => q._topicIndex));

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
            {/* MCQ Score Popup */}
            {mcqScorePopup !== null && (
                <div style={{
                    position: 'fixed', bottom: 80, right: 20, zIndex: 9999,
                    background: mcqScorePopup < 0 ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', borderRadius: 14, padding: '8px 16px',
                    fontSize: 14, fontWeight: 900,
                    boxShadow: mcqScorePopup < 0 ? '0 6px 20px rgba(239,68,68,0.4)' : '0 6px 20px rgba(99,102,241,0.4)',
                    opacity: mcqScoreVisible ? 1 : 0,
                    transform: mcqScoreVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
                    transition: 'opacity 0.25s, transform 0.25s',
                    pointerEvents: 'none',
                }}>
                    {mcqScorePopup < 0 ? `❌ ${mcqScorePopup} pts` : `⭐ +${mcqScorePopup} pts`}
                </div>
            )}
            {/* Sidebar */}
            {showSidebar && (
                <div className="fixed inset-0 bg-black/50 z-[110]" onClick={() => setShowSidebar(false)}>
                    <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800">Topics</h3>
                            <button onClick={() => setShowSidebar(false)}><X size={20}/></button>
                        </div>
                        <div className="space-y-3">
                            {topics.map((t, idx) => {
                                const colors = ['bg-blue-50 border-blue-200 text-blue-700', 'bg-purple-50 border-purple-200 text-purple-700', 'bg-green-50 border-green-200 text-green-700', 'bg-orange-50 border-orange-200 text-orange-700', 'bg-rose-50 border-rose-200 text-rose-700', 'bg-teal-50 border-teal-200 text-teal-700'];
                                const c = colors[idx % 6];
                                const qCount = interleavedQuestions.filter(q => q._topicIndex === idx).length;
                                const answeredCount = interleavedQuestions.filter((q, qi) => q._topicIndex === idx && answers[qi] !== undefined).length;
                                return (
                                    <div key={idx} className={`p-3 rounded-xl border ${c}`}>
                                        <p className="text-xs font-bold truncate">{t.name}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] text-slate-500">{t.chapterName}</span>
                                            <span className="text-[10px] font-bold">{answeredCount}/{qCount} done</span>
                                        </div>
                                        <div className="h-1 bg-white/60 rounded-full mt-2">
                                            <div className="h-full rounded-full bg-current opacity-40 transition-all" style={{ width: `${qCount > 0 ? (answeredCount / qCount) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {noMcqTopics.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">MCQ nahi mila</p>
                                {noMcqTopics.map((n, i) => <p key={i} className="text-[10px] text-slate-400 truncate">• {n}</p>)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => {
                        if (Object.keys(answers).length > 0) finishSession(answers);
                        else onClose();
                    }} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200">
                        <ArrowRight size={18} className="rotate-180" />
                    </button>
                    <div>
                        <p className="text-xs font-black text-slate-800">Q {qIndex + 1} / {interleavedQuestions.length}</p>
                        <p className="text-[10px] text-slate-400">{topicsDoneSet.size} topic{topicsDoneSet.size !== 1 ? 's' : ''} chal rahe hain</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSidebar(true)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                        <List size={20} />
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Time</span>
                        <span className="text-xs font-mono font-bold text-slate-700">
                            {Math.floor(totalTime / 60)}:{String(totalTime % 60).padStart(2, '0')}
                        </span>
                    </div>
                    <button
                        onClick={() => finishSession(answers)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-green-700"
                    >
                        Submit
                    </button>
                </div>
            </div>

            {/* Progress bar (overall) */}
            <div className="h-1.5 bg-slate-100 w-full">
                <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${((qIndex + 1) / interleavedQuestions.length) * 100}%` }}
                />
            </div>

            {/* Question */}
            <div className="flex-1 overflow-y-auto p-6 pb-24">
                {/* Topic badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-4 ${topicColor}`}>
                    <Tag size={10} />
                    {question._topicName}
                </div>

                <div className="text-lg font-bold text-slate-800 mb-8 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: question.question }} />
                    {question.statements && question.statements.length > 0 && (
                        <div className="mt-4 mb-2 flex flex-col space-y-2">
                            {question.statements.map((stmt: string, sIdx: number) => (
                                <div key={sIdx} className="bg-slate-50/80 p-3 rounded-lg border-l-4 border-indigo-200 text-slate-700 text-base font-medium" dangerouslySetInnerHTML={{ __html: stmt }} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    {question.options.map((opt: string, idx: number) => {
                        const isSelected = answers[qIndex] === idx;
                        let btnClass = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
                        if (answers[qIndex] !== undefined) {
                            if (isSelected) btnClass = "border-blue-400 bg-blue-50 text-blue-700";
                            else btnClass = "border-slate-100 opacity-50 text-slate-800";
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={answers[qIndex] !== undefined}
                                className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all flex items-center gap-3 ${btnClass}`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${
                                    answers[qIndex] !== undefined && isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-slate-100 border-slate-300 text-slate-600'
                                }`}>
                                    {['A','B','C','D'][idx]}
                                </div>
                                <span className="flex-1">{opt}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
