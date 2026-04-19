import asyncio
import json
import logging
import os
from typing import Dict, List, Optional

from app.provider_state import ProviderState

logger = logging.getLogger(__name__)


async def call_claude_code(
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
    prompt = _build_prompt(messages)
    args = [
        "claude",
        "-p",
        "--model",
        model,
        "--tools",
        "",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers": {}}',
        "--output-format",
        "json",
    ]
    if system_prompt:
        args += ["--system-prompt", system_prompt]
    args.append(prompt)

    logger.info("Calling claude CLI (initial): model=%s", model)
    result, parsed = await _run_process(args, _build_env(provider_state))
    if provider_state and parsed:
        session_id = parsed.get("session_id")
        if session_id:
            provider_state.session_id = session_id
            provider_state.initialized = True
            logger.info("Claude session initialized: %s", session_id)
    return result


async def _call_resumed(
    model: str,
    messages: List[dict],
    provider_state: ProviderState,
) -> str:
    last_content = _extract_last_message(messages)
    args = [
        "claude",
        "-p",
        "--model",
        model,
        "--resume",
        provider_state.session_id,
        "--output-format",
        "json",
    ]
    args.append(last_content)

    logger.info(
        "Calling claude CLI (resumed): model=%s session=%s",
        model,
        provider_state.session_id,
    )
    result, parsed = await _run_process(args, _build_env(provider_state))
    if parsed:
        new_session_id = parsed.get("session_id")
        if new_session_id:
            provider_state.session_id = new_session_id
    return result


async def _run_process(
    args: List[str], env: Optional[Dict[str, str]]
) -> tuple:
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    try:
        stdout, stderr = await process.communicate()
    except asyncio.CancelledError:
        logger.warning("Claude CLI call cancelled, killing process")
        process.kill()
        await process.wait()
        raise
    if process.returncode != 0:
        logger.warning(
            "Claude CLI exited with code %d: %s",
            process.returncode,
            stderr.decode().strip(),
        )
    raw = stdout.decode().strip()
    parsed = _parse_json_output(raw)
    if parsed is not None:
        result = parsed.get("result", raw)
        logger.debug("Claude CLI response (json): %d chars", len(result))
        return result, parsed
    logger.debug("Claude CLI response (raw): %d chars", len(raw))
    return raw, None


def _build_env(provider_state: Optional[ProviderState]) -> Optional[Dict[str, str]]:
    if provider_state and provider_state.storage_path:
        env = os.environ.copy()
        env["CLAUDE_CONFIG_DIR"] = provider_state.storage_path
        return env
    return None


def _parse_json_output(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def _extract_last_message(messages: List[dict]) -> str:
    if messages:
        return messages[-1].get("content", "(continue)")
    return "(continue)"


def _build_prompt(messages: List[dict]) -> str:
    if not messages:
        return "(conversation starts)"
    parts = []
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append("%s: %s" % (role, msg["content"]))
    return "\n\n".join(parts)
