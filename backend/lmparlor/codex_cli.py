import asyncio
from typing import AsyncGenerator, List


async def call_codex(model: str, system_prompt: str, messages: List[dict]) -> str:
    content = ""
    async for content in stream_codex(model, system_prompt, messages):
        continue
    return content


async def stream_codex(
    model: str, system_prompt: str, messages: List[dict]
) -> AsyncGenerator[str, None]:
    prompt = _build_prompt(system_prompt, messages)

    process = await asyncio.create_subprocess_exec(
        "codex", "exec", "--model", model,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output = ""
    stderr_task = asyncio.create_task(process.stderr.read())
    try:
        process.stdin.write(prompt.encode())
        await process.stdin.drain()
        process.stdin.close()

        while True:
            chunk = await process.stdout.read(1024)
            if not chunk:
                break
            output += chunk.decode()
            yield _extract_content(output)
        await process.wait()
        await stderr_task
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


def _build_prompt(system_prompt: str, messages: List[dict]) -> str:
    parts = []
    if system_prompt:
        parts.append(system_prompt)
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append("%s: %s" % (role, msg["content"]))
    return "\n\n".join(parts)


def _extract_content(output: str) -> str:
    lines = [line for line in output.splitlines() if line.strip()]
    return lines[-1] if lines else ""
