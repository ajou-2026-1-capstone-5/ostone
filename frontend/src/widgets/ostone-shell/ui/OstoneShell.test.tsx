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
  it('renders Sidebar with the new top nav items', () => {
    render(
      <OstoneShell active="consult" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByTitle('Operator')).toBeInTheDocument();
    expect(screen.getByTitle('Workflows')).toBeInTheDocument();
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Uploads')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
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

  it('토글 버튼 클릭 시 collapsed 상태가 토글되고 localStorage에 저장된다', () => {
    render(
      <OstoneShell active="workflows" crumbs={[]}>
        <div>content</div>
      </OstoneShell>,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'true');
    fireEvent.click(screen.getByLabelText('사이드바 펼치기'));
    expect(screen.getByLabelText('주요 내비게이션')).toHaveAttribute('data-collapsed', 'false');
    expect(window.localStorage.getItem('ostone:sidebar:collapsed')).toBe('false');
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
    fireEvent.click(screen.getByLabelText('사이드바 펼치기'));
    expect(screen.getByText('Injected')).toBeInTheDocument();
  });
});
