import type { Page } from "@playwright/test";

export async function installMockStomp(page: Page) {
  await page.addInitScript(() => {
    const state = window as Window & {
      __e2eWsFrames?: string[];
      WebSocket: typeof WebSocket;
    };

    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readonly url: string;
      readonly protocol = "";
      readonly extensions = "";
      binaryType: BinaryType = "blob";
      bufferedAmount = 0;
      readyState = MockWebSocket.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          const event = new Event("open");
          this.onopen?.(event);
          this.dispatchEvent(event);
        }, 0);
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        const frame = typeof data === "string" ? data : String(data);
        state.__e2eWsFrames = [...(state.__e2eWsFrames ?? []), frame];

        if (frame.startsWith("CONNECT") || frame.startsWith("STOMP")) {
          window.setTimeout(() => {
            const event = new MessageEvent("message", {
              data: "CONNECTED\nversion:1.2\n\n\0",
            });
            this.onmessage?.(event);
            this.dispatchEvent(event);
          }, 0);
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        const event = new CloseEvent("close");
        this.onclose?.(event);
        this.dispatchEvent(event);
      }
    }

    state.__e2eWsFrames = [];
    state.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });
}
