import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/login/ui/LoginPage';
import { SignupPage } from '../pages/signup/ui/SignupPage';
import { UploadPage } from '../pages/upload/ui/UploadPage';
import { WorkspaceListPage } from '../pages/workspace-list/ui/WorkspaceListPage';
import { PasswordResetInitPage } from '../pages/password-reset/ui/PasswordResetInitPage';
import { PasswordResetCompletePage } from '../pages/password-reset/ui/PasswordResetCompletePage';
import { ConsultationPage } from '../pages/consultation/ui/ConsultationPage';
import { NotFoundPage } from '../pages/not-found/ui/NotFoundPage';
import { IntentDraftReadPage } from '../pages/domain-pack/ui/IntentDraftReadPage';
import { PolicyDraftReadPage } from '../pages/domain-pack/ui/PolicyDraftReadPage';
import { SlotDraftReadPage } from '../pages/domain-pack/ui/SlotDraftReadPage';
import { WorkflowDraftReadPage } from '../pages/domain-pack/ui/WorkflowDraftReadPage';
import { WorkspaceLayout } from '../pages/workspace/ui/WorkspaceLayout';
import { WorkspaceUploadPage } from '../pages/workspace/ui/WorkspaceUploadPage';
import { WorkspaceWorkflowsPage } from '../pages/workspace/ui/WorkspaceWorkflowsPage';
import { PrivateRoute } from '../shared/ui/PrivateRoute';
import { Toaster } from '../shared/ui/sonner';

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<PasswordResetInitPage />} />
        <Route path="/reset-password/complete" element={<PasswordResetCompletePage />} />
        <Route path="/workspaces" element={<PrivateRoute><WorkspaceListPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId" element={<PrivateRoute><WorkspaceLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="workflows" replace />} />
          <Route path="workflows" element={<WorkspaceWorkflowsPage />} />
          <Route path="upload" element={<WorkspaceUploadPage />} />
        </Route>
        <Route path="/upload" element={<PrivateRoute><UploadPage /></PrivateRoute>} />
        <Route path="/consultation" element={<PrivateRoute><ConsultationPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/intents/:intentId?" element={<PrivateRoute><IntentDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/policies/:policyId?" element={<PrivateRoute><PolicyDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/slots/:slotId?" element={<PrivateRoute><SlotDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/workflows" element={<PrivateRoute><WorkflowDraftReadPage /></PrivateRoute>} />
        <Route path="/workspaces/:workspaceId/domain-packs/:packId/versions/:versionId/workflows/:workflowId" element={<PrivateRoute><WorkflowDraftReadPage /></PrivateRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
