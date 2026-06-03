import { describe, expect, it } from "vitest";
import {
  getSubscriptionStatusMeta,
  getPaymentStatusMeta,
  isSubscriptionEngaged,
} from "./status";

describe("getSubscriptionStatusMeta", () => {
  it("ACTIVE: solid variant", () => {
    const meta = getSubscriptionStatusMeta("ACTIVE");
    expect(meta.variant).toBe("solid");
    expect(meta.label).toBe("구독 중");
  });

  it("INCOMPLETE: outline variant", () => {
    const meta = getSubscriptionStatusMeta("INCOMPLETE");
    expect(meta.variant).toBe("outline");
  });

  it("PAST_DUE: outline variant", () => {
    const meta = getSubscriptionStatusMeta("PAST_DUE");
    expect(meta.variant).toBe("outline");
  });

  it("CANCELED: muted variant", () => {
    const meta = getSubscriptionStatusMeta("CANCELED");
    expect(meta.variant).toBe("muted");
  });

  it("미정의 status는 원문 label + outline", () => {
    const meta = getSubscriptionStatusMeta("UNKNOWN_STATUS");
    expect(meta.label).toBe("UNKNOWN_STATUS");
    expect(meta.variant).toBe("outline");
  });

  it("undefined status는 '알 수 없음' + outline", () => {
    const meta = getSubscriptionStatusMeta(undefined);
    expect(meta.label).toBe("알 수 없음");
    expect(meta.variant).toBe("outline");
  });
});

describe("getPaymentStatusMeta", () => {
  it("DONE: solid variant", () => {
    const meta = getPaymentStatusMeta("DONE");
    expect(meta.variant).toBe("solid");
    expect(meta.label).toBe("완료");
  });

  it("READY: outline variant", () => {
    const meta = getPaymentStatusMeta("READY");
    expect(meta.variant).toBe("outline");
  });

  it("IN_PROGRESS: outline variant", () => {
    const meta = getPaymentStatusMeta("IN_PROGRESS");
    expect(meta.variant).toBe("outline");
  });

  it("CANCELED: muted variant", () => {
    const meta = getPaymentStatusMeta("CANCELED");
    expect(meta.variant).toBe("muted");
  });

  it("PARTIAL_CANCELED: muted variant", () => {
    const meta = getPaymentStatusMeta("PARTIAL_CANCELED");
    expect(meta.variant).toBe("muted");
  });

  it("ABORTED: muted variant", () => {
    const meta = getPaymentStatusMeta("ABORTED");
    expect(meta.variant).toBe("muted");
  });

  it("EXPIRED: muted variant", () => {
    const meta = getPaymentStatusMeta("EXPIRED");
    expect(meta.variant).toBe("muted");
  });

  it("미정의 status는 원문 label + outline", () => {
    const meta = getPaymentStatusMeta("REFUNDED");
    expect(meta.label).toBe("REFUNDED");
    expect(meta.variant).toBe("outline");
  });

  it("undefined status는 '알 수 없음' + outline", () => {
    const meta = getPaymentStatusMeta(undefined);
    expect(meta.label).toBe("알 수 없음");
    expect(meta.variant).toBe("outline");
  });
});

describe("isSubscriptionEngaged", () => {
  it("ACTIVE이면 true", () => {
    expect(isSubscriptionEngaged("ACTIVE")).toBe(true);
  });

  it("PAST_DUE이면 true", () => {
    expect(isSubscriptionEngaged("PAST_DUE")).toBe(true);
  });

  it("INCOMPLETE이면 false", () => {
    expect(isSubscriptionEngaged("INCOMPLETE")).toBe(false);
  });

  it("CANCELED이면 false", () => {
    expect(isSubscriptionEngaged("CANCELED")).toBe(false);
  });

  it("undefined이면 false", () => {
    expect(isSubscriptionEngaged(undefined)).toBe(false);
  });

  it("임의 문자열이면 false", () => {
    expect(isSubscriptionEngaged("OTHER")).toBe(false);
  });
});
