import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useOutletContext,
} from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { DomainPackRouteOutlet } from "./DomainPackRouteOutlet";

function WorkspaceShellHost() {
  const context: ShellContext = {
    setCrumbs: () => undefined,
    setTopbarRight: () => undefined,
    workspace: { id: 1, name: "CS Team" },
  } as ShellContext;

  return <Outlet context={context} />;
}

function ShellContextProbe() {
  const { workspace } = useOutletContext<ShellContext>();

  return <div>{workspace?.name}</div>;
}

describe("DomainPackRouteOutlet", () => {
  it("workspace shell context를 하위 route에 전달한다", () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/1/domain-packs/2/intents"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId"
            element={<WorkspaceShellHost />}
          >
            <Route
              path="domain-packs/:packId"
              element={<DomainPackRouteOutlet />}
            >
              <Route path="intents" element={<ShellContextProbe />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("CS Team")).toBeInTheDocument();
  });
});
