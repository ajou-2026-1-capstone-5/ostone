import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BillingMethodCard } from "./BillingMethodCard";

const stubBillingKey = { cardCompany: "신한카드", cardNumberMasked: "12**-**34" };

describe("BillingMethodCard", () => {
  it("billingKey가 있으면 카드사와 마스킹 번호를 표시한다", () => {
    render(<BillingMethodCard billingKey={stubBillingKey} />);
    expect(screen.getByText("신한카드")).toBeTruthy();
    expect(screen.getByText("12**-**34")).toBeTruthy();
  });

  it("billingKey 없고 fallbackMethod 있으면 fallback 표시", () => {
    render(<BillingMethodCard fallbackMethod="현대카드" />);
    expect(screen.getByText("현대카드")).toBeTruthy();
  });

  it("둘 다 없으면 기본 안내 문구 표시", () => {
    render(<BillingMethodCard />);
    expect(screen.getByText(/자동결제 수단이 등록되어 있습니다/)).toBeTruthy();
  });

  it("cardNumberMasked가 null이면 빈 문자열로 표시", () => {
    const keyWithNullMasked = { cardCompany: "국민카드", cardNumberMasked: null };
    const { container } = render(<BillingMethodCard billingKey={keyWithNullMasked as never} />);
    expect(container).toBeTruthy();
  });
});
