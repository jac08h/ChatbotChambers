import asyncio
import logging
import uuid
from typing import List, Tuple

logger = logging.getLogger(__name__)


async def call_claude_code(
    model: str,
    system_prompt: str,
    messages: List[dict],
    session_id: str | None,
) -> Tuple[str, str]:
    prompt = _latest_message_content(messages)
    args = [
        "claude",
        "-p",
        "--tools",
        "",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers": {}}',
    ]

    if session_id is None:
        session_id = str(uuid.uuid4())
        args += ["--session-id", session_id]
        if system_prompt:
            args += ["--system-prompt", system_prompt]
    else:
        args += ["--resume", session_id]

    args += [
        "--model",
        model,
    ]

    if session_id is None and system_prompt:
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
    return result, session_id


def _latest_message_content(messages: List[dict]) -> str:
    if not messages:
        return "(conversation starts)"
    return messages[-1]["content"]
