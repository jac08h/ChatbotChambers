import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.providers.claude_code import _latest_message_content, call_claude_code


def make_mock_process(stdout: bytes = b"response\n", stderr: bytes = b"") -> MagicMock:
    mock_process = MagicMock()
    mock_process.communicate = AsyncMock(return_value=(stdout, stderr))
    return mock_process


async def test_returns_stripped_stdout():
    """Returns stdout content stripped of surrounding whitespace."""
    mock_process = make_mock_process(stdout=b"  hello world  \n")
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result, session_id = await call_claude_code("model", "sys", [], None)
    assert result == "hello world"
    assert session_id


async def test_includes_model_in_args():
    """CLI args include the --model flag with the given model name."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("claude-sonnet-4-6", "sys", [], None)
    args = mock_exec.call_args.args
    assert "--model" in args
    assert "claude-sonnet-4-6" in args


async def test_includes_system_prompt_when_provided():
    """--system-prompt flag is included when system_prompt is non-empty."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "Be helpful", [], None)
    args = mock_exec.call_args.args
    assert "--system-prompt" in args
    assert "Be helpful" in args


async def test_omits_system_prompt_when_empty():
    """--system-prompt flag is omitted when system_prompt is empty."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "", [], None)
    args = mock_exec.call_args.args
    assert "--system-prompt" not in args


async def test_includes_p_flag():
    """The -p flag is always included."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "", [], None)
    args = mock_exec.call_args.args
    assert "-p" in args


async def test_uses_known_session_id_for_first_turn():
    """First turn creates and passes a new session id."""
    mock_process = make_mock_process()
    expected_session_id = "12345678-1234-5678-1234-567812345678"
    with (
        patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec,
        patch("app.providers.claude_code.uuid.uuid4", return_value=uuid.UUID(expected_session_id)),
    ):
        _, session_id = await call_claude_code("model", "sys", [], None)
    args = mock_exec.call_args.args
    assert "--session-id" in args
    assert expected_session_id in args
    assert session_id == expected_session_id


async def test_uses_resume_for_existing_session():
    """Subsequent turns resume the existing session without resetting the system prompt."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        _, session_id = await call_claude_code(
            "model",
            "sys",
            [{"role": "assistant", "content": "Hello"}],
            "existing-session",
        )
    args = mock_exec.call_args.args
    assert "--resume" in args
    assert "existing-session" in args
    assert "--system-prompt" not in args
    assert session_id == "existing-session"


def test_latest_message_content_empty_messages():
    """Empty message list uses the conversation-start placeholder."""
    assert _latest_message_content([]) == "(conversation starts)"


def test_latest_message_content_uses_last_message():
    """Only the last message content is sent to Claude."""
    messages = [
        {"role": "assistant", "content": "Hello"},
        {"role": "user", "content": "Latest"},
    ]
    assert _latest_message_content(messages) == "Latest"
