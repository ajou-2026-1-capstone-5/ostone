import { Building2, CreditCard, Plane, ShieldPlus } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import styles from "./admin-layout.module.css";

const NAV_ITEMS = [
  { to: "/admin/customers", label: "고객사 현황", icon: Building2 },
  { to: "/admin/billing", label: "결제 관리", icon: CreditCard },
  { to: "/admin/airflow", label: "Airflow 운영", icon: Plane },
  { to: "/admin/super-admins", label: "관리자 계정", icon: ShieldPlus },
];

export function AdminLayout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="admin navigation">
        <div className={styles.brand}>
          <span>CStone</span>
          <strong>Admin</strong>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.activeNavLink : ""}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <span>CStone Admin Console</span>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
