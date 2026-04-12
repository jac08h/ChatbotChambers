import asyncio
import logging
from typing import AsyncGenerator, List

logger = logging.getLogger(__name__)


async def call_claude_code(model: str, system_prompt: str, messages: List[dict]) -> str:
    content = ""
    async for content in stream_claude_code(model, system_prompt, messages):
        continue
    return content


async def stream_claude_code(
    model: str, system_prompt: str, messages: List[dict]
) -> AsyncGenerator[str, None]:
    prompt = _build_prompt(messages)
    args = ["claude", "-p", "--model", model]
    if system_prompt:
        args += ["--system-prompt", system_prompt]
    args.append(prompt)

    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output = ""
    stderr_task = asyncio.create_task(process.stderr.read())
    try:
        while True:
            chunk = await process.stdout.read(1024)
            if not chunk:
                break
            output += chunk.decode()
            yield output.strip()
        await process.wait()
        stderr_output = (await stderr_task).decode().strip()
        if stderr_output:
            logger.warning("Claude CLI stderr: %s", stderr_output)
    except asyncio.CancelledError:
        stderr_task.cancel()
        process.kill()
        await process.wait()
        raise
    finally:
        if not stderr_task.done():
            stderr_task.cancel()
            try:
                await stderr_task
            except asyncio.CancelledError:
                pass


def _build_prompt(messages: List[dict]) -> str:
    parts = []
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append("%s: %s" % (role, msg["content"]))
    return "\n\n".join(parts)
