import asyncio
from types import SimpleNamespace

import pytest

from lmparlor.models import ChatbotConfig, SessionConfig


@pytest.fixture
def chatbot_config_a() -> ChatbotConfig:
    return ChatbotConfig(
        name="LM A",
        model="anthropic/claude-sonnet-4-5",
        system_prompt="You are LM A.",
        provider="openrouter",
    )


@pytest.fixture
def chatbot_config_b() -> ChatbotConfig:
    return ChatbotConfig(
        name="LM B",
        model="openai/gpt-4o",
        system_prompt="You are LM B.",
        provider="openrouter",
    )


@pytest.fixture
def session_config(chatbot_config_a: ChatbotConfig, chatbot_config_b: ChatbotConfig) -> SessionConfig:
    return SessionConfig(
        chatbot_a=chatbot_config_a,
        chatbot_b=chatbot_config_b,
        shared_system_prompt="You are in a debate.",
    )


@pytest.fixture
def pause_event() -> asyncio.Event:
    event = asyncio.Event()
    event.set()
    return event


@pytest.fixture
def stop_event() -> asyncio.Event:
    return asyncio.Event()


class StreamMock:
    def __init__(self, default_response: object):
        self.default_response = default_response
        self.side_effect: list[object] | None = None
        self.call_count = 0
        self.call_args_list: list[SimpleNamespace] = []

    def __call__(self, *args: object, **kwargs: object):
        self.call_count += 1
        self.call_args_list.append(SimpleNamespace(args=args, kwargs=kwargs))
        if self.side_effect is None:
            response = self.default_response
        else:
            response = self.side_effect[self.call_count - 1]

        async def generator():
            if isinstance(response, list):
                for item in response:
                    yield item
                return
            yield response

        return generator()


@pytest.fixture
def mock_openrouter(monkeypatch: pytest.MonkeyPatch) -> StreamMock:
    mock = StreamMock(("Hello!", ""))
    monkeypatch.setattr("lmparlor.engine.stream_openrouter", mock)
    return mock


@pytest.fixture
def mock_claude_code(monkeypatch: pytest.MonkeyPatch) -> StreamMock:
    mock = StreamMock("Hello from Claude!")
    monkeypatch.setattr("lmparlor.engine.stream_claude_code", mock)
    return mock


@pytest.fixture
def mock_codex(monkeypatch: pytest.MonkeyPatch) -> StreamMock:
    mock = StreamMock("Hello from Codex!")
    monkeypatch.setattr("lmparlor.engine.stream_codex", mock)
    return mock
