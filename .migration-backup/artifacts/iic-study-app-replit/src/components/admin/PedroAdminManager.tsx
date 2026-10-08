import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Volume2, VolumeX, Save, RotateCcw, Plus, Trash2, Edit3, 
  ChevronDown, ChevronRight, Check, Sparkles, Sliders, ArrowLeft,
  BookOpen, Home, Swords, Zap, Clock, Rocket, MessageSquare, 
  ShoppingBag, User, HelpCircle, Eye, RefreshCw
} from 'lucide-react';
import { 
  SystemSettings, 
  PedroSystemConfig, 
  PedroPageConfig, 
  PedroCategory, 
  PedroItemDetail 
} from '../../types';
import { PEDRO_PAGE_KNOWLEDGE } from '../PedroAssistant';

interface Props {
  settings: SystemSettings;
  onSave: (updatedSettings: SystemSettings) => Promise<void> | void;
  onBack: () => void;
}

const FEATURE_LIST: { key: string; label: string; icon: string; desc: string }[] = [
  { key: 'HOME', label: 'Home Screen Pedro', icon: '🏠', desc: 'Class switcher, syllabus, search & streaks' },
  { key: 'STUDY_MODE', label: 'Study Mode & 9 Tools Pedro', icon: '📖', desc: 'Reading, Writing, MCQ, Projector, Flashcard, Q&A, PDF, Video, Audio' },
  { key: 'MCQ', label: 'MCQ Arena Pedro', icon: '⚔️', desc: 'Daily challenges, 1v1 battle & tests' },
  { key: 'REVISION_HUB', label: 'Revision Hub Pedro', icon: '⚡', desc: 'Fast revision, star notes & formulas' },
  { key: 'ROUTINE', label: 'Routine & Timetable Pedro', icon: '⏰', desc: 'Daily AI time-table & slot manager' },
  { key: 'PRO', label: 'Pro & Updates Pedro', icon: '🚀', desc: 'Pro pass, VIP features & demands' },
  { key: 'COMMUNITY', label: 'Community & Chat Pedro', icon: '💬', desc: 'Doubt solving & student discussions' },
  { key: 'STORE', label: 'Store & Passes Pedro', icon: '💎', desc: 'Coins, diamonds & study unlocks' },
  { key: 'PROFILE', label: 'Student Profile Pedro', icon: '👤', desc: 'Analytics, report card & honors' },
];

export const PedroAdminManager: React.FC<Props> = ({ settings, onSave, onBack }) => {
  // Master Pedro Config State
  const initialConfig: PedroSystemConfig = settings.pedroConfig || {
    enabled: true,
    robotName: 'Pedro',
    defaultPitch: 1.48,
    defaultRate: 1.05,
    pages: {}
  };

  const [pedroConfig, setPedroConfig] = useState<PedroSystemConfig>(initialConfig);
  const [selectedPageKey, setSelectedPageKey] = useState<string>('STUDY_MODE');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Audio Testing State
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testingTextId, setTestingTextId] = useState<string | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // New Category / Item Modals or Form States
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [activeCategoryForNewItem, setActiveCategoryForNewItem] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('💡');
  const [newItemSummary, setNewItemSummary] = useState('');
  const [newItemSpeech, setNewItemSpeech] = useState('');
  const [newItemBullets, setNewItemBullets] = useState('');
  const [newItemPerk, setNewItemPerk] = useState('');

  // Get active page config, merging saved customizations with defaults
  const getPageConfig = (pageKey: string): PedroPageConfig => {
    const defaultCfg = PEDRO_PAGE_KNOWLEDGE[pageKey] || PEDRO_PAGE_KNOWLEDGE.HOME;
    const savedCfg = pedroConfig.pages?.[pageKey];
    if (!savedCfg) return defaultCfg;

    return {
      ...defaultCfg,
      ...savedCfg,
      categories: savedCfg.categories && savedCfg.categories.length > 0
        ? savedCfg.categories
        : defaultCfg.categories
    };
  };

  const currentPage = getPageConfig(selectedPageKey);

  // Voice Test Function
  const testVoice = (text: string, pitch?: number, rate?: number, id?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Aapke browser me speech synthesis support nahi hai.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      if (isTestingAudio && testingTextId === id) {
        setIsTestingAudio(false);
        setTestingTextId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.pitch = pitch ?? pedroConfig.defaultPitch ?? 1.48;
      utterance.rate = rate ?? pedroConfig.defaultRate ?? 1.05;

      utterance.onstart = () => {
        setIsTestingAudio(true);
        setTestingTextId(id || 'generic');
      };
      utterance.onend = () => {
        setIsTestingAudio(false);
        setTestingTextId(null);
      };
      utterance.onerror = () => {
        setIsTestingAudio(false);
        setTestingTextId(null);
      };

      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech test failed:', e);
      setIsTestingAudio(false);
      setTestingTextId(null);
    }
  };

  const stopVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsTestingAudio(false);
    setTestingTextId(null);
  };

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, []);

  // Update Page Config Helper
  const updateCurrentPageConfig = (updater: (prev: PedroPageConfig) => PedroPageConfig) => {
    setPedroConfig(prev => {
      const current = getPageConfig(selectedPageKey);
      const updated = updater(current);
      return {
        ...prev,
        pages: {
          ...(prev.pages || {}),
          [selectedPageKey]: updated
        }
      };
    });
  };

  // Save All Changes to System Settings & Firebase
  const handleSaveAll = async () => {
    setIsSaving(true);
    stopVoice();
    try {
      const updatedSettings: SystemSettings = {
        ...settings,
        pedroConfig
      };
      await onSave(updatedSettings);
      setSaveSuccessMsg('✅ Pedro Voice & Features live publish ho gaye!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      alert('Save karne me error aaya: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Single Feature to Default
  const handleResetCurrentPage = () => {
    if (!window.confirm(`Kya aap "${currentPage.pageTitle}" ka sara data wapas default karna chahte hain?`)) {
      return;
    }
    setPedroConfig(prev => {
      const newPages = { ...(prev.pages || {}) };
      delete newPages[selectedPageKey];
      return {
        ...prev,
        pages: newPages
      };
    });
  };

  // Reset ALL Features to Default
  const handleResetAllDefaults = () => {
    if (!window.confirm('WARNING: Kya aap sabhi pages ke Pedro voice script aur options ko default karna chahte hain?')) {
      return;
    }
    setPedroConfig({
      enabled: true,
      robotName: 'Pedro',
      defaultPitch: 1.48,
      defaultRate: 1.05,
      pages: {}
    });
  };

  // Add Category Handler
  const handleAddCategory = () => {
    if (!newCatTitle.trim()) {
      alert('Category Title zaroori hai!');
      return;
    }
    const newCat: PedroCategory = {
      id: `CAT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newCatTitle.trim(),
      icon: newCatIcon.trim() || '📌',
      description: newCatDesc.trim() || 'Custom section created by Admin',
      items: []
    };

    updateCurrentPageConfig(prev => ({
      ...prev,
      categories: [...prev.categories, newCat]
    }));

    setNewCatTitle('');
    setNewCatIcon('📌');
    setNewCatDesc('');
    setShowAddCategoryModal(false);
    setExpandedCategoryId(newCat.id);
  };

  // Delete Category Handler
  const handleDeleteCategory = (catId: string) => {
    if (!window.confirm('Kya aap is category aur iske sabhi options ko delete karna chahte hain?')) return;
    updateCurrentPageConfig(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== catId)
    }));
  };

  // Add Item to Category Handler
  const handleAddItem = (catId: string) => {
    if (!newItemTitle.trim()) {
      alert('Item Title zaroori hai!');
      return;
    }
    const bulletsList = newItemBullets
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const newItem: PedroItemDetail = {
      id: `ITEM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newItemTitle.trim(),
      icon: newItemIcon.trim() || '💡',
      summary: newItemSummary.trim() || newItemTitle.trim(),
      speechText: newItemSpeech.trim() || `${newItemTitle.trim()} ke bare me detail jankari yahan uplabdh hai.`,
      bullets: bulletsList.length > 0 ? bulletsList : ['Fast & reliable feature.'],
      perks: newItemPerk.trim() ? [newItemPerk.trim()] : undefined
    };

    updateCurrentPageConfig(prev => ({
      ...prev,
      categories: prev.categories.map(c => {
        if (c.id !== catId) return c;
        return {
          ...c,
          items: [...c.items, newItem]
        };
      })
    }));

    setNewItemTitle('');
    setNewItemIcon('💡');
    setNewItemSummary('');
    setNewItemSpeech('');
    setNewItemBullets('');
    setNewItemPerk('');
    setActiveCategoryForNewItem(null);
  };

  // Delete Item Handler
  const handleDeleteItem = (catId: string, itemId: string) => {
    if (!window.confirm('Kya aap is option ko delete karna chahte hain?')) return;
    updateCurrentPageConfig(prev => ({
      ...prev,
      categories: prev.categories.map(c => {
        if (c.id !== catId) return c;
        return {
          ...c,
          items: c.items.filter(i => i.id !== itemId)
        };
      })
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6 space-y-6">
      {/* TOP HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Wapas Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 text-2xl">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">
                Pedro AI Robot Voice & Feature Master
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                Live Speech & Script Controller
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admin control karega ki Pedro kab, kahan aur kya bolega. Har feature ka alag Pedro customize karein!
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleResetAllDefaults}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
            title="Sabhi features ka script default par reset karein"
          >
            <RotateCcw size={14} />
            Reset Defaults
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
          >
            {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            {isSaving ? 'Saving...' : 'Save & Publish Live'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <Check size={18} className="text-emerald-600" />
          {saveSuccessMsg}
        </div>
      )}

      {/* MASTER SETTINGS PANEL */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-purple-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Global Master Settings (Robot Profile & Voice)
            </h3>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-left">
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                  Guide Power (App Tour & Explainer)
                </p>
                <p className="text-[9px] text-slate-500">
                  {pedroConfig.guidePowerEnabled !== false ? '✅ Active (Pedro samjhayega)' : '⏸️ Paused (Mascot rahega, Guide OFF)'}
                </p>
              </div>
              <button
                onClick={() => setPedroConfig(p => ({ ...p, guidePowerEnabled: p.guidePowerEnabled !== false ? false : true }))}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ml-2 ${
                  pedroConfig.guidePowerEnabled !== false ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-1 ${
                    pedroConfig.guidePowerEnabled !== false ? 'left-6' : 'left-1'
                  }`} 
                />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-left">
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                  Pedro Companion Robot
                </p>
                <p className="text-[9px] text-slate-500">
                  {pedroConfig.enabled !== false ? '✨ Visible Companion' : 'Mascot Quiet'}
                </p>
              </div>
              <button
                onClick={() => setPedroConfig(p => ({ ...p, enabled: p.enabled !== false ? false : true }))}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ml-2 ${
                  pedroConfig.enabled !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-1 ${
                    pedroConfig.enabled !== false ? 'left-6' : 'left-1'
                  }`} 
                />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Robot Name:
            </label>
            <input
              type="text"
              value={pedroConfig.robotName || 'Pedro'}
              onChange={e => setPedroConfig(p => ({ ...p, robotName: e.target.value }))}
              placeholder="e.g. Pedro / Gyaan Guru"
              className="w-full px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Voice Pitch ({pedroConfig.defaultPitch ?? 1.48}):
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">1.48 = Cute Robot</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.0"
              step="0.05"
              value={pedroConfig.defaultPitch ?? 1.48}
              onChange={e => setPedroConfig(p => ({ ...p, defaultPitch: parseFloat(e.target.value) }))}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Speech Speed ({pedroConfig.defaultRate ?? 1.05}x):
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">1.05x = Clear Hindi</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.6"
              step="0.05"
              value={pedroConfig.defaultRate ?? 1.05}
              onChange={e => setPedroConfig(p => ({ ...p, defaultRate: parseFloat(e.target.value) }))}
              className="w-full accent-purple-600 cursor-pointer"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => testVoice(
                `Namaste! Main hoon ${pedroConfig.robotName || 'Pedro'}, aapka friendly study robot!`,
                pedroConfig.defaultPitch,
                pedroConfig.defaultRate,
                'master_test'
              )}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                isTestingAudio && testingTextId === 'master_test'
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200'
              }`}
            >
              {isTestingAudio && testingTextId === 'master_test' ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {isTestingAudio && testingTextId === 'master_test' ? 'Awaaz Roko' : 'Awaaz Test Karein 🔊'}
            </button>
          </div>
        </div>
      </div>

      {/* HAR FEATURE KA ALAG PEDRO: FEATURE TABS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>🎯</span> Har Feature Ka Alag Pedro: Select Karein
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Har page aur feature ka alag Pedro hai jo us page ke topics aur tareeqon ko student ko explain karta hai.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {FEATURE_LIST.map(feat => {
            const isSelected = selectedPageKey === feat.key;
            const cfg = getPageConfig(feat.key);
            const totalCats = cfg.categories.length;
            const totalOptions = cfg.categories.reduce((acc, c) => acc + c.items.length, 0);
            const isCustomized = !!pedroConfig.pages?.[feat.key];

            return (
              <button
                key={feat.key}
                onClick={() => {
                  stopVoice();
                  setSelectedPageKey(feat.key);
                }}
                className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer relative ${
                  isSelected
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800'
                }`}
              >
                {isCustomized && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" title="Admin Customized" />
                )}
                <div className="text-2xl mb-1">{cfg.pageIcon || feat.icon}</div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100 line-clamp-1">
                  {cfg.pageTitle || feat.label}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-2">
                  <span>{totalCats} Cats</span>
                  <span>•</span>
                  <span>{totalOptions} Options</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED FEATURE'S DETAILED EDITOR */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Feature Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30">
              {currentPage.pageIcon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  {currentPage.pageTitle} Pedro Controller
                </h3>
                {selectedPageKey === 'STUDY_MODE' && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    9 Study Modes & Live HUD
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jab student is feature me hoga, Pedro yeh bolkar swagat karega aur neeche ke options dikhayega.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetCurrentPage}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer flex items-center gap-1.5"
              title="Is feature ka data default karein"
            >
              <RotateCcw size={13} />
              Reset This Feature
            </button>
          </div>
        </div>

        {/* 1. INTRO SPEECH: KAB & KYA BOLEGA */}
        <div className="bg-purple-50/50 dark:bg-purple-950/20 p-4.5 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <span>🗣️</span> Intro Speech (Page Open Hote Hi Pedro Kya Bolega):
            </label>
            <span className="text-[11px] text-slate-400">
              {currentPage.introSpeech.length} characters
            </span>
          </div>

          <textarea
            rows={3}
            value={currentPage.introSpeech}
            onChange={e => {
              const val = e.target.value;
              updateCurrentPageConfig(prev => ({
                ...prev,
                introSpeech: val
              }));
            }}
            placeholder="Student ke aate hi Pedro Hindi me kya bolega, yahan type karein..."
            className="w-full p-3 text-sm rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-purple-700 dark:text-purple-400">
              💡 Tip: Simple, friendly Hindi/Hinglish me likhein taaki students asani se samajh sakein.
            </p>
            <button
              onClick={() => testVoice(currentPage.introSpeech, undefined, undefined, `intro_${selectedPageKey}`)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                isTestingAudio && testingTextId === `intro_${selectedPageKey}`
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
              }`}
            >
              {isTestingAudio && testingTextId === `intro_${selectedPageKey}` ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isTestingAudio && testingTextId === `intro_${selectedPageKey}` ? 'Awaaz Roko' : 'Yeh Bolkar Sunao 🔊'}
            </button>
          </div>
        </div>

        {/* 2. CATEGORIES & OPTIONS: KYA KYA OPTIONS DIKHEGA */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>📚</span> Pedro ke Categories & Study Options ({currentPage.categories.length})
              </h4>
              <p className="text-xs text-slate-500">
                Student in options par click karke Pedro se explanation sun sakta hai.
              </p>
            </div>

            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Nayi Category Banayein
            </button>
          </div>

          {/* Categories Accordion */}
          <div className="space-y-3">
            {currentPage.categories.map((category, catIdx) => {
              const isExpanded = expandedCategoryId === category.id || expandedCategoryId === null;

              return (
                <div 
                  key={category.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 overflow-hidden"
                >
                  {/* Category Header */}
                  <div className="p-3.5 flex items-center justify-between bg-slate-100/60 dark:bg-slate-800/60">
                    <button
                      onClick={() => setExpandedCategoryId(isExpanded ? '__none__' : category.id)}
                      className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                    >
                      <span className="text-xl">{category.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {catIdx + 1}. {category.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {category.items.length} options
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {category.description}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveCategoryForNewItem(category.id);
                          setExpandedCategoryId(category.id);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-200 transition cursor-pointer flex items-center gap-1"
                        title="Is category me naya option jodein"
                      >
                        <Plus size={13} />
                        Add Option
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Category delete karein"
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        onClick={() => setExpandedCategoryId(isExpanded ? '__none__' : category.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Category Items List (When Expanded) */}
                  {isExpanded && (
                    <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                      {/* Items */}
                      {category.items.map((item, itemIdx) => (
                        <div 
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 hover:border-purple-300 dark:hover:border-purple-900 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{item.icon}</span>
                              <input
                                type="text"
                                value={item.title}
                                onChange={e => {
                                  const val = e.target.value;
                                  updateCurrentPageConfig(prev => ({
                                    ...prev,
                                    categories: prev.categories.map(c => {
                                      if (c.id !== category.id) return c;
                                      return {
                                        ...c,
                                        items: c.items.map(i => i.id === item.id ? { ...i, title: val } : i)
                                      };
                                    })
                                  }));
                                }}
                                className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 focus:border-purple-500 focus:outline-none px-1"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => testVoice(item.speechText, undefined, undefined, `item_${item.id}`)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                                  isTestingAudio && testingTextId === `item_${item.id}`
                                    ? 'bg-amber-500 text-white animate-pulse'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200'
                                }`}
                              >
                                {isTestingAudio && testingTextId === `item_${item.id}` ? <VolumeX size={13} /> : <Volume2 size={13} />}
                                Suno
                              </button>

                              <button
                                onClick={() => handleDeleteItem(category.id, item.id)}
                                className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                title="Option delete karein"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Speech Script Box */}
                          <div>
                            <label className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1 mb-1">
                              <span>🔊</span> Option Tap Karne Par Pedro Kya Bolega:
                            </label>
                            <textarea
                              rows={2}
                              value={item.speechText}
                              onChange={e => {
                                const val = e.target.value;
                                updateCurrentPageConfig(prev => ({
                                  ...prev,
                                  categories: prev.categories.map(c => {
                                    if (c.id !== category.id) return c;
                                    return {
                                      ...c,
                                      items: c.items.map(i => i.id === item.id ? { ...i, speechText: val } : i)
                                    };
                                  })
                                }));
                              }}
                              placeholder="Pedro ka Hindi speech text yahan likhein..."
                              className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                            />
                          </div>

                          {/* Bullets & Perk */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                Screen Par Points (Har line ek bullet point):
                              </label>
                              <textarea
                                rows={2}
                                value={item.bullets.join('\n')}
                                onChange={e => {
                                  const lines = e.target.value.split('\n');
                                  updateCurrentPageConfig(prev => ({
                                    ...prev,
                                    categories: prev.categories.map(c => {
                                      if (c.id !== category.id) return c;
                                      return {
                                        ...c,
                                        items: c.items.map(i => i.id === item.id ? { ...i, bullets: lines } : i)
                                      };
                                    })
                                  }));
                                }}
                                className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                Special Perk / Highlight Badge:
                              </label>
                              <input
                                type="text"
                                value={item.perks?.[0] || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  updateCurrentPageConfig(prev => ({
                                    ...prev,
                                    categories: prev.categories.map(c => {
                                      if (c.id !== category.id) return c;
                                      return {
                                        ...c,
                                        items: c.items.map(i => i.id === item.id ? { ...i, perks: val ? [val] : [] } : i)
                                      };
                                    })
                                  }));
                                }}
                                placeholder="e.g. 🎯 Topper hack ya ⚡ Instant result"
                                className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add Option Inside Category Form */}
                      {activeCategoryForNewItem === category.id && (
                        <div className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                              <Plus size={14} />
                              Naya Study Option Jodein in "{category.title}"
                            </h5>
                            <button
                              onClick={() => setActiveCategoryForNewItem(null)}
                              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                                Option Title:
                              </label>
                              <input
                                type="text"
                                value={newItemTitle}
                                onChange={e => setNewItemTitle(e.target.value)}
                                placeholder="e.g. 10. Formula Quick Recall"
                                className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                                Icon (Emoji):
                              </label>
                              <input
                                type="text"
                                value={newItemIcon}
                                onChange={e => setNewItemIcon(e.target.value)}
                                placeholder="⚡"
                                className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                              Voice Speech Text (Pedro Bol Kar Kya Samjhaye):
                            </label>
                            <textarea
                              rows={2}
                              value={newItemSpeech}
                              onChange={e => setNewItemSpeech(e.target.value)}
                              placeholder="Pedro kya bolega wo text yahan likhein..."
                              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setActiveCategoryForNewItem(null)}
                              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 font-bold hover:bg-slate-200"
                            >
                              Radd Karein
                            </button>
                            <button
                              onClick={() => handleAddItem(category.id)}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                            >
                              Option Save Karein
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL: ADD NEW CATEGORY */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span>➕</span> Nayi Category Banayein
            </h3>
            <p className="text-xs text-slate-500">
              Yeh category "{currentPage.pageTitle}" screen ke Pedro me dikhegi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Category Name:
                </label>
                <input
                  type="text"
                  value={newCatTitle}
                  onChange={e => setNewCatTitle(e.target.value)}
                  placeholder="e.g. Special Revision Tools"
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Icon:
                  </label>
                  <input
                    type="text"
                    value={newCatIcon}
                    onChange={e => setNewCatIcon(e.target.value)}
                    placeholder="🔥"
                    className="w-full p-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Short Description:
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                    placeholder="Description line"
                    className="w-full p-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-md"
              >
                Category Banayein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
