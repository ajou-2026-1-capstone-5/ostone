import type { DemoExecution, DemoPolicyHit, DemoRiskHit } from '../model/chatWorkflow.types';

interface ExecutionDetailPanelProps {
  execution: DemoExecution | null;
}

function statusColorClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'idle':
      return 'text-gray-500';
    case 'running':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

function PolicyHitRow({ hit }: { hit: DemoPolicyHit }) {
  const isPass = hit.result === 'PASS';
  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
      <span className={isPass ? 'text-green-600' : 'text-red-600'}>{isPass ? '✓' : '✗'}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{hit.policyName}</span>
          <span className={isPass ? 'text-green-600' : 'text-red-600'}>({hit.result})</span>
        </div>
        <p className="text-xs text-muted-foreground">{hit.detail}</p>
      </div>
    </div>
  );
}

function RiskHitRow({ hit }: { hit: DemoRiskHit }) {
  const isLow = hit.result === 'LOW';
  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
      <span className={isLow ? 'text-yellow-600' : 'text-red-600'}>{isLow ? '⚠' : '🔴'}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{hit.riskName}</span>
          <span className={isLow ? 'text-yellow-600' : 'text-red-600'}>({hit.result})</span>
        </div>
        <p className="text-xs text-muted-foreground">{hit.detail}</p>
      </div>
    </div>
  );
}

export function ExecutionDetailPanel({ execution }: ExecutionDetailPanelProps) {
  if (!execution) {
    return (
      <div className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Execution Detail</h3>
        <p className="text-sm text-muted-foreground">Waiting for execution...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Execution Detail</h3>
      <div className="space-y-3">
        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">Status:</span>{' '}
          <span className={`font-medium ${statusColorClass(execution.status)}`} data-testid="execution-status">
            {execution.status}
          </span>
        </div>

        <div className="rounded-md bg-muted px-3 py-2 text-sm" data-testid="execution-intent">
          <span className="text-xs text-muted-foreground">Intent:</span>{' '}
          <span className="font-medium">{execution.intent}</span>
        </div>

        <div className="rounded-md border px-3 py-2 text-sm" data-testid="execution-slots">
          <span className="text-xs text-muted-foreground">Slot Values:</span>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {Object.entries(execution.slotValues).map(([key, value]) => (
                <tr key={key}>
                  <td className="py-0.5 pr-3 font-medium text-muted-foreground">{key}</td>
                  <td className="py-0.5">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {execution.missingSlots.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
            <span className="text-xs font-medium text-red-600">Missing Slots:</span>
            <p className="mt-0.5 text-red-600">
              {execution.missingSlots.join(', ')}
            </p>
          </div>
        )}

        {execution.policyHits.length > 0 && (
          <div data-testid="execution-policies">
            <span className="mb-1 block text-xs text-muted-foreground">Policy Hits:</span>
            <div className="space-y-1.5">
              {execution.policyHits.map((hit) => (
                <PolicyHitRow key={hit.policyId} hit={hit} />
              ))}
            </div>
          </div>
        )}

        {execution.riskHits.length > 0 && (
          <div data-testid="execution-risks">
            <span className="mb-1 block text-xs text-muted-foreground">Risk Hits:</span>
            <div className="space-y-1.5">
              {execution.riskHits.map((hit) => (
                <RiskHitRow key={hit.riskId} hit={hit} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
