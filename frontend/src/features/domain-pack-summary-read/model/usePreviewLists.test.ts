import { describe, expect, it, vi, beforeEach } from "vitest";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { useListSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { useListRisks } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { useListWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import {
  useIntentPreview,
  useSlotPreview,
  usePolicyPreview,
  useRiskPreview,
  useWorkflowPreview,
} from "./usePreviewLists";

vi.mock(
  "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller",
  () => ({
    useListIntents: vi
      .fn()
      .mockReturnValue({ isLoading: false, isFetching: false, data: undefined, isError: false }),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller",
  () => ({
    useListSlots: vi
      .fn()
      .mockReturnValue({ isLoading: false, isFetching: false, data: undefined, isError: false }),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useListPolicies: vi
      .fn()
      .mockReturnValue({ isLoading: false, isFetching: false, data: undefined, isError: false }),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    useListRisks: vi
      .fn()
      .mockReturnValue({ isLoading: false, isFetching: false, data: undefined, isError: false }),
  }),
);
vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useListWorkflows: vi
      .fn()
      .mockReturnValue({ isLoading: false, isFetching: false, data: undefined, isError: false }),
  }),
);

const mockedUseListIntents = vi.mocked(useListIntents);
const mockedUseListSlots = vi.mocked(useListSlots);
const mockedUseListPolicies = vi.mocked(useListPolicies);
const mockedUseListRisks = vi.mocked(useListRisks);
const mockedUseListWorkflows = vi.mocked(useListWorkflows);

describe("useIntentPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    useIntentPreview(1, 2, null);
    const opts = mockedUseListIntents.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    useIntentPreview(1, 2, 3);
    const opts = mockedUseListIntents.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(true);
  });

  it("data를 .data에서 추출한다", () => {
    const result = { data: { data: [{ id: 1, name: "test" }] } };
    mockedUseListIntents.mockReturnValueOnce(result as ReturnType<typeof useListIntents>);
    const preview = useIntentPreview(1, 2, 3);
    expect(preview.data).toEqual(result.data);
  });

  it("select 콜백이 5개까지 슬라이스한다", () => {
    useIntentPreview(1, 2, 3);
    const opts = mockedUseListIntents.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const items = Array.from({ length: 8 }, (_, i) => ({ id: i + 1 }));
    const result = opts?.select?.({ data: items });
    expect(result).toHaveLength(5);
  });
});

describe("useSlotPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    useSlotPreview(1, 2, null);
    const opts = mockedUseListSlots.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    useSlotPreview(1, 2, 3);
    const opts = mockedUseListSlots.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(true);
  });

  it("data를 .data에서 추출한다", () => {
    const result = { data: { data: [{ id: 1, name: "slot1" }] } };
    mockedUseListSlots.mockReturnValueOnce(result as ReturnType<typeof useListSlots>);
    const preview = useSlotPreview(1, 2, 3);
    expect(preview.data).toEqual(result.data);
  });

  it("select 콜백이 5개까지 슬라이스한다", () => {
    useSlotPreview(1, 2, 3);
    const opts = mockedUseListSlots.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const items = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));
    expect(opts?.select?.({ data: items })).toHaveLength(5);
  });
});

describe("usePolicyPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    usePolicyPreview(1, 2, null);
    const opts = mockedUseListPolicies.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    usePolicyPreview(1, 2, 3);
    const opts = mockedUseListPolicies.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(true);
  });

  it("data를 .data에서 추출한다", () => {
    const result = { data: { data: [{ id: 1, name: "policy1" }] } };
    mockedUseListPolicies.mockReturnValueOnce(result as ReturnType<typeof useListPolicies>);
    const preview = usePolicyPreview(1, 2, 3);
    expect(preview.data).toEqual(result.data);
  });

  it("select 콜백이 5개까지 슬라이스한다", () => {
    usePolicyPreview(1, 2, 3);
    const opts = mockedUseListPolicies.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i + 1 }));
    expect(opts?.select?.({ data: items })).toHaveLength(5);
  });
});

describe("useRiskPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    useRiskPreview(1, 2, null);
    const opts = mockedUseListRisks.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    useRiskPreview(1, 2, 3);
    const opts = mockedUseListRisks.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(true);
  });

  it("data를 .data에서 추출한다", () => {
    const result = { data: { data: [{ id: 1, name: "risk1" }] } };
    mockedUseListRisks.mockReturnValueOnce(result as ReturnType<typeof useListRisks>);
    const preview = useRiskPreview(1, 2, 3);
    expect(preview.data).toEqual(result.data);
  });

  it("select 콜백이 5개까지 슬라이스한다", () => {
    useRiskPreview(1, 2, 3);
    const opts = mockedUseListRisks.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const items = Array.from({ length: 9 }, (_, i) => ({ id: i + 1 }));
    expect(opts?.select?.({ data: items })).toHaveLength(5);
  });
});

describe("useWorkflowPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    useWorkflowPreview(1, 2, null);
    const opts = mockedUseListWorkflows.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    useWorkflowPreview(1, 2, 3);
    const opts = mockedUseListWorkflows.mock.calls[0]?.[3]?.query as { enabled?: boolean };
    expect(opts?.enabled).toBe(true);
  });

  it("data를 .data에서 추출한다", () => {
    const result = { data: { data: [{ id: 1, name: "wf1" }] } };
    mockedUseListWorkflows.mockReturnValueOnce(result as ReturnType<typeof useListWorkflows>);
    const preview = useWorkflowPreview(1, 2, 3);
    expect(preview.data).toEqual(result.data);
  });

  it("select 콜백이 5개까지 슬라이스한다", () => {
    useWorkflowPreview(1, 2, 3);
    const opts = mockedUseListWorkflows.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    expect(opts?.select?.({ data: items })).toHaveLength(5);
  });
});
