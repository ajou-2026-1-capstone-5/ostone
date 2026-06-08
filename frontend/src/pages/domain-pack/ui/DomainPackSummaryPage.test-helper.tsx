/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { render } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActivateMutationResult } from "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller";
import { DomainPackSummaryPage } from "./DomainPackSummaryPage";

const {
  activate,
  toast,
  useDeploy,
  useDiscard,
  usePackDetail,
  useVersionDetail,
} = vi.hoisted(() => ({
  activate: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
  useDeploy: vi.fn(),
  useDiscard: vi.fn(),
  usePackDetail: vi.fn(),
  useVersionDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast,
}));

vi.mock("@/shared/ui/ostone/atoms/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock("@/shared/ui/ostone/atoms/ErrorState", () => ({
  ErrorState: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) => (
    <div data-testid="error-state" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail,
  useVersionDetail,
  VersionSafetyBanner: () => null,
  VersionListPanel: ({
    selectedId,
    onSelect,
  }: {
    selectedId: number | null;
    onSelect: (versionId: number) => void;
  }) => (
    <div data-testid="version-list-panel">
      <span data-testid="selected-version-id">{selectedId ?? "none"}</span>
      <button type="button" onClick={() => onSelect(4)}>
        select version
      </button>
    </div>
  ),
  SummaryDetailPanel: ({
    currentVersionId,
    currentVersionNo,
    onDeploy,
    onApplyDraft,
    onDiscardDraft,
  }: {
    currentVersionId?: number | null;
    currentVersionNo?: number | null;
    onDeploy: (versionId: number) => void;
    onApplyDraft: (versionId: number, description?: string) => void;
    onDiscardDraft: (versionId: number) => void;
  }) => (
    <div data-testid="summary-detail-panel">
      <span data-testid="current-version-id">{currentVersionId ?? "none"}</span>
      <span data-testid="current-version-no">{currentVersionNo ?? "none"}</span>
      <button type="button" onClick={() => onDeploy(4)}>
        deploy version
      </button>
      <button
        type="button"
        onClick={() => onApplyDraft(5, "변경사항 정리 메모")}
      >
        apply draft
      </button>
      <button type="button" onClick={() => onApplyDraft(5, "")}>
        apply empty draft
      </button>
      <button type="button" onClick={() => onApplyDraft(5)}>
        apply draft without description
      </button>
      <button type="button" onClick={() => onDiscardDraft(5)}>
        delete draft
      </button>
    </div>
  ),
}));

vi.mock(
  "@/shared/api/generated/endpoints/deploy-domain-pack-version-controller/deploy-domain-pack-version-controller",
  () => ({
    useDeploy,
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller",
  () => ({
    activate,
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller",
  () => ({
    useDiscard,
  }),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePackQuery(overrides: Record<string, unknown> = {}): any {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

type ActivateMockData = ActivateMutationResult["data"] & {
  description?: string;
};

function makeActivateResponse(data: ActivateMockData): ActivateMutationResult {
  return {
    data,
    status: 200,
    headers: new Headers(),
  };
}

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
      <div data-testid="shell-crumbs">
        {crumbs
          .map((crumb) => (typeof crumb === "string" ? crumb : crumb.label))
          .join(" / ")}
      </div>
      <div data-testid="shell-topbar">{topbarRight}</div>
      <Outlet context={{ setCrumbs, setTopbarRight, workspace: null }} />
    </>
  );
}

function renderPage(path = "/workspaces/1/domain-packs/2") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/domain-packs/:packId"
            element={<ShellHost />}
          >
            <Route
              index
              element={
                <>
                  <DomainPackSummaryPage />
                  <LocationProbe />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(usePackDetail).mockReturnValue(makePackQuery());
  vi.mocked(useVersionDetail).mockReturnValue(makePackQuery());
  vi.mocked(useDeploy).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useDeploy>);
  vi.mocked(activate).mockReset();
  vi.mocked(activate).mockResolvedValue(makeActivateResponse({ id: 5 }));
  vi.mocked(useDiscard).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
  } as unknown as ReturnType<typeof useDiscard>);
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
});

export {
  activate,
  makeActivateResponse,
  makePackQuery,
  renderPage,
  toast,
  useDeploy,
  useDiscard,
  usePackDetail,
  useVersionDetail,
};
