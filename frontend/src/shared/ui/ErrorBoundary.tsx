import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
  prevResetKeys?: unknown[];
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, prevResetKeys: props.resetKeys };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.hasError && props.resetKeys !== state.prevResetKeys) {
      return { hasError: false, prevResetKeys: props.resetKeys };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
            }}
          >
            오류가 발생했습니다. 페이지를 새로고침해 주세요.
          </div>
        )
      );
    }
    return this.props.children;
  }
}