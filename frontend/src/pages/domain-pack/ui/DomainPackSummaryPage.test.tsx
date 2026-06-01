import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/shared/api";
import { useDeploy } from "@/shared/api/generated/endpoints/deploy-domain-pack-version-controller/deploy-domain-pack-version-controller";
import { useActivate } from "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller";
import { useDiscard } from "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller";
import { usePackDetail, useVersionDetail } from "@/features/domain-pack-summary-read";
import { DomainPackSummaryPage } from "./DomainPackSummaryPage";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/widgets/ostone-shell", () => ({
  OstoneShell: ({
    children,
    crumbs,
  }: {
    children: React.ReactNode;
    crumbs?: Array<string | { label: string }>;
  }) => (
    <div>
      <div data-testid="shell-crumbs">
        {crumbs?.map((crumb) => (typeof crumb === "string" ? crumb : crumb.label)).join(" / ")}
      </div>
      {children}
    </div>
  ),
}));

vi.mock("@/shared/ui/ostone/atoms/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock("@/shared/ui/ostone/atoms/ErrorState", () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
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
  usePackDetail: vi.fn(),
  useVersionDetail: vi.fn(),
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
    onApplyDraft: (versionId: number) => void;
    onDiscardDraft: (versionId: number) => void;
  }) => (
    <div data-testid="summary-detail-panel">
      <span data-testid="current-version-id">{currentVersionId ?? "none"}</span>
      <span data-testid="current-version-no">{currentVersionNo ?? "none"}</span>
      <button type="button" onClick={() => onDeploy(4)}>
        deploy version
      </button>
      <button type="button" onClick={() => onApplyDraft(5)}>
        apply draft
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
    useDeploy: vi.fn(),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller",
  () => ({
    useActivate: vi.fn(),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller",
  () => ({
    useDiscard: vi.fn(),
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(path = "/workspaces/1/domain-packs/2") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId"
          element={
            <>
              <DomainPackSummaryPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DomainPackSummaryPage", () => {
  beforeEach(() => {
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery());
    vi.mocked(useVersionDetail).mockReturnValue(makePackQuery());
    vi.mocked(useDeploy).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useDeploy>);
    vi.mocked(useActivate).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useActivate>);
    vi.mocked(useDiscard).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useDiscard>);
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("유효하지 않은 workspaceId 시 에러 메시지를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/2");
    expect(screen.getByRole("alert")).toHaveTextContent("잘못된 URL 파라미터");
  });

  it("packDetail 에러(비404) 시 에러 카드와 다시 시도 버튼을 표시한다", () => {
    const refetch = vi.fn();
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: new Error("fail"), refetch }),
    );
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Pack 정보를 불러오지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalled();
  });

  it('packDetail 404 에러 시 "Pack을 찾을 수 없습니다." 메시지를 표시한다', () => {
    const error404 = new ApiRequestError(404, "NOT_FOUND", "not found");
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery({ isError: true, error: error404 }));
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Pack을 찾을 수 없습니다.");
  });

  it("정상 상태에서 VersionListPanel과 SummaryDetailPanel을 렌더링한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: { packId: 2, name: "CS Pack", code: "CS", versions: [] },
      }),
    );
    renderPage();
    expect(screen.getByTestId("version-list-panel")).toBeInTheDocument();
    expect(screen.getByTestId("summary-detail-panel")).toBeInTheDocument();
  });

  it("도메인팩 상세 breadcrumb의 workspace 축약 라벨을 도메인팩으로 표시한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: { packId: 2, name: "CS Pack", code: "CS", versions: [] },
      }),
    );

    renderPage();

    expect(screen.getByTestId("shell-crumbs")).toHaveTextContent("도메인팩 / CS Pack");
    expect(screen.getByTestId("shell-crumbs")).not.toHaveTextContent("WS · 1");
  });

  it("versionId가 없으면 배포중 버전을 기본 선택하고 URL에 반영한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          currentVersionId: 3,
          versions: [
            { versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" },
            { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=3",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 3);
    expect(screen.getByTestId("selected-version-id")).toHaveTextContent("3");
    expect(screen.getByTestId("shell-crumbs")).toHaveTextContent("도메인팩 / CS Pack / #2");
  });

  it("배포중 버전이 없으면 최신 draft 버전을 기본 선택한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [
            { versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" },
            { versionId: 4, versionNo: 1, lifecycleStatus: "PUBLISHED" },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=5",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 5);
    expect(screen.getByTestId("selected-version-id")).toHaveTextContent("5");
  });

  it("기본 버전을 URL에 반영할 때 기존 query parameter를 유지한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?tab=history");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?tab=history&versionId=5",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 5);
  });

  it("배포중 버전과 draft가 없으면 최신 버전을 기본 선택한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [
            { versionId: 4, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 6, versionNo: 3, lifecycleStatus: "PUBLISHED" },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=6",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 6);
    expect(screen.getByTestId("selected-version-id")).toHaveTextContent("6");
  });

  it("versionNo가 같으면 생성일이 더 최신인 draft를 기본 선택한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [
            {
              versionId: 5,
              versionNo: 2,
              lifecycleStatus: "DRAFT",
              createdAt: "2026-05-30T00:00:00+09:00",
            },
            {
              versionId: 6,
              versionNo: 2,
              lifecycleStatus: "DRAFT",
              createdAt: "2026-05-31T00:00:00+09:00",
            },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=6",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 6);
  });

  it("versionNo와 생성일 비교가 불가능하면 versionId가 더 큰 draft를 기본 선택한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [
            { versionId: 5, versionNo: 2, lifecycleStatus: "DRAFT" },
            {
              versionId: 6,
              versionNo: 2,
              lifecycleStatus: "DRAFT",
              createdAt: "invalid-date",
            },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=6",
      ),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 6);
  });

  it("버전이 없는 pack은 versionId를 자동 추가하지 않는다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/1/domain-packs/2"),
    );
    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, null);
    expect(screen.getByTestId("selected-version-id")).toHaveTextContent("none");
  });

  it("query string versionId로 선택 버전 상세를 조회한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: { packId: 2, name: "CS Pack", code: "CS", versions: [] },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=3");

    expect(useVersionDetail).toHaveBeenCalledWith(1, 2, 3);
  });

  it("버전 선택 시 현재 route를 replace하며 versionId만 갱신한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 3, versionNo: 1 }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=3");
    fireEvent.click(screen.getByRole("button", { name: "select version" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=4",
      ),
    );
  });

  it("버전 배포 버튼 클릭 시 deploy mutation을 호출한다", () => {
    const mutate = vi.fn();
    vi.mocked(useDeploy).mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useDeploy>);
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 4, versionNo: 2 }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=3");
    fireEvent.click(screen.getByRole("button", { name: "deploy version" }));

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      versionId: 4,
    });
  });

  it("Draft 적용 버튼 클릭 시 activate mutation을 호출한다", () => {
    const mutate = vi.fn();
    vi.mocked(useActivate).mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useActivate>);
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "apply draft" }));

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      versionId: 5,
    });
  });

  it("Draft 적용 성공 후 기존 draft 상세 refetch 실패로 실패 toast를 띄우지 않는다", async () => {
    const packRefetch = vi.fn().mockRejectedValue(new Error("refetch failed"));
    const versionRefetch = vi.fn().mockRejectedValue(new Error("old draft missing"));
    const mutate = vi.fn((variables) => {
      void activateOnSuccess?.({ id: 6 }, variables, undefined);
    });
    let activateOnSuccess:
      | ((
          result: unknown,
          variables: { workspaceId: number; packId: number; versionId: number },
          context: unknown,
        ) => unknown)
      | undefined;
    vi.mocked(useActivate).mockImplementation((options) => {
      activateOnSuccess = options?.mutation?.onSuccess;
      return {
        mutate,
        isPending: false,
        variables: undefined,
      } as unknown as ReturnType<typeof useActivate>;
    });
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
        refetch: packRefetch,
      }),
    );
    vi.mocked(useVersionDetail).mockReturnValue(
      makePackQuery({
        data: { versionId: 5, lifecycleStatus: "DRAFT" },
        refetch: versionRefetch,
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "apply draft" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=6",
      ),
    );
    expect(packRefetch).toHaveBeenCalled();
    expect(versionRefetch).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "검토 중인 버전이 운영 버전으로 적용되었습니다.",
    );
    expect(toast.error).not.toHaveBeenCalledWith("검토 중인 버전을 적용하지 못했습니다.");
  });

  it("Draft 적용 성공 응답이 data.id 형태여도 적용된 버전으로 이동한다", async () => {
    let activateOnSuccess:
      | ((
          result: unknown,
          variables: { workspaceId: number; packId: number; versionId: number },
          context: unknown,
        ) => unknown)
      | undefined;
    const mutate = vi.fn((variables) => {
      void activateOnSuccess?.({ data: { id: 7 } }, variables, undefined);
    });
    vi.mocked(useActivate).mockImplementation((options) => {
      activateOnSuccess = options?.mutation?.onSuccess;
      return {
        mutate,
        isPending: false,
        variables: undefined,
      } as unknown as ReturnType<typeof useActivate>;
    });
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
        refetch: vi.fn(),
      }),
    );
    vi.mocked(useVersionDetail).mockReturnValue(
      makePackQuery({
        data: { versionId: 5, lifecycleStatus: "DRAFT" },
        refetch: vi.fn(),
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "apply draft" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/1/domain-packs/2?versionId=7",
      ),
    );
  });

  it("Draft 적용 실패 시 상담사 용어의 실패 toast를 띄운다", () => {
    let activateOnError: ((error: unknown) => unknown) | undefined;
    const mutate = vi.fn(() => activateOnError?.(new Error("activate failed")));
    vi.mocked(useActivate).mockImplementation((options) => {
      activateOnError = options?.mutation?.onError;
      return {
        mutate,
        isPending: false,
        variables: undefined,
      } as unknown as ReturnType<typeof useActivate>;
    });
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "apply draft" }));

    expect(toast.error).toHaveBeenCalledWith("검토 중인 버전을 적용하지 못했습니다.");
  });

  it("Draft 삭제 버튼 클릭 시 discard mutation을 호출한다", () => {
    const mutate = vi.fn();
    vi.mocked(useDiscard).mockReturnValue({
      mutate,
      isPending: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useDiscard>);
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "delete draft" }));

    expect(mutate).toHaveBeenCalledWith({
      workspaceId: 1,
      packId: 2,
      draftVersionId: 5,
    });
  });

  it("Draft 삭제 성공 후 운영 버전이 없으면 versionId를 제거한다", async () => {
    const packRefetch = vi.fn().mockResolvedValue({ data: { currentVersionId: null } });
    let discardOnSuccess: (() => unknown) | undefined;
    const mutate = vi.fn(() => discardOnSuccess?.());
    vi.mocked(useDiscard).mockImplementation((options) => {
      discardOnSuccess = options?.mutation?.onSuccess;
      return {
        mutate,
        isPending: false,
        variables: undefined,
      } as unknown as ReturnType<typeof useDiscard>;
    });
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          currentVersionId: null,
          versions: [{ versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" }],
        },
        refetch: packRefetch,
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=5");
    fireEvent.click(screen.getByRole("button", { name: "delete draft" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/1/domain-packs/2"),
    );
    expect(toast.success).toHaveBeenCalledWith("검토 중인 버전이 삭제되었습니다.");
  });

  it("currentVersionId가 없으면 PUBLISHED 버전이 하나뿐이어도 운영 버전을 추론하지 않는다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [{ versionId: 4, versionNo: 2, lifecycleStatus: "PUBLISHED" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=4");

    expect(screen.getByTestId("current-version-id")).toHaveTextContent("none");
  });

  it("packDetail의 현재 운영 버전 번호를 SummaryDetailPanel에 전달한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          currentVersionId: 3,
          currentVersionNo: 7,
          versions: [{ versionId: 3, versionNo: 7, lifecycleStatus: "PUBLISHED" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=4");

    expect(screen.getByTestId("current-version-id")).toHaveTextContent("3");
    expect(screen.getByTestId("current-version-no")).toHaveTextContent("7");
  });

  it("currentVersionNo가 없으면 currentVersionId와 버전 목록으로 현재 운영 버전 번호를 전달한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          currentVersionId: 3,
          currentVersionNo: null,
          versions: [{ versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" }],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=4");

    expect(screen.getByTestId("current-version-no")).toHaveTextContent("2");
  });

  it("currentVersionId가 없고 PUBLISHED 버전이 여러 개면 운영 버전을 추론하지 않는다", () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: {
          packId: 2,
          name: "CS Pack",
          code: "CS",
          versions: [
            { versionId: 3, versionNo: 1, lifecycleStatus: "PUBLISHED" },
            { versionId: 4, versionNo: 2, lifecycleStatus: "PUBLISHED" },
          ],
        },
      }),
    );

    renderPage("/workspaces/1/domain-packs/2?versionId=4");

    expect(screen.getByTestId("current-version-id")).toHaveTextContent("none");
  });

  it('"새 검토본 묶기" 버튼을 표시하지 않는다', () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({
        data: { packId: 2, name: "CS Pack", code: "CS", versions: [] },
      }),
    );
    renderPage();
    expect(screen.queryByRole("button", { name: "새 검토본 묶기" })).not.toBeInTheDocument();
  });

  it("packDetail 로딩 중 LoadingSpinner를 표시한다", () => {
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery({ isLoading: true }));
    renderPage();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("version-list-panel")).not.toBeInTheDocument();
  });

  it("packDetail 비404 에러 시 toast.error를 1회 호출한다", async () => {
    vi.mocked(usePackDetail).mockReturnValue(
      makePackQuery({ isError: true, error: new Error("fail") }),
    );
    renderPage();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Pack 정보를 불러오지 못했습니다."),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('packDetail 404 에러 시 toast.error를 "Pack을 찾을 수 없습니다."로 호출한다', async () => {
    const error404 = new ApiRequestError(404, "NOT_FOUND", "not found");
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery({ isError: true, error: error404 }));
    renderPage();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Pack을 찾을 수 없습니다."));
  });

  it('packDetail 404 에러 시 "다시 시도" 버튼을 표시하지 않는다', () => {
    const error404 = new ApiRequestError(404, "NOT_FOUND", "not found");
    vi.mocked(usePackDetail).mockReturnValue(makePackQuery({ isError: true, error: error404 }));
    renderPage();
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });
});
