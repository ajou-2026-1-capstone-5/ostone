/**
 * 운영자 상담 화면의 메시지 정렬 기준.
 *
 * 서버가 확정한 `seqNo`를 1순위로 사용하고, `seqNo`가 없으면 `createdAt`으로
 * 안정 정렬한다. 둘 다 구분되지 않으면(같은 `seqNo`/같은 시각, 또는 optimistic
 * 메시지처럼 둘 다 없는 경우) 원래(입력) 순서를 유지하는 안정 tie-breaker를 둔다.
 * 이렇게 하면 WebSocket 이벤트가 역순으로 도착하거나 거의 동시에 도착해도
 * 화면 순서가 뒤바뀌지 않는다.
 */
export interface ServerOrderableMessage {
  seqNo?: number;
  createdAt?: string;
}

// seqNo가 없는 메시지(optimistic 등)는 seqNo가 있는 서버 확정 메시지 뒤로 보낸다.
const SEQ_NO_FALLBACK = Number.POSITIVE_INFINITY;

const toComparableTime = (createdAt?: string): number => {
  if (!createdAt) return Number.POSITIVE_INFINITY;
  const time = new Date(createdAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/**
 * 두 메시지의 서버 순서를 비교한다. 0이면 순서를 구분할 수 없으므로
 * 호출 측에서 원래 순서를 안정 tie-breaker로 사용해야 한다.
 */
export const compareByServerOrder = (
  a: ServerOrderableMessage,
  b: ServerOrderableMessage,
): number => {
  const seqA = a.seqNo ?? SEQ_NO_FALLBACK;
  const seqB = b.seqNo ?? SEQ_NO_FALLBACK;
  if (seqA !== seqB) return seqA - seqB;

  const timeA = toComparableTime(a.createdAt);
  const timeB = toComparableTime(b.createdAt);
  if (timeA !== timeB) return timeA - timeB;

  return 0;
};

/**
 * `seqNo → createdAt → 원래 순서` 기준으로 메시지를 안정 정렬한다.
 */
export const sortMessagesByServerOrder = <T extends ServerOrderableMessage>(
  messages: T[],
): T[] =>
  messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const byServerOrder = compareByServerOrder(a.message, b.message);
      return byServerOrder !== 0 ? byServerOrder : a.index - b.index;
    })
    .map(({ message }) => message);
