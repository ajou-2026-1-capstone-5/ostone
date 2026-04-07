import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/login/ui/LoginPage';
import { SignupPage } from '../pages/signup/ui/SignupPage';
import { UploadPage } from '../pages/upload/ui/UploadPage';
import { ConsultationPage } from '../pages/consultation/ui/ConsultationPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/consultation" element={<ConsultationPage />} />
      </Routes>
    </BrowserRouter>
  );
}
