// @vitest-environment node

import { describe, expect, it } from "vitest";
import { requireApiData, selectApiData, selectApiList } from "./apiResponse";

describe("apiResponse selectors", () => {
  it("data envelope에서 payload를 선택한다", () => {
    expect(selectApiData({ data: { id: 1 } })).toEqual({ id: 1 });
  });

  it("raw body payload를 그대로 반환한다", () => {
    const response = { id: 1 };

    expect(selectApiData(response)).toBe(response);
  });

  it("list payload가 없으면 빈 배열을 반환한다", () => {
    expect(selectApiList(undefined)).toEqual([]);
  });

  it("data envelope와 raw list 모두 배열로 선택한다", () => {
    expect(selectApiList({ data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(selectApiList([{ id: 2 }])).toEqual([{ id: 2 }]);
  });

  it("required payload가 없으면 에러를 던진다", () => {
    expect(() => requireApiData(undefined, "missing")).toThrow("missing");
  });
});
