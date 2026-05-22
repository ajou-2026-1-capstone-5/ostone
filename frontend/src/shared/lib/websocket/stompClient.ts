import { Client } from "@stomp/stompjs";
import { getAccessToken } from "@/shared/lib/auth";

const DEFAULT_WS_URL = "ws://localhost:8080";

function normalizeWsUrl(url: string): string {
  return url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/$/, "");
}

function getWebSocketBaseUrl(): string {
  const raw = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
  return normalizeWsUrl(raw);
}

export function createStompClient(): Client {
  const token = getAccessToken();

  return new Client({
    brokerURL: `${getWebSocketBaseUrl()}/ws/chat`,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });
}
