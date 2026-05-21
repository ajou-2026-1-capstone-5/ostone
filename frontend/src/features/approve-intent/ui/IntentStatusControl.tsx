import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import type { IntentApprovalStatus } from "../model/types";
import styles from "./intent-status-control.module.css";

interface IntentStatusControlProps {
  intentStatus: "DRAFT" | IntentApprovalStatus;
  onPublish: () => void;
  onReject: () => void;
  isPending: boolean;
}

export function IntentStatusControl({
  intentStatus,
  onPublish,
  onReject,
  isPending,
}: Readonly<IntentStatusControlProps>) {
  const isDisabled = intentStatus !== "DRAFT" || isPending;

  const renderButtonContent = (label: string) => {
    if (isPending) {
      return (
        <>
          <Spinner />
          처리 중...
        </>
      );
    }
    return label;
  };

  return (
    <div className={styles.container}>
      <span className={styles.header}>intent 상태 관리</span>
      <div className={styles.buttonGroup}>
        <Button variant="default" size="sm" onClick={onPublish} disabled={isDisabled}>
          {renderButtonContent("승인")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onReject} disabled={isDisabled}>
          {renderButtonContent("반려")}
        </Button>
      </div>
    </div>
  );
}
