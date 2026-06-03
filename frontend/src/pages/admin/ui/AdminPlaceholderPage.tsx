import styles from "./admin-page.module.css";

interface AdminPlaceholderPageProps {
  eyebrow: string;
  title: string;
}

export function AdminPlaceholderPage({ eyebrow, title }: AdminPlaceholderPageProps) {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className={styles.placeholder} aria-label={title} />
    </section>
  );
}
