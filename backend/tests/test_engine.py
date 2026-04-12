import asyncio
from typing import List, Union

import pytest

from lmparlor.engine import Generating, Streaming, _build_messages, _build_system_prompt, run_conversation
from lmparlor.models import ChatbotConfig, Message, SessionConfig


async def collect(
    config: SessionConfig, mock_key: str = "test-key"
) -> List[Union[Generating, Streaming, Message]]:
    pause = asyncio.Event()
    pause.set()
    stop = asyncio.Event()
    interrupt = asyncio.Event()
    events = []
    async for event in run_conversation(config, mock_key, pause, stop, interrupt):
        events.append(event)
    return events


async def test_basic_two_turns_produces_four_messages(mock_openrouter: object, session_config: SessionConfig):
    """Two turns produce 4 Message events alternating a/b/a/b."""
    mock_openrouter.side_effect = [("Hello!", ""), ("Hi!", ""), ("Again", ""), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert len(messages) == 4
    assert [m.chatbot for m in messages] == ["a", "b", "a", "b"]


async def test_generating_precedes_each_message(mock_openrouter: object, session_config: SessionConfig):
    """Each Message is immediately preceded by a Generating event for the same chatbot."""
    mock_openrouter.side_effect = [("Hello!", ""), ("Hi!", ""), ("Again", ""), ("/leave", "")]
    events = await collect(session_config)
    for i, event in enumerate(events):
        if isinstance(event, Message):
            assert i > 0
            prev = events[i - 1]
            assert isinstance(prev, Generating)
            assert prev.chatbot == event.chatbot


async def test_leave_command_ends_conversation(mock_openrouter: object, session_config: SessionConfig):
    """When chatbot A responds with /leave, conversation ends after that message."""
    mock_openrouter.side_effect = [("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert len(messages) == 1
    assert messages[0].content == "/leave"
    assert messages[0].chatbot == "a"


async def test_leave_by_chatbot_b(mock_openrouter: object, session_config: SessionConfig):
    """When chatbot B responds with /leave, conversation ends after that message."""
    mock_openrouter.side_effect = [("Hello!", ""), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert len(messages) == 2
    assert messages[-1].chatbot == "b"
    assert messages[-1].content == "/leave"


async def test_stop_event_terminates(mock_openrouter: object, session_config: SessionConfig):
    """Setting stop_event before start yields no events."""
    pause = asyncio.Event()
    pause.set()
    stop = asyncio.Event()
    stop.set()
    interrupt = asyncio.Event()
    events = []
    async for event in run_conversation(session_config, "key", pause, stop, interrupt):
        events.append(event)
    assert events == []


async def test_leave_after_two_messages_stops_conversation(mock_openrouter: object, session_config: SessionConfig):
    """A /leave from chatbot B stops the conversation after two messages."""
    mock_openrouter.side_effect = [("Hi!", ""), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert len(messages) == 2
    assert messages[0].chatbot == "a"
    assert messages[1].chatbot == "b"


async def test_thinking_passed_through(mock_openrouter: object, session_config: SessionConfig):
    """Thinking content from openrouter is included in the yielded Message."""
    mock_openrouter.side_effect = [("Answer", "My reasoning here"), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert messages[0].thinking == "My reasoning here"


async def test_mixed_providers_dispatches_correctly(
    monkeypatch: pytest.MonkeyPatch, session_config: SessionConfig
):
    """Chatbot A uses openrouter, chatbot B uses claude_code — correct functions called."""
    session_config.chatbot_b.provider = "claude_code"
    openrouter_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    claude_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    async def mock_or(*args: object, **kwargs: object):
        openrouter_calls.append((args, kwargs))
        yield "From OR", ""

    async def mock_cc(*args: object, **kwargs: object):
        claude_calls.append((args, kwargs))
        yield "/leave"

    monkeypatch.setattr("lmparlor.engine.stream_openrouter", mock_or)
    monkeypatch.setattr("lmparlor.engine.stream_claude_code", mock_cc)
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]

    assert len(openrouter_calls) == 1
    assert len(claude_calls) == 1
    assert messages[0].content == "From OR"
    assert messages[1].content == "/leave"


async def test_history_role_perspective(mock_openrouter: object, session_config: SessionConfig):
    """When B speaks, A's messages appear as 'user' and B's prior messages as 'assistant'."""
    responses = [("A says hi", ""), ("B replies", ""), ("A again", ""), ("/leave", "")]
    mock_openrouter.side_effect = responses

    await collect(session_config)

    third_call_args = mock_openrouter.call_args_list[2]
    messages_arg = third_call_args.kwargs.get("messages") or third_call_args.args[2]
    roles = [m["role"] for m in messages_arg]
    assert roles == ["assistant", "user"]

    fourth_call_args = mock_openrouter.call_args_list[3]
    messages_arg = fourth_call_args.kwargs.get("messages") or fourth_call_args.args[2]
    roles = [m["role"] for m in messages_arg]
    assert roles == ["user", "assistant", "user"]


async def test_message_name_populated(mock_openrouter: object, session_config: SessionConfig):
    """Yielded messages carry the chatbot display name from config."""
    mock_openrouter.side_effect = [("Hi", ""), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert messages[0].name == session_config.chatbot_a.name
    assert messages[1].name == session_config.chatbot_b.name


async def test_turn_number_increments(mock_openrouter: object, session_config: SessionConfig):
    """Turn number increments after both chatbots have spoken."""
    mock_openrouter.side_effect = [("Hi", ""), ("Hi", ""), ("Hi", ""), ("/leave", "")]
    events = await collect(session_config)
    messages = [e for e in events if isinstance(e, Message)]
    assert messages[0].turn == 0
    assert messages[1].turn == 0
    assert messages[2].turn == 1
    assert messages[3].turn == 1


async def test_interrupt_drops_partial_message_and_retries_same_chatbot(
    monkeypatch: pytest.MonkeyPatch, session_config: SessionConfig
):
    """Interrupting generation yields no final Message and retries the same chatbot after resume."""
    pause = asyncio.Event()
    pause.set()
    stop = asyncio.Event()
    interrupt = asyncio.Event()
    started = asyncio.Event()
    release = asyncio.Event()

    async def mock_or(*args: object, **kwargs: object):
        started.set()
        yield "Part", ""
        await release.wait()
        yield "Complete", ""

    monkeypatch.setattr("lmparlor.engine.stream_openrouter", mock_or)

    events: list[Union[Generating, Streaming, Message]] = []

    async def consume() -> None:
        async for event in run_conversation(session_config, "key", pause, stop, interrupt):
            events.append(event)
            if isinstance(event, Message):
                stop.set()
                interrupt.set()
                pause.set()

    task = asyncio.create_task(consume())

    while not started.is_set():
        await asyncio.sleep(0)

    pause.clear()
    interrupt.set()
    await asyncio.sleep(0)
    assert not any(isinstance(event, Message) for event in events)

    release.set()
    pause.set()
    await task

    messages = [event for event in events if isinstance(event, Message)]
    assert len(messages) == 1
    assert messages[0].chatbot == "a"
    assert messages[0].content == "Complete"


def test_build_system_prompt_all_parts():
    """All non-empty parts are joined with double newlines."""
    result = _build_system_prompt("preamble", "shared", "individual")
    from lmparlor.engine import PREAMBLE
    assert result == "\n\n".join([PREAMBLE, "preamble", "shared", "individual"])


def test_build_system_prompt_empty_parts_excluded():
    """Empty shared and individual prompts are excluded from the result."""
    result = _build_system_prompt("preamble", "", "")
    from lmparlor.engine import PREAMBLE
    assert result == "\n\n".join([PREAMBLE, "preamble"])
    assert "  " not in result


def test_build_system_prompt_whitespace_trimmed():
    """Whitespace-only prompts are excluded."""
    result = _build_system_prompt("preamble", "   ", "\t")
    from lmparlor.engine import PREAMBLE
    assert result == "\n\n".join([PREAMBLE, "preamble"])


def test_build_messages_empty_history():
    """Empty history produces empty message list."""
    result = _build_messages([], "a", {"a": "LM A", "b": "LM B"})
    assert result == []


def test_build_messages_name_prepended():
    """Each message content is prefixed with 'Name: '."""
    history = [("a", "Hello")]
    result = _build_messages(history, "b", {"a": "Alice", "b": "Bob"})
    assert result[0]["content"] == "Alice: Hello"


def test_build_messages_role_assignment_for_speaker():
    """Own messages are 'assistant', other's messages are 'user'."""
    history = [("a", "msg1"), ("b", "msg2"), ("a", "msg3")]
    result = _build_messages(history, "a", {"a": "A", "b": "B"})
    assert result[0]["role"] == "assistant"
    assert result[1]["role"] == "user"
    assert result[2]["role"] == "assistant"


def test_build_messages_role_assignment_for_other():
    """From B's perspective, A's messages are 'user' and B's are 'assistant'."""
    history = [("a", "msg1"), ("b", "msg2")]
    result = _build_messages(history, "b", {"a": "A", "b": "B"})
    assert result[0]["role"] == "user"
    assert result[1]["role"] == "assistant"
