import { LLM_SLOT_TOOL_NAMES, LLM_WORKFLOW_TOOL_NAMES, llmSlotTools } from "./tool-schema.mjs";

export { LLM_SLOT_TOOL_NAMES, LLM_WORKFLOW_TOOL_NAMES, llmSlotTools };

export function createLlmSlotToolHandler({
  backendBaseUrl,
  bearerToken,
  sessionId,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!backendBaseUrl) {
    throw new Error("backendBaseUrl is required");
  }
  if (!sessionId) {
    throw new Error("sessionId is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl must be a function");
  }

  return async function handleLlmSlotToolCall(toolCall) {
    const { name, arguments: args } = parseToolCall(toolCall);

    switch (name) {
      case LLM_WORKFLOW_TOOL_NAMES.getCurrentWorkflow:
        return wrapToolResult(toolCall, name, await requestJson("/workflow"));

      case LLM_WORKFLOW_TOOL_NAMES.advanceWorkflow:
        return wrapToolResult(
          toolCall,
          name,
          await requestRuntimeJson("/advance", { method: "POST" }),
        );

      case LLM_SLOT_TOOL_NAMES.getContext:
        return wrapToolResult(toolCall, name, await requestJson("/context"));

      case LLM_SLOT_TOOL_NAMES.getPolicyContext:
        return wrapToolResult(toolCall, name, await requestJson("/policy-context"));

      case LLM_SLOT_TOOL_NAMES.listIntents:
        return wrapToolResult(toolCall, name, await requestJson("/intents"));

      case LLM_SLOT_TOOL_NAMES.selectIntent: {
        const intentCode = requireString(args, "intentCode");
        return wrapToolResult(
          toolCall,
          name,
          await requestJson("/intent-selection", {
            method: "POST",
            body: { intentCode },
          }),
        );
      }

      case LLM_SLOT_TOOL_NAMES.listSlots:
        return wrapToolResult(toolCall, name, await requestJson("/slots"));

      case LLM_SLOT_TOOL_NAMES.getSlot: {
        const slotCode = requireString(args, "slotCode");
        return wrapToolResult(
          toolCall,
          name,
          await requestJson(`/slots/${encodeURIComponent(slotCode)}`),
        );
      }

      case LLM_SLOT_TOOL_NAMES.upsertSlotValue: {
        const slotCode = requireString(args, "slotCode");
        if (!Object.prototype.hasOwnProperty.call(args, "value")) {
          throw new Error("value is required");
        }
        return wrapToolResult(
          toolCall,
          name,
          await requestJson(`/slots/${encodeURIComponent(slotCode)}`, {
            method: "PUT",
            body: { value: args.value },
          }),
        );
      }

      default:
        throw new Error(`Unsupported tool call: ${name}`);
    }
  };

  async function requestJson(path, { method = "GET", body } = {}) {
    const url = buildToolUrl(backendBaseUrl, sessionId, path);
    return requestBackendJson(url, { method, body });
  }

  async function requestRuntimeJson(path, { method = "GET", body } = {}) {
    const url = buildRuntimeUrl(backendBaseUrl, sessionId, path);
    return requestBackendJson(url, { method, body });
  }

  async function requestBackendJson(url, { method = "GET", body } = {}) {
    const headers = {
      Accept: "application/json",
    };
    const token = typeof bearerToken === "function" ? await bearerToken() : bearerToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const responseText = await response.text();

    if (!response.ok) {
      const error = new Error(`LLM slot tool request failed: ${response.status}`);
      error.status = response.status;
      error.payload = parseResponsePayload(responseText);
      throw error;
    }

    return responseText ? JSON.parse(responseText) : null;
  }
}

export function parseToolCall(toolCall) {
  const name = toolCall?.function?.name ?? toolCall?.name;
  if (!name) {
    throw new Error("tool call name is required");
  }

  const rawArguments = toolCall?.function?.arguments ?? toolCall?.arguments ?? {};
  return {
    name,
    arguments: parseArguments(rawArguments),
  };
}

export function buildToolUrl(backendBaseUrl, sessionId, path) {
  const baseUrl = backendBaseUrl.endsWith("/") ? backendBaseUrl : `${backendBaseUrl}/`;
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const relativePath =
    `api/v1/llm-tools/sessions/${encodeURIComponent(sessionId)}${normalizedPath}`;
  return new URL(relativePath, baseUrl).toString();
}

export function buildRuntimeUrl(backendBaseUrl, sessionId, path) {
  const baseUrl = backendBaseUrl.endsWith("/") ? backendBaseUrl : `${backendBaseUrl}/`;
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const relativePath =
    `api/v1/workflow-runtime/sessions/${encodeURIComponent(sessionId)}${normalizedPath}`;
  return new URL(relativePath, baseUrl).toString();
}

function parseArguments(rawArguments) {
  if (typeof rawArguments === "string") {
    const trimmed = rawArguments.trim();
    return trimmed ? JSON.parse(trimmed) : {};
  }
  if (rawArguments && typeof rawArguments === "object") {
    return rawArguments;
  }
  return {};
}

function requireString(args, key) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function parseResponsePayload(responseText) {
  if (!responseText) {
    return null;
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function wrapToolResult(toolCall, name, result) {
  return {
    toolCallId: toolCall?.id ?? toolCall?.call_id ?? null,
    name,
    result,
  };
}
