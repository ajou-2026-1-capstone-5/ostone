import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCard } from "./PlanCard";

describe("PlanCard", () => {
  it("이름·가격·기능 목록을 렌더링한다", () => {
    render(
      <PlanCard
        name="Pro"
        priceLabel="29,000원"
        periodLabel="/ 월"
        features={["워크스페이스 멤버 3명", "도메인팩 생성·검토 시간당 1회"]}
        action={<button type="button">업그레이드</button>}
      />,
    );
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("29,000원")).toBeTruthy();
    expect(screen.getByText("워크스페이스 멤버 3명")).toBeTruthy();
    expect(screen.getByText("업그레이드")).toBeTruthy();
  });

  it("popular면 인기 배지를 표시한다", () => {
    render(<PlanCard name="Pro" priceLabel="29,000원" features={[]} popular action={<span />} />);
    expect(screen.getByText("인기")).toBeTruthy();
  });

  it("current면 현재 플랜 태그를 표시한다", () => {
    render(<PlanCard name="Free" priceLabel="0원" features={[]} current action={<span />} />);
    expect(screen.getByText("현재 플랜")).toBeTruthy();
  });

  it("popular가 current보다 우선한다", () => {
    render(
      <PlanCard name="Pro" priceLabel="29,000원" features={[]} popular current action={<span />} />,
    );
    expect(screen.getByText("인기")).toBeTruthy();
    expect(screen.queryByText("현재 플랜")).toBeNull();
  });

  it("contactOnly면 가격 라벨을 표시하고 기간은 숨긴다", () => {
    render(
      <PlanCard
        name="Enterprise"
        priceLabel="문의"
        periodLabel="/ 월"
        contactOnly
        features={[]}
        action={<span />}
      />,
    );
    expect(screen.getByText("문의")).toBeTruthy();
    expect(screen.queryByText("/ 월")).toBeNull();
  });
});
