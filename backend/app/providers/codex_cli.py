import asyncio
import json
import logging
from typing import Dict, List, Optional

from app.provider_state import ProviderState

logger = logging.getLogger(__name__)


async def call_codex(
    model: str,
    system_prompt: str,
    messages: List[dict],
    provider_state: Optional[ProviderState] = None,
) -> str:
    if provider_state and provider_state.initialized and provider_state.session_id:
        return await _call_resumed(model, messages, provider_state)
    return await _call_initial(model, system_prompt, messages, provider_state)


async def _call_initial(
    model: str,
    system_prompt: str,
    messages: List[dict],
    provider_state: Optional[ProviderState],
) -> str:
    prompt = _build_prompt(system_prompt, messages)

    logger.info("Calling codex CLI (initial): model=%s", model)
    args = [
        "codex", "exec",
        "--model", model,
        "--output-format", "json",
    ]
    result, parsed = await _run_process(args, prompt.encode())
    if provider_state and parsed:
        session_id = parsed.get("session_id")
        if session_id:
            provider_state.session_id = session_id
            provider_state.initialized = True
            logger.info("Codex session initialized: %s", session_id)
    return result


async def _call_resumed(
    model: str,
    messages: List[dict],
    provider_state: ProviderState,
) -> str:
    last_content = _extract_last_message(messages)

    logger.info(
        "Calling codex CLI (resumed): model=%s session=%s",
        model,
        provider_state.session_id,
    )
    args = [
        "codex", "exec", "resume", provider_state.session_id,
        "--model", model,
        "--output-format", "json",
    ]
    result, parsed = await _run_process(args, last_content.encode())
    if parsed:
        new_session_id = parsed.get("session_id")
        if new_session_id:
            provider_state.session_id = new_session_id
    return result


async def _run_process(args: List[str], stdin_data: bytes) -> tuple:
    process = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await process.communicate(input=stdin_data)
    except asyncio.CancelledError:
        logger.warning("Codex CLI call cancelled, killing process")
        process.kill()
        await process.wait()
        raise
    if process.returncode != 0:
        logger.warning(
            "Codex CLI exited with code %d: %s",
            process.returncode,
            stderr.decode().strip(),
        )
    raw = stdout.decode().strip()
    parsed = _parse_json_output(raw)
    if parsed is not None:
        result = parsed.get("output", "")
        if not result:
            lines = [line for line in raw.splitlines() if line.strip()]
            result = lines[-1] if lines else ""
        logger.debug("Codex CLI response (json): %d chars", len(result))
        return result, parsed
    lines = [line for line in raw.splitlines() if line.strip()]
    result = lines[-1] if lines else ""
    logger.debug("Codex CLI response (raw): %d chars", len(result))
    return result, None


def _parse_json_output(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def _extract_last_message(messages: List[dict]) -> str:
    if messages:
        return messages[-1].get("content", "(continue)")
    return "(continue)"


def _build_prompt(system_prompt: str, messages: List[dict]) -> str:
    parts = []
    if system_prompt:
        parts.append(system_prompt)
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append("%s: %s" % (role, msg["content"]))
    return "\n\n".join(parts)
