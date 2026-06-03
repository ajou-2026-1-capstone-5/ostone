import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { isSubscriptionEngaged, useSubscription } from "@/entities/billing";
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

export function WorkspaceUploadPage() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const parsedWorkspaceId = parseRouteId(workspaceId);
  const pipelineJobId = parseRouteId(searchParams.get("jobId") ?? undefined);
  const workspaceQuery = useGetWorkspace(parsedWorkspaceId ?? 0, {
    query: { enabled: parsedWorkspaceId !== null },
  });
  const subscriptionQuery = useSubscription(parsedWorkspaceId);

  if (parsedWorkspaceId !== null && pipelineJobId !== null) {
    return <Navigate to={`/workspaces/${parsedWorkspaceId}/pipeline-jobs/${pipelineJobId}/review`} replace />;
  }

  const workspace =
    (selectApiData(workspaceQuery.data) as WorkspaceWithFreeOnboarding | undefined) ?? null;
  const subscription = subscriptionQuery.data ?? null;
  const hasActiveSubscription = isSubscriptionEngaged(subscription?.status);

  return (
    <div style={{ padding: "var(--s-6) var(--s-8) var(--s-10)" }}>
      <LogUploadForm
        workspaceId={parsedWorkspaceId ?? undefined}
        freeOnboardingStatus={workspace?.freeOnboardingStatus ?? "AVAILABLE"}
        hasActiveSubscription={hasActiveSubscription}
        isEntitlementLoading={workspaceQuery.isLoading || subscriptionQuery.isLoading}
      />
    </div>
  );
}
