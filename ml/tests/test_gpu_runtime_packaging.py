from __future__ import annotations

import re
import tomllib
from pathlib import Path
from typing import Any


def test_gpu_dockerfile_cuda_runtime_matches_linux_torch_wheel() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    pyproject = tomllib.loads((ml_root / "pyproject.toml").read_text(encoding="utf-8"))
    dockerfile = (ml_root / "Dockerfile.gpu").read_text(encoding="utf-8")

    torch_source = _linux_torch_source(pyproject)
    index_name = torch_source["index"]
    index_url = _uv_index_url(pyproject, index_name)

    wheel_cuda = _cuda_family_from_pytorch_url(index_url)
    docker_cuda = _cuda_family_from_dockerfile(dockerfile)

    assert index_name == "pytorch-cu124"
    assert wheel_cuda == (12, 4)
    assert docker_cuda == wheel_cuda


def _linux_torch_source(pyproject: dict[str, Any]) -> dict[str, str]:
    sources = pyproject["tool"]["uv"]["sources"]["torch"]
    for source in sources:
        marker = source.get("marker", "")
        if "sys_platform == 'linux'" in marker:
            return source
    raise AssertionError("torch must use an explicit Linux CUDA wheel source")


def _uv_index_url(pyproject: dict[str, Any], index_name: str) -> str:
    indices = pyproject["tool"]["uv"]["index"]
    for index in indices:
        if index.get("name") == index_name:
            return str(index["url"])
    raise AssertionError(f"uv index not found: {index_name}")


def _cuda_family_from_pytorch_url(url: str) -> tuple[int, int]:
    match = re.search(r"/cu(?P<major>\d{2})(?P<minor>\d)(?:/)?$", url)
    if not match:
        raise AssertionError(f"PyTorch CUDA index URL must end with a cuNNN family: {url}")
    return (int(match.group("major")), int(match.group("minor")))


def _cuda_family_from_dockerfile(dockerfile: str) -> tuple[int, int]:
    from_line = next((line for line in dockerfile.splitlines() if line.startswith("FROM nvidia/cuda:")), "")
    match = re.match(r"FROM nvidia/cuda:(?P<major>\d+)\.(?P<minor>\d+)\.\d+-runtime-ubuntu22\.04$", from_line)
    if not match:
        raise AssertionError("GPU Dockerfile must use an explicit nvidia/cuda runtime Ubuntu 22.04 base image")
    return (int(match.group("major")), int(match.group("minor")))
