import asyncio
import logging
from typing import List

logger = logging.getLogger(__name__)


async def call_claude_code(model: str, system_prompt: str, messages: List[dict]) -> str:
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
    ]
    if system_prompt:
        args += ["--system-prompt", system_prompt]
    args.append(prompt)

    logger.info("Calling claude CLI: model=%s", model)
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
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
    result = stdout.decode().strip()
    logger.debug("Claude CLI response: %d chars", len(result))
    return result


def _build_prompt(messages: List[dict]) -> str:
    if not messages:
        return "(conversation starts)"
    parts = []
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append(f"{role}: {msg['content']}")
    return "\n\n".join(parts)
