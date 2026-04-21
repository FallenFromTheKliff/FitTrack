from __future__ import annotations

import os
from pathlib import Path


def load_local_env() -> None:
    override_existing = _should_override_existing()
    for env_path in _candidate_env_paths():
        if not env_path.exists():
            continue
        _load_env_file(env_path, override_existing=override_existing)
        return


def _candidate_env_paths() -> list[Path]:
    repo_root = Path(__file__).resolve().parents[3]
    explicit = os.getenv("FITTRACK_ENV_FILE")

    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))

    candidates.extend(
        [
            repo_root / ".env",
            repo_root / ".env.docker",
        ]
    )
    return candidates


def _should_override_existing() -> bool:
    override_raw = os.getenv("FITTRACK_ENV_OVERRIDE", "")
    return override_raw.strip().lower() in {"1", "true", "yes", "on"}


def _load_env_file(path: Path, *, override_existing: bool = False) -> None:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        normalized_key = key.strip()
        normalized_value = value.strip().strip('"').strip("'")

        if normalized_key and (override_existing or not os.getenv(normalized_key)):
            os.environ[normalized_key] = normalized_value
