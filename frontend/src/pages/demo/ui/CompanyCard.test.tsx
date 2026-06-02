import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyCard } from "./CompanyCard";
import type { DemoCompany } from "../model/demoCompanies";

const enabledCompany: DemoCompany = {
  workspaceId: 1,
  name: "액티벤처 여행 상담",
  industry: "여행 · 예약",
  blurb: "항공권 · 취소 상담",
  focusChips: ["항공권 문의"],
  enabled: true,
};

const disabledCompany: DemoCompany = {
  ...enabledCompany,
  workspaceId: 3,
  name: "인디고발리 숙소 예약",
  enabled: false,
};

describe("CompanyCard", () => {
  it("renders an enabled company as available", () => {
    render(<CompanyCard company={enabledCompany} active={false} onActivate={vi.fn()} />);
    expect(screen.getByTestId("demo-company-card-1")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("demo-company-status-1")).toHaveTextContent("상담 가능");
  });

  it("renders a disabled company as a preview", () => {
    render(<CompanyCard company={disabledCompany} active={false} onActivate={vi.fn()} />);
    expect(screen.getByTestId("demo-company-card-3")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("demo-company-status-3")).toHaveTextContent("데모 준비 중");
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
