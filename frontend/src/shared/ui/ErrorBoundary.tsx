import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
  resetKeys?: unknown[];
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  prevResetKeys?: unknown[];
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, prevResetKeys: this.props.resetKeys };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, onReset } = this.props;

    // Check if resetKeys have changed
    if (this.state.hasError && resetKeys !== undefined) {
      const hasResetKeysChanged =
        prevProps.resetKeys === undefined ||
        resetKeys.length !== prevProps.resetKeys.length ||
        resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index]);

      if (hasResetKeysChanged) {
        this.setState({ hasError: false, prevResetKeys: resetKeys });
        onReset?.();
      }
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}