import { MCQItem } from '../types';

/**
 * Normalize the markdown-heavy paste format used by coaching books before
 * parsing. The lightning marker is only a visual tag; it must never decide
 * whether a question has numbered statements.
 */
export function normalizeMcqPaste(raw: string): string {
    let text = raw.replace(/\r\n/g, '\n');

    // Remove empty duplicate answer labels such as:
    // **सही उत्तर:
    // **सही उत्तर:** B) ...
    text = text.replace(
        /^[ \t]*(?:\*{1,2})?\s*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]\s*(?:\*{1,2})?\s*$/gim,
        '',
    );
    text = text.replace(
        /\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?)\s*[:：]\s*\n+\s*(?=\*\*\s*(?:सही\s*उत्तर|Ans(?:wer)?))/gi,
        '',
    );

    // Strip visual/category markers from the beginning of question lines.
    text = text.replace(
        /^\s*\[(?:[⚡🔥💡🎯⭐✨🏆⚠️🌟][^\]]*?|[^\]]{1,10})\]\s*/gm,
        '',
    );

    // Markdown bold is presentation-only here. Removing it also turns
    // **सही उत्तर:** B) ... into the parser-friendly सही उत्तर: B) ...
    text = text.replace(/\*\*/g, '');

    return text;
}

/**
 * Parses a raw text containing MCQ questions formatted with specific emojis and headers
 * into an array of MCQItem objects.
 *
 * Supported Formats:
 *
 * FORMAT 1 (Emoji/Structured):
 * **Question X**
 * 📖 Topic: ...
 * ❓ Question: ...
 * Options:
 * A) ...
 * B) ...
 * C) ...
 * D) ...
 * ✅ Correct Answer: X) ...
 * 💡 Concept: ...
 * 🔎 Explanation: ...
 *
 * FORMAT 2 (Simple/Hindi — user pasted format):
 * <TOPIC: Topic Name>
 * Q1. Question text?
 * A) Option A
 * B) Option B
 * C) Option C
 * D) Option D
 * Answer: C) Option text
 * Explanation: explanation text
 *
 * <NOTE: Topic Name>
 * HTML or plain note content
 * </NOTE: Topic Name>
 */
function extractStatements(questionText: string): { statements: string[], cleanedQuestion: string } {
    const statements: string[] = [];
    let cleanedQuestion = "";

    const lines = questionText.split(/<br\/>|\n/);
    let inStatementBlock = false;
    let currentStatement = "";
    const tempQuestionLines: string[] = [];
    const endingQuestionLines: string[] = [];

    const statementStartRegex = /^(?:(?:Statement|कथन)\s*(?:[0-9]+|[IVXivx]+)|\d+[\)\.])\s*[:\-\.]?(.*)/i;
    const endingQuestionRegex = /^(?:which of the|उपर्युक्त|उपरोक्त|choose the|select the|find the|निम्नलिखित में से|कूट\b|कूट का|उपर्युक्त कथनों|\*\*\s*कूट)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (statementStartRegex.test(line)) {
            if (currentStatement) {
                statements.push(currentStatement.trim());
            }
            currentStatement = line;
            inStatementBlock = true;
        } else if (inStatementBlock) {
            if (endingQuestionRegex.test(line) || (line.includes("?") || line.includes("सही है") || line.includes("गलत है"))) {
                if (currentStatement) {
                    statements.push(currentStatement.trim());
                    currentStatement = "";
                }
                inStatementBlock = false;
                endingQuestionLines.push(line);
            } else {
                currentStatement += " " + line;
            }
        } else {
            if (statements.length > 0) {
                endingQuestionLines.push(line);
            } else {
                tempQuestionLines.push(line);
            }
        }
    }

    if (currentStatement) {
        statements.push(currentStatement.trim());
    }

    cleanedQuestion = tempQuestionLines.join('<br/>');
    if (endingQuestionLines.length > 0) {
        cleanedQuestion += (cleanedQuestion ? "<br/><br/>" : "") + endingQuestionLines.join('<br/>');
    }

    return { statements, cleanedQuestion: cleanedQuestion || questionText };
}

/**
 * Try to parse a simple-format MCQ block like:
 * Q1. Question text?
 * A) Option A
 * B) Option B
 * C) Option C
 * D) Option D
 * Answer: C) Option text
 * Explanation: explanation text
 *
 * Returns a partial MCQItem or null if it doesn't match this format.
 */
function parseSimpleFormatBlock(block: string, topic: string): Partial<MCQItem> | null {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 3) return null;

    // First line: **Q1:** / Q1. / Q1) / **प्रश्न 1:** / प्रश्न 1. / plain question text
    const questionLineMatch = lines[0].match(/^\*{0,2}\s*(?:Q\s*\d*\s*[:.)\s]|प्रश्न\s*\d*\s*[:.])\*{0,2}\s*([\s\S]+)/i)
        || lines[0].match(/^(?:Q\s*\d+[\.\)]\s*)?([\s\S]+)/i);
    if (!questionLineMatch) return null;

    let questionText = questionLineMatch[1].trim();
    if (!questionText) return null;

    // ── Collect multi-line question body ─────────────────────────────────────
    // Lines between the Q-marker and the first option/answer may contain:
    //   • Statement lines  (कथन I: …, कथन II: …, 1. …, 2. …)
    //   • Intro context    (निम्नलिखित कथनों पर विचार कीजिए:)
    //   • Closing question (उपर्युक्त में से कौन-सा/से …?)
    // All of them belong to the question body — collect them here.
    // A line is treated as an MCQ option only when its content is ≤100 chars.
    // Statement labels (A. Statement one full sentence…) are longer and must NOT
    // stop the question-body collection early.
    const isOptionLine   = (l: string) => {
        const m = l.match(/^(\*?)\s*([A-D])[:.)\s]\s*(.+)/i);
        return !!m && m[3].trim().length <= 100;
    };
    // Also handles **सही उत्तर: (bold markdown prefix used in some paste formats)
    const isAnswerLine   = (l: string) => /^(?:\*{1,2}\s*)?(?:Ans|Answer|सही\s*उत्तर)\s*:/i.test(l) || /^✅\s*Correct\s+Answer\s*:/i.test(l);
    const isExplainLine  = (l: string) => /^(?:Explanation|Exp|व्याख्या)\s*:/i.test(l);

    let bodyStart = 1; // index of first option/answer/explanation line
    const extraBodyLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (isOptionLine(lines[i]) || isAnswerLine(lines[i]) || isExplainLine(lines[i])) {
            bodyStart = i;
            break;
        }
        extraBodyLines.push(lines[i]);
        bodyStart = i + 1; // will be reset each iteration; final value = past last extra line
    }
    if (extraBodyLines.length > 0) {
        questionText = questionText + '\n' + extraBodyLines.join('\n');
    }

    // Collect option lines
    const optionMap: Record<number, string> = {};
    const starCorrects: number[] = []; // from *A) style
    let answerLine = '';
    let explanationLines: string[] = [];
    let collectingExplanation = false;

    for (let i = bodyStart; i < lines.length; i++) {
        const line = lines[i];

        // Option lines: *A) / *A: / A) / A. / A:
        const optionMatch = line.match(/^(\*?)\s*([A-D])[:.)\s]\s*(.+)/i);
        if (optionMatch && !collectingExplanation) {
            const isCorrect = optionMatch[1] === '*';
            const idx = optionMatch[2].toUpperCase().charCodeAt(0) - 65;
            if (idx >= 0 && idx < 4) {
                optionMap[idx] = optionMatch[3].trim();
                if (isCorrect) starCorrects.push(idx);
            }
            continue;
        }

        // Answer line: Ans: / Answer: / ✅ Correct Answer: / सही उत्तर: / **सही उत्तर:
        if (/^(?:\*{1,2}\s*)?(?:Ans|Answer|सही\s*उत्तर)\s*:/i.test(line) || /^✅\s*Correct\s+Answer\s*:/i.test(line)) {
            answerLine = line.replace(/^(?:\*{1,2}\s*)?(?:✅\s*)?(?:Correct\s+)?(?:Answer|Ans|सही\s*उत्तर)\s*:\s*/i, '').trim();
            continue;
        }

        // Explanation line: Explanation: / Exp: / व्याख्या:
        if (/^(?:Explanation|Exp|व्याख्या)\s*:/i.test(line)) {
            collectingExplanation = true;
            const expText = line.replace(/^(?:Explanation|Exp|व्याख्या)\s*:\s*/i, '').trim();
            if (expText) explanationLines.push(expText);
            continue;
        }

        if (collectingExplanation) {
            explanationLines.push(line);
        }
    }

    const options = [optionMap[0]||'', optionMap[1]||'', optionMap[2]||'', optionMap[3]||''].filter((_, i) => optionMap[i] !== undefined);
    // Need at least 2 options
    if (Object.keys(optionMap).length < 2) return null;

    // Determine correct answer: star style takes priority, else Ans: line
    let correctAnswer: number | undefined;
    if (starCorrects.length > 0) {
        correctAnswer = starCorrects[0];
    } else if (answerLine) {
        const answerLetterMatch = answerLine.match(/^([A-D])[\)\.:\s]/i);
        if (answerLetterMatch) {
            correctAnswer = ['A', 'B', 'C', 'D'].indexOf(answerLetterMatch[1].toUpperCase());
        } else {
            const clean = answerLine.trim();
            const allOpts = Object.values(optionMap);
            const idx = allOpts.findIndex(o => clean.includes(o) || o.includes(clean));
            if (idx !== -1) correctAnswer = idx;
        }
    }

    if (correctAnswer === undefined || correctAnswer < 0) return null;

    const allOptions = Object.values(optionMap);

    const q: Partial<MCQItem> = {
        topic,
        question: questionText.replace(/\n/g, '<br/>'),
        options: allOptions,
        correctAnswer,
    };

    if (explanationLines.length > 0) {
        q.explanation = explanationLines.join(' ').trim();
    }

    return q;
}

export function parseMCQText(text: string): { questions: MCQItem[], notes: {title: string, content: string}[] } {
  const questions: MCQItem[] = [];
  const notes: {title: string, content: string}[] = [];
  text = normalizeMcqPaste(text);

  // ── Extract <NOTE: title>...</NOTE: title> blocks first ──────────────────
  // These are explicit note sections the user pastes alongside MCQs.
  const noteTagRegex = /<NOTE:\s*(.*?)>([\s\S]*?)<\/NOTE(?::\s*[^>]*)?>/gi;
  let noteMatch: RegExpExecArray | null;
  const extractedNoteRanges: { start: number; end: number }[] = [];

  while ((noteMatch = noteTagRegex.exec(text)) !== null) {
    const noteTitle = noteMatch[1].trim();
    const noteContent = noteMatch[2].trim();
    if (noteContent) {
      notes.push({ title: noteTitle, content: noteContent });
    }
    extractedNoteRanges.push({ start: noteMatch.index, end: noteMatch.index + noteMatch[0].length });
  }

  // Remove extracted NOTE blocks from the text so MCQ parser doesn't trip on them
  let cleanText = text;
  for (let i = extractedNoteRanges.length - 1; i >= 0; i--) {
    const { start, end } = extractedNoteRanges[i];
    cleanText = cleanText.slice(0, start) + cleanText.slice(end);
  }

  // ── Detect if text contains simple Q1./Q2. or **प्रश्न 1.** format ──────
  const hasSimpleFormat = /^\s*(?:\*{0,2}\s*(?:Q\s*\d+[\.\)]|प्रश्न\s*\d+\s*[:.)])|<TOPIC:)/im.test(cleanText);

  if (hasSimpleFormat) {
    // ── SIMPLE FORMAT PARSER ─────────────────────────────────────────────────
    // Split by <TOPIC: ...> first to get topic sections
    const topicSplitRegex = /<TOPIC:\s*(.*?)>/gi;
    const topicParts: { topic: string; content: string }[] = [];

    let lastIndex = 0;
    let currentTopic = 'General';
    let match: RegExpExecArray | null;

    // Find all TOPIC tags and split content
    const topicMatches: { index: number; topic: string }[] = [];
    let tempMatch: RegExpExecArray | null;
    const topicFinder = new RegExp(/<TOPIC:\s*(.*?)>/gi);
    while ((tempMatch = topicFinder.exec(cleanText)) !== null) {
      topicMatches.push({ index: tempMatch.index, topic: tempMatch[1].trim() });
    }

    if (topicMatches.length === 0) {
      // No TOPIC tags — treat entire text as one block with default topic
      topicParts.push({ topic: 'General', content: cleanText });
    } else {
      // Content before first TOPIC tag
      if (topicMatches[0].index > 0) {
        const before = cleanText.slice(0, topicMatches[0].index).trim();
        if (before) topicParts.push({ topic: 'General', content: before });
      }
      // Content for each TOPIC section
      for (let i = 0; i < topicMatches.length; i++) {
        const topicEnd = topicMatches[i].index + cleanText.slice(topicMatches[i].index).match(/<TOPIC:\s*.*?>/i)![0].length;
        const contentEnd = i + 1 < topicMatches.length ? topicMatches[i + 1].index : cleanText.length;
        const content = cleanText.slice(topicEnd, contentEnd).trim();
        topicParts.push({ topic: topicMatches[i].topic, content });
      }
    }

    // For each topic section, split by Q1. / Q2. / प्रश्न 1. markers and parse each block
    for (const { topic, content } of topicParts) {
      // Split by Q<number>. or Q<number>) or **प्रश्न <number>: markers
      const qBlocks = content.split(/(?=^\s*\*{0,2}\s*(?:Q\s*\d+[\.\)]|प्रश्न\s*\d+\s*[:.)]))/im).filter(b => b.trim());

      for (const block of qBlocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        // Skip if this block doesn't start with Q<number> or (optional **) प्रश्न <number>
        if (!/^\*{0,2}\s*(?:Q\s*\d+[\.\)]|प्रश्न\s*\d+\s*[:.)])/i.test(trimmed)) continue;

        const parsed = parseSimpleFormatBlock(trimmed, topic);
        if (parsed && parsed.question && parsed.options && parsed.options.length >= 2 && parsed.correctAnswer !== undefined) {
          // Multi-statement extraction
          const statementData = extractStatements(parsed.question);
          if (statementData.statements.length > 0) {
            parsed.statements = statementData.statements;
            parsed.question = statementData.cleanedQuestion;
          }
          questions.push(parsed as MCQItem);
        }
      }
    }

    return { questions, notes };
  }

  // ── STRUCTURED/EMOJI FORMAT PARSER (original logic) ─────────────────────
  let activeMainTopic: string | null = null;

  const blocks = cleanText.split(/(?:\*\*Question \d+\*\*|Question \d+:?)/ig).filter(b => b.trim().length > 0);

  blocks.forEach((block, blockIndex) => {
    let q: Partial<MCQItem> = {};

    const allTopicMatches = [...block.matchAll(/<TOPIC:\s*(.*?)>/ig)];
    if (blockIndex === 0 && allTopicMatches.length > 0) {
        activeMainTopic = allTopicMatches[allTopicMatches.length - 1][1].trim();
    }

    const cleanedBlock = block.replace(/###\s*<TOPIC:\s*.*?>/ig, '').replace(/<TOPIC:\s*.*?>/ig, '').trim();

    const pyqMatch = cleanedBlock.match(/(?:🔥\s*)?PYQ Inspired:\s*(.+)/i);
    if (pyqMatch) q.pyqInspired = pyqMatch[1].trim();

    const topicMatch = cleanedBlock.match(/(?:📖\s*)?(?:Topic|विषय).*?:\s*(.+)/i);

    if (activeMainTopic) {
        q.topic = activeMainTopic;
    } else if (topicMatch) {
        q.topic = topicMatch[1].trim();
    } else {
        q.topic = "General";
    }

    const hasAlphabetOptions = /(?:\n\s*[A-D][\)\.])/.test(cleanedBlock);

    let questionMatch = cleanedBlock.match(/(?:❓\s*)?(?:\*\*)?Question(?:\s*\(प्रश्न\))?:?(?:\*\*)?(?:\s*❓\s*Question:?)?\s*([\s\S]*?)(?=(?:Options(?:\s*\(विकल्प\))?:|विकल्प:))/i);
    if (!questionMatch) {
        if (hasAlphabetOptions) {
            questionMatch = cleanedBlock.match(/(?:❓\s*)?(?:\*\*)?Question(?:\s*\(प्रश्न\))?:?(?:\*\*)?(?:\s*❓\s*Question:?)?\s*([\s\S]*?)(?=(?:\n\s*[A-D][\)\.]))/i);
        } else {
            questionMatch = cleanedBlock.match(/(?:❓\s*)?(?:\*\*)?Question(?:\s*\(प्रश्न\))?:?(?:\*\*)?(?:\s*❓\s*Question:?)?\s*([\s\S]*?)(?=(?:\n\s*[1-4][\)\.]))/i);
        }
    }

    if (!questionMatch) {
        const optionsIdxMatch = cleanedBlock.match(/(?:Options(?:\s*\(विकल्प\))?:|विकल्प:|\n\s*[A-D1-4][\)\.])/i);
        if (optionsIdxMatch && optionsIdxMatch.index !== undefined) {
             let potentialQuestion = cleanedBlock.substring(0, optionsIdxMatch.index);
             potentialQuestion = potentialQuestion.replace(/(?:🔥\s*)?PYQ Inspired:\s*(.+)/ig, '');
             potentialQuestion = potentialQuestion.replace(/(?:📖\s*)?(?:Topic|विषय).*?:\s*(.+)/ig, '');
             potentialQuestion = potentialQuestion.replace(/(?:❓\s*)?(?:\*\*)?Question(?:\s*\(प्रश्न\))?:?(?:\*\*)?/ig, '');
             q.question = potentialQuestion.trim();
        }
    }

    if (!q.question && !questionMatch) {
         const optionsIdxMatch = cleanedBlock.match(/(?:Options(?:\s*\(विकल्प\))?:|विकल्प:|\n\s*[A-D1-4][\)\.])/i);
         if (optionsIdxMatch && optionsIdxMatch.index !== undefined) {
             let potentialQuestion = cleanedBlock.substring(0, optionsIdxMatch.index);
             potentialQuestion = potentialQuestion.replace(/(?:🔥\s*)?PYQ Inspired:\s*(.+)/ig, '');
             potentialQuestion = potentialQuestion.replace(/(?:📖\s*)?(?:Topic|विषय).*?:\s*(.+)/ig, '');
             q.question = potentialQuestion.trim();
         }
    }

    if (questionMatch || q.question) {
      if (questionMatch) {
          q.question = questionMatch[1].trim();
      } else {
          q.question = q.question!.trim();
      }
      q.question = q.question.replace(/^(?:Q?\d+[\.\)\-]\s*)/i, '');
      q.question = q.question.replace(/\*\*/g, '');
      q.question = q.question.replace(/^\[.*?\]\s*/g, '');
      q.question = q.question.replace(/\n?\s*कूट\s*:?\s*$/gi, '').trim();
      q.question = q.question.replace(/\n/g, '<br/>');

      const statementData = extractStatements(q.question);
      if (statementData.statements.length > 0) {
          q.statements = statementData.statements;
          q.question = statementData.cleanedQuestion;
      }
    }

    let optionsMatch = cleanedBlock.match(/(?:(?:Options(?:\s*\(विकल्प\))?:|विकल्प:)\s*)([\s\S]*?)(?=✅|(?:Correct Answer(?:\s*\(सही उत्तर\))?:))/i);
    if (!optionsMatch) {
        if (hasAlphabetOptions) {
            optionsMatch = cleanedBlock.match(/(?:\n\s*[A-D][\)\.])([\s\S]*?)(?=✅|(?:Correct Answer(?:\s*\(सही उत्तर\))?:))/i);
            if (optionsMatch) {
                optionsMatch[1] = cleanedBlock.match(/(?:\n\s*[A-D][\)\.])/i)![0] + optionsMatch[1];
            }
        } else {
            optionsMatch = cleanedBlock.match(/(?:\n\s*[1-4][\)\.])([\s\S]*?)(?=✅|(?:Correct Answer(?:\s*\(सही उत्तर\))?:))/i);
            if (optionsMatch) {
                optionsMatch[1] = cleanedBlock.match(/(?:\n\s*[1-4][\)\.])/i)![0] + optionsMatch[1];
            }
        }
    }

    if (optionsMatch) {
      const optionsText = optionsMatch[1].trim();
      const optionLines = optionsText.split(/\n/).map(line => line.trim()).filter(line => /^(?:[A-D]|[1-4])[\)\.](?:\s|$)/i.test(line));

      if (optionLines.length >= 2) {
          q.options = optionLines.map(opt => opt.replace(/^(?:[A-D]|[1-4])[\)\.]\s*/i, '').trim());
      }
    }

    const answerMatch = cleanedBlock.match(/(?:✅\s*)?(?:\*\*)?Correct Answer(?:\s*\(सही उत्तर\))?:?(?:\*\*)?(?:\s*✅\s*Correct Answer:?)?\s*([\s\S]*?)(?=💡|🔎|🎯|⚠|🧠|📊|Concept|Explanation|व्याख्या|Solution|Sol\b|हल|Reason|कारण|Exam Tip|Common Mistake|Memory Trick|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (answerMatch) {
        const rawAns = answerMatch[1].trim();
        const letterMatch = rawAns.match(/^([A-D])(?:[\)\.]|$)/i);
        if (letterMatch) {
            const letter = letterMatch[1].toUpperCase();
            q.correctAnswer = ['A', 'B', 'C', 'D'].indexOf(letter);
        } else if (q.options) {
            const ansTextClean = rawAns.replace(/^(?:[A-D])(?:[\)\.]|$)\s*/i, '').trim();
            const index = q.options.findIndex(opt => ansTextClean.includes(opt) || opt.includes(ansTextClean));
            if (index !== -1) {
                q.correctAnswer = index;
            }
        }
    }

    const conceptMatch = block.match(/(?:💡\s*)?(?:\*\*)?Concept(?:\s*\(अवधारणा\))?:?(?:\*\*)?(?:\s*💡\s*Concept:?)?\s*([\s\S]*?)(?=🔎|🎯|⚠|🧠|📊|Explanation|व्याख्या|Solution|Sol\b|हल|Reason|कारण|Exam Tip|Common Mistake|Memory Trick|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (conceptMatch) q.concept = conceptMatch[1].trim();

    const explanationMatch = block.match(
      /(?:🔎\s*)?(?:\*\*)?(?:Explanation(?:\s*\(व्याख्या\))?|व्याख्या(?:\s*\(Explanation\))?|Solution|Sol\b|हल|Reason|कारण|Ans\.?\s*Explanation):?\s*(?:\*\*)?(?:\s*🔎\s*(?:Explanation|व्याख्या):?)?\s*([\s\S]*?)(?=🎯|⚠|🧠|📊|Exam Tip|Common Mistake|Memory Trick|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i
    );
    if (explanationMatch) q.explanation = explanationMatch[1].trim();

    const examTipMatch = block.match(/(?:🎯\s*)?(?:\*\*)?Exam Tip(?:\s*\(परीक्षा टिप\))?:?(?:\*\*)?(?:\s*🎯\s*Exam Tip:?)?\s*([\s\S]*?)(?=⚠|🧠|📊|Common Mistake|Memory Trick|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (examTipMatch) q.examTip = examTipMatch[1].trim();

    const commonMistakeMatch = block.match(/(?:⚠\s*)?(?:\*\*)?Common Mistake(?:\s*\(सामान्य गलती\))?:?(?:\*\*)?(?:\s*⚠\s*Common Mistake:?)?\s*([\s\S]*?)(?=🧠|📊|Memory Trick|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (commonMistakeMatch) q.commonMistake = commonMistakeMatch[1].trim();

    const memoryTrickMatch = block.match(/(?:🧠\s*)?(?:\*\*)?Memory Trick(?:\s*\(याद रखने का तरीका\))?:?(?:\*\*)?(?:\s*🧠\s*Memory Trick:?)?\s*([\s\S]*?)(?=📊|Difficulty Level|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (memoryTrickMatch) q.mnemonic = memoryTrickMatch[1].trim();

    const difficultyMatch = block.match(/(?:📊\s*)?(?:\*\*)?Difficulty Level(?:\s*\(कठिनाई\))?:?(?:\*\*)?(?:\s*📊\s*Difficulty Level:?)?\s*([\s\S]*?)(?=\n\n|<h[1-6]|<p|<div|<ul|<ol|###|$)/i);
    if (difficultyMatch) {
      const diffStr = difficultyMatch[1].trim().toLowerCase();
      if(diffStr.includes("easy")) q.difficultyLevel = "Easy";
      else if(diffStr.includes("medium")) q.difficultyLevel = "Medium";
      else if(diffStr.includes("hard")) q.difficultyLevel = "Hard";
      else q.difficultyLevel = diffStr;
    }

    if (q.question && q.options && q.options.length > 0 && q.correctAnswer !== undefined) {
      questions.push(q as MCQItem);

      const lastMatch = difficultyMatch || memoryTrickMatch || commonMistakeMatch || examTipMatch || explanationMatch || conceptMatch || answerMatch;
      if (lastMatch && lastMatch.index !== undefined) {
          const textAfterLastMatch = cleanedBlock.substring(lastMatch.index + lastMatch[0].length).trim();
          if (textAfterLastMatch.length > 20 && !textAfterLastMatch.startsWith('Options') && !textAfterLastMatch.startsWith('Question')) {
              const title = q.topic || "Note";
              notes.push({ title: title, content: textAfterLastMatch });
          }
      }
    } else if (cleanedBlock.length > 20 && !cleanedBlock.startsWith('Options')) {
      const paragraphs = cleanedBlock.split(/\n\n+/);

      for (const para of paragraphs) {
          if (para.trim().length === 0) continue;

          let title = "Note";
          const paraTopicMatch = para.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);

          if (paraTopicMatch) {
              title = paraTopicMatch[1].replace(/<[^>]+>/g, '').replace(/#|\*|_/g, '').trim().substring(0, 50);
          } else {
              const lines = para.split('\n').map(l => l.trim()).filter(l => l);
              if (lines.length > 0) {
                  const firstLine = lines[0];
                  let rawTitle = firstLine;
                  if (firstLine.includes(' Definition:')) {
                      rawTitle = firstLine.split(' Definition:')[0];
                  }
                  rawTitle = rawTitle.replace(/<[^>]+>/g, '').replace(/#|\*|_/g, '').trim();
                  title = rawTitle.substring(0, 50) || "Note";
              }
          }

          notes.push({ title: title !== "Note" ? title : (activeMainTopic || "Note"), content: para.trim() });
      }
    }

    if (allTopicMatches.length > 0) {
        activeMainTopic = allTopicMatches[allTopicMatches.length - 1][1].trim();
    }
  });

  return { questions, notes };
}
