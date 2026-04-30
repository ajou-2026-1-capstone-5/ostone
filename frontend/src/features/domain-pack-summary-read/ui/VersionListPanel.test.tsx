import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DomainPackDetail } from '@/entities/domain-pack';
import { VersionListPanel } from './VersionListPanel';

function makeQuery(
  overrides: Partial<UseQueryResult<DomainPackDetail>>,
): UseQueryResult<DomainPackDetail> {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as UseQueryResult<DomainPackDetail>;
}

const stubVersion = {
  versionId: 1,
  versionNo: 1,
  lifecycleStatus: 'DRAFT' as const,
  sourcePipelineJobId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const stubVersion2 = {
  versionId: 2,
  versionNo: 2,
  lifecycleStatus: 'DRAFT' as const,
  sourcePipelineJobId: null,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const stubPack: DomainPackDetail = {
  packId: 2,
  workspaceId: 1,
  code: 'CS',
  name: '고객지원',
  description: null,
  versions: [stubVersion],
  createdAt: '',
  updatedAt: '',
};

const stubPackMulti: DomainPackDetail = {
  ...stubPack,
  versions: [stubVersion, stubVersion2],
};

describe('VersionListPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loading 상태에서 버전 목록을 렌더링하지 않는다', () => {
    render(
      <VersionListPanel
        query={makeQuery({ isLoading: true })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('error 상태에서 에러 메시지와 다시 시도 버튼을 표시한다', () => {
    const refetch = vi.fn();
    render(
      <VersionListPanel
        query={makeQuery({ isError: true, error: new Error('fail'), refetch })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('버전 목록을 불러오지 못했습니다.');
    const retryBtn = screen.getByRole('button', { name: '다시 시도' });
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('빈 버전 목록 시 안내 메시지를 표시한다', () => {
    render(
      <VersionListPanel
        query={makeQuery({ data: { ...stubPack, versions: [] } })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('버전이 없습니다.')).toBeInTheDocument();
  });

  it('onCreateDraft 전달 시 "새 DRAFT 묶기" 버튼을 표시하고 클릭 시 호출한다', () => {
    const onCreateDraft = vi.fn();
    render(
      <VersionListPanel
        query={makeQuery({ data: { ...stubPack, versions: [] } })}
        selectedId={null}
        onSelect={vi.fn()}
        onCreateDraft={onCreateDraft}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '새 DRAFT 묶기' }));
    expect(onCreateDraft).toHaveBeenCalled();
  });

  it('버전 목록을 렌더링하고 클릭 시 onSelect를 호출한다', () => {
    const onSelect = vi.fn();
    render(
      <VersionListPanel
        query={makeQuery({ data: stubPack })}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('버전 1개')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /v1/ });
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('active 버전 button에 aria-current="true"가 부여된다', () => {
    render(
      <VersionListPanel
        query={makeQuery({ data: stubPack })}
        selectedId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /v1/ })).toHaveAttribute('aria-current', 'true');
  });

  it('selectedId=null 시 첫 번째 버전 button에 tabIndex=0, 나머지에는 tabIndex=-1이 부여된다', () => {
    render(
      <VersionListPanel
        query={makeQuery({ data: stubPackMulti })}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /v1/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /v2/ })).toHaveAttribute('tabindex', '-1');
  });
});
