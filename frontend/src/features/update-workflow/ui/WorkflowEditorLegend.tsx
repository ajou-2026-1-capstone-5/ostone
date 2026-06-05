import styles from "./workflowEditorLegend.module.css";

const NODE_GUIDE: ReadonlyArray<{ name: string; description: string }> = [
  { name: "시작", description: "상담 흐름이 시작되는 진입 지점" },
  { name: "처리", description: "응대 기준(Policy)에 따라 동작을 수행" },
  { name: "분기", description: "전환 조건에 따라 다음 흐름을 가르는 갈림길" },
  { name: "응답", description: "고객에게 보낼 안내·답변" },
  { name: "배정", description: "상담사에게 연결·핸드오프" },
  { name: "종료", description: "상담 흐름이 끝나는 지점" },
];

/** 워크플로우 편집기 상단 안내. 노드 종류와 '표시값 vs 실행 식별자' 차이를 설명한다. */
export function WorkflowEditorLegend() {
  return (
    <section className={styles.legend} aria-label="워크플로우 편집 가이드">
      <h3 className={styles.title}>편집 가이드</h3>
      <ul className={styles.nodeList}>
        {NODE_GUIDE.map((node) => (
          <li key={node.name} className={styles.nodeItem}>
            <span className={styles.nodeName}>{node.name}</span>
            <span className={styles.nodeDescription}>{node.description}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        노드 이름·응답 내용·전환 조건은 운영자에게 보이는 표시값입니다. 워크플로우 코드, 노드 ID,
        응대 기준 코드(policyRef)는 실행 엔진이 사용하는 내부 식별자로, 수정하면 실제 상담 흐름의 동작
        기준이 바뀝니다.
      </p>
    </section>
  );
}
