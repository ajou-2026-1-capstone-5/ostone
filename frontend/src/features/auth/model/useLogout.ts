import { useNavigate } from 'react-router-dom';
import { logoutApi } from '../api/authApi';
import { getRefreshToken, clearAuthSession } from '../../../shared/lib/auth';

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        // 서버에 로그아웃 요청 (refreshToken 무효화)
        // 에러가 나더라도 세션은 클라이언트에서 비워줌으로써 로컬 환경 정리 보장
        try {
          await logoutApi(refreshToken);
        } catch (err) {
          console.error('logout failed');
        }
      }
    } finally {
      // 무조건 로컬 데이터부터 비워줘서 보안 유지 및 UI 상태 초기화
      clearAuthSession();
      navigate('/login', { replace: true });
    }
  };

  return { logout };
};