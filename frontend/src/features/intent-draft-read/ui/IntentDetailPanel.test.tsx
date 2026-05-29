import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { IntentDetail, IntentListState, IntentSummary } from "@/entities/intent";
import { useIntentDetail, type IntentDetailState } from "../model/useIntentDetail";
import { IntentDetailPanel } from "./IntentDetailPanel";

vi.mock("../model/useIntentDetail", () => ({
  useIntentDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const mockedUseIntentDetail = vi.mocked(useIntentDetail);

const stubDetail: IntentDetail = {
  id: 10,
  intentCode: "INTENT_001",
  name: "배송 조회 문의",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  entryConditionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

const emptyIntentListState: IntentListState = { status: "ready", data: [] };

function readyDetail(data: IntentDetail): IntentDetailState {
  return { status: "ready", data };
}

function readyList(data: IntentSummary[]): IntentListState {
  return { status: "ready", data };
}

function renderPanel(props: Partial<React.ComponentProps<typeof IntentDetailPanel>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    intentId: 10 as number | null,
    intentListState: emptyIntentListState,
  };
  render(<IntentDetailPanel {...defaults} {...props} />);
}

describe("IntentDetailPanel", () => {
  beforeEach(() => {
    mockedUseIntentDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "idle" });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ intentId: null, children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("loading 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "loading" });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("error 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({
      status: "error",
      code: "NOT_FOUND",
      message: "없음",
      httpStatus: 404,
    });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("ready 상태에서 children이 없으면 기존 렌더링을 유지한다", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail(stubDetail));

    renderPanel();

    expect(screen.getByText("INTENT_001")).toBeInTheDocument();
    expect(screen.getByText("배송 조회 문의")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("parent intent id 대신 parent intent 제목을 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail({ ...stubDetail, parentIntentId: 20 }));
    renderPanel({
      intentListState: readyList([
        {
          id: 20,
          intentCode: "ORDER_STATUS",
          name: "주문 상태 문의",
          parentIntentId: null,
        },
      ]),
    });

    expect(screen.getByText("Parent Intent")).toBeInTheDocument();
    expect(screen.getByText("주문 상태 문의")).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("parent intent 이름이 없으면 intent code를 fallback으로 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail({ ...stubDetail, parentIntentId: 20 }));

    renderPanel({
      intentListState: readyList([
        {
          id: 20,
          intentCode: "ORDER_STATUS",
          name: "",
          parentIntentId: null,
        },
      ]),
    });

    expect(screen.getByText("ORDER_STATUS")).toBeInTheDocument();
  });

  it("parent intent 목록이 loading/error이면 상태별 fallback을 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail({ ...stubDetail, parentIntentId: 20 }));
    const { rerender } = render(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={{ status: "loading" }}
      />,
    );

    expect(screen.getByText("불러오는 중...")).toBeInTheDocument();

    rerender(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={{
          status: "error",
          code: "ERR",
          message: "목록 실패",
        }}
      />,
    );

    expect(screen.getByText("확인 불가")).toBeInTheDocument();
  });

  it("ready 상태에서 children render-prop을 호출하고 detail.data를 전달한다", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail(stubDetail));
    const childrenFn = vi.fn((detail) => <div data-testid="children">{detail.name}</div>);

    renderPanel({ children: childrenFn });

    expect(childrenFn).toHaveBeenCalledTimes(1);
    expect(childrenFn).toHaveBeenCalledWith(stubDetail);
    expect(screen.getByTestId("children")).toHaveTextContent("배송 조회 문의");
    expect(screen.getByText("INTENT_001")).toBeInTheDocument();
  });

  it("내부 리소스 요약 화면에서 cluster 관련 키워드와 evidence 대표 문장을 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        sourceClusterRef: JSON.stringify({
          clusterId: 12,
          clusterSize: 36,
          canonicalIntent: "카드 이용내역 확인",
          keywords: ["카드", "이용내역"],
          segmentIds: ["seg-1", "seg-2"],
          source: "boundary_segment_v1",
        }),
        evidenceJson: JSON.stringify({
          sampleSegmentTexts: [
            "최근 이용내역을 확인하고 싶어요",
            "customer: 해외 결제 내역이 보여요",
            "고객: 환불 가능한가요",
            "상담사: 주문번호를 알려주세요",
          ],
          sampleIntentPhrases: ["이용내역 문의"],
        }),
      }),
    );

    renderPanel();

    expect(screen.getByText("관련 키워드")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("36건")).toBeInTheDocument();
    expect(screen.getByText("카드 이용내역 확인")).toBeInTheDocument();
    expect(screen.getByText("카드")).toBeInTheDocument();
    expect(screen.getByText("이용내역")).toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();
    expect(screen.getByText("대표 문장")).toBeInTheDocument();
    expect(screen.getByText("참고 1")).toBeInTheDocument();
    expect(screen.getByText("최근 이용내역을 확인하고 싶어요")).toBeInTheDocument();
    expect(screen.getByText("상담자")).toBeInTheDocument();
    expect(screen.getByText("해외 결제 내역이 보여요")).toBeInTheDocument();
    expect(screen.getByText("환불 가능한가요")).toBeInTheDocument();
    expect(screen.getByText("상담사")).toBeInTheDocument();
    expect(screen.getByText("주문번호를 알려주세요")).toBeInTheDocument();
  });

  it("JSON 탭에서는 기존 JSON 필드를 그대로 확인할 수 있다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        sourceClusterRef: JSON.stringify({ clusterId: 7 }),
        evidenceJson: JSON.stringify({ sampleSegmentTexts: ["환불 가능 여부 문의"] }),
      }),
    );

    renderPanel();

    expect(screen.queryByText("Source Cluster Ref")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByText("Source Cluster Ref")).toBeInTheDocument();
    expect(screen.getByText("Entry Condition")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("Meta")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("sampleSegmentTexts"))).toBeInTheDocument();
  });

  it("cluster/evidence JSON을 해석할 수 없으면 요약 화면에서 빈 상태를 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        sourceClusterRef: "not-json",
        evidenceJson: "not-json",
      }),
    );

    renderPanel();

    expect(screen.getByText("관련 키워드 정보가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("대표 문장이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getAllByText("not-json")).toHaveLength(2);
  });
});
