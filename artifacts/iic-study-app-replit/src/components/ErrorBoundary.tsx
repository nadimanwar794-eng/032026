import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, Home, WifiOff } from 'lucide-react';
import { storage } from '../utils/storage';
import { logErrorToFirebase } from '../utils/errorLogger';
import { reportCrash } from '../utils/maintenanceManager';
import { MaintenanceScreen } from './MaintenanceScreen';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
  resetKey?: string | number;
  onError?: (error: Error, info: ErrorInfo) => void;
  compact?: boolean;
  /** When set, crash is auto-reported to Firebase RTDB and a maintenance screen is shown. */
  crashTarget?: 'studentDashboard' | 'adminDashboard';
  /** Override maintenance title shown when crashTarget is set */
  maintenanceTitle?: string;
  /** Override maintenance message shown when crashTarget is set */
  maintenanceMessage?: string;
  /** Override retry minutes shown when crashTarget is set */
  maintenanceRetryMinutes?: number;
  /** Custom fallback renderer — overrides compact/crashTarget fallback. Receives (error, onRetry). */
  fallback?: (error: Error | null, onRetry: () => void) => ReactNode;
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

    const isChunkError =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically') ||
      msg.includes('dynamically imported module') ||
      msg.includes('Importing a module script failed');

    // Smart Crash Protection: auto-report crash to Firebase so admin can see it (do not report transient chunk load errors)
    if (this.props.crashTarget && !isChunkError) {
      reportCrash(this.props.crashTarget, msg).catch(() => {});
    }

    if (isChunkError) {
      console.warn('[IIC] ChunkLoadError / Dynamic import failed — auto-retrying in 600ms…');
      if (this.state.retryCount < 5) {
        setTimeout(() => {
          this.setState(s => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }));
        }, 600);
        return;
      }
      try { window.location.reload(); } catch {}
      return;
    }

    console.error('[IIC] ErrorBoundary caught:', error, errorInfo);
  }

  private handleRetry = () => {
    const errText = this.state.error?.message || this.state.error?.toString() || '';
    const isChunkError =
      errText.includes('ChunkLoadError') ||
      errText.includes('Loading chunk') ||
      errText.includes('Failed to fetch dynamically') ||
      errText.includes('dynamically imported module') ||
      errText.includes('Importing a module script failed');

    if (isChunkError) {
      try { window.location.reload(); } catch {}
      return;
    }
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
    // Only clear content/cache keys — preserve user session and saved notes
    // so the user doesn't get logged out and lose access to their data.
    const KEEP_KEYS = ['nst_current_user', 'nst_users', 'nst_firebase_project_id', 'nst_user_history', 'nst_system_settings'];
    Object.keys(localStorage).forEach(k => {
      if (!KEEP_KEYS.includes(k)) localStorage.removeItem(k);
    });
    storage.clearContentCache().catch(() => {});
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    const isOffline = !navigator.onLine;
    const label = this.props.fallbackLabel ?? 'page';

    const errText = this.state.error?.message || this.state.error?.toString() || '';
    const isChunkError =
      errText.includes('ChunkLoadError') ||
      errText.includes('Loading chunk') ||
      errText.includes('Failed to fetch dynamically') ||
      errText.includes('dynamically imported module') ||
      errText.includes('Importing a module script failed');

    if (isChunkError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-slate-100">App Load Ho Raha Hai...</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Module connect ho raha hai, kripya 1 second intezar karein.
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl shadow active:scale-95 transition-all flex items-center gap-2"
          >
            <RefreshCcw size={14} /> Dobara Koshish Karein
          </button>
        </div>
      );
    }

    // Custom fallback takes priority over built-in renders
    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.handleRetry) as React.ReactElement;
    }

    // Smart Crash Protection: show professional maintenance screen instead of React error
    if (this.props.crashTarget === 'studentDashboard' && !isOffline) {
      return (
        <MaintenanceScreen
          title={this.props.maintenanceTitle}
          message={this.props.maintenanceMessage}
          retryMinutes={this.props.maintenanceRetryMinutes}
          onRetry={this.handleRetry}
        />
      );
    }

    if (this.props.compact) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 my-2"
        >
          <div className="flex items-center gap-2 text-sm text-red-700 font-semibold">
            {isOffline
              ? <><WifiOff size={16} className="shrink-0" /> Offline — {label} failed to load</>
              : <><span aria-hidden>⚠️</span> Error in {label}</>
            }
          </div>
          {this.state.retryCount < 2 && (
            <button
              onClick={this.handleRetry}
              aria-label={`Retry ${label}`}
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
            {isOffline ? 'No internet connection' : 'Something went wrong'}
          </h1>
          <p className="text-slate-500 text-xs mb-4">
            {isOffline
              ? 'Check your network connection and try again.'
              : `An error occurred in ${label}. The admin has been notified.`}
          </p>

          {/* Technical error details — intentionally hidden from users.
              Admin ko Firebase RTDB ke error_logs mein poori detail milti hai. */}

          <div className="space-y-2.5">
            {this.state.retryCount < 2 && (
              <button onClick={this.handleRetry}
                aria-label="Try again"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-100">
                <RefreshCcw size={15} aria-hidden /> Try Again
              </button>
            )}
            <button onClick={this.handleGoHome}
              aria-label="Go to Home"
              className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
              <Home size={15} aria-hidden /> Go to Home
            </button>
            <button onClick={this.handleReset}
              aria-label="Reset app"
              className="w-full text-slate-400 text-[10px] py-1 hover:text-red-400 transition-colors">
              Reset App (last resort)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
