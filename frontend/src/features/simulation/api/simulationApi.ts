import { customFetch } from "@/shared/api/mutator";
import { requireApiData, selectApiData } from "@/shared/api";
import type { ChatMessage, ChatSession } from "@/features/consultation/api/consultationApi";
import type { LlmToolWorkflowPayload } from "@/features/consultation/api/llmToolWorkflowApi";

export interface SimulationSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
  matchedWorkflow: LlmToolWorkflowPayload | null;
  slotValues: Record<string, unknown> | null;
  slots: Array<Record<string, unknown>>;
}

export interface SimulationSessionPage {
  content: ChatSession[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreateSimulationSessionPayload {
  customerName?: string;
  workflowDefinitionId?: number;
}

export interface SendSimulationMessagePayload {
  content: string;
}

type MaybeWrapped<T> = T | { data?: T };

function unwrapSessionPage(response: MaybeWrapped<SimulationSessionPage>): SimulationSessionPage {
  const data = selectApiData<SimulationSessionPage>(response);
  return {
    content: data?.content ?? [],
    page: data?.page ?? 0,
    size: data?.size ?? 20,
    totalElements: data?.totalElements ?? data?.content?.length ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
}

// OpenAPI 미생성 endpoint라 generated client 대신 customFetch wrapper를 둔다.
export const simulationApi = {
  listSessions: async (
    workspaceId: number,
    params: { page?: number; size?: number } = {},
  ): Promise<SimulationSessionPage> => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    const query = searchParams.toString();
    const response = await customFetch<MaybeWrapped<SimulationSessionPage>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
    return unwrapSessionPage(response);
  },

  createSession: async (
    workspaceId: number,
    payload: CreateSimulationSessionPayload,
  ): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 세션 생성 응답을 확인할 수 없습니다.",
    );
  },

  getSession: async (workspaceId: number, sessionId: number): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}`,
      { method: "GET" },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 세션 상세 응답을 확인할 수 없습니다.",
    );
  },

  sendMessage: async (
    workspaceId: number,
    sessionId: number,
    payload: SendSimulationMessagePayload,
  ): Promise<SimulationSessionDetail> => {
    const response = await customFetch<MaybeWrapped<SimulationSessionDetail>>(
      `/api/v1/workspaces/${workspaceId}/simulation/sessions/${sessionId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return requireApiData<SimulationSessionDetail>(
      response,
      "시뮬레이션 메시지 응답을 확인할 수 없습니다.",
    );
  },
};
