import pytest
from pydantic import ValidationError

from lmparlor.models import ChatbotConfig, Message, SessionConfig, Settings


def test_chatbot_config_valid_providers():
    """ChatbotConfig accepts all valid provider literals."""
    for provider in ("openrouter", "claude_code", "codex"):
        config = ChatbotConfig(name="A", model="m", system_prompt="s", provider=provider)
        assert config.provider == provider


def test_chatbot_config_default_provider():
    """ChatbotConfig defaults to openrouter provider."""
    config = ChatbotConfig(name="A", model="m", system_prompt="s")
    assert config.provider == "openrouter"


def test_chatbot_config_invalid_provider():
    """ChatbotConfig rejects unknown provider values."""
    with pytest.raises(ValidationError):
        ChatbotConfig(name="A", model="m", system_prompt="s", provider="unknown")


def test_session_config_default_max_turns():
    """SessionConfig defaults max_turns to 50."""
    a = ChatbotConfig(name="A", model="m", system_prompt="s")
    b = ChatbotConfig(name="B", model="m", system_prompt="s")
    config = SessionConfig(chatbot_a=a, chatbot_b=b, shared_system_prompt="")
    assert config.max_turns == 50


def test_session_config_custom_max_turns():
    """SessionConfig accepts custom max_turns."""
    a = ChatbotConfig(name="A", model="m", system_prompt="s")
    b = ChatbotConfig(name="B", model="m", system_prompt="s")
    config = SessionConfig(chatbot_a=a, chatbot_b=b, shared_system_prompt="", max_turns=10)
    assert config.max_turns == 10


def test_message_thinking_default_empty():
    """Message thinking field defaults to empty string."""
    msg = Message(chatbot="a", name="A", model="m", content="hi", turn=0)
    assert msg.thinking == ""


def test_message_model_dump_shape():
    """Message.model_dump() contains all expected keys."""
    msg = Message(chatbot="b", name="B", model="gpt-4o", content="hello", turn=1, thinking="thought")
    data = msg.model_dump()
    assert set(data.keys()) == {"chatbot", "name", "model", "content", "turn", "thinking"}
    assert data["chatbot"] == "b"
    assert data["thinking"] == "thought"


def test_message_invalid_chatbot():
    """Message rejects chatbot values other than 'a' or 'b'."""
    with pytest.raises(ValidationError):
        Message(chatbot="c", name="C", model="m", content="hi", turn=0)


def test_settings_accepts_session_shape():
    """Settings accepts the same fields as the setup form payload."""
    a = ChatbotConfig(name="A", model="m1", system_prompt="sa")
    b = ChatbotConfig(name="B", model="m2", system_prompt="sb", provider="codex")
    settings = Settings(chatbot_a=a, chatbot_b=b, shared_system_prompt="shared")
    assert settings.chatbot_a.name == "A"
    assert settings.chatbot_b.provider == "codex"
