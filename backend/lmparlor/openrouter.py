import re
from typing import List

from openai import AsyncOpenAI


async def call_openrouter(
    model: str,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
) -> str:
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    all_messages = [{"role": "system", "content": system_prompt}] + messages
    response = await client.chat.completions.create(
        model=model,
        messages=all_messages,
    )
    content = response.choices[0].message.content or ""
    return re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
