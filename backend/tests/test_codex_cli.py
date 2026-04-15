from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.codex_cli import _build_prompt, call_codex


def make_mock_process(stdout: bytes = b"response\n", stderr: bytes = b"") -> MagicMock:
    mock_process = MagicMock()
    mock_process.communicate = AsyncMock(return_value=(stdout, stderr))
    return mock_process


async def test_returns_last_non_empty_line():
    """Returns the last non-empty line of stdout."""
    mock_process = make_mock_process(stdout=b"first line\nsecond line\n\n")
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result = await call_codex("model", "sys", [])
    assert result == "second line"


async def test_returns_empty_string_for_empty_output():
    """Empty stdout returns empty string."""
    mock_process = make_mock_process(stdout=b"")
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result = await call_codex("model", "sys", [])
    assert result == ""


async def test_correct_command_args():
    """CLI command is 'codex exec --model <model>'."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_codex("gpt-5.4", "sys", [])
    args = mock_exec.call_args.args
    assert args[0] == "codex"
    assert "exec" in args
    assert "--model" in args
    assert "gpt-5.4" in args


async def test_prompt_sent_via_stdin():
    """Prompt is passed via stdin to the subprocess."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        await call_codex("model", "system prompt", [{"role": "user", "content": "Hello"}])
    call_kwargs = mock_process.communicate.call_args.kwargs
    stdin_input = call_kwargs.get("input") or mock_process.communicate.call_args.args[0]
    assert b"Hello" in stdin_input
    assert b"system prompt" in stdin_input


def test_build_prompt_empty_messages_no_system():
    """Empty messages and no system prompt returns empty string."""
    assert _build_prompt("", []) == ""


def test_build_prompt_system_prompt_prepended():
    """System prompt appears before messages."""
    result = _build_prompt("Be helpful", [{"role": "user", "content": "Hi"}])
    assert result.startswith("Be helpful")
    assert "Human: Hi" in result


def test_build_prompt_no_system_prompt():
    """Without system prompt, only messages are included."""
    result = _build_prompt("", [{"role": "user", "content": "Hi"}])
    assert result == "Human: Hi"


def test_build_prompt_multiple_messages():
    """Multiple messages joined with double newlines."""
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi"},
    ]
    result = _build_prompt("", messages)
    assert result == "Human: Hello\n\nAssistant: Hi"
