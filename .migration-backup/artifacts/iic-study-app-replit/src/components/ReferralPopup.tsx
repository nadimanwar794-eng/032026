import React, { useState } from 'react';
import { X, Gift, Check, ArrowRight } from 'lucide-react';
import { User } from '../types';
import { rtdb, saveUserToLive } from '../firebase';
import { ref, get, update } from 'firebase/database';

interface Props {
    user: User;
    onClose: () => void;
    onUpdateUser: (u: User) => void;
}

export const ReferralPopup: React.FC<Props> = ({ user, onClose, onUpdateUser }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleApply = async () => {
        if (!code) return;
        if (code === user.displayId || code === user.id) {
            setError("You cannot use your own code.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const stored = localStorage.getItem('nst_users');
            const allUsers: User[] = stored ? JSON.parse(stored) : [];
            const referrer = allUsers.find(u => u.displayId === code || u.id === code || u.mobile === code);

            if (!referrer) throw new Error("Invalid Referral Code.");

            const updatedUser = { ...user, credits: user.credits + 50, redeemedReferralCode: code };

            let referrerUpdates: any = { credits: referrer.credits };
            const referralCount = (referrer.referralCount || 0) + 1;
            referrerUpdates.referralCount = referralCount;

            let rewardMsg = "";
            if (referralCount === 1)       { referrerUpdates.credits += 100;  rewardMsg = "100 Coins"; }
            else if (referralCount === 2)  { referrerUpdates.credits += 300;  rewardMsg = "300 Coins"; }
            else if (referralCount === 5)  { referrerUpdates.credits += 500;  rewardMsg = "500 Coins (Week Equivalent)"; }
            else if (referralCount === 10) { referrerUpdates.credits += 1000; rewardMsg = "1000 Coins"; }
            else if (referralCount === 20) { referrerUpdates.credits += 2000; rewardMsg = "2000 Coins"; }
            else { referrerUpdates.credits += 50; }

            const newUsersList = allUsers.map(u => {
                if (u.id === user.id) return updatedUser;
                if (u.id === referrer.id) return { ...u, ...referrerUpdates };
                return u;
            });
            localStorage.setItem('nst_users', JSON.stringify(newUsersList));

            saveUserToLive(updatedUser);
            saveUserToLive({ ...referrer, ...referrerUpdates });

            onUpdateUser(updatedUser);
            setSuccess(true);

        } catch (e: any) {
            setError(e.message || "Failed to apply code.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 w-full text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-50 z-0" />
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounce">
                            <Check size={40} strokeWidth={4} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">Success!</h2>
                        <p className="text-slate-600 font-bold mb-6">You received <span className="text-green-600 text-xl">50 Coins</span></p>
                        <button onClick={onClose} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700">
                            Start Learning
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full shadow-2xl border border-slate-200 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-600">
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    {/* Icon — theme gradient */}
                    <div
                        className="w-16 h-16 text-white rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-4 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))' }}
                    >
                        <Gift size={32} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">Have a Referral Code?</h2>
                    <p className="text-xs text-slate-600 mt-1">Enter code from a friend to unlock rewards.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="Enter Code (e.g. IIC-RAJ-1234)"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center font-bold tracking-widest outline-none uppercase"
                            style={{ ['--tw-ring-color' as any]: 'var(--nst-color-brand-20)' }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'var(--nst-color-brand)')}
                            onBlur={e => (e.currentTarget.style.borderColor = '')}
                        />
                        {error && <p className="text-red-500 text-xs font-bold mt-2 text-center">{error}</p>}
                    </div>

                    <button
                        onClick={handleApply}
                        disabled={loading || !code}
                        className="w-full py-3 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all"
                        style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))' }}
                    >
                        {loading ? 'Verifying...' : <><span>Claim Reward</span> <ArrowRight size={16} /></>}
                    </button>

                    <button onClick={onClose} className="w-full py-2 text-slate-500 font-bold text-xs hover:text-slate-600">
                        No, I don't have one
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Your Referral Code</p>
                    <div
                        className="bg-slate-50 py-2 px-4 rounded-lg font-mono font-bold text-slate-700 text-sm select-all cursor-pointer"
                        onClick={() => navigator.clipboard.writeText(user.displayId || user.id)}
                    >
                        {user.displayId || user.id}
                    </div>
                </div>
            </div>
        </div>
    );
};
