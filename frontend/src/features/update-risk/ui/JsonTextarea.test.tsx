import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonTextarea } from "./JsonTextarea";

describe("JsonTextarea", () => {
  it("renders as a monospace textarea with spellcheck disabled", () => {
    render(<JsonTextarea aria-label="JSON 입력" className="custom-class" />);

    const textarea = screen.getByLabelText("JSON 입력");
    expect(textarea).toHaveClass("font-mono");
    expect(textarea).toHaveClass("custom-class");
    expect(textarea).toHaveAttribute("spellcheck", "false");
  });
});
