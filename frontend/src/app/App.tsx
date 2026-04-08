import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/login/ui/LoginPage';
import { SignupPage } from '../pages/signup/ui/SignupPage';
import { UploadPage } from '../pages/upload/ui/UploadPage';
import { PasswordResetInitPage } from '../pages/password-reset/ui/PasswordResetInitPage';
import { PasswordResetCompletePage } from '../pages/password-reset/ui/PasswordResetCompletePage';
import { ConsultationPage } from '../pages/consultation/ui/ConsultationPage';
import { NotFoundPage } from '../pages/not-found/ui/NotFoundPage';
import { PrivateRoute } from '../shared/ui/PrivateRoute';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<PasswordResetInitPage />} />
        <Route path="/reset-password/complete" element={<PasswordResetCompletePage />} />
        <Route path="/upload" element={<PrivateRoute><UploadPage /></PrivateRoute>} />
        <Route path="/consultation" element={<PrivateRoute><ConsultationPage /></PrivateRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}