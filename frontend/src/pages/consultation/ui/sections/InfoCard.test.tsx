import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoCard } from "./InfoCard";

describe("InfoCard", () => {
  it("renders title as level-3 heading + content slot", () => {
    render(
      <InfoCard title="고객 정보">
        <span data-testid="child">payload</span>
      </InfoCard>,
    );

    const heading = screen.getByRole("heading", { level: 3, name: "고객 정보" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId("info-card-content")).toHaveTextContent("payload");
  });

  it("renders meta string when provided", () => {
    render(
      <InfoCard title="문의 관련 주문" meta="#ORD-2024-08921">
        <div />
      </InfoCard>,
    );

    expect(screen.getByTestId("info-card-meta")).toHaveTextContent("#ORD-2024-08921");
  });

  it("omits meta slot when not provided", () => {
    render(
      <InfoCard title="확인된 정보">
        <div />
      </InfoCard>,
    );

    expect(screen.queryByTestId("info-card-meta")).not.toBeInTheDocument();
  });

  it("uses explicit testId when provided", () => {
    render(
      <InfoCard title="처리 단계" testId="custom-card">
        <div />
      </InfoCard>,
    );

    expect(screen.getByTestId("custom-card")).toBeInTheDocument();
  });
});
