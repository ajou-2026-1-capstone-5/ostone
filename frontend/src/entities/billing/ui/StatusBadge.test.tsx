import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("label을 렌더링한다", () => {
    render(<StatusBadge label="구독 중" variant="solid" />);
    expect(screen.getByText("구독 중")).toBeTruthy();
  });

  it("outline variant를 렌더링한다", () => {
    render(<StatusBadge label="대기" variant="outline" />);
    expect(screen.getByText("대기")).toBeTruthy();
  });

  it("muted variant를 렌더링한다", () => {
    render(<StatusBadge label="취소됨" variant="muted" />);
    expect(screen.getByText("취소됨")).toBeTruthy();
  });
});
