import { formatRawJson, toReadableJson, type ReadableJson } from "@/shared/lib/readableJson";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import styles from "./ReadableJsonCard.module.css";

interface ReadableJsonCardProps {
  label: string;
  raw: string | null | undefined;
}

/**
 * 도메인팩 상세의 JSON 필드를 운영자용 요약으로 표시하고, 원본 JSON은 접기 보기로 유지한다.
 * 빈 값/파싱 실패에서도 화면이 깨지지 않도록 방어적으로 렌더링한다.
 */
export function ReadableJsonCard({ label, raw }: Readonly<ReadableJsonCardProps>) {
  const readable = toReadableJson(raw);
  const showRawToggle = readable.kind === "object" || readable.kind === "list";

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>{label}</header>
      <div className={styles.cardBody}>
        <ReadableBody readable={readable} />
        {showRawToggle && (
          <Accordion type="single" collapsible className={styles.rawAccordion}>
            <AccordionItem value="raw" className={styles.rawItem}>
              <AccordionTrigger className={styles.rawTrigger}>원본 JSON 보기</AccordionTrigger>
              <AccordionContent>
                <pre className={styles.jsonBlock}>
                  <code>{formatRawJson(raw)}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </section>
  );
}

function ReadableBody({ readable }: Readonly<{ readable: ReadableJson }>) {
  if (readable.kind === "empty") {
    return <p className={styles.empty}>—</p>;
  }
  if (readable.kind === "raw") {
    return <p className={styles.fallback}>{readable.text}</p>;
  }
  if (readable.kind === "scalar") {
    return <p className={styles.scalar}>{readable.value}</p>;
  }
  if (readable.kind === "list") {
    return (
      <ul className={styles.list}>
        {readable.items.map((item, index) => (
          <li key={`${item}-${index}`} className={styles.listItem}>
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className={styles.entries}>
      {readable.entries.map((entry, index) => (
        <div key={`${entry.label}-${index}`} className={styles.entryRow}>
          <dt className={styles.entryLabel}>{entry.label}</dt>
          <dd className={styles.entryValue}>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}
