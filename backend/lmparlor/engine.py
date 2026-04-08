import asyncio
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Literal, Tuple, Union

from lmparlor.claude_code import call_claude_code
from lmparlor.codex_cli import call_codex
from lmparlor.models import Message, SessionConfig
from lmparlor.openrouter import call_openrouter

PROMPTS_DIR = Path(__file__).parent / "prompts"

PREAMBLE = (PROMPTS_DIR / "preamble.md").read_text().strip()
PREAMBLE_A = (PROMPTS_DIR / "preamble_a.md").read_text().strip()
PREAMBLE_B = (PROMPTS_DIR / "preamble_b.md").read_text().strip()


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
    labels = {"a": config.chatbot_a.name, "b": config.chatbot_b.name}

    chatbots = [
        ("a", config.chatbot_a, PREAMBLE_A),
        ("b", config.chatbot_b, PREAMBLE_B),
    ]

    while turn < config.max_turns:
        for chatbot_id, chatbot_config, individual_preamble in chatbots:
            if stop_event.is_set():
                return

            await pause_event.wait()

            if stop_event.is_set():
                return

            yield Generating(chatbot=chatbot_id)

            system_prompt = _build_system_prompt(
                individual_preamble,
                config.shared_system_prompt,
                chatbot_config.system_prompt,
            )
            messages = _build_messages(history, chatbot_id, labels)

            if chatbot_config.provider == "claude_code":
                content = await call_claude_code(
                    model=chatbot_config.model,
                    system_prompt=system_prompt,
                    messages=messages,
                )
                thinking = ""
            elif chatbot_config.provider == "codex":
                content = await call_codex(
                    model=chatbot_config.model,
                    system_prompt=system_prompt,
                    messages=messages,
                )
                thinking = ""
            else:
                content, thinking = await call_openrouter(
                    model=chatbot_config.model,
                    system_prompt=system_prompt,
                    messages=messages,
                    api_key=api_key,
                )

            history.append((chatbot_id, content))
            yield Message(
                chatbot=chatbot_id,
                name=chatbot_config.name,
                model=chatbot_config.model,
                content=content,
                turn=turn,
                thinking=thinking,
            )

            if content.strip() == "/leave":
                return

        turn += 1


def _build_system_prompt(
    individual_preamble: str, shared: str, individual: str
) -> str:
    parts = [p for p in [PREAMBLE, individual_preamble, shared.strip(), individual.strip()] if p]
    return "\n\n".join(parts)


def _build_messages(
    history: List[Tuple[str, str]], chatbot_id: str, labels: Dict[str, str]
) -> List[dict]:
    messages = []
    for speaker, content in history:
        role = "assistant" if speaker == chatbot_id else "user"
        label = labels[speaker]
        messages.append({"role": role, "content": f"{label}: {content}"})
    return messages
