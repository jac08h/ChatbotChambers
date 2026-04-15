import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.providers.claude_code import _build_prompt, call_claude_code


def make_mock_process(stdout: bytes = b"response\n", stderr: bytes = b"") -> MagicMock:
    mock_process = MagicMock()
    mock_process.communicate = AsyncMock(return_value=(stdout, stderr))
    return mock_process


async def test_returns_stripped_stdout():
    """Returns stdout content stripped of surrounding whitespace."""
    mock_process = make_mock_process(stdout=b"  hello world  \n")
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result = await call_claude_code("model", "sys", [])
    assert result == "hello world"


async def test_includes_model_in_args():
    """CLI args include the --model flag with the given model name."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("claude-sonnet-4-6", "sys", [])
    args = mock_exec.call_args.args
    assert "--model" in args
    assert "claude-sonnet-4-6" in args


async def test_includes_system_prompt_when_provided():
    """--system-prompt flag is included when system_prompt is non-empty."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "Be helpful", [])
    args = mock_exec.call_args.args
    assert "--system-prompt" in args
    assert "Be helpful" in args


async def test_omits_system_prompt_when_empty():
    """--system-prompt flag is omitted when system_prompt is empty."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "", [])
    args = mock_exec.call_args.args
    assert "--system-prompt" not in args


async def test_includes_p_flag():
    """The -p flag is always included."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "", [])
    args = mock_exec.call_args.args
    assert "-p" in args


def test_build_prompt_empty_messages():
    """Empty message list returns empty string."""
    assert _build_prompt([]) == "(conversation starts)"


def test_build_prompt_user_role_becomes_human():
    """User role messages are prefixed with 'Human:'."""
    messages = [{"role": "user", "content": "Hello"}]
    result = _build_prompt(messages)
    assert result == "Human: Hello"


def test_build_prompt_assistant_role_becomes_assistant():
    """Assistant role messages are prefixed with 'Assistant:'."""
    messages = [{"role": "assistant", "content": "Hi there"}]
    result = _build_prompt(messages)
    assert result == "Assistant: Hi there"


def test_build_prompt_multiple_messages_joined():
    """Multiple messages are joined with double newlines."""
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi"},
    ]
    result = _build_prompt(messages)
    assert result == "Human: Hello\n\nAssistant: Hi"
