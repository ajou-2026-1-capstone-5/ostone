import { CreateSuperAdminForm } from "@/features/admin";
import styles from "./admin-page.module.css";

export function AdminSuperAdminsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Access Control</p>
        <h1>관리자 계정</h1>
      </div>
      <div className={styles.panel}>
        <CreateSuperAdminForm />
      </div>
    </section>
  );
}
