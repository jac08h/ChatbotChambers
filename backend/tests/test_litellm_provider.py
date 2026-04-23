from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def make_mock_response(content: str, reasoning_content: str = "") -> MagicMock:
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    mock_response.choices[0].message.reasoning_content = reasoning_content if reasoning_content else None
    return mock_response


async def test_returns_content_and_empty_thinking(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Plain response returns (content, '') with no thinking."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hello world")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        content, thinking = await call_litellm("openrouter", "model", "sys", [])
    assert content == "Hello world"
    assert thinking == ""


async def test_reasoning_content_is_not_returned(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Reasoning content is ignored in provider responses."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("The answer", "Step-by-step reasoning")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        content, thinking = await call_litellm("openrouter", "model", "sys", [])
    assert content == "The answer"
    assert thinking == ""


async def test_system_prompt_prepended(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """System prompt is prepended as the first message with role 'system'."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm(
            "github_copilot", "model", "Be helpful", [{"role": "user", "content": "Hello"}]
        )

    call_kwargs = mock_litellm.acompletion.call_args
    messages = call_kwargs.kwargs.get("messages")
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "Be helpful"
    assert messages[1]["role"] == "user"


async def test_openrouter_marks_system_prompt_for_cache(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """OpenRouter requests mark the system prompt as cacheable."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("openrouter", "model", "Be helpful", [])

    call_kwargs = mock_litellm.acompletion.call_args
    messages = call_kwargs.kwargs.get("messages")
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "Be helpful"
    assert messages[0]["cache_control"] == {"type": "ephemeral"}


async def test_empty_response_returns_empty_strings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """None content from API returns ('', '')."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("")
    mock_response.choices[0].message.content = None
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        content, thinking = await call_litellm("github_copilot", "model", "sys", [])
    assert content == ""
    assert thinking == ""


async def test_prompt_logged_to_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Each call appends an entry to logs/prompts.jsonl."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("github_copilot", "my-model", "sys", [])

    log_file = tmp_path / "prompts.jsonl"
    assert log_file.exists()
    import json

    entry = json.loads(log_file.read_text().strip())
    assert entry["model"] == "my-model"


async def test_other_litellm_providers_omit_cache_control(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Non-OpenRouter requests do not mark the system prompt for caching."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("github_copilot", "model", "sys", [])

    call_kwargs = mock_litellm.acompletion.call_args
    messages = call_kwargs.kwargs.get("messages")
    assert "cache_control" not in messages[0]
