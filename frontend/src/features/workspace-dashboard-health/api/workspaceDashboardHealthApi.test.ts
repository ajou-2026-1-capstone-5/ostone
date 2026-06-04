import { describe, expect, it, vi, beforeEach } from "vitest";

import { customFetch } from "@/shared/api/mutator";

import { fetchWorkspaceDashboardActionRecommendations } from "./workspaceDashboardHealthApi";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedCustomFetch = vi.mocked(customFetch);

describe("workspaceDashboardHealthApi", () => {
  beforeEach(() => {
    mockedCustomFetch.mockReset();
  });

  it("fetchWorkspaceDashboardActionRecommendations가 기간 쿼리와 함께 추천 endpoint를 호출한다", async () => {
    const response = {
      workspaceId: 1,
      periodStart: "2026-05-29T00:00:00+09:00",
      periodEnd: "2026-06-05T00:00:00+09:00",
      recommendations: [],
    };
    mockedCustomFetch.mockResolvedValueOnce(response);

    const result = await fetchWorkspaceDashboardActionRecommendations(1, {
      from: "2026-05-29",
      to: "2026-06-04",
    });

    expect(mockedCustomFetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/1/dashboard/action-recommendations?from=2026-05-29&to=2026-06-04",
      { method: "GET", signal: undefined },
    );
    expect(result).toEqual(response);
  });
});
