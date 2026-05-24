import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DomainPackRouteOutlet } from "./DomainPackRouteOutlet";

describe("DomainPackRouteOutlet", () => {
  it("하위 route element를 렌더링한다", () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/1/domain-packs/2/intents"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/domain-packs/:packId"
            element={<DomainPackRouteOutlet />}
          >
            <Route path="intents" element={<div>intent child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("intent child")).toBeInTheDocument();
  });
});
