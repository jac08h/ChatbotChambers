import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, List, Tuple

from openai import AsyncOpenAI

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"

logger = logging.getLogger(__name__)


async def call_openrouter(
    model: str,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
) -> Tuple[str, str]:
    content = ""
    thinking = ""
    async for streamed_content, streamed_thinking in stream_openrouter(
        model, system_prompt, messages, api_key
    ):
        content = streamed_content
        thinking = streamed_thinking
    return content, thinking


async def stream_openrouter(
    model: str,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
) -> AsyncGenerator[Tuple[str, str], None]:
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    _log_prompt(model, all_messages)
    stream = await client.chat.completions.create(
        model=model,
        messages=all_messages,
        stream=True,
    )
    raw_content = ""
    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content or ""
            if not delta:
                continue
            raw_content += delta
            yield _split_content_and_thinking(raw_content)
    except asyncio.CancelledError:
        raise


def _log_prompt(model: str, messages: List[dict]) -> None:
    try:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "messages": messages,
        }
        with open(LOGS_DIR / "prompts.jsonl", "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        logger.exception("Failed to write prompt log")


def _split_content_and_thinking(raw_content: str) -> Tuple[str, str]:
    visible_parts: List[str] = []
    first_thinking = ""
    thinking_parts: List[str] = []
    inside_think = False
    index = 0

    while index < len(raw_content):
        if raw_content.startswith("<think>", index):
            inside_think = True
            thinking_parts = []
            index += len("<think>")
            continue
        if raw_content.startswith("</think>", index):
            if inside_think and not first_thinking:
                first_thinking = "".join(thinking_parts).strip()
            inside_think = False
            thinking_parts = []
            index += len("</think>")
            continue

        character = raw_content[index]
        if inside_think:
            thinking_parts.append(character)
        else:
            visible_parts.append(character)
        index += 1

    return "".join(visible_parts).strip(), first_thinking
