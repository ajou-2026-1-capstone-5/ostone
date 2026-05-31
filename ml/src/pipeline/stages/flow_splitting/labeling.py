from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from .constants import (
    ACTION_INFLECTION_SUFFIXES,
    ACTION_LABEL_HINTS,
    ACTION_OBJECT_AMBIGUOUS_TERMS,
    ACTION_OBJECT_SPLIT_PREFIX,
    ACTION_ONLY_FALLBACK_NOISE_TERMS,
    ACTION_SPLIT_PREFIX,
    ACTION_TERM_SUPPORT_ALIASES,
    AUTO_GENERIC_ACTION_TERMS,
    AUTO_MIN_SPECIFIC_OBJECT_LENGTH_FOR_GENERIC_ACTION,
    AUTO_REVIEW_ONLY_ACTION_TERMS,
    AUTO_SPLIT_LABEL_ACTION_OBJECT_VALIDITY,
    AUTO_SPLIT_LABEL_EVIDENCE_COVERAGE,
    AUTO_SPLIT_LABEL_OBJECT_ACTION_JOINT_COVERAGE,
    AUTO_SPLIT_LABEL_SPECIFICITY,
    AUTO_WEAK_OBJECT_TERMS,
    COMPOUND_SPLIT_SEPARATOR,
    FRAME_OBJECT_NOISE_TERMS,
    LABEL_RAW_REVIEW_NOISE_SUFFIXES,
    LABEL_REVIEW_NOISE_TERMS,
    MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE,
    MIN_GROUNDED_TERM_FREQUENCY_SCORE,
    REVIEW_LABEL_SCAFFOLD_TERMS,
    REVIEW_PLACEHOLDER_LABEL,
    SEQUENCE_SPLIT_PREFIX,
    TEXT_INFERRED_ACTION_BLOCKLIST,
    _LABEL_STOPWORDS,
    _LABEL_SUFFIXES,
    AUTO_LABEL_MIN_MEMBER_COUNT,
)
from .helpers import (
    _action_object_split_label,
    _action_split_label,
    _clamp,
    _dominant_sequence_share,
    _dominant_signal_share,
    _event_sequence_key,
    _float_value,
    _int_list,
    _is_mixed_residual_reason,
    _merged_workflow_signal,
    _sequence_split_label,
    _split_label as _split_label_display,
    _string_list,
    _workflow_label,
)

def _regenerated_split_label(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame_candidate = _action_object_label_candidate(member_ids, preprocessed_index)
    candidates: list[dict[str, Any]] = []
    frame_terms = _string_list(frame_candidate.get("terms"))
    term_terms = _split_label_terms(member_ids, preprocessed_index)
    if frame_terms:
        candidates.append(
            _score_split_label_candidate(
                name=str(frame_candidate.get("name") or ""),
                terms=frame_terms,
                member_ids=member_ids,
                preprocessed_index=preprocessed_index,
                source=str(frame_candidate.get("source") or "action_object_frame"),
                frame_candidate=frame_candidate,
            )
        )
    else:
        action_candidate = _action_only_label_candidate(member_ids, preprocessed_index)
        action_terms = _string_list(action_candidate.get("terms"))
        if action_terms and _should_use_action_only_label_candidate(term_terms):
            candidates.append(
                _score_split_label_candidate(
                    name=str(action_candidate.get("name") or ""),
                    terms=action_terms,
                    member_ids=member_ids,
                    preprocessed_index=preprocessed_index,
                    source=str(action_candidate.get("source") or "action_frame_action"),
                    frame_candidate=action_candidate,
                )
            )
    if term_terms and not frame_terms:
        term_action_candidate = _term_frequency_action_label_candidate(member_ids, preprocessed_index, term_terms)
        term_action_terms = _string_list(term_action_candidate.get("terms"))
        if term_action_terms:
            candidates.append(
                _score_split_label_candidate(
                    name=str(term_action_candidate.get("name") or ""),
                    terms=term_action_terms,
                    member_ids=member_ids,
                    preprocessed_index=preprocessed_index,
                    source=str(term_action_candidate.get("source") or "term_frequency_action"),
                    frame_candidate={},
                )
            )
    if term_terms:
        term_label_name, term_label_terms = _term_frequency_label_payload(term_terms)
        candidates.append(
            _score_split_label_candidate(
                name=term_label_name,
                terms=term_label_terms,
                member_ids=member_ids,
                preprocessed_index=preprocessed_index,
                source="term_frequency",
                frame_candidate={},
            )
        )
    candidates = _dedupe_split_label_candidates(candidates)
    if not candidates:
        return {"name": "", "score": 0.0, "evidenceCoverage": 0.0, "candidates": []}
    candidates.sort(key=lambda item: (-_float_value(item.get("score"), default=0.0), str(item.get("name") or "")))
    best = candidates[0]
    return {
        "name": best["name"],
        "score": best["score"],
        "evidenceCoverage": best["evidenceCoverage"],
        "memberEvidenceCoverage": best.get("memberEvidenceCoverage", best["evidenceCoverage"]),
        "objectCoverage": best.get("objectCoverage", 0.0),
        "actionCoverage": best.get("actionCoverage", 0.0),
        "objectActionJointCoverage": best.get("objectActionJointCoverage", 0.0),
        "actionObjectValidity": best["actionObjectValidity"],
        "specificity": best.get("specificity", 0.0),
        "actionObjectFrame": best.get("actionObjectFrame", {}),
        "candidates": [
            {key: value for key, value in candidate.items() if key not in {"terms", "actionObjectFrame"}}
            for candidate in candidates[:5]
        ],
    }

def _review_safe_generated_label(
    label: dict[str, Any],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> dict[str, Any]:
    if _is_grounded_generated_label(label, split_key):
        return label
    noise_reduced_name = _noise_reduced_review_label(label)
    has_structured_noise_reduced_label = _is_review_label_structurally_grounded(
        noise_reduced_name,
        member_ids,
        preprocessed_index,
    )
    if not has_structured_noise_reduced_label and not _is_clean_review_label_base(noise_reduced_name):
        noise_reduced_name = ""
    fallback_name = noise_reduced_name or _flow_grounded_review_label(member_ids, preprocessed_index, split_key)
    fallback_name = _action_augmented_review_label(fallback_name, split_key, member_ids, preprocessed_index)
    fallback_source = "noise_reduced_review_fallback" if noise_reduced_name else "weak_label_flow_fallback"
    fallback_score_cap = 0.55 if noise_reduced_name else 0.45
    original_score = _float_value(label.get("score"), default=0.0)
    fallback_score = min(original_score, fallback_score_cap) if original_score > 0.0 else 0.35
    review_metrics = _review_label_metrics(
        fallback_name,
        member_ids,
        preprocessed_index,
        base_action_object_validity=_float_value(label.get("actionObjectValidity"), default=0.35),
    )
    fallback_score = min(max(fallback_score, review_metrics["score"]), fallback_score_cap)
    return {
        **label,
        "name": fallback_name,
        "score": fallback_score,
        "evidenceCoverage": review_metrics["evidenceCoverage"],
        "memberEvidenceCoverage": review_metrics["memberEvidenceCoverage"],
        "objectCoverage": review_metrics["objectCoverage"],
        "actionCoverage": review_metrics["actionCoverage"],
        "objectActionJointCoverage": review_metrics["objectActionJointCoverage"],
        "actionObjectValidity": review_metrics["actionObjectValidity"],
        "specificity": review_metrics["specificity"],
        "candidates": [
            {
                "name": fallback_name,
                "score": fallback_score,
                "source": fallback_source,
                "evidenceCoverage": review_metrics["evidenceCoverage"],
                "memberEvidenceCoverage": review_metrics["memberEvidenceCoverage"],
                "objectCoverage": review_metrics["objectCoverage"],
                "actionCoverage": review_metrics["actionCoverage"],
                "objectActionJointCoverage": review_metrics["objectActionJointCoverage"],
                "actionObjectValidity": review_metrics["actionObjectValidity"],
                "specificity": review_metrics["specificity"],
            },
            *_dict_candidates(label.get("candidates")),
        ][:5],
    }

def _split_label_auto_acceptable(label: dict[str, Any]) -> bool:
    score = _float_value(label.get("score"), default=0.0)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    object_action_joint_coverage = _float_value(label.get("objectActionJointCoverage"), default=0.0)
    action_object_validity = _float_value(label.get("actionObjectValidity"), default=0.35)
    specificity = _float_value(label.get("specificity"), default=0.0)
    raw_terms = [
        term.casefold()
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", str(label.get("name") or "").casefold())
        if term.casefold() != "문의"
    ]
    terms = [_clean_label_component_term(term) for term in raw_terms]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    object_terms, action_terms = _label_object_action_terms(meaningful_terms)
    if score < 0.65:
        return False
    if _has_label_review_noise(meaningful_terms) or _has_auto_label_raw_noise(raw_terms):
        return False
    if not object_terms or not action_terms:
        return False
    if any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if _has_broad_generic_action_label(object_terms, action_terms):
        return False
    if not _has_strong_auto_object_term(object_terms):
        return False
    if evidence_coverage < AUTO_SPLIT_LABEL_EVIDENCE_COVERAGE:
        return False
    return (
        object_action_joint_coverage >= AUTO_SPLIT_LABEL_OBJECT_ACTION_JOINT_COVERAGE
        and action_object_validity >= AUTO_SPLIT_LABEL_ACTION_OBJECT_VALIDITY
        and specificity >= AUTO_SPLIT_LABEL_SPECIFICITY
    )

def _has_auto_label_raw_noise(raw_terms: list[str]) -> bool:
    for term in raw_terms:
        raw = term.strip().casefold()
        normalized = _clean_label_term(raw) or raw
        if raw in LABEL_REVIEW_NOISE_TERMS:
            return True
        if normalized in LABEL_REVIEW_NOISE_TERMS:
            return True
        if any(raw.endswith(suffix) for suffix in LABEL_RAW_REVIEW_NOISE_SUFFIXES):
            return True
    return False

def _has_broad_generic_action_label(object_terms: tuple[str, ...], action_terms: tuple[str, ...]) -> bool:
    if not action_terms or any(term not in AUTO_GENERIC_ACTION_TERMS for term in action_terms):
        return False
    return not any(
        len(term.replace("_", "")) >= AUTO_MIN_SPECIFIC_OBJECT_LENGTH_FOR_GENERIC_ACTION for term in object_terms
    )

def _has_strong_auto_object_term(object_terms: tuple[str, ...]) -> bool:
    return any(term not in AUTO_WEAK_OBJECT_TERMS for term in object_terms)

def _is_grounded_generated_label(label: dict[str, Any], split_key: str) -> bool:
    name = str(label.get("name") or "").strip()
    if not name:
        return False
    score = _float_value(label.get("score"), default=0.0)
    evidence_coverage = _float_value(label.get("evidenceCoverage"), default=0.0)
    action_object_validity = _float_value(label.get("actionObjectValidity"), default=0.35)
    source = _label_candidate_source(label)
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = [_clean_label_component_term(term) for term in raw_terms]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    if not meaningful_terms:
        return False
    if _has_label_review_noise(meaningful_terms) or _has_auto_label_raw_noise(raw_terms):
        return False
    if source == "term_frequency":
        has_action_term = any(_is_action_label_term(term) for term in meaningful_terms)
        action_terms = [term for term in meaningful_terms if _is_action_label_term(term)]
        has_only_ambiguous_action = (
            bool(action_terms)
            and len(meaningful_terms) == len(action_terms)
            and all(term in ACTION_OBJECT_AMBIGUOUS_TERMS for term in action_terms)
        )
        has_multi_term_grounding = (
            len(meaningful_terms) >= 2 and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE
        )
        if has_only_ambiguous_action:
            return False
        if has_action_term and evidence_coverage >= 0.20:
            return True
        return has_multi_term_grounding and score >= MIN_GROUNDED_TERM_FREQUENCY_SCORE
    if source == "action_object_frame":
        object_action_joint_coverage = _float_value(label.get("objectActionJointCoverage"), default=0.0)
        return (
            action_object_validity >= 0.60
            and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE
            and object_action_joint_coverage >= 0.35
        )
    if source == "action_frame_action":
        return action_object_validity >= 0.55 and evidence_coverage >= 0.50 and score >= 0.55
    return score >= MIN_GROUNDED_TERM_FREQUENCY_SCORE and evidence_coverage >= MIN_GROUNDED_LABEL_EVIDENCE_COVERAGE

def _has_label_review_noise(terms: list[str]) -> bool:
    return any(term in LABEL_REVIEW_NOISE_TERMS for term in terms)

def _noise_reduced_review_label(label: dict[str, Any]) -> str:
    raw_terms = [
        _clean_label_term(term)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", str(label.get("name") or "").casefold())
        if term.casefold() != "문의"
    ]
    terms = [term for term in raw_terms if term and _is_split_label_term(term)]
    if not terms:
        return ""
    core_terms = [term for term in terms if term not in LABEL_REVIEW_NOISE_TERMS]
    if not core_terms:
        return ""
    action_terms = [term for term in core_terms if _is_action_label_term(term)]
    if action_terms and len(core_terms) == 1:
        return f"{action_terms[0]} 문의"
    compacted = _compact_label_terms(core_terms)[:2]
    if not compacted:
        return ""
    return f"{' '.join(compacted)} 문의"

def _is_review_label_structurally_grounded(
    name: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> bool:
    if not name:
        return False
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = _label_terms_from_name(name)
    if not terms or _has_auto_label_raw_noise(raw_terms) or _has_label_review_noise(terms):
        return False
    object_terms, action_terms = _label_object_action_terms(terms)
    if action_terms and not object_terms:
        return not any(
            term in AUTO_REVIEW_ONLY_ACTION_TERMS or term in AUTO_GENERIC_ACTION_TERMS for term in action_terms
        )
    if not object_terms or not action_terms:
        return False
    if any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if _has_broad_generic_action_label(object_terms, action_terms):
        return False
    _object_coverage, _action_coverage, joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    return joint_coverage >= 0.45

def _is_clean_review_label_base(name: str) -> bool:
    if not name:
        return False
    raw_terms = [
        term.casefold() for term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()) if term.casefold() != "문의"
    ]
    terms = _label_terms_from_name(name)
    if not terms or _has_auto_label_raw_noise(raw_terms) or _has_label_review_noise(terms):
        return False
    object_terms, action_terms = _label_object_action_terms(terms)
    if action_terms and not object_terms:
        return not any(
            term in AUTO_REVIEW_ONLY_ACTION_TERMS or term in AUTO_GENERIC_ACTION_TERMS for term in action_terms
        )
    if action_terms and any(term in AUTO_REVIEW_ONLY_ACTION_TERMS for term in action_terms):
        return False
    if action_terms and _has_broad_generic_action_label(object_terms, action_terms):
        return False
    return bool(object_terms)

def _action_augmented_review_label(
    fallback_name: str,
    split_key: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    terms = _label_terms_from_name(fallback_name)
    object_terms, action_terms = _label_object_action_terms(terms)
    if not object_terms or action_terms:
        return fallback_name
    for action in _split_key_action_terms(split_key):
        if action in AUTO_REVIEW_ONLY_ACTION_TERMS:
            continue
        if action in object_terms:
            return fallback_name
        action_coverage = _component_coverage((action,), member_ids, preprocessed_index)
        if action_coverage < 0.30:
            continue
        object_label = " ".join(_compact_label_terms(list(object_terms))[:2])
        if object_label:
            return f"{object_label} {action} 문의"
    return fallback_name

def _split_key_action_terms(split_key: str) -> list[str]:
    actions: list[str] = []
    for part in split_key.split(COMPOUND_SPLIT_SEPARATOR):
        action = ""
        if part.startswith(ACTION_SPLIT_PREFIX):
            action = part.removeprefix(ACTION_SPLIT_PREFIX).strip()
        elif part.startswith(ACTION_OBJECT_SPLIT_PREFIX):
            raw = part.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
            if ">" in raw:
                _object_term, action = raw.split(">", 1)
                action = action.strip()
        action = _clean_label_component_term(action)
        if action and _is_action_label_term(action) and action not in actions:
            actions.append(action)
    return actions

def _review_label_metrics(
    name: str,
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    base_action_object_validity: float,
) -> dict[str, float]:
    terms = _label_terms_from_name(name)
    evidence_coverage = _split_label_evidence_coverage(terms, member_ids, preprocessed_index)
    object_coverage, action_coverage, object_action_joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    object_terms, action_terms = _label_object_action_terms(terms)
    if object_terms and action_terms:
        action_object_validity = max(0.55, min(base_action_object_validity, 0.85))
    elif object_terms or action_terms:
        action_object_validity = 0.35
    else:
        action_object_validity = 0.25
    specificity = _label_specificity(terms)
    readability = 1.0 if len(name) <= 28 else 0.6
    weak_penalty = _weak_label_penalty(name)
    score = round(
        max(
            0.0,
            (0.34 * evidence_coverage)
            + (0.20 * object_action_joint_coverage)
            + (0.17 * action_object_validity)
            + (0.12 * readability)
            + (0.17 * specificity)
            - (0.35 * weak_penalty),
        ),
        4,
    )
    return {
        "score": score,
        "evidenceCoverage": evidence_coverage,
        "memberEvidenceCoverage": evidence_coverage,
        "objectCoverage": object_coverage,
        "actionCoverage": action_coverage,
        "objectActionJointCoverage": object_action_joint_coverage,
        "actionObjectValidity": action_object_validity,
        "specificity": specificity,
    }

def _label_terms_from_name(name: str) -> list[str]:
    output: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", name.casefold()):
        if raw_term.casefold() in REVIEW_LABEL_SCAFFOLD_TERMS:
            continue
        term = _clean_label_component_term(raw_term)
        if not term or term in REVIEW_LABEL_SCAFFOLD_TERMS:
            continue
        if _is_label_component_term(term):
            output.append(term)
    return _compact_label_terms(output)

def _label_candidate_source(label: dict[str, Any]) -> str:
    candidates = label.get("candidates")
    if isinstance(candidates, list):
        for candidate in candidates:
            if isinstance(candidate, dict):
                source = candidate.get("source")
                if isinstance(source, str) and source:
                    return source
    return ""

def _dict_candidates(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]

def _flow_grounded_review_label(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_key: str,
) -> str:
    action_part = _first_split_part(split_key, ACTION_SPLIT_PREFIX)
    if action_part:
        return f"{_action_split_label(action_part)} 문의"
    action_object_part = _first_split_part(split_key, ACTION_OBJECT_SPLIT_PREFIX)
    if action_object_part:
        return _action_object_split_intent_label(action_object_part)
    if split_key.startswith(SEQUENCE_SPLIT_PREFIX):
        return _review_label_from_sequence_key(split_key)
    dominant_sequence_key = _dominant_event_sequence_key(member_ids, preprocessed_index)
    if dominant_sequence_key:
        return _review_label_from_sequence_key(dominant_sequence_key)
    return REVIEW_PLACEHOLDER_LABEL

def _first_split_part(split_key: str, prefix: str) -> str:
    for part in split_key.split(COMPOUND_SPLIT_SEPARATOR):
        if part.startswith(prefix):
            return part
    return ""

def _dominant_event_sequence_key(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        key = _event_sequence_key(preprocessed_index.get(conv_id), max_events=2)
        if key != f"{SEQUENCE_SPLIT_PREFIX}unknown":
            counts[key] += 1
    if not counts:
        return ""
    return counts.most_common(1)[0][0]

def _review_label_from_sequence_key(sequence_key: str) -> str:
    del sequence_key
    return REVIEW_PLACEHOLDER_LABEL

def _action_object_split_intent_label(split_key: str) -> str:
    raw = split_key.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
    if ">" not in raw:
        return REVIEW_PLACEHOLDER_LABEL
    object_term, action = raw.split(">", 1)
    object_term = _clean_label_component_term(object_term.strip())
    action = _clean_label_component_term(action.strip())
    if object_term and action:
        return f"{object_term} {action} 문의"
    if action:
        return f"{action} 문의"
    if object_term:
        return f"{object_term} 문의"
    return REVIEW_PLACEHOLDER_LABEL

def _resolve_duplicate_generated_labels(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> None:
    clusters_by_label: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cluster in clusters:
        label = _workflow_label(cluster)
        if label:
            clusters_by_label[label].append(cluster)
    existing_labels = set(clusters_by_label)
    for label, duplicate_clusters in clusters_by_label.items():
        if len(duplicate_clusters) <= 1:
            continue
        ranked = sorted(
            duplicate_clusters,
            key=lambda cluster: (
                -_float_value(cluster.get("label_score"), default=0.0),
                -_float_value(cluster.get("label_evidence_coverage"), default=0.0),
                -len(_string_list(cluster.get("member_conv_ids"))),
                str(cluster.get("workflow_entrypoint_id") or ""),
            ),
        )
        for duplicate in ranked[1:]:
            if not _should_fallback_duplicate_label(duplicate):
                duplicate["label_validation_status"] = "needs_review"
                continue
            member_ids = _string_list(duplicate.get("member_conv_ids"))
            split_key = str(duplicate.get("flow_split_key") or "single_flow")
            fallback_name = _flow_grounded_review_label(member_ids, preprocessed_index, split_key)
            if fallback_name == label or fallback_name in existing_labels:
                fallback_name = _unique_duplicate_fallback_name(fallback_name, existing_labels)
            existing_labels.add(fallback_name)
            original_score = _float_value(duplicate.get("label_score"), default=0.0)
            duplicate["suggested_name"] = fallback_name
            duplicate["label_source"] = "duplicate_weak_label_flow_fallback"
            duplicate["label_score"] = min(original_score, 0.45) if original_score > 0.0 else 0.35
            duplicate["label_validation_status"] = "needs_review"
            duplicate["label_candidates"] = [
                {
                    "name": fallback_name,
                    "score": duplicate["label_score"],
                    "source": "duplicate_weak_label_flow_fallback",
                    "evidenceCoverage": _float_value(duplicate.get("label_evidence_coverage"), default=0.0),
                    "memberEvidenceCoverage": _float_value(
                        duplicate.get("label_member_evidence_coverage"),
                        default=0.0,
                    ),
                    "objectCoverage": _float_value(duplicate.get("label_object_coverage"), default=0.0),
                    "actionCoverage": _float_value(duplicate.get("label_action_coverage"), default=0.0),
                    "objectActionJointCoverage": _float_value(
                        duplicate.get("label_object_action_joint_coverage"),
                        default=0.0,
                    ),
                    "actionObjectValidity": _float_value(
                        duplicate.get("label_action_object_validity"),
                        default=0.35,
                    ),
                },
                *_dict_candidates(duplicate.get("label_candidates")),
            ][:5]

def _enforce_review_only_labels(clusters: list[dict[str, Any]]) -> None:
    for cluster in clusters:
        if cluster.get("is_novel_outlier_candidate") is True:
            cluster["label_validation_status"] = "needs_review"

def _should_fallback_duplicate_label(cluster: dict[str, Any]) -> bool:
    if _has_evidence_backed_duplicate_label(cluster):
        return False
    score = _float_value(cluster.get("label_score"), default=0.0)
    action_object_validity = _float_value(cluster.get("label_action_object_validity"), default=0.35)
    split_key = str(cluster.get("flow_split_key") or "")
    return score < 0.70 or action_object_validity < 0.55 or _is_mixed_residual_reason(split_key)

def _has_evidence_backed_duplicate_label(cluster: dict[str, Any]) -> bool:
    score = _float_value(cluster.get("label_score"), default=0.0)
    member_coverage = _float_value(cluster.get("label_member_evidence_coverage"), default=0.0)
    joint_coverage = _float_value(cluster.get("label_object_action_joint_coverage"), default=0.0)
    action_object_validity = _float_value(cluster.get("label_action_object_validity"), default=0.35)
    terms = _workflow_label_terms(cluster)
    object_terms, action_terms = _label_object_action_terms(terms)
    has_component_grounding = bool(object_terms and action_terms) and member_coverage >= 0.50 and joint_coverage >= 0.50
    return (
        score >= 0.50
        and member_coverage >= 0.30
        and joint_coverage >= 0.35
        and (action_object_validity >= 0.55 or has_component_grounding)
        and not _has_label_review_noise(terms)
    )

def _workflow_label_terms(cluster: dict[str, Any]) -> list[str]:
    return [
        term
        for term in (
            _clean_label_term(raw_term)
            for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", _workflow_label(cluster).casefold())
            if raw_term.casefold() != "문의"
        )
        if term and _is_split_label_term(term)
    ]

def _unique_duplicate_fallback_name(base_name: str, existing_labels: set[str]) -> str:
    normalized_base = base_name.removesuffix(" 문의").strip() if base_name.endswith(" 문의") else base_name.strip()
    if normalized_base.endswith(" 검토"):
        normalized_base = normalized_base.removesuffix(" 검토").strip()
    base_label = f"{normalized_base} 문의" if normalized_base else REVIEW_PLACEHOLDER_LABEL
    if base_label not in existing_labels:
        return base_label
    index = 2
    while True:
        candidate = f"{base_label} {index}"
        if candidate not in existing_labels:
            return candidate
        index += 1

def _score_split_label_candidate(
    *,
    name: str,
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    source: str,
    frame_candidate: dict[str, Any],
) -> dict[str, Any]:
    evidence_coverage = _candidate_evidence_coverage(frame_candidate, terms, member_ids, preprocessed_index)
    object_coverage, action_coverage, object_action_joint_coverage = _label_component_coverages(
        terms,
        member_ids,
        preprocessed_index,
    )
    readability = 1.0 if len(name) <= 28 else 0.6
    action_object_validity = _action_object_label_validity(frame_candidate)
    specificity = _label_specificity(terms)
    weak_penalty = _weak_label_penalty(name)
    score = round(
        max(
            0.0,
            (0.28 * evidence_coverage)
            + (0.24 * object_action_joint_coverage)
            + (0.22 * action_object_validity)
            + (0.11 * readability)
            + (0.15 * specificity)
            - (0.35 * weak_penalty),
        ),
        4,
    )
    if object_action_joint_coverage < 0.25:
        score = round(score * 0.82, 4)
    return {
        "name": name,
        "score": score,
        "evidenceCoverage": evidence_coverage,
        "memberEvidenceCoverage": evidence_coverage,
        "objectCoverage": object_coverage,
        "actionCoverage": action_coverage,
        "objectActionJointCoverage": object_action_joint_coverage,
        "actionObjectValidity": action_object_validity,
        "terms": terms,
        "actionObjectFrame": frame_candidate.get("frame", {}),
        "source": source,
        "specificity": specificity,
    }

def _candidate_evidence_coverage(
    frame_candidate: dict[str, Any],
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    override = frame_candidate.get("evidenceCoverage")
    if isinstance(override, (int, float)) and not isinstance(override, bool):
        return _clamp(float(override))
    return _split_label_evidence_coverage(terms, member_ids, preprocessed_index)

def _label_component_coverages(
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[float, float, float]:
    object_terms, action_terms = _label_object_action_terms(terms)
    return (
        _component_coverage(object_terms, member_ids, preprocessed_index),
        _component_coverage(action_terms, member_ids, preprocessed_index),
        _object_action_joint_coverage(object_terms, action_terms, member_ids, preprocessed_index),
    )

def _label_object_action_terms(terms: list[str]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    cleaned_terms = tuple(term for term in terms if _is_split_label_term(term) or _is_action_label_term(term))
    action_terms = tuple(term for term in cleaned_terms if _is_action_label_term(term))
    object_terms = tuple(term for term in cleaned_terms if term not in action_terms)
    if not object_terms and len(action_terms) == 1 and action_terms[0] in ACTION_OBJECT_AMBIGUOUS_TERMS:
        return action_terms, ()
    if not object_terms and len(action_terms) >= 2:
        return action_terms[:-1], action_terms[-1:]
    return object_terms, action_terms

def _component_coverage(
    terms: tuple[str, ...],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not terms or not member_ids:
        return 0.0
    scores: list[float] = []
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        scores.append(1.0 if any(_term_supported_by_text(text, term) for term in terms) else 0.0)
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)

def _object_action_joint_coverage(
    object_terms: tuple[str, ...],
    action_terms: tuple[str, ...],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not action_terms or not member_ids:
        return 0.0
    if not object_terms:
        return _component_coverage(action_terms, member_ids, preprocessed_index)
    scores: list[float] = []
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        object_supported = any(_term_supported_by_text(text, term) for term in object_terms)
        action_supported = any(_term_supported_by_text(text, term) for term in action_terms)
        scores.append(1.0 if object_supported and action_supported else 0.0)
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 4)

def _dedupe_split_label_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in candidates:
        name = str(candidate.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        candidate["name"] = name
        output.append(candidate)
    return output

def _term_supported_by_text(text: str, term: str) -> bool:
    normalized_term = term.casefold()
    if normalized_term in text:
        return True
    aliases = ACTION_TERM_SUPPORT_ALIASES.get(normalized_term)
    if aliases and any(alias in text for alias in aliases):
        return True
    if normalized_term == "정보확인":
        return "정보" in text or "확인" in text
    if normalized_term == "가능여부":
        return "가능" in text or "여부" in text
    return False

def _action_object_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame = _dominant_action_object_frame(member_ids, preprocessed_index)
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    object_terms = object_term.split()
    terms = [*object_terms, *([action] if action and action not in object_terms else [])]
    if len(terms) < 2:
        return {}
    if action in object_term:
        name = f"{object_term} 문의"
        terms = [object_term]
    else:
        name = f"{object_term} {action} 문의"
    return {"name": name, "terms": terms, "frame": frame, "source": "action_object_frame"}

def _action_only_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    frame = _dominant_action_frame(member_ids, preprocessed_index)
    action = _frame_value(frame, "action")
    if not action or action == "확인":
        return {}
    support_ratio = _float_value(frame.get("memberSupportRatio"), default=0.0)
    if support_ratio < 0.50:
        return {}
    return {
        "name": f"{action} 문의",
        "terms": [action],
        "frame": frame,
        "source": "action_frame_action",
        "evidenceCoverage": support_ratio,
    }

def _should_use_action_only_label_candidate(term_terms: list[str]) -> bool:
    if not term_terms:
        return True
    for term in term_terms:
        if _is_action_label_term(term):
            continue
        if term in ACTION_ONLY_FALLBACK_NOISE_TERMS:
            continue
        return False
    return True

def _term_frequency_action_label_candidate(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    term_terms: list[str],
) -> dict[str, Any]:
    object_terms, action_terms = _label_object_action_terms(term_terms)
    if not object_terms or action_terms:
        return {}
    if all(term in ACTION_OBJECT_AMBIGUOUS_TERMS or _is_action_label_term(term) for term in object_terms):
        return {}
    action = _dominant_text_action(member_ids, preprocessed_index)
    if not action:
        return {}
    object_label_terms = list(object_terms[:2])
    if action in object_label_terms:
        return {}
    return {
        "name": f"{' '.join(object_label_terms)} {action} 문의",
        "terms": [*object_label_terms, action],
        "source": "term_frequency_action",
    }

def _term_frequency_label_payload(term_terms: list[str]) -> tuple[str, list[str]]:
    object_terms, action_terms = _label_object_action_terms(term_terms)
    ordered_terms: list[str] = []
    if object_terms and action_terms:
        ordered_terms = [*list(object_terms[:2]), action_terms[0]]
    elif object_terms:
        ordered_terms = list(object_terms[:2])
    elif action_terms:
        ordered_terms = list(action_terms[:2])
    if not ordered_terms:
        ordered_terms = term_terms[:2]
    ordered_terms = _compact_label_terms(ordered_terms)
    return f"{' '.join(ordered_terms)} 문의", ordered_terms

def _dominant_text_action(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> str:
    if not member_ids:
        return ""
    candidates = list(dict.fromkeys([*ACTION_LABEL_HINTS, *ACTION_TERM_SUPPORT_ALIASES]))
    scored: list[tuple[float, float, str]] = []
    for action in candidates:
        if (
            not action
            or action == "확인"
            or action in AUTO_REVIEW_ONLY_ACTION_TERMS
            or action in TEXT_INFERRED_ACTION_BLOCKLIST
        ):
            continue
        coverage = _component_coverage((action,), member_ids, preprocessed_index)
        if coverage < 0.45:
            continue
        generic_penalty = 0.10 if action in AUTO_GENERIC_ACTION_TERMS else 0.0
        specificity_bonus = min(len(action.replace("_", "")) / 20, 0.08)
        scored.append((coverage - generic_penalty + specificity_bonus, coverage, action))
    if not scored:
        return ""
    scored.sort(reverse=True)
    return scored[0][2]

def _dominant_action_object_frame(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    counts: Counter[tuple[str, str]] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        frame = row.get("action_object_frame")
        if not isinstance(frame, dict):
            continue
        if _frame_confidence(frame) < 0.65:
            continue
        object_term = _frame_object_value(frame)
        action = _frame_value(frame, "action")
        if not object_term or not action or not _is_split_label_term(object_term) or not _is_action_label_term(action):
            continue
        key = (object_term, action)
        counts[key] += 1
        grouped.setdefault(key, dict(frame))
    if not counts:
        return {}
    key, support = counts.most_common(1)[0]
    frame = grouped[key]
    frame["memberSupport"] = support
    frame["memberSupportRatio"] = round(support / len(member_ids), 4) if member_ids else 0.0
    return frame

def _dominant_action_frame(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    grouped: dict[str, dict[str, Any]] = {}
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        frame = row.get("action_object_frame")
        if not isinstance(frame, dict):
            continue
        if _frame_confidence(frame) < 0.65:
            continue
        action = _frame_value(frame, "action")
        if not action or not _is_action_label_term(action):
            continue
        counts[action] += 1
        grouped.setdefault(action, dict(frame))
    if not counts:
        return {}
    action, support = counts.most_common(1)[0]
    frame = grouped[action]
    frame["object"] = ""
    frame["action"] = action
    frame["memberSupport"] = support
    frame["memberSupportRatio"] = round(support / len(member_ids), 4) if member_ids else 0.0
    return frame

def _frame_value(frame: dict[str, Any], key: str) -> str:
    value = frame.get(key)
    return str(value).strip().casefold() if isinstance(value, str) else ""

def _frame_object_value(frame: dict[str, Any]) -> str:
    value = _frame_value(frame, "object")
    terms: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", value):
        term = _clean_label_term(raw_term)
        if term in FRAME_OBJECT_NOISE_TERMS:
            continue
        if not _is_split_label_term(term):
            continue
        if term not in terms:
            terms.append(term)
    return " ".join(_compact_label_terms(terms)[:4])

def _frame_confidence(frame: dict[str, Any]) -> float:
    value = frame.get("confidence")
    return _clamp(float(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0

def _action_object_label_validity(frame_candidate: dict[str, Any]) -> float:
    frame = frame_candidate.get("frame")
    if not isinstance(frame, dict):
        return 0.35
    object_term = _frame_object_value(frame)
    action = _frame_value(frame, "action")
    support_ratio = _float_value(frame.get("memberSupportRatio"), default=0.0)
    if object_term and action:
        return _clamp(0.70 + (0.30 * support_ratio))
    if object_term or action:
        return 0.55
    return 0.25

def _split_label_terms(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[str]:
    counter: Counter[str] = Counter()
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", text.casefold()):
            term = _clean_label_term(term)
            if not _is_split_label_term(term):
                continue
            counter[term] += 1
    return _compact_label_terms([term for term, _count in counter.most_common(4)])[:2]

def _clean_label_term(term: str) -> str:
    cleaned = term.strip().casefold()
    normalized_query_term = _normalize_query_value_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in _LABEL_STOPWORDS:
        return ""
    for _ in range(3):
        before = cleaned
        for suffix in _LABEL_SUFFIXES:
            if not cleaned.endswith(suffix):
                continue
            root = cleaned[: -len(suffix)]
            min_root_length = 1 if len(suffix) > 1 else 2
            if len(root) >= min_root_length:
                cleaned = root
                break
        if cleaned == before:
            break
    cleaned = _normalize_action_inflected_term(cleaned)
    normalized_query_term = _normalize_query_value_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in _LABEL_STOPWORDS:
        return ""
    return cleaned

def _clean_label_component_term(term: str) -> str:
    cleaned = _clean_label_term(term)
    if cleaned:
        return cleaned
    raw = term.strip().casefold()
    return raw if _is_action_label_term(raw) else ""

def _normalize_query_value_term(term: str) -> str:
    if term.startswith("얼마"):
        return "금액"
    if term.startswith("얼만"):
        return "금액"
    if term.startswith("돈"):
        return "금액"
    if term.startswith("값"):
        return "금액"
    if term.startswith("인출"):
        return "출금"
    if term.startswith("출금"):
        return "출금"
    if term.startswith("초과"):
        return "초과"
    return ""

def _normalize_action_inflected_term(term: str) -> str:
    for action in ACTION_LABEL_HINTS:
        if term == action:
            return term
        if not term.startswith(action):
            continue
        remainder = term[len(action) :]
        if not remainder:
            return term
        if any(remainder.startswith(suffix) for suffix in ACTION_INFLECTION_SUFFIXES):
            return action
    return term

def _compact_label_terms(terms: list[str]) -> list[str]:
    compacted: list[str] = []
    for term in terms:
        if not _is_split_label_term(term):
            continue
        if any(term == existing for existing in compacted):
            continue
        if any(term in existing and len(existing) > len(term) for existing in compacted):
            continue
        compacted = [existing for existing in compacted if not (existing in term and len(term) > len(existing))]
        compacted.append(term)
    return compacted

def _is_split_label_term(term: str) -> bool:
    if not term or len(term.replace("_", "")) <= 1:
        return False
    if term in _LABEL_STOPWORDS:
        return False
    if any(char.isdigit() for char in term):
        return False
    if re.fullmatch(r"[a-z]{1,3}", term):
        return False
    if re.fullmatch(r"[a-z_]+", term) and term in _LABEL_STOPWORDS:
        return False
    return True

def _label_specificity(terms: list[str]) -> float:
    unique_terms = [term for term in dict.fromkeys(terms) if _is_label_component_term(term)]
    if not unique_terms:
        return 0.0
    if len(unique_terms) == 1:
        return 0.35
    if len(unique_terms) == 2:
        return 0.82
    return 1.0

def _is_action_label_term(term: str) -> bool:
    if not term:
        return False
    return any(hint in term for hint in ACTION_LABEL_HINTS)

def _is_label_component_term(term: str) -> bool:
    return _is_split_label_term(term) or _is_action_label_term(term)

def _split_label_evidence_coverage(
    terms: list[str],
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not terms or not member_ids:
        return 0.0
    member_scores: list[float] = []
    normalized_terms = [term.casefold() for term in terms if term]
    for conv_id in member_ids:
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        text = _label_source_text(conversation).casefold()
        if not text:
            member_scores.append(0.0)
            continue
        hits = sum(1 for term in normalized_terms if _term_supported_by_text(text, term))
        member_scores.append(hits / len(normalized_terms) if normalized_terms else 0.0)
    if not member_scores:
        return 0.0
    return round(sum(member_scores) / len(member_scores), 4)

def _label_source_text(conversation: dict[str, Any]) -> str:
    customer_text = str(conversation.get("customer_problem_text") or "").strip()
    if customer_text:
        return customer_text
    return str(conversation.get("canonical_text") or "").strip()

def _weak_label_penalty(label: str) -> float:
    terms = [
        _clean_label_component_term(term)
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", label.casefold())
        if term.casefold() != "문의"
    ]
    meaningful_terms = [term for term in terms if term and _is_label_component_term(term)]
    weak_count = len(terms) - len(meaningful_terms)
    if not terms:
        return 0.25
    if len(meaningful_terms) == 0:
        return 0.30
    if len(meaningful_terms) == 1:
        return 0.10 + (0.10 * weak_count / len(terms))
    return min(0.20, 0.12 * weak_count / len(terms))
