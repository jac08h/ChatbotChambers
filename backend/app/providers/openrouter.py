import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

from openai import AsyncOpenAI

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"

logger = logging.getLogger(__name__)


async def call_openrouter(
    model: str,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
    enable_thinking: bool = False,
) -> Tuple[str, str]:
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    _log_prompt(model, all_messages)
    extra_params: dict = {}
    if enable_thinking:
        extra_params["extra_body"] = {"reasoning": {"effort": "high"}}
    response = await client.chat.completions.create(
        model=model,
        messages=all_messages,
        **extra_params,
    )
    message = response.choices[0].message
    raw_content = message.content or ""
    thinking_match = re.search(r"<think>([\s\S]*?)</think>", raw_content)
    inline_thinking = thinking_match.group(1).strip() if thinking_match else ""
    content = re.sub(r"<think>[\s\S]*?</think>", "", raw_content).strip()
    reasoning = getattr(message, "reasoning", None)
    reasoning = reasoning.strip() if isinstance(reasoning, str) else ""
    thinking = reasoning or inline_thinking
    return content, thinking


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
