import { useCallback, useEffect, useRef, useState } from "react";
import type { Client, StompSubscription } from "@stomp/stompjs";
import { createStompClient } from "./stompClient";

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

const SEND_DESTINATION = "/app/chat.sendMessage";
const ERROR_QUEUE = "/user/queue/errors";

export interface UseStompResult {
  connectionStatus: ConnectionStatus;
  sendMessage: (message: unknown) => void;
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string, cb: (msg: unknown) => void) => () => void;
  sendTo: (destination: string, body: unknown) => void;
}

export function useStomp(): UseStompResult {
  const clientRef = useRef<Client | null>(null);
  const errorSubscriptionRef = useRef<StompSubscription | null>(null);
  const customSubscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  const connectionStatusRef = useRef<ConnectionStatus>("DISCONNECTED");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  const disconnect = useCallback(() => {
    errorSubscriptionRef.current?.unsubscribe();
    errorSubscriptionRef.current = null;
    customSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    customSubscriptionsRef.current.clear();
    clientRef.current?.deactivate();
    clientRef.current = null;
    connectionStatusRef.current = "DISCONNECTED";
    setConnectionStatus("DISCONNECTED");
  }, []);

  const connect = useCallback(() => {
    if (
      connectionStatusRef.current === "CONNECTING" ||
      connectionStatusRef.current === "CONNECTED"
    ) {
      return;
    }
    if (clientRef.current?.connected) return;

    const client = createStompClient();
    clientRef.current = client;
    connectionStatusRef.current = "CONNECTING";
    setConnectionStatus("CONNECTING");

    client.onConnect = () => {
      if (clientRef.current !== client) return;
      connectionStatusRef.current = "CONNECTED";
      setConnectionStatus("CONNECTED");
      errorSubscriptionRef.current = client.subscribe(ERROR_QUEUE, (message) => {
        try {
          const error = JSON.parse(message.body) as unknown;
          console.error("WebSocket server error:", error);
        } catch {
          // ignore malformed error frames
        }
      });
    };

    client.onDisconnect = () => {
      if (clientRef.current !== client) return;
      connectionStatusRef.current = "DISCONNECTED";
      setConnectionStatus("DISCONNECTED");
    };

    client.onStompError = () => {
      if (clientRef.current !== client) return;
      connectionStatusRef.current = "ERROR";
      setConnectionStatus("ERROR");
    };

    client.onWebSocketError = () => {
      if (clientRef.current !== client) return;
      connectionStatusRef.current = "ERROR";
      setConnectionStatus("ERROR");
    };

    client.activate();
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    const client = clientRef.current;
    if (!client?.connected) return;

    client.publish({
      destination: SEND_DESTINATION,
      body: JSON.stringify(message),
    });
  }, []);

  const subscribe = useCallback(
    (topic: string, cb: (msg: unknown) => void): (() => void) => {
      const client = clientRef.current;
      if (!client?.connected) {
        return () => {};
      }

      const subscription = client.subscribe(topic, (message) => {
        try {
          cb(JSON.parse(message.body) as unknown);
        } catch {
          // Skip malformed messages
        }
      });
      const prev = customSubscriptionsRef.current.get(topic);
      prev?.unsubscribe();
      customSubscriptionsRef.current.set(topic, subscription);

      return () => {
        subscription.unsubscribe();
        const current = customSubscriptionsRef.current.get(topic);
        if (current === subscription) {
          customSubscriptionsRef.current.delete(topic);
        }
      };
    },
    [],
  );

  const sendTo = useCallback((destination: string, body: unknown) => {
    const client = clientRef.current;
    if (!client?.connected) return;

    client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const scheduleConnect = async () => {
      await Promise.resolve();
      if (isMounted) {
        connect();
      }
    };
    void scheduleConnect();
    return () => {
      isMounted = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { connectionStatus, sendMessage, connect, disconnect, subscribe, sendTo };
}
