import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { IntentDetail, IntentListState, IntentSummary } from "../model/types";
import { useIntentDetail, type IntentDetailState } from "../api/useIntentDetail";
import { IntentDetailPanel } from "./IntentDetailPanel";

vi.mock("../api/useIntentDetail", () => ({
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

    expect(screen.getByText("상위 상담 유형")).toBeInTheDocument();
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

  it("children은 스크롤되는 body 안 내부 리소스 섹션 아래에 렌더링된다 (#910)", () => {
    mockedUseIntentDetail.mockReturnValue(readyDetail(stubDetail));
    const childrenFn = vi.fn(() => <div data-testid="children">workflows</div>);

    renderPanel({ children: childrenFn });

    const body = screen.getByTestId("intent-detail-body");
    const child = screen.getByTestId("children");
    const resourceTitle = screen.getByText("내부 리소스");

    // 워크플로우 등 children은 body 바깥 형제가 아니라 스크롤 영역 안에 있어야 한다.
    expect(body).toContainElement(child);
    // 내부 리소스 섹션보다 뒤(아래)에 렌더링되어야 한다.
    expect(
      resourceTitle.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(screen.getAllByText("상담자")).toHaveLength(2);
    expect(screen.getByText("해외 결제 내역이 보여요")).toBeInTheDocument();
    expect(screen.getByText("환불 가능한가요")).toBeInTheDocument();
    expect(screen.getByText("상담사")).toBeInTheDocument();
    expect(screen.getByText("주문번호를 알려주세요")).toBeInTheDocument();
  });

  it("내부 리소스 요약 화면에서 seed 후보의 support/memberSourceIds와 route terms를 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        sourceClusterRef: JSON.stringify({
          clusterId: "C10",
          support: 34,
          confidence: 0.84,
          memberSourceIds: ["90811", "90812"],
        }),
        entryConditionJson: JSON.stringify({
          requiredAnyTerms: ["취소", "환불", "변경"],
          optionalTerms: ["취소 수수료", "계약금"],
        }),
        evidenceJson: JSON.stringify([{ type: "unit_id", value: "90811:0:1" }]),
        metaJson: JSON.stringify({ source: "identifier_intent_clustering" }),
      }),
    );

    renderPanel();

    expect(screen.getByText("#C10")).toBeInTheDocument();
    expect(screen.getByText("34건")).toBeInTheDocument();
    expect(screen.getByText("0.84")).toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();
    expect(screen.getByText("identifier_intent_clustering")).toBeInTheDocument();
    expect(screen.getByText("취소")).toBeInTheDocument();
    expect(screen.getByText("환불")).toBeInTheDocument();
    expect(screen.getByText("취소 수수료")).toBeInTheDocument();
    expect(screen.getByText("근거 ID")).toBeInTheDocument();
    expect(screen.getByText("90811:0:1")).toBeInTheDocument();
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

  it("sampleIntentPhrases fallback과 배열형 evidence를 대표 문장으로 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          sampleIntentPhrases: ["사용자: 배송 위치를 확인하고 싶어요"],
        }),
      }),
    );

    const { rerender } = render(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={emptyIntentListState}
      />,
    );

    expect(screen.getByText("상담자")).toBeInTheDocument();
    expect(screen.getByText("배송 위치를 확인하고 싶어요")).toBeInTheDocument();

    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify([{ role: "agent", text: "운송장 번호를 확인해 주세요" }]),
      }),
    );

    rerender(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={emptyIntentListState}
      />,
    );

    expect(screen.getByText("상담사")).toBeInTheDocument();
    expect(screen.getByText("운송장 번호를 확인해 주세요")).toBeInTheDocument();
  });

  it("representativeCases와 sourceRefs fallback을 대표 문장으로 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          representativeCases: [
            {
              conversationId: "200002",
              canonicalText: "예, 제 카드 분실했는데, 정지를 좀 하고 싶거든요.",
            },
          ],
        }),
      }),
    );

    const { rerender } = render(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={emptyIntentListState}
      />,
    );

    expect(screen.getByText("참고 1")).toBeInTheDocument();
    expect(screen.getByText("예, 제 카드 분실했는데, 정지를 좀 하고 싶거든요.")).toBeInTheDocument();

    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          sourceRefs: [{ type: "source_id", value: "200002" }],
        }),
      }),
    );

    rerender(
      <IntentDetailPanel
        wsId={1}
        packId={2}
        versionId={3}
        intentId={10}
        intentListState={emptyIntentListState}
      />,
    );

    expect(screen.getByText("상담 ID")).toBeInTheDocument();
    expect(screen.getByText("200002")).toBeInTheDocument();
  });

  it("지원하지 않는 prefix가 있는 문장은 speaker로 분리하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          sampleSegmentTexts: ["order_id: 12345 확인 요청"],
        }),
      }),
    );

    renderPanel();

    expect(screen.getByText("참고 1")).toBeInTheDocument();
    expect(screen.getByText("order_id: 12345 확인 요청")).toBeInTheDocument();
  });

  it("embedding/vector 형태 값은 대표 문장으로 표시하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          sampleSegmentTexts: [
            "[0.1234, -0.5678, 0.9012]",
            "0.0012 3.4e-5 -1.2e-6",
            [0.11, 0.22, 0.33],
            "고객: 카드 분실 신고하고 싶어요",
          ],
        }),
      }),
    );

    renderPanel();

    expect(screen.getByText("대표 문장")).toBeInTheDocument();
    expect(screen.getByText("카드 분실 신고하고 싶어요")).toBeInTheDocument();
    expect(screen.queryByText("[0.1234, -0.5678, 0.9012]")).not.toBeInTheDocument();
    expect(screen.queryByText("0.0012 3.4e-5 -1.2e-6")).not.toBeInTheDocument();
  });

  it("근거에 사람이 읽을 수 있는 문장이 없으면 빈 상태를 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        evidenceJson: JSON.stringify({
          sampleSegmentTexts: ["[0.1, 0.2, 0.3]", "1.5e-4, -2.6e-5"],
        }),
      }),
    );

    renderPanel();

    expect(screen.getByText("대표 문장이 없습니다.")).toBeInTheDocument();
  });

  it("JSON 탭에서 JSON 타입별 메타 정보를 표시한다", () => {
    mockedUseIntentDetail.mockReturnValue(
      readyDetail({
        ...stubDetail,
        sourceClusterRef: JSON.stringify(10),
        entryConditionJson: JSON.stringify("ready"),
        evidenceJson: "",
        metaJson: JSON.stringify(["a", "b"]),
      }),
    );

    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByText("VALUE")).toBeInTheDocument();
    expect(screen.getByText("STRING")).toBeInTheDocument();
    expect(screen.getByText("EMPTY")).toBeInTheDocument();
    expect(screen.getByText("2 ITEMS")).toBeInTheDocument();
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
