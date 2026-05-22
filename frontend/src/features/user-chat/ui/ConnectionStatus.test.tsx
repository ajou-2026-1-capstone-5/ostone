import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionStatus } from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("CONNECTING 상태를 표시한다", () => {
    render(<ConnectionStatus status="CONNECTING" />);

    expect(screen.getByText("연결 중...")).toBeInTheDocument();
  });

  it("CONNECTED 상태를 표시한다", () => {
    render(<ConnectionStatus status="CONNECTED" />);

    expect(screen.getByText("연결됨")).toBeInTheDocument();
  });

  it("DISCONNECTED 상태와 재연결 안내를 표시한다", () => {
    render(<ConnectionStatus status="DISCONNECTED" />);

    expect(screen.getByText("연결 끊김")).toBeInTheDocument();
    expect(screen.getByText("재연결 중...")).toBeInTheDocument();
  });

  it("ERROR 상태를 표시한다", () => {
    render(<ConnectionStatus status="ERROR" />);

    expect(screen.getByText("연결 오류")).toBeInTheDocument();
  });
});
