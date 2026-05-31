from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

EvidenceText = tuple[str, str, str]


@dataclass(frozen=True)
class SlotCandidateTemplate:
    key: str
    name: str
    description: str
    data_type: str
    is_sensitive: bool
    patterns: tuple[str, ...]
    domains: tuple[str, ...] = ("generic",)
    required_signal: str | None = None


@dataclass(frozen=True)
class PolicyCandidateTemplate:
    key: str
    name: str
    description: str
    severity: str
    action_type: str
    patterns: tuple[str, ...]
    domains: tuple[str, ...] = ("generic",)
    required_signal: str | None = None
    claim_type: str = "POLICY_RULE"


@dataclass(frozen=True)
class RiskCandidateTemplate:
    key: str
    name: str
    description: str
    risk_level: str
    patterns: tuple[str, ...]
    domains: tuple[str, ...] = ("generic",)
    required_signal: str | None = None
    claim_type: str = "RISK_TRIGGER"


_GENERIC_DOMAINS = ("generic",)

_SLOT_TEMPLATES: tuple[SlotCandidateTemplate, ...] = (
    SlotCandidateTemplate(
        "auth_information",
        "본인 인증 정보",
        "명의자 또는 이용자 본인 여부를 확인하기 위한 인증 정보",
        "STRING",
        True,
        ("본인", "인증", "명의", "소지", "생년월일"),
        required_signal="requires_user_identification",
    ),
    SlotCandidateTemplate(
        "case_reference",
        "업무 식별 번호",
        "요청을 식별하기 위한 주문, 예약, 접수, 계약, 회원, 케이스 번호",
        "STRING",
        False,
        (
            "예약 번호",
            "예약번호",
            "주문번호",
            "주문 번호",
            "접수번호",
            "접수 번호",
            "계약번호",
            "계약 번호",
            "회원번호",
            "회원 번호",
            "케이스 번호",
        ),
    ),
    SlotCandidateTemplate(
        "date_or_period",
        "일자/기간",
        "요청 처리에 필요한 일자, 기간, 시작일, 종료일",
        "DATE_RANGE",
        False,
        ("날짜", "일정", "기간", "일부터", "일까지", "시작일", "종료일", "오늘", "내일"),
    ),
    SlotCandidateTemplate(
        "amount_or_quantity",
        "금액/수량",
        "요금, 금액, 비용, 수량 등 처리 기준이 되는 값",
        "STRING",
        False,
        ("금액", "요금", "비용", "수수료", "대금", "원이", "원만", "몇 개", "수량", "인원"),
    ),
    SlotCandidateTemplate(
        "payment_method",
        "결제/납부 수단",
        "결제, 납부, 입금, 이체에 사용하는 수단",
        "STRING",
        True,
        ("결제", "납부", "입금", "이체", "카드", "계좌", "자동이체", "현금"),
        required_signal="requires_payment_check",
    ),
    SlotCandidateTemplate(
        "contact_channel",
        "연락/회신 정보",
        "후속 안내나 확인에 필요한 연락 수단",
        "STRING",
        False,
        ("연락", "전화", "문자", "이메일", "메일", "주소", "회신", "보내주세요"),
    ),
    SlotCandidateTemplate(
        "target_item",
        "대상 항목",
        "고객이 확인, 변경, 취소, 처리하려는 상품, 서비스, 항목",
        "STRING",
        False,
        ("상품", "서비스", "항목", "건", "내역", "신청", "사용", "이용"),
    ),
    SlotCandidateTemplate(
        "change_or_cancel_reason",
        "변경/취소 사유",
        "변경, 취소, 해지, 환불 요청의 사유",
        "STRING",
        False,
        ("사유", "이유", "문제", "오류", "취소", "변경", "해지", "환불"),
    ),
)

_POLICY_TEMPLATES: tuple[PolicyCandidateTemplate, ...] = (
    PolicyCandidateTemplate(
        "identity_verification",
        "본인확인 후 처리",
        "명의자 또는 권한 있는 이용자 여부가 확인된 뒤에만 업무를 처리한다.",
        "MEDIUM",
        "verify_identity",
        ("본인", "인증", "명의", "소지", "생년월일"),
        required_signal="requires_user_identification",
    ),
    PolicyCandidateTemplate(
        "payment_or_billing_check",
        "결제/청구 정보 확인",
        "결제, 청구, 납부, 출금 관련 업무는 대상 금액과 수단을 확인한 뒤 처리한다.",
        "MEDIUM",
        "verify_payment_context",
        ("결제", "청구", "납부", "출금", "대금", "금액", "자동이체", "계좌", "입금", "이체"),
        required_signal="requires_payment_check",
    ),
    PolicyCandidateTemplate(
        "change_cancel_rule",
        "변경/취소 기준 확인",
        "변경, 취소, 해지, 환불 요청은 적용 기준과 가능 여부를 확인한 뒤 안내한다.",
        "HIGH",
        "check_change_cancel_policy",
        ("취소", "환불", "변경", "해지", "정지", "수수료", "규정", "가능 여부"),
    ),
    PolicyCandidateTemplate(
        "request_context_check",
        "요청 조건 확인",
        "처리 전 대상 항목, 요청 조건, 고객이 원하는 결과를 확인한다.",
        "MEDIUM",
        "check_request_context",
        ("요청", "신청", "접수", "진행", "처리", "확인", "문의"),
    ),
    PolicyCandidateTemplate(
        "consent_before_state_change",
        "상태 변경 전 동의 확인",
        "고객의 이용 상태나 계약 상태가 바뀌는 처리는 명시적 동의 후 진행한다.",
        "HIGH",
        "confirm_state_change_consent",
        ("변경", "해지", "취소", "정지", "신청", "접수", "동의"),
    ),
    PolicyCandidateTemplate(
        "manual_review_for_unclear_case",
        "불명확한 요청 검토",
        "요청 내용이나 근거가 불명확하면 관측된 상담 증거를 바탕으로 사람이 검토한다.",
        "HIGH",
        "require_human_review",
        ("모르", "불명확", "확인 필요", "다시", "담당자", "상담원", "이관"),
    ),
)

_RISK_TEMPLATES: tuple[RiskCandidateTemplate, ...] = (
    RiskCandidateTemplate(
        "privacy_exposure",
        "개인정보 노출 위험",
        "본인인증, 연락처, 식별 정보 처리 과정에서 개인정보가 노출될 수 있다.",
        "HIGH",
        ("본인", "인증", "명의", "전화번호", "생년월일", "주소", "이메일", "계좌", "번호"),
    ),
    RiskCandidateTemplate(
        "financial_loss",
        "금전 손실/오청구 위험",
        "결제, 청구, 환불, 출금, 금액 처리 오류가 금전 손실로 이어질 수 있다.",
        "HIGH",
        ("결제", "청구", "환불", "출금", "금액", "대금", "수수료", "입금", "이체"),
    ),
    RiskCandidateTemplate(
        "service_interruption",
        "서비스 중단/오처리 위험",
        "변경, 취소, 해지, 정지 처리가 잘못되면 고객 이용 상태에 영향을 줄 수 있다.",
        "MEDIUM",
        ("정지", "해지", "취소", "변경", "중단", "오류", "처리"),
    ),
    RiskCandidateTemplate(
        "unsupported_generalization",
        "근거 부족 일반화 위험",
        "소수 사례의 처리 흐름을 일반 업무 기준으로 확정하면 오안내가 발생할 수 있다.",
        "MEDIUM",
        ("추정", "확실", "모르", "아마", "확인 필요", "담당자", "다시"),
    ),
)

_FALLBACK_POLICY_TEMPLATE = PolicyCandidateTemplate(
    "workflow_handling_review",
    "처리 기준 검토",
    "관측된 상담 사례와 키워드를 근거로 업무 처리 기준을 사람이 검토한다.",
    "LOW",
    "review_observed_handling",
    (),
    claim_type="OBSERVED_ACTION",
)

_FALLBACK_RISK_TEMPLATE = RiskCandidateTemplate(
    "handling_error",
    "처리 오류/오안내 위험",
    "관측된 처리 흐름을 잘못 일반화하면 고객에게 잘못된 안내나 처리 오류가 발생할 수 있다.",
    "LOW",
    (),
)

MAX_SLOTS_PER_INTENT = 4
MAX_POLICIES_PER_INTENT = 2
MAX_RISKS_PER_INTENT = 2


def build_evidence_based_slot_draft(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int | float]]:
    slot_groups: dict[tuple[str, str], dict[str, Any]] = {}
    bindings: list[dict[str, Any]] = []
    cluster_with_slot_count = 0
    raw_slot_match_count = 0

    for cluster in clusters:
        cluster_id = _cluster_id(cluster)
        if cluster_id is None:
            continue
        selected = _select_templates(cluster, preprocessed_index, _SLOT_TEMPLATES, max_items=MAX_SLOTS_PER_INTENT)
        if selected:
            cluster_with_slot_count += 1
        raw_slot_match_count += len(selected)
        for order, match in enumerate(selected, start=1):
            template = match["template"]
            if not isinstance(template, SlotCandidateTemplate):
                continue
            group = _merge_entity_group(slot_groups, "SLOT", cluster, template, match, order)
            bindings.append(
                {
                    "intentCode": f"INTENT_{cluster_id}",
                    "slotCode": group["code"],
                    "isRequired": _slot_required(template, cluster),
                    "collectionOrder": order,
                    "promptHint": template.description,
                    "conditionJson": _compact_json(
                        {
                            "matchedTerms": match["terms"][:5],
                            "matchScore": match["score"],
                            "reviewGroupKey": group["reviewGroupKey"],
                            "reviewRank": order,
                        }
                    ),
                }
            )

    slots = [_slot_from_group(group) for group in _ranked_groups(slot_groups.values())]
    slot_with_evidence_count = sum(1 for slot in slots if slot["evidenceJson"] != "[]")
    cluster_count = sum(1 for cluster in clusters if _cluster_id(cluster) is not None)
    metrics: dict[str, int | float] = {
        "slot_count": len(slots),
        "raw_slot_match_count": raw_slot_match_count,
        "slot_binding_count": len(bindings),
        "cluster_with_slot_count": cluster_with_slot_count,
        "slot_with_evidence_count": slot_with_evidence_count,
        "slot_evidence_coverage": _coverage(slot_with_evidence_count, len(slots)),
        "slot_deduplication_rate": _deduplication_rate(raw_slot_match_count, len(slots)),
        "avg_slots_per_intent": _average_count(raw_slot_match_count, cluster_count),
    }
    return slots, bindings, metrics


def build_policy_risk_draft(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[int, str], dict[str, int | float]]:
    policy_groups: dict[tuple[str, str], dict[str, Any]] = {}
    risk_groups: dict[tuple[str, str], dict[str, Any]] = {}
    policy_refs_by_cluster: dict[int, str] = {}
    cluster_with_policy_count = 0
    cluster_with_risk_count = 0
    raw_policy_match_count = 0
    raw_risk_match_count = 0

    for cluster in clusters:
        cluster_id = _cluster_id(cluster)
        if cluster_id is None:
            continue
        policy_matches = _select_templates(
            cluster,
            preprocessed_index,
            _POLICY_TEMPLATES,
            max_items=MAX_POLICIES_PER_INTENT,
        )
        risk_matches = _select_templates(
            cluster,
            preprocessed_index,
            _RISK_TEMPLATES,
            max_items=MAX_RISKS_PER_INTENT,
        )
        evidence_base = _conversation_texts(cluster, preprocessed_index)
        if not policy_matches and evidence_base:
            policy_matches = [_fallback_match(cluster, evidence_base, _FALLBACK_POLICY_TEMPLATE)]
        if not risk_matches and evidence_base:
            risk_matches = [_fallback_match(cluster, evidence_base, _FALLBACK_RISK_TEMPLATE)]

        if policy_matches:
            cluster_with_policy_count += 1
        if risk_matches:
            cluster_with_risk_count += 1
        raw_policy_match_count += len(policy_matches)
        raw_risk_match_count += len(risk_matches)

        for order, match in enumerate(policy_matches, start=1):
            template = match["template"]
            if not isinstance(template, PolicyCandidateTemplate):
                continue
            group = _merge_entity_group(policy_groups, "POLICY", cluster, template, match, order)
            policy_refs_by_cluster.setdefault(cluster_id, str(group["code"]))

        for order, match in enumerate(risk_matches, start=1):
            template = match["template"]
            if not isinstance(template, RiskCandidateTemplate):
                continue
            _merge_entity_group(risk_groups, "RISK", cluster, template, match, order)

    policies = [_policy_from_group(group) for group in _ranked_groups(policy_groups.values())]
    risks = [_risk_from_group(group) for group in _ranked_groups(risk_groups.values())]
    cluster_count = sum(1 for cluster in clusters if _cluster_id(cluster) is not None)
    metrics: dict[str, int | float] = {
        "policy_count": len(policies),
        "risk_count": len(risks),
        "raw_policy_match_count": raw_policy_match_count,
        "raw_risk_match_count": raw_risk_match_count,
        "cluster_with_policy_count": cluster_with_policy_count,
        "cluster_with_risk_count": cluster_with_risk_count,
        "policy_coverage": _coverage(cluster_with_policy_count, cluster_count),
        "risk_coverage": _coverage(cluster_with_risk_count, cluster_count),
        "policy_deduplication_rate": _deduplication_rate(raw_policy_match_count, len(policies)),
        "risk_deduplication_rate": _deduplication_rate(raw_risk_match_count, len(risks)),
        "avg_policies_per_intent": _average_count(raw_policy_match_count, cluster_count),
        "avg_risks_per_intent": _average_count(raw_risk_match_count, cluster_count),
    }
    return policies, risks, policy_refs_by_cluster, metrics


def _merge_entity_group(
    groups: dict[tuple[str, str], dict[str, Any]],
    prefix: str,
    cluster: dict[str, Any],
    template: SlotCandidateTemplate | PolicyCandidateTemplate | RiskCandidateTemplate,
    match: dict[str, Any],
    review_rank: int,
) -> dict[str, Any]:
    scope = _dedupe_scope(cluster, template.domains)
    key = (scope, template.key)
    group = groups.get(key)
    if group is None:
        group = {
            "code": _entity_code(prefix, scope, template.key),
            "prefix": prefix,
            "template": template,
            "scope": scope,
            "reviewGroupKey": f"{prefix.lower()}:{scope}:{template.key}",
            "matchScore": 0,
            "terms": [],
            "conversationIds": [],
            "supportSnippets": [],
            "evidenceBaseCount": 0,
            "intentCodes": [],
            "sourceClusterIds": [],
            "workflowEntryPointIds": [],
            "bestReviewRank": review_rank,
            "mergeCount": 0,
        }
        groups[key] = group
    group["matchScore"] = int(group["matchScore"]) + int(match["score"])
    group["evidenceBaseCount"] = max(int(group["evidenceBaseCount"]), int(match.get("evidenceBaseCount", 0)))
    group["bestReviewRank"] = min(int(group["bestReviewRank"]), review_rank)
    group["mergeCount"] = int(group["mergeCount"]) + 1
    _extend_unique(group["terms"], match["terms"])
    _extend_unique(group["conversationIds"], match["conversationIds"])
    _extend_support(group["supportSnippets"], match.get("supportSnippets"))
    _append_unique(group["intentCodes"], f"INTENT_{cluster['cluster_id']}")
    _append_unique(group["sourceClusterIds"], str(cluster.get("source_cluster_id") or cluster["cluster_id"]))
    workflow_entrypoint_id = cluster.get("workflow_entrypoint_id")
    if isinstance(workflow_entrypoint_id, str) and workflow_entrypoint_id:
        _append_unique(group["workflowEntryPointIds"], workflow_entrypoint_id)
    return group


def _slot_from_group(group: dict[str, Any]) -> dict[str, Any]:
    template = group["template"]
    if not isinstance(template, SlotCandidateTemplate):
        raise TypeError("slot group template must be SlotCandidateTemplate")
    return {
        "slotCode": group["code"],
        "name": template.name,
        "description": template.description,
        "dataType": template.data_type,
        "isSensitive": template.is_sensitive,
        "validationRuleJson": _compact_json(
            {
                "source": "evidence_pattern",
                "patterns": group["terms"][:10],
                "reviewGroupKey": group["reviewGroupKey"],
            }
        ),
        "defaultValueJson": None,
        "evidenceJson": _group_evidence_json(group),
        "metaJson": _compact_json(_group_meta(group, template.key)),
        "reviewStatus": "needs_review",
    }


def _policy_from_group(group: dict[str, Any]) -> dict[str, Any]:
    template = group["template"]
    if not isinstance(template, PolicyCandidateTemplate):
        raise TypeError("policy group template must be PolicyCandidateTemplate")
    support_count = _claim_support_count(group)
    contradiction_count = 0
    return {
        "policyCode": group["code"],
        "name": template.name,
        "description": template.description,
        "severity": template.severity,
        "conditionJson": _compact_json(
            {
                "primaryIntentCode": group["intentCodes"][0] if group["intentCodes"] else None,
                "intentCodes": group["intentCodes"],
                "matchedTerms": group["terms"][:8],
                "rootDomain": group["scope"],
                "reviewGroupKey": group["reviewGroupKey"],
                "claimType": template.claim_type,
                "supportCount": support_count,
                "contradictionCount": contradiction_count,
                "claimExtractionMethod": "evidence_claim_pattern.v1",
            }
        ),
        "actionJson": _compact_json({"type": template.action_type, "requiresHumanReview": True}),
        "evidenceJson": _group_evidence_json(group),
        "metaJson": _compact_json(
            {
                **_group_meta(group, template.key),
                "claimType": template.claim_type,
                "claimExtractionMethod": "evidence_claim_pattern.v1",
                "supportCount": support_count,
                "contradictionCount": contradiction_count,
            }
        ),
        "reviewStatus": "needs_review",
    }


def _risk_from_group(group: dict[str, Any]) -> dict[str, Any]:
    template = group["template"]
    if not isinstance(template, RiskCandidateTemplate):
        raise TypeError("risk group template must be RiskCandidateTemplate")
    support_count = _claim_support_count(group)
    contradiction_count = 0
    return {
        "riskCode": group["code"],
        "name": template.name,
        "description": template.description,
        "riskLevel": template.risk_level,
        "conditionJson": _compact_json(
            {
                "primaryIntentCode": group["intentCodes"][0] if group["intentCodes"] else None,
                "intentCodes": group["intentCodes"],
                "matchedTerms": group["terms"][:8],
                "rootDomain": group["scope"],
                "reviewGroupKey": group["reviewGroupKey"],
                "claimType": template.claim_type,
                "supportCount": support_count,
                "contradictionCount": contradiction_count,
                "claimExtractionMethod": "evidence_claim_pattern.v1",
            }
        ),
        "mitigationJson": _compact_json(
            {
                "claimType": template.claim_type,
                "requiresEvidenceCheck": True,
                "requiresHumanReview": True,
            }
        ),
        "evidenceJson": _group_evidence_json(group),
        "metaJson": _compact_json(
            {
                **_group_meta(group, template.key),
                "claimType": template.claim_type,
                "claimExtractionMethod": "evidence_claim_pattern.v1",
                "supportCount": support_count,
                "contradictionCount": contradiction_count,
            }
        ),
        "reviewStatus": "needs_review",
    }


def _ranked_groups(groups: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    group_list = list(groups)
    group_list.sort(
        key=lambda group: (
            int(group["bestReviewRank"]),
            -int(group["matchScore"]),
            str(group["reviewGroupKey"]),
        )
    )
    for rank, group in enumerate(group_list, start=1):
        group["reviewRank"] = rank
    return group_list


def _dedupe_scope(
    cluster: dict[str, Any],
    template_domains: tuple[str, ...],
) -> str:
    del cluster, template_domains
    return "generic"


def _entity_code(prefix: str, scope: str, template_key: str) -> str:
    return f"{prefix}_{_code_part(scope)}_{_code_part(template_key)}"[:100]


def _code_part(value: str) -> str:
    output = [char.upper() if char.isalnum() else "_" for char in value]
    return "".join(output).strip("_") or "GENERIC"


def _group_meta(group: dict[str, Any], template_key: str) -> dict[str, Any]:
    evidence_count = len(group["conversationIds"])
    match_score = int(group["matchScore"])
    evidence_base_count = int(group.get("evidenceBaseCount", 0))
    distinct_term_count = len(group["terms"])
    support_ratio = min(1.0, _coverage(evidence_count, evidence_base_count))
    return {
        "extractionMethod": "evidence_pattern.v2_compacted",
        "templateKey": template_key,
        "reviewGroupKey": group["reviewGroupKey"],
        "reviewRank": group.get("reviewRank", group["bestReviewRank"]),
        "rootDomain": group["scope"],
        "appliesToIntentCodes": group["intentCodes"],
        "sourceClusterIds": group["sourceClusterIds"],
        "workflowEntryPointIds": group["workflowEntryPointIds"],
        "evidenceConversationCount": evidence_count,
        "supportSnippetCount": len(group["supportSnippets"]),
        "supportRatio": support_ratio,
        "distinctMatchedTermCount": distinct_term_count,
        "supportLevel": _support_level(evidence_count, distinct_term_count, support_ratio),
        "matchScore": match_score,
        "deduplicatedFromCount": group["mergeCount"],
        "confidenceScore": _confidence_score(match_score, evidence_count, distinct_term_count, support_ratio),
    }


def _claim_support_count(group: dict[str, Any]) -> int:
    return len(group.get("conversationIds", [])) if isinstance(group.get("conversationIds"), list) else 0


def _confidence_score(
    match_score: int,
    evidence_count: int,
    distinct_term_count: int = 0,
    support_ratio: float = 0.0,
) -> float:
    score = (match_score / 12.0 + evidence_count / 10.0 + distinct_term_count / 5.0 + support_ratio) / 4.0
    return min(1.0, round(score, 4))


def _support_level(evidence_count: int, distinct_term_count: int, support_ratio: float) -> str:
    if evidence_count >= 5 and distinct_term_count >= 2 and support_ratio >= 0.20:
        return "strong"
    if evidence_count >= 2 and distinct_term_count >= 1:
        return "moderate"
    return "weak_review_required"


def _group_evidence_json(group: dict[str, Any]) -> str:
    return _evidence_json(
        {
            "terms": group["terms"],
            "conversationIds": group["conversationIds"],
            "supportSnippets": group["supportSnippets"],
        }
    )


def _extend_unique(target: list[Any], values: object) -> None:
    if not isinstance(values, list):
        return
    for value in values:
        _append_unique(target, str(value))


def _append_unique(target: list[Any], value: str) -> None:
    if value and value not in target:
        target.append(value)


def _extend_support(target: list[Any], values: object, limit: int = 12) -> None:
    if not isinstance(values, list):
        return
    seen = {(item.get("conversationId"), item.get("snippet")) for item in target if isinstance(item, dict)}
    for value in values:
        if not isinstance(value, dict):
            continue
        conversation_id = str(value.get("conversationId") or "")
        snippet = str(value.get("snippet") or "")
        if not conversation_id or not snippet:
            continue
        key = (conversation_id, snippet)
        if key in seen:
            continue
        seen.add(key)
        target.append(
            {
                "conversationId": conversation_id,
                "sourceScope": str(value.get("sourceScope") or "mixed"),
                "matchedTerms": _string_list(value.get("matchedTerms"))[:5],
                "snippet": snippet[:240],
            }
        )
        if len(target) >= limit:
            break


def _select_templates(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    templates: tuple[SlotCandidateTemplate | PolicyCandidateTemplate | RiskCandidateTemplate, ...],
    max_items: int = 6,
) -> list[dict[str, Any]]:
    domain = str(cluster.get("root_domain") or "")
    raw_signal = cluster.get("workflow_signal")
    signal: dict[str, Any] = raw_signal if isinstance(raw_signal, dict) else {}
    matches: list[dict[str, Any]] = []
    for template in templates:
        if not _domain_allowed(domain, template.domains):
            continue
        if template.required_signal is not None and signal.get(template.required_signal) is not True:
            continue
        evidence_base = _conversation_texts_for_template(cluster, preprocessed_index, template)
        match = _match_template(template, evidence_base)
        if match is not None:
            matches.append(match)
    matches.sort(key=lambda item: (-int(item["score"]), str(item["name"])))
    return matches[:max_items]


def _match_template(
    template: SlotCandidateTemplate | PolicyCandidateTemplate | RiskCandidateTemplate,
    evidence_base: list[EvidenceText],
) -> dict[str, Any] | None:
    matched_terms: list[str] = []
    matched_conv_ids: list[str] = []
    support_snippets: list[dict[str, object]] = []
    score = 0
    for conv_id, text, source_scope in evidence_base:
        text_lower = text.casefold()
        conv_matched = False
        conv_terms: list[str] = []
        first_match_index: int | None = None
        for pattern in template.patterns:
            normalized = pattern.casefold()
            count = text_lower.count(normalized)
            if count <= 0:
                continue
            score += count
            conv_matched = True
            conv_terms.append(pattern)
            candidate_index = text_lower.find(normalized)
            if candidate_index >= 0 and (first_match_index is None or candidate_index < first_match_index):
                first_match_index = candidate_index
            if pattern not in matched_terms:
                matched_terms.append(pattern)
        if conv_matched and conv_id not in matched_conv_ids:
            matched_conv_ids.append(conv_id)
            support_snippets.append(
                {
                    "conversationId": conv_id,
                    "sourceScope": source_scope,
                    "matchedTerms": conv_terms[:5],
                    "snippet": _support_snippet(text, first_match_index),
                }
            )

    if not _template_match_is_strong_enough(template, score, matched_terms, matched_conv_ids, len(evidence_base)):
        return None
    return {
        "template": template,
        "name": template.name,
        "score": score,
        "terms": matched_terms[:10],
        "conversationIds": matched_conv_ids[:10],
        "supportSnippets": support_snippets[:8],
        "evidenceBaseCount": len(evidence_base),
    }


def _fallback_match(
    cluster: dict[str, Any],
    evidence_base: list[EvidenceText],
    template: PolicyCandidateTemplate | RiskCandidateTemplate,
) -> dict[str, Any]:
    keywords = _string_list(cluster.get("keywords"))[:5]
    return {
        "template": template,
        "name": template.name,
        "score": 1,
        "terms": keywords,
        "conversationIds": [conv_id for conv_id, _text, _source_scope in evidence_base[:5]],
        "supportSnippets": [
            {
                "conversationId": conv_id,
                "sourceScope": source_scope,
                "matchedTerms": keywords[:3],
                "snippet": _support_snippet(text, 0),
            }
            for conv_id, text, source_scope in evidence_base[:3]
        ],
        "evidenceBaseCount": len(evidence_base),
    }


def _conversation_texts(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    limit: int = 80,
) -> list[EvidenceText]:
    ordered_ids = _string_list(cluster.get("exemplar_conv_ids")) + _string_list(cluster.get("member_conv_ids"))
    seen: set[str] = set()
    output: list[EvidenceText] = []
    for conv_id in ordered_ids:
        if conv_id in seen:
            continue
        seen.add(conv_id)
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _conversation_text(conversation)
        if not text:
            continue
        output.append((conv_id, text, "mixed"))
        if len(output) >= limit:
            break
    return output


def _conversation_texts_for_template(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    template: SlotCandidateTemplate | PolicyCandidateTemplate | RiskCandidateTemplate,
) -> list[EvidenceText]:
    if isinstance(template, PolicyCandidateTemplate):
        agent_texts = _conversation_agent_texts(cluster, preprocessed_index)
        if agent_texts:
            return agent_texts
    return _conversation_texts(cluster, preprocessed_index)


def _conversation_agent_texts(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    limit: int = 80,
) -> list[EvidenceText]:
    ordered_ids = _string_list(cluster.get("exemplar_conv_ids")) + _string_list(cluster.get("member_conv_ids"))
    seen: set[str] = set()
    output: list[EvidenceText] = []
    for conv_id in ordered_ids:
        if conv_id in seen:
            continue
        seen.add(conv_id)
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _conversation_agent_text(conversation)
        if not text:
            continue
        output.append((conv_id, text, "agent"))
        if len(output) >= limit:
            break
    return output


def _conversation_text(conversation: dict[str, Any]) -> str:
    parts = [
        str(conversation.get("customer_problem_text") or ""),
        str(conversation.get("canonical_text") or ""),
    ]
    return " ".join(part for part in parts if part).strip()


def _conversation_agent_text(conversation: dict[str, Any]) -> str:
    parts = [
        str(conversation.get("agent_resolution_text") or ""),
        str(conversation.get("agent_action_text") or ""),
    ]
    return " ".join(part for part in parts if part).strip()


def _minimum_score(evidence_count: int) -> int:
    if evidence_count <= 3:
        return 1
    if evidence_count <= 20:
        return 2
    return 3


def _template_match_is_strong_enough(
    template: SlotCandidateTemplate | PolicyCandidateTemplate | RiskCandidateTemplate,
    score: int,
    matched_terms: list[str],
    matched_conv_ids: list[str],
    evidence_count: int,
) -> bool:
    if score < _minimum_score(evidence_count):
        return False
    if isinstance(template, SlotCandidateTemplate):
        return True

    distinct_terms = len(matched_terms)
    supported_conversations = len(matched_conv_ids)
    if template.key in {"request_context_check", "manual_review_for_unclear_case", "unsupported_generalization"}:
        return distinct_terms >= 2 and supported_conversations >= _minimum_policy_support(evidence_count)
    if isinstance(template, RiskCandidateTemplate):
        return distinct_terms >= 1 and supported_conversations >= 1
    return distinct_terms >= 1 and supported_conversations >= 1


def _minimum_policy_support(evidence_count: int) -> int:
    if evidence_count <= 5:
        return 1
    if evidence_count <= 20:
        return 2
    return 3


def _support_snippet(text: str, match_index: int | None, window: int = 80) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        return ""
    if match_index is None:
        return cleaned[: window * 2]
    start = max(0, match_index - window)
    end = min(len(cleaned), match_index + window)
    return cleaned[start:end].strip()


def _domain_allowed(root_domain: str, template_domains: tuple[str, ...]) -> bool:
    del root_domain
    return bool(set(template_domains).intersection(_GENERIC_DOMAINS))


def _slot_required(template: SlotCandidateTemplate, cluster: dict[str, Any]) -> bool:
    raw_signal = cluster.get("workflow_signal")
    signal: dict[str, Any] = raw_signal if isinstance(raw_signal, dict) else {}
    if template.required_signal is not None:
        return signal.get(template.required_signal) is True
    return template.key not in {"contact_channel", "target_item", "change_or_cancel_reason"}


def _entity_meta(cluster: dict[str, Any], template_key: str, match: dict[str, Any]) -> dict[str, Any]:
    return {
        "extractionMethod": "evidence_pattern.v1",
        "templateKey": template_key,
        "rootDomain": cluster.get("root_domain"),
        "sourceClusterId": cluster.get("source_cluster_id"),
        "workflowEntryPointId": cluster.get("workflow_entrypoint_id"),
        "evidenceConversationCount": len(match["conversationIds"]),
        "matchScore": match["score"],
    }


def _evidence_json(match: dict[str, Any]) -> str:
    items: list[dict[str, str]] = []
    for term in match["terms"][:5]:
        items.append({"type": "keyword", "value": str(term)})
    for conv_id in match["conversationIds"][:3]:
        items.append({"type": "exemplar_conv_id", "value": str(conv_id)})
    for conv_id in match["conversationIds"][3:8]:
        items.append({"type": "member_conv_id", "value": str(conv_id)})
    for support in match.get("supportSnippets", [])[:5]:
        if not isinstance(support, dict):
            continue
        items.append(
            {
                "type": "evidence_span",
                "conversationId": str(support.get("conversationId") or ""),
                "sourceScope": str(support.get("sourceScope") or "mixed"),
                "matchedTerms": ",".join(_string_list(support.get("matchedTerms"))[:5]),
                "value": str(support.get("snippet") or ""),
            }
        )
    return json.dumps(items, ensure_ascii=False)


def _cluster_id(cluster: dict[str, Any]) -> int | None:
    value = cluster.get("cluster_id")
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, str) and item]


def _compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _coverage(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 1.0
    return numerator / denominator


def _average_count(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _deduplication_rate(raw_count: int, compacted_count: int) -> float:
    if raw_count <= 0:
        return 0.0
    return max(0.0, 1.0 - (compacted_count / raw_count))


__all__ = [
    "build_evidence_based_slot_draft",
    "build_policy_risk_draft",
]
