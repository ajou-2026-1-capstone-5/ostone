import { useEffect, useMemo, useState } from "react";
import { Navigate, useOutletContext, useParams } from "react-router-dom";
import { PlusIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { useListAllWorkspaceWorkflows } from "@/entities/workflow";
import { simulationApi, type SimulationSessionDetail } from "@/features/simulation";
import type { ChatMessage, ChatSession } from "@/features/consultation/api/consultationApi";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { Button } from "@/shared/ui/button";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";

import styles from "./simulation/workspace-simulation-page.module.css";

const PAGE_SIZE = 20;

type Meta = {
  customerName?: string;
};

function parseMeta(metaJson?: string | null): Meta {
  if (!metaJson) return {};
  try {
    const parsed = JSON.parse(metaJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Meta;
    }
  } catch {
    return {};
  }
  return {};
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function roleLabel(role?: string | null): string {
  switch (role) {
    case "USER":
    case "CUSTOMER":
      return "고객";
    case "ASSISTANT":
      return "시스템";
    case "SYSTEM":
      return "상태";
    default:
      return role ?? "메시지";
  }
}

function customerName(session: ChatSession | null): string {
  return parseMeta(session?.metaJson).customerName ?? "시뮬레이션 고객";
}

function slotEntries(detail: SimulationSessionDetail | null) {
  const values = detail?.slotValues ?? {};
  return Object.entries(values).filter(([, value]) => value !== null && value !== undefined);
}

export function WorkspaceSimulationPage() {
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const { setCrumbs } = useOutletContext<ShellContext>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [detail, setDetail] = useState<SimulationSessionDetail | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState("시뮬레이션 고객");
  const [workflowDefinitionId, setWorkflowDefinitionId] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workflows = useListAllWorkspaceWorkflows({ workspaceId: parsedWorkspaceId });
  const selectedWorkflow = useMemo(() => {
    const numericId = Number(workflowDefinitionId);
    return workflows.entries.find((entry) => entry.workflowId === numericId) ?? null;
  }, [workflowDefinitionId, workflows.entries]);

  useEffect(() => {
    setCrumbs(["시뮬레이션"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  useEffect(() => {
    if (parsedWorkspaceId === null) return;

    let active = true;
    setIsLoadingSessions(true);
    setError(null);
    simulationApi
      .listSessions(parsedWorkspaceId, { page: 0, size: PAGE_SIZE })
      .then((page) => {
        if (!active) return;
        setSessions(page.content);
        if (selectedSessionId === null && page.content[0]?.id) {
          setSelectedSessionId(page.content[0].id);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("시뮬레이션 세션 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoadingSessions(false);
      });

    return () => {
      active = false;
    };
  }, [parsedWorkspaceId, selectedSessionId]);

  useEffect(() => {
    if (parsedWorkspaceId === null || selectedSessionId === null) {
      setDetail(null);
      return;
    }

    let active = true;
    setIsLoadingDetail(true);
    setError(null);
    simulationApi
      .getSession(parsedWorkspaceId, selectedSessionId)
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch(() => {
        if (active) setError("시뮬레이션 세션 상세를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [parsedWorkspaceId, selectedSessionId]);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const reloadSessions = async () => {
    const page = await simulationApi.listSessions(parsedWorkspaceId, { page: 0, size: PAGE_SIZE });
    setSessions(page.content);
  };

  const handleCreateSession = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const created = await simulationApi.createSession(parsedWorkspaceId, {
        customerName: customerNameInput,
        ...(workflowDefinitionId ? { workflowDefinitionId: Number(workflowDefinitionId) } : {}),
      });
      setDetail(created);
      setSelectedSessionId(created.session.id ?? null);
      await reloadSessions();
    } catch {
      toast.error("시뮬레이션 세션을 만들지 못했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async () => {
    const content = messageInput.trim();
    if (!content || detail?.session.id == null) return;
    setIsSending(true);
    setError(null);
    try {
      const nextDetail = await simulationApi.sendMessage(parsedWorkspaceId, detail.session.id, {
        content,
      });
      setDetail(nextDetail);
      setMessageInput("");
      await reloadSessions();
    } catch {
      toast.error("시뮬레이션 메시지 응답을 생성하지 못했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  const messages = detail?.messages ?? [];
  const slots = slotEntries(detail);
  const matched = detail?.matchedWorkflow ?? null;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Simulation Lab</p>
          <h1 className={styles.pageTitle}>상담 시뮬레이션</h1>
          <p className={styles.pageSubtitle}>
            운영 중인 Domain Pack 기준으로 고객 문의를 시험하고 매칭된 workflow 상태를
            확인합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void reloadSessions().catch(() => {
              toast.error("시뮬레이션 세션 목록을 새로고침하지 못했습니다.");
            });
          }}
          disabled={isLoadingSessions}
        >
          <RefreshCwIcon className={styles.buttonIcon} />
          <span>새로고침</span>
        </Button>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <section className={styles.createPanel} aria-labelledby="simulation-create-title">
        <div>
          <h2 id="simulation-create-title" className={styles.sectionTitle}>
            새 시뮬레이션
          </h2>
          <p className={styles.sectionDescription}>
            workflow를 비워두면 첫 고객 메시지를 기준으로 intent를 매칭합니다.
          </p>
        </div>
        <label className={styles.field}>
          <span>고객 이름</span>
          <input
            value={customerNameInput}
            onChange={(event) => setCustomerNameInput(event.target.value)}
            maxLength={100}
          />
        </label>
        <label className={styles.field}>
          <span>시작 workflow</span>
          <NativeSelect
            value={workflowDefinitionId}
            onChange={(event) => setWorkflowDefinitionId(event.target.value)}
            aria-label="시작 workflow 선택"
          >
            <NativeSelectOption value="">자동 매칭</NativeSelectOption>
            {workflows.entries.map((workflow) => (
              <NativeSelectOption key={workflow.workflowId} value={String(workflow.workflowId)}>
                {workflow.packName} · {workflow.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="button" onClick={handleCreateSession} disabled={isCreating}>
          <PlusIcon className={styles.buttonIcon} />
          <span>{isCreating ? "생성 중" : "세션 생성"}</span>
        </Button>
      </section>

      <div className={styles.labGrid}>
        <aside className={styles.sessionPane} aria-label="시뮬레이션 세션 목록">
          <div className={styles.paneHeader}>
            <h2 className={styles.sectionTitle}>세션</h2>
            <span className={styles.countBadge}>{sessions.length}</span>
          </div>
          {isLoadingSessions ? (
            <div className={styles.statePanel}>
              <LoadingSpinner />
              <p>세션을 불러오는 중입니다.</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.statePanel}>
              <EmptyState message="아직 시뮬레이션 세션이 없습니다." />
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((session) => {
                const selected = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`${styles.sessionItem} ${selected ? styles.sessionItemSelected : ""}`}
                    onClick={() => setSelectedSessionId(session.id ?? null)}
                  >
                    <span>{customerName(session)}</span>
                    <small>
                      {session.status} · {formatTime(session.startedAt)}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={styles.chatPane} aria-label="시뮬레이션 대화">
          <div className={styles.paneHeader}>
            <div>
              <h2 className={styles.sectionTitle}>{customerName(detail?.session ?? null)}</h2>
              <p className={styles.sectionDescription}>
                {selectedWorkflow ? selectedWorkflow.name : "자동 매칭"} 기준으로 응답합니다.
              </p>
            </div>
            <span className={styles.channelBadge}>SIMULATION</span>
          </div>

          {isLoadingDetail ? (
            <div className={styles.statePanel}>
              <LoadingSpinner />
              <p>대화를 불러오는 중입니다.</p>
            </div>
          ) : detail === null ? (
            <div className={styles.statePanel}>
              <EmptyState message="세션을 선택하거나 새 세션을 생성하세요." />
            </div>
          ) : (
            <>
              <div className={styles.messageList}>
                {messages.length === 0 ? (
                  <p className={styles.emptyMessage}>고객 메시지를 입력하면 응답이 생성됩니다.</p>
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble
                      key={message.id ?? `${message.seqNo ?? index}-${message.createdAt ?? ""}`}
                      message={message}
                    />
                  ))
                )}
              </div>
              <div className={styles.composer}>
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="고객 역할 메시지 입력"
                  rows={3}
                />
                <Button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || !messageInput.trim()}
                >
                  <SendIcon className={styles.buttonIcon} />
                  <span>{isSending ? "응답 생성 중" : "전송"}</span>
                </Button>
              </div>
            </>
          )}
        </section>

        <aside className={styles.statePane} aria-label="매칭 상태">
          <h2 className={styles.sectionTitle}>Runtime State</h2>
          <dl className={styles.stateList}>
            <div>
              <dt>Intent</dt>
              <dd>{matched?.intentName ?? matched?.intentCode ?? "미매칭"}</dd>
            </div>
            <div>
              <dt>Workflow</dt>
              <dd>{matched?.workflowName ?? matched?.workflowCode ?? "미매칭"}</dd>
            </div>
            <div>
              <dt>Current State</dt>
              <dd>{matched?.currentState ?? "대기"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{matched?.executionStatus ?? detail?.session.status ?? "대기"}</dd>
            </div>
          </dl>

          <div className={styles.slotPanel}>
            <h3>수집된 Slot</h3>
            {slots.length === 0 ? (
              <p>아직 수집된 slot 값이 없습니다.</p>
            ) : (
              <ul>
                {slots.map(([key, value]) => (
                  <li key={key}>
                    <span>{key}</span>
                    <strong>{String(value)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isCustomer = message.senderRole === "USER" || message.senderRole === "CUSTOMER";
  return (
    <article className={`${styles.message} ${isCustomer ? styles.messageCustomer : ""}`}>
      <div className={styles.messageMeta}>
        <span>{roleLabel(message.senderRole)}</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>
      <p>{message.content}</p>
    </article>
  );
}
