import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  detail,
  feedbackWithType,
  mockedSimulationApi,
  mockedWorkflows,
  openCandidateTab,
  openFeedbackTab,
  otherSession,
  renderPage,
  session,
  toast,
} from "./WorkspaceSimulationPage.test-helper";

describe("WorkspaceSimulationPage", () => {
  it("잘못된 workspaceId면 /workspaces로 리다이렉트한다", () => {
    renderPage("/workspaces/abc/simulation");
    expect(screen.getByTestId("workspace-root")).toBeInTheDocument();
  });

  it("세션 목록과 runtime 상태를 표시한다", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "상담 시뮬레이션" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("테스트 고객")).toBeInTheDocument();
    expect(await screen.findByText("환불하고 싶어요")).toBeInTheDocument();
    expect(screen.getByText("환불 문의")).toBeInTheDocument();
    expect(screen.getByText("환불 처리")).toBeInTheDocument();
    expect(screen.getAllByText("collect_order_no").length).toBeGreaterThan(0);
    expect(screen.getByText("A-100")).toBeInTheDocument();
  });

  it("workflow 매칭 전이면 세션 meta의 선택 intent와 필수 slot으로 검증 기본값을 채운다", async () => {
    mockedSimulationApi.getSession.mockResolvedValue({
      ...detail,
      session: {
        ...session,
        metaJson: JSON.stringify({
          customerName: "테스트 고객",
          selectedIntentCode: " hc_premium_voucher_issue_change_request ",
        }),
      },
      matchedWorkflow: null,
      slotValues: {},
      slots: [{ slotCode: "orderNo", required: true, hasValue: false }],
    });
    renderPage();

    expect(
      await screen.findAllByText("hc_premium_voucher_issue_change_request"),
    ).toHaveLength(2);
    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue(
        "hc_premium_voucher_issue_change_request",
      );
      expect(screen.getByLabelText("기대 action")).toHaveValue("ASK_SLOT");
    });
  });

  it("대시보드 추천 query로 피드백과 개선 후보 상태 필터를 초기화한다", async () => {
    renderPage(
      "/workspaces/1/simulation?feedbackStatus=RESOLVED&candidateStatus=READY_FOR_REVIEW",
    );

    await openFeedbackTab();
    expect(await screen.findByLabelText("피드백 상태 필터")).toHaveValue(
      "RESOLVED",
    );
    await openCandidateTab();
    expect(screen.getByLabelText("개선 후보 상태 필터")).toHaveValue(
      "READY_FOR_REVIEW",
    );
    await waitFor(() => {
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledWith(1, {
        status: "RESOLVED",
        page: 0,
        size: 20,
      });
    });
    await waitFor(() => {
      expect(
        mockedSimulationApi.listImprovementCandidates,
      ).toHaveBeenCalledWith(1, {
        status: "READY_FOR_REVIEW",
        page: 0,
        size: 20,
      });
    });
  });

  it("query 검증 대상을 상단에 표시하고 시작 workflow 기본값으로 사용한다", async () => {
    renderPage(
      "/workspaces/1/simulation?packId=11&versionId=22&workflowId=100",
    );

    expect(await screen.findByText("Verification Target")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "환불 처리" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("CS Support · Version #22 · refund.standard"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("시작 workflow 선택")).toHaveValue("100");
    });

    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
        workflowDefinitionId: 100,
      });
    });
  });

  it("route state 검증 대상도 상단 대상과 시작 workflow 기본값으로 사용한다", async () => {
    renderPage("/workspaces/1/simulation", {
      simulationTarget: {
        packId: 11,
        versionId: 22,
        workflowId: 100,
      },
    });

    expect(await screen.findByText("Verification Target")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "환불 처리" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("시작 workflow 선택")).toHaveValue("100");
    });
  });

  it("query 검증 대상이 있어도 사용자가 자동 매칭을 선택하면 workflow를 고정하지 않는다", async () => {
    renderPage(
      "/workspaces/1/simulation?packId=11&versionId=22&workflowId=100",
    );

    const workflowSelect = await screen.findByLabelText("시작 workflow 선택");
    await waitFor(() => {
      expect(workflowSelect).toHaveValue("100");
    });

    fireEvent.change(workflowSelect, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
      });
    });
  });

  it("workflow를 선택해 시뮬레이션 세션을 생성한다", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("시작 workflow 선택"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createSession).toHaveBeenCalledWith(1, {
        customerName: "시뮬레이션 고객",
        workflowDefinitionId: 100,
      });
    });
  });

  it("고객 메시지를 전송하고 응답을 화면에 반영한다", async () => {
    renderPage();

    fireEvent.change(
      await screen.findByPlaceholderText("고객 역할 메시지 입력"),
      {
        target: { value: "A-100 주문 환불이요" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => {
      expect(mockedSimulationApi.sendMessage).toHaveBeenCalledWith(1, 10, {
        content: "A-100 주문 환불이요",
      });
    });
    expect(
      await screen.findByText("주문번호를 알려주세요."),
    ).toBeInTheDocument();
  });

  it("turn 단위 피드백을 작성하고 session 상세를 갱신한다", async () => {
    renderPage();

    fireEvent.click(await screen.findByLabelText("Turn 1 피드백 대상 선택"));
    expect(screen.getByRole("tab", { name: "피드백" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByLabelText("피드백 대상 선택")).toHaveValue("1");
    fireEvent.change(screen.getByLabelText("피드백 유형 선택"), {
      target: { value: "MISSING_SLOT_QUESTION" },
    });
    fireEvent.change(screen.getByLabelText("피드백 심각도 선택"), {
      target: { value: "HIGH" },
    });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "주문번호를 묻지 않았습니다." },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "주문번호를 먼저 요청합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드백 저장" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createFeedback).toHaveBeenCalledWith(1, 10, {
        chatMessageId: 1,
        feedbackType: "MISSING_SLOT_QUESTION",
        description: "주문번호를 묻지 않았습니다.",
        expectedBehavior: "주문번호를 먼저 요청합니다.",
        severity: "HIGH",
      });
    });
  });

  it("세션을 바꾸면 피드백 입력 상태를 초기화한다", async () => {
    mockedSimulationApi.listSessions.mockResolvedValue({
      content: [session, otherSession],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    });
    renderPage();

    fireEvent.click(await screen.findByLabelText("Turn 1 피드백 대상 선택"));
    fireEvent.change(screen.getByLabelText("피드백 유형 선택"), {
      target: { value: "OTHER" },
    });
    fireEvent.change(screen.getByLabelText("피드백 심각도 선택"), {
      target: { value: "CRITICAL" },
    });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "이전 세션 피드백" },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "다른 응답" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /다른 고객/ }));

    await waitFor(() => {
      expect(mockedSimulationApi.getSession).toHaveBeenCalledWith(1, 20);
    });
    await waitFor(() => {
      expect(screen.getByLabelText("피드백 대상 선택")).toHaveValue("session");
    });
    expect(screen.getByLabelText("피드백 유형 선택")).toHaveValue(
      "INTENT_MISMATCH",
    );
    expect(screen.getByLabelText("피드백 심각도 선택")).toHaveValue("MEDIUM");
    expect(screen.getByLabelText("설명")).toHaveValue("");
    expect(screen.getByLabelText("기대 응답/행동")).toHaveValue("");
  });

  it("피드백 저장 후 목록 새로고침 실패는 저장 실패로 처리하지 않는다", async () => {
    renderPage();

    expect(await screen.findByText("환불하고 싶어요")).toBeInTheDocument();
    await openFeedbackTab();
    fireEvent.change(await screen.findByLabelText("설명"), {
      target: { value: "주문번호를 묻지 않았습니다." },
    });
    fireEvent.change(screen.getByLabelText("기대 응답/행동"), {
      target: { value: "주문번호를 먼저 요청합니다." },
    });
    mockedSimulationApi.createFeedback.mockResolvedValue({
      ...detail,
      feedback: {
        ...detail.feedback,
        items: [
          ...detail.feedback.items,
          {
            ...detail.feedback.items[0],
            id: 901,
          },
        ],
      },
    });
    mockedSimulationApi.listFeedback.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "피드백 저장" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createFeedback).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "시뮬레이션 피드백을 남겼습니다.",
      );
    });

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        901,
        expect.objectContaining({
          targetElementType: "SLOT",
          beforeSummary:
            "Slot 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
          afterSummary: "주문번호를 먼저 요청합니다.",
        }),
      );
      expect(
        mockedSimulationApi.updateImprovementCandidateStatus,
      ).toHaveBeenCalledWith(1, 1000, { status: "READY_FOR_REVIEW" });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "리뷰 대기 개선 후보로 등록했습니다.",
    );
    // 피드백 저장 성공 시 탭이 개선 후보로 자동 전환된다.
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "개선 후보" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      "시뮬레이션 피드백 목록을 불러오지 못했습니다.",
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "시뮬레이션 피드백을 저장하지 못했습니다.",
    );
  });

  it("피드백 목록 로드 실패는 패널 내부 오류와 재시도를 제공한다", async () => {
    mockedSimulationApi.listFeedback.mockRejectedValueOnce(
      new Error("load failed"),
    );
    renderPage();

    await openFeedbackTab();
    expect(
      await screen.findByText("시뮬레이션 피드백 목록을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(
      "시뮬레이션 피드백 목록을 불러오지 못했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByText("주문번호를 묻지 않았습니다."),
    ).toBeInTheDocument();
  });

  it("검증 케이스 목록 로드 실패는 패널 내부 오류로 표시한다", async () => {
    mockedSimulationApi.listGoldenCases.mockRejectedValueOnce(
      new Error("load failed"),
    );
    renderPage();

    expect(
      await screen.findByText("검증 케이스 목록을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(
      "검증 케이스 목록을 불러오지 못했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByText("저장된 검증 케이스가 없습니다."),
    ).toBeInTheDocument();
  });

  it("OPEN 피드백에서 개선 후보를 생성하고 목록을 새로고침한다", async () => {
    renderPage();

    await openFeedbackTab();
    expect(
      await screen.findByLabelText("피드백 #900 개선 대상 선택"),
    ).toHaveValue("SLOT");
    expect(screen.getByText("세부 element 미선택")).toBeInTheDocument();
    expect(
      screen.getByText(
        "현재 화면은 세부 element 선택을 지원하지 않아 target type까지만 후보에 저장합니다.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "SLOT",
          beforeSummary:
            "Slot 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
          afterSummary: "주문번호를 먼저 요청합니다.",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledTimes(2);
      expect(
        mockedSimulationApi.listImprovementCandidates,
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("개선 후보 target을 workflow로 바꾸면 기존 workflow context payload를 유지한다", async () => {
    renderPage();

    await openFeedbackTab();
    fireEvent.change(
      await screen.findByLabelText("피드백 #900 개선 대상 선택"),
      {
        target: { value: "WORKFLOW" },
      },
    );
    expect(screen.getByText("#100 · refund_workflow")).toBeInTheDocument();
    expect(
      screen.getByText("환불 처리 workflow id/key를 후보에 함께 저장합니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "WORKFLOW",
          targetElementId: 100,
          targetElementKey: "refund_workflow",
          beforeSummary:
            "Workflow 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
          afterSummary: "주문번호를 먼저 요청합니다.",
        }),
      );
    });
  });

  it("개선 후보 target을 policy로 바꿔 생성할 수 있다", async () => {
    renderPage();

    await openFeedbackTab();
    fireEvent.change(
      await screen.findByLabelText("피드백 #900 개선 대상 선택"),
      {
        target: { value: "POLICY" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "POLICY",
          beforeSummary:
            "Policy 개선 후보 (환불 처리 workflow 맥락): 주문번호를 묻지 않았습니다.",
        }),
      );
    });
  });

  it("feedback type별 기본 개선 대상을 서로 다르게 표시한다", async () => {
    mockedSimulationApi.listFeedback.mockResolvedValue({
      content: [
        feedbackWithType(901, "INTENT_MISMATCH"),
        feedbackWithType(902, "MISSING_SLOT_QUESTION"),
        feedbackWithType(903, "POLICY_CONDITION_MISSING"),
        feedbackWithType(904, "RISK_HANDOFF_REQUIRED"),
        feedbackWithType(905, "WORKFLOW_BRANCH_ERROR"),
        feedbackWithType(906, "INAPPROPRIATE_RESPONSE"),
        feedbackWithType(907, "OTHER"),
      ],
      page: 0,
      size: 20,
      totalElements: 7,
      totalPages: 1,
    });
    renderPage();

    await openFeedbackTab();

    expect(
      await screen.findByLabelText("피드백 #901 개선 대상 선택"),
    ).toHaveValue("INTENT");
    expect(screen.getByLabelText("피드백 #902 개선 대상 선택")).toHaveValue(
      "SLOT",
    );
    expect(screen.getByLabelText("피드백 #903 개선 대상 선택")).toHaveValue(
      "POLICY",
    );
    expect(screen.getByLabelText("피드백 #904 개선 대상 선택")).toHaveValue(
      "RISK_RULE",
    );
    expect(screen.getByLabelText("피드백 #905 개선 대상 선택")).toHaveValue(
      "WORKFLOW",
    );
    expect(screen.getByLabelText("피드백 #906 개선 대상 선택")).toHaveValue(
      "RESPONSE",
    );
    expect(screen.getByLabelText("피드백 #907 개선 대상 선택")).toHaveValue(
      "UNKNOWN",
    );
    expect(
      screen.getByText(
        "기타 피드백은 구체 대상이 확정되지 않은 제한 상태로 후보화됩니다.",
      ),
    ).toBeInTheDocument();
  });

  it("workflow 맥락이 없으면 workflow target type만 후보 payload에 보존한다", async () => {
    mockedWorkflows.mockReturnValue({
      loading: false,
      error: null,
      entries: [],
    });
    mockedSimulationApi.getSession.mockResolvedValue({
      ...detail,
      matchedWorkflow: null,
    });
    mockedSimulationApi.listFeedback.mockResolvedValue({
      content: [feedbackWithType(905, "WORKFLOW_BRANCH_ERROR")],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openFeedbackTab();
    expect(
      await screen.findByText(
        "workflow 맥락이 확인되지 않아 target type만 후보에 저장됩니다.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        905,
        expect.objectContaining({
          targetElementType: "WORKFLOW",
          beforeSummary: "Workflow 개선 후보: 주문번호를 묻지 않았습니다.",
        }),
      );
    });
    expect(mockedSimulationApi.createImprovementCandidate).toHaveBeenCalledWith(
      1,
      905,
      expect.not.objectContaining({
        targetElementId: expect.any(Number),
      }),
    );
  });

  it("개선 후보 생성 후 목록 새로고침 실패는 생성 실패로 처리하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await openFeedbackTab();
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.createImprovementCandidate,
      ).toHaveBeenCalledWith(
        1,
        900,
        expect.objectContaining({
          targetElementType: "SLOT",
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 생성했습니다.");
    await waitFor(() => {
      expect(
        screen.getByText("개선 후보 목록을 불러오지 못했습니다."),
      ).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      "개선 후보 목록을 불러오지 못했습니다.",
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "개선 후보를 생성하지 못했습니다.",
    );
  });

  it("Enter 키로 고객 메시지를 전송한다", async () => {
    renderPage();

    const input = await screen.findByPlaceholderText("고객 역할 메시지 입력");
    fireEvent.change(input, {
      target: { value: "A-100 주문 환불이요" },
    });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(mockedSimulationApi.sendMessage).toHaveBeenCalledWith(1, 10, {
        content: "A-100 주문 환불이요",
      });
    });
  });
});
