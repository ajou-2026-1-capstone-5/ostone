from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, TypedDict

from pipeline.stages.ingestion.main import _parse_consulting_content, _turns_from_payload

DEFAULT_SPLITS = ("training", "validation")
FORBIDDEN_KEY = "consulting_category"


class ParsedDatasetItem(TypedDict):
    company: str
    row: dict[str, object]
    turns: int
    turnMismatch: int


def main() -> int:
    args = _parse_args()
    input_root = args.input_root.resolve()
    output_root = args.output_root.resolve()
    if not input_root.exists():
        print(f"Input root does not exist: {input_root}", file=sys.stderr)
        return 2

    if output_root.exists() and args.clean:
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    summary = {
        split: _convert_split(
            input_root=input_root,
            output_root=output_root,
            split=split,
            input_subdir=args.input_subdir,
        )
        for split in args.split
    }
    summary_path = output_root / "build_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(summary_path)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if all(item["failedCount"] == 0 for item in summary.values()) else 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build category-free parsed consultation dataset files with source_id and turns[]."
    )
    parser.add_argument(
        "input_root",
        type=Path,
        help="Root containing split/source JSON files, e.g. dataset or /path/to/data/raw.",
    )
    parser.add_argument(
        "output_root",
        type=Path,
        help="Output root for parsed split/company JSON files, e.g. dataset.",
    )
    parser.add_argument(
        "--split",
        action="append",
        choices=DEFAULT_SPLITS,
        default=[],
        help="Split to convert. Can be repeated. Defaults to training and validation.",
    )
    parser.add_argument("--input-subdir", default="source", help="Input subdirectory inside each split.")
    parser.add_argument("--clean", action="store_true", help="Remove output_root before conversion.")
    args = parser.parse_args()
    if not args.split:
        args.split = list(DEFAULT_SPLITS)
    return args


def _convert_split(
    *,
    input_root: Path,
    output_root: Path,
    split: str,
    input_subdir: str,
) -> dict[str, object]:
    input_dir = input_root / split / input_subdir
    output_split_dir = output_root / split
    output_split_dir.mkdir(parents=True, exist_ok=True)

    failed: list[dict[str, str]] = []
    output_file_count = 0
    row_count = 0
    turn_count = 0
    turn_mismatch_count = 0
    turn_mismatch_samples: list[dict[str, object]] = []
    company_counts: dict[str, int] = defaultdict(int)
    company_summaries: dict[str, dict[str, int]] = {}
    input_files = sorted(input_dir.glob("*.json"), key=_natural_path_key)

    for input_path in input_files:
        try:
            parsed_items, stats = _convert_file(input_path)
            for parsed_item in parsed_items:
                company = parsed_item["company"]
                company_counts[company] += 1
                output_path = output_split_dir / company / f"{company_counts[company]:03d}.json"
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(
                    json.dumps([parsed_item["row"]], ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                output_file_count += 1
                company_summary = company_summaries.setdefault(
                    company,
                    {"outputFiles": 0, "rows": 0, "turns": 0, "turnMismatchCount": 0},
                )
                company_summary["outputFiles"] += 1
                company_summary["rows"] += 1
                company_summary["turns"] += int(parsed_item["turns"])
                company_summary["turnMismatchCount"] += int(parsed_item["turnMismatch"])
            row_count += stats["rows"]
            turn_count += stats["turns"]
            turn_mismatch_count += stats["turnMismatchCount"]
            turn_mismatch_samples.extend(stats["turnMismatchSamples"])
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            failed.append({"file": str(input_path), "error": str(exc)})

    return {
        "inputFiles": len(input_files),
        "outputFiles": output_file_count,
        "rows": row_count,
        "turns": turn_count,
        "companies": dict(sorted(company_summaries.items())),
        "failedCount": len(failed),
        "failedSamples": failed[:10],
        "turnMismatchCount": turn_mismatch_count,
        "turnMismatchSamples": turn_mismatch_samples[:10],
    }


def _convert_file(input_path: Path) -> tuple[list[ParsedDatasetItem], dict[str, Any]]:
    payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
    rows = payload if isinstance(payload, list) else [payload]
    parsed_items: list[ParsedDatasetItem] = []
    row_count = 0
    turn_count = 0
    turn_mismatch_count = 0
    turn_mismatch_samples: list[dict[str, object]] = []

    for row_index, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        forbidden_path = _find_forbidden_key(row)
        if forbidden_path is not None:
            row = _remove_forbidden_keys(row)
        if not isinstance(row, dict):
            continue
        company = _company(row, input_path)
        source_id = _source_id(row, input_path, row_index, len(rows))
        turns = _parsed_turns(row)
        if not turns:
            continue
        turn_mismatch = _has_turn_mismatch(row, turns)
        parsed_items.append(
            {
                "company": company,
                "row": {"source_id": source_id, "turns": turns},
                "turns": len(turns),
                "turnMismatch": int(turn_mismatch),
            }
        )
        row_count += 1
        turn_count += len(turns)
        if turn_mismatch:
            turn_mismatch_count += 1
            if len(turn_mismatch_samples) < 10:
                turn_mismatch_samples.append(_turn_mismatch_sample(input_path, source_id, row, turns))

    if not parsed_items:
        raise ValueError(f"file did not contain parseable consultation content: {input_path}")
    stats = {
        "rows": row_count,
        "turns": turn_count,
        "turnMismatchCount": turn_mismatch_count,
        "turnMismatchSamples": turn_mismatch_samples,
    }
    return parsed_items, stats


def _parsed_turns(row: dict[str, object]) -> list[dict[str, object]]:
    turns_payload = row.get("turns")
    if isinstance(turns_payload, list):
        turns = _turns_from_payload(turns_payload)
        if turns:
            return turns
    content = str(row.get("consulting_content") or "")
    return _parse_consulting_content(content)


def _company(row: dict[str, object], input_path: Path) -> str:
    source = row.get("source")
    if source is not None and str(source).strip():
        return _safe_company_name(str(source).strip())
    stem = input_path.stem
    if "_" in stem:
        return _safe_company_name(stem.split("_", 1)[0])
    parent = input_path.parent.name
    if parent and parent != "source":
        return _safe_company_name(parent)
    return "unknown"


def _safe_company_name(value: str) -> str:
    safe = re.sub(r"[\\/:\0]", "_", value.strip())
    return safe or "unknown"


def _source_id(row: dict[str, object], input_path: Path, row_index: int, row_count: int) -> str:
    value = row.get("source_id") or row.get("id") or row.get("consultation_id") or row.get("case_id")
    if value is not None and str(value).strip():
        return str(value).strip()
    if row_count == 1:
        return input_path.stem
    return f"{input_path.stem}_{row_index}"


def _has_turn_mismatch(row: dict[str, object], turns: list[dict[str, object]]) -> bool:
    try:
        declared_turns = int(str(row.get("consulting_turns") or "").strip())
    except ValueError:
        return False
    return abs(declared_turns - len(turns)) > max(2, declared_turns * 0.2)


def _turn_mismatch_sample(
    input_path: Path,
    source_id: str,
    row: dict[str, object],
    turns: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "file": str(input_path),
        "source_id": source_id,
        "declaredTurns": int(str(row.get("consulting_turns") or "").strip()),
        "parsedTurns": len(turns),
    }


def _find_forbidden_key(value: object, path: str = "$") -> str | None:
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if key_text == FORBIDDEN_KEY:
                return child_path
            nested_path = _find_forbidden_key(child, child_path)
            if nested_path is not None:
                return nested_path
    if isinstance(value, list):
        for index, child in enumerate(value):
            nested_path = _find_forbidden_key(child, f"{path}[{index}]")
            if nested_path is not None:
                return nested_path
    return None


def _remove_forbidden_keys(value: object) -> object:
    if isinstance(value, dict):
        return {str(key): _remove_forbidden_keys(child) for key, child in value.items() if str(key) != FORBIDDEN_KEY}
    if isinstance(value, list):
        return [_remove_forbidden_keys(child) for child in value]
    return value


def _natural_path_key(path: Path) -> tuple[object, ...]:
    parts: list[object] = []
    for text in path.parts:
        for piece in re.split(r"(\d+)", text):
            if not piece:
                continue
            parts.append(int(piece) if piece.isdigit() else piece)
    return tuple(parts)


if __name__ == "__main__":
    raise SystemExit(main())
