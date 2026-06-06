import { useEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  isSubscriptionEngaged,
  useSubscription,
  type SubscriptionResponse,
} from "@/entities/billing";
import {
  LogUploadForm,
  type FreeOnboardingStatus,
} from "../../../features/log-upload/ui/LogUploadForm";
import { selectApiData } from "@/shared/api";
import { useGetWorkspace } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import { parseRouteId } from "@/shared/lib/parseRouteId";

interface WorkspaceWithFreeOnboarding {
  freeOnboardingStatus?: FreeOnboardingStatus;
}

const ENTITLEMENT_REFETCH_BUFFER_MS = 500;
const MAX_TIMEOUT_MS = 2_147_483_647;

function getEntitlementRefetchDelay(
  periodEnd: string | undefined,
): number | null {
  if (!periodEnd) {
    return null;
  }

  const periodEndMs = new Date(periodEnd).getTime();
  if (!Number.isFinite(periodEndMs)) {
    return null;
  }

  const delay = periodEndMs - Date.now() + ENTITLEMENT_REFETCH_BUFFER_MS;
  if (delay <= 0) {
    return null;
  }

  return Math.min(delay, MAX_TIMEOUT_MS);
}

function resolvePaidUploadCooldown(subscription: SubscriptionResponse | null) {
  const quota = subscription?.quotaUsages?.find(
    (usage) => usage.resource === "DOMAIN_PACK_OPERATION",
  );
  const limit = quota?.limit ?? 0;
  return {
    isBlocked: limit >= 0 && Boolean(quota?.warning),
    nextAvailableAt: quota?.nextAvailableAt ?? null,
  };
}

export function WorkspaceUploadPage() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const pipelineJobId = parseRouteId(searchParams.get("jobId") ?? undefined);
  const workspaceQuery = useGetWorkspace(parsedWorkspaceId ?? 0, {
    query: { enabled: parsedWorkspaceId !== null },
  });
  const subscriptionQuery = useSubscription(parsedWorkspaceId);

  const workspace =
    (selectApiData(workspaceQuery.data) as
      | WorkspaceWithFreeOnboarding
      | undefined) ?? null;
  const subscription =
    (subscriptionQuery.data as SubscriptionResponse | null) ?? null;
  const hasActiveSubscription = isSubscriptionEngaged(subscription?.status);
  const paidUploadCooldown = resolvePaidUploadCooldown(subscription);
  const refetchWorkspace = workspaceQuery.refetch;
  const refetchSubscription = subscriptionQuery.refetch;
  const isEntitlementLoading = Boolean(
    workspaceQuery.isLoading ||
    workspaceQuery.isFetching ||
    subscriptionQuery.isLoading ||
    subscriptionQuery.isFetching,
  );

  useEffect(() => {
    if (parsedWorkspaceId === null) {
      return undefined;
    }

    const delay = getEntitlementRefetchDelay(subscription?.currentPeriodEnd);
    if (delay === null) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      void refetchWorkspace();
      void refetchSubscription();
    }, delay);

    return () => window.clearTimeout(timerId);
  }, [
    parsedWorkspaceId,
    refetchSubscription,
    refetchWorkspace,
    subscription?.currentPeriodEnd,
  ]);

  if (parsedWorkspaceId !== null && pipelineJobId !== null) {
    return (
      <Navigate
        to={`/workspaces/${parsedWorkspaceId}/pipeline-jobs/${pipelineJobId}/review`}
        replace
      />
    );
  }

  return (
    <div style={{ padding: "var(--s-6) var(--s-8) var(--s-10)" }}>
      <LogUploadForm
        workspaceId={parsedWorkspaceId ?? undefined}
        freeOnboardingStatus={workspace?.freeOnboardingStatus ?? "AVAILABLE"}
        hasActiveSubscription={hasActiveSubscription}
        isEntitlementLoading={isEntitlementLoading}
        paidUploadCooldown={paidUploadCooldown}
      />
    </div>
  );
}
