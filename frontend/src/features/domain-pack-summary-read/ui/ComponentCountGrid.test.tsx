import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import * as previewLists from "../model/usePreviewLists";
import { ComponentCountGrid } from "./ComponentCountGrid";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../model/usePreviewLists", () => ({
  useIntentPreview: vi.fn(),
  useSlotPreview: vi.fn(),
  usePolicyPreview: vi.fn(),
  useRiskPreview: vi.fn(),
  useWorkflowPreview: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHook(overrides: Record<string, unknown> = {}): any {
  return { data: undefined, isLoading: false, isError: false, error: null, ...overrides };
}

const defaultProps = {
  wsId: 1,
  packId: 2,
  versionId: 3,
  intentCount: 2,
  slotCount: 3,
  policyCount: 1,
  riskCount: 2,
  workflowCount: 4,
};

describe("ComponentCountGrid", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.usePolicyPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useRiskPreview).mockReturnValue(makeHook());
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook());
  });

  it("카드 레이블과 카운트를 렌더링한다", () => {
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText("상담 유형")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("주의 사항")).toBeInTheDocument();
    expect(screen.getByText("워크플로우")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("각 구성요소 카드에 목록 보기 CTA를 렌더링한다", () => {
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByRole("button", { name: "상담 유형 목록 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인 항목 목록 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "응대 기준 목록 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "주의 사항 목록 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "워크플로우 목록 보기" })).toBeInTheDocument();
  });

  it("Intent, Policy 목록 보기 클릭 시 상세 목록으로 이동한다", () => {
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "상담 유형 목록 보기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/intents?versionId=3");

    fireEvent.click(screen.getByRole("button", { name: "응대 기준 목록 보기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/policies?versionId=3");
  });

  it("Slot 화살표 클릭 시 Slot 목록으로 이동한다", () => {
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(
      makeHook({ data: [{ id: 9, name: "slot-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "확인 항목 목록 보기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/slots?versionId=3");
  });

  it("Slot 미리보기 항목 클릭 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(
      makeHook({ data: [{ id: 9, name: "slot-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByText("slot-1"));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/slots/9?versionId=3");
  });

  it("로딩 중일 때 스켈레톤을 렌더링한다", () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook({ isLoading: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("intent isError 시 toast.error를 호출한다", async () => {
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("상담 유형 미리보기를 불러오지 못했습니다."),
    );
  });

  it("Policy 미리보기 항목 클릭 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.usePolicyPreview).mockReturnValue(
      makeHook({ data: [{ id: 21, name: "policy-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByText("policy-1"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/policies/21?versionId=3",
    );
  });

  it("Risk 목록 보기와 미리보기 항목 클릭 시 주의 사항 경로로 이동한다", () => {
    vi.mocked(previewLists.useRiskPreview).mockReturnValue(
      makeHook({ data: [{ id: 31, name: "risk-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "주의 사항 목록 보기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/2/risks?versionId=3");

    fireEvent.click(screen.getByText("risk-1"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/risks/31?versionId=3",
    );
  });

  it("미리보기 데이터가 비어도 화면 존재를 알리는 빈 상태 문구를 표시한다", () => {
    render(<ComponentCountGrid {...defaultProps} slotCount={0} />);
    expect(screen.getByText("등록된 확인 항목 초안이 없습니다.")).toBeInTheDocument();
  });

  it("slot isError 시 toast.error를 호출한다", async () => {
    vi.mocked(previewLists.useSlotPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("확인 항목 미리보기를 불러오지 못했습니다."),
    );
  });

  it("workflow isError 시 toast.error를 호출한다", async () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("워크플로우 미리보기를 불러오지 못했습니다."),
    );
  });

  it("risk isError 시 toast.error를 호출한다", async () => {
    vi.mocked(previewLists.useRiskPreview).mockReturnValue(makeHook({ isError: true }));
    render(<ComponentCountGrid {...defaultProps} />);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("주의 사항 미리보기를 불러오지 못했습니다."),
    );
  });

  it("workflow previewItems가 있으면 이름 목록을 렌더링한다", () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: "wf-alpha" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText("wf-alpha")).toBeInTheDocument();
  });

  it("workflow 미리보기 항목 클릭 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: "wf-alpha" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByText("wf-alpha"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/workflows/10?versionId=3",
    );
  });

  it("intent previewNames가 있으면 이름 목록을 렌더링한다", () => {
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(
      makeHook({ data: [{ id: 1, name: "intent-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    expect(screen.getByText("intent-1")).toBeInTheDocument();
  });

  it("intent 미리보기 항목 클릭 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.useIntentPreview).mockReturnValue(
      makeHook({ data: [{ id: 1, name: "intent-1" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.click(screen.getByText("intent-1"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/intents/1?versionId=3",
    );
  });

  it("workflow 미리보기 항목에서 Enter 키 입력 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: "wf-alpha" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.keyDown(screen.getByText("wf-alpha"), { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/workflows/10?versionId=3",
    );
  });

  it("workflow 미리보기 항목에서 Space 키 입력 시 해당 id로 navigate를 호출한다", () => {
    vi.mocked(previewLists.useWorkflowPreview).mockReturnValue(
      makeHook({ data: [{ id: 10, name: "wf-alpha" }] }),
    );
    render(<ComponentCountGrid {...defaultProps} />);
    fireEvent.keyDown(screen.getByText("wf-alpha"), { key: " " });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/workflows/10?versionId=3",
    );
  });
});
