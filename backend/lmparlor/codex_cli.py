import asyncio
from typing import List


async def call_codex(model: str, system_prompt: str, messages: List[dict]) -> str:
    prompt = _build_prompt(system_prompt, messages)

    process = await asyncio.create_subprocess_exec(
        "codex", "exec", "--model", model,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, _ = await process.communicate(input=prompt.encode())
    except asyncio.CancelledError:
        process.kill()
        await process.wait()
        raise
    lines = [line for line in stdout.decode().splitlines() if line.strip()]
    return lines[-1] if lines else ""


def _build_prompt(system_prompt: str, messages: List[dict]) -> str:
    parts = []
    if system_prompt:
        parts.append(system_prompt)
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append(f"{role}: {msg['content']}")
    return "\n\n".join(parts)
