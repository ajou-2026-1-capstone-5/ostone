from __future__ import annotations

from .thresholds import (
    AUTO_DUPLICATE_LABEL_RATE_THRESHOLD,
    AUTO_REVIEW_REQUIRED_RATE_THRESHOLD,
    AUTO_WORKFLOW_CONFIDENCE_AVG_THRESHOLD,
    AUTO_WORKFLOW_CONFIDENCE_MIN_THRESHOLD,
)


def _apply_tiered_label_gate(
    *,
    metric_value: float | None,
    auto_metric_value: float | None,
    auto_count: float | None,
    review_threshold: float,
    block_threshold: float,
    block_reason: str,
    review_reason: str,
    review_only_block_reason: str,
    auto_block_reason: str,
    block_reasons: list[str],
    quality_review_reasons: list[str],
) -> None:
    if metric_value is None:
        return
    if _has_auto_label_subset(auto_count):
        if auto_metric_value is None:
            if metric_value < block_threshold:
                _append_unique(block_reasons, block_reason)
            elif metric_value < review_threshold:
                _append_unique(quality_review_reasons, review_reason)
            return
        if auto_metric_value < block_threshold:
            _append_unique(block_reasons, auto_block_reason)
            return
        if metric_value < block_threshold:
            _append_unique(quality_review_reasons, review_only_block_reason)
            return
    if metric_value < block_threshold:
        _append_unique(block_reasons, block_reason)
    elif metric_value < review_threshold:
        _append_unique(quality_review_reasons, review_reason)


def _has_auto_label_subset(auto_count: float | None) -> bool:
    return auto_count is not None and auto_count > 0.0


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _release_tier(
    *,
    block_reasons: list[str],
    cluster_stability: float | None,
    label_fidelity: float | None,
    workflow_path_support: float | None,
    quality_review_reasons: list[str],
    review_required_rate: float | None,
    duplicate_label_rate: float | None,
    workflow_confidence_avg: float | None,
    workflow_confidence_min: float | None,
) -> str:
    if block_reasons:
        return "REJECTED"
    if quality_review_reasons:
        return "REVIEW_REQUIRED"
    auto_ready = (
        _value_at_least(cluster_stability, 0.75)
        and _value_at_least(label_fidelity, 0.75)
        and _value_at_least(workflow_path_support, 0.75)
        and _value_at_most(review_required_rate, AUTO_REVIEW_REQUIRED_RATE_THRESHOLD)
        and _value_at_most(duplicate_label_rate, AUTO_DUPLICATE_LABEL_RATE_THRESHOLD)
        and _value_at_least(workflow_confidence_avg, AUTO_WORKFLOW_CONFIDENCE_AVG_THRESHOLD)
        and _value_at_least(workflow_confidence_min, AUTO_WORKFLOW_CONFIDENCE_MIN_THRESHOLD)
    )
    return "AUTO_CANDIDATE" if auto_ready else "REVIEW_REQUIRED"


def _value_at_least(value: float | None, threshold: float) -> bool:
    return value is not None and value >= threshold


def _value_at_most(value: float | None, threshold: float) -> bool:
    return value is not None and value <= threshold
