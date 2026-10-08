import React, { useState } from 'react';
import {
  X,
  Lock,
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import {
  getDefaultChatPin,
  setDefaultChatPin,
  getSpecialChatCategoryPin,
  setSpecialChatCategoryPin,
} from '../services/whatsappChatService';

interface NstaChatLockPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onPasswordChanged?: () => void;
}

export const NstaChatLockPasswordModal: React.FC<NstaChatLockPasswordModalProps> = ({
  isOpen,
  onClose,
  userId,
  onPasswordChanged,
}) => {
  const currentDefault = getDefaultChatPin(userId);
  const currentSpecial = getSpecialChatCategoryPin(userId);

  const [activeTab, setActiveTab] = useState<'DEFAULT' | 'SPECIAL'>('DEFAULT');

  // Form states for Default Password
  const [oldDefaultPin, setOldDefaultPin] = useState('');
  const [newDefaultPin, setNewDefaultPin] = useState('');
  const [confirmDefaultPin, setConfirmDefaultPin] = useState('');
  const [showOldDefault, setShowOldDefault] = useState(false);
  const [showNewDefault, setShowNewDefault] = useState(false);

  // Form states for Special Password
  const [oldSpecialPin, setOldSpecialPin] = useState('');
  const [newSpecialPin, setNewSpecialPin] = useState('');
  const [confirmSpecialPin, setConfirmSpecialPin] = useState('');
  const [showOldSpecial, setShowOldSpecial] = useState(false);
  const [showNewSpecial, setShowNewSpecial] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSaveDefault = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // If there is an existing PIN, verify old PIN
    if (currentDefault && oldDefaultPin.trim() !== currentDefault) {
      setErrorMsg('Purana Default Password galat hai!');
      return;
    }

    if (!newDefaultPin.trim()) {
      setErrorMsg('Kripya naya default password darj karein');
      return;
    }

    if (newDefaultPin.trim().length < 4) {
      setErrorMsg('Password kam se kam 4 characters ka hona chahiye');
      return;
    }

    if (newDefaultPin.trim() !== confirmDefaultPin.trim()) {
      setErrorMsg('Naya password aur confirm password match nahi ho rahe');
      return;
    }

    setDefaultChatPin(newDefaultPin.trim(), userId);
    setSuccessMsg('Default Chat Password safaltapoorvak update ho gaya!');
    setOldDefaultPin('');
    setNewDefaultPin('');
    setConfirmDefaultPin('');
    if (onPasswordChanged) onPasswordChanged();
  };

  const handleSaveSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // If there is an existing PIN, verify old PIN
    if (currentSpecial && oldSpecialPin.trim() !== currentSpecial) {
      setErrorMsg('Purana Special Password galat hai!');
      return;
    }

    if (!newSpecialPin.trim()) {
      setErrorMsg('Kripya naya special password darj karein');
      return;
    }

    if (newSpecialPin.trim().length < 4) {
      setErrorMsg('Special Password kam se kam 4 characters ka hona chahiye');
      return;
    }

    if (newSpecialPin.trim() !== confirmSpecialPin.trim()) {
      setErrorMsg('Naya special password aur confirm password match nahi ho rahe');
      return;
    }

    setSpecialChatCategoryPin(newSpecialPin.trim(), userId);
    setSuccessMsg('Special (Star Marked) Chat Password safaltapoorvak update ho gaya!');
    setOldSpecialPin('');
    setNewSpecialPin('');
    setConfirmSpecialPin('');
    if (onPasswordChanged) onPasswordChanged();
  };

  return (
    <div
      id="nsta-chat-lock-modal-overlay"
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        id="nsta-chat-lock-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-wide">Nsta Chat Lock Passwords</h3>
              <p className="text-[11px] text-purple-200">
                2 alag passwords: Normal Chats aur Star Mark Chats
              </p>
            </div>
          </div>
          <button
            id="close-chat-lock-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors relative z-10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex p-2 gap-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveTab('DEFAULT');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'DEFAULT'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200 dark:border-purple-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock size={13} />
            <span>Default Password</span>
            {currentDefault ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
            ) : (
              <span className="text-[9px] px-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded">
                Not Set
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('SPECIAL');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'SPECIAL'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Star size={13} className="fill-amber-400 text-amber-500" />
            <span>⭐ Special Password</span>
            {currentSpecial ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
            ) : (
              <span className="text-[9px] px-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded">
                Not Set
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Notification Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: DEFAULT PASSWORD */}
          {activeTab === 'DEFAULT' && (
            <form onSubmit={handleSaveDefault} className="space-y-4">
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-xs mb-1">
                  <ShieldCheck size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Normal (Default) Chats Ka Password</span>
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                  Yeh password un sabhi chats par lagega jo <strong>Star Mark nahi hain</strong>. Jab
                  aap chat lock karte hain, to user ko normal chat kholne ke liye yahi password
                  daalna hoga.
                </p>
                <div className="mt-2 pt-2 border-t border-purple-200/60 dark:border-purple-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Current Status:</span>
                  <span
                    className={`font-bold ${
                      currentDefault
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {currentDefault ? '🔒 Password Set Hai' : '⚠️ Password Set Nahi Hai'}
                  </span>
                </div>
              </div>

              {currentDefault && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Purana Default Password
                  </label>
                  <div className="relative">
                    <input
                      type={showOldDefault ? 'text' : 'password'}
                      value={oldDefaultPin}
                      onChange={(e) => setOldDefaultPin(e.target.value)}
                      placeholder="Purana password darj karein..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldDefault(!showOldDefault)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showOldDefault ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentDefault ? 'Naya Default Password' : 'Naya Default Password Banayein'}
                </label>
                <div className="relative">
                  <input
                    type={showNewDefault ? 'text' : 'password'}
                    value={newDefaultPin}
                    onChange={(e) => setNewDefaultPin(e.target.value)}
                    placeholder="Naya 4+ character password..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewDefault(!showNewDefault)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewDefault ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password Confirm Karein
                </label>
                <input
                  type={showNewDefault ? 'text' : 'password'}
                  value={confirmDefaultPin}
                  onChange={(e) => setConfirmDefaultPin(e.target.value)}
                  placeholder="Naya password dobara likhein..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock size={14} />
                <span>Default Password Save Karein</span>
              </button>
            </form>
          )}

          {/* TAB 2: SPECIAL STARRED CHAT PASSWORD */}
          {activeTab === 'SPECIAL' && (
            <form onSubmit={handleSaveSpecial} className="space-y-4">
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-300 dark:border-amber-800/60 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs mb-1">
                  <Star size={14} className="fill-amber-500 text-amber-600" />
                  <span>⭐ Special (Star Marked) Chats Ka Password</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Yeh ek <strong>VIP / Private Password</strong> hai jo sirf un chats par lagega
                  jinko aapne <strong>Star Mark (⭐)</strong> kiya hai. Normal password se yeh chats
                  open nahi hongi!
                </p>
                <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Current Status:</span>
                  <span
                    className={`font-bold ${
                      currentSpecial
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {currentSpecial ? '⭐ Special Password Active' : '⚠️ Set Nahi Hua Hai'}
                  </span>
                </div>
              </div>

              {currentSpecial && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Purana Special Password
                  </label>
                  <div className="relative">
                    <input
                      type={showOldSpecial ? 'text' : 'password'}
                      value={oldSpecialPin}
                      onChange={(e) => setOldSpecialPin(e.target.value)}
                      placeholder="Purana special password..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldSpecial(!showOldSpecial)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showOldSpecial ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentSpecial ? 'Naya Special Password' : 'Naya Special Password Banayein'}
                </label>
                <div className="relative">
                  <input
                    type={showNewSpecial ? 'text' : 'password'}
                    value={newSpecialPin}
                    onChange={(e) => setNewSpecialPin(e.target.value)}
                    placeholder="Naya 4+ character special password..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewSpecial(!showNewSpecial)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewSpecial ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Special Password Confirm Karein
                </label>
                <input
                  type={showNewSpecial ? 'text' : 'password'}
                  value={confirmSpecialPin}
                  onChange={(e) => setConfirmSpecialPin(e.target.value)}
                  placeholder="Naya special password dobara likhein..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-95 text-slate-950 rounded-xl text-xs font-black shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>⭐ Special Password Save Karein</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
