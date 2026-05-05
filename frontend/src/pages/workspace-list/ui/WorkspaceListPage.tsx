import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND, domainPackApi } from "@/entities/domain-pack";
import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import { ApiRequestError } from "@/shared/api";
import {
  ArchiveConfirmDialog,
  CreateWorkspaceDialog,
  EditWorkspaceDialog,
} from "@/features/workspace";
import { OstoneShell } from "@/widgets/ostone-shell";
import {
  Avatar,
  Bar,
  Dot,
  Eyebrow,
  Icon,
  Mono,
  Pill,
  SparkBars,
  SparkLine,
} from "@/shared/ui/ostone/atoms";

function Stat({
  label,
  value,
  delta,
  deltaTone,
  sparkData,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone?: "signal" | "warn";
  sparkData: number[];
}) {
  const color = deltaTone === "warn" ? "var(--warn)" : "var(--signal)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <SparkLine data={sparkData} w={60} h={24} color={color} />
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--sans)",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {value}
        </span>
        <Mono
          style={{
            fontSize: 11,
            color: deltaTone === "warn" ? "var(--warn)" : "var(--signal-ink)",
          }}
        >
          {delta}
        </Mono>
      </div>
    </div>
  );
}

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceResponse | null>(null);
  const [policyDraftLoadingWorkspaceId, setPolicyDraftLoadingWorkspaceId] =
    useState<number | null>(null);
  const [riskDraftLoadingWorkspaceId, setRiskDraftLoadingWorkspaceId] = useState<number | null>(
    null,
  );
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await workspaceApi.list();
      setWorkspaces(data.filter((workspace) => workspace.status === "ACTIVE"));
    } catch (err) {
      setError(mapWorkspaceActionError(err) || "서버에 연결할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleOpenWorkspace = (workspace: WorkspaceResponse) => {
    navigate(`/workspaces/${workspace.id}/workflows`);
  };

  const handleOpenPolicyDraft = (workspace: WorkspaceResponse) => {
    if (policyDraftLoadingWorkspaceId !== null || riskDraftLoadingWorkspaceId !== null) {
      return;
    }

    setPolicyDraftLoadingWorkspaceId(workspace.id);
    setOpenMenuId(null);
    void (async () => {
      try {
        const entry = await domainPackApi.getDraftEntry(workspace.id);
        navigate(
          `/workspaces/${workspace.id}/domain-packs/${entry.packId}/versions/${entry.versionId}/policies`,
        );
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND) {
          toast.error("수정 가능한 정책 초안이 없습니다.");
          return;
        }
        toast.error("정책 편집 화면으로 이동하지 못했습니다.");
      } finally {
        setPolicyDraftLoadingWorkspaceId(null);
      }
    })();
  };

  const handleOpenRiskDraft = (workspace: WorkspaceResponse) => {
    if (policyDraftLoadingWorkspaceId !== null || riskDraftLoadingWorkspaceId !== null) {
      return;
    }

    setRiskDraftLoadingWorkspaceId(workspace.id);
    setOpenMenuId(null);
    void (async () => {
      try {
        const entry = await domainPackApi.getDraftEntry(workspace.id);
        navigate(
          `/workspaces/${workspace.id}/domain-packs/${entry.packId}/versions/${entry.versionId}/risks`,
        );
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === DOMAIN_PACK_DRAFT_ENTRY_NOT_FOUND) {
          toast.error("조회 가능한 Risk 초안이 없습니다.");
          return;
        }
        toast.error("Risk 조회 화면으로 이동하지 못했습니다.");
      } finally {
        setRiskDraftLoadingWorkspaceId(null);
      }
    })();
  };

  const topbarRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: 280 }}>
        <span
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-3)",
            pointerEvents: "none",
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          placeholder="Search workspaces..."
          style={{
            width: "100%",
            height: 30,
            padding: "0 12px 0 30px",
            borderRadius: "var(--r-2)",
            border: "1px solid var(--line-2)",
            background: "var(--paper-2)",
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <kbd
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-3)",
            background: "var(--paper-3)",
            padding: "1px 4px",
            borderRadius: "var(--r-1)",
            border: "1px solid var(--line-2)",
          }}
        >
          ⌘K
        </kbd>
      </div>
      <button
        type="button"
        onClick={() => setIsCreateOpen(true)}
        style={{
          height: 30,
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: "var(--r-2)",
          padding: "0 14px",
          border: "none",
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="plus" size={14} /> New workspace
      </button>
    </div>
  );

  const getMockMetrics = (workspace: WorkspaceResponse) => {
    const seed = workspace.id;
    return {
      ownerName: workspace.myRole ? "You" : `User ${seed}`,
      intentCount: ((seed * 3) % 12) + 3,
      memberCount: ((seed * 2) % 8) + 2,
      conversationCount: ((seed * 7) % 50) + 10,
      draftCount: ((seed * 5) % 6) + 1,
      packCount: ((seed * 3) % 4) + 1,
      slaPercent: 70 + ((seed * 13) % 25),
    };
  };

  const tabs = [
    { label: "All", count: 14 },
    { label: "Active", count: 11 },
    { label: "Mine", count: 4 },
    { label: "Archived", count: 3 },
  ];

  const pipelineEvents = [
    {
      stage: "preprocessing",
      workspace: "CS Team",
      status: "success" as const,
      time: "2h ago",
      duration: "4m 12s",
    },
    {
      stage: "intent-discovery",
      workspace: "Sales",
      status: "running" as const,
      time: "5h ago",
      duration: "12m 30s",
    },
    {
      stage: "evaluation",
      workspace: "Support",
      status: "failed" as const,
      time: "8h ago",
      duration: "2m 05s",
    },
    {
      stage: "publish-candidate",
      workspace: "CS Team",
      status: "success" as const,
      time: "1d ago",
      duration: "1m 48s",
    },
  ];

  const coverageRows = [
    { code: "CS", name: "CS Team", sla: 94.2 },
    { code: "SA", name: "Sales", sla: 87.5 },
    { code: "SU", name: "Support", sla: 91.0 },
    { code: "OP", name: "Ops", sla: 78.3 },
  ];

  const draftCards = [
    { kind: "policy" as const, daysAgo: 2, name: "Return policy workflow", who: "HJ" },
    { kind: "risk" as const, daysAgo: 4, name: "Fraud detection rules", who: "SY" },
    { kind: "workflow" as const, daysAgo: 5, name: "Escalation flow v3", who: "JH" },
  ];

  const toneMap: Record<string, "signal" | "warn" | "danger" | "info"> = {
    success: "signal",
    running: "info",
    failed: "danger",
  };

  return (
    <OstoneShell active="workflows" crumbs={["Workspaces"]} topbarRight={topbarRight}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Hero strip */}
        <div
          style={{
            padding: "24px 32px 18px",
            borderBottom: "1px solid var(--line-2)",
            display: "flex",
            gap: 32,
            alignItems: "flex-start",
            flexShrink: 0,
          }}
        >
          <div style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 8 }}>
            <Eyebrow>Operations · 26-S1 · ajou capstone</Eyebrow>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 350,
                letterSpacing: "-0.022em",
                lineHeight: 1.15,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              상담 로그에서{" "}
              <span
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  color: "var(--signal-ink)",
                }}
              >
                운영 지식
              </span>
              을 캐내고, 실행 가능한 도메인 팩으로 바꿉니다.
            </h1>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 24,
            }}
          >
            <Stat label="Active workspaces" value="14" delta="+2" sparkData={[3, 5, 4, 6, 7, 5, 8]} />
            <Stat
              label="Drafts in review"
              value="7"
              delta="-1"
              deltaTone="warn"
              sparkData={[3, 5, 4, 6, 7, 5, 8]}
            />
            <Stat
              label="Pipeline runs · 7d"
              value="42"
              delta="+18%"
              sparkData={[3, 5, 4, 6, 7, 5, 8]}
            />
            <Stat
              label="Coverage rate"
              value="91.4%"
              delta="+2.1pp"
              sparkData={[3, 5, 4, 6, 7, 5, 8]}
            />
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Main */}
          <div style={{ flex: 1, padding: "20px 32px", overflow: "auto", minWidth: 0 }}>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {tabs.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--r-2)",
                      border: "none",
                      background: t.label === "All" ? "var(--paper-3)" : "transparent",
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {t.label}
                    <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.count}</Mono>
                  </button>
                ))}
              </div>
              <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Sort: Recently updated · Density: Compact
              </Mono>
            </div>

            {/* Workspace table */}
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.2fr 0.9fr 1.4fr 0.9fr 0.9fr 0.7fr 32px",
                  background: "var(--paper-2)",
                }}
              >
                {["Workspace", "Owner", "Conversations", "Drafts", "SLA", "Updated", ""].map(
                  (h) => (
                    <div
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        color: "var(--ink-3)",
                        letterSpacing: "0.04em",
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </div>
                  ),
                )}
              </div>
              {isLoading && (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--ink-3)",
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                  }}
                >
                  Loading...
                </div>
              )}
              {error && (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--danger)",
                    fontFamily: "var(--sans)",
                    fontSize: 14,
                  }}
                >
                  {error}
                </div>
              )}
              {!isLoading &&
                !error &&
                workspaces.map((ws) => {
                  const metrics = getMockMetrics(ws);
                  return (
                    <div
                      key={ws.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2.2fr 0.9fr 1.4fr 0.9fr 0.9fr 0.7fr 32px",
                        borderTop: "1px solid var(--line-2)",
                        padding: 14,
                        alignItems: "center",
                      }}
                    >
                      {/* Col 1: badge + name + meta */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: "var(--r-2)",
                            background: "var(--paper-3)",
                            fontFamily: "var(--mono)",
                            fontWeight: 700,
                            fontSize: 12,
                            color: "var(--ink)",
                          }}
                        >
                          {ws.workspaceKey.slice(0, 2).toUpperCase()}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenWorkspace(ws)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              fontFamily: "var(--sans)",
                              fontSize: 14,
                              fontWeight: 500,
                              color: "var(--ink)",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {ws.name}
                          </button>
                          <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                            {/* TODO(api): expand WorkspaceResponse with operational metrics */}
                            {ws.workspaceKey.toUpperCase()} · {metrics.intentCount} intents ·{" "}
                            {metrics.memberCount} members · {metrics.conversationCount} conv/7d
                          </Mono>
                        </div>
                      </div>
                      {/* Col 2: Owner */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar
                          initial={metrics.ownerName.slice(0, 2).toUpperCase()}
                          size={24}
                        />
                        <span
                          style={{
                            fontFamily: "var(--sans)",
                            fontSize: 13,
                            color: "var(--ink-2)",
                          }}
                        >
                          {metrics.ownerName}
                        </span>
                      </div>
                      {/* Col 3: Conversations */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* TODO(api): expand WorkspaceResponse with operational metrics */}
                        <SparkBars data={[12, 15, 10, 18, 14, 20, 16]} w={60} h={20} />
                        <Mono style={{ fontSize: 12, color: "var(--ink)" }}>
                          {metrics.conversationCount}
                        </Mono>
                      </div>
                      {/* Col 4: Drafts */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* TODO(api): expand WorkspaceResponse with operational metrics */}
                        <Mono style={{ fontSize: 12, color: "var(--ink)" }}>
                          {metrics.draftCount}/{metrics.packCount}
                        </Mono>
                        <Pill
                          tone={
                            metrics.draftCount > metrics.packCount ? "warn" : "signal"
                          }
                        >
                          {metrics.draftCount > metrics.packCount ? "Behind" : "Current"}
                        </Pill>
                      </div>
                      {/* Col 5: SLA */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {/* TODO(api): expand WorkspaceResponse with operational metrics */}
                        <Bar
                          value={metrics.slaPercent / 100}
                          tone={metrics.slaPercent >= 90 ? "signal" : "ink"}
                          w={80}
                          h={4}
                        />
                        <Mono style={{ fontSize: 11, color: "var(--ink-2)" }}>
                          {metrics.slaPercent}%
                        </Mono>
                      </div>
                      {/* Col 6: Updated */}
                      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString() : "-"}
                      </Mono>
                      {/* Col 7: Actions */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          aria-label="Actions"
                          onClick={() =>
                            setOpenMenuId(openMenuId === ws.id ? null : ws.id)
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--ink-3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: "var(--r-2)",
                          }}
                        >
                          <Icon name="dot3" size={16} />
                        </button>
                        {openMenuId === ws.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 10,
                              background: "var(--paper)",
                              border: "1px solid var(--line-2)",
                              borderRadius: "var(--r-2)",
                              padding: "4px 0",
                              display: "flex",
                              flexDirection: "column",
                              minWidth: 140,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenWorkspace(ws);
                                setOpenMenuId(null);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                padding: "6px 12px",
                                fontFamily: "var(--sans)",
                                fontSize: 12,
                                color: "var(--ink)",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              Open workspace
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPolicyDraft(ws)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: "6px 12px",
                                fontFamily: "var(--sans)",
                                fontSize: 12,
                                color: "var(--ink)",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              Policy draft
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRiskDraft(ws)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: "6px 12px",
                                fontFamily: "var(--sans)",
                                fontSize: 12,
                                color: "var(--ink)",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              Risk draft
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Recent pipeline activity */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    margin: 0,
                    color: "var(--ink)",
                    fontFamily: "var(--sans)",
                  }}
                >
                  Recent pipeline activity
                </h2>
                <Eyebrow>· last 24 hours</Eyebrow>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pipelineEvents.map((ev, i) => {
                  const tone = toneMap[ev.status] || "mute";
                  return (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          width: 9,
                          height: 36,
                          justifyContent: "center",
                        }}
                      >
                        {i > 0 && (
                          <div
                            style={{
                              width: 1,
                              height: 9,
                              background: "var(--line-2)",
                            }}
                          />
                        )}
                        <Dot tone={tone} size={9} />
                        {i < pipelineEvents.length - 1 && (
                          <div
                            style={{
                              width: 1,
                              height: 9,
                              background: "var(--line-2)",
                            }}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--ink)",
                          minWidth: 140,
                        }}
                      >
                        {ev.stage}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          color: "var(--ink-2)",
                          minWidth: 100,
                        }}
                      >
                        {ev.workspace}
                      </span>
                      <Pill tone={tone}>{ev.status}</Pill>
                      <Mono style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>
                        {ev.time}
                      </Mono>
                      <Mono style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {ev.duration}
                      </Mono>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div
            style={{
              width: 300,
              padding: "20px 22px",
              background: "var(--paper-2)",
              overflow: "auto",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Coverage by workspace */}
            <div>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--ink-3)",
                  margin: "0 0 12px",
                  fontFamily: "var(--mono)",
                }}
              >
                Coverage by workspace
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {coverageRows.map((row) => (
                  <div key={row.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--ink)",
                        width: 24,
                      }}
                    >
                      {row.code}
                    </span>
                    <Bar
                      value={row.sla / 100}
                      tone={row.sla >= 90 ? "signal" : "ink"}
                      w={140}
                      h={4}
                    />
                    <Mono style={{ fontSize: 11, color: "var(--ink-2)", marginLeft: "auto" }}>
                      {row.sla}%
                    </Mono>
                  </div>
                ))}
              </div>
            </div>

            {/* Drafts to review */}
            <div>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--ink-3)",
                  margin: "0 0 12px",
                  fontFamily: "var(--mono)",
                }}
              >
                Drafts to review
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {draftCards.map((card, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      borderRadius: "var(--r-2)",
                      background: "var(--paper)",
                      border: "1px solid var(--line-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <Pill
                        tone={
                          card.kind === "policy"
                            ? "signal"
                            : card.kind === "risk"
                              ? "warn"
                              : "info"
                        }
                      >
                        {card.kind}
                      </Pill>
                      <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>
                        {card.daysAgo} days ago
                      </Mono>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--sans)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 6,
                      }}
                    >
                      {card.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar initial={card.who} size={20} />
                      <span
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 11,
                          color: "var(--ink-3)",
                        }}
                      >
                        {card.who}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--ink-3)",
                  margin: "0 0 12px",
                  fontFamily: "var(--mono)",
                }}
              >
                Quick actions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "upload" as const, label: "Upload logs", sub: "CSV or JSON" },
                  { icon: "play" as const, label: "Run pipeline", sub: "Start new job" },
                  { icon: "book" as const, label: "View docs", sub: "Help center" },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: "var(--r-2)",
                      border: "1px solid var(--line-2)",
                      background: "var(--paper)",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <Icon name={action.icon} size={16} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--ink)",
                        }}
                      >
                        {action.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: 11,
                          color: "var(--ink-3)",
                        }}
                      >
                        {action.sub}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchWorkspaces}
      />
      <EditWorkspaceDialog
        workspace={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
      <ArchiveConfirmDialog
        workspace={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
    </OstoneShell>
  );
}
