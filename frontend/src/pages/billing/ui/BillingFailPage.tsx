import { useNavigate, useSearchParams } from "react-router-dom";

import { buildWorkspaceBillingPath } from "@/shared/lib/billingRoutes";
import { Button } from "@/shared/ui/button";

import styles from "./billing-landing.module.css";

/** 결제/등록 실패 복귀 랜딩. failUrl 의 code/message 를 안내하고 구독 화면으로 재시도하도록 한다. */
export function BillingFailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const workspaceIdRaw = searchParams.get("workspaceId");
  const workspaceId = workspaceIdRaw ? Number(workspaceIdRaw) : NaN;
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  const retryPath = Number.isNaN(workspaceId)
    ? "/workspaces"
    : buildWorkspaceBillingPath(workspaceId);

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h1 className={styles.title}>결제가 완료되지 않았습니다</h1>
        <p className={styles.message}>
          {message ?? "결제가 취소되었거나 처리 중 문제가 발생했습니다. 다시 시도해 주세요."}
        </p>
        {code ? <span className={styles.code}>오류 코드: {code}</span> : null}
        <div className={styles.actions}>
          <Button
            type="button"
            className="rounded-full px-6"
            onClick={() => navigate(retryPath, { replace: true })}
          >
            다시 시도
          </Button>
        </div>
      </div>
    </div>
  );
}
