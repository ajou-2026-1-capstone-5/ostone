import styles from "./intent-revision-draft.module.css";

export function IntentRevisionRecoveryBanner() {
  return (
    <div className={styles.recoveryBanner} role="status">
      상담 유형 수정 초안은 생성됐지만 첫 수정 내용은 저장되지 않았습니다. 다시 수정 후 저장해 주세요.
    </div>
  );
}
