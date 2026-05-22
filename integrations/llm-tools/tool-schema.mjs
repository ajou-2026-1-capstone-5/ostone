export const LLM_WORKFLOW_TOOL_NAMES = Object.freeze({
  getCurrentWorkflow: "get_current_workflow",
  advanceWorkflow: "advance_current_workflow",
});

export const LLM_SLOT_TOOL_NAMES = Object.freeze({
  getContext: "get_current_slot_context",
  listSlots: "list_current_slots",
  getSlot: "get_current_slot",
  upsertSlotValue: "upsert_current_slot_value",
  listIntents: "list_current_intents",
  selectIntent: "select_current_intent",
  getPolicyContext: "get_current_policy_context",
});

const emptyParameters = Object.freeze({
  type: "object",
  properties: Object.freeze({}),
  required: Object.freeze([]),
  additionalProperties: false,
});

export const llmSlotTools = Object.freeze([
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.getContext,
      description:
        "현재 상담 세션의 workflow execution context, 저장된 slot 값, 아직 비어 있는 slot 목록을 조회한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.listSlots,
      description:
        "현재 상담 세션의 domain pack version에 속한 active slot 정의와 현재 저장 값을 조회한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.getSlot,
      description:
        "현재 상담 세션에서 특정 slotCode의 정의, 수집 힌트, required 여부, 현재 저장 값을 조회한다.",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({
          slotCode: Object.freeze({
            type: "string",
            minLength: 1,
            description: "조회할 slot code. 예: order_id, customer_name",
          }),
        }),
        required: Object.freeze(["slotCode"]),
        additionalProperties: false,
      }),
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.upsertSlotValue,
      description:
        "고객에게서 확보한 slot 값을 현재 상담 세션의 workflow execution에 저장한다.",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({
          slotCode: Object.freeze({
            type: "string",
            minLength: 1,
            description: "저장할 slot code. 예: order_id, customer_name",
          }),
          value: Object.freeze({
            description:
              "저장할 slot 값. string, number, boolean, object, array 모두 가능하다.",
          }),
        }),
        required: Object.freeze(["slotCode", "value"]),
        additionalProperties: false,
      }),
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.listIntents,
      description:
        "현재 상담 세션의 domain pack version에 등록된 전체 intent 목록을 조회한다. 이 목록의 intentCode 중 하나를 선택해야 한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_WORKFLOW_TOOL_NAMES.getCurrentWorkflow,
      description:
        "현재 상담 세션에 묶인 결정론적 워크플로우 그래프와 현재 실행 상태(state, status)를 조회한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.getPolicyContext,
      description:
        "현재 workflow node에 연결된 정책 평가 결과와 policy snapshot을 조회한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_WORKFLOW_TOOL_NAMES.advanceWorkflow,
      description:
        "현재 workflow execution의 state, slot, policy snapshot을 기준으로 다음 action과 state를 계산한다.",
      parameters: emptyParameters,
    }),
  }),
  Object.freeze({
    type: "function",
    function: Object.freeze({
      name: LLM_SLOT_TOOL_NAMES.selectIntent,
      description:
        "list_current_intents로 조회한 intentCode 중 현재 고객 발화에 가장 알맞은 intent를 선택하고 workflow execution을 시작한다.",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({
          intentCode: Object.freeze({
            type: "string",
            minLength: 1,
            description:
              "list_current_intents 응답에 포함된 intentCode. 임의로 생성하지 않고 목록에서 그대로 선택한다.",
          }),
        }),
        required: Object.freeze(["intentCode"]),
        additionalProperties: false,
      }),
    }),
  }),
]);
