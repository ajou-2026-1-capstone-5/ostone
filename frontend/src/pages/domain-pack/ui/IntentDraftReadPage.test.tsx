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
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
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

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: () => ({ data: mocks.packData, refetch: mocks.packRefetch }),
  useVersionDetail: () => ({ data: mocks.versionData, refetch: mocks.versionRefetch }),
}));

vi.mock("@/features/intent-draft-read/ui", () => ({
  IntentTreePanel: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" onClick={() => onSelect(10)}>
      select intent
    </button>
  ),
  MatchedWorkflowSection: ({ intentId }: { intentId: number | null }) => (
    <div data-testid={`matched-workflow-section-stub-${intentId ?? "none"}`} />
  ),
  IntentDetailPanel: ({
    intentId,
    headerActions,
    afterHeader,
    beforeJsonCards,
    children,
  }: {
    intentId: number | null;
    headerActions?: (detail: { id: number; intentCode: string }) => React.ReactNode;
    afterHeader?: (detail: { id: number; intentCode: string }) => React.ReactNode;
    beforeJsonCards?: () => React.ReactNode;
    children?: (detail: {
      id: number;
      intentCode: string;
      name: string;
      description: string;
    }) => React.ReactNode;
  }) => {
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
  }) => {
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
    onApply,
    onDiscard,
    onRetrySummary,
  }: {
    onApply: () => void;
    onDiscard: () => void;
    onRetrySummary: () => void;
  }) => (
    <div>
      <button type="button" onClick={onApply}>
        apply revision
      </button>
      <button type="button" onClick={onDiscard}>
        discard revision
      </button>
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
          onClick={() => void onSave({ name: "환불 문의 수정", description: "수정 설명" })}
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
    summaryJson?.includes("INTENT_REVISION") ? { type: "INTENT_REVISION", baseVersionId: 2 } : null,
  resolveSingleExistingDraft: (
    versions?: Array<{ versionId?: number; lifecycleStatus?: string }>,
  ) => {
    const drafts = versions?.filter((version) => version.lifecycleStatus === "DRAFT") ?? [];
    return drafts.length === 1 && drafts[0]?.versionId != null
      ? { status: "resolved", versionId: drafts[0].versionId }
      : { status: "invalid" };
  },
  useIntentRevisionMarkers: () => ({}),
  useIntentRevisionSummary: () => mocks.summaryState,
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
  });

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/intents?versionId=3");

    expect(screen.getByRole("alert")).toHaveTextContent("잘못된 URL 파라미터입니다.");
  });

  it("intent 선택 시 상세 URL로 이동한다", () => {
    renderPage("/workspaces/1/domain-packs/7/intents?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "select intent" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/intents/10?versionId=3",
    );
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
      new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "draft exists"),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));

    await waitFor(() => expect(screen.getByText("진행 중인 초안이 있습니다.")).toBeInTheDocument());
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
      new ApiRequestError(409, "DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "draft exists"),
    );
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "save revision" }));
    await waitFor(() => expect(screen.getByText("진행 중인 초안이 있습니다.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "이동" }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents/50?versionId=5",
        { replace: true },
      ),
    );
  });

  it("revision draft 적용 후 선택 intent code를 새 버전 intent id로 복원한다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    mocks.activateVersion.mockResolvedValue({ activatedVersionId: 9 });
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "apply revision" }));

    await waitFor(() => expect(mocks.activateVersion).toHaveBeenCalledWith(1, 7, 6));
    await waitFor(() => {
      expect(mocks.packRefetch).toHaveBeenCalled();
      expect(mocks.versionRefetch).toHaveBeenCalled();
    });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents/50?versionId=9",
        { replace: true },
      ),
    );
  });

  it("적용 후 intent code 조회가 실패하면 새 버전 root로 이동한다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    mocks.activateVersion.mockResolvedValue({ activatedVersionId: 9 });
    mocks.listIntents.mockRejectedValue(new Error("list failed"));
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "apply revision" }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents?versionId=9",
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

  it("dirty 상태에서 적용을 누르면 guard 확인 전까지 적용하지 않는다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    mocks.activateVersion.mockResolvedValue({ activatedVersionId: 9 });
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "mark dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "apply revision" }));

    expect(screen.getByText("저장하지 않고 이동할까요?")).toBeInTheDocument();
    expect(mocks.activateVersion).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "이동" }));
    await waitFor(() => expect(mocks.activateVersion).toHaveBeenCalledWith(1, 7, 6));
  });

  it("revision draft 취소 후 운영 버전으로 돌아간다", async () => {
    mocks.versionData = {
      versionId: 6,
      lifecycleStatus: "DRAFT",
      summaryJson: '{"draftSource":"INTENT_REVISION"}',
    };
    renderPage("/workspaces/1/domain-packs/7/intents/10?versionId=6");

    fireEvent.click(screen.getByRole("button", { name: "discard revision" }));

    await waitFor(() => expect(mocks.discardDraft).toHaveBeenCalledWith(1, 7, 6));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/workspaces/1/domain-packs/7/intents/50?versionId=3",
        { replace: true },
      ),
    );
  });
});
