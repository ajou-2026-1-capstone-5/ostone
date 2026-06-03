import { AdminCustomerDashboard } from "@/features/admin";
import styles from "./admin-page.module.css";

export function AdminCustomersPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Customers</p>
        <h1>고객사 현황</h1>
      </div>
      <div className={styles.panel}>
        <AdminCustomerDashboard />
      </div>
    </section>
  );
}
