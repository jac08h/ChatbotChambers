from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def make_mock_client(content: str) -> MagicMock:
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    return mock_client


async def test_returns_content_and_empty_thinking(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Plain response returns (content, '') with no thinking."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("Hello world")
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        content, thinking = await call_openrouter("model", "sys", [], "key")
    assert content == "Hello world"
    assert thinking == ""


async def test_strips_think_tags(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """<think> tags are removed from content and their contents returned as thinking."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("<think>My reasoning</think>The answer")
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        content, thinking = await call_openrouter("model", "sys", [], "key")
    assert content == "The answer"
    assert thinking == "My reasoning"


async def test_strips_multiple_think_blocks(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Multiple <think> blocks are all stripped from content."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("<think>First</think>Answer<think>Second</think>")
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        content, thinking = await call_openrouter("model", "sys", [], "key")
    assert "think" not in content
    assert content == "Answer"
    assert thinking == "First"


async def test_system_prompt_prepended(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """System prompt is prepended as the first message with role 'system'."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("Hi")
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        await call_openrouter("model", "Be helpful", [{"role": "user", "content": "Hello"}], "key")

    call_kwargs = mock_client.chat.completions.create.call_args
    messages = call_kwargs.kwargs.get("messages") or call_kwargs.args[1]
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "Be helpful"
    assert messages[1]["role"] == "user"


async def test_empty_response_returns_empty_strings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """None content from API returns ('', '')."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client(None)
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        content, thinking = await call_openrouter("model", "sys", [], "key")
    assert content == ""
    assert thinking == ""


async def test_prompt_logged_to_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Each call appends an entry to logs/prompts.jsonl."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("Hi")
    with patch("app.providers.openrouter.AsyncOpenAI", return_value=mock_client):
        from app.providers.openrouter import call_openrouter
        await call_openrouter("my-model", "sys", [], "key")

    log_file = tmp_path / "prompts.jsonl"
    assert log_file.exists()
    import json
    entry = json.loads(log_file.read_text().strip())
    assert entry["model"] == "my-model"


async def test_uses_correct_api_key(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """API key is passed to the AsyncOpenAI client."""
    monkeypatch.setattr("app.providers.openrouter.LOGS_DIR", tmp_path)
    mock_client = make_mock_client("Hi")
    captured = {}
    def capture_client(**kwargs: object) -> MagicMock:
        captured.update(kwargs)
        return mock_client
    with patch("app.providers.openrouter.AsyncOpenAI", side_effect=capture_client):
        from app.providers.openrouter import call_openrouter
        await call_openrouter("model", "sys", [], "my-secret-key")
    assert captured["api_key"] == "my-secret-key"
