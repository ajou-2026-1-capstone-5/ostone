import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryJsonCard } from "./SummaryJsonCard";

describe("SummaryJsonCard", () => {
  it("유효한 JSON 객체는 key-value 형태로 렌더링한다", () => {
    render(<SummaryJsonCard summaryJson='{"intent":"greeting","count":3}' />);
    expect(screen.getByText("intent")).toBeInTheDocument();
    expect(screen.getByText("greeting")).toBeInTheDocument();
    expect(screen.getByText("count")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("빈 JSON 객체는 '내용 없음'을 표시한다", () => {
    render(<SummaryJsonCard summaryJson="{}" />);
    expect(screen.getByText("내용 없음")).toBeInTheDocument();
  });

  it("유효하지 않은 JSON은 파싱 실패 경고와 원문을 표시한다", () => {
    render(<SummaryJsonCard summaryJson="{bad}" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("{bad}")).toBeInTheDocument();
  });

  it("Raw JSON 버튼 클릭 시 원문 JSON을 표시한다", () => {
    const json = '{"key":"val"}';
    render(<SummaryJsonCard summaryJson={json} />);
    fireEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    expect(screen.getByText(json)).toBeInTheDocument();
  });

  it("카드 버튼으로 다시 카드 모드로 전환한다", () => {
    render(<SummaryJsonCard summaryJson='{"k":"v"}' />);
    fireEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "카드" }));
    expect(screen.getByText("k")).toBeInTheDocument();
    expect(screen.getByText("v")).toBeInTheDocument();
  });

  it("객체 값은 JSON 문자열로 렌더링한다", () => {
    render(<SummaryJsonCard summaryJson='{"nested":{"a":1}}' />);
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
  });

  it("null 값은 'null' 문자열로 렌더링한다", () => {
    render(<SummaryJsonCard summaryJson='{"key":null}' />);
    expect(screen.getByText("null")).toBeInTheDocument();
  });
});
