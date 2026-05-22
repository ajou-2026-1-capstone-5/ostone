# LLM Conversation State Tools

이 모듈은 외부 LLM function calling layer가 backend의 현재 대화 상태 tool REST API를 호출하도록 연결한다.

현재 backend endpoint:

```text
GET /api/v1/llm-tools/sessions/{sessionId}/context
GET /api/v1/llm-tools/sessions/{sessionId}/intents
POST /api/v1/llm-tools/sessions/{sessionId}/intent-selection
GET /api/v1/llm-tools/sessions/{sessionId}/slots
GET /api/v1/llm-tools/sessions/{sessionId}/slots/{slotCode}
PUT /api/v1/llm-tools/sessions/{sessionId}/slots/{slotCode}
```

## Usage

```js
import {
  createLlmSlotToolHandler,
  llmSlotTools,
} from "./llm-tool-adapter.mjs";

const handleToolCall = createLlmSlotToolHandler({
  backendBaseUrl: "http://localhost:8080",
  bearerToken: process.env.OPERATOR_JWT,
  sessionId: currentSessionId,
});

// LLM 요청에 llmSlotTools를 tools로 전달한다.
// LLM이 tool_call을 반환하면 handler에 넘겨 backend REST API를 호출한다.
const toolResult = await handleToolCall(toolCall);
```

`sessionId`는 tool schema에 노출하지 않는다. 현재 상담 세션은 adapter가 주입한다.

## Tool Names

| Tool | Purpose |
| --- | --- |
| `get_current_slot_context` | 현재 세션의 전체 slot context, missing slot 목록, 저장된 값을 조회 |
| `list_current_intents` | 현재 세션 domain pack version에 등록된 intent 목록 조회 |
| `select_current_intent` | 목록에서 선택한 `intentCode`로 workflow execution을 시작하고 필수 slot 누락 여부 조회 |
| `list_current_slots` | 현재 세션의 active slot 목록 조회 |
| `get_current_slot` | 특정 `slotCode`의 정의와 현재 값 조회 |
| `upsert_current_slot_value` | 특정 `slotCode`에 수집한 값을 저장 |
