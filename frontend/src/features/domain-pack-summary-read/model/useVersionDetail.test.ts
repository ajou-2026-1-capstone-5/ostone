import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useVersionDetail } from './useVersionDetail';

const mockDomainPackApi = vi.hoisted(() => ({
  versionDetail: vi.fn(),
}));

vi.mock('@/entities/domain-pack', () => ({
  domainPackApi: mockDomainPackApi,
  domainPackKeys: {
    versionDetail: (...args: number[]) => ['domain-packs', 'version-detail', ...args],
  },
}));

const mockedVersionDetail = mockDomainPackApi.versionDetail;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useVersionDetail', () => {
  beforeEach(() => mockedVersionDetail.mockReset());

  it('versionId가 null이면 상세 조회 함수를 호출하지 않는다', () => {
    const { result } = renderHook(() => useVersionDetail(1, 2, null), { wrapper: makeWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedVersionDetail).not.toHaveBeenCalled();
  });

  it('versionId가 있으면 상세 API를 호출한다', async () => {
    const data = { versionId: 3, versionNo: 1 };
    mockedVersionDetail.mockResolvedValue(data);
    const { result } = renderHook(() => useVersionDetail(1, 2, 3), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(mockedVersionDetail).toHaveBeenCalledWith(1, 2, 3);
  });
});
