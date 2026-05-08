import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useListDomainPacks = vi.fn();

vi.mock('@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller', () => ({
  useListDomainPacks: () => useListDomainPacks(),
}));

vi.mock('@/shared/ui/ostone/atoms/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/shared/ui/ostone/atoms/ErrorState', () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div data-testid="error-state" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>다시 시도</button>
      )}
    </div>
  ),
}));

vi.mock('@/shared/ui/ostone/atoms/EmptyState', () => ({
  EmptyState: ({ message }: { message: string }) => (
    <div data-testid="empty-state">{message}</div>
  ),
}));

import { DomainPackListPage } from './DomainPackListPage';

const ROUTE = '/workspaces/:workspaceId/domain-packs';

function renderPage(path = '/workspaces/1/domain-packs') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE} element={<DomainPackListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DomainPackListPage', () => {
  it('유효하지 않은 workspaceId는 /workspaces로 리다이렉트한다', () => {
    renderPage('/workspaces/abc/domain-packs');
    expect(screen.queryByText('Domain Packs')).not.toBeInTheDocument();
  });

  it('로딩 중 LoadingSpinner를 표시한다', () => {
    useListDomainPacks.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('에러 시 ErrorState와 다시 시도 버튼을 표시한다', () => {
    const refetch = vi.fn();
    useListDomainPacks.mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('fail'), refetch });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('도메인 팩 목록을 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('빈 목록일 때 EmptyState와 업로드 링크를 표시한다', () => {
    useListDomainPacks.mockReturnValue({ isLoading: false, isError: false, data: { data: [] }, refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('empty-state')).toHaveTextContent('아직 도메인팩이 없습니다');
    expect(screen.getByText('상담 로그 업로드')).toBeInTheDocument();
  });

  it('데이터가 있을 때 Domain Packs 제목과 목록을 렌더링한다', () => {
    useListDomainPacks.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { packId: 1, name: 'CS Pack', description: 'Customer service pack' },
          { packId: 2, name: null, description: null },
        ],
      },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Domain Packs')).toBeInTheDocument();
    expect(screen.getByText('CS Pack')).toBeInTheDocument();
    expect(screen.getByText('Customer service pack')).toBeInTheDocument();
    expect(screen.getByText('Pack 2')).toBeInTheDocument();
  });

  it('name이 없으면 Pack {id} 폴백을 표시한다', () => {
    useListDomainPacks.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [{ packId: 3, name: null, description: null }] },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Pack 3')).toBeInTheDocument();
  });
});
