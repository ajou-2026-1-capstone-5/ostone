import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  useAdminCustomerDetail,
  useAdminCustomers,
  type AdminCustomerDetail,
  type AdminCustomerSlice,
} from "../api/adminCustomersApi";
import { AdminCustomerDashboard } from "./AdminCustomerDashboard";

vi.mock("../api/adminCustomersApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/adminCustomersApi")>();
  return {
    ...actual,
    useAdminCustomers: vi.fn(),
    useAdminCustomerDetail: vi.fn(),
  };
});

const mockedUseAdminCustomers = vi.mocked(useAdminCustomers);
const mockedUseAdminCustomerDetail = vi.mocked(useAdminCustomerDetail);

const listResponse: AdminCustomerSlice = {
  content: [
    {
      workspace: {
        id: 1,
        workspaceKey: "acme",
        name: "Acme",
        description: "고객사",
        status: "ACTIVE",
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-02T00:00:00Z",
      },
      memberCount: 3,
      billing: {
        subscriptionStatus: null,
        planName: null,
        currentPeriodEnd: null,
        updatedAt: null,
      },
      latestUpload: {
        datasetId: 10,
        datasetKey: "upload-1",
        name: "상담 로그",
        status: "READY",
        uploadedAt: "2026-06-02T01:00:00Z",
      },
      latestPipelineJob: {
        id: 20,
        jobType: "DOMAIN_PACK_GENERATION",
        status: "SUCCEEDED",
        requestedAt: "2026-06-02T02:00:00Z",
        startedAt: "2026-06-02T02:01:00Z",
        finishedAt: "2026-06-02T02:05:00Z",
      },
    },
  ],
  page: 0,
  size: 20,
  hasNext: false,
};

const detailResponse: AdminCustomerDetail = {
  workspace: listResponse.content[0].workspace,
  members: {
    totalCount: 3,
    ownerCount: 1,
    adminCount: 1,
    reviewerCount: 0,
    operatorCount: 1,
    recentMembers: [
      {
        memberId: 100,
        userId: 7,
        name: "운영자",
        email: "admin@ostone.com",
        workspaceRole: "ADMIN",
        accountStatus: "ACTIVE",
        joinedAt: "2026-06-01T00:00:00Z",
      },
    ],
  },
  billing: listResponse.content[0].billing,
  latestUpload: listResponse.content[0].latestUpload,
  pipeline: {
    totalCount: 2,
    runningCount: 0,
    succeededCount: 1,
    failedCount: 1,
    latestJob: listResponse.content[0].latestPipelineJob,
    recentJobs: [listResponse.content[0].latestPipelineJob],
  },
};

describe("AdminCustomerDashboard", () => {
  beforeEach(() => {
    mockedUseAdminCustomers.mockReset();
    mockedUseAdminCustomerDetail.mockReset();
    mockedUseAdminCustomers.mockReturnValue({
      data: listResponse,
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAdminCustomers>);
    mockedUseAdminCustomerDetail.mockReturnValue({
      data: detailResponse,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAdminCustomerDetail>);
  });

  it("고객사 목록과 선택된 고객사 상세를 표시한다", async () => {
    render(<AdminCustomerDashboard />);

    expect(await screen.findByRole("button", { name: /Acme acme/ })).toBeInTheDocument();
    expect(screen.getAllByText("미연동").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("고객사 상세")).toHaveTextContent("admin@ostone.com");
    expect(screen.getByLabelText("고객사 상세")).toHaveTextContent("SUCCEEDED");
  });

  it("검색 submit과 상태 filter 변경을 query hook params에 반영한다", async () => {
    const user = userEvent.setup();
    render(<AdminCustomerDashboard />);

    await user.type(screen.getByPlaceholderText("고객사명 또는 workspace key"), "acme");
    await user.click(screen.getByRole("button", { name: "검색" }));
    await user.selectOptions(screen.getByLabelText("상태"), "ARCHIVED");

    expect(mockedUseAdminCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "acme" }),
    );
    expect(mockedUseAdminCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ARCHIVED" }),
    );
  });

  it("목록이 비어 있으면 empty state를 표시한다", () => {
    mockedUseAdminCustomers.mockReturnValue({
      data: { content: [], page: 0, size: 20, hasNext: false },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useAdminCustomers>);

    render(<AdminCustomerDashboard />);

    expect(screen.getByText("조건에 맞는 고객사가 없습니다.")).toBeInTheDocument();
  });

  it("목록 조회 오류를 alert로 표시한다", () => {
    mockedUseAdminCustomers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
    } as ReturnType<typeof useAdminCustomers>);

    render(<AdminCustomerDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent("고객사 정보를 불러오지 못했습니다.");
  });

  it("다음 페이지가 없으면 다음 버튼을 비활성화한다", () => {
    render(<AdminCustomerDashboard />);

    const pagination = screen.getByLabelText("고객사 목록").querySelector("div:last-child");
    expect(within(pagination as HTMLElement).getByLabelText("다음 페이지")).toBeDisabled();
  });
});
