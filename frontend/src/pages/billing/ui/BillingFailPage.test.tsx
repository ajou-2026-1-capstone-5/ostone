import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BillingFailPage } from "./BillingFailPage";

function renderWithRouter(searchParams = "") {
  const navigate = vi.fn();
  vi.mock("react-router-dom", async (importOriginal) => {
    const original = await importOriginal<typeof import("react-router-dom")>();
    return { ...original };
  });

  return render(
    <MemoryRouter initialEntries={[`/billing/fail${searchParams}`]}>
      <Routes>
        <Route path="/billing/fail" element={<BillingFailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BillingFailPage", () => {
  it("실패 제목을 렌더링한다", () => {
    renderWithRouter("?workspaceId=1");
    expect(screen.getByText("결제가 완료되지 않았습니다")).toBeTruthy();
  });

  it("code 파라미터가 있으면 오류 코드 표시", () => {
    renderWithRouter("?workspaceId=1&code=CARD_DECLINED&message=카드가 거절됐습니다");
    expect(screen.getByText(/오류 코드/)).toBeTruthy();
    expect(screen.getByText("카드가 거절됐습니다")).toBeTruthy();
  });

  it("code 파라미터가 없으면 오류 코드 표시 안 함", () => {
    renderWithRouter("?workspaceId=1");
    expect(screen.queryByText(/오류 코드/)).toBeNull();
  });

  it("message 파라미터가 없으면 기본 안내 메시지 표시", () => {
    renderWithRouter("?workspaceId=1");
    expect(screen.getByText(/결제가 취소되었거나/)).toBeTruthy();
  });

  it("다시 시도 버튼이 렌더링된다", () => {
    renderWithRouter("?workspaceId=1");
    expect(screen.getByText("다시 시도")).toBeTruthy();
  });

  it("workspaceId 없으면 workspaces로 이동", () => {
    renderWithRouter("");
    const btn = screen.getByText("다시 시도");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
  });
});
