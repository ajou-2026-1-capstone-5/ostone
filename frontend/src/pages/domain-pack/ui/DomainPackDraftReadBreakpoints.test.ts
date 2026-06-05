import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readCss(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), "utf8");
}

describe("Domain Pack draft read responsive breakpoints", () => {
  it("Policy/Risk 목록-상세 전환은 모바일 폭에서만 적용한다", () => {
    const policyCss = readCss("./policy-draft-read-page.module.css");
    const riskCss = readCss("./risk-draft-read-page.module.css");

    expect(policyCss).toContain("@media (max-width: 767px)");
    expect(riskCss).toContain("@media (max-width: 767px)");
    expect(policyCss).not.toMatch(/15(?:99|00)px/);
    expect(riskCss).not.toMatch(/15(?:99|00)px/);
  });
});
