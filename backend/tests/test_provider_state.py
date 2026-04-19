import pytest

from app.provider_state import (
    PROVIDER_CACHE_CAPABILITIES,
    ProviderState,
    create_provider_state,
    get_capabilities,
)


def test_all_providers_have_capabilities():
    """All known providers have cache capability entries."""
    for provider in ("openrouter", "github_copilot", "claude_code", "codex", "mock"):
        caps = get_capabilities(provider)
        assert "cache_type" in caps
        assert "supports_resume" in caps


def test_unknown_provider_returns_none_capabilities():
    """Unknown provider returns default no-cache capabilities."""
    caps = get_capabilities("nonexistent")
    assert caps["cache_type"] == "none"
    assert caps["supports_resume"] is False


def test_cli_providers_support_resume():
    """Claude Code and Codex support session resume."""
    assert get_capabilities("claude_code")["supports_resume"] is True
    assert get_capabilities("codex")["supports_resume"] is True


def test_litellm_providers_use_prefix_cache():
    """OpenRouter and GitHub Copilot use prefix caching."""
    assert get_capabilities("openrouter")["cache_type"] == "prefix"
    assert get_capabilities("github_copilot")["cache_type"] == "prefix"


def test_create_provider_state_mock():
    """Mock provider creates state without storage path."""
    state = create_provider_state("mock")
    assert state.provider == "mock"
    assert state.session_id is None
    assert state.initialized is False
    assert state.storage_path is None


def test_create_provider_state_cli_creates_storage(tmp_path, monkeypatch):
    """CLI providers get a storage path set."""
    monkeypatch.setattr("app.provider_state.PROVIDER_SESSIONS_DIR", tmp_path)
    state = create_provider_state("claude_code")
    assert state.provider == "claude_code"
    assert state.storage_path is not None
    assert "claude_code" in state.storage_path


def test_provider_state_to_dict():
    """ProviderState serializes to dict."""
    state = ProviderState(
        provider="claude_code",
        session_id="sess-1",
        initialized=True,
        storage_path="/some/path",
        metadata={"key": "value"},
    )
    data = state.to_dict()
    assert data["provider"] == "claude_code"
    assert data["session_id"] == "sess-1"
    assert data["initialized"] is True
    assert data["storage_path"] == "/some/path"
    assert data["metadata"] == {"key": "value"}


def test_provider_state_from_dict():
    """ProviderState deserializes from dict."""
    data = {
        "provider": "codex",
        "session_id": "sess-2",
        "initialized": True,
        "storage_path": "/other/path",
        "metadata": {"count": 42},
    }
    state = ProviderState.from_dict(data)
    assert state.provider == "codex"
    assert state.session_id == "sess-2"
    assert state.initialized is True
    assert state.storage_path == "/other/path"
    assert state.metadata == {"count": 42}


def test_provider_state_roundtrip():
    """ProviderState survives to_dict/from_dict roundtrip."""
    original = ProviderState(
        provider="claude_code",
        session_id="abc",
        initialized=True,
        storage_path="/tmp/test",
        metadata={"cache_hits": 5},
    )
    restored = ProviderState.from_dict(original.to_dict())
    assert restored.provider == original.provider
    assert restored.session_id == original.session_id
    assert restored.initialized == original.initialized
    assert restored.storage_path == original.storage_path
    assert restored.metadata == original.metadata
