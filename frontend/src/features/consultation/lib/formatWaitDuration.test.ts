import { describe, expect, it } from "vitest";
import { formatWaitDuration } from "./formatWaitDuration";

describe("formatWaitDuration", () => {
  it("formats durations under an hour as minutes", () => {
    expect(formatWaitDuration(59)).toBe("59분");
  });

  it("formats durations over an hour as hours", () => {
    expect(formatWaitDuration(60)).toBe("1시간");
    expect(formatWaitDuration(1439)).toBe("23시간");
  });

  it("formats durations over a day as days", () => {
    expect(formatWaitDuration(1440)).toBe("1일");
    expect(formatWaitDuration(2880)).toBe("2일");
  });
});
