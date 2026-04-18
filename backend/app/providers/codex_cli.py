import asyncio
import logging
from typing import List

logger = logging.getLogger(__name__)


async def call_codex(model: str, system_prompt: str, messages: List[dict]) -> str:
    prompt = _build_prompt(system_prompt, messages)

    logger.info("Calling codex CLI: model=%s", model)
    process = await asyncio.create_subprocess_exec(
        "codex", "exec", "--model", model,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await process.communicate(input=prompt.encode())
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
    lines = [line for line in stdout.decode().splitlines() if line.strip()]
    result = lines[-1] if lines else ""
    logger.debug("Codex CLI response: %d chars", len(result))
    return result


def _build_prompt(system_prompt: str, messages: List[dict]) -> str:
    parts = []
    if system_prompt:
        parts.append(system_prompt)
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append(f"{role}: {msg['content']}")
    return "\n\n".join(parts)
