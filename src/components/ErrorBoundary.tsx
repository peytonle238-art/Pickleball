import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const rawMsg =
      error instanceof Error ? error.message : String(error || 'Unexpected error');

    // Parse structured FirestoreErrorInfo JSON if thrown by handleFirestoreError
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed && typeof parsed.error === 'string' && parsed.operationType) {
        const lower = parsed.error.toLowerCase();
        const isPerm =
          lower.includes('permission') ||
          lower.includes('insufficient') ||
          lower.includes('denied');
        return {
          hasError: true,
          message: isPerm
            ? 'Cloud sync was blocked by security permissions. Sign in with an authorized account or reload the portal.'
            : `Cloud database sync encountered an error (${parsed.operationType}): ${parsed.error}`,
          isPermissionError: isPerm,
        };
      }
    } catch {
      // Non-JSON runtime error
    }

    return {
      hasError: true,
      message: rawMsg || 'An unexpected application error occurred.',
      isPermissionError: false,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Portal ErrorBoundary caught error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('bnhs_pickleball_hq_fresh_v2');
      localStorage.removeItem('bnhs_pickleball_hq_v1');
      localStorage.removeItem('bnhs_pickleball_linked_member_v1');
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[var(--color-paper)] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {this.state.isPermissionError
                  ? 'Access Permission Notice'
                  : 'Something went wrong'}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {this.state.message}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload Portal</span>
            </button>
            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cache</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
