from __future__ import annotations

import os
from pathlib import Path

from app.env import _load_env_file, load_local_env


FIXTURE_ENV_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "test-local.env"
)


def test_load_env_file_preserves_existing_values_by_default(
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_ASSISTANT_CHAT_MODEL", "stale-chat-model")
    monkeypatch.delenv("OPENROUTER_ASSISTANT_PLAN_MODEL", raising=False)

    _load_env_file(FIXTURE_ENV_PATH)

    assert os.environ["OPENROUTER_ASSISTANT_CHAT_MODEL"] == "stale-chat-model"
    assert os.environ["OPENROUTER_ASSISTANT_PLAN_MODEL"] == "fresh-plan-model"


def test_load_env_file_can_override_existing_values(
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_ASSISTANT_CHAT_MODEL", "stale-chat-model")

    _load_env_file(FIXTURE_ENV_PATH, override_existing=True)

    assert os.environ["OPENROUTER_ASSISTANT_CHAT_MODEL"] == "fresh-chat-model"


def test_load_local_env_honors_override_flag_for_explicit_env_file(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FITTRACK_ENV_FILE", str(FIXTURE_ENV_PATH))
    monkeypatch.setenv("FITTRACK_ENV_OVERRIDE", "true")
    monkeypatch.setenv("OPENROUTER_ASSISTANT_CHAT_MODEL", "stale-chat-model")

    load_local_env()

    assert os.environ["OPENROUTER_ASSISTANT_CHAT_MODEL"] == "fresh-chat-model"
