import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConsultationPage } from './ConsultationPage';
import { consultationApi } from '../../../features/consultation/api/consultationApi';

const shellContext = {
  setTopbarRight: vi.fn(),
  setCrumbs: vi.fn(),
  workspace: null,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => shellContext,
  };
});

vi.mock('../../../features/consultation/api/consultationApi', () => ({
  consultationApi: {
    getQueue: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          status: 'OPEN',
          channel: '카카오톡',
          metaJson: JSON.stringify({ customerName: '김민지', handoffReason: '환불 문의' }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        },
      ]),
    ),
    getMessages: vi.fn(() =>
      Promise.resolve([
        {
          id: 100,
          seqNo: 1,
          senderRole: 'CUSTOMER',
          messageType: 'TEXT',
          content: '환불 문의 드립니다.',
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
    sendMessage: vi.fn(() =>
      Promise.resolve({
        id: 99,
        seqNo: 1,
        senderRole: 'AGENT',
        messageType: 'TEXT',
        content: 'test',
        createdAt: new Date().toISOString(),
      }),
    ),
    updateStatus: vi.fn(() => Promise.resolve({})),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ConsultationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders 3-pane structure with QueuePanel, ChatPanel, and CustomerPanel', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    expect(screen.getByText('대기 고객')).toBeInTheDocument();
    expect(screen.getByText('좌측 대기 목록에서 고객을 선택해주세요')).toBeInTheDocument();
    expect(screen.getByText('고객을 선택하면 정보가 표시됩니다')).toBeInTheDocument();
  });

  it('shows customer banner with AI classification after selecting a customer', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText('AI가 분류한 주제')).toBeInTheDocument();
    });

    expect(screen.getByText('카드 환불 — 부분환불')).toBeInTheDocument();
    expect(screen.getByText('상담 종료')).toBeInTheDocument();
  });

  it('renders AI suggest strip with 3 pills when customer is active', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText('추천 답변')).toBeInTheDocument();
    });

    expect(screen.getByText('부분환불 가능합니다')).toBeInTheDocument();
    expect(screen.getByText('환불 처리 중입니다')).toBeInTheDocument();
    expect(screen.getByText('카드사 확인이 필요합니다')).toBeInTheDocument();
  });

  it('ends session when 상담 종료 is clicked', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText('상담 종료')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('상담 종료'));

    await waitFor(() => {
      expect(consultationApi.updateStatus).toHaveBeenCalledWith(1, 'COMPLETED');
    });

    expect(screen.queryByText('AI가 분류한 주제')).not.toBeInTheDocument();
  });

  it('cleans up topbar and crumbs on unmount', () => {
    const { unmount } = render(<ConsultationPage />, { wrapper: Wrapper });
    unmount();
    expect(shellContext.setTopbarRight).toHaveBeenCalledWith(undefined);
    expect(shellContext.setCrumbs).toHaveBeenCalledWith([]);
  });

  it('shows MessageDetailPanel when a message is clicked and hides it on close', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText('환불 문의 드립니다.')).toBeInTheDocument();
    });

    const messageEl = screen.getByText('환불 문의 드립니다.');
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText('가격 문의')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('닫기'));

    await waitFor(() => {
      expect(screen.getByText('고객 정보')).toBeInTheDocument();
    });
  });

  it('deselects message when the same message is clicked again', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText('환불 문의 드립니다.')).toBeInTheDocument();
    });

    const messageEl = screen.getByText('환불 문의 드립니다.');
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText('가격 문의')).toBeInTheDocument();
    });

    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText('고객 정보')).toBeInTheDocument();
    });
  });

  it('opens detail panel with Enter key and closes on re-Enter', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText('환불 문의 드립니다.')).toBeInTheDocument();
    });

    const messageEl = screen.getByText('환불 문의 드립니다.');
    fireEvent.keyDown(messageEl, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('가격 문의')).toBeInTheDocument();
    });

    fireEvent.keyDown(messageEl, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('고객 정보')).toBeInTheDocument();
    });
  });

  it('opens detail panel with Space key', async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('김민지')).toBeInTheDocument();
    });

    const customerItem = screen.getByText('김민지').closest('div');
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText('환불 문의 드립니다.')).toBeInTheDocument();
    });

    const messageEl = screen.getByText('환불 문의 드립니다.');
    fireEvent.keyDown(messageEl, { key: ' ' });

    await waitFor(() => {
      expect(screen.getByText('가격 문의')).toBeInTheDocument();
    });
  });
});
