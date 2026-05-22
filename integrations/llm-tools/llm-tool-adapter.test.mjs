import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LLM_SLOT_TOOL_NAMES,
  buildToolUrl,
  createLlmSlotToolHandler,
  llmSlotTools,
  parseToolCall,
} from "./llm-tool-adapter.mjs";

describe("llm slot tools", () => {
  it("does not expose sessionId in tool schemas", () => {
    for (const tool of llmSlotTools) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(tool.function.parameters.properties, "sessionId"),
        false,
      );
    }
  });

  it("parses OpenAI-style function tool calls", () => {
    const parsed = parseToolCall({
      id: "call_1",
      function: {
        name: LLM_SLOT_TOOL_NAMES.getSlot,
        arguments: "{\"slotCode\":\"order_id\"}",
      },
    });

    assert.deepEqual(parsed, {
      name: LLM_SLOT_TOOL_NAMES.getSlot,
      arguments: { slotCode: "order_id" },
    });
  });

  it("builds backend llm-tools URLs", () => {
    assert.equal(
      buildToolUrl("http://localhost:8080", 7, "/slots/order_id"),
      "http://localhost:8080/api/v1/llm-tools/sessions/7/slots/order_id",
    );
  });

  it("maps get_current_slot tool calls to the backend slot endpoint", async () => {
    const requests = [];
    const handler = createLlmSlotToolHandler({
      backendBaseUrl: "http://localhost:8080",
      bearerToken: "token",
      sessionId: 7,
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          text: async () => "{\"slotCode\":\"order_id\",\"value\":\"A-100\"}",
        };
      },
    });

    const result = await handler({
      id: "call_1",
      function: {
        name: LLM_SLOT_TOOL_NAMES.getSlot,
        arguments: "{\"slotCode\":\"order_id\"}",
      },
    });

    assert.equal(requests[0].url, "http://localhost:8080/api/v1/llm-tools/sessions/7/slots/order_id");
    assert.equal(requests[0].init.method, "GET");
    assert.equal(requests[0].init.headers.Authorization, "Bearer token");
    assert.deepEqual(result, {
      toolCallId: "call_1",
      name: LLM_SLOT_TOOL_NAMES.getSlot,
      result: { slotCode: "order_id", value: "A-100" },
    });
  });

  it("maps upsert_current_slot_value tool calls to PUT with value body", async () => {
    const requests = [];
    const handler = createLlmSlotToolHandler({
      backendBaseUrl: "http://localhost:8080",
      sessionId: 7,
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          text: async () => "{\"slotCode\":\"order_id\",\"value\":\"A-200\"}",
        };
      },
    });

    await handler({
      name: LLM_SLOT_TOOL_NAMES.upsertSlotValue,
      arguments: { slotCode: "order_id", value: "A-200" },
    });

    assert.equal(requests[0].url, "http://localhost:8080/api/v1/llm-tools/sessions/7/slots/order_id");
    assert.equal(requests[0].init.method, "PUT");
    assert.equal(requests[0].init.headers["Content-Type"], "application/json");
    assert.equal(requests[0].init.body, "{\"value\":\"A-200\"}");
  });
});
