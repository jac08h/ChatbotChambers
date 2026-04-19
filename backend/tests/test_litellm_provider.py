from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.provider_state import ProviderState


def make_mock_response(content: str, reasoning_content: str = "") -> MagicMock:
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    mock_response.choices[0].message.reasoning_content = reasoning_content if reasoning_content else None
    mock_response.usage = None
    return mock_response


def make_mock_response_with_cache(
    content: str,
    cache_creation_input_tokens: int = 0,
    cache_read_input_tokens: int = 0,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> MagicMock:
    mock_response = make_mock_response(content)
    usage = MagicMock()
    usage.cache_creation_input_tokens = cache_creation_input_tokens
    usage.cache_read_input_tokens = cache_read_input_tokens
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens
    mock_response.usage = usage
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


async def test_openrouter_sets_reasoning_effort_to_none(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """OpenRouter requests opt out of thinking when supported."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("openrouter", "model", "sys", [])

    call_kwargs = mock_litellm.acompletion.call_args
    assert call_kwargs.kwargs.get("reasoning_effort") == "none"


async def test_other_litellm_providers_omit_reasoning_effort(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Non-OpenRouter requests do not send reasoning_effort."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("github_copilot", "model", "sys", [])

    call_kwargs = mock_litellm.acompletion.call_args
    assert "reasoning_effort" not in call_kwargs.kwargs


async def test_openrouter_system_prompt_has_cache_control(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """OpenRouter system prompt uses content-block structure with cache_control."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("openrouter", "model", "Be helpful", [])

    call_kwargs = mock_litellm.acompletion.call_args
    messages = call_kwargs.kwargs.get("messages")
    system_msg = messages[0]
    assert system_msg["role"] == "system"
    assert isinstance(system_msg["content"], list)
    block = system_msg["content"][0]
    assert block["type"] == "text"
    assert block["text"] == "Be helpful"
    assert block["cache_control"] == {"type": "ephemeral"}


async def test_non_openrouter_system_prompt_is_plain_string(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Non-OpenRouter system prompt is a plain string, not content blocks."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("github_copilot", "model", "Be helpful", [])

    call_kwargs = mock_litellm.acompletion.call_args
    messages = call_kwargs.kwargs.get("messages")
    system_msg = messages[0]
    assert system_msg["role"] == "system"
    assert system_msg["content"] == "Be helpful"


async def test_cache_metrics_stored_in_provider_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """Cache metrics from response are stored in provider state metadata."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response_with_cache(
        "Hi", cache_creation_input_tokens=100, cache_read_input_tokens=50, prompt_tokens=200
    )
    state = ProviderState(provider="openrouter")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("openrouter", "model", "sys", [], provider_state=state)

    metrics = state.metadata.get("last_cache_metrics")
    assert metrics is not None
    assert metrics["cache_creation_input_tokens"] == 100
    assert metrics["cache_read_input_tokens"] == 50
    assert metrics["prompt_tokens"] == 200


async def test_no_cache_metrics_when_usage_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """No cache metrics stored when response has no usage data."""
    monkeypatch.setattr("app.providers.litellm_provider.LOGS_DIR", tmp_path)
    mock_response = make_mock_response("Hi")
    state = ProviderState(provider="openrouter")
    with patch("app.providers.litellm_provider.litellm") as mock_litellm:
        mock_litellm.acompletion = AsyncMock(return_value=mock_response)
        from app.providers.litellm_provider import call_litellm

        await call_litellm("openrouter", "model", "sys", [], provider_state=state)

    assert "last_cache_metrics" not in state.metadata
