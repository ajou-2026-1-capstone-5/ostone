import { PlusIcon } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { Pill, Mono } from "@/shared/ui/ostone/atoms";

import styles from "./workspace-workflows-page.module.css";

const MOCK_WORKFLOWS = [
  {
    id: 1,
    name: "반품 접수 처리",
    description: "고객 반품 요청부터 환불 승인까지의 워크플로우",
    status: "active" as const,
    nodeCount: 5,
    edgeCount: 4,
  },
  {
    id: 2,
    name: "배송 지연 응대",
    description: "배송 지연 문의 시 자동 응대 및 보상 처리",
    status: "active" as const,
    nodeCount: 7,
    edgeCount: 6,
  },
  {
    id: 3,
    name: "계정 잠금 해제",
    description: "로그인 실패로 인한 계정 잠금 해제 프로세스",
    status: "active" as const,
    nodeCount: 4,
    edgeCount: 3,
  },
  {
    id: 4,
    name: "멤버십 등급 조정",
    description: "고객 멤버십 등급 상향/하향 검토 및 안내",
    status: "draft" as const,
    nodeCount: 6,
    edgeCount: 5,
  },
  {
    id: 5,
    name: "상품 교환 절차",
    description: "불량 상품 교환 접수 및 배송 추적",
    status: "draft" as const,
    nodeCount: 8,
    edgeCount: 7,
  },
];

export function WorkspaceWorkflowsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const handleCardClick = (id: number) => {
    navigate(
      `/workspaces/${parsedWorkspaceId}/domain-packs/1/versions/1/workflows/${id}`,
    );
  };

  const handleNewWorkflow = () => {
    toast("준비 중입니다");
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Workflows</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewWorkflow}
        >
          <PlusIcon className={styles.pageHeaderIcon} />
          <span>새 워크플로우</span>
        </Button>
      </div>

      <div className={styles.workflowGrid}>
        {MOCK_WORKFLOWS.map((workflow) => (
          <article
            key={workflow.id}
            className={styles.workflowCard}
            onClick={() => handleCardClick(workflow.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleCardClick(workflow.id);
              }
            }}
          >
            <div className={styles.workflowCardInner}>
              <div className={styles.workflowCardHeader}>
                <div className={styles.workflowMeta}>
                  <Pill
                    tone={workflow.status === "active" ? "signal" : "mute"}
                  >
                    {workflow.status === "active" ? "ACTIVE" : "DRAFT"}
                  </Pill>
                </div>
              </div>

              <div className={styles.workflowCardContent}>
                <h2 className={styles.workflowTitle}>{workflow.name}</h2>
                <p className={styles.workflowDescription}>
                  {workflow.description}
                </p>
              </div>

              <div className={styles.workflowCardFooter}>
                <Mono className={styles.workflowMetaCount}>
                  {workflow.nodeCount} nodes · {workflow.edgeCount} edges
                </Mono>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
