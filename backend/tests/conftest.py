import asyncio
from unittest.mock import AsyncMock

import pytest

from app.models import ChatbotConfig, SessionConfig


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


@pytest.fixture
def cancel_event() -> asyncio.Event:
    return asyncio.Event()


@pytest.fixture
def mock_openrouter(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock = AsyncMock(return_value=("Hello!", ""))
    monkeypatch.setattr("app.engine.call_openrouter", mock)
    return mock


@pytest.fixture
def mock_claude_code(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock = AsyncMock(return_value="Hello from Claude!")
    monkeypatch.setattr("app.engine.call_claude_code", mock)
    return mock


@pytest.fixture
def mock_codex(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock = AsyncMock(return_value="Hello from Codex!")
    monkeypatch.setattr("app.engine.call_codex", mock)
    return mock
