import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoRow } from "./InfoRow";

describe("InfoRow", () => {
  it("renders label + value text", () => {
    render(<InfoRow label="이름" value="김민지" testId="row-name" />);

    const row = screen.getByTestId("row-name");
    expect(row).toHaveTextContent("이름");
    expect(row).toHaveTextContent("김민지");
  });

  it("defaults to data-tone='default' when tone is omitted", () => {
    render(<InfoRow label="채널" value="카카오톡" testId="row-channel" />);
    expect(screen.getByTestId("row-channel")).toHaveAttribute("data-tone", "default");
  });

  it.each(["signal", "warn", "danger"] as const)(
    "propagates tone='%s' to data-tone attribute",
    (tone) => {
      render(<InfoRow label="상태" value="OK" tone={tone} testId={`row-${tone}`} />);
      expect(screen.getByTestId(`row-${tone}`)).toHaveAttribute("data-tone", tone);
    },
  );

  it("supports ReactNode as value (e.g., Pill)", () => {
    render(
      <InfoRow
        label="상태"
        value={<span data-testid="custom-pill">배송 완료</span>}
        testId="row-status"
      />,
    );

    expect(screen.getByTestId("custom-pill")).toBeInTheDocument();
  });
});
