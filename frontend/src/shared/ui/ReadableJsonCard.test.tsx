import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadableJsonCard } from "./ReadableJsonCard";

describe("ReadableJsonCard", () => {
  it("객체 JSON을 운영자용 요약 행으로 표시하고 라벨을 보여준다", () => {
    render(<ReadableJsonCard label="감지 조건" raw='{"type":"MANUAL_REVIEW","channel":"web"}' />);

    expect(screen.getByText("감지 조건")).toBeInTheDocument();
    expect(screen.getByText("유형")).toBeInTheDocument();
    expect(screen.getByText("MANUAL_REVIEW")).toBeInTheDocument();
    expect(screen.getByText("채널")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
  });

  it("원본 JSON은 기본적으로 접혀 있고 토글로 펼칠 수 있다", () => {
    render(<ReadableJsonCard label="응대 방법" raw='{"type":"REFUND"}' />);

    expect(screen.queryByText(/"type": "REFUND"/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "원본 JSON 보기" }));

    expect(screen.getByText(/"type": "REFUND"/)).toBeInTheDocument();
  });

  it("배열 JSON은 목록으로 표시한다", () => {
    render(<ReadableJsonCard label="키워드" raw='["환불","교환"]' />);

    expect(screen.getByText("환불")).toBeInTheDocument();
    expect(screen.getByText("교환")).toBeInTheDocument();
  });

  it("빈 값은 — fallback을 표시하고 원본 보기 토글이 없다", () => {
    render(<ReadableJsonCard label="추가 정보" raw="" />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원본 JSON 보기" })).not.toBeInTheDocument();
  });

  it("파싱되지 않는 문자열은 원문을 안전하게 표시한다", () => {
    render(<ReadableJsonCard label="감지 조건" raw="{invalid-json" />);

    expect(screen.getByText("{invalid-json")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원본 JSON 보기" })).not.toBeInTheDocument();
  });
});
