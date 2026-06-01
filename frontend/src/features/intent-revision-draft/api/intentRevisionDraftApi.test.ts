// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "@/shared/api/generated/endpoints/create-intent-revision-draft-controller/create-intent-revision-draft-controller";
import { activate } from "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller";
import { discard } from "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller";
import {
  getIntent,
  listIntents,
} from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { update } from "@/shared/api/generated/endpoints/update-draft-intent-controller/update-draft-intent-controller";
import {
  getWorkflow,
  listWorkflows,
} from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { intentRevisionDraftApi } from "./intentRevisionDraftApi";

vi.mock(
  "@/shared/api/generated/endpoints/create-intent-revision-draft-controller/create-intent-revision-draft-controller",
  () => ({
    create: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/activate-domain-pack-version-controller/activate-domain-pack-version-controller",
  () => ({
    activate: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/discard-draft-version-controller/discard-draft-version-controller",
  () => ({
    discard: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller",
  () => ({
    getIntent: vi.fn(),
    listIntents: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/update-draft-intent-controller/update-draft-intent-controller",
  () => ({
    update: vi.fn(),
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    getWorkflow: vi.fn(),
    listWorkflows: vi.fn(),
  }),
);

const mockedCreate = vi.mocked(create);
const mockedActivate = vi.mocked(activate);
const mockedDiscard = vi.mocked(discard);
const mockedListIntents = vi.mocked(listIntents);
const mockedGetIntent = vi.mocked(getIntent);
const mockedUpdate = vi.mocked(update);
const mockedListWorkflows = vi.mocked(listWorkflows);
const mockedGetWorkflow = vi.mocked(getWorkflow);

vi.mock("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller", () => ({
  getDomainPackVersion: vi.fn(),
}));

const mockedWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

describe("intentRevisionDraftApi", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedActivate.mockReset();
    mockedDiscard.mockReset();
    mockedListIntents.mockReset();
    mockedGetIntent.mockReset();
    mockedUpdate.mockReset();
    mockedListWorkflows.mockReset();
    mockedGetWorkflow.mockReset();
    mockedWarn.mockClear();
  });

  it("revision draft 생성 응답의 canonical draftVersionId를 정규화한다", async () => {
    mockedCreate.mockResolvedValue({ draftVersionId: 15 } as never);

    await expect(intentRevisionDraftApi.createRevisionDraft(1, 2, 12)).resolves.toEqual({
      draftVersionId: 15,
    });
    expect(mockedWarn).not.toHaveBeenCalled();
    expect(mockedCreate).toHaveBeenCalledWith(1, 2, 12);
  });

  it("revision draft 생성 응답의 legacy draftVersion.versionId를 warning과 함께 정규화한다", async () => {
    mockedCreate.mockResolvedValue({
      draftVersion: { versionId: 15, versionNo: 5, lifecycleStatus: "DRAFT" },
    } as never);

    await expect(intentRevisionDraftApi.createRevisionDraft(1, 2, 12)).resolves.toEqual({
      draftVersionId: 15,
    });
    expect(mockedCreate).toHaveBeenCalledWith(1, 2, 12);
    expect(mockedWarn).toHaveBeenCalledWith(
      "[intentRevisionDraftApi] using legacy revision draft id response field",
    );
  });

  it("activate 응답의 id를 activatedVersionId로 정규화한다", async () => {
    mockedActivate.mockResolvedValue({
      id: 16,
      domainPackId: 2,
      lifecycleStatus: "PUBLISHED",
    } as never);

    await expect(intentRevisionDraftApi.activateVersion(1, 2, 15)).resolves.toEqual({
      activatedVersionId: 16,
    });
    expect(mockedActivate).toHaveBeenCalledWith(1, 2, 15);
  });

  it("data wrapper가 있는 list/detail 응답을 unwrap한다", async () => {
    mockedListIntents.mockResolvedValue({ data: [{ id: 1, intentCode: "refund" }] } as never);
    mockedGetIntent.mockResolvedValue({
      data: { id: 1, intentCode: "refund", name: "환불" },
    } as never);

    await expect(intentRevisionDraftApi.listIntents(1, 2, 3)).resolves.toEqual([
      { id: 1, intentCode: "refund" },
    ]);
    await expect(intentRevisionDraftApi.getIntent(1, 2, 3, 1)).resolves.toMatchObject({
      id: 1,
      intentCode: "refund",
    });
    expect(mockedListIntents).toHaveBeenCalledWith(1, 2, 3, undefined);
    expect(mockedGetIntent).toHaveBeenCalledWith(1, 2, 3, 1);
  });

  it("list 응답이 직접 배열이면 그대로 반환한다", async () => {
    const intents = [{ id: 1, intentCode: "refund" }];
    mockedListIntents.mockResolvedValue(intents as never);

    await expect(intentRevisionDraftApi.listIntents(1, 2, 3)).resolves.toEqual(intents);
  });

  it("workflow list/detail 응답을 unwrap하고 generated endpoint 옵션을 전달한다", async () => {
    const signal = new AbortController().signal;
    mockedListWorkflows.mockResolvedValue({
      data: [{ id: 10, workflowCode: "refund-flow" }],
    });
    mockedGetWorkflow.mockResolvedValue({
      data: { id: 10, workflowCode: "refund-flow", name: "환불 흐름" },
    });

    await expect(
      intentRevisionDraftApi.listWorkflows(1, 2, 3, { signal }),
    ).resolves.toEqual([{ id: 10, workflowCode: "refund-flow" }]);
    await expect(intentRevisionDraftApi.getWorkflow(1, 2, 3, 10, { signal })).resolves.toMatchObject(
      {
        id: 10,
        workflowCode: "refund-flow",
      },
    );
    expect(mockedListWorkflows).toHaveBeenCalledWith(1, 2, 3, undefined, { signal });
    expect(mockedGetWorkflow).toHaveBeenCalledWith(1, 2, 3, 10, { signal });
  });

  it("workflow list 응답이 직접 배열이면 그대로 반환한다", async () => {
    const workflows = [{ id: 10, workflowCode: "refund-flow" }];
    mockedListWorkflows.mockResolvedValue(workflows);

    await expect(intentRevisionDraftApi.listWorkflows(1, 2, 3)).resolves.toEqual(workflows);
  });

  it("draft intent update와 discard는 generated endpoint를 호출한다", async () => {
    mockedUpdate.mockResolvedValue({ data: { id: 7, intentCode: "refund" } } as never);
    mockedDiscard.mockResolvedValue(undefined as never);

    await expect(
      intentRevisionDraftApi.updateDraftIntent(1, 2, 3, 7, {
        name: "환불 문의",
        description: "",
      }),
    ).resolves.toMatchObject({ id: 7, intentCode: "refund" });
    await intentRevisionDraftApi.discardDraft(1, 2, 3);

    expect(mockedUpdate).toHaveBeenCalledWith(1, 2, 3, 7, {
      name: "환불 문의",
      description: "",
    });
    expect(mockedDiscard).toHaveBeenCalledWith(1, 2, 3);
  });
});
