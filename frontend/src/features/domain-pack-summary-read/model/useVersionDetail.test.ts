import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGetDomainPackVersion } from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';
import { useVersionDetail } from './useVersionDetail';

vi.mock('@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller', () => ({
  useGetDomainPackVersion: vi.fn(),
}));

const mockedUseGetDomainPackVersion = vi.mocked(useGetDomainPackVersion);

describe('useVersionDetail', () => {
  beforeEach(() => mockedUseGetDomainPackVersion.mockClear());

  it('versionId가 null이면 fallback -1을 전달한다', () => {
    mockedUseGetDomainPackVersion.mockReturnValue({ isLoading: false } as ReturnType<typeof useGetDomainPackVersion>);
    useVersionDetail(1, 2, null);
    expect(mockedUseGetDomainPackVersion).toHaveBeenCalledWith(1, 2, -1, { query: { enabled: false } });
  });

  it('versionId가 있으면 해당 값과 enabled:true를 전달한다', () => {
    mockedUseGetDomainPackVersion.mockReturnValue({ isLoading: false } as ReturnType<typeof useGetDomainPackVersion>);
    useVersionDetail(1, 2, 3);
    expect(mockedUseGetDomainPackVersion).toHaveBeenCalledWith(1, 2, 3, { query: { enabled: true } });
  });

  it('결과를 그대로 반환한다', () => {
    const result = { isSuccess: true, data: { versionId: 3, versionNo: 1 } };
    mockedUseGetDomainPackVersion.mockReturnValue(result as ReturnType<typeof useGetDomainPackVersion>);
    const hookResult = useVersionDetail(1, 2, 3);
    expect(hookResult.isSuccess).toBe(true);
    expect(hookResult.data).toEqual(result.data);
  });
});