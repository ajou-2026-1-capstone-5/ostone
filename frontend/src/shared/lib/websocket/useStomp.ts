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

export interface UseStompOptions {
  onServerError?: (error: unknown) => void;
  includeAuth?: boolean;
}

const parseMessageBody = (body: string): unknown | null => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

export function useStomp(options: UseStompOptions = {}): UseStompResult {
  const includeAuth = options.includeAuth;
  const clientRef = useRef<Client | null>(null);
  const errorSubscriptionRef = useRef<StompSubscription | null>(null);
  const desiredSubscriptionsRef = useRef<Map<string, (msg: unknown) => void>>(new Map());
  const activeSubscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  const connectionStatusRef = useRef<ConnectionStatus>("DISCONNECTED");
  const onServerErrorRef = useRef<UseStompOptions["onServerError"]>(options.onServerError);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    onServerErrorRef.current = options.onServerError;
  }, [options.onServerError]);

  const unsubscribeActiveSubscriptions = useCallback(() => {
    activeSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    activeSubscriptionsRef.current.clear();
  }, []);

  const subscribeActiveTopic = useCallback(
    (client: Client, topic: string, cb: (msg: unknown) => void) => {
      const subscription = client.subscribe(topic, (message) => {
        const parsed = parseMessageBody(message.body);
        if (parsed !== null) {
          cb(parsed);
        }
      });
      activeSubscriptionsRef.current.get(topic)?.unsubscribe();
      activeSubscriptionsRef.current.set(topic, subscription);
    },
    [],
  );

  const disconnectInternal = useCallback((clearDesiredSubscriptions: boolean) => {
    errorSubscriptionRef.current?.unsubscribe();
    errorSubscriptionRef.current = null;
    unsubscribeActiveSubscriptions();
    if (clearDesiredSubscriptions) {
      desiredSubscriptionsRef.current.clear();
    }
    clientRef.current?.deactivate();
    clientRef.current = null;
    connectionStatusRef.current = "DISCONNECTED";
    setConnectionStatus("DISCONNECTED");
  }, [unsubscribeActiveSubscriptions]);

  const disconnect = useCallback(() => {
    disconnectInternal(true);
  }, [disconnectInternal]);

  const connect = useCallback(() => {
    if (
      connectionStatusRef.current === "CONNECTING" ||
      connectionStatusRef.current === "CONNECTED"
    ) {
      return;
    }
    if (clientRef.current?.connected) return;

    const client = createStompClient({ includeAuth });
    clientRef.current = client;
    connectionStatusRef.current = "CONNECTING";
    setConnectionStatus("CONNECTING");

    client.onConnect = () => {
      if (clientRef.current !== client) return;
      connectionStatusRef.current = "CONNECTED";
      setConnectionStatus("CONNECTED");
      errorSubscriptionRef.current?.unsubscribe();
      errorSubscriptionRef.current = null;
      // 익명(데모) 세션은 서버에서 /user/queue/errors 구독이 허용되지 않으므로 건너뛴다.
      // 구독을 시도하면 서버가 STOMP ERROR 프레임으로 연결을 끊어 연결 자체가 실패한다.
      if (includeAuth !== false) {
        errorSubscriptionRef.current = client.subscribe(ERROR_QUEUE, (message) => {
          const error = parseMessageBody(message.body);
          if (error !== null) {
            console.error("WebSocket server error:", error);
            onServerErrorRef.current?.(error);
          }
        });
      }
      unsubscribeActiveSubscriptions();
      desiredSubscriptionsRef.current.forEach((cb, topic) => {
        subscribeActiveTopic(client, topic, cb);
      });
    };

    client.onDisconnect = () => {
      if (clientRef.current !== client) return;
      errorSubscriptionRef.current?.unsubscribe();
      errorSubscriptionRef.current = null;
      unsubscribeActiveSubscriptions();
      connectionStatusRef.current = "DISCONNECTED";
      setConnectionStatus("DISCONNECTED");
    };

    client.onStompError = () => {
      if (clientRef.current !== client) return;
      errorSubscriptionRef.current?.unsubscribe();
      errorSubscriptionRef.current = null;
      unsubscribeActiveSubscriptions();
      connectionStatusRef.current = "ERROR";
      setConnectionStatus("ERROR");
    };

    client.onWebSocketError = () => {
      if (clientRef.current !== client) return;
      errorSubscriptionRef.current?.unsubscribe();
      errorSubscriptionRef.current = null;
      unsubscribeActiveSubscriptions();
      connectionStatusRef.current = "ERROR";
      setConnectionStatus("ERROR");
    };

    client.activate();
  }, [includeAuth, subscribeActiveTopic, unsubscribeActiveSubscriptions]);

  const sendMessage = useCallback((message: unknown) => {
    const client = clientRef.current;
    if (!client?.connected) return;

    client.publish({
      destination: SEND_DESTINATION,
      body: JSON.stringify(message),
    });
  }, []);

  const subscribe = useCallback((topic: string, cb: (msg: unknown) => void): (() => void) => {
    desiredSubscriptionsRef.current.set(topic, cb);
    const client = clientRef.current;
    if (client?.connected) {
      subscribeActiveTopic(client, topic, cb);
    }

    return () => {
      if (desiredSubscriptionsRef.current.get(topic) === cb) {
        desiredSubscriptionsRef.current.delete(topic);
        activeSubscriptionsRef.current.get(topic)?.unsubscribe();
        activeSubscriptionsRef.current.delete(topic);
      }
    };
  }, [subscribeActiveTopic]);

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
      disconnectInternal(false);
    };
  }, [connect, disconnectInternal]);

  return { connectionStatus, sendMessage, connect, disconnect, subscribe, sendTo };
}
