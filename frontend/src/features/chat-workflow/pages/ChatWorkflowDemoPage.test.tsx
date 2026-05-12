import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatWorkflowDemoPage } from './ChatWorkflowDemoPage';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('ChatWorkflowDemoPage', () => {
  it('renders header with domain pack info', () => {
    const domainPack = { name: '커머스 배송 문의 팩', version: '1.2.0', publishedAt: '2026-05-10T12:00:00.000Z' };
    const scenario = { name: '배송 상태 확인', description: '배송 진행 상태를 안내하는 시나리오' };
    render(
      <ChatWorkflowDemoPage
        domainPack={domainPack}
        scenario={scenario}
        messages={[]}
        workflow={{ currentNodeId: null, status: 'idle', context: {} }}
        decisionLog={[]}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('커머스 배송 문의 팩')).toBeInTheDocument();
  });

  it('renders timeline panel', () => {
    render(
      <ChatWorkflowDemoPage
        domainPack={null}
        scenario={null}
        messages={[]}
        workflow={{ currentNodeId: null, status: 'idle', context: {} }}
        decisionLog={[]}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Chat Timeline')).toBeInTheDocument();
  });

  it('renders graph panel', () => {
    render(
      <ChatWorkflowDemoPage
        domainPack={null}
        scenario={null}
        messages={[]}
        workflow={{ currentNodeId: null, status: 'idle', context: {} }}
        decisionLog={[]}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Workflow Graph')).toBeInTheDocument();
  });

  it('renders execution panel', () => {
    render(
      <ChatWorkflowDemoPage
        domainPack={null}
        scenario={null}
        messages={[]}
        workflow={{ currentNodeId: null, status: 'idle', context: {} }}
        decisionLog={[]}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Execution Detail')).toBeInTheDocument();
  });

  it('renders decision log trigger', () => {
    render(
      <ChatWorkflowDemoPage
        domainPack={null}
        scenario={null}
        messages={[]}
        workflow={{ currentNodeId: null, status: 'idle', context: {} }}
        decisionLog={[]}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByRole('button', { name: /decision log/i })).toBeInTheDocument();
  });
});
