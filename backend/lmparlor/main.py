import asyncio
import json
import logging
import os
import random
from pathlib import Path
import shutil
from typing import List

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from lmparlor.engine import Generating, run_conversation
from lmparlor.models import CLAUDE_CODE_MODELS, CODEX_MODELS, MODELS, RenameRequest, SessionConfig, Settings

PRESETS_DIR = Path(__file__).parent / "presets"
_REPO_ROOT = Path(__file__).parent.parent.parent
SETTINGS_PATH = Path(os.environ.get("LMPARLOR_SETTINGS_PATH", str(_REPO_ROOT / ".cache/settings.json")))
SESSIONS_DIR = Path(os.environ.get("LMPARLOR_SESSIONS_DIR", str(_REPO_ROOT / ".cache/sessions")))

_ADJECTIVES = [
    "brave", "calm", "dark", "eager", "fancy", "gentle", "happy", "idle",
    "jolly", "kind", "lively", "merry", "noble", "odd", "proud", "quiet",
    "rapid", "sharp", "tidy", "unique", "vivid", "warm", "xenial", "young", "zany",
    "amber", "blue", "crisp", "deft", "electric", "frozen", "grand", "hollow",
    "icy", "jade", "keen", "lunar", "misty", "neon", "oaken", "pale",
    "rustic", "silver", "teal", "urban", "velvet", "wild", "yellow", "zinc",
]
_NOUNS = [
    "badger", "crane", "dingo", "eagle", "finch", "gecko", "heron", "ibis",
    "jaguar", "kite", "lynx", "moose", "newt", "otter", "panda", "quail",
    "raven", "stoat", "toad", "urial", "viper", "wren", "xerus", "yak", "zebra",
    "anchor", "bridge", "cedar", "drift", "ember", "fjord", "grove", "haven",
    "inlet", "jetty", "knoll", "ledge", "marsh", "nexus", "orbit", "petal",
    "quartz", "ridge", "stone", "tide", "vault", "wave", "xenon", "yard", "zenith",
]


def _random_slug() -> str:
    return "%s-%s" % (random.choice(_ADJECTIVES), random.choice(_NOUNS))

logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/presets")
def get_presets() -> List[dict]:
    presets = []
    for path in sorted(PRESETS_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        presets.append({"id": path.stem, **data})
    return presets


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
            sessions.append(json.loads(path.read_text()))
        except (OSError, json.JSONDecodeError):
            logger.warning("Failed to load session %s", path.name)
    return sessions


@app.patch("/sessions/{session_id}")
def rename_session(session_id: str, request: RenameRequest) -> dict:
    path = SESSIONS_DIR / ("%s.json" % session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        data = json.loads(path.read_text())
        new_label = request.label.strip()
        if not new_label:
            raise HTTPException(status_code=422, detail="label must not be empty")
        data["label"] = new_label
        path.write_text(json.dumps(data))
        return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.exception("Failed to rename session %s", session_id)
        raise HTTPException(status_code=500, detail="Failed to rename session") from exc


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

    slug = _random_slug()
    await ws.send_json({"type": "session_id", "id": slug})

    pause_event = asyncio.Event()
    pause_event.set()
    stop_event = asyncio.Event()

    engine_task = asyncio.create_task(
        _run_engine(ws, config, api_key, pause_event, stop_event, slug)
    )
    listener_task = asyncio.create_task(
        _run_listener(ws, pause_event, stop_event)
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
    slug: str,
) -> None:
    messages = []
    done_reason = None
    error_message = None
    try:
        last_message = None
        async for event in run_conversation(config, api_key, pause_event, stop_event):
            if isinstance(event, Generating):
                await ws.send_json({"type": "generating", "chatbot": event.chatbot})
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
            done_reason = "max_turns"
            await ws.send_json({"type": "done", "reason": "max_turns"})
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
        _save_session(slug, config, messages, done_reason, error_message)


def _save_session(
    slug: str,
    config: SessionConfig,
    messages: List[dict],
    done_reason: str | None,
    error: str | None,
) -> None:
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path = SESSIONS_DIR / ("%s.json" % slug)
        data = {
            "id": slug,
            "label": slug,
            "config": config.model_dump(),
            "messages": messages,
            "doneReason": done_reason,
            "error": error,
        }
        path.write_text(json.dumps(data))
    except OSError:
        logger.exception("Failed to save session %s", slug)


async def _run_listener(
    ws: WebSocket,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
) -> None:
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")
            if msg_type == "pause":
                pause_event.clear()
            elif msg_type == "resume":
                pause_event.set()
            elif msg_type == "stop":
                stop_event.set()
                pause_event.set()
                return
    except WebSocketDisconnect:
        stop_event.set()
        pause_event.set()
