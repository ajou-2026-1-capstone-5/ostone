import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoPage } from "./DemoPage";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderDemoPage() {
  return render(
    <MemoryRouter initialEntries={["/demo"]}>
      <DemoPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("DemoPage", () => {
  it("renders every demo company and pre-focuses the enabled one", () => {
    renderDemoPage();
    expect(screen.getByTestId("demo-company-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("demo-company-card-2")).toBeInTheDocument();
    expect(screen.getByTestId("demo-company-card-3")).toBeInTheDocument();
    expect(screen.getByTestId("demo-company-info")).toHaveTextContent("컴플레인 테스트 워크스페이스");
  });

  it("shows a company's info on hover", () => {
    renderDemoPage();
    fireEvent.mouseEnter(screen.getByTestId("demo-company-card-2"));
    expect(screen.getByTestId("demo-company-info")).toHaveTextContent("카드 이용내역 조회 상담");
  });

  it("navigates to the chat with an encoded name for an enabled company", () => {
    renderDemoPage();
    fireEvent.click(screen.getByTestId("demo-company-card-1"));
    fireEvent.change(screen.getByTestId("demo-name-input"), { target: { value: "김민지" } });
    fireEvent.click(screen.getByTestId("demo-start-chat"));
    expect(navigateMock).toHaveBeenCalledWith(
      `/demo/workspaces/1/chat?name=${encodeURIComponent("김민지")}`,
    );
  });

  it("blocks submit and shows an error for an empty name", () => {
    renderDemoPage();
    fireEvent.click(screen.getByTestId("demo-company-card-1"));
    fireEvent.click(screen.getByTestId("demo-start-chat"));
    expect(screen.getByTestId("demo-name-error")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not start a chat for a preview company", () => {
    renderDemoPage();
    fireEvent.click(screen.getByTestId("demo-company-card-2"));
    expect(screen.getByTestId("demo-start-chat")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("demo-name-form"));
    expect(screen.getByTestId("demo-name-error")).toHaveTextContent("데모를 준비 중");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
