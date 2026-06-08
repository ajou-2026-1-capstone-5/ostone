import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  failedReplayResult,
  goldenCase,
  mockedSimulationApi,
  renderPage,
  toast,
} from "./WorkspaceSimulationPage.test-helper";

describe("WorkspaceSimulationPage golden case scenarios", () => {
  it("현재 실행 결과와 구분한 기대 결과를 검증 케이스로 저장한다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    expect(screen.getByText("현재 실행 결과")).toBeInTheDocument();
    expect(screen.getByText("기대 결과")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("검증 케이스 이름"), {
      target: { value: "환불 주문번호 검증" },
    });
    fireEvent.change(screen.getByLabelText("기대 intent"), {
      target: { value: "refund_order_number_required" },
    });
    fireEvent.change(screen.getByLabelText("기대 workflow"), {
      target: { value: "refund_required_slot_workflow" },
    });
    fireEvent.change(screen.getByLabelText("기대 state"), {
      target: { value: "ask_order_no" },
    });
    fireEvent.change(await screen.findByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.change(screen.getByLabelText("필수 slot JSON"), {
      target: { value: '{"orderNo":"B-200"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(mockedSimulationApi.createGoldenCase).toHaveBeenCalledWith(1, 10, {
        name: "환불 주문번호 검증",
        expectedIntentCode: "refund_order_number_required",
        expectedWorkflowCode: "refund_required_slot_workflow",
        expectedCurrentState: "ask_order_no",
        expectedActionType: "ASK_SLOT",
        expectedSlotValues: { orderNo: "B-200" },
      });
    });
    expect(toast.success).toHaveBeenCalledWith("검증 케이스를 저장했습니다.");
  });

  it("기대 intent, workflow, action 확인 전에는 검증 케이스를 저장하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue(
        "refund_request",
      );
    });
    fireEvent.change(screen.getByLabelText("기대 intent"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(toast.error).toHaveBeenCalledWith(
      "기대 intent, workflow, action을 확인하세요.",
    );
    expect(mockedSimulationApi.createGoldenCase).not.toHaveBeenCalled();
  });

  it("필수 slot JSON이 객체가 아니면 검증 케이스를 저장하지 않는다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue(
        "refund_request",
      );
    });
    fireEvent.change(screen.getByLabelText("기대 action"), {
      target: { value: "ASK_SLOT" },
    });
    fireEvent.change(screen.getByLabelText("필수 slot JSON"), {
      target: { value: '["orderNo"]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(toast.error).toHaveBeenCalledWith(
      "필수 slot은 JSON 객체로 입력하세요.",
    );
    expect(mockedSimulationApi.createGoldenCase).not.toHaveBeenCalled();
  });

  it("저장된 검증 케이스를 선택 version으로 replay한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("101");
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "환불 검증 replay" }),
    );

    await waitFor(() => {
      expect(mockedSimulationApi.replayGoldenCase).toHaveBeenCalledWith(
        1,
        950,
        {
          domainPackVersionId: 101,
        },
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      "검증 케이스 replay가 통과했습니다.",
    );
  });

  it("query target version을 replay version 기본값으로 사용한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage(
      "/workspaces/1/simulation?packId=11&versionId=22&workflowId=100",
    );

    await screen.findByText("환불하고 싶어요");
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("22");
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "환불 검증 replay" }),
    );

    await waitFor(() => {
      expect(mockedSimulationApi.replayGoldenCase).toHaveBeenCalledWith(
        1,
        950,
        {
          domainPackVersionId: 22,
        },
      );
    });
  });

  it("최근 replay 실패 요약을 검증 케이스 목록에 표시한다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [
        {
          ...goldenCase,
          latestReplayResult: failedReplayResult,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    expect(await screen.findByText("FAIL")).toBeInTheDocument();
    expect(
      screen.getByText(
        "currentState expected collect_order_no but was handoff",
      ),
    ).toBeInTheDocument();
  });

  it("Replay version이 비어 있으면 replay 요청을 보내지 않는다", async () => {
    mockedSimulationApi.listGoldenCases.mockResolvedValue({
      content: [goldenCase],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await screen.findByRole("button", { name: "환불 검증 replay" });
    await waitFor(() => {
      expect(screen.getByLabelText("Replay version")).toHaveValue("101");
    });
    fireEvent.change(screen.getByLabelText("Replay version"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "환불 검증 replay" }));

    expect(toast.error).toHaveBeenCalledWith("Replay version을 입력하세요.");
    expect(mockedSimulationApi.replayGoldenCase).not.toHaveBeenCalled();
  });
});
