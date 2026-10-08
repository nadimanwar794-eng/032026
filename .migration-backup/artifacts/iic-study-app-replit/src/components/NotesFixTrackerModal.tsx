import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, Clock, 
  RefreshCw, BookOpen
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

interface NotesFixTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userLevel?: number;
  userXp?: number;
}

interface NoteSuggestion {
  id: string;
  text?: string;
  uid?: string;
  userName?: string;
  lessonTitle?: string;
  chapterKey?: string;
  pageNo?: string;
  reportCount?: number;
  status?: 'open' | 'accepted' | 'rejected' | 'fixed' | 'resolved';
  adminReply?: string;
  adminReplyAt?: string;
  createdAt?: string;
}

export const NotesFixTrackerModal: React.FC<NotesFixTrackerModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [filterTab, setFilterTab] = useState<'MY_REPORTS' | 'ALL_FIXED'>('MY_REPORTS');
  const [loading, setLoading] = useState<boolean>(true);
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const suggestionsRef = ref(rtdb, 'suggestions');
    const unsub = onValue(suggestionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: NoteSuggestion[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setSuggestions(list);
      } else {
        setSuggestions([]);
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUid = user?.uid || user?.id || '';
  const currentName = (user?.name || user?.displayName || '').toLowerCase().trim();

  const myReports = suggestions.filter(s => 
    (s.uid && s.uid === currentUid) || 
    (s.userName && s.userName.toLowerCase().trim() === currentName)
  );

  const fixedNotes = suggestions.filter(s => s.status === 'fixed' || s.status === 'resolved' || s.status === 'accepted');

  const displayedList = filterTab === 'MY_REPORTS' ? myReports : fixedNotes;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'fixed':
      case 'resolved':
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Fix Ho Gya (Resolved)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <X className="w-3.5 h-3.5 text-rose-400" />
            Check Done
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Under Review (Jald Fix Hoga)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg text-white font-black text-lg">
              🔍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Notes Fix Tracker</h2>
              </div>
              <p className="text-xs text-slate-400 font-medium">Aapki report ki gayi galtiyan & real-time fix status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Filter Tabs */}
          <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-slate-800 bg-slate-900/50">
            <button
              onClick={() => setFilterTab('MY_REPORTS')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'MY_REPORTS'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Meri Bheji Gayi Reports ({myReports.length})
            </button>
            <button
              onClick={() => setFilterTab('ALL_FIXED')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                filterTab === 'ALL_FIXED'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Theek Ki Gayi Galtiyan ({fixedNotes.length})
            </button>
          </div>

          {/* List */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-xs font-bold">Reports load ho rahi hain...</span>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
                <p className="text-sm font-bold">Koi report nahi mili</p>
                <p className="text-xs text-slate-500">
                  {filterTab === 'MY_REPORTS' 
                    ? 'Aapne abhi tak koi error report nahi bheji hai.' 
                    : 'Abhi koi fixed error list nahi hai.'}
                </p>
              </div>
            ) : (
              displayedList.map(item => (
                <div 
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span>{item.lessonTitle || 'Study Note'}</span>
                        {item.pageNo && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-normal">
                            Page {item.pageNo}
                          </span>
                        )}
                      </h4>
                      {item.createdAt && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(item.createdAt).toLocaleDateString('hi-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  {item.text && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200">
                      <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                        Reported Problem:
                      </p>
                      <p className="leading-relaxed">{item.text}</p>
                    </div>
                  )}

                  {item.adminReply && (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200">
                      <p className="font-bold text-emerald-400 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Admin Feedback & Resolution:
                      </p>
                      <p className="leading-relaxed">{item.adminReply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
