// @vitest-environment node

import { describe, expect, it } from "vitest";
import { unwrapApiResponse } from "./unwrapApiResponse";

describe("unwrapApiResponse", () => {
  it("data envelope가 있으면 내부 data를 반환한다", () => {
    expect(unwrapApiResponse({ data: { id: 1, name: "환불" } })).toEqual({
      id: 1,
      name: "환불",
    });
  });

  it("data가 없으면 원본 응답을 반환한다", () => {
    const response = { id: 1, name: "환불" };

    expect(unwrapApiResponse(response)).toBe(response);
  });
});
