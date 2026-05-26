import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ApiRequestError } from "@/shared/api";
import { WorkflowDraftReadPage } from "./WorkflowDraftReadPage";

const mockUseGetWorkflowDefinition = vi.fn();
const mockUsePackDetail = vi.fn();
const mockCreateRevisionDraft = vi.fn();
const mockListWorkflows = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/entities/workflow", () => ({
  useGetWorkflowDefinition: (...args: unknown[]) =>
    mockUseGetWorkflowDefinition(...args),
}));

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: (...args: unknown[]) => mockUsePackDetail(...args),
}));

vi.mock("@/features/update-workflow", () => ({
  InlineWorkflowEditor: vi.fn(({ workflow, onClose, onDirtyChange }) => (
    <div data-testid="inline-editor">
      editing {workflow.workflowCode}
      <button
        type="button"
        data-testid="editor-dirty"
        onClick={() => onDirtyChange(true)}
      >
        dirty
      </button>
      <button type="button" data-testid="editor-close" onClick={onClose}>
        close
      </button>
    </div>
  )),
}));

vi.mock("@/features/workflow-viewer/ui/GraphViewer", () => ({
  GraphViewer: vi.fn(({ graph }) => (
    <div data-testid="graph-viewer">graph nodes: {graph.nodes.length}</div>
  )),
}));

vi.mock("@/widgets/ostone-shell", () => ({
  OstoneShell: ({
    children,
    crumbs,
  }: {
    children: React.ReactNode;
    crumbs: string[];
  }) => (
    <div>
      <div data-testid="crumbs">{crumbs.join(" / ")}</div>
      {children}
    </div>
  ),
}));
vi.mock("@/features/intent-revision-draft", () => ({
  intentRevisionDraftApi: {
    createRevisionDraft: (...args: unknown[]) =>
      mockCreateRevisionDraft(...args),
  },
}));
vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    listWorkflows: (...args: unknown[]) => mockListWorkflows(...args),
  }),
);
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const ROUTE =
  "/workspaces/:workspaceId/domain-packs/:packId/workflows/:workflowId?";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function renderPage(path: string, state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: path.split("?")[0],
          search: path.includes("?") ? `?${path.split("?")[1]}` : "",
          state,
        },
      ]}
    >
      <Routes>
        <Route
          path={ROUTE}
          element={
            <>
              <WorkflowDraftReadPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseGetWorkflowDefinition.mockReset();
  mockUsePackDetail.mockReset();
  mockCreateRevisionDraft.mockReset();
  mockListWorkflows.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockUsePackDetail.mockReturnValue({
    data: {
      name: "CS Pack",
      versions: [{ versionId: 3, versionNo: 1, lifecycleStatus: "DRAFT" }],
    },
    refetch: vi.fn().mockResolvedValue({
      data: {
        versions: [{ versionId: 3, versionNo: 1, lifecycleStatus: "DRAFT" }],
      },
    }),
  });
});

describe("WorkflowDraftReadPage", () => {
  it("유효하지 않은 URL 파라미터는 에러 메시지를 보여준다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({ isLoading: false });
    renderPage("/workspaces/abc/domain-packs/2/workflows?versionId=3");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "잘못된 URL 파라미터입니다.",
    );
  });

  it("workflowId가 없으면 좌측 사이드바에서 선택하라는 안내를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({ isLoading: false });
    renderPage("/workspaces/1/domain-packs/2/workflows?versionId=3");
    expect(screen.getByTestId("workflow-select-empty")).toBeInTheDocument();
  });

  it("loading 상태에서는 spinner를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({ isLoading: true });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.getByTestId("workflow-loading")).toBeInTheDocument();
  });

  it("error 상태에서는 ErrorState를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.getByTestId("workflow-error")).toBeInTheDocument();
  });

  it("워크플로우 데이터가 로드되면 헤더에 이름과 노드수를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({
          direction: "LR",
          nodes: [
            { id: "n1", label: "start", type: "START" },
            { id: "n2", label: "end", type: "TERMINAL" },
          ],
          edges: [{ id: "e1", from: "n1", to: "n2" }],
        }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.getByTestId("workflow-detail-title")).toHaveTextContent(
      "환불 처리",
    );
    expect(screen.queryByText("refund.standard")).not.toBeInTheDocument();
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByTestId("graph-viewer")).toHaveTextContent(
      "graph nodes: 2",
    );
  });

  it("graphJson이 없으면 빈 그래프 안내를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { id: 10, name: "환불 처리", workflowCode: "refund.standard" },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.getByTestId("workflow-empty-graph")).toBeInTheDocument();
  });

  it("graphJson이 잘못된 문자열이면 빈 그래프 안내를 표시한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: "not-json",
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.getByTestId("workflow-empty-graph")).toBeInTheDocument();
  });

  it("편집 버튼 클릭 시 InlineWorkflowEditor가 마운트된다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    expect(screen.queryByTestId("inline-editor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("edit-toggle"));
    expect(screen.getByTestId("inline-editor")).toHaveTextContent(
      "editing refund.standard",
    );
    expect(mockCreateRevisionDraft).not.toHaveBeenCalled();
  });

  it("PUBLISHED version에서 편집 버튼 클릭 시 draft 생성 후 복제된 workflow로 이동한다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn().mockResolvedValue({
        data: {
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 4, versionNo: 2, lifecycleStatus: "DRAFT" },
          ],
        },
      }),
    });
    mockCreateRevisionDraft.mockResolvedValue({ draftVersionId: 4 });
    mockListWorkflows.mockResolvedValue({
      data: [{ id: 44, workflowCode: "refund.standard", name: "환불 처리" }],
    });
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2/workflows/44?versionId=4",
      ),
    );
    expect(mockCreateRevisionDraft).toHaveBeenCalledWith(1, 2, 3);
  });

  it("PUBLISHED version에서 workflowCode가 없으면 draft를 만들지 않고 이유를 알린다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn(),
    });
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: null,
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "워크플로우 코드를 확인할 수 없어 수정 초안을 만들 수 없습니다.",
      ),
    );
    expect(mockCreateRevisionDraft).not.toHaveBeenCalled();
    expect(screen.queryByTestId("inline-editor")).not.toBeInTheDocument();
  });

  it("수정 초안에서 같은 workflow를 찾지 못하면 draft workflow 목록으로 이동한다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn().mockResolvedValue({
        data: {
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 4, versionNo: 2, lifecycleStatus: "DRAFT" },
          ],
        },
      }),
    });
    mockCreateRevisionDraft.mockResolvedValue({ draftVersionId: 4 });
    mockListWorkflows.mockResolvedValue({
      data: [{ id: 99, workflowCode: "other.flow", name: "다른 처리" }],
    });
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "수정 초안에서 같은 워크플로우를 찾지 못했습니다.",
      ),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/workspaces/1/domain-packs/2/workflows?versionId=4",
    );
  });

  it("기존 DRAFT가 있으면 기존 Draft 이동 dialog를 표시한다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn().mockResolvedValue({
        data: {
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" },
          ],
        },
      }),
    });
    mockCreateRevisionDraft.mockRejectedValue(
      new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "exists"),
    );
    mockListWorkflows.mockResolvedValue({
      data: [{ id: 55, workflowCode: "refund.standard", name: "환불 처리" }],
    });
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    expect(
      await screen.findByText("진행 중인 Draft가 있습니다"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "기존 Draft로 이동" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2/workflows/55?versionId=5",
      ),
    );
  });

  it("기존 DRAFT 충돌 후 draft version을 하나로 특정하지 못하면 안내 toast를 표시한다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn().mockResolvedValue({
        data: {
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
          ],
        },
      }),
    });
    mockCreateRevisionDraft.mockRejectedValue(
      new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "exists"),
    );
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "진행 중인 Draft를 확인할 수 없습니다. Domain Pack 화면에서 상태를 확인해 주세요.",
      ),
    );
    expect(
      screen.queryByText("진행 중인 Draft가 있습니다"),
    ).not.toBeInTheDocument();
  });

  it("기존 DRAFT 충돌 후 같은 workflow를 찾지 못하면 이동 dialog를 열지 않는다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn().mockResolvedValue({
        data: {
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" },
          ],
        },
      }),
    });
    mockCreateRevisionDraft.mockRejectedValue(
      new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "exists"),
    );
    mockListWorkflows.mockResolvedValue({
      data: [{ id: 55, workflowCode: "other.flow", name: "다른 처리" }],
    });
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "기존 Draft에서 같은 워크플로우를 찾지 못했습니다.",
      ),
    );
    expect(
      screen.queryByText("진행 중인 Draft가 있습니다"),
    ).not.toBeInTheDocument();
  });

  it("기존 DRAFT 충돌 후 pack refetch가 실패하면 에러를 안내하고 dialog를 열지 않는다", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      mockUsePackDetail.mockReturnValue({
        data: {
          name: "CS Pack",
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
          ],
        },
        refetch: vi.fn().mockRejectedValue(new Error("refetch failed")),
      });
      mockCreateRevisionDraft.mockRejectedValue(
        new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "exists"),
      );
      mockUseGetWorkflowDefinition.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          id: 10,
          name: "환불 처리",
          workflowCode: "refund.standard",
          graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
        },
      });

      renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
      fireEvent.click(screen.getByTestId("edit-toggle"));

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("refetch failed"),
      );
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to resolve existing workflow draft",
        expect.any(Error),
      );
      expect(
        screen.queryByText("진행 중인 Draft가 있습니다"),
      ).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("기존 DRAFT 충돌 후 workflow 목록 조회가 실패하면 에러를 안내한다", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      mockUsePackDetail.mockReturnValue({
        data: {
          name: "CS Pack",
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
          ],
        },
        refetch: vi.fn().mockResolvedValue({
          data: {
            versions: [
              { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
              { versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" },
            ],
          },
        }),
      });
      mockCreateRevisionDraft.mockRejectedValue(
        new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "exists"),
      );
      mockListWorkflows.mockRejectedValue(new Error("workflow list failed"));
      mockUseGetWorkflowDefinition.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          id: 10,
          name: "환불 처리",
          workflowCode: "refund.standard",
          graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
        },
      });

      renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
      fireEvent.click(screen.getByTestId("edit-toggle"));

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("workflow list failed"),
      );
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("dirty 상태에서 편집 닫기 시 변경 내역 폐기 확인 dialog를 표시한다", async () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));
    fireEvent.click(screen.getByTestId("editor-dirty"));
    fireEvent.click(screen.getByTestId("editor-close"));

    expect(
      await screen.findByText("변경 내역을 버릴까요?"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("inline-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(screen.queryByText("변경 내역을 버릴까요?")).not.toBeInTheDocument();
    expect(screen.getByTestId("inline-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("editor-close"));
    fireEvent.click(screen.getByRole("button", { name: "변경 내역 버리기" }));
    expect(screen.queryByTestId("inline-editor")).not.toBeInTheDocument();
  });

  it("dirty 상태에서 목록 이동을 확정하면 변경 내역을 버리고 workflow 목록으로 이동한다", async () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));
    fireEvent.click(screen.getByTestId("editor-dirty"));
    fireEvent.click(screen.getByRole("button", { name: "목록" }));

    expect(
      await screen.findByText("변경 내역을 버릴까요?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "변경 내역 버리기" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2/workflows?versionId=3",
      ),
    );
  });

  it("intent에서 진입한 workflow는 상단 버튼으로 intent 화면으로 돌아간다", async () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3", {
      workflowReturnTo: "/workspaces/1/domain-packs/2/intents/30?versionId=3",
    });

    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2/intents/30?versionId=3",
      ),
    );
  });

  it("workflow 수정 초안 생성 실패 시 서버 에러 메시지를 표시한다", async () => {
    mockUsePackDetail.mockReturnValue({
      data: {
        name: "CS Pack",
        versions: [
          { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        ],
      },
      refetch: vi.fn(),
    });
    mockCreateRevisionDraft.mockRejectedValue(
      new ApiRequestError(
        400,
        "DOMAIN_PACK_VERSION_NOT_CURRENT",
        "현재 운영 버전이 아닙니다.",
      ),
    );
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });

    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("현재 운영 버전이 아닙니다."),
    );
  });

  it("편집 모드에서는 상단 보기 버튼을 렌더하지 않는다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({
          direction: "LR",
          nodes: [{ id: "n1", label: "s", type: "START" }],
          edges: [],
        }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));
    expect(screen.getByTestId("inline-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("view-toggle")).not.toBeInTheDocument();
  });

  it("InlineWorkflowEditor의 onClose가 호출되면 보기 모드로 복귀한다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({
          direction: "LR",
          nodes: [{ id: "n1", label: "s", type: "START" }],
          edges: [],
        }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    fireEvent.click(screen.getByTestId("edit-toggle"));
    fireEvent.click(screen.getByTestId("editor-close"));
    expect(screen.queryByTestId("inline-editor")).not.toBeInTheDocument();
  });

  it("'채팅 / Inspector / 24h replay / refund.standard 가짜 헤더' 등은 더 이상 렌더링되지 않는다", () => {
    mockUseGetWorkflowDefinition.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 10,
        name: "환불 처리",
        workflowCode: "refund.standard",
        graphJson: JSON.stringify({ direction: "LR", nodes: [], edges: [] }),
      },
    });
    renderPage("/workspaces/1/domain-packs/2/workflows/10?versionId=3");
    // legacy panels gone
    expect(screen.queryByText(/검토 중 · v0\.4/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Card payment refund flow"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Selected node")).not.toBeInTheDocument();
    expect(screen.queryByText(/Edit graph/)).not.toBeInTheDocument();
    // tab list gone
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});
