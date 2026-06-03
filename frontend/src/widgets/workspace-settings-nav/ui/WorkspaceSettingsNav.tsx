import { NavLink } from "react-router-dom";

import { buildWorkspaceBillingPath } from "@/shared/lib/billingRoutes";

import styles from "./workspace-settings-nav.module.css";

interface WorkspaceSettingsNavProps {
  workspaceId: number;
}

/** 워크스페이스 설정 섹션의 탭 내비게이션(멤버 / 구독). 설정 화면에서 구독으로 진입하는 경로(U-004=B). */
export function WorkspaceSettingsNav({ workspaceId }: WorkspaceSettingsNavProps) {
  const tabs = [
    { label: "멤버", to: `/workspaces/${workspaceId}/settings/members` },
    { label: "구독", to: buildWorkspaceBillingPath(workspaceId) },
  ];

  return (
    <nav className={styles.nav} aria-label="워크스페이스 설정">
      {tabs.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to}
          end
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
