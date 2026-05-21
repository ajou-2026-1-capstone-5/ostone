import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useSidebarTreeData } from "./useSidebarTreeData";

vi.mock(
  "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller")
    >("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller");
    return {
      ...actual,
      listDomainPacks: vi.fn(),
      getDomainPack: vi.fn(),
    };
  },
);

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller")
    >(
      "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
    );
    return {
      ...actual,
      listWorkflows: vi.fn(),
    };
  },
);

import {
  getDomainPack,
  listDomainPacks,
} from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import { listWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

const mockedListDomainPacks = vi.mocked(listDomainPacks);
const mockedGetDomainPack = vi.mocked(getDomainPack);
const mockedListWorkflows = vi.mocked(listWorkflows);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedListDomainPacks.mockReset();
  mockedGetDomainPack.mockReset();
  mockedListWorkflows.mockReset();
});

describe("useSidebarTreeData", () => {
  it("enabled=false면 호출하지 않고 빈 트리를 반환한다", async () => {
    const { result } = renderHook(() => useSidebarTreeData({ workspaceId: 1, enabled: false }), {
      wrapper,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.packs).toEqual([]);
    expect(mockedListDomainPacks).not.toHaveBeenCalled();
  });

  it("workspaceId가 null이면 호출하지 않는다", async () => {
    const { result } = renderHook(() => useSidebarTreeData({ workspaceId: null, enabled: true }), {
      wrapper,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.packs).toEqual([]);
    expect(mockedListDomainPacks).not.toHaveBeenCalled();
  });

  it("packs/versions/workflows를 조합해 트리를 구성한다", async () => {
    mockedListDomainPacks.mockResolvedValue({
      data: [
        { packId: 11, name: "CS Support" },
        { packId: 12, name: "Billing" },
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
            { id: 100, name: "환불 처리" },
            { id: 101, workflowCode: "shipping.delay" },
          ],
        }) as never;
      }
      if (packId === 12 && versionId === 80) {
        return Promise.resolve({
          data: [{ id: 200, name: "카드 변경" }],
        }) as never;
      }
      return Promise.resolve({ data: [] }) as never;
    });

    const { result } = renderHook(() => useSidebarTreeData({ workspaceId: 1, enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.packs).toHaveLength(2);

    const cs = result.current.packs.find((p) => p.packId === 11)!;
    expect(cs.name).toBe("CS Support");
    expect(cs.versionId).toBe(51);
    expect(cs.workflows.map((w) => w.id)).toEqual([100, 101]);
    expect(cs.workflows[1].name).toBe("shipping.delay");

    const billing = result.current.packs.find((p) => p.packId === 12)!;
    expect(billing.versionId).toBe(80);
    expect(billing.workflows[0].name).toBe("카드 변경");
  });

  it("versions가 없는 pack은 versionId=null로 두고 workflows를 호출하지 않는다", async () => {
    mockedListDomainPacks.mockResolvedValue({
      data: [{ packId: 99, name: "Empty" }],
    } as never);
    mockedGetDomainPack.mockResolvedValue({
      data: { packId: 99, versions: [] },
    } as never);

    const { result } = renderHook(() => useSidebarTreeData({ workspaceId: 1, enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.packs[0]).toEqual({
      packId: 99,
      name: "Empty",
      versionId: null,
      workflows: [],
    });
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it("listDomainPacks 실패 시 error 메시지를 반환한다", async () => {
    mockedListDomainPacks.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSidebarTreeData({ workspaceId: 1, enabled: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe("도메인팩 목록 조회 실패");
  });
});
