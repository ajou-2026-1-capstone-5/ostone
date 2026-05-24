import { describe, expect, it } from "vitest";

import {
  domainPackPath,
  domainPackPathFromBase,
  domainPackSectionPath,
  domainPackSectionPathFromBase,
  shouldReplaceDomainPackChildRoute,
  withVersionSearch,
} from "./domainPackRoutes";

describe("domainPackRoutes", () => {
  it("versionId가 없으면 기존 경로를 그대로 반환한다", () => {
    expect(withVersionSearch("/workspaces/1/domain-packs/2", null)).toBe(
      "/workspaces/1/domain-packs/2",
    );
  });

  it("query string 유무에 맞춰 versionId를 추가한다", () => {
    expect(withVersionSearch("/workspaces/1/domain-packs/2/intents", 3)).toBe(
      "/workspaces/1/domain-packs/2/intents?versionId=3",
    );
    expect(withVersionSearch("/workspaces/1/domain-packs/2/intents?tab=diff", 3)).toBe(
      "/workspaces/1/domain-packs/2/intents?tab=diff&versionId=3",
    );
  });

  it("domain pack 기본 경로를 만든다", () => {
    expect(domainPackPath(1, 2)).toBe("/workspaces/1/domain-packs/2");
    expect(domainPackPathFromBase("/workspaces/1", 2)).toBe("/workspaces/1/domain-packs/2");
  });

  it("section 목록과 상세 경로를 versionId와 함께 만든다", () => {
    expect(domainPackSectionPath(1, 2, 3, "intents")).toBe(
      "/workspaces/1/domain-packs/2/intents?versionId=3",
    );
    expect(domainPackSectionPath(1, 2, 3, "intents", 4)).toBe(
      "/workspaces/1/domain-packs/2/intents/4?versionId=3",
    );
    expect(domainPackSectionPath(1, 2, null, "workflows", 4)).toBe(
      "/workspaces/1/domain-packs/2/workflows/4",
    );
  });

  it("base path 기반 section 경로를 만든다", () => {
    expect(domainPackSectionPathFromBase("/workspaces/1", 2, 3, "policies", 4)).toBe(
      "/workspaces/1/domain-packs/2/policies/4?versionId=3",
    );
  });

  it("이미 하위 상세 경로에 있으면 replace 대상이다", () => {
    expect(shouldReplaceDomainPackChildRoute(null)).toBe(false);
    expect(shouldReplaceDomainPackChildRoute(4)).toBe(true);
  });
});
