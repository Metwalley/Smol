import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-100 p-6">
          <div className="max-w-2xl w-full bg-zinc-900 border border-red-900/30 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-3 px-6 py-4 bg-red-950/20 border-b border-red-900/30">
              <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
              <div>
                <h1 className="text-lg font-semibold text-red-400">Something went wrong</h1>
                <p className="text-sm text-zinc-400">Smol encountered an unexpected error and needs to restart.</p>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-black/50 rounded-lg p-4 mb-6 overflow-x-auto border border-zinc-800">
                <p className="font-mono text-sm text-red-300 font-semibold mb-2">
                  {this.state.error?.name}: {this.state.error?.message}
                </p>
                <pre className="font-mono text-xs text-zinc-500 whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack || this.state.error?.stack}
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart Smol
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
