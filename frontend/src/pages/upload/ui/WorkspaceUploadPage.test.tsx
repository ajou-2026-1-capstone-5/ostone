import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceUploadPage } from "./WorkspaceUploadPage";

vi.mock("../../../features/log-upload/ui/LogUploadForm", () => ({
  LogUploadForm: ({ workspaceId }: { workspaceId?: number }) => (
    <div data-testid="upload-form">workspace:{workspaceId}</div>
  ),
}));

function renderRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/upload" element={<WorkspaceUploadPage />} />
        <Route path="/workspaces/:workspaceId/pipeline-jobs/:pipelineJobId/review" element={<div>리뷰 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspaceUploadPage", () => {
  it("redirects job upload links to the pipeline review screen", () => {
    renderRoute("/workspaces/1/upload?jobId=99");

    expect(screen.getByText("리뷰 화면")).toBeInTheDocument();
  });

  it("renders upload form when there is no job id", () => {
    renderRoute("/workspaces/1/upload");

    expect(screen.getByTestId("upload-form")).toHaveTextContent("workspace:1");
  });
});
