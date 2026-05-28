import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("@/entities/workflow", async () => {
  const actual = await vi.importActual<typeof import("@/entities/workflow")>("@/entities/workflow");
  return {
    ...actual,
    useListWorkflowsByIntent: vi.fn(),
    WorkflowGraphMini: () => <div data-testid="graph-mini-stub" />,
  };
});

import { useListWorkflowsByIntent } from "@/entities/workflow";

import { MatchedWorkflowSection } from "./MatchedWorkflowSection";

const mockedHook = vi.mocked(useListWorkflowsByIntent);

function renderSection(intentId: number | null = 100) {
  return render(
    <MemoryRouter>
      <MatchedWorkflowSection wsId={1} packId={9} versionId={4} intentId={intentId} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedHook.mockReset();
  navigateSpy.mockReset();
});

describe("MatchedWorkflowSection", () => {
  it("intentId null이면 렌더하지 않음", () => {
    mockedHook.mockReturnValue({ loading: false, error: null, entries: [] });
    const { container } = renderSection(null);
    expect(container.firstChild).toBeNull();
  });

  it("loading 상태", () => {
    mockedHook.mockReturnValue({ loading: true, error: null, entries: [] });
    renderSection();
    expect(screen.getByTestId("matched-workflow-section-loading")).toBeInTheDocument();
  });

  it("error 상태", async () => {
    mockedHook.mockReturnValue({ loading: false, error: "boom", entries: [] });
    renderSection();
    await waitFor(() =>
      expect(screen.getByTestId("matched-workflow-section-error")).toBeInTheDocument(),
    );
  });

  it("empty 상태 메시지", () => {
    mockedHook.mockReturnValue({ loading: false, error: null, entries: [] });
    renderSection();
    expect(screen.getByTestId("matched-workflow-section-empty")).toBeInTheDocument();
  });

  it("entry 렌더 + WorkflowRow open 시 navigate", () => {
    mockedHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 9,
          packName: "P",
          versionId: 4,
          workflowId: 7,
          workflowCode: "wf.x",
          name: "워크플로우",
          description: "d",
          intentDefinitionId: 100,
        },
      ],
    });

    renderSection();
    expect(screen.getByTestId("matched-workflow-row-7")).toBeInTheDocument();
    expect(screen.getByTestId("matched-workflow-section-list")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("matched-workflow-row-7-open"));
    expect(navigateSpy).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/9/workflows/7?versionId=4",
      { state: { workflowReturnTo: "/" } },
    );
  });

  it("count 가 loading 인 동안 loading 텍스트 노출", () => {
    mockedHook.mockReturnValue({ loading: true, error: null, entries: [] });
    renderSection();
    expect(screen.getByText(/loading/)).toBeInTheDocument();
  });

  it("count 가 ITEMS 형식으로 노출", () => {
    mockedHook.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        {
          packId: 9,
          packName: "P",
          versionId: 4,
          workflowId: 1,
          workflowCode: null,
          name: "a",
          description: null,
          intentDefinitionId: 100,
        },
      ],
    });
    renderSection();
    expect(screen.getByText("1 ITEMS")).toBeInTheDocument();
  });
});
