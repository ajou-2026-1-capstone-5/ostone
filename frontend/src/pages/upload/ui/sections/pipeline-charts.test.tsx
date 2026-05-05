import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActiveRunTimeline } from "./ActiveRunTimeline";
import { StagePips } from "./StagePips";
import { EvalChart } from "./EvalChart";
import { RunHistoryStrip } from "./RunHistoryStrip";

describe("ActiveRunTimeline", () => {
  it("renders 6 stage rows", () => {
    render(<ActiveRunTimeline />);
    const rows = screen.getAllByText(/ingestion|preprocessing|intent-discovery|draft-generation|evaluation|publish-candidate/);
    expect(rows.length).toBe(6);
  });

  it("running stage has progress bar", () => {
    render(<ActiveRunTimeline />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
  });
});

describe("StagePips", () => {
  it("renders with 6 stages", () => {
    const stages = [
      { id: "s1", status: "done" as const },
      { id: "s2", status: "done" as const },
      { id: "s3", status: "running" as const },
      { id: "s4", status: "pending" as const },
      { id: "s5", status: "pending" as const },
      { id: "s6", status: "failed" as const },
    ];
    const { container } = render(<StagePips stages={stages} />);
    const dots = container.querySelectorAll("div[title]");
    expect(dots.length).toBe(6);
  });

  it("done pending running each renders correctly", () => {
    const stages = [
      { id: "done", status: "done" as const },
      { id: "pending", status: "pending" as const },
      { id: "running", status: "running" as const },
    ];
    const { container } = render(<StagePips stages={stages} />);
    const dots = container.querySelectorAll("div[title]");
    expect(dots.length).toBe(3);
    expect(dots[0].getAttribute("title")).toBe("done");
    expect(dots[1].getAttribute("title")).toBe("pending");
    expect(dots[2].getAttribute("title")).toBe("running");
  });
});

describe("EvalChart", () => {
  it("renders threshold line", () => {
    render(<EvalChart runs={[]} threshold={0.6} />);
    expect(screen.getByLabelText("Evaluation chart")).toBeInTheDocument();
  });

  it("renders 3 SVG paths (3 lines)", () => {
    const { container } = render(<EvalChart runs={[]} threshold={0.6} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(3);
  });

  it("empty runs renders axes only", () => {
    const { container } = render(<EvalChart runs={[]} threshold={0.6} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});

describe("RunHistoryStrip", () => {
  it("renders exactly 24 bars", () => {
    const { container } = render(<RunHistoryStrip hours={24} />);
    const bars = container.querySelectorAll("div[style*='width: 8px']");
    expect(bars.length).toBe(24);
  });

  it("renders 2 red (danger) bars", () => {
    const { container } = render(<RunHistoryStrip hours={24} />);
    const bars = container.querySelectorAll("div[style*='width: 8px']");
    const dangerBars = Array.from(bars).filter((bar) => {
      const style = bar.getAttribute("style") || "";
      return style.includes("var(--danger)");
    });
    expect(dangerBars.length).toBe(2);
  });

  it("renders time labels 00/06/12/18", () => {
    render(<RunHistoryStrip hours={24} />);
    expect(screen.getByText("00")).toBeInTheDocument();
    expect(screen.getByText("06")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});
