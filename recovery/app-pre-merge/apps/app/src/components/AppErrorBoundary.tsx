import React from 'react';
import { track } from '../services/analytics';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App render error:', error, errorInfo);
    track('app_render_error', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
      componentStack: errorInfo.componentStack || '',
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <div className="text-sm uppercase tracking-[0.3em] text-white/50">Application Error</div>
            <h1 className="mt-3 text-2xl font-semibold">Something broke while rendering the app.</h1>
            <p className="mt-3 text-sm text-white/70">
              Reload the page. If this keeps happening, send support the error message below.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-red-200">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
