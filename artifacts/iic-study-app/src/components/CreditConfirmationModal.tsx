import React, { useState } from 'react';
import { CreditCard, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';

interface Props {
    title: string;
    cost: number;
    userCredits: number;
    onConfirm: (autoEnabled: boolean) => void;
    onCancel: () => void;
    isAutoEnabledInitial: boolean;
}

export const CreditConfirmationModal: React.FC<Props> = ({ title, cost, userCredits, onConfirm, onCancel, isAutoEnabledInitial }) => {
    const [autoEnabled, setAutoEnabled] = useState(isAutoEnabledInitial);
    const canPay = userCredits >= cost;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div
                    className="p-6 text-center"
                    style={{ background: 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5) 0%, var(--nst-btn-end, #7c3aed) 100%)' }}
                >
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"
                        style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.35)' }}
                    >
                        <CreditCard size={32} className="text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white">{title}</h3>
                    <p className="text-white/70 text-sm mt-1">Payment Confirmation</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Cost row */}
                    <div
                        className="flex justify-between items-center p-4 rounded-xl border"
                        style={{ background: 'var(--nst-color-brand-5)', borderColor: 'var(--nst-color-brand-20)' }}
                    >
                        <span className="text-sm font-bold text-slate-600">Cost</span>
                        <span className="text-xl font-black" style={{ color: 'var(--nst-color-brand)' }}>-{cost} CR</span>
                    </div>

                    {/* Balance */}
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600 px-2">
                        <span>Current Balance:</span>
                        <span className={canPay ? "text-green-600" : "text-red-500"}>{userCredits} CR</span>
                    </div>

                    {!canPay && (
                        <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                            <AlertTriangle size={16} /> Insufficient Credits!
                        </div>
                    )}

                    {/* Auto Pay Toggle */}
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-md ${autoEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                <Zap size={16} fill={autoEnabled ? "currentColor" : "none"} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700">Skip for Today</p>
                                <p className="text-[9px] text-slate-500">This popup will appear again tomorrow</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={autoEnabled}
                                onChange={(e) => setAutoEnabled(e.target.checked)}
                            />
                            <div
                                className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"
                                style={{ ['--tw-ring-color' as any]: 'var(--nst-color-brand-20)' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 text-slate-600 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle size={18} /> Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(autoEnabled)}
                        disabled={!canPay}
                        className="flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        style={{ background: canPay ? 'linear-gradient(135deg, var(--nst-btn-start, #4f46e5), var(--nst-btn-end, #7c3aed))' : '#94a3b8' }}
                    >
                        <CheckCircle size={18} /> {canPay ? 'Pay Now' : 'Low Balance'}
                    </button>
                </div>
            </div>
        </div>
    );
};
