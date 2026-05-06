import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConsultationPage } from './ConsultationPage';

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
    getMessages: vi.fn(() => Promise.resolve([])),
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
});
