import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logoutApi } from "../api/authApi";
import { clearAuthSession } from "../../../shared/lib/auth";

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      toast.error("로그아웃 처리에 실패했습니다.");
      console.error("logout failed");
    } finally {
      // 서버 요청 실패와 관계없이 클라이언트 세션 상태를 정리한다.
      clearAuthSession();
      navigate("/login", { replace: true });
    }
  };

  return { logout };
};
