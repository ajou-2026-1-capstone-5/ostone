import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DomainPackVersionDetail } from '@/entities/domain-pack';
import { ApiRequestError } from '@/shared/api';
import { SummaryDetailPanel } from './SummaryDetailPanel';

vi.mock('./SummaryJsonCard', () => ({
  SummaryJsonCard: ({ summaryJson }: { summaryJson: string }) => (
    <div data-testid="summary-json-card">{summaryJson}</div>
  ),
}));

vi.mock('./ComponentCountGrid', () => ({
  ComponentCountGrid: () => <div data-testid="component-count-grid" />,
}));

function makeQuery(
  overrides: Partial<UseQueryResult<DomainPackVersionDetail>>,
): UseQueryResult<DomainPackVersionDetail> {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as UseQueryResult<DomainPackVersionDetail>;
}

const stubDetail: DomainPackVersionDetail = {
  versionId: 3,
  packId: 2,
  versionNo: 1,
  lifecycleStatus: 'DRAFT',
  sourcePipelineJobId: null,
  summaryJson: '{"key":"val"}',
  intentCount: 5,
  slotCount: 2,
  policyCount: 1,
  riskCount: 0,
  workflowCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SummaryDetailPanel', () => {
  it('data 없고 로딩/에러 없으면 "버전을 선택하세요." 안내를 표시한다', () => {
    render(<SummaryDetailPanel query={makeQuery({})} wsId={1} packId={2} />);
    expect(screen.getByText('버전을 선택하세요.')).toBeInTheDocument();
  });

  it('loading 상태에서 "로딩 중" aria-label을 렌더링한다', () => {
    render(
      <SummaryDetailPanel query={makeQuery({ isLoading: true })} wsId={1} packId={2} />,
    );
    expect(screen.getByLabelText('로딩 중')).toBeInTheDocument();
  });

  it('일반 에러 시 에러 메시지를 alert role로 표시한다', () => {
    render(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: new Error('fail') })}
        wsId={1}
        packId={2}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '버전 상세 정보를 불러오지 못했습니다.',
    );
  });

  it('404 에러 시 "버전을 찾을 수 없습니다." 메시지를 표시하고 다시 시도 버튼은 없다', () => {
    const error404 = new ApiRequestError(404, 'NOT_FOUND', 'not found');
    render(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: error404 })}
        wsId={1}
        packId={2}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('버전을 찾을 수 없습니다.');
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('일반 에러 시 다시 시도 버튼을 표시하고 클릭 시 refetch를 호출한다', () => {
    const refetch = vi.fn();
    render(
      <SummaryDetailPanel
        query={makeQuery({ isError: true, error: new Error('fail'), refetch })}
        wsId={1}
        packId={2}
      />,
    );
    const retryBtn = screen.getByRole('button', { name: '다시 시도' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('정상 데이터 시 버전 번호와 라이프사이클 상태를 렌더링한다', () => {
    render(
      <SummaryDetailPanel query={makeQuery({ data: stubDetail })} wsId={1} packId={2} />,
    );
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByTestId('summary-json-card')).toBeInTheDocument();
    expect(screen.getByTestId('component-count-grid')).toBeInTheDocument();
  });
});
