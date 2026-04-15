import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

MOCK_MODELS: List[Tuple[str, str]] = [
    ("mock/fast-model", "Mock Fast"),
    ("mock/thinking-model", "Mock Thinker"),
]

_call_count = 0


async def call_mock(
    model: str,
    system_prompt: str,
    messages: List[dict],
) -> Tuple[str, str]:
    global _call_count
    _call_count += 1
    turn = (_call_count + 1) // 2

    last_user_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_message = msg.get("content", "")
            break

    if "/leave" in last_user_message or turn > 3:
        return "/leave", ""

    content = "Mock response %d from %s" % (_call_count, model)
    thinking = ""
    if model == "mock/thinking-model":
        thinking = "Mock thinking for turn %d" % turn

    return content, thinking


def reset_mock_state() -> None:
    global _call_count
    _call_count = 0
