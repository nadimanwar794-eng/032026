// @ts-nocheck
import React, { useState } from 'react';
import { saveSuggestion, auth } from '../firebase';

interface Props {
  user: any;
  lessonTitle?: string;
  pageNo?: string;
  subject?: string;
  classLevel?: string;
}

export const WriteModeCorrection: React.FC<Props> = ({ user, lessonTitle, pageNo, subject, classLevel }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const reset = () => { setDone(false); setError(false); setText(''); setOpen(false); };

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const firebaseUser = auth.currentUser;
      await saveSuggestion({
        id: `write_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: text.trim(),
        uid: firebaseUser?.uid || user?.uid || user?.id || 'anonymous',
        userName: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || user?.name || user?.email?.split('@')[0] || 'Student',
        userBoard: user?.board || '',
        createdAt: new Date().toISOString(),
        mode: 'writing',
        lessonTitle,
        pageNo,
        subject,
        classLevel,
      });
      setDone(true);
    } catch (e) {
      console.error('WriteModeCorrection submit error:', e);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div
        style={{ margin: '12px 16px 4px', padding: '10px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <p style={{ fontSize: 11, fontWeight: 900, color: '#991b1b', margin: 0 }}>❌ Submit nahi hua — internet check karo ya dobara try karo.</p>
        <button
          onClick={() => setError(false)}
          style={{ fontSize: 10, fontWeight: 900, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', whiteSpace: 'nowrap' }}
        >
          ↩ Try Again
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div
        style={{ margin: '12px 16px 4px', padding: '10px 14px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <p style={{ fontSize: 11, fontWeight: 900, color: '#065f46', margin: 0 }}>✅ Correction report bhej diya! Admin review karega.</p>
        <button
          onClick={reset}
          style={{ fontSize: 10, fontWeight: 900, color: '#059669', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          + Aur
        </button>
      </div>
    );
  }

  return (
    <div style={{ margin: '12px 16px 4px' }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}
        >
          💡 Is page mein correction report karo
        </button>
      ) : (
        <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: 14, padding: '12px', gap: 8, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>✍️ Writing Mode — Correction</p>
            <button onClick={() => setOpen(false)} style={{ background: '#fde68a', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 10, fontWeight: 900, color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          {(lessonTitle || pageNo) && (
            <p style={{ fontSize: 9, color: '#b45309', margin: 0 }}>
              📚 {lessonTitle}{pageNo ? ` — Page ${pageNo}` : ''}
            </p>
          )}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Is page mein kya galti hai? Detail mein likho..."
            style={{ width: '100%', minHeight: 72, padding: '8px 10px', borderRadius: 10, border: '1px solid #fcd34d', fontSize: 11, outline: 'none', resize: 'none', background: '#fff', color: '#451a03', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setOpen(false)}
              style={{ flex: 1, padding: '7px', borderRadius: 10, border: '1px solid #fcd34d', background: 'transparent', color: '#b45309', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              disabled={!text.trim() || submitting}
              onClick={submit}
              style={{ flex: 2, padding: '7px', borderRadius: 10, border: 'none', background: text.trim() ? '#d97706' : '#fde68a', color: text.trim() ? '#fff' : '#b45309', fontSize: 11, fontWeight: 900, cursor: text.trim() ? 'pointer' : 'default', opacity: submitting ? 0.7 : 1, transition: 'all 0.15s' }}
            >
              {submitting ? 'Bhej raha hai…' : '📤 Report Bhejo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
