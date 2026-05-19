import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useListAllWorkspaceWorkflows } from './useListAllWorkspaceWorkflows';

vi.mock('@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller')>(
    '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller',
  );
  return {
    ...actual,
    listDomainPacks: vi.fn(),
    getDomainPack: vi.fn(),
  };
});

vi.mock('@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller')>(
    '@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller',
  );
  return {
    ...actual,
    listWorkflows: vi.fn(),
  };
});

import {
  getDomainPack,
  listDomainPacks,
} from '@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller';
import { listWorkflows } from '@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller';

const mockedListDomainPacks = vi.mocked(listDomainPacks);
const mockedGetDomainPack = vi.mocked(getDomainPack);
const mockedListWorkflows = vi.mocked(listWorkflows);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedListDomainPacks.mockReset();
  mockedGetDomainPack.mockReset();
  mockedListWorkflows.mockReset();
});

describe('useListAllWorkspaceWorkflows', () => {
  it('workspaceId가 null이면 호출하지 않고 빈 목록을 반환한다', () => {
    const { result } = renderHook(
      () => useListAllWorkspaceWorkflows({ workspaceId: null }),
      { wrapper },
    );
    expect(result.current.entries).toEqual([]);
    expect(mockedListDomainPacks).not.toHaveBeenCalled();
  });

  it('모든 pack의 latest version 워크플로우를 평면 entry로 반환한다', async () => {
    mockedListDomainPacks.mockResolvedValue({
      data: [
        { packId: 11, name: 'CS Support' },
        { packId: 12, name: 'Billing' },
      ],
    } as never);
    mockedGetDomainPack.mockImplementation((_ws, packId) => {
      if (packId === 11) {
        return Promise.resolve({
          data: {
            packId: 11,
            versions: [
              { versionId: 50, versionNo: 1 },
              { versionId: 51, versionNo: 2 },
            ],
          },
        }) as never;
      }
      return Promise.resolve({
        data: {
          packId: 12,
          versions: [{ versionId: 80, versionNo: 1 }],
        },
      }) as never;
    });
    mockedListWorkflows.mockImplementation((_ws, packId, versionId) => {
      if (packId === 11 && versionId === 51) {
        return Promise.resolve({
          data: [
            { id: 100, name: '환불 처리', workflowCode: 'refund.standard', description: 'desc-1' },
            { id: 101, workflowCode: 'shipping.delay' },
          ],
        }) as never;
      }
      if (packId === 12 && versionId === 80) {
        return Promise.resolve({
          data: [{ id: 200, name: '카드 변경' }],
        }) as never;
      }
      return Promise.resolve({ data: [] }) as never;
    });

    const { result } = renderHook(
      () => useListAllWorkspaceWorkflows({ workspaceId: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.entries).toHaveLength(3);

    const refund = result.current.entries.find((e) => e.workflowId === 100)!;
    expect(refund).toEqual({
      packId: 11,
      packName: 'CS Support',
      versionId: 51,
      workflowId: 100,
      workflowCode: 'refund.standard',
      name: '환불 처리',
      description: 'desc-1',
    });

    const shipping = result.current.entries.find((e) => e.workflowId === 101)!;
    expect(shipping.name).toBe('shipping.delay');

    const cardChange = result.current.entries.find((e) => e.workflowId === 200)!;
    expect(cardChange.packId).toBe(12);
    expect(cardChange.versionId).toBe(80);
  });

  it('version이 없는 pack은 entries에 포함되지 않는다', async () => {
    mockedListDomainPacks.mockResolvedValue({
      data: [{ packId: 99, name: 'Empty' }],
    } as never);
    mockedGetDomainPack.mockResolvedValue({
      data: { packId: 99, versions: [] },
    } as never);

    const { result } = renderHook(
      () => useListAllWorkspaceWorkflows({ workspaceId: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('listDomainPacks 실패 시 에러 메시지를 반환한다', async () => {
    mockedListDomainPacks.mockRejectedValue(new Error('nope'));

    const { result } = renderHook(
      () => useListAllWorkspaceWorkflows({ workspaceId: 1 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('도메인팩 목록 조회 실패');
  });
});
