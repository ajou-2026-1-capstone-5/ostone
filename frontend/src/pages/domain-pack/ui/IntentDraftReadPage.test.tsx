import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/shared/api";
import { IntentDraftReadPage } from "./IntentDraftReadPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  packRefetch: vi.fn(),
  versionRefetch: vi.fn(),
  saveIntentRevisionDraft: vi.fn(),
  updateDraftIntent: vi.fn(),
  activateVersion: vi.fn(),
  discardDraft: vi.fn(),
  listIntents: vi.fn(),
  getVersionDetail: vi.fn(),
  useIntentList: vi.fn(),
  useIntentRevisionSummary: vi.fn(),
  intentTreePanelProps: vi.fn(),
  intentDetailPanelProps: vi.fn(),
  intentDetailWithApprovalProps: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  summaryState: {
    status: "ready",
    data: {
      changedIntents: [
        {
          intentId: 10,
          intentCode: "refund",
          name: "환불 문의",
          fields: ["name"],
          before: { name: "환불", description: "" },
          after: { name: "환불 문의", description: "" },
        },
      ],
      changedFieldCounts: { name: 1, description: 0 },
      changedByDraftIntentId: {},
    },
  },
  packData: {
    packId: 7,
    versions: [
      { versionId: 2, versionNo: 1, lifecycleStatus: "PUBLISHED" },
      { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
    ],
  },
  versionData: {
    versionId: 3,
    lifecycleStatus: "PUBLISHED",
    summaryJson: "{}",
  },
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/widgets/ostone-shell", () => ({
  OstoneShell: ({
    children,
    topbarRight,
  }: {
    children: React.ReactNode;
    topbarRight?: React.ReactNode;
  }) => (
    <main>
      {topbarRight}
      {children}
    </main>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: () => ({ data: mocks.packData, refetch: mocks.packRefetch }),
  useVersionDetail: () => ({
    data: mocks.versionData,
    refetch: mocks.versionRefetch,
  }),
}));

vi.mock("@/features/intent-draft-read/model/useIntentList", () => ({
  useIntentList: (...args: unknown[]) => mocks.useIntentList(...args),
}));

vi.mock("@/features/intent-draft-read/ui", () => ({
  IntentTreePanel: ({
    intentListState,
    onSelect,
  }: {
    intentListState: unknown;
    onSelect: (id: number) => void;
  }) => {
    mocks.intentTreePanelProps({ intentListState });
    return (
      <button type="button" onClick={() => onSelect(10)}>
        select intent
      </button>
    );
  },
  MatchedWorkflowSection: ({ intentId }: { intentId: number | null }) => (
    <div data-testid={`matched-workflow-section-stub-${intentId ?? "none"}`} />
  ),
  IntentDetailPanel: ({
    intentId,
    headerActions,
    afterHeader,
    beforeJsonCards,
    children,
    intentListState,
  }: {
    intentId: number | null;
    headerActions?: (detail: {
      id: number;
      intentCode: string;
    }) => React.ReactNode;
    afterHeader?: (detail: {
      id: number;
      intentCode: string;
    }) => React.ReactNode;
    beforeJsonCards?: () => React.ReactNode;
    children?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
    intentListState?: unknown;
  }) => {
    mocks.intentDetailPanelProps({ intentId, intentListState });
    if (intentId === null) return <div>empty intent detail</div>;
    const detail = {
      id: intentId,
      intentCode: "refund",
      name: "환불 문의",
      description: "기존 설명",
    };
    return (
      <section>
        <header>{headerActions?.(detail)}</header>
        <div>intent detail {intentId}</div>
        {afterHeader?.(detail)}
        {beforeJsonCards?.()}
        {children?.(detail)}
      </section>
    );
  },
}));

vi.mock("@/features/approve-intent", () => ({
  IntentDetailWithApproval: ({
    afterHeader,
    beforeJsonCards,
    nonDraftHeaderActions,
    children,
    iId,
    intentListState,
  }: {
    afterHeader?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
    beforeJsonCards?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
    nonDraftHeaderActions?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
    children?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
    iId: number;
    intentListState: unknown;
  }) => {
    mocks.intentDetailWithApprovalProps({ iId, intentListState });
    const detail = {
      id: iId,
      intentCode: "refund",
      name: "환불 문의",
      description: "기존 설명",
    };
    return (
      <section>
        <header>{nonDraftHeaderActions?.(detail)}</header>
        <div>approval detail</div>
        {afterHeader?.(detail)}
        {beforeJsonCards?.(detail)}
        {children?.(detail)}
      </section>
    );
  },
}));

vi.mock("@/features/intent-revision-draft", () => ({
  IntentRevisionDiffPanel: () => <div>revision diff</div>,
  IntentRevisionRecoveryBanner: () => <div>recovery banner</div>,
  IntentRevisionDraftActions: ({
    onRetrySummary,
  }: {
    onRetrySummary: () => void;
  }) => (
    <div>
      <span>
        수정 내용의 적용 및 삭제는 Domain Pack 화면에서 진행할 수 있습니다.
      </span>
      <button type="button" onClick={onRetrySummary}>
        retry summary
      </button>
    </div>
  ),
  IntentRevisionEditForm: ({
    isEditing,
    onSave,
    onDirtyChange,
  }: {
    isEditing?: boolean;
    onSave: (values: { name: string; description: string }) => Promise<boolean>;
    onDirtyChange: (dirty: boolean, intentId: number | null) => void;
  }) => {
    if (!isEditing) return null;
    return (
      <div>
        <button type="button" onClick={() => onDirtyChange(true, 10)}>
          mark dirty
        </button>
        <button
          type="button"
          onClick={() =>
            void onSave({ name: "환불 문의 수정", description: "수정 설명" })
          }
        >
          save revision
        </button>
      </div>
    );
  },
  IntentRevisionEditAction: ({ onEdit }: { onEdit: () => void }) => (
    <button type="button" onClick={onEdit}>
      수정
    </button>
  ),
  classifyExistingDraftSource: () => "INTENT_REVISION",
  intentRevisionDraftApi: {
    activateVersion: mocks.activateVersion,
    discardDraft: mocks.discardDraft,
    listIntents: mocks.listIntents,
    getVersionDetail: mocks.getVersionDetail,
  },
  parseIntentRevisionDraftSource: (summaryJson?: string) =>
    summaryJson?.includes("INTENT_REVISION")
      ? { type: "INTENT_REVISION", baseVersionId: 2 }
      : null,
  resolveSingleExistingDraft: (
    versions?: Array<{ versionId?: number; lifecycleStatus?: string }>,
  ) => {
    const drafts =
      versions?.filter((version) => version.lifecycleStatus === "DRAFT") ?? [];
    return drafts.length === 1 && drafts[0]?.versionId != null
      ? { status: "resolved", versionId: drafts[0].versionId }
      : { status: "invalid" };
  },
  useIntentRevisionMarkers: () => ({}),
  useIntentRevisionSummary: (params: unknown) => {
    mocks.useIntentRevisionSummary(params);
    return mocks.summaryState;
  },
  useSaveIntentRevisionDraft: () => ({
    saveIntentRevisionDraft: mocks.saveIntentRevisionDraft,
    isPending: false,
  }),
  useUpdateDraftIntent: () => ({
    updateDraftIntent: mocks.updateDraftIntent,
    isPending: false,
  }),
}));

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId/intents"
          element={<IntentDraftReadPage />}
        >
          <Route path=":intentId" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("IntentDraftReadPage", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.packRefetch.mockReset();
    mocks.versionRefetch.mockReset();
    mocks.saveIntentRevisionDraft.mockReset();
    mocks.updateDraftIntent.mockReset();
    mocks.activateVersion.mockReset();
    mocks.discardDraft.mockReset();
    mocks.listIntents.mockReset();
    mocks.getVersionDetail.mockReset();
    mocks.useIntentList.mockReset();
    mocks.useIntentRevisionSummary.mockReset();
    mocks.intentTreePanelProps.mockReset();
    mocks.intentDetailPanelProps.mockReset();
    mocks.intentDetailWithApprovalProps.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.packData = {
      packId: 7,
      versions: [
        { versionId: 2, versionNo: 1, lifecycleStatus: "PUBLISHED" },
        { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
      ],
    };
    mocks.versionData = {
      versionId: 3,
      lifecycleStatus: "PUBLISHED",
      summaryJson: "{}",
    };
    mocks.summaryState = {
      status: "ready",
      data: {
        changedIntents: [
          {
            intentId: 10,
            intentCode: "refund",
            name: "환불 문의",
            fields: ["name"],
            before: { name: "환불", description: "" },
            after: { name: "환불 문의", description: "" },
          },
        ],
        changedFieldCounts: { name: 1, description: 0 },
        changedByDraftIntentId: {},
      },
    };
    mocks.packRefetch.mockResolvedValue({ data: mocks.packData });
    mocks.versionRefetch.mockResolvedValue({ data: mocks.versionData });
    mocks.listIntents.mockResolvedValue([{ id: 50, intentCode: "refund" }]);
    mocks.useIntentList.mockReturnValue({ status: "ready", data: [] });
  });

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/intents?versionId=3");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "잘못된 URL 파라미터입니다.",
    );
  });

  it("intent 선택 시 상세 URL로 이동한다", () => {
    renderPage("/workspaces/1/domain-packs/7/intents?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "select intent" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/intents/10?versionId=3",
    );
  });

  it("intent 목록 state를 페이지에서 조회해 tree/detail에 공유한다", () => {
    const intentListState = { status: "ready", data: [] };
    mocks.useIntentList.mockReturnValue(intentListState);

    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    expect(mocks.useIntentList).toHaveBeenCalledWith(1, 7, 3, 0);
    expect(mocks.intentTreePanelProps).toHaveBeenLastCalledWith({
      intentListState,
    });
    expect(mocks.intentDetailWithApprovalProps).toHaveBeenLastCalledWith({
      iId: 10,
      intentListState,
    });
  });

  it("현재 운영 버전에서 첫 저장 시 revision draft를 생성하고 cloned intent로 이동한다", async () => {
    mocks.saveIntentRevisionDraft.mockResolvedValue({
      draftVersionId: 4,
      clonedIntentId: 40,
      patchSucceeded: true,
    });
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.saveIntentRevisionDraft).toHaveBeenCalledWith({
        workspaceId: 1,
        packId: 7,
        baseVersionId: 3,
        intentCode: "refund",
        values: { name: "환불 문의 수정", description: "수정 설명" },
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/intents/40?versionId=4",
      { replace: true },
    );
  });

  it("초안 생성 후 intent patch가 실패하면 이동은 유지하고 복구 안내를 남긴다", async () => {
    mocks.saveIntentRevisionDraft.mockResolvedValue({
      draftVersionId: 4,
      clonedIntentId: null,
      patchSucceeded: false,
    });
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Intent 수정 초안에서 같은 intent를 찾지 못했습니다.",
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/intents?versionId=4",
      { replace: true },
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith(
      "Intent 수정 초안이 생성되었습니다.",
    );
  });

  it("운영 버전이 바뀐 상태에서 저장하면 pack을 새로고침하고 안내한다", async () => {
    mocks.saveIntentRevisionDraft.mockRejectedValue(
      new ApiRequestError(
        409,
        "DOMAIN_PACK_VERSION_NOT_CURRENT",
        "version changed",
      ),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "현재 운영 버전이 변경되었습니다. 최신 버전에서 다시 수정해 주세요.",
      ),
    );
    expect(mocks.packRefetch).toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("이미 진행 중인 초안이 있으면 기존 초안 이동 dialog를 보여준다", async () => {
    mocks.packData = {
      packId: 7,
      versions: [
        { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
        { versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" },
      ],
    };
    mocks.packRefetch.mockResolvedValue({ data: mocks.packData });
    mocks.getVersionDetail.mockResolvedValue({
      versionId: 5,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    });
    mocks.saveIntentRevisionDraft.mockRejectedValue(
      new ApiRequestError(
        409,
        "DOMAIN_PACK_DRAFT_ALREADY_EXISTS",
        "draft exists",
      ),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(
        screen.getByText("진행 중인 초안이 있습니다."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /이미 진행 중인 Draft가 있어 새 수정 초안을 만들 수 없습니다./,
      ),
    ).toBeInTheDocument();
  });

  it("진행 중인 draft가 하나로 해석되지 않으면 이동 dialog 대신 새로고침 안내를 보여준다", async () => {
    mocks.packData = {
      packId: 7,
      versions: [
        { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
        { versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" },
        { versionId: 6, versionNo: 4, lifecycleStatus: "DRAFT" },
      ],
    };
    mocks.packRefetch.mockResolvedValue({ data: mocks.packData });
    mocks.saveIntentRevisionDraft.mockRejectedValue(
      new ApiRequestError(
        409,
        "DOMAIN_PACK_DRAFT_ALREADY_EXISTS",
        "draft exists",
      ),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "초안 상태를 확인할 수 없습니다. 목록을 새로고침해 주세요.",
      ),
    );
    expect(
      screen.queryByText("진행 중인 초안이 있습니다."),
    ).not.toBeInTheDocument();
  });

  it("기존 초안 dialog에서 이동을 확정하면 해당 초안의 같은 intent로 이동한다", async () => {
    mocks.packData = {
      packId: 7,
      versions: [
        { versionId: 3, versionNo: 2, lifecycleStatus: "PUBLISHED" },
        { versionId: 5, versionNo: 3, lifecycleStatus: "DRAFT" },
      ],
    };
    mocks.packRefetch.mockResolvedValue({ data: mocks.packData });
    mocks.getVersionDetail.mockResolvedValue({
      versionId: 5,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    });
    mocks.saveIntentRevisionDraft.mockRejectedValue(
      new ApiRequestError(
        409,
        "DOMAIN_PACK_DRAFT_ALREADY_EXISTS",
        "draft exists",
      ),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));
    await waitFor(() =>
      expect(
        screen.getByText("진행 중인 초안이 있습니다."),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "이동" }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents/50?versionId=5",
        { replace: true },
      ),
    );
  });

  it("revision draft 상태에서는 기존 draft intent를 PATCH하고 현재 화면을 새로고침한다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    mocks.updateDraftIntent.mockResolvedValue({ id: 10 });
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.updateDraftIntent).toHaveBeenCalledWith({
        workspaceId: 1,
        packId: 7,
        draftVersionId: 6,
        intentId: 10,
        values: { name: "환불 문의 수정", description: "수정 설명" },
      }),
    );
    expect(screen.getByText("revision diff")).toBeInTheDocument();
  });

  it("revision draft PATCH 실패 시 서버 메시지를 안내하고 화면을 새로고침하지 않는다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    mocks.updateDraftIntent.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "이름이 너무 깁니다."),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("이름이 너무 깁니다."),
    );
    expect(mocks.versionRefetch).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("dirty 상태에서 intent 이동 시 확인 dialog를 거쳐 이동한다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "mark dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "select intent" }));

    expect(
      await screen.findByText("저장하지 않고 이동할까요?"),
    ).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "이동" }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents/10?versionId=6",
        { replace: true },
      ),
    );
  });

  it("summary 재시도를 누르면 refresh key를 올려 summary를 다시 조회한다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    expect(mocks.useIntentRevisionSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ refreshKey: 0 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "retry summary" }));

    await waitFor(() =>
      expect(mocks.useIntentRevisionSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ refreshKey: 1 }),
      ),
    );
  });

  it("revision draft 상태에서는 적용/삭제 안내만 보여준다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    expect(
      screen.getByText(
        "수정 내용의 적용 및 삭제는 Domain Pack 화면에서 진행할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "apply revision" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "discard revision" }),
    ).not.toBeInTheDocument();
    expect(mocks.activateVersion).not.toHaveBeenCalled();
    expect(mocks.discardDraft).not.toHaveBeenCalled();
  });
});
