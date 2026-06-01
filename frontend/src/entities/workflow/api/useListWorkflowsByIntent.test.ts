import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller")
    >("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller");
    return { ...actual, getDomainPack: vi.fn() };
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
    return { ...actual, listWorkflows: vi.fn() };
  },
);

import { getDomainPack } from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import { listWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

import { useListWorkflowsByIntent } from "./useListWorkflowsByIntent";

const mockedGetDomainPack = vi.mocked(getDomainPack);
const mockedListWorkflows = vi.mocked(listWorkflows);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  mockedGetDomainPack.mockReset();
  mockedListWorkflows.mockReset();
});

describe("useListWorkflowsByIntent", () => {
  it("intentDefinitionId가 null이면 호출하지 않는다", () => {
    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: 1,
          packId: 1,
          versionId: 1,
          intentDefinitionId: null,
        }),
      { wrapper },
    );
    expect(result.current.entries).toEqual([]);
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it("workspaceId가 null이면 호출하지 않는다", () => {
    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: null,
          packId: 1,
          versionId: 1,
          intentDefinitionId: 100,
        }),
      { wrapper },
    );
    expect(result.current.entries).toEqual([]);
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it("성공 시 entry 매핑", async () => {
    mockedGetDomainPack.mockResolvedValue({ data: { name: "Pack X" } } as never);
    mockedListWorkflows.mockResolvedValue({
      data: [
        {
          id: 7,
          workflowCode: "wf.x",
          name: "X",
          description: "desc",
          domainPackVersionId: 1,
          intentDefinitionId: 100,
        },
      ],
    } as never);

    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: 1,
          packId: 9,
          versionId: 4,
          intentDefinitionId: 100,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.entries).toEqual([
      {
        packId: 9,
        packName: "Pack X",
        versionId: 4,
        workflowId: 7,
        workflowCode: "wf.x",
        name: "X",
        description: "desc",
        intentDefinitionId: 100,
      },
    ]);
    expect(mockedListWorkflows).toHaveBeenCalledWith(
      1,
      9,
      4,
      { intentDefinitionId: 100 },
      expect.any(Object),
    );
  });

  it("listWorkflows 에러 시 error 메시지", async () => {
    mockedGetDomainPack.mockResolvedValue({ data: { name: "P" } } as never);
    mockedListWorkflows.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: 1,
          packId: 1,
          versionId: 1,
          intentDefinitionId: 100,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe("워크플로우 목록 조회 실패");
  });

  it("workflows 응답이 비어있을 때 빈 entries", async () => {
    mockedGetDomainPack.mockResolvedValue({ data: { name: "P" } } as never);
    mockedListWorkflows.mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: 1,
          packId: 1,
          versionId: 1,
          intentDefinitionId: 100,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it("id가 없는 workflow는 entry에서 제외", async () => {
    mockedGetDomainPack.mockResolvedValue({ data: { name: "P" } } as never);
    mockedListWorkflows.mockResolvedValue({
      data: [{ workflowCode: "no-id" }, { id: 9, name: "ok", intentDefinitionId: 100 }],
    } as never);

    const { result } = renderHook(
      () =>
        useListWorkflowsByIntent({
          workspaceId: 1,
          packId: 1,
          versionId: 1,
          intentDefinitionId: 100,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].workflowId).toBe(9);
  });
});
