import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { refreshAuthSession } from "../api";
import { clearAuthSession, isAuthenticated, isSuperAdmin } from "../lib/auth";

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * 인증된 사용자만 접근할 수 있도록 보호하는 라우트 컴포넌트입니다.
 * 인증되지 않은 사용자는 로그인 페이지로 리다이렉트됩니다.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
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

  return <>{children}</>;
};

export const AdminRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  return (
    <PrivateRoute>
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
