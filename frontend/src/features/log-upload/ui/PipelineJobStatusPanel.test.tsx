import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import buttonStyles from "../../../shared/ui/button/button.module.css";
import type { LatestPipelineJob } from "../api/pipelineJobStatusApi";

import { PipelineJobStatusPanel } from "./PipelineJobStatusPanel";

const onStartGeneration = vi.fn();
const onRefresh = vi.fn();
const onReset = vi.fn();
const onNavigate = vi.fn();

const baseJob: LatestPipelineJob = {
  pipelineJobId: 77,
  workspaceId: 1,
  datasetId: 42,
  domainPackId: null,
  jobType: "INGESTION",
  status: "RUNNING",
  airflowDagId: "domain_pack_generation",
  airflowRunId: "pipeline_job_77",
  requestedAt: "2026-06-05T01:00:00Z",
  startedAt: "2026-06-05T01:00:10Z",
  finishedAt: null,
  runningDurationSeconds: 95,
  lastErrorMessage: null,
};

type PanelProps = Parameters<typeof PipelineJobStatusPanel>[0];

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    queryState: { isLoading: false, isError: false, isFetching: false },
    job: baseJob,
    reviewPath: "/workspaces/1/pipeline-jobs/77/review",
    domainPacksPath: "/workspaces/1/domain-packs",
    canStartGeneration: true,
    isGenerationPending: false,
    onStartGeneration,
    onRefresh,
    onReset,
    onNavigate,
    ...overrides,
  };
  return render(<PipelineJobStatusPanel {...props} />);
}

function primaryButtons(container: HTMLElement) {
  return container.querySelectorAll(`button.${buttonStyles.primary}`);
}

describe("PipelineJobStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("업로드 직후 상태 확인 중에는 행동 버튼 없이 대기 안내만 보여준다", () => {
    renderPanel({
      queryState: { isLoading: true, isError: false, isFetching: true },
      job: null,
      reviewPath: null,
    });

    expect(screen.getByText("파이프라인 상태 확인 중")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("상태 조회 실패 시 상태 새로고침을 primary CTA로 보여준다", () => {
    const { container } = renderPanel({
      queryState: { isLoading: false, isError: true, isFetching: false },
      job: null,
      reviewPath: null,
    });

    expect(screen.getByText("파이프라인 상태 조회 실패")).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "상태 새로고침" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "다른 파일 업로드" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("자동 job이 아직 없으면 수동 생성 fallback을 함께 안내한다", () => {
    const { container } = renderPanel({ job: null, reviewPath: null });

    expect(screen.getByText("자동 파이프라인 대기 중")).toBeInTheDocument();
    expect(
      screen.getByText(/도메인팩 초안 생성을 직접 요청할 수 있습니다/),
    ).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "상태 새로고침" })).toHaveClass(
      buttonStyles.primary,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
    );
    expect(onStartGeneration).toHaveBeenCalledTimes(1);
  });

  it("생성 요청이 불가능하면 fallback 버튼을 비활성화한다", () => {
    renderPanel({ job: null, reviewPath: null, canStartGeneration: false });

    expect(
      screen.getByRole("button", { name: "도메인팩 초안 생성 시작" }),
    ).toBeDisabled();
  });

  it("QUEUED job은 대기 안내와 상태 화면 이동 primary CTA를 보여준다", () => {
    const { container } = renderPanel({
      job: { ...baseJob, status: "QUEUED", runningDurationSeconds: null },
    });

    expect(screen.getByText("자동 파이프라인 대기 중")).toBeInTheDocument();
    expect(screen.getByText(/대기열에 등록되어/)).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "도메인팩 초안 생성 시작" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "상태 화면으로 이동" }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      "/workspaces/1/pipeline-jobs/77/review",
    );
  });

  it("실행 중 상태는 job 정보와 상태 화면 이동 primary CTA를 보여준다", () => {
    const { container } = renderPanel();

    expect(screen.getByText("자동 파이프라인 실행 중")).toBeInTheDocument();
    expect(screen.getByText(/job 77 · pipeline_job_77/)).toBeInTheDocument();
    expect(screen.getByText("DAG domain_pack_generation")).toBeInTheDocument();
    expect(screen.getByText("실행 1분 35초")).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "상태 화면으로 이동" }),
    ).toHaveClass(buttonStyles.primary);
  });

  it.each([
    ["WAITING_DOMAIN_CONFIRMATION", /후보 도메인을 선택해 주세요/],
    ["WAITING_HUMAN_FEEDBACK", /애매한 경계를 확정해 주세요/],
  ])("%s 상태는 검토 화면 이동을 primary CTA로 보여준다", (status, copy) => {
    const { container } = renderPanel({ job: { ...baseJob, status } });

    expect(screen.getByText("검토 대기 중")).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "검토 화면으로 이동" }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      "/workspaces/1/pipeline-jobs/77/review",
    );
  });

  it("완료 상태는 도메인팩 관리 이동을 primary CTA로 보여준다", () => {
    const { container } = renderPanel({
      job: { ...baseJob, status: "SUCCEEDED" },
    });

    expect(screen.getByText("파이프라인 완료")).toBeInTheDocument();
    expect(primaryButtons(container)).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "도메인팩 관리로 이동" }),
    ).toHaveClass(buttonStyles.primary);

    fireEvent.click(
      screen.getByRole("button", { name: "도메인팩 관리로 이동" }),
    );
    expect(onNavigate).toHaveBeenCalledWith("/workspaces/1/domain-packs");
  });

  it.each([
    ["FAILED", "파이프라인 실패"],
    ["CANCELLED", "파이프라인 취소됨"],
  ])(
    "%s 상태는 초안 생성 다시 요청을 primary CTA로 보여준다",
    (status, label) => {
      const { container } = renderPanel({ job: { ...baseJob, status } });

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        screen.getByText(/도메인팩 초안 생성을 다시 요청하거나/),
      ).toBeInTheDocument();
      expect(primaryButtons(container)).toHaveLength(1);

      fireEvent.click(
        screen.getByRole("button", { name: "도메인팩 초안 생성 다시 요청" }),
      );
      expect(onStartGeneration).toHaveBeenCalledTimes(1);
    },
  );

  it("실패 상태는 마지막 에러 메시지를 함께 보여준다", () => {
    renderPanel({
      job: {
        ...baseJob,
        status: "FAILED",
        lastErrorMessage: "ingestion artifact 누락",
      },
    });

    expect(screen.getByText("ingestion artifact 누락")).toBeInTheDocument();
  });

  it("새로고침 중에는 상태 새로고침 버튼을 비활성화한다", () => {
    renderPanel({
      queryState: { isLoading: false, isError: false, isFetching: true },
    });

    expect(
      screen.getByRole("button", { name: "상태 새로고침" }),
    ).toBeDisabled();
  });
});
