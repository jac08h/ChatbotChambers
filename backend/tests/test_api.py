import json
import shutil

import pytest
from app.main import _cors_origins_from_env, _session_path, app
from app.models import CLAUDE_CODE_MODELS, CODEX_MODELS, LITELLM_PROVIDERS
from httpx import ASGITransport, AsyncClient


async def test_get_models_default_returns_openrouter_models():
    """GET /models without provider param returns openrouter models."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(
        model_id in ids for model_id, _ in LITELLM_PROVIDERS["openrouter"]["models"]
    )


def test_cors_origins_from_env_default(monkeypatch: pytest.MonkeyPatch):
    """No CORS env var falls back to the Vite dev server origin."""
    monkeypatch.delenv("CHATBOTCHAMBERS_CORS_ORIGINS", raising=False)
    assert _cors_origins_from_env() == ["http://localhost:5173"]


def test_cors_origins_from_env_multiple(monkeypatch: pytest.MonkeyPatch):
    """Comma-separated CORS origins are trimmed and preserved."""
    monkeypatch.setenv(
        "CHATBOTCHAMBERS_CORS_ORIGINS",
        " http://localhost:5173 , https://chatbotchambers.example ",
    )
    assert _cors_origins_from_env() == [
        "http://localhost:5173",
        "https://chatbotchambers.example",
    ]


async def test_get_models_github_copilot_explicit():
    """GET /models?provider=github_copilot returns github_copilot models."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models?provider=github_copilot")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == len(LITELLM_PROVIDERS["github_copilot"]["models"])


async def test_get_models_claude_code():
    """GET /models?provider=claude_code returns claude code models."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models?provider=claude_code")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(model_id in ids for model_id, _ in CLAUDE_CODE_MODELS)


async def test_get_models_codex():
    """GET /models?provider=codex returns codex models."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models?provider=codex")
    assert response.status_code == 200
    data = response.json()
    ids = [m["id"] for m in data]
    assert all(model_id in ids for model_id, _ in CODEX_MODELS)


async def test_get_models_response_shape():
    """Each model entry has 'id' and 'name' keys."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models")
    for entry in response.json():
        assert "id" in entry
        assert "name" in entry


async def test_get_providers_returns_provider_info(
    monkeypatch: pytest.MonkeyPatch,
):
    """GET /providers returns availability and docs_url per provider."""
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/providers")
    assert response.status_code == 200
    data = response.json()
    assert data["openrouter"]["available"] is False
    assert "docs_url" in data["openrouter"]
    assert data["github_copilot"]["available"] is True


async def test_get_providers_claude_code_available_when_cli_found(
    monkeypatch: pytest.MonkeyPatch,
):
    """GET /providers returns claude_code available when 'claude' CLI is on PATH."""
    monkeypatch.setattr(
        shutil, "which", lambda name: "/usr/bin/claude" if name == "claude" else None
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/providers")
    assert response.json()["claude_code"]["available"] is True


async def test_get_providers_claude_code_unavailable_when_cli_missing(
    monkeypatch: pytest.MonkeyPatch,
):
    """GET /providers returns claude_code unavailable when 'claude' CLI not found."""
    monkeypatch.setattr(shutil, "which", lambda name: None)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/providers")
    assert response.json()["claude_code"]["available"] is False
    assert response.json()["codex"]["available"] is False


async def test_get_scenarios_seeds_cache_from_bundled_defaults(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /scenarios copies bundled scenarios into .cache/scenarios when none exist yet."""
    bundled_scenarios_dir = tmp_path / "bundled-scenarios"
    bundled_scenarios_dir.mkdir(parents=True, exist_ok=True)
    bundled_scenario = bundled_scenarios_dir / "debate.json"
    bundled_scenario.write_text(
        json.dumps(
            {
                "name": "Debate",
                "shared_system_prompt": "Shared",
                "system_prompt_a": "A",
                "system_prompt_b": "B",
            }
        )
    )

    scenarios_dir = tmp_path / ".cache" / "scenarios"
    monkeypatch.setattr("app.main.DEFAULT_SCENARIOS_DIR", bundled_scenarios_dir)
    monkeypatch.setattr("app.main.SCENARIOS_DIR", scenarios_dir)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/scenarios")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "debate",
            "name": "Debate",
            "shared_system_prompt": "Shared",
            "system_prompt_a": "A",
            "system_prompt_b": "B",
        }
    ]
    assert json.loads((scenarios_dir / "debate.json").read_text())["name"] == "Debate"


async def test_get_scenarios_returns_saved_config(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /scenarios includes persisted full configs for user-saved scenarios."""
    scenarios_dir = tmp_path / ".cache" / "scenarios"
    scenarios_dir.mkdir(parents=True, exist_ok=True)
    scenario_payload = {
        "name": "Saved scenario",
        "config": {
            "chatbot_a": {
                "name": "Alpha",
                "model": "model-a",
                "system_prompt": "Prompt A",
                "provider": "openai",
            },
            "chatbot_b": {
                "name": "Beta",
                "model": "model-b",
                "system_prompt": "Prompt B",
                "provider": "codex",
            },
            "shared_system_prompt": "Shared prompt",
        },
    }
    (scenarios_dir / "saved-scenario.json").write_text(json.dumps(scenario_payload))

    monkeypatch.setattr("app.main.DEFAULT_SCENARIOS_DIR", tmp_path / "unused-defaults")
    monkeypatch.setattr("app.main.SCENARIOS_DIR", scenarios_dir)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/scenarios")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "saved-scenario",
            "name": "Saved scenario",
            "shared_system_prompt": "Shared prompt",
            "system_prompt_a": "Prompt A",
            "system_prompt_b": "Prompt B",
            "config": scenario_payload["config"],
        }
    ]


async def test_post_scenarios_writes_file_and_returns_body(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """POST /scenarios persists a user scenario to .cache/scenarios."""
    scenarios_dir = tmp_path / ".cache" / "scenarios"
    monkeypatch.setattr("app.main.DEFAULT_SCENARIOS_DIR", tmp_path / "unused-defaults")
    monkeypatch.setattr("app.main.SCENARIOS_DIR", scenarios_dir)
    payload = {
        "name": "My scenario",
        "config": {
            "chatbot_a": {
                "name": "Alpha",
                "model": "model-a",
                "system_prompt": "Prompt A",
                "provider": "github_copilot",
            },
            "chatbot_b": {
                "name": "Beta",
                "model": "model-b",
                "system_prompt": "Prompt B",
                "provider": "claude_code",
            },
            "shared_system_prompt": "Shared prompt",
        },
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/scenarios", json=payload)

    assert response.status_code == 201
    result = response.json()
    assert result["id"] == "my-scenario"
    assert result["name"] == "My scenario"
    assert result["shared_system_prompt"] == "Shared prompt"
    assert result["system_prompt_a"] == "Prompt A"
    assert result["system_prompt_b"] == "Prompt B"
    assert result["config"]["chatbot_a"]["name"] == "Alpha"
    assert result["config"]["chatbot_b"]["name"] == "Beta"
    scenario_path = scenarios_dir / "my-scenario.json"
    assert scenario_path.exists()
    saved_scenario = json.loads(scenario_path.read_text())
    assert saved_scenario["name"] == result["name"]
    assert saved_scenario["config"] == result["config"]


async def test_patch_scenarios_renames_existing_scenario(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """PATCH /scenarios/{id} renames a persisted scenario without changing its id."""
    scenarios_dir = tmp_path / ".cache" / "scenarios"
    scenarios_dir.mkdir(parents=True, exist_ok=True)
    scenario_path = scenarios_dir / "my-scenario.json"
    scenario_path.write_text(
        json.dumps(
            {
                "name": "My scenario",
                "config": {
                    "chatbot_a": {
                        "name": "Alpha",
                        "model": "model-a",
                        "system_prompt": "Prompt A",
                        "provider": "openai",
                    },
                    "chatbot_b": {
                        "name": "Beta",
                        "model": "model-b",
                        "system_prompt": "Prompt B",
                        "provider": "claude_code",
                    },
                    "shared_system_prompt": "Shared prompt",
                },
            }
        )
    )
    monkeypatch.setattr("app.main.DEFAULT_SCENARIOS_DIR", tmp_path / "unused-defaults")
    monkeypatch.setattr("app.main.SCENARIOS_DIR", scenarios_dir)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.patch(
            "/scenarios/my-scenario", json={"name": "Renamed scenario"}
        )

    assert response.status_code == 200
    assert response.json()["id"] == "my-scenario"
    assert response.json()["name"] == "Renamed scenario"
    assert json.loads(scenario_path.read_text())["name"] == "Renamed scenario"


async def test_delete_scenarios_removes_existing_scenario(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /scenarios/{id} removes a persisted scenario from .cache/scenarios."""
    scenarios_dir = tmp_path / ".cache" / "scenarios"
    scenarios_dir.mkdir(parents=True, exist_ok=True)
    scenario_path = scenarios_dir / "my-scenario.json"
    scenario_path.write_text(json.dumps({"name": "My scenario"}))
    monkeypatch.setattr("app.main.DEFAULT_SCENARIOS_DIR", tmp_path / "unused-defaults")
    monkeypatch.setattr("app.main.SCENARIOS_DIR", scenarios_dir)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/scenarios/my-scenario")

    assert response.status_code == 204
    assert not scenario_path.exists()


async def test_get_settings_returns_empty_object_when_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /settings returns an empty object when no file has been saved yet."""
    monkeypatch.setattr("app.main.SETTINGS_PATH", tmp_path / ".cache" / "settings.json")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/settings")
    assert response.status_code == 200
    assert response.json() == {}


async def test_post_settings_writes_file_and_returns_body(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """POST /settings persists the body to .cache/settings.json."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("app.main.SETTINGS_PATH", settings_path)
    payload = {
        "chatbot_a": {
            "name": "Alpha",
            "model": "model-a",
            "system_prompt": "Prompt A",
            "provider": "github_copilot",
        },
        "chatbot_b": {
            "name": "Beta",
            "model": "model-b",
            "system_prompt": "Prompt B",
            "provider": "codex",
        },
        "shared_system_prompt": "Shared prompt",
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/settings", json=payload)

    assert response.status_code == 200
    result = response.json()
    assert result["chatbot_a"]["name"] == "Alpha"
    assert result["chatbot_a"]["enable_thinking"] is False
    assert result["chatbot_b"]["name"] == "Beta"
    assert result["shared_system_prompt"] == "Shared prompt"
    assert settings_path.exists()
    assert json.loads(settings_path.read_text()) == result


async def test_get_settings_returns_saved_settings(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /settings returns the saved settings payload."""
    settings_path = tmp_path / ".cache" / "settings.json"
    monkeypatch.setattr("app.main.SETTINGS_PATH", settings_path)
    payload = {
        "chatbot_a": {
            "name": "Alpha",
            "model": "model-a",
            "system_prompt": "Prompt A",
            "provider": "openai",
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

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/settings")

    assert response.status_code == 200
    result = response.json()
    assert result["chatbot_a"]["name"] == "Alpha"
    assert result["chatbot_b"]["name"] == "Beta"
    assert result["shared_system_prompt"] == "Shared prompt"


async def test_get_sessions_returns_empty_list_when_none_exist(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /sessions returns an empty list when no sessions have been saved."""
    sessions_dir = tmp_path / "sessions"
    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/sessions")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_sessions_returns_saved_sessions(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /sessions returns all saved session files ordered by mtime descending."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session1 = {
        "id": "session-1",
        "title": "First Session",
        "config": {},
        "messages": [],
        "doneReason": "leave:a",
        "error": None,
    }
    session2 = {
        "id": "session-2",
        "title": None,
        "config": {},
        "messages": [],
        "doneReason": "stopped",
        "error": None,
    }

    (sessions_dir / "session-1.json").write_text(json.dumps(session1))
    (sessions_dir / "session-2.json").write_text(json.dumps(session2))

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/sessions")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "session-2"
    assert data[0]["title"] is None
    assert data[1]["id"] == "session-1"
    assert data[1]["title"] == "First Session"


async def test_patch_sessions_renames_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """PATCH /sessions/{id} updates the label field in the session file."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session_data = {
        "id": "test-session",
        "title": "Original Title",
        "config": {},
        "messages": [],
        "doneReason": "leave:a",
        "error": None,
    }
    session_file = sessions_dir / "test-session.json"
    session_file.write_text(json.dumps(session_data))

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.patch(
            "/sessions/test-session", json={"title": "New Title"}
        )

    assert response.status_code == 200
    assert response.json()["title"] == "New Title"
    assert json.loads(session_file.read_text())["title"] == "New Title"


async def test_patch_sessions_returns_404_for_missing_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """PATCH /sessions/{id} returns 404 when session file doesn't exist."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.patch(
            "/sessions/nonexistent", json={"title": "New Title"}
        )

    assert response.status_code == 404


def test_session_path_rejects_path_traversal(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """Session ids with traversal characters are rejected before path resolution."""
    sessions_dir = tmp_path / "sessions"
    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)

    with pytest.raises(ValueError, match="Invalid session id"):
        _session_path("../../etc/passwd")


async def test_patch_sessions_rejects_empty_label(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """PATCH /sessions/{id} returns 422 when label is empty."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    session_data = {
        "id": "test-session",
        "title": "Original Title",
        "config": {},
        "messages": [],
        "doneReason": "leave:a",
        "error": None,
    }
    (sessions_dir / "test-session.json").write_text(json.dumps(session_data))

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.patch("/sessions/test-session", json={"title": "  "})

    assert response.status_code == 422


async def test_patch_sessions_rejects_invalid_session_id(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """PATCH /sessions/{id} returns 422 for invalid session ids."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.patch("/sessions/%2E%2E", json={"title": "New Title"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid session id"


async def test_get_sessions_maps_legacy_label_to_title(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """GET /sessions converts legacy label-only records into title responses."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    (sessions_dir / "legacy.json").write_text(
        json.dumps(
            {
                "id": "legacy",
                "label": "Custom legacy title",
                "config": {},
                "messages": [],
                "doneReason": "stopped",
                "error": None,
            }
        )
    )

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/sessions")

    assert response.status_code == 200
    assert response.json()[0]["title"] == "Custom legacy title"


async def test_delete_sessions_removes_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /sessions/{id} removes the persisted session file."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    session_file = sessions_dir / "test-session.json"
    session_file.write_text(json.dumps({"id": "test-session"}))

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/sessions/test-session")

    assert response.status_code == 204
    assert not session_file.exists()


async def test_delete_sessions_returns_404_for_missing_session(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /sessions/{id} returns 404 when session file doesn't exist."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/sessions/nonexistent")

    assert response.status_code == 404


async def test_delete_sessions_rejects_invalid_session_id(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /sessions/{id} returns 422 for invalid session ids."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/sessions/%2E%2E")

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid session id"


async def test_delete_all_sessions_removes_all_files(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /sessions removes all session files."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    (sessions_dir / "session-1.json").write_text(json.dumps({"id": "session-1"}))
    (sessions_dir / "session-2.json").write_text(json.dumps({"id": "session-2"}))

    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/sessions")

    assert response.status_code == 204
    assert list(sessions_dir.glob("*.json")) == []


async def test_delete_all_sessions_succeeds_when_empty(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """DELETE /sessions returns 204 even when no sessions exist."""
    sessions_dir = tmp_path / "sessions"
    monkeypatch.setattr("app.main.SESSIONS_DIR", sessions_dir)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/sessions")

    assert response.status_code == 204
