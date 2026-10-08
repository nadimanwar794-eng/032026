import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  CheckCircle2,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  History,
  MoveRight,
  Copy,
  Search,
  SlidersHorizontal,
  X,
  HelpCircle,
  FolderSync,
} from 'lucide-react';
import { uploadImageToImgBB } from '../services/imgbbService';
import { saveChapterData, getChapterData, saveMcqLesson, saveSystemSettings } from '../firebase';
import { MathImagePage, MCQItem, LucentNoteEntry, LessonContent } from '../types';
import { MathLessonViewer } from './MathLessonViewer';

interface Props {
  onBack: () => void;
  currentUser?: any;
  settings?: any;
  onUpdateSettings?: (settings: any) => void;
  onSaveSettings?: (settings: any) => Promise<void>;
}

export interface MathChapterSummary {
  key: string;
  board: string;
  classLevel: string;
  chapterId: string;
  chapterTitle: string;
  bookPagesCount: number;
  premiumNotesCount: number;
  solutionPagesCount: number;
  mcqsCount: number;
  updatedAt: string;
}

const CLASSES = ['6', '7', '8', '9', '10', '11', '12', 'COMPETITION'];
const BOARDS = [
  { id: 'ALL', label: 'All Boards (Universal - Sabhi Ko Dikhega)' },
  { id: 'BSEB', label: 'Bihar Board (BSEB)' },
  { id: 'CBSE', label: 'CBSE Board' },
  { id: 'UP', label: 'UP Board' },
  { id: 'NCERT_EN', label: 'NCERT (English)' },
  { id: 'NCERT_HI', label: 'NCERT (Hindi)' },
];

export const AdminMathManager: React.FC<Props> = ({
  onBack,
  currentUser,
  settings,
  onUpdateSettings,
  onSaveSettings,
}) => {
  // Navigation: Editor view vs History & Move view
  const [managerView, setManagerView] = useState<'EDITOR' | 'HISTORY'>('EDITOR');

  // Active Editor Form State
  const [selectedClass, setSelectedClass] = useState<string>('10');
  const [selectedBoard, setSelectedBoard] = useState<string>('BSEB');
  const [chapterId, setChapterId] = useState<string>('ch_1');
  const [chapterTitle, setChapterTitle] = useState<string>('वास्तविक संख्याएँ (Real Numbers)');

  // 4 Modes inside Editor
  const [activeTab, setActiveTab] = useState<'BOOK' | 'PREMIUM_NOTES' | 'SOLUTION' | 'MCQ'>('BOOK');

  // Pages state
  const [bookPages, setBookPages] = useState<MathImagePage[]>([]);
  const [premiumNotesPages, setPremiumNotesPages] = useState<MathImagePage[]>([]);
  const [solutionPages, setSolutionPages] = useState<MathImagePage[]>([]);
  const [mcqs, setMcqs] = useState<MCQItem[]>([]);

  // Loading & Saving states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'SUCCESS' | 'ERROR' } | null>(null);

  // Single URL inputs
  const [singleUrl, setSingleUrl] = useState<string>('');
  const [singleTitle, setSingleTitle] = useState<string>('');

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Student mode preview modal
  const [studentPreviewContent, setStudentPreviewContent] = useState<LessonContent | null>(null);

  // History & Saved Chapters
  const [historyList, setHistoryList] = useState<MathChapterSummary[]>([]);
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterBoard, setFilterBoard] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Move / Copy Modal state
  const [moveCopySource, setMoveCopySource] = useState<MathChapterSummary | null>(null);
  const [targetMoveBoard, setTargetMoveBoard] = useState<string>('CBSE');
  const [targetMoveClass, setTargetMoveClass] = useState<string>('10');
  const [isMoveCopying, setIsMoveCopying] = useState<boolean>(false);

  // File input refs for multi-upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Construct standard storage key
  const getContentKey = (board: string, cls: string, chId: string) => {
    return `nst_content_${board}_${cls}_Mathematics_${chId}`;
  };

  // ── HELPER: UPDATE & RETRIEVE MATH CHAPTER INDEX ──────────────────────────
  const getStoredIndex = (): MathChapterSummary[] => {
    try {
      const raw = localStorage.getItem('nst_math_chapters_index');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  };

  const updateMathChapterIndex = (summary: MathChapterSummary) => {
    try {
      const current = getStoredIndex();
      const filtered = current.filter(item => item.key !== summary.key);
      const updated = [summary, ...filtered];
      localStorage.setItem('nst_math_chapters_index', JSON.stringify(updated));
    } catch {}
  };

  const deleteFromMathChapterIndex = (key: string) => {
    try {
      const current = getStoredIndex();
      const updated = current.filter(item => item.key !== key);
      localStorage.setItem('nst_math_chapters_index', JSON.stringify(updated));
    } catch {}
  };

  // ── LOAD ALL SAVED CHAPTERS FOR HISTORY VIEW (With Auto-Discovery) ─────────
  const loadHistoryList = async () => {
    const listMap = new Map<string, MathChapterSummary>();

    // 1. From settings.lucentNotes
    const lucentNotes: LucentNoteEntry[] = (settings?.lucentNotes || (() => {
      try {
        return JSON.parse(localStorage.getItem('nst_system_settings') || '{}')?.lucentNotes || [];
      } catch {
        return [];
      }
    })()) as LucentNoteEntry[];

    lucentNotes.forEach(note => {
      const isMath =
        note.isMathLesson ||
        note.subject?.toLowerCase().trim() === 'math' ||
        note.subject?.toLowerCase().trim() === 'mathematics' ||
        note.bookName?.toLowerCase().includes('math') ||
        (note.mathBookPages && note.mathBookPages.length > 0);

      if (isMath) {
        const board = note.board || 'ALL';
        const cls = String(note.classLevel || '10');
        const chId = note.chapterId || note.id.replace(/^math_[^_]+_[^_]+_/, '');
        const key = getContentKey(board, cls, chId);

        listMap.set(key, {
          key,
          board,
          classLevel: cls,
          chapterId: chId,
          chapterTitle: note.lessonTitle || 'Math Chapter',
          bookPagesCount: note.mathBookPages?.length || (note.pages?.length || 0),
          premiumNotesCount: note.mathPremiumNotesPages?.length || 0,
          solutionPagesCount: note.mathSolutionPages?.length || 0,
          mcqsCount: note.pages?.flatMap(p => p.mcqs || []).length || 0,
          updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
        });
      }
    });

    // 2. From stored index
    const stored = getStoredIndex();
    stored.forEach(item => {
      if (!listMap.has(item.key)) {
        listMap.set(item.key, item);
      }
    });

    // 3. Auto-discover from localStorage keys starting with nst_content_ and containing _Mathematics_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nst_content_') && (k.includes('_Mathematics_') || k.includes('_math_'))) {
          if (!listMap.has(k)) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const parts = k.slice('nst_content_'.length).split('_');
                const b = parts[0] || 'BSEB';
                const c = parts[1] || '10';
                const chId = parts[parts.length - 1] || 'ch_1';
                listMap.set(k, {
                  key: k,
                  board: b,
                  classLevel: c,
                  chapterId: chId,
                  chapterTitle: parsed.chapterTitle || parsed.title || 'Math Chapter',
                  bookPagesCount: parsed.mathBookPages?.length || 0,
                  premiumNotesCount: parsed.mathPremiumNotesPages?.length || 0,
                  solutionPagesCount: parsed.mathSolutionPages?.length || 0,
                  mcqsCount: (parsed.mcqData || parsed.manualMcqData || parsed.mcqs || []).length,
                  updatedAt: parsed.updatedAt || new Date().toISOString(),
                });
              } catch {}
            }
          }
        }
      }
    } catch {}

    const allItems = Array.from(listMap.values()).sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
    setHistoryList(allItems);

    // Save consolidated index to localStorage for fast lookup
    try {
      localStorage.setItem('nst_math_chapters_index', JSON.stringify(allItems));
    } catch {}
  };

  useEffect(() => {
    loadHistoryList();
  }, [settings?.lucentNotes]);

  // Load content whenever class, board, or chapter changes in Editor
  const loadChapterContent = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const key = getContentKey(selectedBoard, selectedClass, chapterId);
      const data = await getChapterData(key);
      if (data) {
        setChapterTitle(data.chapterTitle || data.title || chapterTitle);
        setBookPages(data.mathBookPages || []);
        setPremiumNotesPages(data.mathPremiumNotesPages || []);
        setSolutionPages(data.mathSolutionPages || []);
        setMcqs(data.mcqs || data.manualMcqData || data.mcqData || []);
      } else {
        // Reset pages if empty
        setBookPages([]);
        setPremiumNotesPages([]);
        setSolutionPages([]);
        setMcqs([]);
      }
    } catch (err) {
      console.error('Error loading Math chapter content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChapterContent();
  }, [selectedClass, selectedBoard, chapterId]);

  // Handle Multi-file upload via ImgBB
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(`0 / ${files.length} images uploading...`);
    const newPages: MathImagePage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadProgress(`${i + 1} / ${files.length}: Uploading ${file.name}...`);
        const url = await uploadImageToImgBB(file, file.name, { isHd: true });
        if (url) {
          newPages.push({
            id: `page_${Date.now()}_${i}`,
            pageNo: i + 1,
            imageUrl: url,
            title: `Page ${file.name.replace(/\.[^/.]+$/, '')}`,
          });
        }
      } catch (uploadErr) {
        console.warn(`Failed to upload ${file.name}:`, uploadErr);
      }
    }

    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (newPages.length > 0) {
      if (activeTab === 'BOOK') {
        setBookPages(prev => [...prev, ...newPages.map((p, idx) => ({ ...p, pageNo: prev.length + idx + 1 }))]);
      } else if (activeTab === 'PREMIUM_NOTES') {
        setPremiumNotesPages(prev => [...prev, ...newPages.map((p, idx) => ({ ...p, pageNo: prev.length + idx + 1 }))]);
      } else if (activeTab === 'SOLUTION') {
        setSolutionPages(prev => [...prev, ...newPages.map((p, idx) => ({ ...p, pageNo: prev.length + idx + 1 }))]);
      }
      setStatusMessage({ text: `${newPages.length} images kamyabi se upload ho gayi!`, type: 'SUCCESS' });
    }
  };

  // Add single image URL manually
  const handleAddSingleUrl = () => {
    if (!singleUrl.trim()) return;
    const newPage: MathImagePage = {
      id: `page_${Date.now()}`,
      pageNo: 1,
      imageUrl: singleUrl.trim(),
      title: singleTitle.trim() || undefined,
    };

    if (activeTab === 'BOOK') {
      setBookPages(prev => [...prev, { ...newPage, pageNo: prev.length + 1 }]);
    } else if (activeTab === 'PREMIUM_NOTES') {
      setPremiumNotesPages(prev => [...prev, { ...newPage, pageNo: prev.length + 1 }]);
    } else if (activeTab === 'SOLUTION') {
      setSolutionPages(prev => [...prev, { ...newPage, pageNo: prev.length + 1 }]);
    }

    setSingleUrl('');
    setSingleTitle('');
  };

  // Delete page
  const handleDeletePage = (mode: 'BOOK' | 'PREMIUM_NOTES' | 'SOLUTION', index: number) => {
    if (mode === 'BOOK') {
      setBookPages(prev => prev.filter((_, i) => i !== index).map((p, idx) => ({ ...p, pageNo: idx + 1 })));
    } else if (mode === 'PREMIUM_NOTES') {
      setPremiumNotesPages(prev => prev.filter((_, i) => i !== index).map((p, idx) => ({ ...p, pageNo: idx + 1 })));
    } else if (mode === 'SOLUTION') {
      setSolutionPages(prev => prev.filter((_, i) => i !== index).map((p, idx) => ({ ...p, pageNo: idx + 1 })));
    }
  };

  // Reorder page
  const handleMovePage = (mode: 'BOOK' | 'PREMIUM_NOTES' | 'SOLUTION', index: number, direction: 'UP' | 'DOWN') => {
    const listSetter =
      mode === 'BOOK' ? setBookPages : mode === 'PREMIUM_NOTES' ? setPremiumNotesPages : setSolutionPages;

    listSetter(prev => {
      const copy = [...prev];
      const targetIdx = direction === 'UP' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((p, idx) => ({ ...p, pageNo: idx + 1 }));
    });
  };

  // ===================== MCQ ADD FORM =====================
  const [newQuestion, setNewQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  const handleAddMcq = () => {
    if (!newQuestion.trim() || !optionA.trim() || !optionB.trim()) {
      setStatusMessage({ text: 'Question aur kam se kam 2 options zaroori hain!', type: 'ERROR' });
      return;
    }

    const newItem: MCQItem = {
      question: newQuestion.trim(),
      options: [optionA.trim(), optionB.trim(), optionC.trim() || 'C', optionD.trim() || 'D'],
      correctAnswer: correctOption,
      explanation: explanation.trim(),
    };

    setMcqs(prev => [...prev, newItem]);
    setNewQuestion('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setExplanation('');
    setStatusMessage({ text: 'MCQ question add ho gaya!', type: 'SUCCESS' });
  };

  const handleDeleteMcq = (idx: number) => {
    setMcqs(prev => prev.filter((_, i) => i !== idx));
  };

  // ===================== SAVE ALL MATH CONTENT =====================
  // Saves to: 1) saveChapterData, 2) settings.lucentNotes (crucial for student dashboard!),
  // 3) saveMcqLesson, 4) nst_math_chapters_index
  const handleSaveAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const key = getContentKey(selectedBoard, selectedClass, chapterId);
      const titleToSave = chapterTitle.trim() || 'Math Chapter';
      const payload: any = {
        id: chapterId,
        chapterTitle: titleToSave,
        title: titleToSave,
        subjectName: 'Mathematics',
        classLevel: selectedClass,
        board: selectedBoard,
        mathBookPages: bookPages,
        mathPremiumNotesPages: premiumNotesPages,
        mathSolutionPages: solutionPages,
        manualMcqData: mcqs,
        mcqData: mcqs,
        mcqs,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || 'Admin',
      };

      // 1. Save chapter data in Firestore / local storage
      await saveChapterData(key, payload);

      // 2. Also register MCQ lesson for Study Room / Arena if MCQs exist
      if (mcqs.length > 0) {
        try {
          await saveMcqLesson({
            id: `math_${selectedClass}_${chapterId}`,
            title: `${titleToSave} (Math Cl-${selectedClass})`,
            subject: 'Mathematics',
            classLevel: selectedClass,
            questions: mcqs,
            authorName: currentUser?.name || 'Admin',
            createdAt: new Date().toISOString(),
          } as any);
        } catch (arenaErr) {
          console.warn('Study Room MCQ registration warning:', arenaErr);
        }
      }

      // 3. Register / Sync into settings.lucentNotes so StudentDashboard shows it under Class 6-12 Subject list!
      const currentSettings = settings || (() => {
        try {
          return JSON.parse(localStorage.getItem('nst_system_settings') || '{}');
        } catch {
          return {};
        }
      })();

      const lucentNotes: LucentNoteEntry[] = Array.isArray(currentSettings?.lucentNotes)
        ? [...currentSettings.lucentNotes]
        : [];

      const targetEntryId = `math_${selectedBoard}_${selectedClass}_${chapterId}`;
      const mathPages = bookPages.length > 0
        ? bookPages.map((p, idx) => ({
            id: p.id || `p_${idx + 1}`,
            pageNo: String(p.pageNo || idx + 1),
            content: p.imageUrl
              ? `<img src="${p.imageUrl}" alt="${p.title || 'Page'}" class="w-full rounded-xl shadow-lg my-2" />`
              : (p.title || `Page ${idx + 1}`),
            htmlNotes: p.imageUrl
              ? `<div class="p-2 text-center"><img src="${p.imageUrl}" class="w-full max-w-3xl mx-auto rounded-2xl shadow-xl" /><p class="text-xs text-slate-400 mt-2 font-bold">${p.title || `Page ${idx + 1}`}</p></div>`
              : '',
            chunkNotes: p.title || `Page ${idx + 1}`,
            topicName: p.title || `Page ${idx + 1}`,
            mcqs: mcqs || [],
          }))
        : [
            {
              id: 'p_1',
              pageNo: '1',
              content: titleToSave,
              chunkNotes: titleToSave,
              mcqs: mcqs || [],
            },
          ];

      const newLucentEntry: LucentNoteEntry = {
        id: targetEntryId,
        subject: 'math',
        bookName: 'गणित (Mathematics)',
        classLevel: selectedClass as any,
        board: selectedBoard === 'ALL' ? undefined : (selectedBoard as any),
        lessonTitle: titleToSave,
        pages: mathPages,
        isMathLesson: true,
        mathBookPages: bookPages,
        mathPremiumNotesPages: premiumNotesPages,
        mathSolutionPages: solutionPages,
        chapterId: chapterId,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const existingIdx = lucentNotes.findIndex(
        n =>
          n.id === targetEntryId ||
          (n.chapterId === chapterId &&
            String(n.classLevel) === String(selectedClass) &&
            (n.board === selectedBoard || (!n.board && selectedBoard === 'ALL')))
      );

      if (existingIdx >= 0) {
        lucentNotes[existingIdx] = { ...lucentNotes[existingIdx], ...newLucentEntry };
      } else {
        lucentNotes.push(newLucentEntry);
      }

      const updatedSettings = { ...currentSettings, lucentNotes };
      if (onUpdateSettings) onUpdateSettings(updatedSettings);
      localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
      if (onSaveSettings) {
        await onSaveSettings(updatedSettings);
      } else {
        await saveSystemSettings(updatedSettings);
      }

      // 4. Update the fast summary index
      const summary: MathChapterSummary = {
        key,
        board: selectedBoard,
        classLevel: selectedClass,
        chapterId,
        chapterTitle: titleToSave,
        bookPagesCount: bookPages.length,
        premiumNotesCount: premiumNotesPages.length,
        solutionPagesCount: solutionPages.length,
        mcqsCount: mcqs.length,
        updatedAt: new Date().toISOString(),
      };
      updateMathChapterIndex(summary);
      loadHistoryList();

      setStatusMessage({
        text: `✅ Math Chapter "${titleToSave}" kamyabi se save ho gaya! Class ${selectedClass} (${selectedBoard}) ke students ko abhi dikhega.`,
        type: 'SUCCESS',
      });
    } catch (err: any) {
      console.error('Error saving Math Chapter:', err);
      setStatusMessage({ text: `❌ Save nahi ho paya: ${err?.message || 'Error'}`, type: 'ERROR' });
    } finally {
      setIsSaving(false);
    }
  };

  // ===================== SELECT CHAPTER TO EDIT FROM HISTORY =====================
  const handleSelectForEdit = async (item: MathChapterSummary) => {
    setSelectedClass(item.classLevel);
    setSelectedBoard(item.board || 'BSEB');
    setChapterId(item.chapterId);
    setChapterTitle(item.chapterTitle);
    setManagerView('EDITOR');
    setStatusMessage({
      text: `📂 Chapter "${item.chapterTitle}" edit karne ke liye load kiya gaya!`,
      type: 'SUCCESS',
    });
  };

  // ===================== MOVE / COPY MODAL OPEN =====================
  const handleOpenMoveCopy = (item?: MathChapterSummary) => {
    const source: MathChapterSummary = item || {
      key: getContentKey(selectedBoard, selectedClass, chapterId),
      board: selectedBoard,
      classLevel: selectedClass,
      chapterId: chapterId,
      chapterTitle: chapterTitle,
      bookPagesCount: bookPages.length,
      premiumNotesCount: premiumNotesPages.length,
      solutionPagesCount: solutionPages.length,
      mcqsCount: mcqs.length,
      updatedAt: new Date().toISOString(),
    };
    setMoveCopySource(source);
    setTargetMoveBoard(source.board === 'BSEB' ? 'CBSE' : 'BSEB');
    setTargetMoveClass(source.classLevel);
  };

  // ===================== EXECUTE MOVE OR COPY =====================
  const handleExecuteMoveCopy = async (isMove: boolean) => {
    if (!moveCopySource) return;
    setIsMoveCopying(true);
    setStatusMessage(null);

    const source = moveCopySource;
    const targetB = targetMoveBoard;
    const targetC = targetMoveClass;
    const chId = source.chapterId;
    const chTitle = source.chapterTitle;

    try {
      // 1. Fetch full data of source chapter
      let fullData = await getChapterData(source.key);
      if (!fullData && source.chapterId === chapterId && source.classLevel === selectedClass) {
        fullData = {
          id: chId,
          chapterTitle: chTitle,
          mathBookPages: bookPages,
          mathPremiumNotesPages: premiumNotesPages,
          mathSolutionPages: solutionPages,
          mcqData: mcqs,
          manualMcqData: mcqs,
        };
      }

      if (!fullData) {
        throw new Error('Source chapter data nahi mila!');
      }

      const targetKey = getContentKey(targetB, targetC, chId);
      const newPayload = {
        ...fullData,
        id: chId,
        chapterTitle: chTitle,
        title: chTitle,
        subjectName: 'Mathematics',
        classLevel: targetC,
        board: targetB,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || 'Admin',
      };

      // 2. Save in new target board
      await saveChapterData(targetKey, newPayload);

      // 3. Update settings.lucentNotes
      const currentSettings = settings || (() => {
        try {
          return JSON.parse(localStorage.getItem('nst_system_settings') || '{}');
        } catch {
          return {};
        }
      })();
      let lucentNotes: LucentNoteEntry[] = Array.isArray(currentSettings?.lucentNotes)
        ? [...currentSettings.lucentNotes]
        : [];

      const targetEntryId = `math_${targetB}_${targetC}_${chId}`;
      const newPages = (newPayload.mathBookPages || []).map((p: any, idx: number) => ({
        id: p.id || `p_${idx + 1}`,
        pageNo: String(p.pageNo || idx + 1),
        content: p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${p.title || 'Page'}" class="w-full rounded-xl shadow-lg my-2" />`
          : (p.title || `Page ${idx + 1}`),
        htmlNotes: p.imageUrl
          ? `<div class="p-2 text-center"><img src="${p.imageUrl}" class="w-full max-w-3xl mx-auto rounded-2xl shadow-xl" /><p class="text-xs text-slate-400 mt-2 font-bold">${p.title || `Page ${idx + 1}`}</p></div>`
          : '',
        chunkNotes: p.title || `Page ${idx + 1}`,
        topicName: p.title || `Page ${idx + 1}`,
        mcqs: newPayload.mcqData || newPayload.manualMcqData || [],
      }));

      const targetLucentEntry: LucentNoteEntry = {
        id: targetEntryId,
        subject: 'math',
        bookName: 'गणित (Mathematics)',
        classLevel: targetC as any,
        board: targetB === 'ALL' ? undefined : (targetB as any),
        lessonTitle: chTitle,
        pages: newPages.length > 0 ? newPages : [{ id: 'p_1', pageNo: '1', content: chTitle, mcqs: [] }],
        isMathLesson: true,
        mathBookPages: newPayload.mathBookPages || [],
        mathPremiumNotesPages: newPayload.mathPremiumNotesPages || [],
        mathSolutionPages: newPayload.mathSolutionPages || [],
        chapterId: chId,
        updatedAt: new Date().toISOString(),
      };

      if (isMove) {
        // Delete old entry from lucentNotes
        lucentNotes = lucentNotes.filter(
          n =>
            n.id !== source.key &&
            n.id !== `math_${source.board}_${source.classLevel}_${source.chapterId}` &&
            !(n.chapterId === source.chapterId && String(n.classLevel) === String(source.classLevel) && n.board === source.board)
        );
        // Delete old key if different
        if (source.key !== targetKey) {
          try {
            await saveChapterData(source.key, null);
          } catch {}
          deleteFromMathChapterIndex(source.key);
        }
      }

      // Add/update target entry
      const existingIdx = lucentNotes.findIndex(n => n.id === targetEntryId);
      if (existingIdx >= 0) {
        lucentNotes[existingIdx] = targetLucentEntry;
      } else {
        lucentNotes.push(targetLucentEntry);
      }

      const updatedSettings = { ...currentSettings, lucentNotes };
      if (onUpdateSettings) onUpdateSettings(updatedSettings);
      localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
      if (onSaveSettings) {
        await onSaveSettings(updatedSettings);
      } else {
        await saveSystemSettings(updatedSettings);
      }

      // 4. Update index
      updateMathChapterIndex({
        key: targetKey,
        board: targetB,
        classLevel: targetC,
        chapterId: chId,
        chapterTitle: chTitle,
        bookPagesCount: newPayload.mathBookPages?.length || 0,
        premiumNotesCount: newPayload.mathPremiumNotesPages?.length || 0,
        solutionPagesCount: newPayload.mathSolutionPages?.length || 0,
        mcqsCount: (newPayload.mcqData || newPayload.manualMcqData || []).length,
        updatedAt: new Date().toISOString(),
      });

      // If active chapter was moved, switch editor's board to new board!
      if (isMove && source.chapterId === chapterId && source.classLevel === selectedClass) {
        setSelectedBoard(targetB);
        setSelectedClass(targetC);
      }

      setMoveCopySource(null);
      loadHistoryList();
      setStatusMessage({
        text: `✅ Chapter "${chTitle}" safaltapoorvak ${targetB} (Class ${targetC}) me ${isMove ? 'move' : 'copy'} ho gaya!`,
        type: 'SUCCESS',
      });
    } catch (err: any) {
      console.error('Error during move/copy:', err);
      setStatusMessage({ text: `❌ Move/Copy fail ho gaya: ${err?.message || 'Error'}`, type: 'ERROR' });
    } finally {
      setIsMoveCopying(false);
    }
  };

  // ===================== DELETE CHAPTER =====================
  const handleDeleteChapter = async (item: MathChapterSummary) => {
    if (!window.confirm(`Kya aap sach me Chapter "${item.chapterTitle}" (${item.board} - Class ${item.classLevel}) ko delete karna chahte hain?`)) {
      return;
    }

    try {
      // 1. Delete from Firestore & local storage
      await saveChapterData(item.key, null);

      // 2. Delete from settings.lucentNotes
      const currentSettings = settings || (() => {
        try {
          return JSON.parse(localStorage.getItem('nst_system_settings') || '{}');
        } catch {
          return {};
        }
      })();
      let lucentNotes: LucentNoteEntry[] = Array.isArray(currentSettings?.lucentNotes)
        ? [...currentSettings.lucentNotes]
        : [];

      lucentNotes = lucentNotes.filter(
        n =>
          n.id !== item.key &&
          n.id !== `math_${item.board}_${item.classLevel}_${item.chapterId}` &&
          !(n.chapterId === item.chapterId && String(n.classLevel) === String(item.classLevel) && (n.board === item.board || (!n.board && item.board === 'ALL')))
      );

      const updatedSettings = { ...currentSettings, lucentNotes };
      if (onUpdateSettings) onUpdateSettings(updatedSettings);
      localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
      if (onSaveSettings) {
        await onSaveSettings(updatedSettings);
      } else {
        await saveSystemSettings(updatedSettings);
      }

      // 3. Remove from fast index
      deleteFromMathChapterIndex(item.key);
      loadHistoryList();

      if (item.chapterId === chapterId && item.classLevel === selectedClass && item.board === selectedBoard) {
        setBookPages([]);
        setPremiumNotesPages([]);
        setSolutionPages([]);
        setMcqs([]);
      }

      setStatusMessage({ text: `🗑️ Chapter "${item.chapterTitle}" delete ho gaya!`, type: 'SUCCESS' });
    } catch (err: any) {
      console.error('Error deleting chapter:', err);
      setStatusMessage({ text: `❌ Delete nahi ho paya: ${err?.message || 'Error'}`, type: 'ERROR' });
    }
  };

  // ===================== PREVIEW AS STUDENT =====================
  const handlePreviewAsStudent = async (item?: MathChapterSummary) => {
    let pagesToUse = bookPages;
    let notesToUse = premiumNotesPages;
    let solutionsToUse = solutionPages;
    let mcqsToUse = mcqs;
    let titleToUse = chapterTitle;

    if (item && item.key !== getContentKey(selectedBoard, selectedClass, chapterId)) {
      const data = await getChapterData(item.key);
      if (data) {
        pagesToUse = data.mathBookPages || [];
        notesToUse = data.mathPremiumNotesPages || [];
        solutionsToUse = data.mathSolutionPages || [];
        mcqsToUse = data.mcqs || data.manualMcqData || data.mcqData || [];
        titleToUse = item.chapterTitle;
      }
    }

    setStudentPreviewContent({
      id: 'preview',
      title: titleToUse,
      subtitle: 'Student Math Reader Preview',
      content: '',
      type: 'NOTES_SIMPLE',
      dateCreated: new Date().toISOString(),
      subjectName: 'Mathematics',
      isComingSoon: false,
      mathBookPages: pagesToUse,
      mathPremiumNotesPages: notesToUse,
      mathSolutionPages: solutionsToUse,
      mcqData: mcqsToUse,
    });
  };

  // Filtered History list
  const filteredHistory = historyList.filter(item => {
    if (filterClass !== 'ALL' && item.classLevel !== filterClass) return false;
    if (filterBoard !== 'ALL' && item.board !== filterBoard) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.chapterTitle.toLowerCase().includes(q);
      const matchId = item.chapterId.toLowerCase().includes(q);
      if (!matchTitle && !matchId) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* ── TOP HEADER ── */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition cursor-pointer"
            title="Wapas Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">📐</span>
              <h1 className="text-base sm:text-lg font-black text-white truncate">
                Math Master Content Manager
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Class 6-12 &amp; All Boards
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Book Pages, Notes, Solutions, MCQs, History &amp; Board Movement
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Editor vs History) */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setManagerView('EDITOR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                managerView === 'EDITOR'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>✍️</span>
              <span>Chapter Editor</span>
            </button>
            <button
              onClick={() => {
                setManagerView('HISTORY');
                loadHistoryList();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                managerView === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History size={14} />
              <span>Saved History</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {historyList.length}
              </span>
            </button>
          </div>

          {managerView === 'EDITOR' && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Move / Copy button in editor */}
              <button
                onClick={() => handleOpenMoveCopy()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 transition cursor-pointer"
                title="Is chapter ko doosre board me move ya copy karein"
              >
                <MoveRight size={15} className="text-amber-400" />
                <span className="hidden sm:inline">Move/Copy Board</span>
              </button>

              <button
                onClick={() => handlePreviewAsStudent()}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition cursor-pointer"
                title="Student View Preview"
              >
                <Eye size={16} className="text-emerald-400" />
              </button>

              <button
                onClick={loadChapterContent}
                disabled={isLoading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition cursor-pointer"
                title="Reload content"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 active:scale-95 transition cursor-pointer ${
                  isSaving ? 'opacity-70 cursor-wait' : ''
                }`}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{isSaving ? 'Saving...' : 'Save Math Chapter'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── STATUS ALERT NOTIFICATION ── */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between transition-all ${
            statusMessage.type === 'SUCCESS' ? 'bg-emerald-900/80 text-emerald-200' : 'bg-red-900/80 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'SUCCESS' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-white/60 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ===================== VIEW 1: SAVED HISTORY & BOARD MANAGER ===================== */}
      {managerView === 'HISTORY' ? (
        <div className="max-w-6xl w-full mx-auto p-4 space-y-4 flex-1">
          {/* Header Card with Filters */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <History className="text-indigo-400" size={18} />
                  <span>Math Chapters History &amp; Board Movement</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Sabhi saved chapters yahan list hain. Yahan se kisi bhi chapter ko doosre board me Move ya Copy karein.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadHistoryList();
                    setStatusMessage({ text: 'Chapters list refresh ho gayi!', type: 'SUCCESS' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 active:scale-95 transition cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Refresh List</span>
                </button>
                <button
                  onClick={() => {
                    setChapterId(`ch_${Date.now()}`);
                    setChapterTitle('Naya Ganit Chapter');
                    setBookPages([]);
                    setPremiumNotesPages([]);
                    setSolutionPages([]);
                    setMcqs([]);
                    setManagerView('EDITOR');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white shadow-md active:scale-95 transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add New Chapter</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search chapter title or ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Class Filter */}
              <div>
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Classes (Sabhi Kaksha)</option>
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Board Filter */}
              <div>
                <select
                  value={filterBoard}
                  onChange={e => setFilterBoard(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Boards (Sabhi Board)</option>
                  {BOARDS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Chapters List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <span className="text-4xl">📚</span>
              <p className="text-sm font-black text-slate-300">Koi Math Chapter Nahi Mila</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Filter change karein ya Chapter Editor me jakar naye pages upload karke "Save Math Chapter" dabayein.
              </p>
              <button
                onClick={() => setManagerView('EDITOR')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white cursor-pointer"
              >
                <Plus size={14} />
                <span>Naya Chapter Banayein</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map(item => {
                const boardObj = BOARDS.find(b => b.id === item.board);
                const boardLabel = boardObj ? boardObj.label.split('(')[0].trim() : item.board;

                return (
                  <div
                    key={item.key}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between gap-3 transition group"
                  >
                    <div className="space-y-2">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Class {item.classLevel}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {boardLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {item.chapterId}
                        </span>
                      </div>

                      {/* Chapter Title */}
                      <h3 className="text-sm font-black text-white group-hover:text-blue-300 transition line-clamp-2">
                        {item.chapterTitle}
                      </h3>

                      {/* Content Stats Pills */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                          <span>📖</span>
                          <span>{item.bookPagesCount} Book Pages</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                          <span>📝</span>
                          <span>{item.premiumNotesCount} Notes</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                          <span>💡</span>
                          <span>{item.solutionPagesCount} Solutions</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                          <span>🎯</span>
                          <span>{item.mcqsCount} MCQs</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectForEdit(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold active:scale-95 transition cursor-pointer"
                          title="Is chapter ko editor me load karein"
                        >
                          <span>✏️</span>
                          <span>Edit / Load</span>
                        </button>

                        <button
                          onClick={() => handleOpenMoveCopy(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold active:scale-95 transition cursor-pointer"
                          title="Doosre board me Move ya Copy karein"
                        >
                          <MoveRight size={13} />
                          <span>Move / Copy</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePreviewAsStudent(item)}
                          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 active:scale-90 transition cursor-pointer"
                          title="Student View Preview"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteChapter(item)}
                          className="p-1.5 rounded-xl bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-800 active:scale-90 transition cursor-pointer"
                          title="Chapter Delete Karein"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ===================== VIEW 2: CHAPTER EDITOR ===================== */
        <div className="max-w-6xl w-full mx-auto p-4 space-y-5 flex-1">
          {/* TARGET SETTINGS CARD */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>🎯 Target Settings (Class &amp; Board Selection)</span>
              </h2>
              <button
                onClick={() => handleOpenMoveCopy()}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <MoveRight size={13} />
                <span>Move to Another Board</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Class */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-400 mb-1 block">Class Level:</label>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Board */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-400 mb-1 block">Board:</label>
                <select
                  value={selectedBoard}
                  onChange={e => setSelectedBoard(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  {BOARDS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter ID */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-400 mb-1 block">Chapter ID / Key:</label>
                <input
                  type="text"
                  value={chapterId}
                  onChange={e => setChapterId(e.target.value.trim().toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. ch_1, ch_2"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Chapter Title */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-400 mb-1 block">Chapter Title / Naam:</label>
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={e => setChapterTitle(e.target.value)}
                  placeholder="e.g. वास्तविक संख्याएँ (Real Numbers)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 4 MODES TABS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'BOOK', label: '📖 Book Pages', count: bookPages.length, color: 'border-blue-500 text-blue-400' },
              { id: 'PREMIUM_NOTES', label: '📝 Premium Notes', count: premiumNotesPages.length, color: 'border-amber-500 text-amber-400' },
              { id: 'SOLUTION', label: '💡 Book Solution', count: solutionPages.length, color: 'border-emerald-500 text-emerald-400' },
              { id: 'MCQ', label: '🎯 MCQ Arena', count: mcqs.length, color: 'border-purple-500 text-purple-400' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  activeTab === tab.id
                    ? `bg-slate-800 ${tab.color} shadow-lg shadow-black/40`
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                  {tab.count} {tab.id === 'MCQ' ? 'Questions' : 'Pages'}
                </span>
              </button>
            ))}
          </div>

          {/* UPLOAD & ADD SECTION FOR MODES 1, 2, 3 */}
          {activeTab !== 'MCQ' && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Upload size={14} className="text-blue-400" />
                  <span>
                    Upload {activeTab === 'BOOK' ? 'Book' : activeTab === 'PREMIUM_NOTES' ? 'Premium Notes' : 'Solution'} Pages
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Multi-page support: 1 se zyada photos ek sath select karein
                </span>
              </div>

              {/* Multi File Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    Photos select karein (Phone Gallery ya Computer se)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Har photo Telegram Cloud Storage ke HD vault pe save hogi aur page number auto-assign hoga
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {uploadProgress && (
                <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/30 text-xs font-bold text-blue-300 flex items-center gap-2 animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {/* Single URL manual paste fallback */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="text-[11px] font-bold text-slate-400 block">
                  Ya direct Image URL paste karein:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={singleUrl}
                    onChange={e => setSingleUrl(e.target.value)}
                    placeholder="https://i.ibb.co/..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={singleTitle}
                    onChange={e => setSingleTitle(e.target.value)}
                    placeholder="Page Title (optional)"
                    className="w-36 sm:w-48 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddSingleUrl}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-white border border-slate-600 active:scale-95 transition cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PAGES LIST VIEW (MODES 1, 2, 3) */}
          {activeTab !== 'MCQ' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ImageIcon size={14} className="text-blue-400" />
                  <span>
                    Uploaded Pages (
                    {activeTab === 'BOOK'
                      ? bookPages.length
                      : activeTab === 'PREMIUM_NOTES'
                      ? premiumNotesPages.length
                      : solutionPages.length}
                    )
                  </span>
                </h3>
                {(activeTab === 'BOOK' ? bookPages.length : activeTab === 'PREMIUM_NOTES' ? premiumNotesPages.length : solutionPages.length) > 0 && (
                  <span className="text-[11px] text-slate-500">
                    Use Up/Down arrows to reorder pages
                  </span>
                )}
              </div>

              {(() => {
                const currentPages =
                  activeTab === 'BOOK'
                    ? bookPages
                    : activeTab === 'PREMIUM_NOTES'
                    ? premiumNotesPages
                    : solutionPages;

                if (currentPages.length === 0) {
                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
                      Abhi tak is section me koi photo upload nahi hui. Upar diye button se photos add karein.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentPages.map((page, idx) => (
                      <div
                        key={page.id || idx}
                        className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-2.5 shadow-md flex flex-col justify-between gap-2 group hover:border-slate-700 transition"
                      >
                        {/* Image Preview Thumbnail */}
                        <div
                          onClick={() => setPreviewImage(page.imageUrl)}
                          className="relative w-full aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden cursor-pointer group-hover:opacity-90 transition"
                        >
                          <img
                            src={page.imageUrl}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-[10px] font-black border border-white/20">
                            Page {page.pageNo || idx + 1}
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                            <Eye size={14} /> View Full
                          </div>
                        </div>

                        {/* Title & Controls */}
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white truncate">
                            {page.title || `Page ${page.pageNo || idx + 1}`}
                          </p>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMovePage(activeTab, idx, 'UP')}
                                disabled={idx === 0}
                                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMovePage(activeTab, idx, 'DOWN')}
                                disabled={idx === currentPages.length - 1}
                                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Down"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeletePage(activeTab, idx)}
                              className="p-1 rounded bg-red-950/50 hover:bg-red-900 text-red-400 hover:text-red-200 transition"
                              title="Delete Page"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===================== MCQ ARENA BUILDER (MODE 4) ===================== */}
          {activeTab === 'MCQ' && (
            <div className="space-y-4">
              {/* Add Question Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Plus size={16} />
                  <span>Add New Math MCQ Question</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">Question Text:</label>
                    <textarea
                      rows={2}
                      value={newQuestion}
                      onChange={e => setNewQuestion(e.target.value)}
                      placeholder="e.g. निम्नलिखित में कौन सी संख्या परिमेय संख्या है? (Which of the following is a rational number?)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* 4 Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Option A', val: optionA, setVal: setOptionA, idx: 0 },
                      { label: 'Option B', val: optionB, setVal: setOptionB, idx: 1 },
                      { label: 'Option C', val: optionC, setVal: setOptionC, idx: 2 },
                      { label: 'Option D', val: optionD, setVal: setOptionD, idx: 3 },
                    ].map(opt => (
                      <div key={opt.idx} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10.5px] font-bold text-slate-400">{opt.label}:</label>
                          <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-400 cursor-pointer">
                            <input
                              type="radio"
                              name="correctOption"
                              checked={correctOption === opt.idx}
                              onChange={() => setCorrectOption(opt.idx)}
                              className="accent-emerald-500"
                            />
                            <span>Sahi Jawab (Correct)</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={opt.val}
                          onChange={e => opt.setVal(e.target.value)}
                          placeholder={`Enter ${opt.label}...`}
                          className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs font-bold text-white outline-none ${
                            correctOption === opt.idx ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-slate-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Solution / Explanation */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">हल / Explanation (Optional):</label>
                    <input
                      type="text"
                      value={explanation}
                      onChange={e => setExplanation(e.target.value)}
                      placeholder="e.g. √25 = 5 एक पूर्णांक है, इसलिए यह परिमेय संख्या है।"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddMcq}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black text-white shadow-md active:scale-95 transition cursor-pointer"
                    >
                      + Add Question
                    </button>
                  </div>
                </div>
              </div>

              {/* MCQs List */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Total Questions Added ({mcqs.length})
                </h3>

                {mcqs.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs">
                    Is chapter ke liye abhi koi MCQ nahi hai. Upar se sawaal add karein.
                  </div>
                ) : (
                  mcqs.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-white">{q.question}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMcq(idx)}
                          className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-400 hover:text-red-200 active:scale-90 transition cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Options list */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-xl border flex items-center gap-2 ${
                              optIdx === q.correctAnswer
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] font-black flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="truncate">{opt}</span>
                            {optIdx === q.correctAnswer && <Check size={14} className="text-emerald-400 ml-auto" />}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="text-[11px] text-slate-400 bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                          <span className="font-bold text-amber-400">हल: </span>
                          <span>{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL: MOVE OR COPY TO BOARD ===================== */}
      {moveCopySource && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <div>
                  <h3 className="text-sm font-black text-white">Move / Copy Lesson to Board</h3>
                  <p className="text-[11px] text-slate-400">Ek board se doosre board me bhejein ya clone karein</p>
                </div>
              </div>
              <button
                onClick={() => setMoveCopySource(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Lesson Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5 text-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected Chapter:</p>
              <p className="font-black text-white text-sm">{moveCopySource.chapterTitle}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Class {moveCopySource.classLevel}</span>
                <span>•</span>
                <span>Current Board: <strong className="text-amber-400">{moveCopySource.board}</strong></span>
              </div>
            </div>

            {/* Target Board Selector */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">
                  Target Board (Kahan Bhejna Hai):
                </label>
                <select
                  value={targetMoveBoard}
                  onChange={e => setTargetMoveBoard(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  {BOARDS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">
                  Target Class Level:
                </label>
                <select
                  value={targetMoveClass}
                  onChange={e => setTargetMoveClass(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  {CLASSES.map(cls => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description note */}
            <div className="text-[11px] text-slate-400 bg-blue-950/30 border border-blue-900/40 rounded-xl p-2.5">
              💡 <strong>Copy (Duplicate)</strong> se original board me bhi rahega aur naye board me bhi add hoga. <strong>Move</strong> se puraana hat kar naye board me shift hoga.
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isMoveCopying}
                onClick={() => handleExecuteMoveCopy(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black text-white shadow-lg active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isMoveCopying ? <Loader2 size={14} className="animate-spin" /> : <MoveRight size={14} />}
                <span>Move (Shift)</span>
              </button>

              <button
                type="button"
                disabled={isMoveCopying}
                onClick={() => handleExecuteMoveCopy(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white shadow-lg active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isMoveCopying ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                <span>Copy (Clone)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW MODAL ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl relative">
            <img src={previewImage} alt="Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── STUDENT READER PREVIEW MODAL ── */}
      {studentPreviewContent && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <MathLessonViewer
            content={studentPreviewContent}
            chapterTitle={studentPreviewContent.title}
            subjectName="Mathematics"
            user={currentUser || { id: 'admin', name: 'Admin', role: 'ADMIN' } as any}
            onBack={() => setStudentPreviewContent(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AdminMathManager;
