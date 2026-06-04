import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, Home, WifiOff } from 'lucide-react';
import { storage } from '../utils/storage';
import { logErrorToFirebase } from '../utils/errorLogger';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
  resetKey?: string | number;
  onError?: (error: Error, info: ErrorInfo) => void;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, error: null, retryCount: 0 });
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    const msg = error?.message || error?.toString() || '';

    logErrorToFirebase(error, {
      type: 'react',
      componentStack: errorInfo?.componentStack ?? undefined,
    }).catch(() => {});

    if (msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED')) {
      console.warn('[IIC] Firestore assertion — clearing cache & reloading…');
      try {
        const doReload = () => {
          try { localStorage.removeItem('nst_firebase_project_id'); } catch {}
          window.location.reload();
        };
        (indexedDB as any).databases?.().then((dbs: { name?: string }[]) => {
          const dels = dbs
            .filter(d => d.name && (d.name.includes('firestore') || d.name.includes('firebase')))
            .map(d => new Promise<void>(res => {
              const r = indexedDB.deleteDatabase(d.name!);
              r.onsuccess = () => res();
              r.onerror = () => res();
            }));
          Promise.all(dels).then(doReload).catch(doReload);
        }).catch(doReload);
      } catch { window.location.reload(); }
      return;
    }

    if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk') || msg.includes('Failed to fetch dynamically')) {
      console.warn('[IIC] ChunkLoadError — reloading silently…');
      window.location.reload();
      return;
    }

    console.error('[IIC] ErrorBoundary caught:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState(s => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }));
  };

  private handleGoHome = () => {
    storage.setItem('nst_active_student_tab', 'HOME');
    localStorage.removeItem('nst_active_view');
    this.setState({ hasError: false, error: null, retryCount: 0 });
    try { window.history.pushState({}, '', '/'); } catch {}
    window.location.reload();
  };

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    const isOffline = !navigator.onLine;
    const label = this.props.fallbackLabel ?? 'page';

    if (this.props.compact) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 my-2"
        >
          <div className="flex items-center gap-2 text-sm text-red-700 font-semibold">
            {isOffline
              ? <><WifiOff size={16} className="shrink-0" /> Offline — {label} load nahi hua</>
              : <><span aria-hidden>⚠️</span> {label} mein error aaya</>
            }
          </div>
          {this.state.retryCount < 2 && (
            <button
              onClick={this.handleRetry}
              aria-label={`${label} dobara try karo`}
              className="shrink-0 flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <RefreshCcw size={13} /> Retry
            </button>
          )}
        </div>
      );
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen flex flex-col items-center justify-center p-5 text-center font-sans"
        style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)' }}>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6">

          {isOffline ? (
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <WifiOff size={26} className="text-amber-500" aria-hidden />
            </div>
          ) : (
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl" aria-hidden>⚠️</span>
            </div>
          )}

          <h1 className="text-lg font-black text-slate-800 mb-1">
            {isOffline ? 'Internet nahi mila' : 'Kuch gadbad ho gayi'}
          </h1>
          <p className="text-slate-500 text-xs mb-4">
            {isOffline
              ? 'Network connection check karo aur wapas try karo.'
              : `${label} mein ek error aaya. Admin ko notify kar diya gaya hai.`}
          </p>

          {this.state.error && !isOffline && (
            <details className="mb-4 text-left">
              <summary className="text-[10px] text-slate-400 cursor-pointer mb-1">Error details</summary>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl overflow-auto max-h-28">
                <p className="text-[9px] font-mono text-red-600 break-words leading-relaxed">
                  {this.state.error.message?.slice(0, 300)}
                </p>
              </div>
            </details>
          )}

          <div className="space-y-2.5">
            {this.state.retryCount < 2 && (
              <button onClick={this.handleRetry}
                aria-label="Dobara try karo"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-100">
                <RefreshCcw size={15} aria-hidden /> Dobara Try Karo
              </button>
            )}
            <button onClick={this.handleGoHome}
              aria-label="Home pe jao"
              className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
              <Home size={15} aria-hidden /> Home Pe Jao
            </button>
            <button onClick={this.handleReset}
              aria-label="App reset karo"
              className="w-full text-slate-400 text-[10px] py-1 hover:text-red-400 transition-colors">
              App Reset Karo (last resort)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
