import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { refreshAuthSession } from "../api";
import { clearAuthSession, isAuthenticated, isSuperAdmin } from "../lib/auth";

interface PrivateRouteProps {
  children: React.ReactNode;
  /**
   * 슈퍼어드민의 접근 허용 여부입니다. 기본값은 `false`로, 슈퍼어드민은
   * 일반 보호 라우트 접근 시 `/admin`으로 리다이렉트됩니다. 관리자 전용
   * 라우트(`AdminRoute`)에서만 `true`로 설정합니다.
   */
  allowSuperAdmin?: boolean;
}

/**
 * 인증된 사용자만 접근할 수 있도록 보호하는 라우트 컴포넌트입니다.
 * 인증되지 않은 사용자는 로그인 페이지로 리다이렉트됩니다.
 * 슈퍼어드민은 별도로 허용하지 않는 한 관리자 화면(`/admin`)으로 리다이렉트됩니다.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowSuperAdmin = false }) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(() =>
    isAuthenticated() ? true : null,
  );

  useEffect(() => {
    let isMounted = true;

    if (isAuthenticated()) return undefined;

    refreshAuthSession().then((refreshed) => {
      if (!isMounted) {
        return;
      }

      if (refreshed) {
        setIsAuthorized(true);
        return;
      }

      clearAuthSession();
      setIsAuthorized(false);
    });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (isAuthorized === null) {
    return null;
  }

  if (!isAuthorized) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowSuperAdmin && isSuperAdmin()) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  return (
    <PrivateRoute allowSuperAdmin>
      <RequireSuperAdmin>{children}</RequireSuperAdmin>
    </PrivateRoute>
  );
};

const RequireSuperAdmin: React.FC<PrivateRouteProps> = ({ children }) => {
  if (!isSuperAdmin()) {
    return <Navigate to="/workspaces" replace />;
  }

  return <>{children}</>;
};
