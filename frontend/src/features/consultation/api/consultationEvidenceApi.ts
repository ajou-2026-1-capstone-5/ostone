import { domainPackSectionPath } from "@/shared/lib/domainPackRoutes";
import { customFetch } from "@/shared/api/mutator";
import { requireApiData } from "@/shared/api";

export interface MessageEvidenceRouteContext {
  workspaceId: number;
  packId: number | null;
  versionId: number | null;
}

export interface MessageDomainPackElements {
  slots: Array<{
    name: string;
    extracted: boolean;
    value?: string;
    detailPath?: string;
  }>;
  policies: Array<{
    name: string;
    extracted: boolean;
    matched: boolean;
    detailPath?: string;
  }>;
  risks: Array<{
    name: string;
    extracted: boolean;
    level: "low" | "medium" | "high";
    detailPath?: string;
  }>;
}

interface RawMessageDomainPackElementsResponse {
  data?: RawMessageDomainPackElements;
}

interface RawMessageDomainPackElements {
  slots?: RawSlotElement[];
  policies?: RawPolicyElement[];
  risks?: RawRiskElement[];
}

interface RawSlotElement {
  id?: number | null;
  code?: string | null;
  name?: string | null;
  extracted?: boolean;
  value?: string | null;
}

interface RawPolicyElement {
  id?: number | null;
  code?: string | null;
  name?: string | null;
  extracted?: boolean;
  matched?: boolean;
}

interface RawRiskElement {
  id?: number | null;
  code?: string | null;
  name?: string | null;
  extracted?: boolean;
  level?: string | null;
}

function buildDetailPath(
  routeContext: MessageEvidenceRouteContext | null,
  section: "slots" | "policies" | "risks",
  id?: number | null,
) {
  if (
    !routeContext?.workspaceId ||
    !routeContext.packId ||
    !routeContext.versionId
  ) {
    return undefined;
  }
  return domainPackSectionPath(
    routeContext.workspaceId,
    routeContext.packId,
    routeContext.versionId,
    section,
    id ?? undefined,
  );
}

function normalizeRiskLevel(level?: string | null): "low" | "medium" | "high" {
  if (level?.toLowerCase() === "high" || level?.toLowerCase() === "critical")
    return "high";
  if (level?.toLowerCase() === "medium") return "medium";
  return "low";
}

function elementName(name?: string | null, code?: string | null) {
  return name?.trim() || code?.trim() || "이름 없음";
}

function normalizeMessageDomainPackElements(
  response: RawMessageDomainPackElements,
  routeContext: MessageEvidenceRouteContext | null,
): MessageDomainPackElements {
  return {
    slots: (response.slots ?? []).map((slot) => ({
      name: elementName(slot.name, slot.code),
      extracted: slot.extracted ?? false,
      ...(slot.value ? { value: slot.value } : {}),
      detailPath: buildDetailPath(routeContext, "slots", slot.id),
    })),
    policies: (response.policies ?? []).map((policy) => ({
      name: elementName(policy.name, policy.code),
      extracted: policy.extracted ?? true,
      matched: policy.matched ?? false,
      detailPath: buildDetailPath(routeContext, "policies", policy.id),
    })),
    risks: (response.risks ?? []).map((risk) => ({
      name: elementName(risk.name, risk.code),
      extracted: risk.extracted ?? true,
      level: normalizeRiskLevel(risk.level),
      detailPath: buildDetailPath(routeContext, "risks", risk.id),
    })),
  };
}

export const consultationEvidenceApi = {
  getMessageDomainPackElements: async (
    sessionId: number,
    messageId: number,
    routeContext: MessageEvidenceRouteContext | null = null,
  ): Promise<MessageDomainPackElements> => {
    // OpenAPI generated endpoints do not include this operator-only evidence endpoint yet.
    const response = await customFetch<
      RawMessageDomainPackElements | RawMessageDomainPackElementsResponse
    >(
      `/api/v1/consultation/sessions/${sessionId}/messages/${messageId}/domain-pack-elements`,
      {
        method: "GET",
      },
    );
    return normalizeMessageDomainPackElements(
      requireApiData<RawMessageDomainPackElements>(
        response,
        "메시지 도메인팩 근거 응답을 확인할 수 없습니다.",
      ),
      routeContext,
    );
  },
};
