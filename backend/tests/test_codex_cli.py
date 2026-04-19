import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.provider_state import ProviderState
from app.providers.codex_cli import _build_prompt, _extract_last_message, call_codex


def make_mock_process(stdout: bytes = b"response\n", stderr: bytes = b"", returncode: int = 0) -> MagicMock:
    mock_process = MagicMock()
    mock_process.communicate = AsyncMock(return_value=(stdout, stderr))
    mock_process.returncode = returncode
    return mock_process


def _json_response(output: str = "response", session_id: str = "sess-456") -> bytes:
    return json.dumps({"output": output, "session_id": session_id}).encode()


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


async def test_initial_call_includes_output_format_json():
    """Initial call includes --output-format json."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_codex("model", "sys", [])
    args = mock_exec.call_args.args
    assert "--output-format" in args
    idx = list(args).index("--output-format")
    assert args[idx + 1] == "json"


async def test_json_response_extracts_output():
    """JSON output is parsed and output field returned."""
    mock_process = make_mock_process(stdout=_json_response("hello from codex"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result = await call_codex("model", "sys", [])
    assert result == "hello from codex"


async def test_json_response_stores_session_id(tmp_path):
    """Session ID from JSON output is stored in provider state."""
    mock_process = make_mock_process(stdout=_json_response("hello", "codex-session-1"))
    state = ProviderState(provider="codex")
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        await call_codex("model", "sys", [], provider_state=state)
    assert state.session_id == "codex-session-1"
    assert state.initialized is True


async def test_resumed_call_uses_session_id(tmp_path):
    """Follow-up call uses resume subcommand with stored session ID."""
    state = ProviderState(
        provider="codex",
        session_id="existing-codex-session",
        initialized=True,
    )
    mock_process = make_mock_process(stdout=_json_response("resumed", "existing-codex-session"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        result = await call_codex(
            "model", "sys", [{"role": "assistant", "content": "Alice: Hi"}], provider_state=state
        )
    args = mock_exec.call_args.args
    assert "resume" in args
    assert "existing-codex-session" in args
    assert result == "resumed"


async def test_resumed_call_sends_only_last_message():
    """Resumed call sends only the last message via stdin."""
    state = ProviderState(
        provider="codex",
        session_id="sess-1",
        initialized=True,
    )
    messages = [
        {"role": "assistant", "content": "Alice: Hello"},
        {"role": "assistant", "content": "Bob: Hi there"},
    ]
    mock_process = make_mock_process(stdout=_json_response("ok", "sess-1"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        await call_codex("model", "sys", messages, provider_state=state)
    call_kwargs = mock_process.communicate.call_args.kwargs
    stdin_input = call_kwargs.get("input") or mock_process.communicate.call_args.args[0]
    assert stdin_input == b"Bob: Hi there"


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


def test_extract_last_message_returns_content():
    """Extracts content from the last message."""
    messages = [
        {"role": "assistant", "content": "first"},
        {"role": "assistant", "content": "second"},
    ]
    assert _extract_last_message(messages) == "second"


def test_extract_last_message_empty_returns_continue():
    """Empty messages list returns continue marker."""
    assert _extract_last_message([]) == "(continue)"
