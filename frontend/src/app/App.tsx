import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/login/ui/LoginPage';
import { SignupPage } from '../pages/signup/ui/SignupPage';
import { UploadPage } from '../pages/upload/ui/UploadPage';
import { WorkspaceRootRedirect } from '../pages/workspace/ui/WorkspaceRootRedirect';
import { PasswordResetInitPage } from '../pages/password-reset/ui/PasswordResetInitPage';
import { PasswordResetCompletePage } from '../pages/password-reset/ui/PasswordResetCompletePage';
import { ConsultationPage } from '../pages/consultation/ui/ConsultationPage';
import { NotFoundPage } from '../pages/not-found/ui/NotFoundPage';
import { IntentDraftReadPage } from '../pages/domain-pack/ui/IntentDraftReadPage';
import { PolicyDraftReadPage } from '../pages/domain-pack/ui/PolicyDraftReadPage';
import { RiskDraftReadPage } from '../pages/domain-pack/ui/RiskDraftReadPage';
import { SlotDraftReadPage } from '../pages/domain-pack/ui/SlotDraftReadPage';
import { WorkflowDraftReadPage } from '../pages/domain-pack/ui/WorkflowDraftReadPage';
import { DomainPackSummaryPage } from '../pages/domain-pack/ui/DomainPackSummaryPage';
import { WorkspaceLayout } from '../pages/workspace/ui/WorkspaceLayout';
import { WorkspaceWorkflowsPage } from '../pages/workspace/ui/WorkspaceWorkflowsPage';
import { WorkspaceUploadPage } from '../pages/upload/ui/WorkspaceUploadPage';
import { DomainPackListPage } from '../pages/domain-pack/ui/DomainPackListPage';
import { PrivateRoute } from '../shared/ui/PrivateRoute';
import { Toaster } from '../shared/ui/sonner';
import { ChatWorkflowDemoPage } from '../features/chat-workflow/pages/ChatWorkflowDemoPage';

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
        <Route path="/workspaces" element={<PrivateRoute><WorkspaceRootRedirect /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId" element={<PrivateRoute><WorkspaceLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="workflows" replace />} />
          <Route path="workflows" element={<WorkspaceWorkflowsPage />} />
          <Route path="pipeline" element={<UploadPage />} />
          <Route path="consultation" element={<ConsultationPage />} />
          <Route path="consultation/:sessionId" element={<ConsultationPage />} />
          <Route path="upload" element={<WorkspaceUploadPage />} />
          <Route path="domain-packs" element={<DomainPackListPage />} />
        </Route>
        <Route path="/upload" element={<PrivateRoute><Navigate to="/workspaces" replace /></PrivateRoute>} />
        <Route path="/consultation" element={<PrivateRoute><Navigate to="/workspaces" replace /></PrivateRoute>} />
        <Route path="/consultation/:sessionId" element={<PrivateRoute><Navigate to="/workspaces" replace /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId" element={<PrivateRoute><DomainPackSummaryPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/intents/:intentId?" element={<PrivateRoute><IntentDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/policies/:policyId?" element={<PrivateRoute><PolicyDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/risks/:riskId?" element={<PrivateRoute><RiskDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/slots/:slotId?" element={<PrivateRoute><SlotDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/workflows" element={<PrivateRoute><WorkflowDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/workflows/:workflowId" element={<PrivateRoute><WorkflowDraftReadPage /></PrivateRoute>} />
        <Route path="/chat-demo" element={<PrivateRoute><ChatWorkflowDemoPage domainPack={null} scenario={null} messages={[]} workflow={{currentNodeId:null,status:'idle',context:{}}} decisionLog={[]} /></PrivateRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
