import asyncio
from typing import AsyncGenerator, List, Literal, Tuple, Union

from lmparlor.models import Message, SessionConfig
from lmparlor.openrouter import call_openrouter


class Generating:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


async def run_conversation(
    config: SessionConfig,
    api_key: str,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
) -> AsyncGenerator[Union[Generating, Message], None]:
    history: List[Tuple[str, str]] = []
    turn = 0

    chatbots = [
        ("a", config.chatbot_a),
        ("b", config.chatbot_b),
    ]

    while turn < config.max_turns:
        for chatbot_id, chatbot_config in chatbots:
            if stop_event.is_set():
                return

            await pause_event.wait()

            if stop_event.is_set():
                return

            yield Generating(chatbot=chatbot_id)

            system_prompt = _build_system_prompt(
                config.shared_system_prompt, chatbot_config.system_prompt
            )
            messages = _build_messages(history, chatbot_id)

            content = await call_openrouter(
                model=chatbot_config.model,
                system_prompt=system_prompt,
                messages=messages,
                api_key=api_key,
            )

            history.append((chatbot_id, content))
            yield Message(
                chatbot=chatbot_id,
                model=chatbot_config.model,
                content=content,
                turn=turn,
            )

            if "/leave" in content:
                return

        turn += 1


def _build_system_prompt(shared: str, individual: str) -> str:
    parts = [p for p in [shared.strip(), individual.strip()] if p]
    return "\n\n".join(parts)


def _build_messages(history: List[Tuple[str, str]], chatbot_id: str) -> List[dict]:
    messages = []
    for speaker, content in history:
        role = "assistant" if speaker == chatbot_id else "user"
        messages.append({"role": role, "content": content})
    return messages
