import json
import shutil
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from lmparlor.main import app
from lmparlor.models import CLAUDE_CODE_MODELS, CODEX_MODELS, MODELS


async def test_get_models_default_returns_openrouter_models():
    """GET /models without provider param returns openrouter models."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/models")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(model_id in ids for model_id, _ in MODELS)


async def test_get_models_openrouter_explicit():
    """GET /models?provider=openrouter returns openrouter models."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/models?provider=openrouter")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(MODELS)


async def test_get_models_claude_code():
    """GET /models?provider=claude_code returns claude code models."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/models?provider=claude_code")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(model_id in ids for model_id, _ in CLAUDE_CODE_MODELS)


async def test_get_models_codex():
    """GET /models?provider=codex returns codex models."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/models?provider=codex")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(model_id in ids for model_id, _ in CODEX_MODELS)


async def test_get_models_response_shape():
    """Each model entry has 'id' and 'name' keys."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/models")
    for entry in response.json():
        assert "id" in entry
        assert "name" in entry


async def test_get_providers_openrouter_always_available():
    """GET /providers always returns openrouter: true."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/providers")
    assert response.status_code == 200
    assert response.json()["openrouter"] is True


async def test_get_providers_claude_code_available_when_cli_found(monkeypatch: pytest.MonkeyPatch):
    """GET /providers returns claude_code: true when 'claude' CLI is on PATH."""
    monkeypatch.setattr(shutil, "which", lambda name: "/usr/bin/claude" if name == "claude" else None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/providers")
    assert response.json()["claude_code"] is True


async def test_get_providers_claude_code_unavailable_when_cli_missing(monkeypatch: pytest.MonkeyPatch):
    """GET /providers returns claude_code: false when 'claude' CLI not found."""
    monkeypatch.setattr(shutil, "which", lambda name: None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/providers")
    assert response.json()["claude_code"] is False
    assert response.json()["codex"] is False


async def test_get_presets_returns_list():
    """GET /presets returns a non-empty list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/presets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


async def test_get_presets_each_has_id():
    """Each preset has an 'id' field derived from the filename."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/presets")
    for preset in response.json():
        assert "id" in preset


async def test_get_settings_returns_empty_object_when_missing(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """GET /settings returns {} when the settings file does not exist."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("lmparlor.main.SETTINGS_PATH", settings_path)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/settings")
    assert response.status_code == 200
    assert response.json() == {}


async def test_post_settings_writes_file_and_get_returns_saved_settings(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """POST /settings persists settings and GET /settings returns them."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("lmparlor.main.SETTINGS_PATH", settings_path)
    payload = {
        "chatbot_a": {
            "name": "Alice",
            "model": "model-a",
            "system_prompt": "Prompt A",
            "provider": "openrouter",
        },
        "chatbot_b": {
            "name": "Bob",
            "model": "model-b",
            "system_prompt": "Prompt B",
            "provider": "codex",
        },
        "shared_system_prompt": "Shared prompt",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        post_response = await client.post("/settings", json=payload)
        get_response = await client.get("/settings")

    assert post_response.status_code == 200
    assert get_response.status_code == 200
    assert settings_path.exists()
    assert json.loads(settings_path.read_text()) == payload
    assert get_response.json() == payload
