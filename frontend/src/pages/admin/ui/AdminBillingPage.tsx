import { AdminBillingManagement } from "@/features/admin-billing";
import styles from "./admin-page.module.css";

export function AdminBillingPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Billing</p>
        <h1>결제 관리</h1>
      </div>
      <div className={styles.panel}>
        <AdminBillingManagement />
      </div>
    </section>
  );
}
