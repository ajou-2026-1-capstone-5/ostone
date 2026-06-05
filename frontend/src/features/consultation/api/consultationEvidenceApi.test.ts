import { describe, expect, it, vi, beforeEach } from "vitest";
import { customFetch } from "@/shared/api/mutator";
import { consultationEvidenceApi } from "./consultationEvidenceApi";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedFetch = vi.mocked(customFetch);

describe("consultationEvidenceApi", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("normalizes message evidence and builds domain pack detail paths", async () => {
    mockedFetch.mockResolvedValueOnce({
      data: {
        slots: [
          {
            id: 10,
            code: "orderNumber",
            name: "주문 번호",
            extracted: true,
            value: "ORD-1",
          },
        ],
        policies: [
          {
            id: 20,
            code: "refund_policy",
            name: "환불 정책",
            extracted: true,
            matched: true,
          },
        ],
        risks: [
          {
            id: 30,
            code: "high_refund",
            name: "고액 환불",
            extracted: true,
            level: "HIGH",
          },
        ],
      },
    });

    const result = await consultationEvidenceApi.getMessageDomainPackElements(
      1,
      100,
      {
        workspaceId: 2,
        packId: 4,
        versionId: 8,
      },
    );

    expect(mockedFetch).toHaveBeenCalledWith(
      "/api/v1/consultation/sessions/1/messages/100/domain-pack-elements",
      { method: "GET" },
    );
    expect(result).toEqual({
      slots: [
        {
          name: "주문 번호",
          extracted: true,
          value: "ORD-1",
          detailPath: "/workspaces/2/domain-packs/4/slots/10?versionId=8",
        },
      ],
      policies: [
        {
          name: "환불 정책",
          extracted: true,
          matched: true,
          detailPath: "/workspaces/2/domain-packs/4/policies/20?versionId=8",
        },
      ],
      risks: [
        {
          name: "고액 환불",
          extracted: true,
          level: "high",
          detailPath: "/workspaces/2/domain-packs/4/risks/30?versionId=8",
        },
      ],
    });
  });

  it("keeps evidence unlinked when route context is incomplete", async () => {
    mockedFetch.mockResolvedValueOnce({
      slots: [{ code: "refundReason", extracted: false }],
      policies: [],
      risks: [],
    });

    const result = await consultationEvidenceApi.getMessageDomainPackElements(
      1,
      100,
      {
        workspaceId: 2,
        packId: null,
        versionId: null,
      },
    );

    expect(result.slots).toEqual([
      {
        name: "refundReason",
        extracted: false,
        detailPath: undefined,
      },
    ]);
  });
});
