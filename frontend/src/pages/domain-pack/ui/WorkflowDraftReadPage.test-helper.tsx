/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { WorkflowDraftReadPage } from "./WorkflowDraftReadPage";

const mockUseGetWorkflowDefinition = vi.fn();
const mockUsePackDetail = vi.fn();
const mockCreateRevisionDraft = vi.fn();
const mockListWorkflows = vi.fn();
const mockGetWorkflowBottleneckAnalysis = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/entities/workflow", () => ({
  useGetWorkflowDefinition: (...args: unknown[]) =>
    mockUseGetWorkflowDefinition(...args),
}));

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: (...args: unknown[]) => mockUsePackDetail(...args),
  formatLifecycleStatus: (status?: string | null) =>
    status === "PUBLISHED"
      ? "운영 가능"
      : status === "DRAFT"
        ? "검토 중"
        : "상태 없음",
  VersionSafetyBanner: () => null,
}));

vi.mock("@/features/consultation/api/consultationApi", () => ({
  consultationApi: {
    getWorkflowBottleneckAnalysis: (...args: unknown[]) =>
      mockGetWorkflowBottleneckAnalysis(...args),
  },
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

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function ShellHost() {
  const [crumbs, setCrumbs] = useState<Array<string | { label: string }>>([]);
  const [topbarRight, setTopbarRight] = useState<React.ReactNode>();

  return (
    <>
      <div data-testid="crumbs">
        {crumbs
          .map((crumb) => (typeof crumb === "string" ? crumb : crumb.label))
          .join(" / ")}
      </div>
      <div data-testid="shell-topbar">{topbarRight}</div>
      <Outlet context={{ setCrumbs, setTopbarRight, workspace: null }} />
    </>
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
          path="/workspaces/:workspaceId/domain-packs/:packId"
          element={<ShellHost />}
        >
          <Route
            path="workflows/:workflowId?"
            element={
              <>
                <WorkflowDraftReadPage />
                <LocationProbe />
              </>
            }
          />
        </Route>
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
  mockGetWorkflowBottleneckAnalysis.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockGetWorkflowBottleneckAnalysis.mockResolvedValue({
    workspaceId: 1,
    workflowDefinitionId: 10,
    periodStart: "2026-05-29T00:00:00+09:00",
    periodEnd: "2026-06-05T00:00:00+09:00",
    totalExecutionCount: 0,
    completedCount: 0,
    failedCount: 0,
    runningCount: 0,
    transitions: [],
    longestDwellState: null,
    mostStoppedState: null,
    stateMetrics: [],
    missingSlotTop: [],
    policyHitTop: [],
    riskHitTop: [],
    humanInterventionPoints: [],
    improvementHints: [
      "선택 기간에 개선 우선순위를 판단할 병목 신호가 아직 충분하지 않습니다.",
    ],
  });
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

export {
  mockCreateRevisionDraft,
  mockGetWorkflowBottleneckAnalysis,
  mockListWorkflows,
  mockToastError,
  mockToastSuccess,
  mockUseGetWorkflowDefinition,
  mockUsePackDetail,
  renderPage,
};
