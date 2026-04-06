import asyncio
import logging
import os
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from lmparlor.engine import Generating, run_conversation
from lmparlor.models import MODELS, SessionConfig

logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/models")
def get_models() -> List[dict]:
    return [{"id": model_id, "name": name} for model_id, name in MODELS]


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    data = await ws.receive_json()
    if data.get("type") != "start":
        await ws.send_json({"type": "error", "message": "Expected start message"})
        await ws.close()
        return

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        await ws.send_json({"type": "error", "message": "OPENROUTER_API_KEY not set"})
        await ws.close()
        return

    config = SessionConfig(**data["config"])
    pause_event = asyncio.Event()
    pause_event.set()
    stop_event = asyncio.Event()

    engine_task = asyncio.create_task(
        _run_engine(ws, config, api_key, pause_event, stop_event)
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
) -> None:
    try:
        last_content = ""
        async for event in run_conversation(config, api_key, pause_event, stop_event):
            if isinstance(event, Generating):
                await ws.send_json({"type": "generating", "chatbot": event.chatbot})
            else:
                last_content = event.content
                await ws.send_json({"type": "message", "data": event.model_dump()})

        if stop_event.is_set():
            reason = "stopped"
        elif "/leave" in last_content:
            reason = "leave"
        else:
            reason = "max_turns"

        await ws.send_json({"type": "done", "reason": reason})
    except WebSocketDisconnect:
        stop_event.set()
    except Exception as e:
        logger.exception("Engine error")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


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
