import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthUser } from '../lib/auth';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 인증된 사용자만 접근할 수 있도록 보호하는 라우트 컴포넌트입니다.
 * 인증되지 않은 사용자는 로그인 페이지로 리다이렉트됩니다.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const user = getAuthUser();
  const location = useLocation();

  if (!user) {
    // 현재 위치를 state에 저장하여 로그인 후 다시 돌아올 수 있게 함
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
