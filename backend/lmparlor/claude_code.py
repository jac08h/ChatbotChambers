import asyncio
from typing import List


async def call_claude_code(model: str, system_prompt: str, messages: List[dict]) -> str:
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
    try:
        stdout, _ = await process.communicate()
    except asyncio.CancelledError:
        process.kill()
        await process.wait()
        raise
    return stdout.decode().strip()


def _build_prompt(messages: List[dict]) -> str:
    parts = []
    for msg in messages:
        role = "Human" if msg["role"] == "user" else "Assistant"
        parts.append(f"{role}: {msg['content']}")
    return "\n\n".join(parts)
