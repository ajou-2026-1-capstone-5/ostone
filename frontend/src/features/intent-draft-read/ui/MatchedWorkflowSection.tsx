import { useLocation, useNavigate } from "react-router-dom";

import {
  useListWorkflowsByIntent,
  WorkflowGraphMini,
  type WorkspaceWorkflowEntry,
} from "@/entities/workflow";
import { Mono } from "@/shared/ui/ostone/atoms";
import { WorkflowRow } from "@/shared/ui/ostone/molecules/WorkflowRow";
import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";

import styles from "./MatchedWorkflowSection.module.css";

interface MatchedWorkflowSectionProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentId: number | null;
}

export function MatchedWorkflowSection({
  wsId,
  packId,
  versionId,
  intentId,
}: MatchedWorkflowSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, entries } = useListWorkflowsByIntent({
    workspaceId: wsId,
    packId,
    versionId,
    intentDefinitionId: intentId,
  });

  const openWorkflow = (entry: WorkspaceWorkflowEntry) => {
    navigate(
      domainPackSectionPath(
        wsId,
        entry.packId,
        entry.versionId,
        "workflows",
        entry.workflowId,
      ),
      {
        state: { workflowReturnTo: `${location.pathname}${location.search}` },
      },
    );
  };

  if (intentId === null) return null;

  return (
    <section
      className={styles.section}
      data-testid="matched-workflow-section"
      aria-labelledby="matched-workflow-section-title"
    >
      <header className={styles.header}>
        <h2 id="matched-workflow-section-title" className={styles.title}>
          매칭된 워크플로우
        </h2>
        <Mono className={styles.count}>
          {loading ? "loading…" : `${entries.length} ITEMS`}
        </Mono>
      </header>

      {loading && (
        <div
          className={styles.placeholder}
          data-testid="matched-workflow-section-loading"
        >
          <Mono>워크플로우 조회 중…</Mono>
        </div>
      )}

      {!loading && error && (
        <div
          className={styles.placeholder}
          data-testid="matched-workflow-section-error"
        >
          <Mono>{error}</Mono>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div
          className={styles.placeholder}
          data-testid="matched-workflow-section-empty"
        >
          <Mono>이 인텐트에 매칭된 워크플로우가 없습니다.</Mono>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div
          className={styles.list}
          data-testid="matched-workflow-section-list"
        >
          {entries.map((entry) => (
            <WorkflowRow
              key={entry.workflowId}
              entry={entry}
              testIdPrefix="matched-workflow-row"
              onOpen={() => openWorkflow(entry)}
              graphSlot={
                <WorkflowGraphMini
                  workspaceId={wsId}
                  packId={entry.packId}
                  versionId={entry.versionId}
                  workflowId={entry.workflowId}
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
