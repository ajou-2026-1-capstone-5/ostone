import { describe, expect, it } from "vitest";
import { loadToss, TossClientKeyMissingError, isTossClientKeyConfigured } from "./loadToss";

describe("TossClientKeyMissingError", () => {
  it("Error 인스턴스이다", () => {
    const err = new TossClientKeyMissingError();
    expect(err).toBeInstanceOf(Error);
  });

  it("name이 TossClientKeyMissingError이다", () => {
    const err = new TossClientKeyMissingError();
    expect(err.name).toBe("TossClientKeyMissingError");
  });

  it("메시지가 있다", () => {
    const err = new TossClientKeyMissingError();
    expect(err.message.length).toBeGreaterThan(0);
  });
});

describe("loadToss", () => {
  it("VITE_TOSS_CLIENT_KEY 미설정 시 TossClientKeyMissingError로 reject", async () => {
    await expect(loadToss()).rejects.toBeInstanceOf(TossClientKeyMissingError);
  });
});

describe("isTossClientKeyConfigured", () => {
  it("VITE_TOSS_CLIENT_KEY 미설정 시 false 반환", () => {
    expect(isTossClientKeyConfigured()).toBe(false);
  });
});
