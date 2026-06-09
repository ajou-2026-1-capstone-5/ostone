import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReplayDiff, type ReplayDiffView } from "../api/pipelineReviewApi";
import { ReplayDiffSection } from "./ReplayDiffSection";

vi.mock("../api/pipelineReviewApi", () => ({
  useReplayDiff: vi.fn(),
}));

const mockedUseReplayDiff = vi.mocked(useReplayDiff);

function mockQuery(overrides: Record<string, unknown>) {
  mockedUseReplayDiff.mockReturnValue({
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

function readyDiff(overrides: Partial<ReplayDiffView> = {}): ReplayDiffView {
  return {
    available: true,
    status: "READY",
    reason: null,
    structureComparisonAvailable: true,
    intent: {
      splitCount: 1,
      mergeCount: 0,
      labelChanges: [{ id: "0", before: "카드", after: "카드 분실" }],
    },
    workflow: { splitCount: 0, mergeCount: 1, labelChanges: [] },
    decisions: [],
    summary: { applied: 0, partiallyApplied: 0, ignored: 0, total: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseReplayDiff.mockReset();
});

describe("ReplayDiffSection", () => {
  it("renders nothing without ids", () => {
    mockQuery({ data: readyDiff() });
    const { container } = render(<ReplayDiffSection workspaceId={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the job is not a feedback replay", () => {
    mockQuery({ data: { ...readyDiff(), status: "NOT_APPLICABLE" } });
    const { container } = render(
      <ReplayDiffSection workspaceId={1} pipelineJobId={7} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a fallback when the diff query fails", () => {
    mockQuery({ isError: true, data: undefined });
    render(<ReplayDiffSection workspaceId={1} pipelineJobId={7} />);
    expect(screen.getByText("이번 피드백으로 바뀐 것")).toBeInTheDocument();
    expect(screen.getByText(/초안을 성공으로/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /다시 조회/ }),
    ).toBeInTheDocument();
  });

  it("shows a pending message while the replay runs", () => {
    mockQuery({ data: { ...readyDiff(), status: "PENDING" } });
    render(<ReplayDiffSection workspaceId={1} pipelineJobId={7} />);
    expect(screen.getByText(/replay를 진행/)).toBeInTheDocument();
  });

  it("shows the unavailable reason without claiming success", () => {
    mockQuery({
      data: {
        ...readyDiff(),
        status: "UNAVAILABLE",
        available: false,
        reason: "diff_not_emitted",
      },
    });
    render(<ReplayDiffSection workspaceId={1} pipelineJobId={7} />);
    expect(
      screen.getByText(/변경 정보가 포함되지 않았습니다/),
    ).toBeInTheDocument();
  });

  it("renders summary, structure, and decision statuses when ready", () => {
    mockQuery({
      data: readyDiff({
        decisions: [
          {
            reviewTaskId: 10,
            scope: "intent",
            decisionType: "must_link",
            sourceId: "c1",
            targetId: "c2",
            status: "applied",
            reason: null,
            effect: null,
          },
          {
            reviewTaskId: 11,
            scope: "workflow",
            decisionType: "separate_workflow",
            sourceId: "c3",
            targetId: "c4",
            status: "ignored",
            reason: "endpoints_in_different_clusters",
            effect: null,
          },
        ],
        summary: { applied: 1, partiallyApplied: 0, ignored: 1, total: 2 },
      }),
    });
    render(<ReplayDiffSection workspaceId={1} pipelineJobId={7} />);

    expect(screen.getByText("이번 피드백으로 바뀐 것")).toBeInTheDocument();
    expect(screen.getByText("적용 1")).toBeInTheDocument();
    expect(screen.getByText("미적용 1")).toBeInTheDocument();
    expect(screen.getByText("c1 ↔ c2")).toBeInTheDocument();
    // ignored decision surfaces its reason
    expect(
      screen.getByText(
        /서로 다른 클러스터에 있어 workflow에 반영되지 않았습니다/,
      ),
    ).toBeInTheDocument();
    // label change rendered
    expect(screen.getByText("카드 분실")).toBeInTheDocument();
  });

  it("notes when structure comparison is unavailable but still lists decisions", () => {
    mockQuery({
      data: readyDiff({
        structureComparisonAvailable: false,
        decisions: [
          {
            reviewTaskId: 10,
            scope: "intent",
            decisionType: "must_link",
            sourceId: "c1",
            targetId: "c2",
            status: "applied",
            reason: null,
            effect: null,
          },
        ],
        summary: { applied: 1, partiallyApplied: 0, ignored: 0, total: 1 },
      }),
    });
    render(<ReplayDiffSection workspaceId={1} pipelineJobId={7} />);
    expect(
      screen.getByText(/이전 replay 결과를 찾지 못해/),
    ).toBeInTheDocument();
    expect(screen.getByText("c1 ↔ c2")).toBeInTheDocument();
  });
});
