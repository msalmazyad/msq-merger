import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Render prop that receives the caught error. Lets us use i18n etc. */
  fallback: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any error thrown during render in the subtree and renders the
 * fallback instead of letting the whole page go blank. Cannot catch
 * errors thrown in event handlers / async code — those are caught via
 * try/catch inside App.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the stack so devs can find the bug. Production users still
    // see the friendly fallback — this is just for debugging.
    console.error("Caught by ErrorBoundary:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
