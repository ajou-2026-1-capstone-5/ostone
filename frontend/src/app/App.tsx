import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/login/ui/LoginPage";
import { SignupPage } from "../pages/signup/ui/SignupPage";
import { WorkspaceRootRedirect } from "../pages/workspace/ui/WorkspaceRootRedirect";
import { PasswordResetInitPage } from "../pages/password-reset/ui/PasswordResetInitPage";
import { PasswordResetCompletePage } from "../pages/password-reset/ui/PasswordResetCompletePage";
import { ChatHistoryPage } from "../pages/consultation/ui/chat-history/ChatHistoryPage";
import { ConsultationPage } from "../pages/consultation/ui/ConsultationPage";
import { UserChatPage } from "../pages/user-chat";
import { DemoPage } from "../pages/demo";
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
import { WorkspaceWorkflowsPage } from "../pages/workspace/ui/WorkspaceWorkflowsPage";
import { WorkspaceUploadPage } from "../pages/upload/ui/WorkspaceUploadPage";
import { DomainPackListPage } from "../pages/domain-pack/ui/DomainPackListPage";
import { PrivateRoute } from "../shared/ui/PrivateRoute";
import { Toaster } from "../shared/ui/sonner";
import { WorkflowGraphViewerPage } from "../pages/domain-pack/ui/WorkflowGraphViewerPage";
import { LegacyDomainPackVersionRedirect } from "../pages/domain-pack/ui/LegacyDomainPackVersionRedirect";

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
          <Route path="domain-packs" element={<DomainPackListPage />} />
        </Route>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/demo/workspaces/:workspaceId/chat" element={<UserChatPage />} />
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
