import { Client } from "@stomp/stompjs";
import { getAccessToken } from "@/shared/lib/auth";

const DEFAULT_WS_URL = "ws://localhost:8080";
const API_BASE_SUFFIX = "/api/v1";

function normalizeWsUrl(url: string): string {
  return url
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/$/, "");
}

function getWebSocketBaseUrl(): string {
  const raw = import.meta.env.VITE_WS_URL ?? resolveWsUrlFromApiBase() ?? DEFAULT_WS_URL;
  return normalizeWsUrl(raw);
}

function resolveWsUrlFromApiBase(): string | undefined {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiBaseUrl || apiBaseUrl.startsWith("/")) {
    return undefined;
  }

  return apiBaseUrl.endsWith(API_BASE_SUFFIX)
    ? apiBaseUrl.slice(0, -API_BASE_SUFFIX.length)
    : apiBaseUrl;
}

export function createStompClient(): Client {
  const client = new Client({
    brokerURL: `${getWebSocketBaseUrl()}/ws/chat`,
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });
  client.beforeConnect = () => {
    const token = getAccessToken();
    client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  };
  return client;
}
