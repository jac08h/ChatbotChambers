from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import List, Tuple

import litellm

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"

logger = logging.getLogger(__name__)


def build_litellm_messages(system_prompt: str, messages: List[dict]) -> List[dict]:
    return [{"role": "system", "content": system_prompt}] + messages


async def call_litellm(
    provider: str,
    model: str,
    system_prompt: str,
    messages: List[dict],
) -> Tuple[str, str]:
    all_messages = build_litellm_messages(system_prompt, messages)
    _log_prompt(model, all_messages)
    extra_params = _build_extra_params(provider)
    full_model = f"openrouter/{model}" if provider == "openrouter" else model
    logger.info(
        "Calling LiteLLM: provider=%s model=%s message_count=%d",
        provider,
        model,
        len(all_messages),
    )
    response = await litellm.acompletion(
        model=full_model,
        messages=all_messages,
        **extra_params,
    )
    message = response.choices[0].message
    content = message.content or ""
    logger.debug("LiteLLM response: model=%s, %d chars", model, len(content))
    return content, ""


def _build_extra_params(provider: str) -> dict:
    if provider == "openrouter":
        return {"reasoning_effort": "none"}
    return {}


def _log_prompt(model: str, messages: List[dict]) -> None:
    if not LOGS_DIR.exists() or not LOGS_DIR.is_dir():
        return
    try:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "messages": messages,
        }
        with open(LOGS_DIR / "prompts.jsonl", "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        logger.exception("Failed to write prompt log")
