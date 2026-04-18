import { useEffect, useState } from 'react';
import { workflowApi } from '../api/workflowApi';
import { ApiRequestError } from '../../../shared/api';
import type { WorkflowSummary } from '../../../entities/workflow/model/types';

type State =
  | { status: 'loading' }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; data: WorkflowSummary[] };

export function useWorkflowList(wsId: number, packId: number, versionId: number) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });
    workflowApi
      .list(wsId, packId, versionId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((e) => {
        if (!cancelled) {
          if (e instanceof ApiRequestError) {
            setState({ status: 'error', code: e.code, message: e.message });
          } else {
            setState({ status: 'error', code: 'UNKNOWN_ERROR', message: '알 수 없는 오류가 발생했습니다.' });
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, packId, versionId]);

  return state;
}
