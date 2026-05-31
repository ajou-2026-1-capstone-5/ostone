import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyCard } from "./CompanyCard";
import type { DemoCompany } from "../model/demoCompanies";

const enabledCompany: DemoCompany = {
  workspaceId: 1,
  name: "컴플레인 테스트 워크스페이스",
  industry: "리테일 · CS 운영",
  blurb: "환불 · 배송 상담",
  focusChips: ["환불 요청"],
  enabled: true,
};

const disabledCompany: DemoCompany = {
  ...enabledCompany,
  workspaceId: 2,
  name: "카드 이용내역 조회 상담",
  enabled: false,
};

describe("CompanyCard", () => {
  it("renders an enabled company as available", () => {
    render(<CompanyCard company={enabledCompany} active={false} onActivate={vi.fn()} />);
    expect(screen.getByTestId("demo-company-card-1")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByTestId("demo-company-status-1")).toHaveTextContent("상담 가능");
  });

  it("renders a disabled company as a preview", () => {
    render(<CompanyCard company={disabledCompany} active={false} onActivate={vi.fn()} />);
    expect(screen.getByTestId("demo-company-card-2")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("demo-company-status-2")).toHaveTextContent("데모 준비 중");
  });

  it("activates on click and on hover with the company reference", () => {
    const onActivate = vi.fn();
    render(<CompanyCard company={enabledCompany} active={false} onActivate={onActivate} />);
    const card = screen.getByTestId("demo-company-card-1");
    fireEvent.mouseEnter(card);
    fireEvent.click(card);
    expect(onActivate.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onActivate.mock.calls.every((call) => call[0] === enabledCompany)).toBe(true);
  });

  it("reflects the active state via aria-pressed", () => {
    render(<CompanyCard company={enabledCompany} active onActivate={vi.fn()} />);
    expect(screen.getByTestId("demo-company-card-1")).toHaveAttribute("aria-pressed", "true");
  });
});
