import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  useGetDomainPack,
  useGetDomainPackVersion,
} from "@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller";
import { usePackDetail, useVersionDetail } from "./usePackDetail";

vi.mock("@/shared/api/generated/endpoints/domain-pack-controller/domain-pack-controller", () => ({
  useGetDomainPack: vi.fn(),
  useGetDomainPackVersion: vi.fn(),
}));

const mockedUseGetDomainPack = vi.mocked(useGetDomainPack);
const mockedUseGetDomainPackVersion = vi.mocked(useGetDomainPackVersion);

describe("usePackDetail", () => {
  beforeEach(() => mockedUseGetDomainPack.mockClear());

  it("useGetDomainPack을 호출한다", () => {
    mockedUseGetDomainPack.mockReturnValue({ isLoading: false } as ReturnType<
      typeof useGetDomainPack
    >);
    usePackDetail(1, 2);
    expect(mockedUseGetDomainPack).toHaveBeenCalledWith(
      1,
      2,
      expect.objectContaining({
        query: expect.objectContaining({
          queryKey: ["domain-packs", "detail", 1, 2],
          select: expect.any(Function),
        }),
      }),
    );
  });

  it("결과를 그대로 반환한다", () => {
    const result = { isSuccess: true, data: { packId: 2, name: "Test Pack", versions: [] } };
    mockedUseGetDomainPack.mockReturnValue(result as ReturnType<typeof useGetDomainPack>);
    const hookResult = usePackDetail(1, 2);
    expect(hookResult.isSuccess).toBe(true);
    expect(hookResult.data).toEqual(result.data);
  });

  it("select 콜백이 data envelope를 언랩한다", () => {
    usePackDetail(1, 2);
    const opts = mockedUseGetDomainPack.mock.calls[0]?.[2]?.query as {
      select?: (data: unknown) => unknown;
    };
    const payload = { packId: 2, name: "Pack", versions: [] };
    expect(opts?.select?.({ data: payload })).toEqual(payload);
  });
});

describe("useVersionDetail", () => {
  beforeEach(() => mockedUseGetDomainPackVersion.mockClear());

  it("versionId가 null이면 enabled:false로 호출한다", () => {
    mockedUseGetDomainPackVersion.mockReturnValue({ isLoading: false } as ReturnType<
      typeof useGetDomainPackVersion
    >);
    useVersionDetail(1, 2, null);
    const opts = mockedUseGetDomainPackVersion.mock.calls[0]?.[3]?.query as {
      enabled?: boolean;
    };
    expect(opts?.enabled).toBe(false);
  });

  it("versionId가 있으면 enabled:true로 호출한다", () => {
    mockedUseGetDomainPackVersion.mockReturnValue({ isLoading: false } as ReturnType<
      typeof useGetDomainPackVersion
    >);
    useVersionDetail(1, 2, 5);
    const opts = mockedUseGetDomainPackVersion.mock.calls[0]?.[3]?.query as {
      enabled?: boolean;
    };
    expect(opts?.enabled).toBe(true);
  });

  it("select 콜백이 data envelope를 언랩한다", () => {
    mockedUseGetDomainPackVersion.mockReturnValue({ isLoading: false } as ReturnType<
      typeof useGetDomainPackVersion
    >);
    useVersionDetail(1, 2, 3);
    const opts = mockedUseGetDomainPackVersion.mock.calls[0]?.[3]?.query as {
      select?: (data: unknown) => unknown;
    };
    const payload = { versionId: 3, versionNo: 1, lifecycleStatus: "DRAFT" };
    expect(opts?.select?.({ data: payload })).toEqual(payload);
  });
});
