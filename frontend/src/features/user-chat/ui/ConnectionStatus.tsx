import { Circle, Loader2 } from "lucide-react";
import type { ConnectionStatus as ChatConnectionStatus } from "@/entities/chat";

export interface ConnectionStatusProps {
  status: ChatConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  if (status === "CONNECTING") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        연결 중...
      </div>
    );
  }

  if (status === "CONNECTED") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-black">
        <Circle className="size-3 fill-gray-900 text-gray-900" aria-hidden="true" />
        연결됨
      </div>
    );
  }

  if (status === "DISCONNECTED") {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600">
        <Circle className="size-3 fill-gray-500 text-gray-500" aria-hidden="true" />
        <span>연결 끊김</span>
        <span className="text-gray-500">재연결 중...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black">
      <Circle className="size-3 fill-black text-black" aria-hidden="true" />
      연결 오류
    </div>
  );
}
