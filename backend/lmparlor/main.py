import asyncio
import json
import logging
import os
from pathlib import Path
import re
import shutil
from typing import List
from uuid import uuid4

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from lmparlor.engine import EmptyMessage, Generating, run_conversation
from lmparlor.models import (
    CLAUDE_CODE_MODELS,
    CODEX_MODELS,
    MODELS,
    PresetCreateRequest,
    RenameRequest,
    SessionConfig,
    Settings,
)

PRESET_ID_PATTERN = r"[a-z0-9]+(?:-[a-z0-9]+)*"
SESSION_ID_PATTERN = r"[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*"
REPO_ROOT = Path(__file__).parent.parent.parent
DEFAULT_PRESETS_DIR = Path(__file__).parent / "presets"
PRESETS_DIR = Path(os.environ.get("LMPARLOR_PRESETS_DIR", str(REPO_ROOT / ".cache/presets")))
SETTINGS_PATH = Path(os.environ.get("LMPARLOR_SETTINGS_PATH", str(REPO_ROOT / ".cache/settings.json")))
SESSIONS_DIR = Path(os.environ.get("LMPARLOR_SESSIONS_DIR", str(REPO_ROOT / ".cache/sessions")))


def _cors_origins_from_env() -> List[str]:
    raw_value = os.environ.get("CHATBOTCHAMBERS_CORS_ORIGINS", "")
    return [origin for origin in (item.strip() for item in raw_value.split(",")) if origin]

def _new_session_id() -> str:
    return str(uuid4())


def _normalize_session_data(data: dict) -> dict:
    title = data.get("title")
    legacy_label = data.get("label")
    if title is None and legacy_label and legacy_label != data.get("id"):
        title = legacy_label

    normalized = {
        "id": data["id"],
        "title": title,
        "config": data.get("config", {}),
        "messages": data.get("messages", []),
        "doneReason": data.get("doneReason"),
        "error": data.get("error"),
    }
    return normalized


def _ensure_presets_dir() -> None:
    PRESETS_DIR.mkdir(parents=True, exist_ok=True)
    if any(PRESETS_DIR.glob("*.json")):
        return
    for source_path in sorted(DEFAULT_PRESETS_DIR.glob("*.json")):
        shutil.copy2(source_path, PRESETS_DIR / source_path.name)


def _normalize_preset_data(preset_id: str, data: dict) -> dict:
    config = data.get("config")
    normalized = {
        "id": preset_id,
        "name": data["name"],
        "shared_system_prompt": data.get(
            "shared_system_prompt",
            config.get("shared_system_prompt", "") if config else "",
        ),
        "system_prompt_a": data.get(
            "system_prompt_a",
            config.get("chatbot_a", {}).get("system_prompt", "") if config else "",
        ),
        "system_prompt_b": data.get(
            "system_prompt_b",
            config.get("chatbot_b", {}).get("system_prompt", "") if config else "",
        ),
    }
    if config:
        normalized["config"] = config
    return normalized


def _new_preset_id(name: str) -> str:
    base_slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "preset"
    base_slug = re.sub(r"-+", "-", base_slug)
    candidate = base_slug
    suffix = 2
    while _preset_path(candidate).exists():
        candidate = base_slug + "-" + str(suffix)
        suffix += 1
    return candidate


def _preset_path(preset_id: str) -> Path:
    if re.fullmatch(PRESET_ID_PATTERN, preset_id) is None:
        raise ValueError("Invalid preset id")
    presets_root = PRESETS_DIR.resolve()
    path = (presets_root / (preset_id + ".json")).resolve()
    if path.parent != presets_root:
        raise ValueError("Invalid preset path")
    return path


def _session_path(session_id: str) -> Path:
    if re.fullmatch(SESSION_ID_PATTERN, session_id) is None:
        raise ValueError("Invalid session id")
    sessions_root = SESSIONS_DIR.resolve()
    path = (sessions_root / (session_id + ".json")).resolve()
    if path.parent != sessions_root:
        raise ValueError("Invalid session path")
    return path

logger = logging.getLogger(__name__)

app = FastAPI()
cors_origins = _cors_origins_from_env()
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/presets")
def get_presets() -> List[dict]:
    _ensure_presets_dir()
    presets = []
    for path in sorted(PRESETS_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text())
            presets.append(_normalize_preset_data(path.stem, data))
        except (OSError, json.JSONDecodeError, KeyError):
            logger.warning("Failed to load preset %s", path.name)
    return presets


@app.post("/presets", status_code=201)
def save_preset(request: PresetCreateRequest) -> dict:
    preset_name = request.name.strip()
    if not preset_name:
        raise HTTPException(status_code=422, detail="name must not be empty")
    try:
        _ensure_presets_dir()
        preset_id = _new_preset_id(preset_name)
        data = {
            "name": preset_name,
            "config": request.config.model_dump(),
        }
        path = _preset_path(preset_id)
        path.write_text(json.dumps(data))
        return _normalize_preset_data(preset_id, data)
    except OSError as exc:
        logger.exception("Failed to save preset %s", preset_name)
        raise HTTPException(status_code=500, detail="Failed to save preset") from exc


@app.get("/providers")
def get_providers() -> dict:
    return {
        "openrouter": True,
        "claude_code": shutil.which("claude") is not None,
        "codex": shutil.which("codex") is not None,
    }


@app.get("/models")
def get_models(provider: str = "openrouter") -> List[dict]:
    if provider == "claude_code":
        model_list = CLAUDE_CODE_MODELS
    elif provider == "codex":
        model_list = CODEX_MODELS
    else:
        model_list = MODELS
    return [{"id": model_id, "name": name} for model_id, name in model_list]


@app.get("/settings")
def get_settings() -> dict:
    if not SETTINGS_PATH.exists():
        return {}
    try:
        return json.loads(SETTINGS_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        logger.exception("Failed to load settings")
        return {}


@app.post("/settings")
def save_settings(settings: Settings) -> dict:
    try:
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(json.dumps(settings.model_dump()))
    except OSError as exc:
        logger.exception("Failed to save settings")
        raise HTTPException(status_code=500, detail="Failed to save settings") from exc
    return settings.model_dump()


@app.get("/sessions")
def get_sessions() -> List[dict]:
    if not SESSIONS_DIR.exists():
        return []
    sessions = []
    for path in sorted(SESSIONS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            sessions.append(_normalize_session_data(json.loads(path.read_text())))
        except (OSError, json.JSONDecodeError):
            logger.warning("Failed to load session %s", path.name)
    return sessions


@app.patch("/sessions/{session_id}")
def rename_session(session_id: str, request: RenameRequest) -> dict:
    try:
        path = _session_path(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid session id") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        data = json.loads(path.read_text())
        new_title = request.title.strip()
        if not new_title:
            raise HTTPException(status_code=422, detail="title must not be empty")
        data["title"] = new_title
        path.write_text(json.dumps(data))
        return _normalize_session_data(data)
    except (OSError, json.JSONDecodeError) as exc:
        logger.exception("Failed to rename session %s", session_id)
        raise HTTPException(status_code=500, detail="Failed to rename session") from exc


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> None:
    try:
        path = _session_path(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid session id") from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        path.unlink()
    except OSError as exc:
        logger.exception("Failed to delete session %s", session_id)
        raise HTTPException(status_code=500, detail="Failed to delete session") from exc


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    data = await ws.receive_json()
    if data.get("type") != "start":
        await ws.send_json({"type": "error", "message": "Expected start message"})
        await ws.close()
        return

    config = SessionConfig(**data["config"])
    uses_openrouter = (
        config.chatbot_a.provider == "openrouter"
        or config.chatbot_b.provider == "openrouter"
    )
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if uses_openrouter and not api_key:
        await ws.send_json({"type": "error", "message": "OPENROUTER_API_KEY not set"})
        await ws.close()
        return

    session_id = _new_session_id()
    await ws.send_json({"type": "session_id", "id": session_id})

    _save_session(session_id, config, [], None, None)

    pause_event = asyncio.Event()
    pause_event.set()
    stop_event = asyncio.Event()
    cancel_event = asyncio.Event()

    engine_task = asyncio.create_task(
        _run_engine(ws, config, api_key, pause_event, stop_event, cancel_event, session_id)
    )
    listener_task = asyncio.create_task(
        _run_listener(ws, pause_event, stop_event, cancel_event)
    )

    done, pending = await asyncio.wait(
        [engine_task, listener_task],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass


async def _run_engine(
    ws: WebSocket,
    config: SessionConfig,
    api_key: str,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
    cancel_event: asyncio.Event,
    session_id: str,
) -> None:
    messages = []
    done_reason = None
    error_message = None
    try:
        last_message = None
        async for event in run_conversation(config, api_key, pause_event, stop_event, cancel_event):
            if isinstance(event, Generating):
                await ws.send_json({"type": "generating", "chatbot": event.chatbot})
            elif isinstance(event, EmptyMessage):
                pause_event.clear()
                await ws.send_json({"type": "empty_message", "chatbot": event.chatbot})
            else:
                last_message = event
                messages.append(event.model_dump())
                await ws.send_json({"type": "message", "data": event.model_dump()})

        if stop_event.is_set():
            done_reason = "stopped"
            await ws.send_json({"type": "done", "reason": "stopped"})
        elif last_message and last_message.content.strip() == "/leave":
            done_reason = "leave:%s" % last_message.chatbot
            await ws.send_json({"type": "done", "reason": "leave", "chatbot": last_message.chatbot})
        else:
            done_reason = "stopped"
            await ws.send_json({"type": "done", "reason": "stopped"})
    except asyncio.CancelledError:
        done_reason = "stopped"
        try:
            await ws.send_json({"type": "done", "reason": "stopped"})
        except Exception:
            pass
    except WebSocketDisconnect:
        done_reason = "stopped"
        stop_event.set()
    except Exception as e:
        logger.exception("Engine error")
        error_message = str(e)
        try:
            await ws.send_json({"type": "error", "message": error_message})
        except Exception:
            pass
    finally:
        _save_session(session_id, config, messages, done_reason, error_message)


def _save_session(
    session_id: str,
    config: SessionConfig,
    messages: List[dict],
    done_reason: str | None,
    error: str | None,
) -> None:
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path = _session_path(session_id)
        data = {
            "id": session_id,
            "title": None,
            "config": config.model_dump(),
            "messages": messages,
            "doneReason": done_reason,
            "error": error,
        }
        path.write_text(json.dumps(data))
    except OSError:
        logger.exception("Failed to save session %s", session_id)


async def _run_listener(
    ws: WebSocket,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
    cancel_event: asyncio.Event,
) -> None:
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")
            if msg_type == "pause":
                pause_event.clear()
                cancel_event.set()
            elif msg_type == "resume":
                pause_event.set()
            elif msg_type == "retry":
                pause_event.set()
            elif msg_type == "stop":
                stop_event.set()
                pause_event.set()
                cancel_event.set()
                return
    except WebSocketDisconnect:
        stop_event.set()
        pause_event.set()
