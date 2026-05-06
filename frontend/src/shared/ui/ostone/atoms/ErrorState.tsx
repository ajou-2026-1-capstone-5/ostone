interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--s-3)',
      }}
    >
      <span
        style={{
          color: 'var(--danger)',
          fontFamily: 'var(--sans)',
          fontSize: '14px',
        }}
      >
        {message}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-2)',
            padding: 'var(--s-2) var(--s-4)',
            color: 'var(--ink)',
            cursor: 'pointer',
            background: 'transparent',
            fontFamily: 'var(--sans)',
            fontSize: '13px',
          }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}