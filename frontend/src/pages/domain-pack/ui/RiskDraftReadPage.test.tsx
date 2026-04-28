import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RiskDraftReadPage } from "./RiskDraftReadPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/features/risk-draft-read/ui", () => ({
  RiskListPanel: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" onClick={() => onSelect(4)}>
      select risk
    </button>
  ),
  RiskDetailPanel: ({ onEdit }: { onEdit: (id: number) => void }) => (
    <div>
      <span>risk detail</span>
      <button type="button" onClick={() => onEdit(4)}>
        edit risk
      </button>
    </div>
  ),
}));

vi.mock("@/features/update-risk", () => ({
  RiskEditPanel: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>risk edit panel</span>
      <button type="button" onClick={onClose}>
        close edit
      </button>
    </div>
  ),
}));

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/risks/:riskId?"
          element={<RiskDraftReadPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RiskDraftReadPage", () => {
  it("위험요소 선택 시 riskId가 포함된 상세 URL로 이동한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/versions/101/risks");

    fireEvent.click(screen.getByRole("button", { name: "select risk" }));

    expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/versions/101/risks/4");
  });

  it("상세 선택 상태에서 목록으로 돌아간다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/versions/101/risks/4");

    fireEvent.click(screen.getByRole("button", { name: "← 목록" }));

    expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/versions/101/risks");
  });

  it("수정 버튼을 누르면 편집 패널로 전환하고 닫을 수 있다", () => {
    renderPage("/workspaces/1/domain-packs/7/versions/101/risks/4");

    fireEvent.click(screen.getByRole("button", { name: "edit risk" }));
    expect(screen.getByText("risk edit panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close edit" }));
    expect(screen.getByText("risk detail")).toBeInTheDocument();
  });

  it("현재 선택과 다른 위험요소 편집 상태는 무시한다", () => {
    renderPage("/workspaces/1/domain-packs/7/versions/101/risks/5");

    fireEvent.click(screen.getByRole("button", { name: "edit risk" }));

    expect(screen.queryByText("risk edit panel")).not.toBeInTheDocument();
    expect(screen.getByText("risk detail")).toBeInTheDocument();
  });

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/versions/101/risks");

    expect(screen.getByRole("alert")).toHaveTextContent("잘못된 URL 파라미터입니다.");
  });
});
