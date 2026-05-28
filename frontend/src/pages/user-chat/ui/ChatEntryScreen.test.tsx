import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatEntryScreen } from "./ChatEntryScreen";

function setup(overrides: Partial<Parameters<typeof ChatEntryScreen>[0]> = {}) {
  const props: Parameters<typeof ChatEntryScreen>[0] = {
    draftName: "",
    nameError: null,
    workspaceId: 2,
    onDraftChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
  render(<ChatEntryScreen {...props} />);
  return props;
}

describe("ChatEntryScreen", () => {
  it("렌더 시 split brand + form 구조를 노출한다", () => {
    setup();

    expect(screen.getByTestId("chat-entry-screen")).toBeInTheDocument();
    expect(screen.getByTestId("chat-entry-brand")).toBeInTheDocument();
    const form = screen.getByTestId("chat-entry-form");
    expect(form).toHaveAttribute("aria-label", "채팅 사용자 이름 입력");
  });

  it("submit 버튼은 항상 enabled 이며 빈 이름 검증은 페이지 레벨에서 처리된다", () => {
    setup();

    expect(screen.getByTestId("chat-entry-submit")).toBeEnabled();
  });

  it("input 변경 시 onDraftChange 호출", () => {
    const onDraftChange = vi.fn();
    setup({ onDraftChange });

    fireEvent.change(screen.getByTestId("chat-name-input"), { target: { value: "김" } });
    expect(onDraftChange).toHaveBeenCalledWith("김");
  });

  it("submit 시 onSubmit 호출", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    setup({ draftName: "김민지", onSubmit });

    fireEvent.click(screen.getByTestId("chat-entry-submit"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("nameError 가 있으면 role=alert 으로 메시지 렌더", () => {
    setup({ nameError: "이름을 입력해 주세요." });

    const error = screen.getByTestId("chat-name-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent("이름을 입력해 주세요.");
  });

  it("workspaceId 가 brand 영역에 mono eyebrow 로 표기된다", () => {
    setup({ workspaceId: 42 });

    expect(screen.getByTestId("chat-entry-brand")).toHaveTextContent("Workspace #42");
  });
});
