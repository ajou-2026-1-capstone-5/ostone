import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { WorkspaceWorkflowEntry } from "@/entities/workflow";
import { Icon } from "@/shared/ui/ostone/atoms/Icon";

interface WorkflowSearchBarProps {
  entries: WorkspaceWorkflowEntry[];
  /** Called with the chosen workflowId; pass null to clear. */
  onFilter: (workflowId: number | null) => void;
  testIdPrefix?: string;
  maxResults?: number;
}

const MAX_DEFAULT = 8;

function highlightMatch(name: string, q: string): { before: string; match: string; after: string } {
  if (!q) return { before: "", match: "", after: name };
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return { before: "", match: "", after: name };
  return {
    before: name.slice(0, idx),
    match: name.slice(idx, idx + q.length),
    after: name.slice(idx + q.length),
  };
}

export function WorkflowSearchBar({
  entries,
  onFilter,
  testIdPrefix = "workflow-search",
  maxResults = MAX_DEFAULT,
}: WorkflowSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? entries.filter((e) => e.name.toLowerCase().includes(trimmed)).slice(0, maxResults)
    : [];

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "32px",
    padding: "0 32px 0 32px",
    borderRadius: "999px",
    border: "1px solid var(--line)",
    background: "var(--paper-2)",
    color: "var(--ink)",
    fontFamily: "var(--sans)",
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--ink-3)",
          pointerEvents: "none",
        }}
      >
        <Icon name="search" size={14} />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query) setOpen(true);
        }}
        placeholder="워크플로우 검색"
        data-testid={`${testIdPrefix}-input`}
        style={inputStyle}
      />

      {open && matches.length > 0 && (
        <div
          data-testid={`${testIdPrefix}-dropdown`}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-2)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 30,
          }}
        >
          {matches.map((entry) => {
            const { before, match, after } = highlightMatch(entry.name, query);
            return (
              <button
                key={`${entry.packId}-${entry.workflowId}`}
                type="button"
                onClick={() => {
                  onFilter(entry.workflowId);
                  setOpen(false);
                  setQuery(entry.name);
                }}
                data-testid={`${testIdPrefix}-item-${entry.workflowId}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--sans)",
                  fontSize: "13px",
                  color: "var(--ink)",
                }}
              >
                <span style={{ color: "var(--ink-3)" }}>
                  <Icon name="search" size={12} />
                </span>
                <span>
                  <span>{before}</span>
                  <span style={{ fontWeight: 500 }}>{match}</span>
                  <span style={{ color: "var(--ink-2)" }}>{after}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
