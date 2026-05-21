import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_SIDEBAR_SETTINGS,
  compareWorkflows,
  readPageWorkflowSettings,
  readSidebarWorkflowSettings,
  writePageWorkflowSettings,
  writeSidebarWorkflowSettings,
} from "./workflowSettings";

beforeEach(() => {
  window.localStorage.clear();
});

describe("workflowSettings", () => {
  describe("sidebar", () => {
    it("returns default when no value is stored", () => {
      expect(readSidebarWorkflowSettings()).toEqual(DEFAULT_SIDEBAR_SETTINGS);
    });

    it("round-trips through localStorage", () => {
      writeSidebarWorkflowSettings({ topN: 3, sortField: "name", sortDir: "desc" });
      expect(readSidebarWorkflowSettings()).toEqual({
        topN: 3,
        sortField: "name",
        sortDir: "desc",
      });
    });

    it("falls back to default on malformed JSON", () => {
      window.localStorage.setItem("ostone:sidebar:workflow-settings", "{not json");
      expect(readSidebarWorkflowSettings()).toEqual(DEFAULT_SIDEBAR_SETTINGS);
    });

    it("falls back when topN is invalid", () => {
      window.localStorage.setItem(
        "ostone:sidebar:workflow-settings",
        JSON.stringify({ topN: "lots", sortField: "name", sortDir: "asc" }),
      );
      expect(readSidebarWorkflowSettings()).toEqual(DEFAULT_SIDEBAR_SETTINGS);
    });

    it("falls back when sort direction is bogus", () => {
      window.localStorage.setItem(
        "ostone:sidebar:workflow-settings",
        JSON.stringify({ topN: 5, sortField: "name", sortDir: "sideways" }),
      );
      expect(readSidebarWorkflowSettings()).toEqual(DEFAULT_SIDEBAR_SETTINGS);
    });
  });

  describe("page", () => {
    it("returns default when no value is stored", () => {
      expect(readPageWorkflowSettings()).toEqual(DEFAULT_PAGE_SETTINGS);
    });

    it("round-trips through localStorage", () => {
      writePageWorkflowSettings({ pageSize: 24, sortField: "name", sortDir: "desc" });
      expect(readPageWorkflowSettings()).toEqual({
        pageSize: 24,
        sortField: "name",
        sortDir: "desc",
      });
    });

    it("falls back when pageSize is non-positive", () => {
      window.localStorage.setItem(
        "ostone:page:workflow-settings",
        JSON.stringify({ pageSize: 0, sortField: "name", sortDir: "asc" }),
      );
      expect(readPageWorkflowSettings()).toEqual(DEFAULT_PAGE_SETTINGS);
    });
  });

  describe("compareWorkflows", () => {
    const a = { name: "Apple", workflowCode: "wf.b" };
    const b = { name: "banana", workflowCode: "wf.a" };

    it("sorts asc by name case-insensitively", () => {
      expect(compareWorkflows(a, b, "name", "asc")).toBeLessThan(0);
    });

    it("sorts desc by name", () => {
      expect(compareWorkflows(a, b, "name", "desc")).toBeGreaterThan(0);
    });

    it("sorts by workflowCode", () => {
      expect(compareWorkflows(a, b, "workflowCode", "asc")).toBeGreaterThan(0);
    });

    it("handles missing values", () => {
      expect(compareWorkflows({ name: undefined }, { name: "x" }, "name", "asc")).toBeLessThan(0);
    });
  });
});
