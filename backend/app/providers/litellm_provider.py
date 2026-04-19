from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import litellm

from app.provider_state import ProviderState

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"

logger = logging.getLogger(__name__)

CACHEABLE_PROVIDERS = {"openrouter"}


async def call_litellm(
    provider: str,
    model: str,
    system_prompt: str,
    messages: List[dict],
    provider_state: Optional[ProviderState] = None,
) -> Tuple[str, str]:
    system_message = _build_system_message(provider, system_prompt)
    all_messages = [system_message] + messages
    _log_prompt(model, all_messages)
    extra_params: dict = {}
    full_model = "openrouter/%s" % model if provider == "openrouter" else model
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
    cache_metrics = _extract_cache_metrics(response)
    if cache_metrics:
        logger.info(
            "LiteLLM cache metrics: model=%s %s",
            model,
            " ".join("%s=%s" % (k, v) for k, v in cache_metrics.items()),
        )
        if provider_state is not None:
            provider_state.metadata["last_cache_metrics"] = cache_metrics
    logger.debug("LiteLLM response: model=%s, %d chars", model, len(content))
    return content, ""


def _build_system_message(provider: str, system_prompt: str) -> dict:
    if provider in CACHEABLE_PROVIDERS:
        return {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        }
    return {"role": "system", "content": system_prompt}


def _extract_cache_metrics(response: Any) -> Optional[Dict[str, Any]]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    metrics: Dict[str, Any] = {}
    for field_name in (
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "prompt_tokens",
        "completion_tokens",
    ):
        value = getattr(usage, field_name, None)
        if value is not None:
            metrics[field_name] = value
    return metrics if metrics else None


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
