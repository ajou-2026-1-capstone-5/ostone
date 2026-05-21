// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainPackVersionDetail, DomainPackVersionSummary } from "@/entities/domain-pack";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import type { IntentDefinitionSummary } from "@/shared/api/generated/zod";
import { useDomainPackApprovalReadiness } from "./useDomainPackApprovalReadiness";

vi.mock(
  "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller",
  () => ({
    useListIntents: vi.fn(),
  }),
);

const mockedUseListIntents = vi.mocked(useListIntents);

const versions: DomainPackVersionSummary[] = [
  { versionId: 1, versionNo: 1, lifecycleStatus: "PUBLISHED" },
  { versionId: 3, versionNo: 3, lifecycleStatus: "DRAFT" },
];

const latestDraftVersion: DomainPackVersionDetail = {
  versionId: 3,
  versionNo: 3,
  lifecycleStatus: "DRAFT",
};

const olderDraftVersion: DomainPackVersionDetail = {
  versionId: 2,
  versionNo: 2,
  lifecycleStatus: "DRAFT",
};

function intent(status: string): IntentDefinitionSummary {
  return { id: 1, status };
}

function mockIntentQuery(overrides: Partial<ReturnType<typeof useListIntents>> = {}) {
  const result = {
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  };

  mockedUseListIntents.mockReturnValue(result as ReturnType<typeof useListIntents>);
  return result;
}

describe("useDomainPackApprovalReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntentQuery();
  });

  it("최신 DRAFT 버전이면 Intent query를 enabled로 호출한다", () => {
    useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(mockedUseListIntents).toHaveBeenCalledWith(
      1,
      2,
      3,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: true }),
      }),
    );
  });

  it("Intent query 응답 wrapper를 unwrap하는 select 함수를 전달한다", () => {
    useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    const options = mockedUseListIntents.mock.calls[0]?.[3];
    const select = options?.query?.select as
      | ((response: { data: IntentDefinitionSummary[] }) => IntentDefinitionSummary[] | undefined)
      | undefined;

    expect(select?.({ data: [intent("PUBLISHED")] })).toEqual([intent("PUBLISHED")]);
  });

  it("Intent query가 로딩 중이면 loading readiness를 반환한다", () => {
    mockIntentQuery({ isLoading: true });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(readiness).toMatchObject({
      ready: false,
      isLoading: true,
      isError: false,
      blockers: [],
    });
  });

  it("최신 DRAFT 버전이고 DRAFT Intent가 없으면 ready를 반환한다", () => {
    mockIntentQuery({
      data: [intent("PUBLISHED"), intent("REJECTED")],
    });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it("DRAFT Intent가 남아 있으면 blocker와 Intent action path를 반환한다", () => {
    mockIntentQuery({
      data: [intent("DRAFT"), intent("PUBLISHED")],
    });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual([
      {
        type: "INTENT",
        count: 1,
        message: "승인 또는 반려되지 않은 Intent가 1개 남아 있습니다.",
        actionPath: "/workspaces/1/domain-packs/2/versions/3/intents",
      },
    ]);
  });

  it("선택 버전이 최신이 아니면 Intent query를 disabled로 두고 최신 버전 blocker를 반환한다", () => {
    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: olderDraftVersion,
      versions,
    });

    expect(mockedUseListIntents).toHaveBeenCalledWith(
      1,
      2,
      2,
      expect.objectContaining({
        query: expect.objectContaining({ enabled: false }),
      }),
    );
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers[0]).toMatchObject({
      type: "VERSION",
      message: "최신 버전만 승인할 수 있습니다.",
    });
  });

  it("Intent query 결과 데이터가 누락되면 fail-closed SERVER blocker를 반환한다", () => {
    mockIntentQuery({ data: undefined });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers[0]).toMatchObject({
      type: "SERVER",
      message: "승인 준비 상태를 확인하는 데 필요한 정보가 부족합니다.",
    });
  });

  it("Intent query가 실패하면 서버 blocker와 retry를 제공한다", () => {
    const refetch = vi.fn().mockResolvedValue({});
    mockIntentQuery({
      isError: true,
      refetch,
    });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.isError).toBe(true);
    expect(readiness.blockers[0]).toMatchObject({
      type: "SERVER",
      message: "승인 준비 상태를 확인하지 못했습니다.",
    });

    readiness.retry();

    expect(refetch).toHaveBeenCalled();
  });

  it("retry refetch 실패는 로그로 남긴다", async () => {
    const error = new Error("retry failed");
    const refetch = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockIntentQuery({ refetch });

    const readiness = useDomainPackApprovalReadiness({
      workspaceId: 1,
      packId: 2,
      version: latestDraftVersion,
      versions,
    });

    readiness.retry();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refetch domain pack approval readiness",
      error,
    );

    consoleError.mockRestore();
  });
});
