import React, { useEffect, useRef } from "react";
import {
  ConsultationDetailContent,
  type ConsultationDetailContentProps,
} from "./ConsultationDetailContent";
import styles from "../consultation-page.module.css";

type ConsultationDetailPaneProps = ConsultationDetailContentProps & {
  /** ≤1180px 여부. true면 인라인 컬럼 대신 비모달 슬라이드오버로 렌더링한다. */
  isNarrow: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const ConsultationDetailPane: React.FC<ConsultationDetailPaneProps> = ({
  isNarrow,
  isOpen,
  onClose,
  ...content
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 슬라이드오버가 열리면 닫기 버튼으로 focus를 옮기고 Esc로 닫는다. 닫히면 직전
  // focus(트리거 버튼)로 되돌린다. focus-trap은 두지 않아 패널이 열려도 상담사가
  // 메시지 작성칸에 계속 입력할 수 있다 (비모달).
  useEffect(() => {
    if (!isNarrow || !isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isNarrow, isOpen, onClose]);

  if (!isNarrow) {
    return (
      <div className={styles.detailPane}>
        <ConsultationDetailContent {...content} />
      </div>
    );
  }

  return (
    <aside
      className={`${styles.detailDrawer} ${isOpen ? styles.detailDrawerOpen : ""}`}
      role="complementary"
      aria-label="고객 컨텍스트"
    >
      <div className={styles.detailDrawerHeader}>
        <span className={styles.detailDrawerTitle}>고객 컨텍스트</span>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.detailDrawerClose}
          onClick={onClose}
          aria-label="컨텍스트 닫기"
        >
          ✕
        </button>
      </div>
      <div className={styles.detailDrawerBody}>
        <ConsultationDetailContent {...content} />
      </div>
    </aside>
  );
};
