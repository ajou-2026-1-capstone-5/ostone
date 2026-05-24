import { CheckIcon, XIcon } from "lucide-react";

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
  if (intentStatus !== "DRAFT") {
    return null;
  }

  const isDisabled = isPending;

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
    <div className={styles.container} aria-label="intent 검토 액션">
      <div className={styles.buttonGroup}>
        <Button
          variant="default"
          size="default"
          className={styles.primaryButton}
          onClick={onPublish}
          disabled={isDisabled}
        >
          {isPending ? null : <CheckIcon aria-hidden="true" />}
          {renderButtonContent("승인")}
        </Button>
        <Button
          variant="outline"
          size="default"
          className={styles.rejectButton}
          onClick={onReject}
          disabled={isDisabled}
        >
          {isPending ? null : <XIcon aria-hidden="true" />}
          {renderButtonContent("반려")}
        </Button>
      </div>
    </div>
  );
}
