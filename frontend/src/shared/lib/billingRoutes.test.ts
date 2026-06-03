import { describe, expect, it } from "vitest";
import {
  BILLING_FLOW,
  buildWorkspaceBillingPath,
  buildBillingSuccessUrl,
  buildBillingFailUrl,
} from "./billingRoutes";

describe("BILLING_FLOW", () => {
  it("billing 값이 존재", () => {
    expect(BILLING_FLOW.billing).toBe("billing");
  });

  it("widget 값이 존재", () => {
    expect(BILLING_FLOW.widget).toBe("widget");
  });
});

describe("buildWorkspaceBillingPath", () => {
  it("숫자 workspaceId로 경로 생성", () => {
    expect(buildWorkspaceBillingPath(42)).toBe("/workspaces/42/billing");
  });

  it("문자열 workspaceId로 경로 생성", () => {
    expect(buildWorkspaceBillingPath("abc")).toBe("/workspaces/abc/billing");
  });
});

describe("buildBillingSuccessUrl", () => {
  it("workspaceId와 flow가 URL에 포함됨 (billing flow)", () => {
    const url = buildBillingSuccessUrl(1, BILLING_FLOW.billing);
    expect(url).toContain("/billing/success");
    expect(url).toContain("workspaceId=1");
    expect(url).toContain("flow=billing");
  });

  it("workspaceId와 flow가 URL에 포함됨 (widget flow)", () => {
    const url = buildBillingSuccessUrl(7, BILLING_FLOW.widget);
    expect(url).toContain("workspaceId=7");
    expect(url).toContain("flow=widget");
  });

  it("절대 URL 형식 (origin 포함)", () => {
    const url = buildBillingSuccessUrl(1, BILLING_FLOW.billing);
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe("buildBillingFailUrl", () => {
  it("workspaceId와 flow가 URL에 포함됨", () => {
    const url = buildBillingFailUrl(3, BILLING_FLOW.widget);
    expect(url).toContain("/billing/fail");
    expect(url).toContain("workspaceId=3");
    expect(url).toContain("flow=widget");
  });

  it("절대 URL 형식 (origin 포함)", () => {
    const url = buildBillingFailUrl(5, BILLING_FLOW.billing);
    expect(url).toMatch(/^https?:\/\//);
  });
});
