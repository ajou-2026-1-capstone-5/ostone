import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { domainPackApi, domainPackKeys } from '@/entities/domain-pack';
import { usePackDetail } from './usePackDetail';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({}),
}));

vi.mock('@/entities/domain-pack', () => ({
  domainPackApi: { detail: vi.fn() },
  domainPackKeys: {
    detail: (wsId: number, packId: number) => ['domain-packs', 'detail', wsId, packId],
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('usePackDetail', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    usePackDetail(1, 2);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(['domain-packs', 'detail', 1, 2]);
  });

  it('queryFn이 domainPackApi.detail을 호출한다', () => {
    usePackDetail(1, 2);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(domainPackApi.detail).toHaveBeenCalledWith(1, 2);
  });

  it('loading 상태를 전달받아 반환한다', () => {
    mockedUseQuery.mockReturnValueOnce({ isLoading: true, isFetching: true } as ReturnType<typeof useQuery>);
    const result = usePackDetail(1, 2);
    expect(result.isLoading).toBe(true);
    expect(result.isFetching).toBe(true);
  });

  it('error 상태를 전달받아 반환한다', () => {
    const err = new Error('fail');
    mockedUseQuery.mockReturnValueOnce({ isError: true, error: err } as ReturnType<typeof useQuery>);
    const result = usePackDetail(1, 2);
    expect(result.isError).toBe(true);
    expect(result.error).toBe(err);
  });

  it('성공 상태를 전달받아 반환한다', () => {
    const data = { packId: 2, versions: [] };
    mockedUseQuery.mockReturnValueOnce({ isSuccess: true, data } as ReturnType<typeof useQuery>);
    const result = usePackDetail(1, 2);
    expect(result.isSuccess).toBe(true);
    expect(result.data).toBe(data);
  });

  it('queryKey에 wsId와 packId가 반영된다', () => {
    usePackDetail(5, 99);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown[] }];
    expect(opts.queryKey).toContain(5);
    expect(opts.queryKey).toContain(99);
  });

  // domainPackKeys factory is exercised by the queryKey tests above
  it('domainPackKeys.detail이 useQuery에 전달된다', () => {
    usePackDetail(3, 7);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(domainPackKeys.detail(3, 7));
  });
});
