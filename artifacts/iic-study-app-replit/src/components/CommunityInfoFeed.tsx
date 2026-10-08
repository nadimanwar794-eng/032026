import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Rocket,
  Clock,
  CheckCircle2,
  Calendar,
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  Share2,
  Heart,
  ChevronDown,
  ChevronUp,
  Tag,
  Pin,
  ShieldCheck,
  TrendingUp,
  Zap,
  Layers,
  ArrowRight,
  Info,
  SlidersHorizontal,
  Flame,
  Award
} from 'lucide-react';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { User } from '../types';

export type UpdateStatus = 'COMING_SOON' | 'IN_PROGRESS' | 'TESTING' | 'PLANNED' | 'LAUNCHED';

export interface FutureUpdateItem {
  id: string;
  title: string;
  summary: string;
  description?: string;
  status: UpdateStatus;
  category: 'FEATURE' | 'AI' | 'TEST_SERIES' | 'NOTES' | 'UI_DESIGN' | 'COMMUNITY' | 'GENERAL' | string;
  targetDate?: string;
  versionTag?: string;
  highlights?: string[];
  imageUrl?: string;
  isPinned?: boolean;
  authorId: string;
  authorName: string;
  authorRole?: string;
  createdAt: number;
  likes?: Record<string, boolean>; // userId -> true
  openCount?: number;
}

interface CommunityInfoFeedProps {
  user: User;
  isAdmin?: boolean;
  onClose?: () => void;
  externalSearchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onSwitchToCommunity?: () => void;
  onSwitchToTools?: () => void;
}

const STATUS_CONFIG: Record<UpdateStatus, { label: string; badgeClass: string; barClass: string; icon: any }> = {
  COMING_SOON: {
    label: 'Coming Soon',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    barClass: 'bg-amber-500',
    icon: Rocket,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    barClass: 'bg-blue-500',
    icon: Zap,
  },
  TESTING: {
    label: 'Under Testing',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
    barClass: 'bg-purple-500',
    icon: Flame,
  },
  PLANNED: {
    label: 'Planned',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    barClass: 'bg-slate-400',
    icon: Clock,
  },
  LAUNCHED: {
    label: 'Live / Launched',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    barClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
};

const SEED_UPDATES: FutureUpdateItem[] = [
  {
    id: 'seed_update_ai_ocr',
    title: 'Smart AI Doubt Solver & Handwritten OCR 2.0',
    summary: 'Kisi bhi question ya rough notes ki photo click karein aur instant step-by-step Hindi & English detailed solution payein.',
    description: 'Hamari team advanced OCR aur academic reasoning AI integrate kar rahi hai jo handwritten Hindi aur English numerical problems, physics formulas aur chemistry equations ko flawlessly read karke authentic NCERT verified solutions provide karega.',
    status: 'COMING_SOON',
    category: 'AI',
    targetDate: 'Next Major Update (v2.5)',
    versionTag: 'v2.5.0',
    highlights: [
      'Hindi & English dono languages me instantaneous solution',
      'NCERT book reference aur formula recap sheet',
      'Similar practice questions ke suggestions'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    isPinned: true,
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    likes: { student_demo_1: true, student_demo_2: true, student_demo_3: true },
  },
  {
    id: 'seed_update_live_audio',
    title: 'Live Voice Doubt Rooms & Teacher Streaming',
    summary: 'Students ke group study rooms aur teachers ke sath direct live audio interaction facility.',
    description: 'Study sessions ko interactive banane ke liye hum voice chat rooms aur live teacher audio spaces la rahe hain jahan daily evening sessions me doubts discuss honge bina kisi high internet speed requirement ke.',
    status: 'IN_PROGRESS',
    category: 'COMMUNITY',
    targetDate: 'Next Month',
    versionTag: 'v2.6',
    highlights: [
      'Low-data consumption audio engine',
      'Raise hand aur verified student speak slots',
      'Daily scheduled teacher doubt hours'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80',
    isPinned: false,
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    likes: { student_demo_1: true },
  },
  {
    id: 'seed_update_offline_pdf',
    title: 'Offline PDF Notes Sync & Smart Document Highlighter',
    summary: 'Bina internet ke saare handwritten notes, summaries aur toppers copy offline read karein.',
    description: 'Ab poor internet connectivity ya travel ke dauran bhi aapke saved notes aur chapters seamlessly open honge with built-in digital pen, highlighter aur night-reading protection.',
    status: 'TESTING',
    category: 'NOTES',
    targetDate: 'Coming This Week',
    versionTag: 'v2.4.2',
    highlights: [
      '1-Click chapter bundle offline download',
      'Smart yellow/green color annotations',
      'Storage optimizer to keep app size light'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80',
    isPinned: false,
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    likes: {},
  },
  {
    id: 'seed_update_mock_test',
    title: 'All-India Sunday Mega Mock Tests & Scholarship Ranks',
    summary: 'Har Sunday state-level aur national level ranking test series with instant score analysis.',
    description: 'Real exam pattern par aadharit CBT exam simulation jisme negative marking, subject-wise time tracking aur percentile rank graph generate hoga.',
    status: 'PLANNED',
    category: 'TEST_SERIES',
    targetDate: 'Q4 2026',
    versionTag: 'Roadmap Milestone',
    highlights: [
      'Official examination timer & question palette',
      'All India Percentile & Accuracy report card',
      'Top rankers ke liye coins & certificate rewards'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
    isPinned: false,
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    likes: {},
  },
  {
    id: 'seed_update_dark_v2',
    title: 'Pure AMOLED Dark Theme & Custom Tier Dashboard',
    summary: 'Eyes-friendly true black dark mode aur personalized profile dashboard styling.',
    description: 'Battery saving pure OLED black styling, customizable bottom navigation layout aur instant night reading toggle ab sabhi users ke liye activate kar diya gaya hai.',
    status: 'LAUNCHED',
    category: 'UI_DESIGN',
    targetDate: 'Live Now',
    versionTag: 'v2.3.0',
    highlights: [
      'OLED True Black battery saver',
      'Fluid animations & smooth tab transitions',
      'Custom theme accents'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    isPinned: false,
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    likes: { student_demo_1: true, student_demo_2: true },
  }
];

export const CommunityInfoFeed: React.FC<CommunityInfoFeedProps> = ({
  user,
  isAdmin = false,
  onClose,
  externalSearchQuery,
  onSearchQueryChange,
  onSwitchToCommunity,
  onSwitchToTools,
}) => {
  const isUserAdmin = isAdmin || user.role === 'ADMIN' || user.role === 'SUB_ADMIN' || (user as any).isAdmin === true;

  const [updates, setUpdates] = useState<FutureUpdateItem[]>(() => {
    try {
      const cached = localStorage.getItem('nsta_community_future_info_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return SEED_UPDATES;
  });

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Admin Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FutureUpdateItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<UpdateStatus>('COMING_SOON');
  const [formCategory, setFormCategory] = useState('FEATURE');
  const [formTargetDate, setFormTargetDate] = useState('Next Update');
  const [formVersionTag, setFormVersionTag] = useState('');
  const [formHighlightsText, setFormHighlightsText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toast banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Real-time synchronization with Firebase RTDB
  useEffect(() => {
    if (!rtdb) return;
    try {
      const infoRef = ref(rtdb, 'community_future_info');
      const unsubscribe = onValue(
        infoRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const loadedList: FutureUpdateItem[] = Object.keys(data).map((key) => ({
              ...data[key],
              id: key,
            }));

            // Sort: Pinned first, then by createdAt desc
            loadedList.sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return (b.createdAt || 0) - (a.createdAt || 0);
            });

            // Merge with seed updates so page is never empty
            const seedUnadded = SEED_UPDATES.filter(st => !loadedList.some(lt => lt.id === st.id));
            const merged = [...loadedList, ...seedUnadded];

            setUpdates(merged);
            try {
              localStorage.setItem('nsta_community_future_info_cache', JSON.stringify(merged));
            } catch (_) {}
          } else {
            setUpdates(SEED_UPDATES);
          }
        },
        (error) => {
          console.warn('[CommunityInfoFeed] RTDB sync warning:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[CommunityInfoFeed] Error listener:', err);
      return undefined;
    }
  }, []);

  const effectiveSearch = (externalSearchQuery !== undefined ? externalSearchQuery : searchQuery).trim().toLowerCase();

  // Filtered list — strictly official/admin items only
  const filteredUpdates = useMemo(() => {
    return updates.filter((item) => {
      // Security filter: Only admin / official updates are displayed
      const isOfficialOrAdmin =
        item.authorRole === 'ADMIN' ||
        item.authorRole === 'SUB_ADMIN' ||
        item.authorId === 'admin_official' ||
        item.id.startsWith('seed_');
      if (!isOfficialOrAdmin) return false;

      // Status filter
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }

      // Search filter
      if (effectiveSearch) {
        const matchesTitle = (item.title || '').toLowerCase().includes(effectiveSearch);
        const matchesSummary = (item.summary || '').toLowerCase().includes(effectiveSearch);
        const matchesDesc = (item.description || '').toLowerCase().includes(effectiveSearch);
        const matchesCategory = (item.category || '').toLowerCase().includes(effectiveSearch);
        const matchesTarget = (item.targetDate || '').toLowerCase().includes(effectiveSearch);
        const matchesVersion = (item.versionTag || '').toLowerCase().includes(effectiveSearch);
        if (!matchesTitle && !matchesSummary && !matchesDesc && !matchesCategory && !matchesTarget && !matchesVersion) {
          return false;
        }
      }

      return true;
    });
  }, [updates, selectedStatus, effectiveSearch]);

  const handleOpenModal = (itemToEdit?: FutureUpdateItem) => {
    if (!isUserAdmin) {
      showToast('Sirf Admin app future feed post kar sakte hain.');
      return;
    }
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setFormTitle(itemToEdit.title);
      setFormSummary(itemToEdit.summary);
      setFormDescription(itemToEdit.description || '');
      setFormStatus(itemToEdit.status);
      setFormCategory(itemToEdit.category || 'FEATURE');
      setFormTargetDate(itemToEdit.targetDate || '');
      setFormVersionTag(itemToEdit.versionTag || '');
      setFormHighlightsText((itemToEdit.highlights || []).join('\n'));
      setFormImageUrl(itemToEdit.imageUrl || '');
      setFormIsPinned(!!itemToEdit.isPinned);
    } else {
      setEditingItem(null);
      setFormTitle('');
      setFormSummary('');
      setFormDescription('');
      setFormStatus('COMING_SOON');
      setFormCategory('FEATURE');
      setFormTargetDate('Next Update');
      setFormVersionTag('v2.5');
      setFormHighlightsText('');
      setFormImageUrl('');
      setFormIsPinned(false);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserAdmin) {
      setFormError('Unauthorized: Sirf admin update post kar sakte hain.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Update ka Title likhna zaroori hai.');
      return;
    }
    if (!formSummary.trim()) {
      setFormError('Short summary likhein taaki students ko pata chale kya aane wala hai.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const itemId = editingItem ? editingItem.id : `info_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const highlightsArray = formHighlightsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload: FutureUpdateItem = {
        id: itemId,
        title: formTitle.trim(),
        summary: formSummary.trim(),
        description: formDescription.trim() || undefined,
        status: formStatus,
        category: formCategory,
        targetDate: formTargetDate.trim() || undefined,
        versionTag: formVersionTag.trim() || undefined,
        highlights: highlightsArray.length > 0 ? highlightsArray : undefined,
        imageUrl: formImageUrl.trim() || undefined,
        isPinned: formIsPinned,
        authorId: user.id || 'admin',
        authorName: user.name || 'Admin',
        authorRole: user.role || 'ADMIN',
        createdAt: editingItem?.createdAt || Date.now(),
        likes: editingItem?.likes || {},
      };

      if (rtdb) {
        await set(ref(rtdb, `community_future_info/${itemId}`), payload);
      }

      setUpdates((prev) => {
        const idx = prev.findIndex((i) => i.id === itemId);
        let updated: FutureUpdateItem[];
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = payload;
        } else {
          updated = [payload, ...prev];
        }
        try {
          localStorage.setItem('nsta_community_future_info_cache', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      setIsModalOpen(false);
      showToast(editingItem ? 'Update edit ho gaya!' : '🚀 App Future update post ho gaya!');
    } catch (err: any) {
      console.error('[CommunityInfoFeed] Save error:', err);
      setFormError(err?.message || 'Update save karte waqt error aaya.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUpdate = async (itemId: string) => {
    if (!isUserAdmin) return;
    const confirmDelete = window.confirm('Kya aap is future roadmap post ko delete karna chahte hain?');
    if (!confirmDelete) return;

    try {
      if (rtdb) {
        await remove(ref(rtdb, `community_future_info/${itemId}`));
      }
      setUpdates((prev) => {
        const next = prev.filter((i) => i.id !== itemId);
        try {
          localStorage.setItem('nsta_community_future_info_cache', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      showToast('Post delete kar diya gaya.');
    } catch (err) {
      console.error('[CommunityInfoFeed] Delete error:', err);
      showToast('Delete nahi ho paya.');
    }
  };

  const handleToggleLike = async (item: FutureUpdateItem) => {
    if (!user?.id) return;
    const isLiked = !!(item.likes && item.likes[user.id]);
    const updatedLikes = { ...(item.likes || {}) };
    if (isLiked) {
      delete updatedLikes[user.id];
    } else {
      updatedLikes[user.id] = true;
    }

    setUpdates((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, likes: updatedLikes } : i))
    );

    if (rtdb) {
      try {
        await set(ref(rtdb, `community_future_info/${item.id}/likes`), updatedLikes);
      } catch (_) {}
    }
  };

  const handleShare = async (item: FutureUpdateItem) => {
    const textToShare = `🚀 *Upcoming in NSTA App:* ${item.title}\n\n${item.summary}\nTarget: ${item.targetDate || 'Coming Soon'}\n\nCheck full roadmap in NSTA Community!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: textToShare,
        });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${item.title}\n${item.summary}`);
        showToast('Roadmap details copy ho gayi!');
      } catch (_) {
        showToast('Copied!');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 text-white p-3.5 sm:p-4 shadow-xs relative overflow-hidden shrink-0">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/25 shadow-xs">
              <Rocket size={20} className="text-purple-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  App Future & Roadmap
                </h2>
                <span className="bg-white/25 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-purple-100 flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>Info Feed</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-purple-100/90 leading-tight truncate">
                Admin vision, upcoming releases, features & future milestones
              </p>
            </div>
          </div>

          {/* Admin "Post Update" button OR Student Admin-Only Tag */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isUserAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="bg-white text-purple-900 hover:bg-purple-50 active:scale-95 transition-all text-xs font-black px-3 py-2 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} className="stroke-[3]" />
                <span className="hidden sm:inline">Post Update</span>
                <span className="sm:hidden">Post</span>
              </button>
            ) : (
              <div
                className="bg-black/25 backdrop-blur-md border border-white/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1 text-[10px] text-purple-100 font-medium"
                title="Sirf Admin app future feed post kar sakte hain"
              >
                <ShieldCheck size={13} className="text-emerald-300" />
                <span className="hidden sm:inline">Admin Verified</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Status Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0 flex flex-col gap-2">
        {/* Search Input (if not managed by parent) */}
        {externalSearchQuery === undefined && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search upcoming features, updates, milestones..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Updates
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('COMING_SOON')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'COMING_SOON'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Rocket size={12} />
            <span>Coming Soon</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('IN_PROGRESS')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'IN_PROGRESS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Zap size={12} />
            <span>In Progress</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('TESTING')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'TESTING'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Flame size={12} />
            <span>Testing</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('PLANNED')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'PLANNED'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock size={12} />
            <span>Planned</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('LAUNCHED')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedStatus === 'LAUNCHED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Live / Launched</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
        {filteredUpdates.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mb-3">
              <Rocket size={26} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              Koi Update Nahi Mila
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {effectiveSearch
                ? `"${effectiveSearch}" ke liye koi roadmap item match nahi hua.`
                : 'Is filter ke andar abhi koi roadmap update nahi hai.'}
            </p>
            {isUserAdmin && (
              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>Naya Roadmap Item Dalein</span>
              </button>
            )}
          </div>
        ) : (
          filteredUpdates.map((item) => {
            const statusMeta = STATUS_CONFIG[item.status] || STATUS_CONFIG.PLANNED;
            const StatusIcon = statusMeta.icon;
            const isLiked = !!(item.likes && user?.id && item.likes[user.id]);
            const likeCount = Object.keys(item.likes || {}).length;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Status Accent Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${statusMeta.barClass}`} />

                {/* Header of Item */}
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        {item.isPinned && (
                          <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Pin size={10} className="fill-rose-500" />
                            <span>Pinned</span>
                          </span>
                        )}
                        <span
                          className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${statusMeta.badgeClass}`}
                        >
                          <StatusIcon size={11} />
                          <span>{statusMeta.label}</span>
                        </span>
                        {item.versionTag && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.versionTag}
                          </span>
                        )}
                        {item.targetDate && (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-auto">
                            <Calendar size={11} />
                            <span>{item.targetDate}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </h3>

                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    {/* Admin Options */}
                    {isUserAdmin && (
                      <div className="shrink-0 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit Roadmap Item"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUpdate(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Highlights Bullet Points */}
                  {item.highlights && item.highlights.length > 0 && (
                    <div className="mt-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl p-2.5 space-y-1">
                      <div className="text-[10.5px] font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={11} className="text-purple-600 dark:text-purple-400" />
                        <span>Key Features & Expectations:</span>
                      </div>
                      <ul className="space-y-1 mt-1">
                        {item.highlights.map((h, i) => (
                          <li
                            key={i}
                            className="text-[11.5px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5"
                          >
                            <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Collapsible Detailed Description */}
                  {item.description && (
                    <div className="mt-2.5">
                      {isExpanded ? (
                        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                          <p>{item.description}</p>
                          <button
                            type="button"
                            onClick={() => setExpandedId(null)}
                            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Kam dikhayein</span>
                            <ChevronUp size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedId(item.id)}
                          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>Aur padhein (Full Details)</span>
                          <ChevronDown size={13} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Optional Image Preview */}
                  {item.imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-48">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Footer of Card */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  {/* Left: Author / Admin Info */}
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <ShieldCheck size={13} className="text-purple-500" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      {item.authorName || 'NSTA Admin'}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Right: Excitement Upvote & Share */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(item)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                        isLiked
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title="Vote / Show Excitement"
                    >
                      <Rocket
                        size={13}
                        className={isLiked ? 'fill-rose-500 text-rose-500 animate-bounce' : 'text-slate-400'}
                      />
                      <span>Excited!</span>
                      {likeCount > 0 && <span className="text-[10px] ml-0.5">({likeCount})</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Share with friends"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Add / Edit Modal */}
      {isModalOpen && isUserAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white p-3.5 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Rocket size={18} className="text-purple-200" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingItem ? 'Edit Future Roadmap Update' : 'New Future / Info Feed Post'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUpdate} className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Feature / Update Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. AI Doubt Solver 2.0 / Offline Notes Reader"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              {/* Status and Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Current Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as UpdateStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="COMING_SOON">🚀 Coming Soon</option>
                    <option value="IN_PROGRESS">⚡ In Progress</option>
                    <option value="TESTING">🧪 Under Testing</option>
                    <option value="PLANNED">🎯 Planned</option>
                    <option value="LAUNCHED">✅ Live / Launched</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category Tag
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="FEATURE">New Feature</option>
                    <option value="AI">AI Tools</option>
                    <option value="TEST_SERIES">Mock Tests</option>
                    <option value="NOTES">Notes & PDF</option>
                    <option value="UI_DESIGN">UI & Dark Mode</option>
                    <option value="COMMUNITY">Community</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
              </div>

              {/* Target Timeline & Version Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Timeline
                  </label>
                  <input
                    type="text"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    placeholder="e.g. Next Month / Diwali / Q4"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Version Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={formVersionTag}
                    onChange={(e) => setFormVersionTag(e.target.value)}
                    placeholder="e.g. v2.5.0 / Beta"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Short Tagline / Summary *
                </label>
                <textarea
                  rows={2}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Ek ya do line me batayein is update se students ko kya milega..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              {/* Highlights (bullet points) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Highlights / Bullet points (Har line me ek point)
                </label>
                <textarea
                  rows={3}
                  value={formHighlightsText}
                  onChange={(e) => setFormHighlightsText(e.target.value)}
                  placeholder="Point 1&#10;Point 2&#10;Point 3"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Full Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Vision / Detailed Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed plans, why we are building this, and how it helps students..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Image URL & Pin */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Banner / Thumbnail Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Pin size={13} className="text-rose-500" />
                    <span>Pin to top (Sabse upar dikhayein)</span>
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Rocket size={14} />
                      <span>{editingItem ? 'Save Changes' : 'Publish Update'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
