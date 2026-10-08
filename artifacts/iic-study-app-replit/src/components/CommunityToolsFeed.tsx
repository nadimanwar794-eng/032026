import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Plus,
  ExternalLink,
  Search,
  Sparkles,
  Heart,
  Share2,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Calculator,
  BookOpen,
  Atom,
  Layers,
  Globe,
  SlidersHorizontal,
  Eye,
  Maximize2,
  Minimize2,
  Lock,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { User } from '../types';

export interface CommunityTool {
  id: string;
  title: string;
  tagline: string;
  description?: string;
  toolUrl: string;
  actionText?: string;
  category: 'MATH' | 'SCIENCE' | 'CALCULATOR' | 'DICTIONARY' | 'UTILITY' | 'AI' | 'STUDY_APP' | 'GENERAL' | string;
  iconUrl?: string;
  badge?: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  createdAt: number;
  likes?: Record<string, boolean>; // userId -> true
  openCount?: number;
  isOfficial?: boolean;
}

interface CommunityToolsFeedProps {
  user: User;
  isAdmin?: boolean;
  onClose?: () => void;
  externalSearchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Tools', icon: Compass },
  { id: 'MATH', label: 'Math', icon: Calculator },
  { id: 'SCIENCE', label: 'Science & Labs', icon: Atom },
  { id: 'CALCULATOR', label: 'Calculators', icon: SlidersHorizontal },
  { id: 'DICTIONARY', label: 'Dictionary & Words', icon: BookOpen },
  { id: 'UTILITY', label: 'Utilities', icon: Wrench },
  { id: 'STUDY_APP', label: 'Study Apps', icon: Globe },
];

const SEED_TOOLS: CommunityTool[] = [
  {
    id: 'seed_geogebra',
    title: 'GeoGebra Graphing Calculator',
    tagline: 'Interactive 2D & 3D graphing, geometry, and equation solver.',
    description: 'Powerful visual math tool for graphs, coordinate geometry, trigonometry, functions, and calculus visual simulations.',
    toolUrl: 'https://www.geogebra.org/calculator',
    actionText: 'Launch Calculator',
    category: 'MATH',
    badge: 'Must Have',
    iconUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    openCount: 420,
    likes: {},
    isOfficial: true,
  },
  {
    id: 'seed_phet',
    title: 'PhET Interactive Science Labs',
    tagline: 'Virtual physics, chemistry, and biology experimental simulations.',
    description: 'Interactive HTML5 lab experiments created by University of Colorado Boulder for deep conceptual science learning.',
    toolUrl: 'https://phet.colorado.edu/en/simulations/filter?type=html',
    actionText: 'Explore Labs',
    category: 'SCIENCE',
    badge: 'Lab Simulator',
    iconUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    openCount: 310,
    likes: {},
    isOfficial: true,
  },
  {
    id: 'seed_ptable',
    title: 'Ptable Interactive Periodic Table',
    tagline: 'Dynamic periodic table with element states, isotopes & electron clouds.',
    description: 'Every chemical element with detailed properties, orbital visualizer, compound discovery, and temperature physical state slider.',
    toolUrl: 'https://ptable.com/',
    actionText: 'Open Periodic Table',
    category: 'SCIENCE',
    badge: 'Top Chemistry',
    iconUrl: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    openCount: 275,
    likes: {},
    isOfficial: true,
  },
  {
    id: 'seed_speed_math',
    title: 'Speed Math & Formula Solver',
    tagline: 'Multiplication table drills, fractions, and instant algebraic simplifier.',
    description: 'Sharpen mental speed calculation skills for competitive exams, board tests, and daily homework problem solving.',
    toolUrl: 'https://quickmath.com/',
    actionText: 'Solve Problem',
    category: 'CALCULATOR',
    badge: 'Quick Solver',
    iconUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    openCount: 198,
    likes: {},
    isOfficial: true,
  },
  {
    id: 'seed_cambridge',
    title: 'Cambridge English & Grammar Learner',
    tagline: 'Instant Hindi-English word meanings, phonetics, and sample sentences.',
    description: 'Trusted online dictionary and vocabulary reference tool with audio pronunciation guides for improving language proficiency.',
    toolUrl: 'https://dictionary.cambridge.org/dictionary/english-hindi/',
    actionText: 'Lookup Words',
    category: 'DICTIONARY',
    badge: 'Language',
    iconUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    openCount: 164,
    likes: {},
    isOfficial: true,
  },
  {
    id: 'seed_pdf_util',
    title: 'Study Notes & PDF Toolkit',
    tagline: 'Compress heavy PDF notes, merge handouts, and organize documents.',
    description: 'Fast, secure browser tool to merge lecture PDFs, convert images into notes PDF, and compress files for easy sharing.',
    toolUrl: 'https://www.ilovepdf.com/',
    actionText: 'Open PDF Tool',
    category: 'UTILITY',
    badge: 'Study Utility',
    iconUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=160&auto=format&fit=crop&q=80',
    authorId: 'admin_official',
    authorName: 'Admin Team',
    authorRole: 'ADMIN',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    openCount: 220,
    likes: {},
    isOfficial: true,
  }
];

export const CommunityToolsFeed: React.FC<CommunityToolsFeedProps> = ({
  user,
  isAdmin = false,
  onClose,
  externalSearchQuery,
  onSearchQueryChange,
}) => {
  const isUserAdmin = isAdmin || user.role === 'ADMIN' || user.role === 'SUB_ADMIN' || (user as any).isAdmin === true;

  const [tools, setTools] = useState<CommunityTool[]>(() => {
    try {
      const cached = localStorage.getItem('nsta_community_tools_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return SEED_TOOLS;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTool, setEditingTool] = useState<CommunityTool | null>(null);

  // Form states for Admin
  const [formTitle, setFormTitle] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formActionText, setFormActionText] = useState('Open Tool');
  const [formCategory, setFormCategory] = useState('UTILITY');
  const [formBadge, setFormBadge] = useState('Verified');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // In-app preview modal
  const [previewTool, setPreviewTool] = useState<CommunityTool | null>(null);
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Real-time synchronization with Firebase RTDB
  useEffect(() => {
    if (!rtdb) return;
    try {
      const toolsRef = ref(rtdb, 'community_tools');
      const unsubscribe = onValue(
        toolsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const loadedTools: CommunityTool[] = Object.keys(data).map((key) => ({
              ...data[key],
              id: key,
            }));
            // Sort by createdAt desc
            loadedTools.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            // Merge with seed tools (seed tools don't overwrite if deleted)
            const seedUnadded = SEED_TOOLS.filter(st => !loadedTools.some(lt => lt.id === st.id));
            const merged = [...loadedTools, ...seedUnadded];

            setTools(merged);
            try {
              localStorage.setItem('nsta_community_tools_cache', JSON.stringify(merged));
            } catch (_) {}
          } else {
            // Seed defaults if empty
            setTools(SEED_TOOLS);
          }
        },
        (error) => {
          console.warn('[CommunityToolsFeed] RTDB sync warning:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[CommunityToolsFeed] Error attaching listener:', err);
    }
  }, []);

  const effectiveSearch = (externalSearchQuery !== undefined ? externalSearchQuery : searchQuery).trim().toLowerCase();

  // Filter tools: strictly only show tools posted/verified by admin (no spam or non-admin posts)
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      // Must be an official or admin-created tool
      const isOfficialOrAdmin =
        t.isOfficial === true ||
        t.authorRole === 'ADMIN' ||
        t.authorRole === 'SUB_ADMIN' ||
        t.authorId === 'admin_official' ||
        t.id?.startsWith('seed_');
      if (!isOfficialOrAdmin) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (effectiveSearch) {
        const matchesTitle = t.title.toLowerCase().includes(effectiveSearch);
        const matchesTagline = (t.tagline || '').toLowerCase().includes(effectiveSearch);
        const matchesDesc = (t.description || '').toLowerCase().includes(effectiveSearch);
        const matchesCat = (t.category || '').toLowerCase().includes(effectiveSearch);
        const matchesBadge = (t.badge || '').toLowerCase().includes(effectiveSearch);
        if (!matchesTitle && !matchesTagline && !matchesDesc && !matchesCat && !matchesBadge) {
          return false;
        }
      }
      return true;
    });
  }, [tools, selectedCategory, effectiveSearch]);

  const handleOpenAddModal = (toolToEdit?: CommunityTool) => {
    if (!isUserAdmin) {
      showToast('Sirf Admin naye tools add kar sakte hain.');
      return;
    }
    if (toolToEdit) {
      setEditingTool(toolToEdit);
      setFormTitle(toolToEdit.title);
      setFormTagline(toolToEdit.tagline);
      setFormDescription(toolToEdit.description || '');
      setFormUrl(toolToEdit.toolUrl);
      setFormActionText(toolToEdit.actionText || 'Open Tool');
      setFormCategory(toolToEdit.category || 'UTILITY');
      setFormBadge(toolToEdit.badge || 'Verified');
      setFormIconUrl(toolToEdit.iconUrl || '');
    } else {
      setEditingTool(null);
      setFormTitle('');
      setFormTagline('');
      setFormDescription('');
      setFormUrl('');
      setFormActionText('Open Tool');
      setFormCategory('UTILITY');
      setFormBadge('Verified');
      setFormIconUrl('');
    }
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUserAdmin) {
      setFormError('Action unauthorized. Only admin can add or edit tools.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Tool ka Title likhna zaroori hai.');
      return;
    }
    if (!formTagline.trim()) {
      setFormError('Tool ki brief tagline likhein.');
      return;
    }
    if (!formUrl.trim() || !formUrl.startsWith('http')) {
      setFormError('Valid website / tool URL daalein (https:// se shuru hona chahiye).');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const toolId = editingTool ? editingTool.id : `tool_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const payload: CommunityTool = {
        id: toolId,
        title: formTitle.trim(),
        tagline: formTagline.trim(),
        description: formDescription.trim() || undefined,
        toolUrl: formUrl.trim(),
        actionText: formActionText.trim() || 'Open Tool',
        category: formCategory,
        badge: formBadge.trim() || undefined,
        iconUrl: formIconUrl.trim() || undefined,
        authorId: user.id || 'admin',
        authorName: user.name || 'Admin',
        authorRole: user.role || 'ADMIN',
        createdAt: editingTool?.createdAt || Date.now(),
        likes: editingTool?.likes || {},
        openCount: editingTool?.openCount || 0,
        isOfficial: true,
      };

      if (rtdb) {
        await set(ref(rtdb, `community_tools/${toolId}`), payload);
      }

      // Local update
      setTools((prev) => {
        const index = prev.findIndex((t) => t.id === toolId);
        let updatedList: CommunityTool[];
        if (index >= 0) {
          updatedList = [...prev];
          updatedList[index] = payload;
        } else {
          updatedList = [payload, ...prev];
        }
        try {
          localStorage.setItem('nsta_community_tools_cache', JSON.stringify(updatedList));
        } catch (_) {}
        return updatedList;
      });

      setIsAddModalOpen(false);
      showToast(editingTool ? 'Tool update ho gaya!' : 'Naya tool publish ho gaya!');
    } catch (err: any) {
      console.error('[CommunityToolsFeed] Error saving tool:', err);
      setFormError(err?.message || 'Tool save karte waqt error aaya.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!isUserAdmin) return;
    const confirmDelete = window.confirm('Kya aap sach me is tool ko delete karna chahte hain?');
    if (!confirmDelete) return;

    try {
      if (rtdb) {
        await remove(ref(rtdb, `community_tools/${toolId}`));
      }
      setTools((prev) => {
        const next = prev.filter((t) => t.id !== toolId);
        try {
          localStorage.setItem('nsta_community_tools_cache', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      showToast('Tool delete kar diya gaya.');
    } catch (err) {
      console.error('[CommunityToolsFeed] Error deleting tool:', err);
      showToast('Tool delete nahi ho paya.');
    }
  };

  const handleToggleLike = async (tool: CommunityTool) => {
    if (!user?.id) return;
    const isLiked = !!(tool.likes && tool.likes[user.id]);
    const updatedLikes = { ...(tool.likes || {}) };
    if (isLiked) {
      delete updatedLikes[user.id];
    } else {
      updatedLikes[user.id] = true;
    }

    // Local optimistic update
    setTools((prev) =>
      prev.map((t) => (t.id === tool.id ? { ...t, likes: updatedLikes } : t))
    );

    if (rtdb) {
      try {
        await set(ref(rtdb, `community_tools/${tool.id}/likes`), updatedLikes);
      } catch (err) {
        console.warn('[CommunityToolsFeed] Like sync warning:', err);
      }
    }
  };

  const handleLaunchTool = (tool: CommunityTool) => {
    // Increment openCount
    if (rtdb) {
      try {
        update(ref(rtdb, `community_tools/${tool.id}`), {
          openCount: (tool.openCount || 0) + 1,
        }).catch(() => {});
      } catch (_) {}
    }
    setTools((prev) =>
      prev.map((t) =>
        t.id === tool.id ? { ...t, openCount: (t.openCount || 0) + 1 } : t
      )
    );

    // Open in in-app modal preview
    setIframeBlocked(false);
    setPreviewMaximized(false);
    setPreviewTool(tool);
  };

  const handleShareTool = async (tool: CommunityTool) => {
    const textToShare = `📚 *${tool.title}* on NSTA Tools\n${tool.tagline}\n\nCheck out this study tool: ${tool.toolUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: tool.title,
          text: textToShare,
          url: tool.toolUrl,
        });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${tool.title} - ${tool.toolUrl}`);
        showToast('Tool link copy ho gayi!');
      } catch (_) {
        showToast('Link: ' + tool.toolUrl);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-3.5 sm:p-4 shadow-xs relative overflow-hidden shrink-0">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/25 shadow-xs">
              <Wrench size={20} className="text-amber-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  Study Tools & Utilities
                </h2>
                <span className="bg-white/25 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-amber-100">
                  {tools.length} Tools
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-100/90 leading-tight truncate">
                Admin curated web utilities, lab simulations & graphing calculators
              </p>
            </div>
          </div>

          {/* Admin "+ Add Tool" button OR Student Admin-Only Notice */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isUserAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="bg-white text-amber-900 hover:bg-amber-50 active:scale-95 transition-all text-xs font-black px-3 py-2 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} className="stroke-[3]" />
                <span className="hidden sm:inline">Add Tool</span>
                <span className="sm:hidden">Add</span>
              </button>
            ) : (
              <div
                className="bg-black/20 backdrop-blur-md border border-white/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1 text-[10px] text-amber-100 font-medium"
                title="Only teachers and admins can post tools here"
              >
                <ShieldCheck size={13} className="text-emerald-300" />
                <span className="hidden sm:inline">Admin Curated</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2.5 shrink-0 flex flex-col gap-2">
        {/* Search Input (if not managed by external header) */}
        {externalSearchQuery === undefined && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools, calculators, apps, simulators..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={13} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Grid / List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {filteredTools.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-3">
              <Wrench size={28} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              Koi Tool Nahi Mila
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {effectiveSearch
                ? `"${effectiveSearch}" ke liye koi result nahi hai. Kisi aur keyword se search karke dekhein.`
                : 'Is category me abhi koi tool publish nahi hua hai.'}
            </p>
            {isUserAdmin && (
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>Naya Tool Add Karein</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {filteredTools.map((tool) => {
              const isLiked = !!(tool.likes && user?.id && tool.likes[user.id]);
              const likeCount = Object.keys(tool.likes || {}).length;

              return (
                <div
                  key={tool.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Top Bar of Card */}
                  <div>
                    <div className="flex items-start gap-3">
                      {/* Icon or Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                        {tool.iconUrl ? (
                          <img
                            src={tool.iconUrl}
                            alt={tool.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Wrench size={22} className="text-amber-600 dark:text-amber-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                            {tool.title}
                          </h3>
                          {tool.badge && (
                            <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0">
                              {tool.badge}
                            </span>
                          )}
                        </div>

                        <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                          {tool.tagline}
                        </p>
                      </div>

                      {/* Admin Controls */}
                      {isUserAdmin && (
                        <div className="shrink-0 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(tool)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Tool"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTool(tool.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Delete Tool"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {tool.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
                        {tool.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Likes & Open Count */}
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(tool)}
                        className={`flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer active:scale-95 ${
                          isLiked ? 'text-rose-600 font-bold' : ''
                        }`}
                        title="Favorite"
                      >
                        <Heart
                          size={14}
                          className={isLiked ? 'fill-rose-500 text-rose-500' : ''}
                        />
                        <span className="text-[11px]">{likeCount > 0 ? likeCount : ''}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareTool(tool)}
                        className="p-1 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Share"
                      >
                        <Share2 size={14} />
                      </button>

                      {(tool.openCount || 0) > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                          <Eye size={12} />
                          {tool.openCount}
                        </span>
                      )}
                    </div>

                    {/* Launch Buttons */}
                    <div className="flex items-center gap-1.5">
                      <a
                        href={tool.toolUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Direct browser tab me kholein"
                      >
                        <ExternalLink size={14} />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleLaunchTool(tool)}
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{tool.actionText || 'Open Tool'}</span>
                        <ArrowUpRight size={13} className="stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IN-APP PREVIEW MODAL (With direct external fallback) */}
      {previewTool && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className={`bg-white dark:bg-slate-900 w-full rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all ${
              previewMaximized ? 'h-full max-w-none rounded-none' : 'h-[92vh] sm:h-[85vh] sm:max-w-4xl mx-auto'
            }`}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Wrench size={14} className="text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
                    {previewTool.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">
                    {previewTool.toolUrl}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <a
                  href={previewTool.toolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                  title="Open in Browser"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMaximized((v) => !v)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer hidden sm:block"
                  title={previewMaximized ? 'Minimize' : 'Maximize'}
                >
                  {previewMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTool(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe or Fallback */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex flex-col">
              {iframeBlocked ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-3">
                    <ExternalLink size={30} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Direct Window Me Open Karein
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5">
                    Security policies ke kaaran ye website direct browser tab me behtar perform karti hai. Niche button par tap karke ise direct launch karein.
                  </p>
                  <a
                    href={previewTool.toolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                  >
                    <span>Launch {previewTool.title}</span>
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              ) : (
                <>
                  <iframe
                    src={previewTool.toolUrl}
                    title={previewTool.title}
                    className="w-full h-full border-0 bg-white"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    onError={() => setIframeBlocked(true)}
                  />
                  {/* Subtle floating fallback bar in case iframe doesn't render */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white text-[11px] px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-white/10 pointer-events-auto">
                    <span>Page load nahi ho raha?</span>
                    <a
                      href={previewTool.toolUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      New Tab Me Kholein <ExternalLink size={11} />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ADD / EDIT TOOL MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[450] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wrench size={18} />
                <h3 className="font-bold text-sm">
                  {editingTool ? 'Edit Study Tool' : 'Naya Study Tool Add Karein (Admin Only)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full text-white cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTool} className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {formError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                  <Info size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tool Ka Naam / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GeoGebra 3D Calculator, Periodic Table Pro..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Short Tagline / Brief *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graphing calculator & 3D geometry simulator"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tool URL */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tool URL / Website Link *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/tool"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="MATH">Math</option>
                    <option value="SCIENCE">Science & Labs</option>
                    <option value="CALCULATOR">Calculator</option>
                    <option value="DICTIONARY">Dictionary</option>
                    <option value="UTILITY">Utility</option>
                    <option value="STUDY_APP">Study App</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Featured, Must Have, PRO"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                  </input>
                </div>
              </div>

              {/* Action Button Label & Icon URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="Open Tool / Launch"
                    value={formActionText}
                    onChange={(e) => setFormActionText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Icon / Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (optional)"
                    value={formIconUrl}
                    onChange={(e) => setFormIconUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Description / Padhai Me Madad (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Is tool se student ko kya fayda hoga ya ise kaise use karein..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl shadow-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{editingTool ? 'Update Tool' : 'Publish Tool'}</span>
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

export default CommunityToolsFeed;
