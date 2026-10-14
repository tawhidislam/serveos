import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/**
 * Runtime-safe error boundary scoped to the /auth route.
 * Guarantees a visible fallback UI (never blank) and emits actionable
 * console diagnostics so blank-screen regressions can be triaged quickly.
 */
export default class AuthErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Actionable console logging — keep grouped & labeled for fast triage
    // eslint-disable-next-line no-console
    console.group('%c[AuthErrorBoundary] /auth render failed', 'color:#ef4444;font-weight:bold');
    // eslint-disable-next-line no-console
    console.error('Error:', error);
    // eslint-disable-next-line no-console
    console.error('Message:', error?.message);
    // eslint-disable-next-line no-console
    console.error('Stack:', error?.stack);
    // eslint-disable-next-line no-console
    console.error('Component stack:', info?.componentStack);
    // eslint-disable-next-line no-console
    console.error('URL:', typeof window !== 'undefined' ? window.location.href : 'n/a');
    // eslint-disable-next-line no-console
    console.groupEnd();
    this.setState({ componentStack: info?.componentStack ?? null });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleStaffLogin = () => {
    window.location.assign('/staff-login');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'An unexpected error occurred while loading sign-in.';
    const isDev = import.meta.env.DEV;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md card-shadow ring-subtle rounded-lg bg-card p-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-card-foreground">
                Sign-in unavailable
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-6">
            <Button onClick={this.handleReload} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
              Reload page
            </Button>
            <Button onClick={this.handleStaffLogin} variant="outline" className="w-full gap-2">
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              Staff sign in
            </Button>
          </div>

          {isDev && this.state.componentStack && (
            <details className="mt-6 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Developer details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words bg-muted/40 rounded p-2 max-h-64 overflow-auto">
{this.state.error?.stack}
{'\n\nComponent stack:'}
{this.state.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}