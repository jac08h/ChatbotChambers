from typing import List

import pytest
from fastapi.testclient import TestClient

from lmparlor.main import app

pytestmark = pytest.mark.integration

OPENROUTER_CONFIG = {
    "chatbot_a": {
        "name": "LM A",
        "model": "anthropic/claude-sonnet-4-5",
        "system_prompt": "You are A.",
        "provider": "openrouter",
    },
    "chatbot_b": {
        "name": "LM B",
        "model": "openai/gpt-4o",
        "system_prompt": "You are B.",
        "provider": "openrouter",
    },
    "shared_system_prompt": "Have a conversation.",
}


def collect_ws_events(ws: object, stop_on: tuple = ("done", "error")) -> List[dict]:
    events = []
    while True:
        data = ws.receive_json()
        events.append(data)
        if data["type"] in stop_on:
            break
    return events


def make_stream_mock(responses: List[object]):
    call_index = 0

    async def mock_stream(*args: object, **kwargs: object):
        nonlocal call_index
        response = responses[call_index]
        call_index += 1
        if isinstance(response, list):
            for item in response:
                yield item
            return
        yield response

    return mock_stream


def test_full_conversation_flow(monkeypatch: pytest.MonkeyPatch):
    """Start message triggers generating/message/done sequence."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([("Hello!", ""), ("/leave", "")]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        events = collect_ws_events(ws)

    types = [e["type"] for e in events]
    assert "generating" in types
    assert "message" in types
    assert events[-1]["type"] == "done"


def test_done_reason_leave(monkeypatch: pytest.MonkeyPatch):
    """When chatbot responds /leave, done reason is 'leave'."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([("/leave", "")]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        events = collect_ws_events(ws)

    done = events[-1]
    assert done["reason"] == "leave"
    assert "chatbot" in done


def test_stop_command_accepted_without_error(monkeypatch: pytest.MonkeyPatch):
    """Sending stop command does not produce an error response."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([("Hello!", "")]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        ws.send_json({"type": "stop"})
        events = collect_ws_events(ws)

    assert all(e["type"] != "error" for e in events)
    assert events[-1]["type"] == "done"


def test_missing_start_message_returns_error(monkeypatch: pytest.MonkeyPatch):
    """Sending a non-start message first results in an error response."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "pause"})
        data = ws.receive_json()

    assert data["type"] == "error"


def test_missing_api_key_returns_error(monkeypatch: pytest.MonkeyPatch):
    """OpenRouter config without OPENROUTER_API_KEY returns an error."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        data = ws.receive_json()

    assert data["type"] == "error"
    assert "OPENROUTER_API_KEY" in data["message"]


def test_message_data_shape(monkeypatch: pytest.MonkeyPatch):
    """Message events contain all expected fields in 'data'."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([("Hi!", "thinking"), ("/leave", "")]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        events = collect_ws_events(ws)

    message_events = [e for e in events if e["type"] == "message"]
    assert len(message_events) > 0
    msg = message_events[0]["data"]
    assert set(msg.keys()) >= {"chatbot", "name", "model", "content", "turn", "thinking"}
    assert msg["thinking"] == "thinking"


def test_generating_events_indicate_correct_chatbot(monkeypatch: pytest.MonkeyPatch):
    """Generating events carry the chatbot id ('a' or 'b')."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([("Hi!", ""), ("/leave", "")]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        events = collect_ws_events(ws)

    generating_events = [e for e in events if e["type"] == "generating"]
    assert all(e["chatbot"] in ("a", "b") for e in generating_events)


def test_stream_event_sent_before_final_message(monkeypatch: pytest.MonkeyPatch):
    """Streaming updates are sent before the final message event."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "lmparlor.engine.stream_openrouter",
        make_stream_mock([[("Par", ""), ("Partial", "")], [("/leave", "")]]),
    )

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "start", "config": OPENROUTER_CONFIG})
        events = collect_ws_events(ws)

    stream_events = [event for event in events if event["type"] == "stream"]
    assert len(stream_events) >= 2
    assert stream_events[0]["data"]["content"] == "Par"
    assert stream_events[1]["data"]["content"] == "Partial"
