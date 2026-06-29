import { MCQItem } from '../types';

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

    const lines = questionText.split('<br/>');
    let inStatementBlock = false;
    let currentStatement = "";
    const tempQuestionLines: string[] = [];
    const endingQuestionLines: string[] = [];

    const statementStartRegex = /^(?:Statement\s*\d+|कथन\s*\d+|\d+[\)\.])\s*[:\-\.]?(.*)/i;
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

    // First line: optional Q number + question text
    // e.g. "Q1. वे सभी प्रक्रम..." or just the question text
    const questionLineMatch = lines[0].match(/^(?:Q\s*\d+[\.\)]\s*)?([\s\S]+)/i);
    if (!questionLineMatch) return null;

    const questionText = questionLineMatch[1].trim();
    if (!questionText) return null;

    // Collect option lines
    const options: string[] = [];
    let answerLine = '';
    let explanationLines: string[] = [];
    let collectingExplanation = false;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Option lines: A) ... or A. ...
        const optionMatch = line.match(/^([A-D])[\)\.]\s*(.+)/i);
        if (optionMatch && !collectingExplanation) {
            options.push(optionMatch[2].trim());
            continue;
        }

        // Answer line: "Answer: C) text" OR normalised "✅ Correct Answer: C) text"
        if (/^Answer\s*:/i.test(line) || /^✅\s*Correct\s+Answer\s*:/i.test(line)) {
            answerLine = line.replace(/^(?:✅\s*)?(?:Correct\s+)?Answer\s*:\s*/i, '').trim();
            continue;
        }

        // Explanation line
        if (/^Explanation\s*:/i.test(line)) {
            collectingExplanation = true;
            const expText = line.replace(/^Explanation\s*:\s*/i, '').trim();
            if (expText) explanationLines.push(expText);
            continue;
        }

        if (collectingExplanation) {
            explanationLines.push(line);
        }
    }

    // Need at least 2 options and an answer
    if (options.length < 2 || !answerLine) return null;

    // Parse answer: "C) Option text" or just "C"
    const answerLetterMatch = answerLine.match(/^([A-D])[\)\.]/i);
    let correctAnswer: number | undefined;
    if (answerLetterMatch) {
        correctAnswer = ['A', 'B', 'C', 'D'].indexOf(answerLetterMatch[1].toUpperCase());
    } else {
        // Try matching text against options
        const clean = answerLine.trim();
        const idx = options.findIndex(o => clean.includes(o) || o.includes(clean));
        if (idx !== -1) correctAnswer = idx;
    }

    if (correctAnswer === undefined || correctAnswer < 0) return null;

    const q: Partial<MCQItem> = {
        topic,
        question: questionText.replace(/\n/g, '<br/>'),
        options,
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

  // ── Detect if text contains simple Q1./Q2. format ────────────────────────
  const hasSimpleFormat = /^\s*(?:Q\s*\d+[\.\)]|<TOPIC:)/im.test(cleanText);

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

    // For each topic section, split by Q1. / Q2. markers and parse each block
    for (const { topic, content } of topicParts) {
      // Split by Q<number>. or Q<number>)
      const qBlocks = content.split(/(?=^\s*Q\s*\d+[\.\)])/im).filter(b => b.trim());

      for (const block of qBlocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        // Skip if this block doesn't start with Q<number>
        if (!/^Q\s*\d+[\.\)]/i.test(trimmed)) continue;

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
