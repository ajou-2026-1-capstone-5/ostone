import { useEffect, useState } from 'react';
import { workflowApi } from '../api/workflowApi';
import { ApiRequestError } from '../../../shared/api';
import type { WorkflowDetail } from '../../../entities/workflow/model/types';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; code: string; message: string }
  | { status: 'ready'; data: WorkflowDetail };

export function useWorkflowDetail(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (workflowId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    workflowApi
      .detail(wsId, packId, versionId, workflowId)
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
  }, [wsId, packId, versionId, workflowId]);

  return state;
}
