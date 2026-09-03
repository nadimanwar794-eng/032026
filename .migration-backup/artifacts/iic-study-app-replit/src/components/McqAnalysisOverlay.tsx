// @ts-nocheck
import React, { useMemo, useRef } from 'react';
import type { MCQResult, SystemSettings, User } from '../types';
import { MarksheetCard } from './MarksheetCard';

interface Props {
  questions: any[];
  answers: Record<number, number>;
  submitted?: Record<number, boolean>;
  title?: string;
  subtitle?: string;
  subject?: string;
  user: User;
  settings?: SystemSettings | null;
  onClose: () => void;
  onRestart?: () => void;
}

/**
 * One result surface for every interactive MCQ source.
 *
 * The old practice overlays each had their own compact review UI. Keeping the
 * answer-to-result conversion here means Homework, Lucent Competition and
 * Premium MCQ all open the same Full Analysis marksheet after submission.
 */
export const McqAnalysisOverlay: React.FC<Props> = ({
  questions,
  answers,
  submitted,
  title,
  subtitle,
  subject,
  user,
  settings,
  onClose,
  onRestart,
}) => {
  const resultIdRef = useRef(`mcq_session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const result = useMemo<MCQResult>(() => {
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const omrData = safeQuestions.map((q, qIndex) => {
      const isSubmitted = submitted ? submitted[qIndex] === true : answers[qIndex] !== undefined;
      const selected = isSubmitted && answers[qIndex] !== undefined ? answers[qIndex] : -1;
      return {
        qIndex,
        selected,
        correct: Number(q?.correctAnswer ?? 0),
        timeSpent: 0,
      };
    });

    const attempted = omrData.filter(item => item.selected !== -1);
    const correctCount = attempted.filter(item => item.selected === item.correct).length;
    const wrongQuestions = safeQuestions
      .map((q, qIndex) => {
        const item = omrData[qIndex];
        if (!item || item.selected === -1 || item.selected === item.correct) return null;
        return {
          ...q,
          qIndex,
        };
      })
      .filter(Boolean);

    const topicAnalysis: Record<string, { correct: number; total: number; percentage: number }> = {};
    safeQuestions.forEach((q, qIndex) => {
      const topic = String(q?.topic || 'General').trim() || 'General';
      if (!topicAnalysis[topic]) topicAnalysis[topic] = { correct: 0, total: 0, percentage: 0 };
      topicAnalysis[topic].total += 1;
      if (omrData[qIndex].selected === omrData[qIndex].correct) {
        topicAnalysis[topic].correct += 1;
      }
    });
    Object.values(topicAnalysis).forEach(stats => {
      stats.percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    const totalQuestions = safeQuestions.length;
    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    return {
      id: resultIdRef.current,
      userId: user?.id || '',
      chapterId: `mcq_session_${title || 'practice'}`,
      subjectId: subject || 'MCQ',
      subjectName: subject || 'MCQ Practice',
      chapterTitle: title || 'MCQ Practice',
      date: new Date().toISOString(),
      totalQuestions,
      correctCount,
      wrongCount: attempted.length - correctCount,
      score: correctCount,
      totalTimeSeconds: 0,
      averageTimePerQuestion: 0,
      performanceTag: percentage >= 80 ? 'EXCELLENT' : percentage >= 50 ? 'GOOD' : percentage >= 30 ? 'BAD' : 'VERY_BAD',
      omrData,
      wrongQuestions,
      topicAnalysis,
    };
  }, [questions, answers, submitted, title, subject, user?.id]);

  return (
    <MarksheetCard
      result={result}
      user={user}
      settings={settings}
      questions={questions}
      mcqMode="PREMIUM"
      onClose={onClose}
       onRestart={onRestart}
      onUpdateUser={() => {}}
    />
  );
};

export default McqAnalysisOverlay;