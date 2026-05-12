interface ExecutionDetailPanelProps {
  status: string;
  context: Record<string, unknown>;
}

export function ExecutionDetailPanel({ status, context }: ExecutionDetailPanelProps) {
  const isIdleEmpty = status === "idle" && Object.keys(context).length === 0;

  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Execution Detail</h3>
      {isIdleEmpty ? (
        <p className="text-sm text-muted-foreground">Waiting for execution...</p>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">Status:</span>{" "}
            <span className="font-medium capitalize">{status}</span>
          </div>
          {Object.keys(context).length > 0 && (
            <div className="rounded-md border px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Context:</span>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {Object.entries(context).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{key}:</span> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
