import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiRequestError } from '@/shared/api';
import { createDraftApi } from '../api/createDraftApi';
import { useCreateDraft } from './useCreateDraft';

vi.mock('../api/createDraftApi', () => ({
  createDraftApi: { create: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/entities/domain-pack', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entities/domain-pack')>();
  return {
    ...original,
    domainPackKeys: {
      ...original.domainPackKeys,
      detail: (wsId: number, packId: number) => ['domain-packs', 'detail', wsId, packId],
    },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const stubResponse = {
  versionId: 10,
  domainPackId: 2,
  versionNo: 2,
  lifecycleStatus: 'DRAFT' as const,
  sourcePipelineJobId: null,
  intentCount: 0,
  slotCount: 0,
  policyCount: 0,
  riskCount: 0,
  workflowCount: 0,
  createdAt: '',
};

const mutateParams = { wsId: 1, packId: 2, payload: {} };

describe('useCreateDraft', () => {
  beforeEach(() => {
    vi.mocked(createDraftApi.create).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('201 성공 시 toast.success를 호출한다', async () => {
    vi.mocked(createDraftApi.create).mockResolvedValue(stubResponse);
    const { result } = renderHook(() => useCreateDraft(), { wrapper });
    result.current.mutate(mutateParams);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('새 DRAFT 버전이 생성되었습니다.'));
  });

  it('403 에러 시 "접근 권한 없음" toast.error를 호출한다', async () => {
    vi.mocked(createDraftApi.create).mockRejectedValue(
      new ApiRequestError(403, 'FORBIDDEN', 'forbidden'),
    );
    const { result } = renderHook(() => useCreateDraft(), { wrapper });
    result.current.mutate(mutateParams);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('접근 권한 없음'));
  });

  it('409 에러 시 toast를 호출하지 않는다', async () => {
    vi.mocked(createDraftApi.create).mockRejectedValue(
      new ApiRequestError(409, 'CONFLICT', 'conflict'),
    );
    const { result } = renderHook(() => useCreateDraft(), { wrapper });
    result.current.mutate(mutateParams);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('400 에러 시 "DRAFT 생성에 실패했습니다." toast.error를 호출한다', async () => {
    vi.mocked(createDraftApi.create).mockRejectedValue(
      new ApiRequestError(400, 'BAD_REQUEST', '잘못된 요청'),
    );
    const { result } = renderHook(() => useCreateDraft(), { wrapper });
    result.current.mutate(mutateParams);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('DRAFT 생성에 실패했습니다.'),
    );
  });

  it('비 ApiRequestError 에러 시 "DRAFT 생성에 실패했습니다." toast.error를 호출한다', async () => {
    vi.mocked(createDraftApi.create).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useCreateDraft(), { wrapper });
    result.current.mutate(mutateParams);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('DRAFT 생성에 실패했습니다.'),
    );
  });
});
