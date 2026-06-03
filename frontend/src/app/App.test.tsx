import { render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { App } from "./App";
import { AppProviders } from "./providers";

function createAccessToken(expSecondsFromNow = 3600) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
  };

  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

function seedAuthenticatedSession() {
  localStorage.setItem("accessToken", createAccessToken());
  localStorage.setItem(
    "user",
    JSON.stringify({
      id: 1,
      email: "admin@ostone.com",
      name: "Admin",
      role: "OWNER",
    }),
  );
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("renders without crashing", () => {
    const { container } = render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(container).toBeTruthy();
  });

  it("renders login page title on initial load", () => {
    window.history.pushState({}, "", "/login");

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    expect(screen.getByText(/CS Workflow Generator/i)).toBeInTheDocument();
  });

  it("redirects legacy demo workspace chat URLs to the canonical demo chat URL", async () => {
    window.history.pushState(
      {},
      "",
      "/demo/workspaces/42/chat?name=%EA%B9%80%EB%AF%BC%EC%A7%80",
    );

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/demo/chat/42");
      expect(window.location.search).toBe("?name=%EA%B9%80%EB%AF%BC%EC%A7%80");
    });
  });

  it("redirects legacy authenticated workspace chat URLs to the user chat URL", async () => {
    seedAuthenticatedSession();
    window.history.pushState({}, "", "/workspaces/42/chat?name=%EA%B9%80%EB%AF%BC%EC%A7%80");

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chat/42");
      expect(window.location.search).toBe("?name=%EA%B9%80%EB%AF%BC%EC%A7%80");
    });
  });

  it("redirects workspace home alias to dashboard and renders the dashboard empty state", async () => {
    seedAuthenticatedSession();

    const workspaceBody = {
      id: 1,
      workspaceKey: "cs-team-alpha",
      name: "CS Team Alpha",
      description: null,
      status: "ACTIVE",
      myRole: "OWNER",
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/workspaces") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [workspaceBody],
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => workspaceBody,
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/workspaces/1");

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/workspaces/1/dashboard");
    });

    expect(await screen.findByText("Workspace Dashboard")).toBeInTheDocument();
    expect(
      await screen.findByText("아직 대시보드에 표시할 운영 데이터가 없습니다."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/workspaces/1",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
