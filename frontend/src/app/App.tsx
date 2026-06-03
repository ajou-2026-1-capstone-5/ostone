import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { LoginPage } from "../pages/login/ui/LoginPage";
import { SignupPage } from "../pages/signup/ui/SignupPage";
import { WorkspaceRootRedirect } from "../pages/workspace/ui/WorkspaceRootRedirect";
import { PasswordResetInitPage } from "../pages/password-reset/ui/PasswordResetInitPage";
import { PasswordResetCompletePage } from "../pages/password-reset/ui/PasswordResetCompletePage";
import { ChatHistoryPage } from "../pages/consultation/ui/chat-history/ChatHistoryPage";
import { ConsultationPage } from "../pages/consultation/ui/ConsultationPage";
import { UserChatPage } from "../pages/user-chat";
import { DemoPage } from "../pages/demo";
import { AdminLayout } from "../pages/admin/ui/AdminLayout";
import { AdminCustomersPage } from "../pages/admin/ui/AdminCustomersPage";
import { AdminPlaceholderPage } from "../pages/admin/ui/AdminPlaceholderPage";
import { AdminPipelineJobsPage } from "../pages/admin/ui/AdminPipelineJobsPage";
import { AdminSuperAdminsPage } from "../pages/admin/ui/AdminSuperAdminsPage";
import { NotFoundPage } from "../pages/not-found/ui/NotFoundPage";
import { IntentDraftReadPage } from "../pages/domain-pack/ui/IntentDraftReadPage";
import { PolicyDraftReadPage } from "../pages/domain-pack/ui/PolicyDraftReadPage";
import { RiskDraftReadPage } from "../pages/domain-pack/ui/RiskDraftReadPage";
import { SlotDraftReadPage } from "../pages/domain-pack/ui/SlotDraftReadPage";
import { WorkflowDraftReadPage } from "../pages/domain-pack/ui/WorkflowDraftReadPage";
import { PackWorkflowListPage } from "../pages/domain-pack/ui/PackWorkflowListPage";
import { DomainPackSummaryPage } from "../pages/domain-pack/ui/DomainPackSummaryPage";
import { DomainPackRouteOutlet } from "../pages/domain-pack/ui/DomainPackRouteOutlet";
import { WorkspaceLayout } from "../pages/workspace/ui/WorkspaceLayout";
import { WorkspaceMembersPage } from "../pages/workspace/ui/WorkspaceMembersPage";
import { BillingPage, BillingSuccessPage, BillingFailPage } from "../pages/billing";
import { WorkspaceWorkflowsPage } from "../pages/workspace/ui/WorkspaceWorkflowsPage";
import { WorkspaceUploadPage } from "../pages/upload/ui/WorkspaceUploadPage";
import { PipelineReviewPage } from "../pages/pipeline-review/ui/PipelineReviewPage";
import { DomainPackListPage } from "../pages/domain-pack/ui/DomainPackListPage";
import { AdminRoute, PrivateRoute } from "../shared/ui/PrivateRoute";
import { ErrorBoundary } from "../shared/ui/ErrorBoundary";
import { Toaster } from "../shared/ui/sonner";
import { WorkflowGraphViewerPage } from "../pages/domain-pack/ui/WorkflowGraphViewerPage";
import { LegacyDomainPackVersionRedirect } from "../pages/domain-pack/ui/LegacyDomainPackVersionRedirect";
import { buildDemoChatPath } from "../shared/lib/demoRoutes";
import { buildUserChatPath } from "../shared/lib/userChatRoutes";

function LegacyDemoChatRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { search } = useLocation();

  if (!workspaceId) {
    return <Navigate to="/demo" replace />;
  }

  return <Navigate to={`${buildDemoChatPath(workspaceId)}${search}`} replace />;
}

function LegacyUserChatRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { search } = useLocation();

  if (!workspaceId) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Navigate to={`${buildUserChatPath(workspaceId)}${search}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-reset" element={<PasswordResetInitPage />} />
        <Route path="/password-reset/complete" element={<PasswordResetCompletePage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="super-admins" replace />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route
            path="billing"
            element={<AdminPlaceholderPage eyebrow="Billing" title="결제 관리" />}
          />
          <Route path="airflow" element={<AdminPipelineJobsPage />} />
          <Route path="super-admins" element={<AdminSuperAdminsPage />} />
        </Route>
        <Route
          path="/workspaces"
          element={
            <PrivateRoute>
              <WorkspaceRootRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="/workspaces/:workspaceId"
          element={
            <PrivateRoute>
              <WorkspaceLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="workflows" replace />} />
          <Route path="workflows" element={<WorkspaceWorkflowsPage />} />
          <Route path="pipeline" element={<Navigate to="upload" replace />} />
          <Route path="consultation/history" element={<ChatHistoryPage />} />
          <Route path="consultation/history/:sessionId" element={<ChatHistoryPage />} />
          <Route path="consultation" element={<ConsultationPage />} />
          <Route path="consultation/:sessionId" element={<ConsultationPage />} />
          <Route path="upload" element={<WorkspaceUploadPage />} />
          <Route path="pipeline-jobs/:pipelineJobId/review" element={<PipelineReviewPage />} />
          <Route path="domain-packs" element={<DomainPackListPage />} />
          <Route path="settings/members" element={<WorkspaceMembersPage />} />
          <Route
            path="billing"
            element={
              <ErrorBoundary fallback={<div>페이지를 불러오는 중 오류가 발생했습니다.</div>}>
                <BillingPage />
              </ErrorBoundary>
            }
          />
        </Route>
        <Route
          path="/billing/success"
          element={
            <PrivateRoute>
              <ErrorBoundary fallback={<div>페이지를 불러오는 중 오류가 발생했습니다.</div>}>
                <BillingSuccessPage />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/billing/fail"
          element={
            <PrivateRoute>
              <ErrorBoundary fallback={<div>페이지를 불러오는 중 오류가 발생했습니다.</div>}>
                <BillingFailPage />
              </ErrorBoundary>
            </PrivateRoute>
          }
        />
        <Route
          path="/demo"
          element={
            <ErrorBoundary fallback={<div>페이지를 불러오는 중 오류가 발생했습니다.</div>}>
              <DemoPage />
            </ErrorBoundary>
          }
        />
        <Route path="/demo/chat/:workspaceId" element={<UserChatPage />} />
        <Route
          path="/chat/:workspaceId"
          element={
            <PrivateRoute>
              <UserChatPage mode="authenticated" />
            </PrivateRoute>
          }
        />
        <Route
          path="/workspaces/:workspaceId/chat"
          element={
            <PrivateRoute>
              <LegacyUserChatRedirect />
            </PrivateRoute>
          }
        />
        <Route path="/demo/workspaces/:workspaceId/chat" element={<LegacyDemoChatRedirect />} />
        <Route
          path="/upload"
          element={
            <PrivateRoute>
              <Navigate to="/workspaces" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/consultation"
          element={
            <PrivateRoute>
              <Navigate to="/workspaces" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/consultation/:sessionId"
          element={
            <PrivateRoute>
              <Navigate to="/workspaces" replace />
            </PrivateRoute>
          }
        />
        <Route
          path="/workspaces/:workspaceId/domain-packs/:packId"
          element={
            <PrivateRoute>
              <DomainPackRouteOutlet />
            </PrivateRoute>
          }
        >
          <Route index element={<DomainPackSummaryPage />} />
          <Route path="intents" element={<IntentDraftReadPage />}>
            <Route path=":intentId" />
          </Route>
          <Route path="policies" element={<PolicyDraftReadPage />}>
            <Route path=":policyId" />
          </Route>
          <Route path="risks" element={<RiskDraftReadPage />}>
            <Route path=":riskId" />
          </Route>
          <Route path="slots" element={<SlotDraftReadPage />}>
            <Route path=":slotId" />
          </Route>
          <Route path="workflows">
            <Route index element={<PackWorkflowListPage />} />
            <Route path=":workflowId" element={<WorkflowDraftReadPage />} />
            <Route path=":workflowId/graph" element={<WorkflowGraphViewerPage />} />
          </Route>
          <Route path="versions/:versionId/*" element={<LegacyDomainPackVersionRedirect />} />
          <Route path="versions/:versionId" element={<LegacyDomainPackVersionRedirect />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
