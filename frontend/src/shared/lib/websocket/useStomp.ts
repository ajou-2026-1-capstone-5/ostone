import { useCallback, useEffect, useRef, useState } from "react";
import type { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { createStompClient } from "./stompClient";

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

const MESSAGE_QUEUE = "/user/queue/messages";
const SEND_DESTINATION = "/app/chat.send";

export interface UseStompResult<TLastMessage = unknown> {
  connectionStatus: ConnectionStatus;
  sendMessage: (message: unknown) => void;
  lastMessage: TLastMessage | null;
  connect: () => void;
  disconnect: () => void;
}

function parseMessage<TLastMessage>(message: IMessage): TLastMessage {
  return JSON.parse(message.body) as TLastMessage;
}

export function useStomp<TLastMessage = unknown>(): UseStompResult<TLastMessage> {
  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [lastMessage, setLastMessage] = useState<TLastMessage | null>(null);

  const disconnect = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    clientRef.current?.deactivate();
    setConnectionStatus("DISCONNECTED");
  }, []);

  const connect = useCallback(() => {
    if (clientRef.current?.connected) return;

    const client = createStompClient();
    clientRef.current = client;
    setConnectionStatus("CONNECTING");

    client.onConnect = () => {
      setConnectionStatus("CONNECTED");
      subscriptionRef.current = client.subscribe(MESSAGE_QUEUE, (message) => {
        setLastMessage(parseMessage<TLastMessage>(message));
      });
    };

    client.onDisconnect = () => {
      setConnectionStatus("DISCONNECTED");
    };

    client.onStompError = () => {
      setConnectionStatus("ERROR");
    };

    client.onWebSocketError = () => {
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

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { connectionStatus, sendMessage, lastMessage, connect, disconnect };
}
