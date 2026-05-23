import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegacyDomainPackVersionRedirect } from "./LegacyDomainPackVersionRedirect";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/*"
          element={<LegacyDomainPackVersionRedirect />}
        />
        <Route path="/workspaces" element={<div data-testid="workspaces-root">root</div>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LegacyDomainPackVersionRedirect", () => {
  it("legacy version path를 versionId query가 있는 현재 child route로 redirect한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3/intents/4?tab=diff");

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/workspaces/1/domain-packs/2/intents/4?tab=diff&versionId=3",
    );
  });

  it("child path가 없으면 pack 상세 route로 redirect한다", () => {
    renderPage("/workspaces/1/domain-packs/2/versions/3");

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/workspaces/1/domain-packs/2?versionId=3",
    );
  });

  it("잘못된 route id면 workspace root로 redirect한다", () => {
    renderPage("/workspaces/abc/domain-packs/2/versions/3/intents");

    expect(screen.getByTestId("workspaces-root")).toBeInTheDocument();
  });
});
