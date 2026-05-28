import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatHeader } from "./ChatHeader";
import { deriveAvatarInitial } from "./deriveAvatarInitial";

describe("deriveAvatarInitial", () => {
  it("returns first hangul character for Korean names", () => {
    expect(deriveAvatarInitial("김민지")).toBe("김");
    expect(deriveAvatarInitial("이준혁")).toBe("이");
  });

  it("returns up to 2 uppercase letters for ASCII names", () => {
    expect(deriveAvatarInitial("john")).toBe("JO");
    expect(deriveAvatarInitial("a")).toBe("A");
  });

  it("returns '?' for empty/whitespace name", () => {
    expect(deriveAvatarInitial("")).toBe("?");
    expect(deriveAvatarInitial("   ")).toBe("?");
  });
});

describe("ChatHeader", () => {
  it("renders avatar initial, name, session eyebrow", () => {
    render(<ChatHeader customerName="김민지" sessionId="77" status="OPEN" />);

    expect(screen.getByTestId("chat-header-avatar")).toHaveTextContent("김");
    expect(screen.getByTestId("chat-header-name")).toHaveTextContent("김민지");
    expect(screen.getByTestId("chat-header-eyebrow")).toHaveTextContent("Session #77");
  });

  it("status pill renders text and tone for OPEN", () => {
    render(<ChatHeader customerName="김민지" sessionId="77" status="OPEN" />);

    const pill = screen.getByTestId("chat-header-status");
    expect(pill).toHaveTextContent("OPEN");
    expect(pill.style.background).toBe("var(--signal-bg)");
  });

  it("status pill changes appearance for non-OPEN states", () => {
    render(<ChatHeader customerName="김민지" sessionId="77" status="CLOSED" />);

    const pill = screen.getByTestId("chat-header-status");
    expect(pill).toHaveTextContent("CLOSED");
    expect(pill.style.background).toBe("var(--paper-3)");
  });
});
