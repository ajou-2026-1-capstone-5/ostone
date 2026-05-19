import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar, type SidebarTreeData } from './Sidebar';

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const defaults: SidebarProps = {
    active: 'workflows',
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
  it('collapsed 모드에서는 width 56px과 아이콘 항목을 표시한다', () => {
    renderSidebar({ collapsed: true });
    const nav = screen.getByLabelText('주요 내비게이션');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(nav).toHaveStyle({ width: '56px' });
    expect(screen.getByTitle('Operator')).toBeInTheDocument();
    expect(screen.getByTitle('Workflows')).toBeInTheDocument();
    expect(screen.getByTitle('Pipeline')).toBeInTheDocument();
    expect(screen.getByTitle('Consultation')).toBeInTheDocument();
    expect(screen.getByTitle('Uploads')).toBeInTheDocument();
    expect(screen.getByTitle('Domain Packs')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-section-label')).not.toBeInTheDocument();
  });

  it('expanded 모드에서는 width 240px과 Domain Packs 섹션 라벨을 표시한다', () => {
    renderSidebar({ collapsed: false });
    const nav = screen.getByLabelText('주요 내비게이션');
    expect(nav).toHaveAttribute('data-collapsed', 'false');
    expect(nav).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('sidebar-section-label')).toHaveTextContent(/Domain Packs/i);
  });

  it('토글 버튼 클릭 시 onToggleCollapsed가 호출된다', () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapsed });
    fireEvent.click(screen.getByLabelText('사이드바 펼치기'));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('expanded 모드에서도 토글 버튼이 동작한다', () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapsed });
    fireEvent.click(screen.getByLabelText('사이드바 접기'));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('active=operator일 때 Operator 항목이 강조된다', () => {
    renderSidebar({ active: 'operator', collapsed: true });
    expect(screen.getByTitle('Operator')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTitle('Workflows')).toHaveAttribute('data-active', 'false');
  });

  it('각 active 값에 대해 정확한 항목이 강조된다', () => {
    const cases: Array<[SidebarProps['active'], string]> = [
      ['operator', 'Operator'],
      ['workflows', 'Workflows'],
      ['pipeline', 'Pipeline'],
      ['consult', 'Consultation'],
      ['upload', 'Uploads'],
      ['domain', 'Domain Packs'],
    ];
    for (const [active, label] of cases) {
      const { unmount } = renderSidebar({ active, collapsed: true });
      expect(screen.getByTitle(label)).toHaveAttribute('data-active', 'true');
      unmount();
    }
  });

  it('inactive 항목에 mouseEnter/Leave 시 배경이 토글된다', () => {
    renderSidebar({ active: 'domain', collapsed: true });
    const link = screen.getByTitle('Workflows') as HTMLElement;
    fireEvent.mouseEnter(link);
    expect(link.style.background).toBe('var(--paper-3)');
    fireEvent.mouseLeave(link);
    expect(link.style.background).toBe('transparent');
  });

  it('switcher가 주어지면 렌더링된다', () => {
    const switcher = <div data-testid="switcher">Switch</div>;
    renderSidebar({ switcher });
    expect(screen.getByTestId('switcher')).toBeInTheDocument();
  });

  it('tree.loading=true이면 loading placeholder를 렌더한다', () => {
    renderSidebar({ collapsed: false, tree: { loading: true, error: null, packs: [] } });
    expect(screen.getByTestId('sidebar-tree-loading')).toBeInTheDocument();
  });

  it('tree.error가 있으면 에러 메시지를 렌더한다', () => {
    renderSidebar({ collapsed: false, tree: { loading: false, error: 'oops', packs: [] } });
    expect(screen.getByTestId('sidebar-tree-error')).toBeInTheDocument();
  });

  it('tree.packs가 비어 있으면 empty 메시지를 렌더한다', () => {
    renderSidebar({ collapsed: false, tree: { loading: false, error: null, packs: [] } });
    expect(screen.getByTestId('sidebar-tree-empty')).toBeInTheDocument();
  });

  it('tree.packs가 있을 때 pack 이름을 렌더한다', () => {
    renderSidebar({ collapsed: false, tree: TREE_FIXTURE });
    expect(screen.getByText('CS Support')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('pack을 펼치면 5개 카테고리가 모두 노출된다', () => {
    renderSidebar({ collapsed: false, tree: TREE_FIXTURE });
    fireEvent.click(screen.getByText('CS Support'));
    expect(screen.getByTestId('sidebar-cat-11-intents')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-slots')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-policies')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-risks')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-cat-11-workflows')).toBeInTheDocument();
  });

  it('Workflows 카테고리를 펼치면 개별 워크플로우가 노출된다', () => {
    renderSidebar({ collapsed: false, tree: TREE_FIXTURE });
    fireEvent.click(screen.getByText('CS Support'));
    fireEvent.click(screen.getByTestId('sidebar-cat-11-workflows'));
    expect(screen.getByTestId('sidebar-workflow-100')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-workflow-101')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-workflow-200')).not.toBeInTheDocument();
  });

  it('activePackId 일치 시 해당 pack이 기본 펼쳐진다', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: 'intent',
    });
    expect(screen.getByTestId('sidebar-cat-11-intents')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-cat-12-intents')).not.toBeInTheDocument();
  });

  it('activePackId+active=workflows이면 Workflows 카테고리도 기본 펼쳐진다', () => {
    renderSidebar({
      collapsed: false,
      tree: TREE_FIXTURE,
      activePackId: 11,
      active: 'workflows',
      activeWorkflowId: 100,
    });
    expect(screen.getByTestId('sidebar-workflow-100')).toBeInTheDocument();
  });

  it('versionId가 null이면 카테고리 링크가 pack base 경로로 fallback한다', () => {
    const tree: SidebarTreeData = {
      loading: false,
      error: null,
      packs: [{ packId: 99, name: 'Empty', versionId: null, workflows: [] }],
    };
    renderSidebar({ collapsed: false, tree });
    fireEvent.click(screen.getByText('Empty'));
    const intentsCat = screen.getByTestId('sidebar-cat-99-intents');
    expect(intentsCat).toHaveAttribute('href', '/workspaces/domain-packs/99');
  });

  it('basePath prop을 지정하면 링크에 반영된다', () => {
    renderSidebar({ collapsed: true, basePath: '/workspaces/7' });
    const opLink = screen.getByTitle('Operator');
    expect(opLink).toHaveAttribute('href', '/workspaces/7/chat-demo');
  });
});
