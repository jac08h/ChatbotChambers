import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import AsyncIterator
from urllib.parse import urlparse

import litellm
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.app.providers.litellm_provider import (
    build_litellm_extra_params,
    build_litellm_messages,
)

logger = logging.getLogger(__name__)
app = FastAPI()

_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_REQUESTS = 30
_rate_limit_state: dict[str, deque[float]] = defaultdict(deque)


class TurnMessage(BaseModel):
    speaker: str = Field(min_length=1)
    content: str = Field(min_length=1)


class TurnRequest(BaseModel):
    system_prompt: str
    messages: list[TurnMessage]
    model: str = Field(min_length=1)
    openrouter_key: str = Field(min_length=1)


@app.post("/api/turn")
async def create_turn(request: Request, payload: TurnRequest) -> StreamingResponse:
    if not _origin_allowed(request):
        raise HTTPException(status_code=403, detail="Origin not allowed")
    _check_rate_limit(_client_id(request))

    async def event_stream() -> AsyncIterator[str]:
        content_parts: list[str] = []
        try:
            response = await litellm.acompletion(
                model=f"openrouter/{payload.model}",
                api_key=payload.openrouter_key,
                messages=build_litellm_messages(
                    payload.system_prompt,
                    [
                        {
                            "role": "assistant",
                            "content": f"{message.speaker}: {message.content}",
                        }
                        for message in payload.messages
                    ],
                ),
                **build_litellm_extra_params("openrouter"),
                stream=True,
            )
            async for chunk in response:
                delta = _chunk_text(chunk)
                if not delta:
                    continue
                content_parts.append(delta)
                yield _sse({"type": "delta", "content": delta})
            yield _sse(
                {
                    "type": "result",
                    "content": "".join(content_parts),
                    "thinking": "",
                }
            )
        except Exception:
            logger.exception("Hosted turn failed for model=%s", payload.model)
            yield _sse(
                {
                    "type": "error",
                    "message": "OpenRouter request failed.",
                }
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _check_rate_limit(client_id: str) -> None:
    now = time.time()
    _prune_rate_limit_state(now)
    timestamps = _rate_limit_state[client_id]
    while timestamps and now - timestamps[0] >= _RATE_LIMIT_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= _RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests")
    timestamps.append(now)


def _prune_rate_limit_state(now: float) -> None:
    expired_clients = []
    for client_id, timestamps in _rate_limit_state.items():
        while timestamps and now - timestamps[0] >= _RATE_LIMIT_WINDOW_SECONDS:
            timestamps.popleft()
        if not timestamps:
            expired_clients.append(client_id)
    for client_id in expired_clients:
        _rate_limit_state.pop(client_id, None)


def _client_id(request: Request) -> str:
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        if request.headers.get("x-vercel-id"):
            return forwarded_for.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True

    configured = [
        item.strip()
        for item in os.environ.get("CHATBOTCHAMBERS_ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    ]
    if configured:
        return origin in configured

    parsed_origin = urlparse(origin)
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    forwarded_host = request.headers.get(
        "x-forwarded-host", request.headers.get("host", request.url.netloc)
    )
    return parsed_origin.scheme == forwarded_proto and parsed_origin.netloc == forwarded_host


def _chunk_text(chunk: object) -> str:
    choices = getattr(chunk, "choices", None) or []
    if not choices:
        return ""
    delta = getattr(choices[0], "delta", None)
    if delta is None:
        return ""
    content = getattr(delta, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(str(item.get("text", "")))
        return "".join(text_parts)
    return ""


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"
