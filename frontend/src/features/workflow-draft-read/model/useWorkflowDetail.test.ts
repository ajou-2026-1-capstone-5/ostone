import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiRequestError } from '../../../shared/api';

vi.mock('../api/workflowApi', () => ({
  workflowApi: {
    detail: vi.fn(),
  },
}));

import { workflowApi } from '../api/workflowApi';
import { useWorkflowDetail } from './useWorkflowDetail';

const mockDetail = vi.mocked(workflowApi.detail);

const mockWorkflowDetail = {
  id: 1,
  workflowCode: 'WF-001',
  name: '워크플로우 1',
  description: null,
  graphJson: { direction: 'LR' as const, nodes: [], edges: [] },
  initialState: 'START',
  terminalStatesJson: '["END"]',
  evidenceJson: '{}',
  metaJson: '{}',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useWorkflowDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('workflowId가 null이면 idle 상태다', () => {
    // given / when
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, null));
    // then
    expect(result.current.status).toBe('idle');
  });

  it('workflowId가 주어지면 초기 상태는 loading이다', () => {
    // given
    mockDetail.mockResolvedValue(mockWorkflowDetail);
    // when
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 1));
    // then
    expect(result.current.status).toBe('loading');
  });

  it('API 성공 시 ready 상태와 데이터를 반환한다', async () => {
    // given
    mockDetail.mockResolvedValue(mockWorkflowDetail);
    // when
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 1));
    // then
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') {
      expect(result.current.data.workflowCode).toBe('WF-001');
    }
  });

  it('404 ApiRequestError 발생 시 WORKFLOW_DEFINITION_NOT_FOUND 코드를 반환한다', async () => {
    // given
    const error = new ApiRequestError(404, 'WORKFLOW_DEFINITION_NOT_FOUND', 'Workflow를 찾을 수 없습니다.');
    mockDetail.mockRejectedValue(error);
    // when
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 999));
    // then
    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status === 'error') {
      expect(result.current.code).toBe('WORKFLOW_DEFINITION_NOT_FOUND');
      expect(result.current.message).toBe('Workflow를 찾을 수 없습니다.');
    }
  });

  it('알 수 없는 오류 발생 시 UNKNOWN_ERROR 코드를 반환한다', async () => {
    // given
    mockDetail.mockRejectedValue(new Error('network error'));
    // when
    const { result } = renderHook(() => useWorkflowDetail(1, 2, 3, 1));
    // then
    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status === 'error') {
      expect(result.current.code).toBe('UNKNOWN_ERROR');
    }
  });
});
