import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceUploadPage } from "./WorkspaceUploadPage";

const mockUseGetWorkspace = vi.fn();
const mockUseSubscription = vi.fn();

vi.mock("../../../features/log-upload/ui/LogUploadForm", () => ({
  LogUploadForm: ({
    workspaceId,
    freeOnboardingStatus,
    hasActiveSubscription,
  }: {
    workspaceId?: number;
    freeOnboardingStatus?: string;
    hasActiveSubscription?: boolean;
  }) => (
    <div data-testid="upload-form">
      workspace:{workspaceId} onboarding:{freeOnboardingStatus} active:
      {String(hasActiveSubscription)}
    </div>
  ),
}));

vi.mock("@/shared/api/generated/endpoints/workspace-controller/workspace-controller", () => ({
  useGetWorkspace: (...args: unknown[]) => mockUseGetWorkspace(...args),
}));

vi.mock("@/entities/billing", () => ({
  useSubscription: (...args: unknown[]) => mockUseSubscription(...args),
  isSubscriptionEngaged: (status: string | undefined) => status === "ACTIVE" || status === "PAST_DUE",
}));

function renderRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/upload" element={<WorkspaceUploadPage />} />
        <Route path="/workspaces/:workspaceId/pipeline-jobs/:pipelineJobId/review" element={<div>리뷰 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspaceUploadPage", () => {
  beforeEach(() => {
    mockUseGetWorkspace.mockReturnValue({
      data: { data: { id: 1, freeOnboardingStatus: "AVAILABLE" } },
      isLoading: false,
    });
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false });
  });

  it("redirects job upload links to the pipeline review screen", () => {
    renderRoute("/workspaces/1/upload?jobId=99");

    expect(screen.getByText("리뷰 화면")).toBeInTheDocument();
  });

  it("renders upload form when there is no job id", () => {
    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:AVAILABLE active:false",
    );
  });

  it("passes consumed onboarding and active subscription state to the form", () => {
    mockUseGetWorkspace.mockReturnValue({
      data: { data: { id: 1, freeOnboardingStatus: "CONSUMED" } },
      isLoading: false,
    });
    mockUseSubscription.mockReturnValue({ data: { status: "ACTIVE" }, isLoading: false });

    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:CONSUMED active:true",
    );
  });
});
