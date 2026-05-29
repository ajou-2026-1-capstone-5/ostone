import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentWorkflow, isMatchedWorkflow } from "./llmToolWorkflowApi";
import { customFetch } from "@/shared/api/mutator";
import { ApiRequestError } from "@/shared/api";

vi.mock("@/shared/api/mutator", () => ({
  customFetch: vi.fn(),
}));

const mockedFetch = vi.mocked(customFetch);

describe("llmToolWorkflowApi", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  describe("getCurrentWorkflow", () => {
    it("returns the matched workflow payload when workflowDefinitionId is present", async () => {
      mockedFetch.mockResolvedValueOnce({
        sessionId: 7,
        workspaceId: 3,
        domainPackId: 5,
        domainPackVersionId: 12,
        executionId: 41,
        executionStatus: "RUNNING",
        currentState: "COLLECT_INFO",
        workflowDefinitionId: 88,
        workflowCode: "REFUND_FLOW",
        workflowName: "환불 워크플로우",
        workflowDescription: "환불 처리 흐름",
      });

      const result = await getCurrentWorkflow(7);

      expect(mockedFetch).toHaveBeenCalledWith(
        "/api/v1/consultation/sessions/7/matched-workflow",
        {
          method: "GET",
        },
      );
      expect(result).not.toBeNull();
      expect(result?.domainPackId).toBe(5);
      expect(result?.workflowDefinitionId).toBe(88);
      expect(result?.executionStatus).toBe("RUNNING");
    });

    it("returns null when workflowDefinitionId is missing (no matched workflow)", async () => {
      mockedFetch.mockResolvedValueOnce({
        sessionId: 7,
        workspaceId: 3,
        domainPackVersionId: 12,
        executionId: null,
        executionStatus: null,
        currentState: null,
        workflowDefinitionId: null,
        workflowCode: null,
        workflowName: null,
        workflowDescription: null,
      });

      const result = await getCurrentWorkflow(7);

      expect(result).toBeNull();
    });

    it("returns null on 404 ApiRequestError", async () => {
      mockedFetch.mockRejectedValueOnce(new ApiRequestError(404, "NOT_FOUND", "Session not found"));

      const result = await getCurrentWorkflow(7);

      expect(result).toBeNull();
    });

    it("returns null on 400 ApiRequestError", async () => {
      mockedFetch.mockRejectedValueOnce(new ApiRequestError(400, "BAD_REQUEST", "invalid"));

      const result = await getCurrentWorkflow(7);

      expect(result).toBeNull();
    });

    it("returns null on 5xx ApiRequestError (bar degrades silently)", async () => {
      mockedFetch.mockRejectedValueOnce(new ApiRequestError(500, "INTERNAL", "boom"));

      const result = await getCurrentWorkflow(7);

      expect(result).toBeNull();
    });

    it("returns null on network/non-ApiRequestError failures", async () => {
      mockedFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const result = await getCurrentWorkflow(7);

      expect(result).toBeNull();
    });
  });

  describe("isMatchedWorkflow", () => {
    it("returns false for null", () => {
      expect(isMatchedWorkflow(null)).toBe(false);
    });

    it("returns false when workflowDefinitionId is null", () => {
      expect(
        isMatchedWorkflow({
          sessionId: 1,
          workspaceId: 1,
          domainPackId: null,
          domainPackVersionId: null,
          executionId: null,
          executionStatus: null,
          currentState: null,
          workflowDefinitionId: null,
          workflowCode: null,
          workflowName: null,
          workflowDescription: null,
        }),
      ).toBe(false);
    });

    it("returns true when workflowDefinitionId is set", () => {
      expect(
        isMatchedWorkflow({
          sessionId: 1,
          workspaceId: 1,
          domainPackId: 1,
          domainPackVersionId: 1,
          executionId: 1,
          executionStatus: "RUNNING",
          currentState: "S",
          workflowDefinitionId: 99,
          workflowCode: "X",
          workflowName: "X",
          workflowDescription: null,
        }),
      ).toBe(true);
    });
  });
});
