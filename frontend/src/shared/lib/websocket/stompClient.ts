import { Client } from "@stomp/stompjs";
import { getAccessToken } from "@/shared/lib/auth";

const DEFAULT_WS_URL = "http://localhost:8080";

function getWebSocketBaseUrl(): string {
  return import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
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
