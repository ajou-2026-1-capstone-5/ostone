import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkspaceWorkflowsPage } from './WorkspaceWorkflowsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockHook = vi.fn();
vi.mock('@/entities/workflow', () => ({
  useListAllWorkspaceWorkflows: (...args: unknown[]) => mockHook(...args),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

function renderPage(path = '/workspaces/1/workflows') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/workflows" element={<WorkspaceWorkflowsPage />} />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockHook.mockReset();
});

describe('WorkspaceWorkflowsPage', () => {
  it('잘못된 workspaceId면 /workspaces로 리다이렉트한다', () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage('/workspaces/abc/workflows');
    expect(screen.getByTestId('workspace-root')).toBeInTheDocument();
  });

  it('loading 상태에서는 loading panel을 보여준다', () => {
    mockHook.mockReturnValue({ loading: true, error: null, entries: [] });
    renderPage();
    expect(screen.getByTestId('workspace-workflows-loading')).toBeInTheDocument();
  });

  it('error 상태에서는 ErrorState를 보여준다', () => {
    mockHook.mockReturnValue({ loading: false, error: '워크플로우 목록 조회 실패', entries: [] });
    renderPage();
    expect(screen.getByTestId('workspace-workflows-error')).toBeInTheDocument();
    expect(screen.getByText('워크플로우 목록 조회 실패')).toBeInTheDocument();
  });

  it('entries 비어 있으면 empty state를 보여준다', () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage();
    expect(screen.getByTestId('workspace-workflows-empty')).toBeInTheDocument();
  });

  it('entries가 있으면 카드별로 렌더링한다', () => {
    mockHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 11,
          packName: 'CS Support',
          versionId: 22,
          workflowId: 100,
          workflowCode: 'refund.standard',
          name: '환불 처리',
          description: 'desc',
        },
        {
          packId: 12,
          packName: 'Billing',
          versionId: 30,
          workflowId: 200,
          workflowCode: null,
          name: '카드 변경',
          description: null,
        },
      ],
    });
    renderPage();
    expect(screen.getByTestId('workflow-card-100')).toBeInTheDocument();
    expect(screen.getByText('환불 처리')).toBeInTheDocument();
    expect(screen.getByText('refund.standard')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-card-200')).toBeInTheDocument();
    expect(screen.getByText('카드 변경')).toBeInTheDocument();
  });

  it('카드 클릭 시 실제 packId/versionId/workflowId 경로로 navigate한다', () => {
    mockHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 11,
          packName: 'CS Support',
          versionId: 22,
          workflowId: 100,
          workflowCode: null,
          name: '환불 처리',
          description: null,
        },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByTestId('workflow-card-100'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/workspaces/1/domain-packs/11/versions/22/workflows/100',
    );
  });

  it('카드에서 Enter 키 입력 시에도 navigate한다', () => {
    mockHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 11,
          packName: 'CS Support',
          versionId: 22,
          workflowId: 100,
          workflowCode: null,
          name: '환불 처리',
          description: null,
        },
      ],
    });
    renderPage();
    fireEvent.keyDown(screen.getByTestId('workflow-card-100'), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/workspaces/1/domain-packs/11/versions/22/workflows/100',
    );
  });

  it('새 워크플로우 버튼 클릭 시 toast 호출', async () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    const sonner = await import('sonner');
    renderPage();
    fireEvent.click(screen.getByText('새 워크플로우'));
    expect(sonner.toast).toHaveBeenCalledWith('준비 중입니다');
  });
});
