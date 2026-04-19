import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.provider_state import ProviderState
from app.providers.claude_code import _build_prompt, _extract_last_message, call_claude_code


def make_mock_process(stdout: bytes = b"response\n", stderr: bytes = b"", returncode: int = 0) -> MagicMock:
    mock_process = MagicMock()
    mock_process.communicate = AsyncMock(return_value=(stdout, stderr))
    mock_process.returncode = returncode
    return mock_process


def _json_response(result: str = "response", session_id: str = "sess-123") -> bytes:
    return json.dumps({"result": result, "session_id": session_id}).encode()


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


async def test_initial_call_includes_output_format_json():
    """Initial call includes --output-format json."""
    mock_process = make_mock_process()
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "sys", [])
    args = mock_exec.call_args.args
    assert "--output-format" in args
    idx = list(args).index("--output-format")
    assert args[idx + 1] == "json"


async def test_json_response_extracts_result():
    """JSON output is parsed and result field returned."""
    mock_process = make_mock_process(stdout=_json_response("hello from json"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        result = await call_claude_code("model", "sys", [])
    assert result == "hello from json"


async def test_json_response_stores_session_id(tmp_path):
    """Session ID from JSON output is stored in provider state."""
    mock_process = make_mock_process(stdout=_json_response("hello", "my-session-id"))
    state = ProviderState(provider="claude_code", storage_path=str(tmp_path))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)):
        await call_claude_code("model", "sys", [], provider_state=state)
    assert state.session_id == "my-session-id"
    assert state.initialized is True


async def test_resumed_call_uses_session_id(tmp_path):
    """Follow-up call uses --resume with stored session ID."""
    state = ProviderState(
        provider="claude_code",
        session_id="existing-session",
        initialized=True,
        storage_path=str(tmp_path),
    )
    mock_process = make_mock_process(stdout=_json_response("resumed response", "existing-session"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        result = await call_claude_code(
            "model", "sys", [{"role": "assistant", "content": "Bob: Hi"}], provider_state=state
        )
    args = mock_exec.call_args.args
    assert "--resume" in args
    assert "existing-session" in args
    assert "--system-prompt" not in args
    assert result == "resumed response"


async def test_resumed_call_sends_only_last_message(tmp_path):
    """Resumed call sends only the last message content, not full transcript."""
    state = ProviderState(
        provider="claude_code",
        session_id="sess-1",
        initialized=True,
        storage_path=str(tmp_path),
    )
    messages = [
        {"role": "assistant", "content": "Alice: Hello"},
        {"role": "assistant", "content": "Bob: Hi there"},
    ]
    mock_process = make_mock_process(stdout=_json_response("ok", "sess-1"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "sys", messages, provider_state=state)
    args = list(mock_exec.call_args.args)
    assert args[-1] == "Bob: Hi there"


async def test_storage_path_sets_config_dir_env(tmp_path):
    """Storage path is passed as CLAUDE_CONFIG_DIR env variable."""
    state = ProviderState(provider="claude_code", storage_path=str(tmp_path))
    mock_process = make_mock_process(stdout=_json_response("ok", "sess"))
    with patch("asyncio.create_subprocess_exec", AsyncMock(return_value=mock_process)) as mock_exec:
        await call_claude_code("model", "sys", [], provider_state=state)
    call_kwargs = mock_exec.call_args.kwargs
    assert call_kwargs.get("env", {}).get("CLAUDE_CONFIG_DIR") == str(tmp_path)


def test_build_prompt_empty_messages():
    """Empty message list returns conversation start marker."""
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
