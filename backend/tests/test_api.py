import json
import shutil

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
    """GET /settings returns an empty object when no file has been saved yet."""
    monkeypatch.setattr("lmparlor.main.SETTINGS_PATH", tmp_path / ".cache" / "settings.json")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/settings")
    assert response.status_code == 200
    assert response.json() == {}


async def test_post_settings_writes_file_and_returns_body(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """POST /settings persists the body to .cache/settings.json."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("lmparlor.main.SETTINGS_PATH", settings_path)
    payload = {
        "chatbot_a": {
            "name": "Alpha",
            "model": "model-a",
            "system_prompt": "Prompt A",
            "provider": "openrouter",
        },
        "chatbot_b": {
            "name": "Beta",
            "model": "model-b",
            "system_prompt": "Prompt B",
            "provider": "codex",
        },
        "shared_system_prompt": "Shared prompt",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/settings", json=payload)

    assert response.status_code == 200
    assert response.json() == payload
    assert settings_path.exists()
    assert json.loads(settings_path.read_text()) == payload


async def test_get_settings_returns_saved_settings(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """GET /settings returns the saved settings payload."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("lmparlor.main.SETTINGS_PATH", settings_path)
    payload = {
        "chatbot_a": {
            "name": "Alpha",
            "model": "model-a",
            "system_prompt": "Prompt A",
            "provider": "openrouter",
        },
        "chatbot_b": {
            "name": "Beta",
            "model": "model-b",
            "system_prompt": "Prompt B",
            "provider": "claude_code",
        },
        "shared_system_prompt": "Shared prompt",
    }
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings_path.write_text(json.dumps(payload))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/settings")

    assert response.status_code == 200
    assert response.json() == payload


async def test_get_sessions_returns_empty_list_when_none_exist(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """GET /sessions returns an empty list when no sessions have been saved."""
    sessions_dir = tmp_path / "sessions"
    monkeypatch.setattr("lmparlor.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/sessions")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_sessions_returns_saved_sessions(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """GET /sessions returns all saved session files ordered by mtime descending."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session1 = {
        "id": "session-1",
        "label": "First Session",
        "config": {},
        "messages": [],
        "doneReason": "max_turns",
        "error": None,
    }
    session2 = {
        "id": "session-2",
        "label": "Second Session",
        "config": {},
        "messages": [],
        "doneReason": "stopped",
        "error": None,
    }

    (sessions_dir / "session-1.json").write_text(json.dumps(session1))
    (sessions_dir / "session-2.json").write_text(json.dumps(session2))

    monkeypatch.setattr("lmparlor.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/sessions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ids = [s["id"] for s in data]
    assert "session-1" in ids
    assert "session-2" in ids


async def test_patch_sessions_renames_session(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """PATCH /sessions/{id} updates the label field in the session file."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session_data = {
        "id": "test-session",
        "label": "Original Label",
        "config": {},
        "messages": [],
        "doneReason": "max_turns",
        "error": None,
    }
    session_file = sessions_dir / "test-session.json"
    session_file.write_text(json.dumps(session_data))

    monkeypatch.setattr("lmparlor.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch("/sessions/test-session", json={"label": "New Label"})

    assert response.status_code == 200
    assert response.json()["label"] == "New Label"
    assert json.loads(session_file.read_text())["label"] == "New Label"


async def test_patch_sessions_returns_404_for_missing_session(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """PATCH /sessions/{id} returns 404 when session file doesn't exist."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("lmparlor.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch("/sessions/nonexistent", json={"label": "New Label"})

    assert response.status_code == 404


async def test_patch_sessions_rejects_empty_label(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """PATCH /sessions/{id} returns 422 when label is empty."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session_data = {
        "id": "test-session",
        "label": "Original Label",
        "config": {},
        "messages": [],
        "doneReason": "max_turns",
        "error": None,
    }
    (sessions_dir / "test-session.json").write_text(json.dumps(session_data))

    monkeypatch.setattr("lmparlor.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch("/sessions/test-session", json={"label": "  "})

    assert response.status_code == 422
