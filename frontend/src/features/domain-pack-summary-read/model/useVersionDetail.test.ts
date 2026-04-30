import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { domainPackApi, domainPackKeys } from '@/entities/domain-pack';
import { ApiRequestError } from '@/shared/api';
import { useVersionDetail } from './useVersionDetail';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({}),
}));

vi.mock('@/entities/domain-pack', () => ({
  domainPackApi: { versionDetail: vi.fn() },
  domainPackKeys: {
    versionDetail: (wsId: number, packId: number, versionId: number) =>
      ['domain-packs', 'version-detail', wsId, packId, versionId],
  },
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/api')>();
  return { ...original };
});

const mockedUseQuery = vi.mocked(useQuery);

describe('useVersionDetail', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    useVersionDetail(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(domainPackKeys.versionDetail(1, 2, 3));
  });

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    useVersionDetail(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    useVersionDetail(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('queryFn이 domainPackApi.versionDetail을 호출한다', () => {
    useVersionDetail(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(domainPackApi.versionDetail).toHaveBeenCalledWith(1, 2, 3);
  });

  it('loading 상태를 전달받아 반환한다', () => {
    mockedUseQuery.mockReturnValueOnce({ isLoading: true, isFetching: true } as ReturnType<typeof useQuery>);
    const result = useVersionDetail(1, 2, 3);
    expect(result.isLoading).toBe(true);
  });

  it('404 ApiRequestError 에러 상태를 전달받아 반환한다', () => {
    const err = new ApiRequestError(404, 'NOT_FOUND', '버전을 찾을 수 없습니다.');
    mockedUseQuery.mockReturnValueOnce({ isError: true, error: err } as ReturnType<typeof useQuery>);
    const result = useVersionDetail(1, 2, 3);
    expect(result.isError).toBe(true);
    expect((result.error as ApiRequestError).status).toBe(404);
  });

  it('성공 상태를 전달받아 반환한다', () => {
    const data = { versionId: 3, versionNo: 1 };
    mockedUseQuery.mockReturnValueOnce({ isSuccess: true, data } as ReturnType<typeof useQuery>);
    const result = useVersionDetail(1, 2, 3);
    expect(result.isSuccess).toBe(true);
    expect(result.data).toBe(data);
  });
});
