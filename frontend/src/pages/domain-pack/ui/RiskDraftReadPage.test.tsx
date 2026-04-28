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
  RiskDetailPanel: () => <div>risk detail</div>,
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

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/versions/101/risks");

    expect(screen.getByRole("alert")).toHaveTextContent("잘못된 URL 파라미터입니다.");
  });
});
