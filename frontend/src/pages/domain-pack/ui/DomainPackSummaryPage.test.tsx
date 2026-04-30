import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiRequestError } from '@/shared/api';
import { usePackDetail, useVersionDetail } from '@/features/domain-pack-summary-read';
import { DomainPackSummaryPage } from './DomainPackSummaryPage';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const ROUTE = '/workspaces/:workspaceId/domain-packs/:packId';

vi.mock('@/shared/ui/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/domain-pack-summary-read', () => ({
  usePackDetail: vi.fn(),
  useVersionDetail: vi.fn(),
  VersionListPanel: () => <div data-testid="version-list-panel" />,
  SummaryDetailPanel: () => <div data-testid="summary-detail-panel" />,
}));

vi.mock('@/features/domain-pack-draft-create', () => ({
  CreateDraftModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-draft-modal">
      <button type="button" onClick={onClose}>모달 닫기</button>
    </div>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePackQuery(overrides: Record<string, unknown> = {}): any {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderPage(path = '/workspaces/1/domain-packs/2') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTE} element={<DomainPackSummaryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DomainPackSummaryPage', () => {
  beforeEach(() => {
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery());
    vi.mocked(useVersionDetail).mockReturnValue(makePackQuery());
    vi.mocked(toast.error).mockReset();
  });

  it('유효하지 않은 workspaceId 시 에러 메시지를 표시한다', () => {
    renderPage('/workspaces/abc/domain-packs/2');
    expect(screen.getByRole('alert')).toHaveTextContent('잘못된 URL 파라미터');
  });

  it('packDetail 에러(비404) 시 에러 카드와 다시 시도 버튼을 표시한다', () => {
    const refetch = vi.fn();
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: new Error('fail'), refetch }),
    );
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Pack 정보를 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('packDetail 404 에러 시 "Pack을 찾을 수 없습니다." 메시지를 표시한다', () => {
    const error404 = new ApiRequestError(404, 'NOT_FOUND', 'not found');
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: error404 }),
    );
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Pack을 찾을 수 없습니다.');
  });

  it('정상 상태에서 VersionListPanel과 SummaryDetailPanel을 렌더링한다', () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ data: { packId: 2, name: 'CS Pack', code: 'CS', versions: [] } }),
    );
    renderPage();
    expect(screen.getByTestId('version-list-panel')).toBeInTheDocument();
    expect(screen.getByTestId('summary-detail-panel')).toBeInTheDocument();
  });

  it('"새 DRAFT 묶기" 버튼 클릭 시 CreateDraftModal을 표시한다', async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ data: { packId: 2, name: 'CS Pack', code: 'CS', versions: [] } }),
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '새 DRAFT 묶기' }));
    await waitFor(() =>
      expect(screen.getByTestId('create-draft-modal')).toBeInTheDocument(),
    );
  });

  it('CreateDraftModal의 onClose 호출 시 모달이 닫힌다', async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ data: { packId: 2, name: 'CS Pack', code: 'CS', versions: [] } }),
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '새 DRAFT 묶기' }));
    await waitFor(() => expect(screen.getByTestId('create-draft-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '모달 닫기' }));
    await waitFor(() =>
      expect(screen.queryByTestId('create-draft-modal')).not.toBeInTheDocument(),
    );
  });

  it('packDetail 로딩 중에도 VersionListPanel을 렌더링한다', () => {
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery({ isLoading: true }));
    renderPage();
    expect(screen.getByTestId('version-list-panel')).toBeInTheDocument();
  });

  it('packDetail 비404 에러 시 toast.error를 1회 호출한다', async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: new Error('fail') }),
    );
    renderPage();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Pack 정보를 불러오지 못했습니다.'),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('packDetail 404 에러 시 toast.error를 "Pack을 찾을 수 없습니다."로 호출한다', async () => {
    const error404 = new ApiRequestError(404, 'NOT_FOUND', 'not found');
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: error404 }),
    );
    renderPage();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Pack을 찾을 수 없습니다.'),
    );
  });

  it('packDetail 404 에러 시 "다시 시도" 버튼을 표시하지 않는다', () => {
    const error404 = new ApiRequestError(404, 'NOT_FOUND', 'not found');
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: error404 }),
    );
    renderPage();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
