import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

import litellm

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"

logger = logging.getLogger(__name__)


async def call_litellm(
    model: str,
    system_prompt: str,
    messages: List[dict],
    enable_thinking: bool = False,
) -> Tuple[str, str]:
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    _log_prompt(model, all_messages)
    extra_params: dict = {}
    if enable_thinking:
        extra_params["reasoning_effort"] = "high"
    response = await litellm.acompletion(
        model=model,
        messages=all_messages,
        **extra_params,
    )
    message = response.choices[0].message
    content = message.content or ""
    thinking = getattr(message, "reasoning_content", None) or ""
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
