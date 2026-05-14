import { describe, expect, it } from "vitest";
import { STATUS_MAP } from "./nodeStyles";

describe("nodeStyles", () => {
  it("STATUS_MAP은 4개 상태를 모두 키로 가진다", () => {
    expect(Object.keys(STATUS_MAP)).toEqual([
      "IDLE",
      "ACTIVE",
      "COMPLETED",
      "FAILED",
    ]);
  });

  it("STATUS_MAP의 모든 값은 문자열이다", () => {
    const values = Object.values(STATUS_MAP);
    expect(values).toHaveLength(4);
    values.forEach((value) => {
      expect(typeof value).toBe("string");
    });
  });
});
