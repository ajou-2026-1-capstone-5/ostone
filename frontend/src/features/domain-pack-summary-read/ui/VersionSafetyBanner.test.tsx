import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionSafetyBanner } from "./VersionSafetyBanner";

const mockUsePackDetail = vi.fn();
const mockUseVersionDetail = vi.fn();

vi.mock("../model/usePackDetail", () => ({
  usePackDetail: (...args: unknown[]) => mockUsePackDetail(...args),
  useVersionDetail: (...args: unknown[]) => mockUseVersionDetail(...args),
}));

const PACK = {
  name: "반품·환불 응대팩",
  currentVersionId: 4,
  currentVersionNo: 4,
  versions: [
    { versionId: 4, versionNo: 4, lifecycleStatus: "PUBLISHED" },
    { versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" },
  ],
};

function versionDetail(overrides: Record<string, unknown>) {
  return {
    versionId: 4,
    versionNo: 4,
    lifecycleStatus: "PUBLISHED",
    intentCount: 12,
    slotCount: 8,
    policyCount: 5,
    riskCount: 3,
    workflowCount: 6,
    description: "운영 버전",
    ...overrides,
  };
}

beforeEach(() => {
  mockUsePackDetail.mockReset();
  mockUseVersionDetail.mockReset();
});

describe("VersionSafetyBanner", () => {
  it("renders nothing when no version is selected", () => {
    mockUsePackDetail.mockReturnValue({ data: PACK, isLoading: false });
    mockUseVersionDetail.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<VersionSafetyBanner wsId={1} packId={2} versionId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a skeleton while loading and not the banner", () => {
    mockUsePackDetail.mockReturnValue({ data: undefined, isLoading: true });
    mockUseVersionDetail.mockReturnValue({ data: undefined, isLoading: true });
    render(<VersionSafetyBanner wsId={1} packId={2} versionId={4} />);
    expect(screen.queryByLabelText("버전 안전성 정보")).not.toBeInTheDocument();
  });

  it("renders the operating version state with counts and a non-alert status line", () => {
    mockUsePackDetail.mockReturnValue({ data: PACK, isLoading: false });
    mockUseVersionDetail.mockReturnValue({ data: versionDetail({}), isLoading: false });
    render(<VersionSafetyBanner wsId={1} packId={2} versionId={4} />);

    expect(screen.getByLabelText("버전 안전성 정보")).toBeInTheDocument();
    expect(screen.getByText("운영 가능")).toBeInTheDocument();
    expect(screen.getByText("배포중")).toBeInTheDocument();
    expect(screen.getByText("현재 v4 · 운영 중")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("다시 배포할 수 없습니다");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains why a non-latest draft is blocked", () => {
    const packWithTwoDrafts = {
      ...PACK,
      versions: [
        { versionId: 4, versionNo: 4, lifecycleStatus: "PUBLISHED" },
        { versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" },
        { versionId: 6, versionNo: 6, lifecycleStatus: "DRAFT" },
      ],
    };
    mockUsePackDetail.mockReturnValue({ data: packWithTwoDrafts, isLoading: false });
    mockUseVersionDetail.mockReturnValue({
      data: versionDetail({ versionId: 5, versionNo: 5, lifecycleStatus: "DRAFT" }),
      isLoading: false,
    });
    render(<VersionSafetyBanner wsId={1} packId={2} versionId={5} />);

    expect(screen.getByRole("status")).toHaveTextContent("최신 검토본만");
    expect(screen.getByText("검토본")).toBeInTheDocument();
  });

  it("surfaces the in-progress reason when a deploy is running", () => {
    mockUsePackDetail.mockReturnValue({ data: PACK, isLoading: false });
    mockUseVersionDetail.mockReturnValue({
      data: versionDetail({ versionId: 3, versionNo: 3, lifecycleStatus: "PUBLISHED" }),
      isLoading: false,
    });
    render(<VersionSafetyBanner wsId={1} packId={2} versionId={3} deployingVersionId={3} />);

    expect(screen.getByRole("status")).toHaveTextContent("배포를 진행");
  });
});
