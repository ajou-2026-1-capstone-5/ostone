import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useListPolicies } from '@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller';
import { usePolicyList } from './usePolicyList';

vi.mock('@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller', () => ({
  useListPolicies: vi.fn(),
}));

const mockedUseListPolicies = vi.mocked(useListPolicies);

describe('usePolicyList', () => {
  beforeEach(() => mockedUseListPolicies.mockClear());

  it('useListPolicies를 호출한다', () => {
    mockedUseListPolicies.mockReturnValue({ isLoading: false } as ReturnType<typeof useListPolicies>);
    usePolicyList(1, 2, 3);
    expect(mockedUseListPolicies).toHaveBeenCalledWith(1, 2, 3, {});
  });

  it('loading 상태를 반환한다', () => {
    mockedUseListPolicies.mockReturnValue({ isLoading: true } as ReturnType<typeof useListPolicies>);
    const result = usePolicyList(1, 2, 3);
    expect(result).toEqual({ status: 'loading' });
  });

  it('error 상태를 반환한다', () => {
    const err = new Error('fail');
    mockedUseListPolicies.mockReturnValue({ isError: true, error: err } as ReturnType<typeof useListPolicies>);
    const result = usePolicyList(1, 2, 3);
    expect(result).toEqual({ status: 'error', code: 'UNKNOWN_ERROR', message: '알 수 없는 오류가 발생했습니다.' });
  });

  it('성공 상태를 반환한다', () => {
    const data = { data: [{ id: 1, name: 'Policy 1' }] };
    mockedUseListPolicies.mockReturnValue({ isSuccess: true, data } as ReturnType<typeof useListPolicies>);
    const result = usePolicyList(1, 2, 3);
    expect(result).toEqual({ status: 'ready', data: data.data });
  });
});