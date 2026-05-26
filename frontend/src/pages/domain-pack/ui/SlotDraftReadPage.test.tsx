import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SlotDraftReadPage } from "./SlotDraftReadPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: () => ({ data: undefined }),
}));

vi.mock("@/features/slot-draft-read/ui", () => ({
  SlotListPanel: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" onClick={() => onSelect(4)}>
      select slot
    </button>
  ),
  SlotDetailPanel: ({ slotId }: { slotId: number | null }) => (
    <div>slot detail {slotId ?? "none"}</div>
  ),
}));

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId/slots"
          element={<SlotDraftReadPage />}
        >
          <Route path=":slotId" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SlotDraftReadPage", () => {
  it("슬롯 선택 시 slotId가 포함된 상세 URL로 이동한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/slots?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "select slot" }));

    expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/slots/4?versionId=101");
  });

  it("슬롯 상세에서 다른 슬롯 선택 시 현재 상세 route를 replace한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/slots/3?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "select slot" }));

    expect(navigate).toHaveBeenCalledWith("/workspaces/1/domain-packs/7/slots/4?versionId=101", {
      replace: true,
    });
  });

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/slots?versionId=101");

    expect(screen.getByRole("alert")).toHaveTextContent("잘못된 URL 파라미터입니다.");
  });
});
