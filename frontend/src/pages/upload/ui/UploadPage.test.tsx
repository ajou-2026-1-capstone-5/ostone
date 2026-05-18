import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UploadPage } from './UploadPage';

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

function renderUploadPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UploadPage />
    </QueryClientProvider>,
  );
}

describe('UploadPage', () => {
  it('renders hero h1 with expected text', () => {
    renderUploadPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('상담 로그');
    expect(h1).toHaveTextContent('도메인 팩 초안');
  });

  it('renders dropzone with upload prompt', () => {
    renderUploadPage();
    expect(screen.getByText('파일을 드래그하거나 클릭하세요')).toBeInTheDocument();
  });

  it('renders datasets table with 5 or more rows', () => {
    renderUploadPage();
    const rows = screen.getAllByText(/\.jsonl|\.csv|\.parquet/);
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('renders 4 quality issues', () => {
    renderUploadPage();
    expect(screen.getByText('intent_023')).toBeInTheDocument();
    expect(screen.getByText('slot_007')).toBeInTheDocument();
    expect(screen.getByText('policy_004')).toBeInTheDocument();
    expect(screen.getByText('risk_001')).toBeInTheDocument();
  });
});
