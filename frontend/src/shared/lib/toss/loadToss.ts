import { loadTossPayments, type TossPaymentsSDK } from "@tosspayments/tosspayments-sdk";

/**
 * 토스페이먼츠 v2 SDK 래퍼. clientKey(공개키)만 FE에 노출되며 secretKey/billingKey는 서버에만 둔다.
 * 동적 script 로드 대신 npm import(stompClient.ts 패턴)를 사용한다.
 */
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;

export class TossClientKeyMissingError extends Error {
  constructor() {
    super("VITE_TOSS_CLIENT_KEY 가 설정되지 않았습니다.");
    this.name = "TossClientKeyMissingError";
  }
}

let sdkPromise: Promise<TossPaymentsSDK> | null = null;

export function loadToss(): Promise<TossPaymentsSDK> {
  if (!CLIENT_KEY) {
    return Promise.reject(new TossClientKeyMissingError());
  }
  if (!sdkPromise) {
    sdkPromise = loadTossPayments(CLIENT_KEY).catch((err) => {
      sdkPromise = null;
      throw err;
    });
  }
  return sdkPromise;
}

export function isTossClientKeyConfigured(): boolean {
  return Boolean(CLIENT_KEY);
}
