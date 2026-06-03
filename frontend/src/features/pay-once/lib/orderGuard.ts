/**
 * 처리 완료한 orderId 표식(중복 confirm 가드). orderId 는 FE 가 생성한 비민감 식별자이므로 sessionStorage 에
 * 저장해도 된다 — paymentKey/authKey/customerKey/billingKey 같은 민감정보는 절대 저장하지 않는다.
 */
const STORAGE_KEY = "ostone.billing.processedOrders";

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function isOrderProcessed(orderId: string): boolean {
  return read().includes(orderId);
}

export function markOrderProcessed(orderId: string): void {
  try {
    const current = read();
    if (current.includes(orderId)) {
      return;
    }
    // 무한 증가 방지: 최근 50건만 유지.
    const next = [...current, orderId].slice(-50);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* sessionStorage 사용 불가 환경에서는 가드를 생략한다(백엔드 idempotency 가 최종 방어). */
  }
}
