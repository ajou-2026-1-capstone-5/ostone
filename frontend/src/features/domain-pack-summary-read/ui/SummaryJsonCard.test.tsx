import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryJsonCard } from "./SummaryJsonCard";

describe("SummaryJsonCard", () => {
  it("알려진 요약 필드는 사용자가 읽기 좋은 섹션으로 렌더링한다", () => {
    render(
      <SummaryJsonCard summaryJson='{"topic":"환불 자동화 팩","generation":{"source":"pipeline","clusterCount":12},"quality":{"mappingRate":0.82,"outlierRate":0.07,"workflowSeparability":0.76},"review":{"needsReviewCount":3,"topIssues":["워크플로우 미매핑"]}}' />,
    );

    expect(screen.getByText("도메인팩 정보")).toBeInTheDocument();
    expect(screen.getByText("topic")).toBeInTheDocument();
    expect(screen.getByText("환불 자동화 팩")).toBeInTheDocument();
    expect(screen.getByText("생성 출처")).toBeInTheDocument();
    expect(screen.getByText("pipeline")).toBeInTheDocument();
    expect(screen.getByText("클러스터")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("검토 필요")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("품질 지표")).toBeInTheDocument();
    expect(screen.getByText("매핑률")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("이탈률")).toBeInTheDocument();
    expect(screen.getByText("7%")).toBeInTheDocument();
    expect(screen.getByText("워크플로우 분리도")).toBeInTheDocument();
    expect(screen.getByText("76%")).toBeInTheDocument();
    expect(screen.getByText("검토 포인트")).toBeInTheDocument();
    expect(screen.getByText("워크플로우 미매핑")).toBeInTheDocument();
  });

  it("카드 제목으로 도메인팩 정보를 렌더링한다", () => {
    render(<SummaryJsonCard summaryJson='{"generation":{"source":"pipeline"}}' />);
    expect(screen.getByText("도메인팩 정보")).toBeInTheDocument();
  });

  it("알려지지 않은 JSON 객체는 요약 화면에 노출하지 않고 전체 JSON에서 확인한다", () => {
    const json = '{"intent":"greeting","count":3}';
    render(<SummaryJsonCard summaryJson={json} />);
    expect(screen.getByText("내용 없음")).toBeInTheDocument();
    expect(screen.queryByText("기타 메타데이터")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체 JSON" }));
    expect(screen.getByText("intent")).toBeInTheDocument();
    expect(screen.getByText("greeting")).toBeInTheDocument();
    expect(screen.getByText("count")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("전체 JSON 화면에서는 객체 값을 보기 좋은 코드 블록으로 렌더링한다", () => {
    render(<SummaryJsonCard summaryJson='{"nested":{"a":1}}' />);
    fireEvent.click(screen.getByRole("button", { name: "전체 JSON" }));
    expect(screen.getByText("nested")).toBeInTheDocument();
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });

  it("draftSource는 내부 타입 대신 변경 기준 버전만 렌더링한다", () => {
    render(
      <SummaryJsonCard summaryJson='{"draftSource":{"type":"INTENT_REVISION","baseVersionNo":2,"reason":"환불 인텐트 세분화"}}' />,
    );

    expect(screen.getByText("변경 기준")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.queryByText(/INTENT_REVISION/)).not.toBeInTheDocument();
  });

  it("revision summary가 있으면 intent와 workflow 변경을 구성 변경으로 구분해 렌더링한다", () => {
    render(
      <SummaryJsonCard
        summaryJson='{"draftSource":{"type":"INTENT_REVISION","baseVersionNo":2}}'
        revisionSummary={{
          changedIntents: [
            {
              intentId: 10,
              intentCode: "refund",
              name: "환불 문의",
              fields: ["name"],
              before: { name: "환불", description: "" },
              after: { name: "환불 문의", description: "" },
            },
          ],
          changedWorkflows: [
            {
              workflowId: 20,
              workflowCode: "refund-flow",
              name: "환불 응대 흐름",
              fields: ["name", "graphText", "graphStructure"],
              before: { name: "환불 흐름", description: "", nodeCount: 2, edgeCount: 1 },
              after: { name: "환불 응대 흐름", description: "", nodeCount: 3, edgeCount: 2 },
            },
          ],
          changedFieldCounts: { name: 1, description: 0 },
          changedWorkflowFieldCounts: { name: 1, description: 0, graphText: 1, graphStructure: 1 },
          changedByDraftIntentId: {},
          changedByDraftWorkflowId: {},
          totalChangedComponents: 2,
        }}
      />,
    );

    expect(screen.getByText("구성 변경")).toBeInTheDocument();
    expect(screen.getByText("상담 유형")).toBeInTheDocument();
    expect(screen.getByText("환불 문의")).toBeInTheDocument();
    expect(screen.getByText("응대 흐름")).toBeInTheDocument();
    expect(screen.getByText("환불 응대 흐름")).toBeInTheDocument();
    expect(screen.getByText("이름, 그래프 텍스트, 그래프 구조")).toBeInTheDocument();
  });

  it("revision summary가 있고 변경된 구성 요소가 없으면 empty 문구를 렌더링한다", () => {
    render(
      <SummaryJsonCard
        summaryJson='{"draftSource":{"type":"INTENT_REVISION","baseVersionNo":2}}'
        revisionSummary={{
          changedIntents: [],
          changedWorkflows: [],
          changedFieldCounts: { name: 0, description: 0 },
          changedWorkflowFieldCounts: { name: 0, description: 0, graphText: 0, graphStructure: 0 },
          changedByDraftIntentId: {},
          changedByDraftWorkflowId: {},
          totalChangedComponents: 0,
        }}
      />,
    );

    expect(screen.getByText("구성 변경")).toBeInTheDocument();
    expect(screen.getByText("변경된 구성 요소가 없습니다.")).toBeInTheDocument();
  });

  it("revision summary 계산 중이면 구성 변경 로딩 문구를 렌더링한다", () => {
    render(
      <SummaryJsonCard
        summaryJson='{"draftSource":{"type":"INTENT_REVISION","baseVersionNo":2}}'
        isRevisionSummaryLoading
      />,
    );

    expect(screen.getByText("구성 변경")).toBeInTheDocument();
    expect(screen.getByText("변경 요약 계산 중")).toBeInTheDocument();
  });

  it("revision summary 조회 실패 문구를 구성 변경 영역에 렌더링한다", () => {
    render(
      <SummaryJsonCard
        summaryJson='{"draftSource":{"type":"INTENT_REVISION","baseVersionNo":2}}'
        revisionSummaryError="도메인팩 변경 요약을 불러오지 못했습니다."
      />,
    );

    expect(screen.getByText("구성 변경")).toBeInTheDocument();
    expect(screen.getByText("도메인팩 변경 요약을 불러오지 못했습니다.")).toBeInTheDocument();
  });

  it("빈 JSON 객체는 '내용 없음'을 표시한다", () => {
    render(<SummaryJsonCard summaryJson="{}" />);
    expect(screen.getByText("내용 없음")).toBeInTheDocument();
  });

  it("유효하지 않은 JSON은 파싱 실패 경고와 원문을 표시한다", () => {
    render(<SummaryJsonCard summaryJson="{bad}" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("{bad}")).toBeInTheDocument();
  });

  it("전체 JSON 버튼 클릭 시 전체 JSON 필드를 카드로 표시한다", () => {
    const json = '{"key":"val"}';
    render(<SummaryJsonCard summaryJson={json} />);
    fireEvent.click(screen.getByRole("button", { name: "전체 JSON" }));
    expect(screen.getByText("key")).toBeInTheDocument();
    expect(screen.getByText("val")).toBeInTheDocument();
  });

  it("카드 버튼으로 다시 카드 모드로 전환한다", () => {
    render(<SummaryJsonCard summaryJson='{"generation":{"source":"pipeline"}}' />);
    fireEvent.click(screen.getByRole("button", { name: "전체 JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "요약" }));
    expect(screen.getByText("생성 출처")).toBeInTheDocument();
    expect(screen.getByText("pipeline")).toBeInTheDocument();
  });
});
