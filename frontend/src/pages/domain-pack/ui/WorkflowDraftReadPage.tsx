import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WorkflowEditSheet } from "../../../features/update-workflow";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import { Pill, Mono, Icon, Bar } from "@/shared/ui/ostone/atoms";
import { PackHeader } from "./sections/PackHeader";
import { PackTabs } from "./sections/PackTabs";
import { WorkflowList } from "./sections/WorkflowList";
import { VersionsTimeline } from "./sections/VersionsTimeline";
import { MetricsFooter } from "./sections/MetricsFooter";

function HeaderActions() {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "var(--r-2)",
          border: "1px solid var(--line)",
          background: "var(--paper-2)",
          color: "var(--ink-2)",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        <Icon name="download" size={14} />
        내보내기
      </button>
      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "var(--r-2)",
          border: "1px solid var(--line)",
          background: "var(--paper-2)",
          color: "var(--ink-2)",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        <Icon name="play" size={14} />
        채팅에서 테스트
      </button>
      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          borderRadius: "var(--r-2)",
          border: "none",
          background: "var(--ink)",
          color: "var(--paper)",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        v0.4 배포하기
      </button>
    </div>
  );
}

interface LegendChipProps {
  shape: "diamond" | "circle";
  bg: string;
  color: string;
  label: string;
}

function LegendChip({ shape, bg, color, label }: LegendChipProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      {shape === "diamond" ? (
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            background: bg,
            transform: "rotate(45deg)",
          }}
        />
      ) : (
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: bg,
          }}
        />
      )}
      <Mono style={{ fontSize: "10px", color }}>{label}</Mono>
    </div>
  );
}

export function WorkflowDraftReadPage() {
  const { workspaceId, packId, versionId, workflowId } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const wfId = workflowId ? parseRouteId(workflowId) : null;

  if (wsId === null || pId === null || vId === null || (workflowId !== undefined && wfId === null)) {
    return (
      <OstoneShell active="domain" crumbs={["Domain Packs"]}>
        <div role="alert" style={{ padding: "24px", color: "var(--danger)" }}>
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const handleSelect = (id: number) => {
    setEditOpen(false);
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows/${id}`);
  };

  const handleBack = () => {
    setEditOpen(false);
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows`);
  };

  const hasSelection = wfId !== null;

  void handleSelect;
  void handleBack;
  void hasSelection;

  return (
    <OstoneShell
      active="domain"
      crumbs={[`WS · ${wsId}`, "Domain Packs", `VER · ${vId}`]}
      topbarRight={<HeaderActions />}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <PackHeader />
        <PackTabs />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left rail */}
          <div
            style={{
              width: "224px",
              background: "var(--paper-2)",
              flexShrink: 0,
              overflow: "auto",
              borderRight: "1px solid var(--line-2)",
            }}
          >
            <WorkflowList />
            <VersionsTimeline />
          </div>

          {/* Center */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {/* Workflow header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid var(--line-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: "16px",
                    fontWeight: 500,
                    margin: 0,
                    color: "var(--ink)",
                  }}
                >
                  refund.standard
                </h2>
                <Pill tone="signal">DRAFT</Pill>
                <Mono style={{ fontSize: "11px", color: "var(--ink-3)" }}>wf-218</Mono>
                <Mono style={{ fontSize: "11px", color: "var(--ink-3)" }}>
                  7 nodes · 2 risk gates · trained on 1,389 conversations
                </Mono>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Mono style={{ fontSize: "11px", color: "var(--ink-3)" }}>Zoom: 100%</Mono>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "var(--r-2)",
                    border: "1px solid var(--line)",
                    background: "var(--paper-2)",
                    color: "var(--ink-2)",
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="edit" size={14} />
                  Edit graph
                </button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "12px", padding: "8px 20px" }}>
              <LegendChip shape="diamond" bg="var(--paper-3)" color="var(--ink)" label="decision" />
              <LegendChip shape="circle" bg="var(--danger-bg)" color="var(--danger)" label="risk" />
              <LegendChip shape="circle" bg="var(--warn-bg)" color="var(--warn)" label="human" />
              <LegendChip shape="circle" bg="var(--signal-bg)" color="var(--signal)" label="task" />
            </div>

            {/* Workflow Canvas placeholder */}
            <div
              style={{
                flex: 1,
                minHeight: "300px",
                border: "1px dashed var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-3)",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                margin: "0 20px 12px",
                borderRadius: "var(--r-2)",
              }}
            >
              Workflow Canvas (T10)
            </div>

            {/* Metrics footer */}
            <MetricsFooter />

            {/* 24h replay strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderTop: "1px solid var(--line-2)",
              }}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <Bar
                    value={0.2 + Math.random() * 0.6}
                    tone={i % 5 === 0 ? "signal" : "ink"}
                    w={24}
                    h={3}
                  />
                  <Mono style={{ fontSize: "9px", color: "var(--ink-4)", marginTop: "2px" }}>
                    {i}h
                  </Mono>
                </div>
              ))}
            </div>
          </div>

          {/* Right inspector */}
          <div
            style={{
              width: "320px",
              background: "var(--paper-2)",
              flexShrink: 0,
              overflow: "auto",
              borderLeft: "1px solid var(--line-2)",
            }}
          >
            <div
              style={{
                padding: "20px",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                color: "var(--ink-3)",
                textAlign: "center",
              }}
            >
              Inspector (T11)
            </div>
          </div>
        </div>
      </div>

      {wfId !== null && (
        <WorkflowEditSheet
          wsId={wsId}
          packId={pId}
          versionId={vId}
          workflowId={wfId}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </OstoneShell>
  );
}
