import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@/shared/api';

const useListWorkspaces = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-to">{to}</div>,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/shared/api/generated/endpoints/workspace-controller/workspace-controller', () => ({
  useListWorkspaces: () => useListWorkspaces(),
}));

vi.mock('@/shared/ui/spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@/features/workspace', () => ({
  CreateWorkspaceDialog: ({ open, onSuccess }: { open: boolean; onSuccess: (created: { id: number }) => void }) => (
    open ? <div data-testid="create-dialog">
      <button type="button" onClick={() => onSuccess({ id: 999 })}>생성 완료</button>
    </div> : null
  ),
}));

import { WorkspaceRootRedirect } from './WorkspaceRootRedirect';

function renderPage() {
  render(
    <MemoryRouter>
      <WorkspaceRootRedirect />
    </MemoryRouter>,
  );
}

describe('WorkspaceRootRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로딩 중 Spinner를 표시한다', () => {
    useListWorkspaces.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('401 에러 시 /login으로 리다이렉트한다', () => {
    useListWorkspaces.mockReturnValue({
      data: undefined,
      error: new ApiRequestError(401, 'UNAUTHORIZED', '인증이 필요합니다.'),
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.getByTestId('navigate-to')).toHaveTextContent('/login');
  });

  it('403 에러 시 /login으로 리다이렉트하지 않는다', () => {
    useListWorkspaces.mockReturnValue({
      data: undefined,
      error: new ApiRequestError(403, 'FORBIDDEN', '권한이 없습니다.'),
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.queryByTestId('navigate-to')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('워크스페이스 정보를 불러오지 못했습니다.');
  });

  it('network error 시 /login으로 리다이렉트하지 않는다', () => {
    useListWorkspaces.mockReturnValue({
      data: undefined,
      error: new Error('network error'),
      isLoading: false,
      isError: true,
    });
    renderPage();
    expect(screen.queryByTestId('navigate-to')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('워크스페이스 정보를 불러오지 못했습니다.');
  });

  it('워크스페이스가 없으면 CreateWorkspaceDialog를 표시한다', () => {
    useListWorkspaces.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderPage();
    expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
  });

  it('ACTIVE 워크스페이스가 있으면 첫 ACTIVE 워크스페이스로 리다이렉트한다', () => {
    useListWorkspaces.mockReturnValue({
      data: [
        { id: 1, name: 'WS 1', status: 'ACTIVE' },
        { id: 2, name: 'WS 2', status: 'ARCHIVED' },
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByTestId('navigate-to')).toHaveTextContent('/workspaces/1/workflows');
  });

  it('ACTIVE 워크스페이스가 없으면 첫 워크스페이스로 리다이렉트한다', () => {
    useListWorkspaces.mockReturnValue({
      data: [
        { id: 3, name: 'WS 3', status: 'ARCHIVED' },
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByTestId('navigate-to')).toHaveTextContent('/workspaces/3/workflows');
  });

  it('CreateWorkspaceDialog onSuccess가 navigate를 호출한다', () => {
    useListWorkspaces.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderPage();
    const createBtn = screen.getByText('생성 완료');
    createBtn.click();
    expect(mockNavigate).toHaveBeenCalledWith('/workspaces/999/workflows', { replace: true });
  });
});
