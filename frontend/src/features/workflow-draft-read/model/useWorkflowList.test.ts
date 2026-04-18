import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiRequestError } from '../../../shared/api';

vi.mock('../api/workflowApi', () => ({
  workflowApi: {
    list: vi.fn(),
  },
}));

import { workflowApi } from '../api/workflowApi';
import { useWorkflowList } from './useWorkflowList';

const mockList = vi.mocked(workflowApi.list);

const mockSummary = {
  id: 1,
  workflowCode: 'WF-001',
  name: '워크플로우 1',
  description: null,
  initialState: 'START',
  terminalStatesJson: '["END"]',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useWorkflowList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('초기 상태는 loading이다', () => {
    // given
    mockList.mockResolvedValue([]);
    // when
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    // then
    expect(result.current.status).toBe('loading');
  });

  it('API 성공 시 ready 상태와 데이터를 반환한다', async () => {
    // given
    mockList.mockResolvedValue([mockSummary]);
    // when
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    // then
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') {
      expect(result.current.data).toEqual([mockSummary]);
    }
  });

  it('빈 배열 응답 시 ready 상태와 빈 배열을 반환한다', async () => {
    // given
    mockList.mockResolvedValue([]);
    // when
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    // then
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') {
      expect(result.current.data).toHaveLength(0);
    }
  });

  it('ApiRequestError 발생 시 error 상태와 코드/메시지를 반환한다', async () => {
    // given
    const error = new ApiRequestError(403, 'FORBIDDEN', '접근 권한이 없습니다.');
    mockList.mockRejectedValue(error);
    // when
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    // then
    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status === 'error') {
      expect(result.current.code).toBe('FORBIDDEN');
      expect(result.current.message).toBe('접근 권한이 없습니다.');
    }
  });

  it('알 수 없는 오류 발생 시 UNKNOWN_ERROR 코드를 반환한다', async () => {
    // given
    mockList.mockRejectedValue(new Error('network error'));
    // when
    const { result } = renderHook(() => useWorkflowList(1, 2, 3));
    // then
    await waitFor(() => expect(result.current.status).toBe('error'));
    if (result.current.status === 'error') {
      expect(result.current.code).toBe('UNKNOWN_ERROR');
    }
  });
});
