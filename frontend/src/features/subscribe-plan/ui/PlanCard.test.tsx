import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCard } from "./PlanCard";

describe("PlanCard", () => {
  it("Pro 플랜 이름을 렌더링한다", () => {
    render(<PlanCard action={<button type="button">시작</button>} />);
    expect(screen.getByText(/Pro/i)).toBeTruthy();
  });

  it("action prop을 렌더링한다", () => {
    render(<PlanCard action={<button type="button">카드 등록</button>} />);
    expect(screen.getByText("카드 등록")).toBeTruthy();
  });

  it("note prop이 있으면 표시한다", () => {
    render(<PlanCard action={<button type="button">시작</button>} note="특별 안내사항" />);
    expect(screen.getByText("특별 안내사항")).toBeTruthy();
  });

  it("note prop이 없으면 표시하지 않는다", () => {
    const { container } = render(<PlanCard action={<button type="button">시작</button>} />);
    expect(container.querySelector("p.note")).toBeNull();
  });

  it("플랜 기능 목록을 렌더링한다", () => {
    render(<PlanCard action={<button type="button">시작</button>} />);
    expect(screen.getByText("워크스페이스 전체 멤버 이용")).toBeTruthy();
  });
});
