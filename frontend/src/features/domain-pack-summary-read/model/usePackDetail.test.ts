import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGetDomainPack } from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';
import { usePackDetail } from './usePackDetail';

vi.mock('@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller', () => ({
  useGetDomainPack: vi.fn(),
}));

const mockedUseGetDomainPack = vi.mocked(useGetDomainPack);

describe('usePackDetail', () => {
  beforeEach(() => mockedUseGetDomainPack.mockClear());

  it('useGetDomainPack을 호출한다', () => {
    mockedUseGetDomainPack.mockReturnValue({ isLoading: false } as ReturnType<typeof useGetDomainPack>);
    usePackDetail(1, 2);
    expect(mockedUseGetDomainPack).toHaveBeenCalledWith(1, 2, { query: { select: expect.any(Function) } });
  });

  it('결과를 그대로 반환한다', () => {
    const result = { isSuccess: true, data: { packId: 2, name: 'Test Pack', versions: [] } };
    mockedUseGetDomainPack.mockReturnValue(result as ReturnType<typeof useGetDomainPack>);
    const hookResult = usePackDetail(1, 2);
    expect(hookResult.isSuccess).toBe(true);
    expect(hookResult.data).toEqual(result.data);
  });
});