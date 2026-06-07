import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PolicyDraftReadPage } from "./PolicyDraftReadPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/features/domain-pack-summary-read", () => ({
  usePackDetail: () => ({ data: undefined }),
  VersionSafetyBanner: () => null,
}));

vi.mock("@/features/policy-draft-read/ui", () => ({
  PolicyListPanel: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" onClick={() => onSelect(4)}>
      select policy
    </button>
  ),
  PolicyDetailPanel: ({ onEdit }: { onEdit: (id: number) => void }) => (
    <button type="button" onClick={() => onEdit(4)}>
      edit policy
    </button>
  ),
}));

vi.mock("@/features/update-policy", () => ({
  PolicyEditPanel: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close editor
    </button>
  ),
}));

function ShellHost() {
  const [crumbs, setCrumbs] = useState<Array<string | { label: string }>>([]);
  const [topbarRight, setTopbarRight] = useState<React.ReactNode>();

  return (
    <>
      <div data-testid="shell-crumbs">
        {crumbs
          .map((crumb) => (typeof crumb === "string" ? crumb : crumb.label))
          .join(" / ")}
      </div>
      <div data-testid="shell-topbar">{topbarRight}</div>
      <Outlet context={{ setCrumbs, setTopbarRight, workspace: null }} />
    </>
  );
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId"
          element={<ShellHost />}
        >
          <Route path="policies" element={<PolicyDraftReadPage />}>
            <Route path=":policyId" />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("PolicyDraftReadPage", () => {
  it("정책 선택과 수정 화면 전환을 처리한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/policies?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "select policy" }));

    expect(navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/policies/4?versionId=101",
    );
  });

  it("정책 상세에서 수정 화면 전환을 처리한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/policies/4?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "edit policy" }));

    expect(
      screen.getByRole("button", { name: "close editor" }),
    ).toBeInTheDocument();
  });

  it("정책 상세에서 다른 정책 선택 시 현재 상세 route를 replace한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/policies/3?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "select policy" }));

    expect(navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/policies/4?versionId=101",
      {
        replace: true,
      },
    );
  });

  it("정책 상세에서 목록 버튼을 누르면 선택 없는 목록 URL로 replace한다", () => {
    navigate.mockReset();
    renderPage("/workspaces/1/domain-packs/7/policies/3?versionId=101");

    fireEvent.click(screen.getByRole("button", { name: "목록" }));

    expect(navigate).toHaveBeenCalledWith(
      "/workspaces/1/domain-packs/7/policies?versionId=101",
      {
        replace: true,
      },
    );
  });

  it("잘못된 URL 파라미터면 alert를 표시한다", () => {
    renderPage("/workspaces/abc/domain-packs/7/policies?versionId=101");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "잘못된 URL 파라미터입니다.",
    );
  });
});
