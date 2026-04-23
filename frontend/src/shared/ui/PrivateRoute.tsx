import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearAuthSession, isAuthenticated } from '../lib/auth';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 인증된 사용자만 접근할 수 있도록 보호하는 라우트 컴포넌트입니다.
 * 인증되지 않은 사용자는 로그인 페이지로 리다이렉트됩니다.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    clearAuthSession();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
