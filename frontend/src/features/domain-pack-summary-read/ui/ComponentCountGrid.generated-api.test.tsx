import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentCountGrid } from "./ComponentCountGrid";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
  useListIntents: vi.fn(),
  useListPolicies: vi.fn(),
  useListSlots: vi.fn(),
  useListWorkflows: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock(
  "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller",
  () => ({
    useListIntents: mocks.useListIntents,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller",
  () => ({
    useListSlots: mocks.useListSlots,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useListPolicies: mocks.useListPolicies,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useListWorkflows: mocks.useListWorkflows,
  }),
);

type GeneratedQueryOptions = {
  query?: {
    enabled?: boolean;
    select?: (response: unknown) => unknown;
  };
};

function makeGeneratedPreview(response: unknown, options?: GeneratedQueryOptions) {
  const enabled = options?.query?.enabled ?? true;
  return {
    data: enabled ? (options?.query?.select?.(response) ?? response) : undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  };
}

function getOptions(args: unknown[], index: number): GeneratedQueryOptions | undefined {
  return args[index] as GeneratedQueryOptions | undefined;
}

function renderGrid() {
  return render(
    <ComponentCountGrid
      wsId={1}
      packId={2}
      versionId={3}
      intentCount={6}
      slotCount={1}
      policyCount={1}
      workflowCount={1}
      renderSlotEditSheet={(slotId, isOpen) =>
        isOpen ? <div role="dialog">slot edit {slotId}</div> : null
      }
    />,
  );
}

describe("ComponentCountGrid generated API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useListIntents.mockImplementation((...args: unknown[]) =>
      makeGeneratedPreview(
        {
          data: Array.from({ length: 6 }, (_, index) => ({
            id: index + 1,
            name: `intent-${index + 1}`,
          })),
        },
        getOptions(args, 3),
      ),
    );
    mocks.useListSlots.mockImplementation((...args: unknown[]) =>
      makeGeneratedPreview({ data: [{ id: 11, name: "배송 주소" }] }, getOptions(args, 3)),
    );
    mocks.useListPolicies.mockImplementation((...args: unknown[]) =>
      makeGeneratedPreview({ data: [{ id: 21, name: "환불 정책" }] }, getOptions(args, 3)),
    );
    mocks.useListWorkflows.mockImplementation((...args: unknown[]) =>
      makeGeneratedPreview({ data: [{ id: 41, name: "환불 처리" }] }, getOptions(args, 4)),
    );
  });

  it("요약 카드 미리보기는 generated list 응답을 화면에 렌더링하고 5개로 제한한다", () => {
    renderGrid();

    expect(screen.getByText("intent-1")).toBeInTheDocument();
    expect(screen.getByText("intent-5")).toBeInTheDocument();
    expect(screen.queryByText("intent-6")).not.toBeInTheDocument();
    expect(screen.getByText("배송 주소")).toBeInTheDocument();
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText("환불 처리")).toBeInTheDocument();
  });

  it("generated workflow preview 항목 클릭 시 해당 workflow 상세로 이동한다", () => {
    renderGrid();

    fireEvent.click(screen.getByText("환불 처리"));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/2/workflows/41?versionId=3",
    );
  });

  it("generated slot preview가 있으면 확인 항목 카드에서 편집 sheet를 연다", () => {
    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: /확인 항목/ }));

    expect(screen.getByRole("dialog")).toHaveTextContent("slot edit 11");
  });
});
