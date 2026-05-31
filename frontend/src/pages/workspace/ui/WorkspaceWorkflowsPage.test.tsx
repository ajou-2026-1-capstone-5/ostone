import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { WorkspaceWorkflowsPage } from "./WorkspaceWorkflowsPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockHook = vi.fn();
vi.mock("@/entities/workflow", () => ({
  useListAllWorkspaceWorkflows: (...args: unknown[]) => mockHook(...args),
}));

vi.mock("@/features/workflow-list", () => ({
  WorkflowListView: vi.fn(({ entries, onOpen }) => (
    <div data-testid="workflow-list-view">
      {entries.map(
        (entry: { workflowId: number; name: string; packId: number; versionId: number }) => (
          <button
            key={entry.workflowId}
            type="button"
            data-testid={`workspace-workflows-card-${entry.workflowId}`}
            onClick={() => onOpen(entry)}
          >
            {entry.name}
          </button>
        ),
      )}
    </div>
  )),
}));

function renderPage(path = "/workspaces/1/workflows") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/workflows" element={<WorkspaceWorkflowsPage />} />
        <Route path="/workspaces" element={<div data-testid="workspace-root" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockHook.mockReset();
});

describe("WorkspaceWorkflowsPage", () => {
  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage("/workspaces/abc/workflows");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
  });

  it("loading 상태에서는 loading panel을 보여준다", () => {
    mockHook.mockReturnValue({ loading: true, error: null, entries: [] });
    renderPage();
    expect(screen.getByTestId("workspace-workflows-loading")).toBeInTheDocument();
  });

  it("error 상태에서는 ErrorState를 보여준다", () => {
    mockHook.mockReturnValue({ loading: false, error: "응대 흐름 목록 조회 실패", entries: [] });
    renderPage();
    expect(screen.getByTestId("workspace-workflows-error")).toBeInTheDocument();
    expect(screen.getByText("응대 흐름 목록 조회 실패")).toBeInTheDocument();
  });

  it("entries 비어 있으면 empty state를 보여준다", () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage();
    expect(screen.getByTestId("workspace-workflows-empty")).toBeInTheDocument();
    expect(
      screen.getByText(
        "아직 등록된 응대 흐름이 없습니다. 응대 흐름은 도메인팩에서 생성하고 관리합니다.",
      ),
    ).toBeInTheDocument();
  });

  it("entries가 있으면 WorkflowListView로 전달한다", () => {
    mockHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 11,
          packName: "CS Support",
          versionId: 22,
          workflowId: 100,
          workflowCode: "refund.standard",
          name: "환불 처리",
          description: "desc",
        },
      ],
    });
    renderPage();
    expect(screen.getByTestId("workflow-list-view")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-workflows-card-100")).toHaveTextContent("환불 처리");
  });

  it("카드에서 열기(onOpen) 시 실제 packId/versionId/workflowId 경로로 navigate한다", () => {
    mockHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 11,
          packName: "CS Support",
          versionId: 22,
          workflowId: 100,
          workflowCode: null,
          name: "환불 처리",
          description: null,
        },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByTestId("workspace-workflows-card-100"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/11/workflows/100?versionId=22",
    );
  });

  it("헤더 CTA 클릭 시 도메인팩 목록으로 이동한다", () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage();
    fireEvent.click(screen.getByText("도메인팩 관리"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it("empty state CTA 클릭 시 도메인팩 목록으로 이동한다", () => {
    mockHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderPage();
    fireEvent.click(screen.getByText("도메인팩으로 이동"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });
});
