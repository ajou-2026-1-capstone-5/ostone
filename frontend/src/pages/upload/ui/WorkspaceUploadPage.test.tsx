import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceUploadPage } from "./WorkspaceUploadPage";

const mockUseGetWorkspace = vi.fn();
const mockUseSubscription = vi.fn();
const mockUseWorkspaceDashboardHealth = vi.fn();
const mockWorkspaceRefetch = vi.fn();
const mockSubscriptionRefetch = vi.fn();

vi.mock("../../../features/log-upload/ui/LogUploadForm", () => ({
  LogUploadForm: ({
    workspaceId,
    freeOnboardingStatus,
    hasActiveSubscription,
    isEntitlementLoading,
    paidUploadCooldown,
    openReviewCta,
  }: {
    workspaceId?: number;
    freeOnboardingStatus?: string;
    hasActiveSubscription?: boolean;
    isEntitlementLoading?: boolean;
    paidUploadCooldown?: { isBlocked?: boolean; nextAvailableAt?: string | null };
    openReviewCta?: { path: string; pendingReviewCount: number } | null;
  }) => (
    <div data-testid="upload-form">
      workspace:{workspaceId} onboarding:{freeOnboardingStatus} active:
      {String(hasActiveSubscription)} loading:{String(isEntitlementLoading)}{" "}
      cooldown:
      {String(paidUploadCooldown?.isBlocked)} next:
      {paidUploadCooldown?.nextAvailableAt ?? "none"} review:
      {openReviewCta?.path ?? "none"} pending:
      {openReviewCta?.pendingReviewCount ?? "none"}
    </div>
  ),
}));

vi.mock(
  "@/shared/api/generated/endpoints/workspace-controller/workspace-controller",
  () => ({
    useGetWorkspace: (...args: unknown[]) => mockUseGetWorkspace(...args),
  }),
);

vi.mock("@/entities/billing", () => ({
  useSubscription: (...args: unknown[]) => mockUseSubscription(...args),
  isSubscriptionEngaged: (status: string | undefined) =>
    status === "ACTIVE" || status === "PAST_DUE",
}));

vi.mock("@/features/workspace-dashboard-health", () => ({
  useWorkspaceDashboardHealth: (...args: unknown[]) =>
    mockUseWorkspaceDashboardHealth(...args),
}));

function renderRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/upload"
          element={<WorkspaceUploadPage />}
        />
        <Route
          path="/workspaces/:workspaceId/pipeline-jobs/:pipelineJobId/review"
          element={<div>리뷰 화면</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspaceUploadPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockWorkspaceRefetch.mockReset();
    mockSubscriptionRefetch.mockReset();
    mockUseGetWorkspace.mockReturnValue({
      data: { data: { id: 1, freeOnboardingStatus: "AVAILABLE" } },
      isLoading: false,
      refetch: mockWorkspaceRefetch,
    });
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: mockSubscriptionRefetch,
    });
    mockUseWorkspaceDashboardHealth.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects job upload links to the pipeline review screen", () => {
    renderRoute("/workspaces/1/upload?jobId=99");

    expect(screen.getByText("리뷰 화면")).toBeInTheDocument();
  });

  it("renders upload form when there is no job id", () => {
    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:AVAILABLE active:false loading:false cooldown:false next:none review:none pending:none",
    );
  });

  it("passes open review pipeline CTA to the upload form", () => {
    mockUseWorkspaceDashboardHealth.mockReturnValue({
      data: {
        pendingReviewCount: 3,
        latestOpenReviewPipelineJobId: 43,
      },
      isLoading: false,
    });

    renderRoute("/workspaces/2/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "review:/workspaces/2/pipeline-jobs/43/review pending:3",
    );
  });

  it("passes consumed onboarding and active subscription state to the form", () => {
    mockUseGetWorkspace.mockReturnValue({
      data: { data: { id: 1, freeOnboardingStatus: "CONSUMED" } },
      isLoading: false,
      refetch: mockWorkspaceRefetch,
    });
    mockUseSubscription.mockReturnValue({
      data: { status: "ACTIVE" },
      isLoading: false,
      refetch: mockSubscriptionRefetch,
    });

    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:CONSUMED active:true loading:false cooldown:false next:none review:none pending:none",
    );
  });

  it("passes paid domain pack operation cooldown state to the form", () => {
    mockUseSubscription.mockReturnValue({
      data: {
        status: "ACTIVE",
        quotaUsages: [
          {
            resource: "DOMAIN_PACK_OPERATION",
            used: 1,
            limit: 1,
            warning: true,
            nextAvailableAt: "2026-06-04T10:30:00+09:00",
          },
        ],
      },
      isLoading: false,
    });

    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:AVAILABLE active:true loading:false cooldown:true next:2026-06-04T10:30:00+09:00 review:none pending:none",
    );
  });

  it("refreshes upload entitlement when the subscription period boundary passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mockUseGetWorkspace.mockReturnValue({
      data: { data: { id: 1, freeOnboardingStatus: "CONSUMED" } },
      isLoading: false,
      refetch: mockWorkspaceRefetch,
    });
    mockUseSubscription.mockReturnValue({
      data: {
        status: "INCOMPLETE",
        currentPeriodEnd: "2026-06-07T00:00:01.000Z",
      },
      isLoading: false,
      refetch: mockSubscriptionRefetch,
    });

    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent(
      "workspace:1 onboarding:CONSUMED active:false loading:false cooldown:false next:none review:none pending:none",
    );

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(mockWorkspaceRefetch).not.toHaveBeenCalled();
    expect(mockSubscriptionRefetch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockWorkspaceRefetch).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionRefetch).toHaveBeenCalledTimes(1);
  });
});
