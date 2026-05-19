import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar, type SidebarTreeData } from './Sidebar';

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const defaults: SidebarProps = {
    active: 'operator',
    collapsed: true,
    onToggleCollapsed: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <Sidebar {...defaults} {...props} />
    </MemoryRouter>,
  );
}

const TREE_FIXTURE: SidebarTreeData = {
  loading: false,
  error: null,
  packs: [
    {
      packId: 11,
      name: 'CS Support',
      versionId: 22,
      workflows: [
        { id: 100, name: '환불 처리' },
        { id: 101, name: '배송 지연' },
      ],
    },
    {
      packId: 12,
      name: 'Billing',
      versionId: 30,
      workflows: [{ id: 200, name: '카드 변경' }],
    },
  ],
};

describe('Sidebar', () => {
  it('collapsed 모드에서는 width 56px과 아이콘 항목을 표시한다 (Workflows 최상위 항목 없음)', () => {
    renderSidebar({ collapsed: true });
    const nav = screen.getByLabelText('주요 내비게이션');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(nav).toHaveStyle({ width: '56px' });
    expect(screen.getByTitle('Operator')).toBeInTheDocument();
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Uploads')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
    expect(screen.queryByTitle('Workflows')).not.toBeInTheDocument();
  });

  it('expanded 모드에서는 width 240px이고 Domain Packs는 토글 버튼이다 (별도 section label 없음)', () => {
    renderSidebar({ collapsed: false });
    const nav = screen.getByLabelText('주요 내비게이션');
    expect(nav).toHaveAttribute('data-collapsed', 'false');
    expect(nav).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('sidebar-domain-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-section-label')).not.toBeInTheDocument();
  });

  it('expanded 모드에서 Workflows 최상위 항목이 없다', () => {
    renderSidebar({ collapsed: false });
    expect(screen.queryByTitle('Workflows')).not.toBeInTheDocument();
  });

  it('토글 버튼 클릭 시 onToggleCollapsed가 호출된다', () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapsed });
    fireEvent.click(screen.getByLabelText('사이드바 펼치기'));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('active=operator일 때 Operator 항목이 강조된다', () => {
    renderSidebar({ active: 'operator', collapsed: true });
    expect(screen.getByTitle('Operator')).toHaveAttribute('data-active', 'true');
  });

  it('Domain Packs 토글이 기본은 active 상태에 따라 펼쳐진다 (active=domain → open)', () => {
    renderSidebar({ collapsed: false, active: 'domain', tree: TREE_FIXTURE });
    const toggle = screen.getByTestId('sidebar-domain-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('sidebar-tree')).toBeInTheDocument();
  });

  it('Domain Packs 토글이 기본은 active=operator이면 닫혀 있다가 클릭 시 열린다', () => {
    renderSidebar({ collapsed: false, active: 'operator', tree: TREE_FIXTURE });
    const toggle = screen.getByTestId('sidebar-domain-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sidebar-tree')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('sidebar-tree')).toBeInTheDocument();
  });

  it('tree.loading=true이면 loading placeholder를 렌더한다', () => {
    renderSidebar({
      collapsed: false,
      active: 'domain',
      tree: { loading: true, error: null, packs: [] },
    });
    expect(screen.getByTestId('sidebar-tree-loading')).toBeInTheDocument();
  });

  it('tree.error가 있으면 에러 메시지를 렌더한다', () => {
    renderSidebar({
      collapsed: false,
      active: 'domain',
      tree: { loading: false, error: 'oops', packs: [] },
    });
    expect(screen.getByTestId('sidebar-tree-error')).toBeInTheDocument();
  });

  it('tree.packs가 비어 있으면 empty 메시지를 렌더한다', () => {
    renderSidebar({
      collapsed: false,
      active: 'domain',
      tree: { loading: false, error: null, packs: [] },
    });
    expect(screen.getByTestId('sidebar-tree-empty')).toBeInTheDocument();
  });

  it('tree.packs가 있을 때 pack 이름을 렌더한다', () => {
    renderSidebar({ collapsed: false, active: 'domain', tree: TREE_FIXTURE });
    expect(screen.getByText('CS Support')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('pack을 펼치면 5개 카테고리가 NavLink로 노출되고 Workflows 카테고리는 "All Workflows"로 표시된다', () => {
    renderSidebar({ collapsed: false, active: 'domain', tree: TREE_FIXTURE });
    fireEvent.click(screen.getByText('CS Support'));
    expect(screen.getByTestId('sidebar-cat-11-intents')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-slots')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-policies')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-risks')).toBeInTheDocument();
    const workflowsLink = screen.getByTestId('sidebar-cat-11-workflows');
    expect(workflowsLink).toBeInTheDocument();
    expect(workflowsLink).toHaveTextContent('All Workflows');
    expect(workflowsLink.tagName).toBe('A');
  });

  it('All Workflows가 active일 때 워크플로우 리스트가 자동으로 그 아래에 표시된다', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: 'workflows',
    });
    expect(screen.getByTestId('sidebar-workflows-list-11')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-workflow-100')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-workflow-101')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-workflows-list-12')).not.toBeInTheDocument();
  });

  it('다른 카테고리가 active면 워크플로우 리스트는 표시되지 않는다', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: 'intent',
    });
    expect(screen.queryByTestId('sidebar-workflows-list-11')).not.toBeInTheDocument();
  });

  it('All Workflows active이지만 해당 pack에 워크플로우가 없으면 안내를 표시한다', () => {
    const tree: SidebarTreeData = {
      loading: false,
      error: null,
      packs: [{ packId: 77, name: 'Empty', versionId: 5, workflows: [] }],
    };
    renderSidebar({
      collapsed: false,
      tree,
      activePackId: 77,
      active: 'workflows',
    });
    expect(screen.getByTestId('sidebar-workflows-empty-77')).toBeInTheDocument();
  });

  it('activeWorkflowId 일치 시 해당 워크플로우 링크가 강조된다', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      activeWorkflowId: 100,
      active: 'workflows',
    });
    const wfLink = screen.getByTestId('sidebar-workflow-100');
    expect(wfLink.getAttribute('style') ?? '').toContain('var(--signal)');
  });

  it('versionId가 null이면 카테고리 링크가 pack base 경로로 fallback한다', () => {
    const tree: SidebarTreeData = {
      loading: false,
      error: null,
      packs: [{ packId: 99, name: 'Empty', versionId: null, workflows: [] }],
    };
    renderSidebar({ collapsed: false, active: 'domain', tree });
    fireEvent.click(screen.getByText('Empty'));
    const intentsCat = screen.getByTestId('sidebar-cat-99-intents');
    expect(intentsCat).toHaveAttribute('href', '/workspaces/domain-packs/99');
  });

  it('basePath prop을 지정하면 링크에 반영된다', () => {
    renderSidebar({ collapsed: true, basePath: '/workspaces/7' });
    const opLink = screen.getByTitle('Operator');
    expect(opLink).toHaveAttribute('href', '/workspaces/7/chat-demo');
    const domainLink = screen.getByTitle('Domain Packs');
    expect(domainLink).toHaveAttribute('href', '/workspaces/7/domain-packs');
  });

  it('switcher가 주어지면 렌더링된다', () => {
    const switcher = <div data-testid="switcher">Switch</div>;
    renderSidebar({ switcher });
    expect(screen.getByTestId('switcher')).toBeInTheDocument();
  });

  it('inactive 항목에 mouseEnter/Leave 시 배경이 토글된다', () => {
    renderSidebar({ active: 'operator', collapsed: true });
    const link = screen.getByTitle('Pipeline') as HTMLElement;
    fireEvent.mouseEnter(link);
    expect(link.style.background).toBe('var(--paper-3)');
    fireEvent.mouseLeave(link);
    expect(link.style.background).toBe('transparent');
  });

  it('Domain Packs 토글 active 시 inactive 카테고리(intent)에 대한 강조 분리', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: 'intent',
    });
    const intentsCat = screen.getByTestId('sidebar-cat-11-intents');
    expect(intentsCat.getAttribute('style') ?? '').toContain('var(--signal)');
    const slotsCat = screen.getByTestId('sidebar-cat-11-slots');
    expect(slotsCat.getAttribute('style') ?? '').not.toContain('var(--signal)');
  });
});
