import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import * as previewLists from '../model/usePreviewLists';
import { ComponentCountGrid } from './ComponentCountGrid';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../model/usePreviewLists', () => ({
  useIntentPreview: vi.fn(),
  useSlotPreview: vi.fn(),
  usePolicyPreview: vi.fn(),
  useRiskPreview: vi.fn(),
  useWorkflowPreview: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHook(overrides: Record<string, unknown> = {}): any {
  return { data: undefined, isLoading: false, isError: false, error: null, ...overrides };
}

const defaultProps = {
  wsId: 1,
  packId: 2,
  versionId: 3,
  intentCount: 2,
  slotCount: 3,
  policyCount: 1,
  riskCount: 0,
  workflowCount: 4,
};

describe('ComponentCountGrid', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.usePolicyPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useRiskPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook());
  });

  it('카드 레이블과 카운트를 렌더링한다', () => {
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText('Intent')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('disabled 카드는 "준비 중" 안내를 4개 표시한다', () => {
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getAllByText('준비 중')).toHaveLength(4);
  });

  it('로딩 중일 때 스켈레톤을 렌더링한다', () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook({ isLoading: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('intent isError 시 toast.error를 호출한다', async () => {
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Intent 미리보기 로드 실패'),
    );
  });

  it('slot isError 시 toast.error를 호출한다', async () => {
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Slot 미리보기 로드 실패'),
    );
  });

  it('workflow isError 시 toast.error를 호출한다', async () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Workflow 미리보기 로드 실패'),
    );
  });

  it('workflow previewItems가 있으면 이름 목록을 렌더링한다', () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: 'wf-alpha' }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText('wf-alpha')).toBeInTheDocument();
  });

  it('workflow 미리보기 항목 클릭 시 해당 id로 navigate를 호출한다', () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: 'wf-alpha' }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByText('wf-alpha'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/workspaces/1/domain-packs/2/versions/3/workflows/10',
    );
  });

  it('intent previewNames가 있으면 이름 목록을 렌더링한다', () => {
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(
      makeHook({ data: [{ name: 'intent-1' }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText('intent-1')).toBeInTheDocument();
  });

  it('workflow 미리보기 항목에서 Enter 키 입력 시 해당 id로 navigate를 호출한다', () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: 'wf-alpha' }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.keyDown(screen.getByText('wf-alpha'), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/workspaces/1/domain-packs/2/versions/3/workflows/10',
    );
  });

  it('workflow 미리보기 항목에서 Space 키 입력 시 해당 id로 navigate를 호출한다', () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: 'wf-alpha' }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.keyDown(screen.getByText('wf-alpha'), { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/workspaces/1/domain-packs/2/versions/3/workflows/10',
    );
  });
});
