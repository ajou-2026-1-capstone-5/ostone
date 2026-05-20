import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OstoneShell } from './OstoneShell';

vi.mock('@/shared/ui/ostone/chrome/useSidebarTreeData', () => ({
  useSidebarTreeData: () => ({ loading: false, error: null, packs: [] }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('OstoneShell', () => {
  it('renders Sidebar with the new top nav items (workflows lives under Domain Packs, not top-level)', () => {
    render(
      <OstoneShell active="consult" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.queryByTitle('Operator')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Pipeline')).not.toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Uploads')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
    expect(screen.queryByTitle('Workflows')).not.toBeInTheDocument();
  });

  it('renders Topbar with OSTONE eyebrow', () => {
    render(
      <OstoneShell active="workflows" crumbs={['CARD-CS', 'Domain Packs']}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('OSTONE')).toBeInTheDocument();
    expect(screen.getByText('CARD-CS')).toBeInTheDocument();
    expect(screen.getByText('Domain Packs')).toBeInTheDocument();
  });

  it('renders children in main area', () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div data-testid="shell-child">Hello Shell</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId('shell-child')).toBeInTheDocument();
  });

  it('starts collapsed by default', () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'true');
  });

  it('collapsed 시 nav 배경 클릭으로 펼쳐지고 localStorage에 저장되며, expanded 후엔 접기 버튼이 동작한다', () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    const nav = screen.getByLabelText('주요 내비게이션');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    fireEvent.click(nav);
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'false');
    expect(window.localStorage.getItem('ostone:sidebar:collapsed')).toBe('false');
    fireEvent.click(screen.getByLabelText('사이드바 접기'));
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'true');
  });

  it('localStorage에 false가 저장돼 있으면 expanded로 시작한다', () => {
    window.localStorage.setItem('ostone:sidebar:collapsed', 'false');
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'false');
  });

  it('renders dark variant', () => {
    render(
      <OstoneShell active="consult" crumbs={[]} dark>
        <div>dark</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('treeOverride prop으로 트리 데이터를 직접 주입할 수 있다', () => {
    render(
      <OstoneShell
        active="domain"
        crumbs={[]}
        treeOverride={{
          loading: false,
          error: null,
          packs: [{ packId: 7, name: 'Injected', versionId: 9, workflows: [] }],
        }}
      >
        <div>x</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByLabelText('주요 내비게이션'));
    expect(screen.getByText('Injected')).toBeInTheDocument();
  });
});
