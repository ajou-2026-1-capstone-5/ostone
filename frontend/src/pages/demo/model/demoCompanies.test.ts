import { describe, expect, it } from "vitest";
import { DEMO_COMPANIES, findDemoCompany, getDefaultDemoCompany } from "./demoCompanies";

describe("demoCompanies", () => {
  it("exposes a non-empty roster keyed by unique workspace ids", () => {
    expect(DEMO_COMPANIES.length).toBeGreaterThan(0);
    const ids = DEMO_COMPANIES.map((company) => company.workspaceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks workspace 1 as the enabled ActiveVenture scenario", () => {
    const company = findDemoCompany(1);
    expect(company).toBeDefined();
    expect(company?.enabled).toBe(true);
    expect(company?.name).toBe("액티벤처 여행 상담");
    expect(company?.focusChips.length).toBeGreaterThan(0);
  });

  it("marks workspace 2 as the enabled Hana Card scenario", () => {
    const company = findDemoCompany(2);
    expect(company).toBeDefined();
    expect(company?.enabled).toBe(true);
    expect(company?.name).toBe("하나카드 카드 상담");
    expect(company?.focusChips).toContain("분실 신고");
  });

  it("keeps fixture-only companies disabled", () => {
    expect(findDemoCompany(3)?.enabled).toBe(false);
  });

  it("returns undefined for an unknown workspace id", () => {
    expect(findDemoCompany(999)).toBeUndefined();
  });

  it("defaults to the first enabled company", () => {
    const fallback = getDefaultDemoCompany();
    expect(fallback.workspaceId).toBe(1);
    expect(fallback.enabled).toBe(true);
  });
});
