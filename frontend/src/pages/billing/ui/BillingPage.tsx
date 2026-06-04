import { useEffect, useState } from "react";
import { Navigate, useLocation, useOutletContext, useParams } from "react-router-dom";

import {
  BillingMethodCard,
  PaymentHistoryList,
  QuotaUsageCard,
  SubscriptionStatusCard,
  useBillingOverview,
  usePlanCatalog,
  PLAN_COPY,
  FREE_PLAN_KEY,
  type BillingKeyResponse,
  type PaymentResponse,
} from "@/entities/billing";
import {
  PlanComparison,
  EnterpriseContactDialog,
  type PlanComparisonEntry,
} from "@/features/subscribe-plan";
import { RegisterBillingButton } from "@/features/register-billing-method";
import { CancelSubscriptionButton, RefundButton } from "@/features/cancel-subscription";
import { WorkspaceSettingsNav } from "@/widgets/workspace-settings-nav";
import type { ShellContext } from "@/shared/ui/ostone/chrome";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { Button } from "@/shared/ui/button";
import { LoadingSpinner } from "@/shared/ui/ostone/atoms/LoadingSpinner";
import { ErrorState } from "@/shared/ui/ostone/atoms/ErrorState";
import { EmptyState } from "@/shared/ui/ostone/atoms/EmptyState";

import styles from "./billing-page.module.css";

interface BillingLocationState {
  billingKey?: BillingKeyResponse;
}

export function BillingPage() {
  const { workspaceId } = useParams();
  const { setCrumbs } = useOutletContext<ShellContext>();
  const location = useLocation();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    setCrumbs(["워크스페이스 설정", "구독"]);
    return () => setCrumbs([]);
  }, [setCrumbs]);

  const overviewQuery = useBillingOverview(parsedWorkspaceId);
  const planCatalogQuery = usePlanCatalog();
  const overview = overviewQuery.data ?? null;
  const subscription = overview?.subscription ?? null;
  const showRegister = !subscription || subscription.status === "INCOMPLETE";
  const engaged = subscription?.status === "ACTIVE" || subscription?.status === "PAST_DUE";
  const payments = overview?.payments ?? [];
  const quotaUsages = overview?.quotaUsages ?? [];

  if (parsedWorkspaceId === null) {
    return <Navigate to="/workspaces" replace />;
  }

  const billingKeyFromRedirect = (location.state as BillingLocationState | null)?.billingKey;
  const latestDoneMethod = payments.find((payment) => payment.status === "DONE")?.method;

  const renderPlanAction = (entry: PlanComparisonEntry) => {
    if (entry.current && (engaged || !subscription)) {
      return (
        <Button
          type="button"
          disabled
          className="h-11 w-full rounded-full px-6 disabled:opacity-100"
          data-testid="current-plan-cta"
        >
          이용 중
        </Button>
      );
    }
    if (entry.planKey === FREE_PLAN_KEY) {
      return (
        <Button type="button" variant="outline" className="h-11 w-full rounded-full px-6" disabled>
          기본 제공
        </Button>
      );
    }
    if (entry.contactOnly) {
      return <EnterpriseContactDialog />;
    }
    const planName = PLAN_COPY[entry.planKey]?.name ?? "플랜";
    return (
      <RegisterBillingButton
        workspaceId={parsedWorkspaceId}
        subscription={subscription}
        planKey={entry.planKey}
        label={entry.current ? "결제수단 등록" : `${planName}로 업그레이드`}
      />
    );
  };

  const renderPlansSection = (currentPlanKey: string | null, showBack: boolean) => (
    <div className={styles.sections}>
      {showBack && (
        <div className={styles.backBar}>
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => setShowPlans(false)}
          >
            ← 구독 관리로 돌아가기
          </Button>
        </div>
      )}

      {planCatalogQuery.isLoading && (
        <div className={styles.statePanel} data-testid="plans-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>요금제를 불러오는 중입니다.</p>
        </div>
      )}

      {!planCatalogQuery.isLoading && planCatalogQuery.isError && (
        <div className={styles.statePanel} data-testid="plans-error">
          <ErrorState
            message="요금제를 불러오지 못했습니다."
            onRetry={() => void planCatalogQuery.refetch()}
          />
        </div>
      )}

      {!planCatalogQuery.isLoading && !planCatalogQuery.isError && (
        <>
          <PlanComparison
            catalog={planCatalogQuery.data ?? []}
            currentPlanKey={currentPlanKey}
            renderAction={renderPlanAction}
          />
          <p className={styles.planNote}>
            {subscription?.status === "INCOMPLETE"
              ? "구독이 생성되었지만 결제수단이 등록되지 않았습니다. 카드를 등록하면 구독이 활성화됩니다."
              : "유료 요금제는 카드를 등록하면 매월 자동으로 결제되며 언제든 해지할 수 있습니다."}
          </p>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.pageWrapper}>
      <WorkspaceSettingsNav workspaceId={parsedWorkspaceId} />

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>구독</h1>
        <p className={styles.pageSubtitle}>워크스페이스 구독과 자동결제, 결제 내역을 관리합니다.</p>
      </div>

      {overviewQuery.isLoading && (
        <div className={styles.statePanel} data-testid="billing-loading">
          <LoadingSpinner />
          <p className={styles.stateText}>빌링 정보를 불러오는 중입니다.</p>
        </div>
      )}

      {!overviewQuery.isLoading && overviewQuery.isError && (
        <div className={styles.statePanel} data-testid="billing-error">
          <ErrorState
            message="빌링 정보를 불러오지 못했습니다."
            onRetry={() => void overviewQuery.refetch()}
          />
        </div>
      )}

      {/* 미구독/INCOMPLETE: 요금제 비교를 바로 노출 */}
      {!overviewQuery.isLoading &&
        !overviewQuery.isError &&
        showRegister &&
        renderPlansSection(subscription?.planKey ?? FREE_PLAN_KEY, false)}

      {/* 구독 중: 관리 화면을 먼저 보여주고, 업그레이드 버튼으로 요금제 비교로 이동 */}
      {!overviewQuery.isLoading &&
        !overviewQuery.isError &&
        !showRegister &&
        subscription &&
        (showPlans ? (
          renderPlansSection(subscription.planKey ?? FREE_PLAN_KEY, true)
        ) : (
          <div className={styles.sections}>
            <div className={styles.planSwitchBar}>
              <div>
                <p className={styles.switchTitle}>요금제</p>
                <p className={styles.switchHint}>
                  더 많은 멤버와 도메인팩 생성·검토 한도가 필요하면 요금제를 업그레이드하세요.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="h-11 rounded-full px-9!"
                onClick={() => setShowPlans(true)}
                data-testid="upgrade-plan-button"
              >
                업그레이드
              </Button>
            </div>

            <div className={styles.topRow}>
              <SubscriptionStatusCard subscription={subscription} />
              <BillingMethodCard
                billingKey={billingKeyFromRedirect ?? overview?.billingKey}
                fallbackMethod={latestDoneMethod}
              />
            </div>

            {quotaUsages.length > 0 ? <QuotaUsageCard quotaUsages={quotaUsages} /> : null}

            {payments.length > 0 ? (
              <PaymentHistoryList
                payments={payments}
                renderActions={(payment: PaymentResponse) =>
                  payment.status === "DONE" ? (
                    <RefundButton workspaceId={parsedWorkspaceId} payment={payment} />
                  ) : null
                }
              />
            ) : (
              <div className={styles.emptyHistory}>
                <EmptyState message="아직 결제 내역이 없습니다." />
              </div>
            )}

            <div className={styles.actionsBar}>
              <CancelSubscriptionButton workspaceId={parsedWorkspaceId} />
            </div>
          </div>
        ))}
    </div>
  );
}
